const gameManagerId = $.worldItemReference("GameManager");

$.onStart(() => {
    $.state.playerManagerPairs = {};
    $.state.checkTimer = 0;
});

$.onReceive((messageType, arg, sender) => {

    // GameManagerから「マッチスタート」の合図が来たら、全員分を自動生成
    if (messageType === "StartMatch") {

        let matchPlayers = arg.matchPlayers ?? {}; //参加者のリスト

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

                if (pairs[player.userId]) continue; 

                const templateId = new WorldItemTemplateId("BattlePrivateManager");
                const commItem = $.createItem(templateId, player.getPosition(), player.getRotation());

                pairs[player.userId] = {
                    player: player,
                    managerHandle: commItem 
                };

                $.state.playerManagerPairs = pairs;

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
        $.state.playerManagerPairs = {};
        
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