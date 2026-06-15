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

const TargetKills = 3;

$.onStart(() => {
    //辞書
    $.state.leaderboard = {};
    $.state.matchPlayers = {};
    $.state.cachedStagePositions = {};

    if (lobbyPointId) {
        lobbyPointId.send("RequestLocation", { pointIndex: "lobby" });
    }

    for(let i = 0;i<stagePoints.length;i++){
        let pHandle = stagePoints[i];
        if (pHandle) {
            // ポイントアイテムにインデックス番号を添えてメッセージを送信 
            pHandle.send("RequestLocation", { pointIndex: i });
        }
    }
    
    for (let i = 0; i < ranks.length; i++) {
        ranks[i].setText(`${i + 1}位: -----`);
    }
});

$.onReceive((messageType, arg, sender) => {
    if (messageType === "ReplyLocation") {
        let cachedPositions = $.state.cachedStagePositions ?? {};
        
        // 送られてきた番号の場所に、座標データを保存する
        cachedPositions[arg.pointIndex] = {
            position: arg.position,
            rotation: arg.rotation
        };
        $.state.cachedStagePositions = cachedPositions;
    }

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
        let teleportData = GetRandomCachedPoint();
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

function GetRandomCachedPoint() {
    let cached = $.state.cachedStagePositions ?? {};
    
    let validPoints = [];
    for (let key in cached) {
        // 💡"lobby" 以外のステージ用の数値インデックスデータだけを配列にピックアップする
        if (cached[key] && key !== "lobby") {
            validPoints.push(cached[key]);
        }
    }

    // 万が一、1つも溜まっていなかった場合のセーフティデフォルト座標
    let pos = new Vector3(0, 10, 0);
    let rot = $.getRotation();

    if (validPoints.length > 0) {
        let chosen = validPoints[Math.floor(Math.random() * validPoints.length)];
        pos = chosen.position;
        rot = chosen.rotation;
    }

    return { position: pos, rotation: rot };
}
function StartMatch() {
    $.state.leaderboard = {};
    UpdateRankings();

    // 1. 今この瞬間にワールドにいる全員を「生きたハンドル」の状態で取得
    let allPlayers = $.getPlayersNear($.getPosition(), Infinity);
    let matchPlayers = {};

    // 2. 生きたハンドルが有効なうちに、先に全員をバラバラにワープさせる
    allPlayers.forEach(player => {
        if (player && player.exists()) {
            matchPlayers[player.userId] = player; 

            //キャッシュされた座標からランダムに取得してワープ
            let startPointData = GetRandomCachedPoint(); 
            player.setPosition(startPointData.position);
            player.setRotation(startPointData.rotation);
        }
    });

    $.state.matchPlayers = matchPlayers;

    if (spawnerId) {
        spawnerId.send("StartMatch", null);
    }
}

function EndMatch() {
    if (spawnerId) {
        spawnerId.send("EndMatch", null);
    }

    if (MatchReadyManagerId) {
        MatchReadyManagerId.send("ResetReadyStatus", null);
    }

    let matchPlayers = $.state.matchPlayers ?? {};
    let cached = $.state.cachedStagePositions ?? {};

    let lobbyPos = new Vector3(0, 1, 0);
    let lobbyRot = $.getRotation();

    if (cached["lobby"]) {
        lobbyPos = cached["lobby"].position;
        lobbyRot = cached["lobby"].rotation;
    }

    for (let userId in matchPlayers) {
        let player = matchPlayers[userId];
        if (player && player.exists()) {
            player.setPosition(lobbyPos);
            player.setRotation(lobbyRot);
        }
    }

    $.state.matchPlayers = {};
}