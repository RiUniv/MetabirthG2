// MatchTimeLimitButton.js

// 💡 選択できる時間（秒）のリスト。0 は「無制限」として扱います
const timeOptions = [0, 60, 180, 300]; 

$.onStart(() => {
    $.state.selectedIndex = 0; // デフォルトは無制限 (0)
    UpdateText();
});

$.onInteract((player) => {
    let index = $.state.selectedIndex ?? 0;
    index = (index + 1) % timeOptions.length;
    $.state.selectedIndex = index;
    UpdateText();
});

$.onReceive((messageType, arg, sender) => {
    // 開始ボタンからの問い合わせに回答
    if (messageType === "QueryTimeLimit") {
        if (sender) {
            let index = $.state.selectedIndex ?? 0;
            sender.send("ReplyTimeLimit", { timeLimit: timeOptions[index] });
        }
    }
});

function UpdateText() {
    let index = $.state.selectedIndex ?? 0;
    let currentLimit = timeOptions[index];
    
    let displayText = "";
    if (currentLimit === 0) {
        displayText = "【制限時間】\n無制限";
    } else {
        displayText = `【制限時間】\n${currentLimit / 60}分`;
    }

    if ($.subNode("Text")) {
        $.subNode("Text").setText(displayText);
    }
}