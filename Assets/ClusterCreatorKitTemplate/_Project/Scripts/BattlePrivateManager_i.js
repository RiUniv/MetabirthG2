$.onStart(() => {
    $.state.targetPlayer = null;
    $.state.gameManagerId = null;
    $.state.isScriptInitialized = false;
    $.state.isMatchActive = false;
});

$.onReceive((messageType, arg, sender) => {
    //初回生成のみ
    if (messageType === "init") {
        const targetPlayer = arg.player;
        if (!targetPlayer) return;

        $.requestOwner(targetPlayer);

        $.state.targetPlayer = targetPlayer;
        $.state.gameManagerId = arg.gameManagerId;
        $.state.isMatchActive = true; // 試合中状態にする
    }

    //二回目以降、再利用されるときにSpawnerから届く
    if (messageType === "ReStartMatch") {
        $.state.isMatchActive = true;
        $.state.gameManagerId = arg.gameManagerId;
        
        // プレイヤーのHP表記を100（初期値）にリセットしてUIを更新
        $.setStateCompat("owner", "playerhp", 100);
        
        // PlayerScript側に2試合目が始まったと通知してHPをリセットさせる
        const targetPlayer = $.state.targetPlayer;
        if (targetPlayer && targetPlayer.exists() && arg.gameManagerId) {
            targetPlayer.send("InitPlayerScript", {
                gameManagerId: arg.gameManagerId
            });
        }
    }

    if (messageType === "Damaged") {
        $.log("manager_i:ダメージメッセージ受信 現在のhp:" + arg);
        if (!$.state.isMatchActive) return;
        $.sendSignalCompat("owner", "Damaged");
        $.setStateCompat("owner", "playerhp", arg);
    }

    if (messageType === "UpdateKillsUI") {
        if (!$.state.isMatchActive) return;
        $.setStateCompat("owner", "playerKills", arg);
    }

    //試合終了後のスリープ
    if (messageType === "SleepYourself") {
        $.state.isMatchActive = false;
        
        // 画面のUIなどを非表示にする、あるいはリセットする
        $.setStateCompat("owner", "playerhp", 0);
    }
    if (messageType === "DestroyYourself") {
        $.destroy(); // ログアウト時のみ完全に消滅
    }
}, { player: false });

$.onUpdate((deltaTime) => {
    // 既に自分の端末でPlayerScriptの付与が終わっているならスルー
    if ($.state.isScriptInitialized) return;

    const targetPlayer = $.state.targetPlayer;
    const gManagerId = $.state.gameManagerId;
    if (!targetPlayer || !targetPlayer.exists()) return;

    if ($.getOwner() && $.getOwner().userId === targetPlayer.userId) {
        $.log("manager_i: setPlayerScriptを実行します　対象:" + targetPlayer.userDisplayName);
        // 自分の端末で、自分自身にPlayerScriptをセット
        $.setPlayerScript(targetPlayer);

        // 二重実行を防ぐためにフラグを立ててループを抜ける
        $.state.isScriptInitialized = true;

        if (gManagerId) {
             $.log("manager_i: plalyerScriptへinitPlayerScriptを送信します GManagerID" + gManagerId);
            targetPlayer.send("InitPlayerScript", {
                gameManagerId: gManagerId
            });
        }
    }
});