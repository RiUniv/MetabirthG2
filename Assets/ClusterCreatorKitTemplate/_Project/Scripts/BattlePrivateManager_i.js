$.onReceive((messageType, arg, sender) => {
    if (messageType === "init") {
        const targetPlayer = arg.player;
        $.requestOwner(targetPlayer);
        $.log("player scriptをセットしましたよ!");
        $.setPlayerScript(targetPlayer);
        $.state.targetPlayer = targetPlayer;
        $.state.gameManagerId = arg.gameManagerId;

        if (targetPlayer && arg.gameManagerId) {
            targetPlayer.send("InitPlayerScript", {
                gameManagerId: arg.gameManagerId
            });
        }
    }

    if (messageType === "Damaged") {
        $.sendSignalCompat("owner",  "Damaged");
        $.setStateCompat("owner",  "playerhp",arg);
    }

    if (messageType === "UpdateKillsUI") {
        $.setStateCompat("owner", "playerKills", arg);
    }

    if (messageType === "DestroyYourself") {
        const target = $.state.targetPlayer;
        if (target && target.exists()) {

        }
        $.log("管理側からの命令により、自身を破棄します。");
        $.destroy(); // アイテム自身を破棄
    }
}, { player: true });