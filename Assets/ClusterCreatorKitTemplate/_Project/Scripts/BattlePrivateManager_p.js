const MaxHp = 100;
let hp = MaxHp;
let managerId = _.sourceItemId;
let gameManagerId = null;
let myTeammateIds = [];

const InvincibleDuration = 2.0;  // 無敵時間
let isInvincible = false;        // 無敵中かどうかのフラグ
let invincibleTimer = 0;         // 無敵時間を計るタイマー

_.onReceive((messageType, arg, sender) => {
    if (messageType === "InitPlayerScript") {
        gameManagerId = arg.gameManagerId;
        hp = MaxHp;
        let teammatesStr = arg.teammates ?? ""; 
        if (teammatesStr !== "") {
            //届いたカンマ区切りの文字列を、再び配列に分解して保存する
            myTeammateIds = teammatesStr.split(",");
        } else {
            myTeammateIds = []; // 個人戦なら空配列
        }
    }
    if (messageType === "damage") {

        if (isInvincible) {
            return; 
        }

        let attackerIdStr = arg.attackerIdStr; 
        if (!attackerIdStr) return;

        let isTeammate = false;

        // 🛑【確認用ログ】
        _.log("ーー味方撃ち判定（修正版）ーー");
        _.log("撃ってきた人のID(小文字): " + attackerIdStr);
        _.log("保存されている味方リスト: " + JSON.stringify(myTeammateIds));

        for (let i = 0; i < myTeammateIds.length; i++) {
            if (myTeammateIds[i] === attackerIdStr) {
                isTeammate = true;
                break;
            }
        }

        if (isTeammate) {
            _.log("【味方ガード発動】味方へのダメージを無効化しました");
            return; //弾く
        } else{
            _.log("味方判定に漏れたためダメージを与えました");
        }


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

        isInvincible = true;
        invincibleTimer = 0;
    }
    
    // 攻撃を与えた人のhp情報を受け取る
    if (messageType === "HitPlayerHp") {
        if (arg <= 0) {
            if (gameManagerId) {
                try {
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

_.onUpdate((deltaTime) => {
    // 無敵中じゃない時は何もしない
    if (!isInvincible) return;

    // 無敵タイマーを deltaTime で進める
    invincibleTimer += deltaTime;

    // 設定した無敵時間（3.0秒）が経過したら
    if (invincibleTimer >= InvincibleDuration) {
        isInvincible = false; // 無敵解除！
        invincibleTimer = 0;
    }
});