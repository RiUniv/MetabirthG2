const ranks = [
    $.subNode("Rank_1"),
    $.subNode("Rank_2"),
    $.subNode("Rank_3")
];

const MatchReadyManagerId = $.worldItemReference("MatchReadyManager");
const spawnerId = $.worldItemReference("Spawner");

const lobbyPointId = $.worldItemReference("LobbySpawnPoint");   // ロビーの戻り先
const stagePoints = [
    $.worldItemReference("StagePoint_1"), // ステージ内の復活地点1
    $.worldItemReference("StagePoint_2"), // ステージ内の復活地点2
    $.worldItemReference("StagePoint_3")  // ステージ内の復活地点3
];

const TargetKills = 5;

$.onStart(() => {
    //辞書
    $.state.leaderboard = {};
    $.state.matchPlayers = {};
    
    for (let i = 0; i < ranks.length; i++) {
        ranks[i].setText(`${i + 1}位: -----`);
    }
});

$.onReceive((messageType, arg, sender) => {

    // PlayerScriptからキル報告が届いたとき
    if (messageType === "AddKillReport") {
        if (!sender) return;

        let pId = sender.userId;
        let pName = sender.userDisplayName;

        // 1. データベース（state）の更新
        let currentBoard = $.state.leaderboard ?? {};
        if (!currentBoard[pId]) {
            currentBoard[pId] = { name: pName, kills: 0 };
        }
        currentBoard[pId].kills += 1; // 1キル追加
        $.state.leaderboard = currentBoard;

        // 2. ランキング表示の更新処理
        UpdateRankings();

        // 3. キルしたプレイヤーの「個別マネージャー」へデータを逆流させる
        let latestKills = currentBoard[pId].kills;
        sender.send("UpdateKillsUI", latestKills);
        if (latestKills >= TargetKills) {
            EndMatch();
            return;
        }
    }

    if (messageType === "RequestRespawnPoint") {
        if (!sender) return;

        //マッチに参加している人だけ座標をあげる
        let matchPlayers = $.state.matchPlayers ?? {};
        if (!matchPlayers[sender.userId]) return;

        // ランダムなリスポーン地点の座標を取得して送り返す
        let teleportData = GetRandomStagePoint();
        sender.send("TeleportToRespawn", teleportData);
    }

    if (messageType === "startMatch") {
        StartMatch();
    }

    // 試合終了（リセット）の合図を外から受け取ったとき
    if (messageType === "endMatch") {
        EndMatch();
    }
}, { player: true });

/**
 * 現在のデータベース（$.state.leaderboard）を元に、
 * ランキングボードのテキスト（Rank_1 〜 Rank_3）を最新状態に更新する関数
 */
function UpdateRankings() {
    // 1. 現在のランキングデータをstateから取得
    let currentBoard = $.state.leaderboard ?? {};

    // 2. データを並び替えるために、オブジェクト（連想配列）から普通の配列に変換
    let playersArray = [];
    for (let key in currentBoard) {
        playersArray.push(currentBoard[key]);
    }

    // 3. キル数（kills）が多い順にソート（降順）
    playersArray.sort((a, b) => b.kills - a.kills);

    // 4. テキスト（Rank_1 〜 Rank_3）を最新情報に書き換える
    for (let i = 0; i < ranks.length; i++) {
        if (playersArray[i]) {
            // データがある場合は「1位: プレイヤー名 (5 Kills)」のように表示
            ranks[i].setText(`${i + 1}位: ${playersArray[i].name} (${playersArray[i].kills} Kills)`);
        } else {
            // まだデータがない（プレイヤーが足りない）場合はハイフン表示
            ranks[i].setText(`${i + 1}位: -----`);
        }
    }
}

function GetRandomStagePoint() {
    let validPoints = stagePoints.filter(p => p !== null);
    
    // Unity側で1つも登録されていない場合のセーフティ座標
    let pos = new Vector3(0, 10, 0);
    let rot = $.getRotation();

    if (validPoints.length > 0) {
        let chosenPoint = validPoints[Math.floor(Math.random() * validPoints.length)];
        pos = chosenPoint.getPosition();
        rot = chosenPoint.getRotation();
    }

    return { position: pos, rotation: rot };
}

function StartMatch() {
    // ランキングボードの初期化など
    $.state.leaderboard = {};
    UpdateRankings();

    let allPlayers = $.getPlayersNear($.getPosition(), Infinity);
    let matchPlayers = {};

    allPlayers.forEach(player => {
        if (player && player.exists()) {
            // 参加者ロック用の辞書に登録
            matchPlayers[player.userId] = player; 

            let startPointData = GetRandomStagePoint(); 
            player.setPosition(startPointData.position);
            player.setRotation(startPointData.rotation);
            
            $.log(`${player.userDisplayName} をステージへワープさせました`);
        }
    });
    $.state.matchPlayers = matchPlayers;

    // 監視・生成器（Spawner）に「マッチスタート（自動生成してね）」と送る
    if (spawnerId) {
        spawnerId.send("StartMatch", null);
    }
}

function EndMatch() {
    // 監視・生成器（Spawner）に「マッチ終了（全員消えてね）」と送る
    if (spawnerId) {
        spawnerId.send("EndMatch", null);
    }

    if (MatchReadyManagerId) {
        MatchReadyManagerId.send("ResetReadyStatus", null);
    }

    let matchPlayers = $.state.matchPlayers ?? {};
    let lobbyPos = lobbyPointId ? lobbyPointId.getPosition() : new Vector3(0, 1, 0);
    let lobbyRot = lobbyPointId ? lobbyPointId.getRotation() : $.getRotation();

    for (let userId in matchPlayers) {
        let player = matchPlayers[userId];
        if (player && player.exists()) {
            player.setPosition(lobbyPos);
            player.setRotation(lobbyRot);
        }
    }

    $.state.matchPlayers = {};
}