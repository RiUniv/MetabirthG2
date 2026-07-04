const matchReadyManagerId = $.worldItemReference("MatchReadyManager"); 
const modeSelectButtonId = $.worldItemReference("MatchModeSelectButton");

$.onInteract((player) => {
    if (!player || !player.exists()) return;
    
    if (modeSelectButtonId) {
        //モード選択ボタンに「いまのモード何？」と尋ねる
        modeSelectButtonId.send("QueryMode", null);
    }
});

$.onReceive((messageType, arg, sender) => {
    //モード選択ボタンから答えが返ってきたら
    if (messageType === "ReplyMode") {
        let chosenMode = arg.mode; // "FFA" または "TEAM"

        if (matchReadyManagerId) {
            //確定したモード情報を引数に乗せて、MatchReady（準備完了ボタン）へ開始チェックを出す
            matchReadyManagerId.send("RequestStartCheck", { mode: chosenMode });
        }
    }
});