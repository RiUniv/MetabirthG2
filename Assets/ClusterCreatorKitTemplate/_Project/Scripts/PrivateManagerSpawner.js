const gameManagerId = $.worldItemReference("GameManager");
const debugLoggerId = $.worldItemReference("DebugLogger");

$.onStart(() => {
    $.state.playerManagerPairs = {};
    $.state.checkTimer = 0;
});

$.onReceive((messageType, arg, sender) => {

    // GameManagerから「マッチスタート」の合図が来たら、全員分を自動生成
    if (messageType === "StartMatch") {

        let matchPlayers = arg.matchPlayers ?? {}; //参加者のリスト
        let pairs = $.state.playerManagerPairs ?? {}; // 既存の全マネージャーのストック

        let debugNames = [];
        for (let id in matchPlayers) {
            if (matchPlayers[id] && matchPlayers[id].exists()) {
                debugNames.push(`・${matchPlayers[id].userDisplayName}`);
            }
        }

        if ($.subNode("Text")) {
            $.subNode("Text").setText(`【生成対象】\n${debugNames.join("\n")}`);
        }

        //個別マネージャー生成ループ
        for (let userId in matchPlayers) {
            let player = matchPlayers[userId];

            if (player && player.exists()) {
                let pairs = $.state.playerManagerPairs ?? {};

                //もしすでにこの人のマネージャーがストックにある（過去の試合で生成済み）なら
                if (pairs[player.userId] && pairs[player.userId].managerHandle.exists()) {
                    $.log(`${player.userDisplayName} の既存マネージャーを再利用します`);
                    
                    // 既存のマネージャーへもう一度動き出してと通知を送る（再生成はしない）
                    pairs[player.userId].managerHandle.send("ReStartMatch", { gameManagerId: gameManagerId });
                    continue; // 次の人の処理へスキップ
                }
                //過去に一度もマネージャーが作られていない人だけ、ここへ進んで新しく生成する
                const templateId = new WorldItemTemplateId("BattlePrivateManager");
                const commItem = $.createItem(templateId, player.getPosition(), player.getRotation());
                SendToLogger(`Private Manager Spawner : [${player.userDisplayName}のマネージャー] を生成しました。`);

                pairs[player.userId] = {
                    player: player,
                    managerHandle: commItem 
                };

                $.state.playerManagerPairs = pairs;

                commItem.send("init", { player: player, gameManagerId: gameManagerId ,debugLoggerId : debugLoggerId});
            }
        }
    }

    // GameManagerから「マッチ終了（リセット）」の合図が来たら、全員のマネージャーを消去
    if (messageType === "EndMatch") {
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
});


$.onUpdate((deltaTime) => {
    let checkTimer = $.state.checkTimer ?? 0;
    checkTimer += deltaTime;

    if (checkTimer >= 5) { // 5秒ごとに一括チェック
        CheckActivePairs();
        checkTimer = 0;
    }
    $.state.checkTimer = checkTimer;
});

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