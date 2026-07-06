$.onStart(() => {
    $.state.targetPlayer = null;
    $.state.gameManagerId = null;
    $.state.spawnerId = null;
    $.state.isScriptInitialized = false;
    $.state.isMatchActive = false;
    $.state.checkTimer = 0;
});


$.onReceive((messageType, arg, sender) => {
    //初回生成のみ
    if (messageType === "init") {
        const targetPlayer = arg.player;
        if (!targetPlayer) return;
        $.state.targetPlayer = targetPlayer;
        $.state.debugLoggerId = arg.debugLoggerId;
        $.state.gameManagerId = arg.gameManagerId;
        $.state.myTeammates = arg.teammates ?? []; //味方のリスト
        $.state.spawnerId = arg.spawnerId;
        $.state.isMatchActive = true; // 試合中状態にする
        $.state.checkTimer = 0;

        SendToLogger(`[${targetPlayer.userDisplayName}のマネージャー] init受信`);
    }

    //二回目以降、再利用されるときにSpawnerから届く
    if (messageType === "ReStartMatch") {
        $.state.isMatchActive = true;
        $.state.gameManagerId = arg.gameManagerId;
        
        $.state.myTeammates = arg.teammates ?? ""; 
        $.state.checkTimer = 0;
        
        const spawnerId = $.state.spawnerId;
        const targetPlayer = $.state.targetPlayer;

        // デバッグ用
        let currentOwner = $.getOwner();
        let ownerName = currentOwner ? currentOwner.userDisplayName : "★null";
        SendToLogger(`[${ownerName}のマネージャー] リスタートするためActivateします`);

        // HPのリセット
        $.setStateCompat("owner", "playerhp", 100);
        $.setStateCompat("owner", "playerKills", 0);

        if (targetPlayer && targetPlayer.exists() && arg.gameManagerId) {
            targetPlayer.send("InitPlayerScript", {
                gameManagerId: arg.gameManagerId,
                teammates: $.state.myTeammates 
            });
        }

        if (spawnerId && targetPlayer && targetPlayer.exists()) {
            spawnerId.send("ManagerReady", { 
                userId: String(targetPlayer.userId),
                userName: targetPlayer.userDisplayName 
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

        $.setStateCompat("owner", "playerhp", 0);

        if (targetPlayer && targetPlayer.exists()) {
            targetPlayer.send("EndMatch", null);
        }
    }
    if (messageType === "DestroyYourself") {
        $.destroy(); // ログアウト時のみ完全に消滅
    }
}, { player: true });

$.onUpdate(deltaTime => {
    if (!$.state.isScriptInitialized && $.state.isMatchActive) {
        let checkTimer = $.state.checkTimer ?? 0;
        checkTimer += deltaTime;

        if (checkTimer >= 1.5) { // 1.5秒ごとにチェック
            CheckAndApplyScript();
            checkTimer = 0;
        }
        $.state.checkTimer = checkTimer;
    }
});

function CheckAndApplyScript() {
    if ($.state.isScriptInitialized) return;

    const targetPlayer = $.state.targetPlayer;
    const gManagerId = $.state.gameManagerId;
    const spawnerId = $.state.spawnerId;
    const teamId = $.state.currentTeamId ?? 0;

    if (!targetPlayer || !targetPlayer.exists()) return;

    let currentOwner = $.getOwner();
    
    //オーナーが確定するまでここで引き返す
    if (!currentOwner || currentOwner.userId !== targetPlayer.userId) {
        $.requestOwner(targetPlayer);
        SendToLogger(`${targetPlayer.userDisplayName} にownerリクエストを送信`);
        return; 
    }

    /////ここからownerが確定した状態/////
    $.setPlayerScript(targetPlayer);

    /////ここからsetPlayerScriptが確定した状態/////
    $.state.isScriptInitialized = true; // 確定ロック
        
    SendToLogger(`${targetPlayer.userDisplayName} にPlayerScript適用`);

    //生成元(PrivateManagerSpawner)に向けてセットアップが終わった合図を出す。
    if (spawnerId) {
        spawnerId.send("ManagerReady", { userId: targetPlayer.userId, userName: targetPlayer.userDisplayName });
    }

    /////PlayerScript側に向けて初期化通知を送る/////
    if (gManagerId) {
        targetPlayer.send("InitPlayerScript", {
            gameManagerId: gManagerId,
            teammates: $.state.myTeammates ?? []
        });
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