// DebugLogger.js

$.onStart(() => {
    // ログを保存する配列
    $.state.logLines = [];
    if ($.subNode("LogText")) {
        $.subNode("LogText").setText("【Debug Log Board】\nシステム起動完了。ログを待機中...");
    }
});

$.onReceive((messageType, arg, sender) => {
    if (messageType === "Log") {
        let lines = $.state.logLines ?? [];
        
        // 新しいログを末尾に追加
        lines.push(arg.text);
        
        // 看板が溢れないように、最新の12行だけを残す
        if (lines.length > 12) {
            lines.shift(); // 一番古いログを削除
        }
        
        $.state.logLines = lines;
        
        // 改行で繋いでSubNodeのテキストに反映
        if ($.subNode("LogText")) {
            $.subNode("LogText").setText(`【Debug Log Board】\n${lines.join("\n")}`);
        }
    }
});