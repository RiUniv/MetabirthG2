$.onStart(() => {
    $.state.targetPlayer = null;
    $.state.gameManagerId = null;
    $.state.isScriptInitialized = false;
});

$.onReceive((messageType, arg, sender) => {
    if (messageType === "init") {
        const targetPlayer = arg.player;
        if (!targetPlayer) return;

        $.requestOwner(targetPlayer);

        // 情報をstateに保存して、各プレイヤーの端末の onUpdate に処理をバトンタッチする
        $.state.targetPlayer = targetPlayer;
        $.state.gameManagerId = arg.gameManagerId;
    }

    if (messageType === "Damaged") {
        $.sendSignalCompat("owner", "Damaged");
        $.setStateCompat("owner", "playerhp", arg);
    }

    if (messageType === "UpdateKillsUI") {
        $.setStateCompat("owner", "playerKills", arg);
    }

    if (messageType === "DestroyYourself") {
        $.log("管理側からの命令により、自身を破棄します。");
        $.destroy(); 
    }
}, { player: true });

$.onUpdate((deltaTime) => {
    // 既に自分の端末でPlayerScriptの付与が終わっているならスルー
    if ($.state.isScriptInitialized) return;

    const targetPlayer = $.state.targetPlayer;
    const gManagerId = $.state.gameManagerId;
    if (!targetPlayer || !targetPlayer.exists()) return;

    if ($.getOwner() && $.getOwner().userId === targetPlayer.userId) {
        
        // 自分の端末で、自分自身にPlayerScriptをセット
        $.setPlayerScript(targetPlayer);

        // 二重実行を防ぐためにフラグを立ててループを抜ける
        $.state.isScriptInitialized = true;

        if (gManagerId) {
            targetPlayer.send("InitPlayerScript", {
                gameManagerId: gManagerId
            });
        }
    }
});