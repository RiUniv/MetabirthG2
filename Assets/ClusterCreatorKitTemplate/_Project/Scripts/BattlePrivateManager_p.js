const MaxHp = 100;
let hp = MaxHp;
let managerId = _.sourceItemId;
let gameManagerId = null;

_.onReceive((messageType, arg, sender) => {
    if (messageType === "InitPlayerScript") {
        _.log("Player_p: InitPlayerScriptを受信　初期化完了 GManagerID:" +arg.gameManagerId);
        gameManagerId = arg.gameManagerId;
    }
    if (messageType === "damage") {
        _.log("Player_p: 弾が当たってdamageメッセージを受信しました ダメージ値:" +arg.value);
        hp -= arg.value;
        _.sendTo(arg.attacker, "HitPlayerHp", hp);
        if (hp <= 0) {
            if (gameManagerId) {
                _.sendTo(gameManagerId, "RequestRespawnPoint", null);
            }
            hp = MaxHp;
        }
        if (managerId) {
            try { _.sendTo(managerId, "Damaged", hp); } catch (e) {}
        }
    }

    if (messageType === "TeleportToRespawn") {
        // 自分の位置と回転を、受け取ったステージ内のリスポーン地点に上書き
        _.setPosition(arg.position);
        _.setRotation(arg.rotation);
    }
    
    // 攻撃を与えた人のhp情報を受け取る
    if (messageType === "HitPlayerHp") {
        if (arg <= 0) {
            if (gameManagerId) {
                try {
                    _.log("Player_p: GameManagerへ送信します。送信値:" +hp);
                    _.sendTo(gameManagerId, "AddKillReport", null);
                } catch (e) {
                    _.log("GameManagerへの送信エラー: " + e);
                }
            }
        }
    }
    if (messageType === "UpdateKillsUI") {
        _.sendTo(managerId, "UpdateKillsUI", arg);
    }

});