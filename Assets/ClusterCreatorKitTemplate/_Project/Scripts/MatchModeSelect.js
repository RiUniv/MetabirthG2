$.onStart(() => {
    // デフォルトは個人戦（Free For All）
    $.state.currentMode = "FFA"; 
    UpdateText();
});

$.onInteract((player) => {
    let mode = $.state.currentMode ?? "FFA";

    // インタラクトするたびにモードを交互に切り替える
    if (mode === "FFA") {
        $.state.currentMode = "TEAM";
    } else {
        $.state.currentMode = "FFA";
    }

    UpdateText();
});

$.onReceive((messageType, arg, sender) => {
    // 開始ボタンから今のモード教えてと尋ねられたら、現在のモードを即座に送り返す
    if (messageType === "QueryMode") {
        if (sender) {
            sender.send("ReplyMode", { mode: $.state.currentMode ?? "FFA" });
        }
    }
});

function UpdateText() {
    let mode = $.state.currentMode ?? "FFA";
    if ($.subNode("Text")) {
        if (mode === "FFA") {
            $.subNode("Text").setText("【現在のモード】\n個人戦 (FFA)");
        } else {
            $.subNode("Text").setText("【現在のモード】\nチーム戦 (ランダム)");
        }
    }
}