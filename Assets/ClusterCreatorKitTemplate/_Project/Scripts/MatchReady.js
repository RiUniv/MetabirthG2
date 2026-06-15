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
    // 試合が終了した時、GameManagerからリセットの合図が来たら
    if (messageType === "ResetReadyStatus") {
        if(!$.state.isMatchOngoing) return;
        // 💡【追加】試合が終了したので、ボタンのロックを解除する
        $.state.isMatchOngoing = false;

        $.state.readyPlayers = {};
        // 状態をクリアして表示を更新する
        CheckAllPlayersReady();
    }
});

/**
 * 全員が準備完了したかチェックし、リスト表示を更新する関数
 */
function CheckAllPlayersReady() {
    // 💡【追加】もし試合中になっていたら、この内部のテキスト更新処理などもスキップする
    if ($.state.isMatchOngoing) return;

    // 1. 今ワールドにいる全員をその場で一本釣り
    let allPlayers = $.getPlayersNear($.getPosition(), Infinity);
    let totalPlayerCount = allPlayers.length;

    let readyList = $.state.readyPlayers ?? {};
    
    // 表示用の名前リスト（文字列）を作るための配列
    let readyNames = [];
    let notReadyNames = [];
    let readyCount = 0;

    // 2. ワールドにいる全員を走査して、Ready状態か未Ready状態かに振り分ける
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

    // 3. 途中で落ちた人をreadyListから掃除する用
    for (let id in readyList) {
        let isStillHere = allPlayers.some(p => p.userId === id);
        if (!isStillHere) {
            delete readyList[id];
        }
    }
    $.state.readyPlayers = readyList;

    // 4. メインボタンのテキスト更新
    $.subNode("Text").setText(`Ready? (${readyCount} / ${totalPlayerCount})`);

    // 5. それぞれのリストを改行コード(\n)で繋いで3Dテキストに表示
    let readyTextStr = readyNames.length > 0 ? readyNames.join("\n") : "（なし）";
    let notReadyTextStr = notReadyNames.length > 0 ? notReadyNames.join("\n") : "（なし）";

    if ($.subNode("ReadyListText")) $.subNode("ReadyListText").setText(readyTextStr);
    if ($.subNode("NotReadyListText")) $.subNode("NotReadyListText").setText(notReadyTextStr);

    // 6. プレイヤーが1人以上いて、全員の準備が完了したらGameManagerを叩く
    if (totalPlayerCount > 0 && readyCount === totalPlayerCount) {
        $.log("全員の準備完了！GameManagerへ信号を飛ばします。");
        
        // 💡【重要】GameManagerに送る直前で、ボタン自体を「試合中状態（ロック）」に変える！
        $.state.isMatchOngoing = true;

        // 看板のテキストを「試合中」に固定する
        $.subNode("Text").setText("During the match");
        if ($.subNode("ReadyListText")) $.subNode("ReadyListText").setText("ーー試合中ーー");
        if ($.subNode("NotReadyListText")) $.subNode("NotReadyListText").setText("ーー試合中ーー");

        if (gameManagerId) {
            gameManagerId.send("startMatch", null);
        }
    }
}