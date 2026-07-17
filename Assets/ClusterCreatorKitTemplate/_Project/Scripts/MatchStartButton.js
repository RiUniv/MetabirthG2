const matchReadyManagerId = $.worldItemReference("MatchReadyManager"); 
const modeSelectButtonId = $.worldItemReference("MatchModeSelectButton");
const killLimitButtonId = $.worldItemReference("MatchKillLimitButton");
const timeLimitButtonId = $.worldItemReference("MatchTimeLimitButton");

$.onInteract((player) => {
    if (!player || !player.exists()) return;

    $.state.chosenMode = null;
    $.state.chosenKillLimit = null;
    $.state.chosenTimeLimit = null;
    
    if (modeSelectButtonId) modeSelectButtonId.send("QueryMode", null);
    if (killLimitButtonId) killLimitButtonId.send("QueryKillLimit", null);
    if (timeLimitButtonId) timeLimitButtonId.send("QueryTimeLimit", null);
});

$.onReceive((messageType, arg, sender) => {
if (messageType === "ReplyMode") {
        $.state.chosenMode = arg.mode;
        TryForwardToReady();
    }
    if (messageType === "ReplyKillLimit") {
        $.state.chosenKillLimit = arg.killLimit;
        TryForwardToReady();
    }
    if (messageType === "ReplyTimeLimit") {
        $.state.chosenTimeLimit = arg.timeLimit;
        TryForwardToReady();
    }
});

function TryForwardToReady() {
    let mode = $.state.chosenMode;
    let limit = $.state.chosenKillLimit;
    let time = $.state.chosenTimeLimit;

    //データが揃うまで待機
    if (mode === null || limit === null || time === null) return;

    if (matchReadyManagerId) {
        matchReadyManagerId.send("RequestStartCheck", { 
            mode: mode,
            killLimit: limit,
            timeLimit: time
        });
    }
}