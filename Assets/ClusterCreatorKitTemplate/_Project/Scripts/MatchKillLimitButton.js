// MatchKillLimitButton.js

const killOptions = [3, 5 ,7, 9, 10 , 13, 15, 20, 25, 30]; // 選択できるキル数のリスト

$.onStart(() => {
    $.state.selectedIndex = 0; // デフォルトは 3キル
    UpdateText();
});

$.onInteract((player) => {
    let index = $.state.selectedIndex ?? 0;
    
    // ボタンを押すたびに次の選択肢へ切り替え（ループする）
    index = (index + 1) % killOptions.length;
    $.state.selectedIndex = index;

    UpdateText();
});

$.onReceive((messageType, arg, sender) => {
    // 開始ボタンから問い合わせが来たら、現在の目標キル数を送り返す
    if (messageType === "QueryKillLimit") {
        if (sender) {
            let index = $.state.selectedIndex ?? 0;
            sender.send("ReplyKillLimit", { killLimit: killOptions[index] });
        }
    }
});

function UpdateText() {
    let index = $.state.selectedIndex ?? 0;
    let currentLimit = killOptions[index];
    if ($.subNode("Text")) {
        $.subNode("Text").setText(`【目標キル数】\n${currentLimit} Kills`);
    }
}