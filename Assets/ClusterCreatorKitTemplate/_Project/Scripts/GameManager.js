const ranks = [
    $.subNode("Rank_1"),
    $.subNode("Rank_2"),
    $.subNode("Rank_3")
];

const resultDisplay = $.subNode("Result_Display");
const redTeamDisplay = $.subNode("Red_Team_Display");
const blueTeamDisplay = $.subNode("Blue_Team_Display");

const MatchReadyManagerId = $.worldItemReference("MatchReadyManager");
const spawnerId = $.worldItemReference("Spawner");

const lobbyPointId = $.worldItemReference("LobbySpawnPoint");   // ロビーの戻り先
const stagePoints = [
    $.worldItemReference("StagePoint_1"), // ステージ内の復活地点
    $.worldItemReference("StagePoint_2"), 
    $.worldItemReference("StagePoint_3"),
    $.worldItemReference("StagePoint_4"), 
    $.worldItemReference("StagePoint_5"), 
    $.worldItemReference("StagePoint_6"), 
    $.worldItemReference("StagePoint_7"), 
    $.worldItemReference("StagePoint_8"), 
    $.worldItemReference("StagePoint_9"),  
    $.worldItemReference("StagePoint_10"),  
];
const redSpawnPointId = $.worldItemReference("StagePoint_Red");
const blueSpawnPointId = $.worldItemReference("StagePoint_Blue");

$.onStart(() => {
    $.state.nextSpawnIndex = 0;

    if (resultDisplay) resultDisplay.setText("");
    if (redTeamDisplay) redTeamDisplay.setText("");
    if (blueTeamDisplay) blueTeamDisplay.setText("");

    //辞書
    $.state.leaderboard = {};
    $.state.matchPlayers = {};
    $.state.cachedStagePositions = {};
    $.state.playerTeams = {};//各プレイヤーのチーム(1=赤, 2=青)を保存する辞書
    $.state.matchMode = "FFA"
    $.state.teamKills = { 1: 0, 2: 0 };//$.state.teamKills = { 1: 0, 2: 0 };


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

    if (redSpawnPointId) redSpawnPointId.send("RequestLocation", { pointIndex: "red" });
    if (blueSpawnPointId) blueSpawnPointId.send("RequestLocation", { pointIndex: "blue" });
    
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
        let mode = $.state.matchMode ?? "FFA";

        let currentBoard = $.state.leaderboard ?? {};
        if (!currentBoard[pId]) {
            currentBoard[pId] = { name: pName, kills: 0 };
        }
        currentBoard[pId].kills += 1; 
        $.state.leaderboard = currentBoard;

        let latestKills = currentBoard[pId].kills;

        // チーム戦の場合のスコア加算ロジック
        if (mode === "TEAM") {
            let teams = $.state.playerTeams ?? {};
            let myTeam = teams[pId] ?? 1; // 自分のチーム (1か2)
            
            let tKills = $.state.teamKills ?? { 1: 0, 2: 0 };
            tKills[myTeam] += 1;
            $.state.teamKills = tKills;

            UpdateRankings(); // チーム戦表示で更新

            // チームの合計キルが目標に達したら試合終了
            if (tKills[myTeam] >= $.state.targetKills) {
                let winnerTeamName = (myTeam === 1) ? "TEAM RED" : "TEAM BLUE";
                EndMatch(winnerTeamName);
                return;
            }
        } else {
            // 個人戦の場合
            UpdateRankings();
            if (latestKills >= $.state.targetKills) {
                EndMatch(pName);
                return;
            }
        }

        // 個人のUIへキル数を返す
        sender.send("UpdateKillsUI", latestKills);
    }

    if (messageType === "RequestRespawnPoint") {
        if (!sender) return;

        //マッチに参加している人だけ座標をあげる
        let matchPlayers = $.state.matchPlayers ?? {};
        if (!matchPlayers[sender.userId]) return;

        // ランダムなリスポーン地点の座標を取得して送り返す
        let teleportData = GetTeamRespawnPoint(sender.userId);
        sender.send("TeleportToRespawn", teleportData);
    }


    //MatchReady.jsから送られる
    //全員が準備完了して試合開始ボタンが押された合図
    if (messageType === "startMatch") {
        let mode = (arg && arg.mode) ? arg.mode : "FFA";
        let limit = (arg && arg.killLimit) ? arg.killLimit : 3;

        $.state.matchMode = mode;
        $.state.targetKills = limit;

        PrepareMatch();
    }

    //PrivateManagerSpawnerから送られる
    //全員のPrivateManagerが正しくセットアップされた合図
    if (messageType === "ReadyToStartMatch") {
        StartMatch();
    }

    // 試合終了(リセット)の合図を外から受け取ったとき
    if (messageType === "endMatch") {
        EndMatch();
    }
}, { player: true });

/**
 * 現在のデータベース($.state.leaderboard)を元に、
 * ランキングボードのテキスト(Rank_1 〜 Rank_3)を最新状態に更新する関数
 */
function UpdateRankings() {
    let mode = $.state.matchMode;
    let target = $.state.targetKills ?? 3;

    if (mode === "TEAM") {
        let tKills = $.state.teamKills ?? { 1: 0, 2: 0 };
        ranks[0].setText(`🔴 TEAM RED: ${tKills[1]} / ${target} Kills`);
        ranks[1].setText(`🔵 TEAM BLUE: ${tKills[2]} / ${target} Kills`);
        ranks[2].setText(`--------------------`);
        return;
    }

    let currentBoard = $.state.leaderboard ?? {};
    let playersArray = [];
    for (let key in currentBoard) {
        playersArray.push(currentBoard[key]);
    }
    playersArray.sort((a, b) => b.kills - a.kills);

    for (let i = 0; i < ranks.length; i++) {
        if (playersArray[i]) {
            ranks[i].setText(`${i + 1}位: ${playersArray[i].name} (${playersArray[i].kills} Kills)`);
        } else {
            ranks[i].setText(`${i + 1}位: -----`);
        }
    }
}

function GetTeamRespawnPoint(userId) {
    let cached = $.state.cachedStagePositions ?? {};
    let mode = $.state.matchMode;
    
    let pos = new Vector3(0, 10, 0);
    let rot = $.getRotation();

    // チーム戦の場合
    if (mode === "TEAM") {
        let teams = $.state.playerTeams ?? {};
        let myTeam = teams[userId] ?? 1;

        if (myTeam === 1 && cached["red"]) {
            return { position: cached["red"].position, rotation: cached["red"].rotation };
        } else if (myTeam === 2 && cached["blue"]) {
            return { position: cached["blue"].position, rotation: cached["blue"].rotation };
        }
    }

    // 個人戦、または専用座標が無い場合はこれまでのランダム地点から選ぶ
    let validPoints = [];
    for (let key in cached) {
        if (cached[key] && key !== "lobby" && key !== "red" && key !== "blue") {
            validPoints.push(cached[key]);
        }
    }

    if (validPoints.length > 0) {
        let currentIndex = $.state.nextSpawnIndex ?? 0;
        if (currentIndex >= validPoints.length) {
            currentIndex = 0;
        }
        let chosen = validPoints[currentIndex];
        pos = chosen.position;
        rot = chosen.rotation;

        $.state.nextSpawnIndex = (currentIndex + 1) % validPoints.length;
    }
    return { position: pos, rotation: rot };
}

function PrepareMatch() {
    let mode = $.state.matchMode;
    $.state.leaderboard = {};
    $.state.playerTeams = {};
    $.state.teamKills = { 1: 0, 2: 0 };
    if (resultDisplay) resultDisplay.setText("");
    if (mode === "TEAM") {
        if (redTeamDisplay) redTeamDisplay.setText("TEAM RED");
        if (blueTeamDisplay) blueTeamDisplay.setText("TEAM BLUE");
    } else {
        if (redTeamDisplay) redTeamDisplay.setText("");
        if (blueTeamDisplay) blueTeamDisplay.setText("");
    }
    
    UpdateRankings();
    

    let allPlayers = $.getPlayersNear($.getPosition(), Infinity);
    
    let matchPlayerIdsArray = []; 
    let playerListForShuffle = [];

    allPlayers.forEach(player => {
        if (player && player.exists()) {
            matchPlayerIdsArray.push(player.userId); 
            playerListForShuffle.push(player);
        }
    });

    let matchPlayersMap = {};
    playerListForShuffle.forEach(p => { matchPlayersMap[p.userId] = p; });
    $.state.matchPlayers = matchPlayersMap;

    let teammateListsArray = [];

    if (mode === "TEAM") {
        for (let i = playerListForShuffle.length - 1; i > 0; i--) {
            let r = Math.floor(Math.random() * (i + 1));
            let tmp = playerListForShuffle[i];
            playerListForShuffle[i] = playerListForShuffle[r];
            playerListForShuffle[r] = tmp;
        }

        //PlayerId型ではなく、最初からただのテキストの配列にする
        let redTeamText = [];  
        let blueTeamText = []; 
        let teams = {};

        for (let i = 0; i < playerListForShuffle.length; i++) {
            let p = playerListForShuffle[i];
            
            let pureUserIdText = "" + p.userId; 

            if (i % 2 === 0) {
                redTeamText.push(pureUserIdText); 
                teams[p.userId] = 1;
            } else {
                blueTeamText.push(pureUserIdText);
                teams[p.userId] = 2;
            }
        }
        $.state.playerTeams = teams;

        for (let i = 0; i < playerListForShuffle.length; i++) {
            let p = playerListForShuffle[i];
            
            let listText = (teams[p.userId] === 1) ? redTeamText : blueTeamText;
            
            teammateListsArray.push({
                playerId: "" + p.userId,      
                teammates: listText.join(",")
            });
        }
    } else {
        for (let i = 0; i < playerListForShuffle.length; i++) {
            let p = playerListForShuffle[i];
            teammateListsArray.push({
                playerId: "" + p.userId,
                teammates: ""
            });
        }
    }

    if (spawnerId) {
        spawnerId.send("StartMatch", { 
            matchPlayerIds: matchPlayerIdsArray, 
            teammateLists: teammateListsArray  
        });
    }
}
function StartMatch() {
    let matchPlayers = $.state.matchPlayers ?? {};

    // 確定している参加者だけを、安全にランダムリスポーン地点へワープさせる
    for (let userId in matchPlayers) {
        let player = matchPlayers[userId];
        if (player && player.exists()) {
            let startPointData = GetTeamRespawnPoint(player.userId);
            player.setPosition(startPointData.position);
        }
    }
}

function EndMatch(winnerName) {
    if (spawnerId) {
        spawnerId.send("EndMatch", null);
    }

    if (MatchReadyManagerId) {
        MatchReadyManagerId.send("ResetReadyStatus", null);
    }

    if (resultDisplay && winnerName) {
        resultDisplay.setText(`WINNER \n【 ${winnerName} 】`);
    }
    if (redTeamDisplay) redTeamDisplay.setText("");
    if (blueTeamDisplay) blueTeamDisplay.setText("");
    
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
        }
    }

    $.state.matchPlayers = {};
}