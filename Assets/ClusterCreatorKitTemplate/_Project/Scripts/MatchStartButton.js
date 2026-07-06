const matchReadyManagerId = $.worldItemReference("MatchReadyManager"); 
const modeSelectButtonId = $.worldItemReference("MatchModeSelectButton");
const killLimitButtonId = $.worldItemReference("MatchKillLimitButton");

$.onInteract((player) => {
    if (!player || !player.exists()) return;

    $.state.chosenMode = null;
    $.state.chosenKillLimit = null;
    
    if (modeSelectButtonId) modeSelectButtonId.send("QueryMode", null);
    else ($.log("modeSelectButtonIdがnull"));
    if (killLimitButtonId) killLimitButtonId.send("QueryKillLimit", null);
    else ($.log("killLimitButtonIdがnull"));
});

$.onReceive((messageType, arg, sender) => {
    //モード選択ボタンから答えが返ってきたら
    if (messageType === "ReplyMode") {
        $.state.chosenMode = arg.mode; // "FFA" または "TEAM"
    }

    if (messageType === "ReplyKillLimit") {
        $.state.chosenKillLimit = arg.killLimit;
        TryForwardToReady();
    }
});

function TryForwardToReady() {
    let mode = $.state.chosenMode;
    let limit = $.state.chosenKillLimit;

    // 両方のデータが揃うまで待機
    if (mode === null || limit === null) {
        $.log("modeかlimitがnull");
        return;
    }

    if (matchReadyManagerId) {
        matchReadyManagerId.send("RequestStartCheck", { 
            mode: mode,
            killLimit: limit 
        });
    }
}