const gameManagerId = $.worldItemReference("GameManager");

$.onStart(() => {
    $.state.playerManagerPairs = {};
    $.state.checkTimer = 0;
});

$.onReceive((messageType, arg, sender) => {

    // GameManagerから「マッチスタート」の合図が来たら、全員分を自動生成
    if (messageType === "StartMatch") {
        // 1. 近くのプレイヤー（全員）を一本釣り
        let allPlayers = $.getPlayersNear($.getPosition(), Infinity);
        
        // 看板（Text）へのデバッグ表示（問題なければ残しておいてOKです！）
        let debugNames = [];
        for (let i = 0; i < allPlayers.length; i++) {
            if (allPlayers[i] && allPlayers[i].exists()) {
                debugNames.push(`[${i}] ${allPlayers[i].userDisplayName}`);
            }
        }
        if ($.subNode("Text")) {
            $.subNode("Text").setText(`【生成対象】\n${debugNames.join("\n")}`);
        }

        // 💡【バグ修正の肝】forEachではなく、通常のforループで1人ずつ順番に確定させていく
        for (let i = 0; i < allPlayers.length; i++) {
            let player = allPlayers[i];

            if (player && player.exists()) {
                // ループのたびに、常に最新の書き込み完了済みstateを読み直す
                let pairs = $.state.playerManagerPairs ?? {};

                // すでにこのプレイヤーのマネージャーが存在するなら絶対にスキップ！
                if (pairs[player.userId]) {
                    $.log(`${player.userDisplayName} は既に生成済みのためスキップします`);
                    continue; 
                }

                $.log(`${player.userDisplayName} 用の個別マネージャーを生成します`);

                // 個別マネージャーの自動生成（プレイヤーの足元に正確に作る）
                const templateId = new WorldItemTemplateId("BattlePrivateManager");
                const commItem = $.createItem(templateId, player.getPosition(), player.getRotation());

                // ローカル変数（オブジェクト）に記録
                pairs[player.userId] = {
                    player: player,
                    managerHandle: commItem 
                };

                // 💡【最重要】次の人のループ（i++）に進む前に、即座にstateに保存して二重生成を完全に物理ガードする！
                $.state.playerManagerPairs = pairs;

                // 個別マネージャーの初期化信号を送信
                commItem.send("init", { player: player, gameManagerId: gameManagerId });
            }
        }
    }

    // GameManagerから「マッチ終了（リセット）」の合図が来たら、全員のマネージャーを消去
    if (messageType === "EndMatch") {
        let pairs = $.state.playerManagerPairs ?? {};

        for (let userId in pairs) {
            let mHandle = pairs[userId].managerHandle;
            if (mHandle && mHandle.exists()) {
                mHandle.send("DestroyYourself", null);
            }
        }

        // ペアのリストを完全に空にして次の試合に備える
        $.state.playerManagerPairs = {};
        
        if ($.subNode("Text")) {
            $.subNode("Text").setText("試合終了（待機中）");
        }
    }
});

// 【定期チェック】
$.onUpdate((deltaTime) => {
    let checkTimer = $.state.checkTimer ?? 0;
    checkTimer += deltaTime;

    if (checkTimer >= 5) { // 5秒ごとに一括チェック
        CheckActivePairs();
        checkTimer = 0;
    }
    $.state.checkTimer = checkTimer;
});

/**
 * プレイヤーとマネージャーの組を巡回し、プレイヤーが退室していたらマネージャーを消す関数
 */
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