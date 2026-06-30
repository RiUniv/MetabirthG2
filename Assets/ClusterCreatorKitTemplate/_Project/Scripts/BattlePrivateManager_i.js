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
        $.state.targetPlayer = targetPlayer;
        $.state.debugLoggerId = arg.debugLoggerId;
        $.state.gameManagerId = arg.gameManagerId;
        $.state.isMatchActive = true; // 試合中状態にする

        $.requestOwner(targetPlayer);
        SendToLogger(`[${targetPlayer.userDisplayName}のマネージャー] init受信。オーナー変更を要請しました`);
        CheckAndApplyScript();
    }

    //二回目以降、再利用されるときにSpawnerから届く
    if (messageType === "ReStartMatch") {
        $.state.isMatchActive = true;
        $.state.gameManagerId = arg.gameManagerId;
        /////　デバッグ用
        let currentOwner = $.getOwner();
        let ownerName = currentOwner ? currentOwner.userDisplayName : "★null";
        SendToLogger(`[${ownerName}のマネージャー] リスタートするためActivateします`);
        /////
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
        const targetPlayer = $.state.targetPlayer;
        /////　デバッグ用
        let currentOwner = $.getOwner();
        let ownerText = currentOwner ? currentOwner.userDisplayName : "★null（誰も所有していません）";
        SendToLogger(`現在の内部オーナー: ${ownerText}`);
        SendToLogger(`[${ownerText}のマネージャー] Sleep処理を行います`);
        /////
        // 画面のUIなどを非表示にする、あるいはリセットする
        $.setStateCompat("owner", "playerhp", 0);
    }
    if (messageType === "DestroyYourself") {
        $.destroy(); // ログアウト時のみ完全に消滅
    }
}, { player: true });

$.onUpdate(deltaTime => {
    if (!$.state.isScriptInitialized && $.state.isMatchActive) {
        CheckAndApplyScript();
    }
});

function CheckAndApplyScript() {
    if ($.state.isScriptInitialized) return;

    const targetPlayer = $.state.targetPlayer;
    const gManagerId = $.state.gameManagerId;
    if (!targetPlayer || !targetPlayer.exists()) return;

    // 💡【核心】現在の実行スレッドのオーナーが null だった場合は、
    // 処理を完全に諦めて return するのではなく、強制的に targetPlayer（本人）に再度オーナーを請求し直して、同期の強制復帰を試みる
    let currentOwner = $.getOwner();
    if (!currentOwner) {
        $.requestOwner(targetPlayer);
        return; 
    }

    // 本人の端末であることが確定した場合のみ、PlayerScriptを適用
    if (currentOwner.userId === targetPlayer.userId) {
        $.setPlayerScript(targetPlayer);
        $.state.isScriptInitialized = true; // 確定ロック
        
        SendToLogger(`${targetPlayer.userDisplayName} にPlayerScript適用`);

        if (gManagerId) {
            targetPlayer.send("InitPlayerScript", {
                gameManagerId: gManagerId
            });
        }
    }
}

/////　デバッグ用
function SendToLogger(text) {
    const debugLoggerId = $.state.debugLoggerId;
    if (debugLoggerId) {
        debugLoggerId.send("Log", { text: text });
    }
}
/////