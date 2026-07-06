// swtichGame.js
const gameManagerId = $.worldItemReference("GameManager");

$.onStart(() => {
    // 準備完了したプレイヤーの記録用辞書
    $.state.readyPlayers = {};
    
    // 【追加】現在試合中かどうかを管理するフラグ（最初は試合前なのでfalse）
    $.state.isMatchOngoing = false; 
});

$.onInteract((player) => {
    // 💡【最重要】もしすでに試合中なら、触られても何もせずにここで処理を終了する！
    if ($.state.isMatchOngoing) {
        $.log("試合中のため、準備完了ボタンはロックされています");
        return;
    }

    if (!player || !player.exists()) return;

    let readyList = $.state.readyPlayers ?? {};

    // 既に準備完了している場合は「キャンセル」にする
    if (readyList[player.userId]) {
        delete readyList[player.userId];
        $.log(`${player.userDisplayName} が準備完了をキャンセルしました`);
    } else {
        readyList[player.userId] = player;
        $.log(`${player.userDisplayName} が準備完了しました！`);
    }
    $.state.readyPlayers = readyList;

    // 全員揃ったかのチェック＆リスト表示更新
    CheckAllPlayersReady();
});

$.onReceive((messageType, arg, sender) => {

    if (messageType === "ResetReadyStatus") {
        if(!$.state.isMatchOngoing) return;
        $.state.isMatchOngoing = false;
        $.state.readyPlayers = {};
        CheckAllPlayersReady();
    }

    if (messageType === "RequestStartCheck") {
        if ($.state.isMatchOngoing) return;
        CheckAllPlayersReady(true,arg.mode,arg.killLimit);
    }
});

/**
 * 全員が準備完了したかチェックし、リスト表示を更新する関数
 */
function CheckAllPlayersReady(forceStart = false,mode,killLimit) {
    if ($.state.isMatchOngoing) return;

    let allPlayers = $.getPlayersNear($.getPosition(), Infinity);
    let totalPlayerCount = allPlayers.length;

    let readyList = $.state.readyPlayers ?? {};
    
    let readyNames = [];
    let notReadyNames = [];
    let readyCount = 0;

    allPlayers.forEach(player => {
        if (player && player.exists()) {
            if (readyList[player.userId]) {
                readyNames.push(`・${player.userDisplayName}`);
                readyCount++;
            } else {
                notReadyNames.push(`・${player.userDisplayName}`);
            }
        }
    });

    for (let id in readyList) {
        let isStillHere = allPlayers.some(p => p.userId === id);
        if (!isStillHere) {
            delete readyList[id];
        }
    }
    $.state.readyPlayers = readyList;

    $.subNode("Text").setText(`Ready? (${readyCount} / ${totalPlayerCount})`);

    let readyTextStr = readyNames.length > 0 ? readyNames.join("\n") : "（なし）";
    let notReadyTextStr = notReadyNames.length > 0 ? notReadyNames.join("\n") : "（なし）";

    if ($.subNode("ReadyListText")) $.subNode("ReadyListText").setText(readyTextStr);
    if ($.subNode("NotReadyListText")) $.subNode("NotReadyListText").setText(notReadyTextStr);

    if (forceStart && totalPlayerCount > 0 && readyCount === totalPlayerCount) {

        $.state.isMatchOngoing = true;

        $.subNode("Text").setText("During the match");
        if ($.subNode("ReadyListText")) $.subNode("ReadyListText").setText("ーー試合中ーー");
        if ($.subNode("NotReadyListText")) $.subNode("NotReadyListText").setText("ーー試合中ーー");

        if (gameManagerId) {
            gameManagerId.send("startMatch", { mode: mode , killLimit: killLimit});
        }
    }
}