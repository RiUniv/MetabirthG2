const gameManagerId = $.worldItemReference("GameManager");
const debugLoggerId = $.worldItemReference("DebugLogger");

$.onStart(() => {
    $.state.playerManagerPairs = {};
    $.state.checkTimer = 0;
    $.state.spawnTimer = 0;
    $.state.spawnQueue = [];
    $.state.waitingPlayerId = null;
    
});

$.onReceive((messageType, arg, sender) => {

    // GameManagerから「マッチスタート」の合図が来たら、全員分を自動生成
    if (messageType === "StartMatch") {

        let matchPlayers = arg.matchPlayers ?? {}; //参加者のリスト
        let debugNames = [];
        let queue = [];
        let pairs = $.state.playerManagerPairs ?? {}; // 既存の全マネージャーのストック

        //送られてきたプレイヤーをマネージャー生成待機キューに追加ループ
        for (let id in matchPlayers) {
            let player = matchPlayers[id];
            if (player && player.exists()) {
                debugNames.push(`・${player.userDisplayName}`);
                queue.push(player); // キューにプレイヤーオブジェクトを追加
            }
        }

        if ($.subNode("Text")) {
            $.subNode("Text").setText(`【生成対象】\n${debugNames.join("\n")}`);
        }

        $.state.spawnQueue = queue;
        $.state.waitingPlayerId = null
    }

    // GameManagerから「マッチ終了（リセット）」の合図が来たら、全員のマネージャーを消去
    if (messageType === "EndMatch") {
        $.state.spawnQueue = [];
        let pairs = $.state.playerManagerPairs ?? {};

        for (let userId in pairs) {
            let mHandle = pairs[userId].managerHandle;
            if (mHandle && mHandle.exists()) {
                mHandle.send("SleepYourself", null); // スリープさせる
            }
        }
        
        if ($.subNode("Text")) {
            $.subNode("Text").setText("試合終了（待機中）");
        }
    }

    //生成したマネージャーが準備完了した時に送り返してくるメッセージ
    if (messageType === "ManagerReady") {
        let queue = $.state.spawnQueue ?? [];
        
        // 報告してきたプレイヤーが、今まさに待っていたプレイヤーであれば
        if ($.state.waitingPlayerId === arg.userId) {
            SendToLogger(`[Spawner] ${arg.userName} の完全同期を確認しました。次の人の生成へ進みます。`);
            
            //ここで初めてキューの先頭を消し、ロックを解除して次の人の生成を許可する
            queue.shift();
            $.state.spawnQueue = queue; 
            $.state.waitingPlayerId = null; // 待機解除

            if (queue.length === 0) {
                SendToLogger(`PrivateManagerSpawner :【全員同期完了】GameManagerへ試合開始を要求します。`);
                if (gameManagerId) {
                    gameManagerId.send("ReadyToStartMatch", null);
                }
            }
        }
    }
});


$.onUpdate((deltaTime) => {
    //退室チェック/////////////////
    let checkTimer = $.state.checkTimer ?? 0;
    checkTimer += deltaTime;

    if (checkTimer >= 5) { // 5秒ごとに一括チェック
        CheckActivePairs();
        checkTimer = 0;
    }
    $.state.checkTimer = checkTimer;
    /////////////////


    //PrivateManager生成処理///////////////
    //少しディレイかける
    let spawnTimer = $.state.spawnTimer ?? 0;
    spawnTimer += deltaTime;
    if (spawnTimer >= 1) {
        SpawnPrivateManager();
        spawnTimer = 0;
    }
    $.state.spawnTimer = spawnTimer;

});

function SpawnPrivateManager(){
    let queue = $.state.spawnQueue ?? [];
    if(queue.length <= 0) return;

    let player = queue[0];
    if(!player || !player.exists()) return;

    //現在、前の人の確定(生成したマネージャーからのメッセージ)を待っている最中なら生成処理は止まる
    if ($.state.waitingPlayerId !== null) {
        return; 
    }

    let pairs = $.state.playerManagerPairs ?? {};

    //すでにマネージャーが生成済みなら再利用
    if(pairs[player.userId] && pairs[player.userId].managerHandle.exists()){
        queue.shift();
        $.state.spawnQueue = queue;
        pairs[player.userId].managerHandle.send("ReStartMatch", { gameManagerId: gameManagerId });
        return;
    }
    
    //////////新規作成↓//////////
    
    //誰のマネージャーからのメッセージ待ちか設定
    $.state.waitingPlayerId = player.userId;

    const templateId = new WorldItemTemplateId("BattlePrivateManager");
    const commItem = $.createItem(templateId, player.getPosition(), player.getRotation());
    SendToLogger(`Private Manager Spawner : [${player.userDisplayName}のマネージャー] を生成しました。`);

    pairs[player.userId] = {
        player: player,
        managerHandle: commItem 
    };

    $.state.playerManagerPairs = pairs;
    commItem.send("init", { 
        player: player, 
        gameManagerId: gameManagerId, 
        debugLoggerId: debugLoggerId,
        spawnerId: $.itemHandle //相手がこちらへ送り返せるようにこれのIDを渡す
    });

    //queue.shiftはメッセージが送られた時onReceive内で行う
}

function CheckActivePairs() {
    let pairs = $.state.playerManagerPairs ?? {};

    for (let userId in pairs) {
        const player = pairs[userId].player;
        const mHandle = pairs[userId].managerHandle;

        if (!player || !player.exists()) {
            if (mHandle && mHandle.exists()) {
                mHandle.send("DestroyYourself", null);
            }
            delete pairs[userId];
        }
    }

    $.state.playerManagerPairs = pairs;
}

function SendToLogger(text) {
    if (debugLoggerId) {
        debugLoggerId.send("Log", { text: text });
    }
}