const MaxHp = 100;
let hp = MaxHp;
let managerId = _.sourceItemId;
let gameManagerId = null;
let myTeammateIds = [];
let isMatchActive = false;

const InvincibleDuration = 2.0;  // 無敵時間

let isInvincible = false;        // 無敵中かどうかのフラグ
let invincibleTimer = 0;         // 無敵時間を計るタイマー
let SpeedupTimer = 0;           // スピードアップ用のタイマー
let JumpupTimer = 0;           // ジャンプアップ用のタイマー

_.onReceive((messageType, arg, sender) => {
    if (messageType === "InitPlayerScript") {
        gameManagerId = arg.gameManagerId;
        hp = MaxHp;
        isMatchActive = false;
        
        isInvincible = false;
        invincibleTimer = 0;

        let teammatesStr = arg.teammates ?? ""; 
        if (teammatesStr !== "") {
            //届いたカンマ区切りの文字列を、再び配列に分解して保存する
            myTeammateIds = teammatesStr.split(",");
        } else {
            myTeammateIds = []; // 個人戦なら空配列
        }
    }

    if (messageType === "MatchActualStart") {
        isMatchActive = true; 
        _.log("【試合開始】ダメージ判定がアクティブになりました！");
    }

    //勝者が決まった瞬間にGameManagerから届くロック命令
    if (messageType === "MatchOverLock") {
        isMatchActive = false; // 再びダメージと攻撃を完全シャットアウト
        isInvincible = true;   // 5秒間完全無敵
        _.log("【試合終了】演出時間のため無敵化ロックされました");
    }

    if (messageType === "EndMatch") {
        ResetPlayerStatus();
        isMatchActive = false;
    }

    if (messageType === "damage") {

        if (isInvincible || !isMatchActive) {
            return; 
        }

        let attackerIdStr = arg.attackerIdStr; 
        if (!attackerIdStr) return;

        let isTeammate = false;

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

    if (messageType === "heal") {
        if (!isMatchActive) return; // 試合中以外は無視

        hp += arg.value;
        if (hp > MaxHp) hp = MaxHp; // 上限キャップ

        _.log("回復しました 現在HP: " + hp);

        // UIを更新するためマネージャーへ通知
        if (managerId) {
            try { _.sendTo(managerId, "Healed", hp); } catch (e) {}
        }
    }

    if (messageType === "speedup") {
        if (!isMatchActive) return; // 試合中以外は無視

        SpeedupTimer = arg.SpeedupTimer;
        _.setMoveSpeedRate(arg.SpeedRate);
    }

    if (messageType === "jumpup") {
        if (!isMatchActive) return; // 試合中以外は無視

        JumpupTimer = arg.JumpupTimer;
        _.setJumpSpeedRate(arg.JumpRate);
    }

    if (messageType === "TeleportToRespawn") {
        // 自分の位置と回転を、受け取ったステージ内のリスポーン地点に上書き
        _.setPosition(arg.position);
        _.setRotation(arg.rotation);
        ResetPlayerStatus();
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

_.onFrame((deltaTime) => {
    CountInvincibleTime(deltaTime);
    CountSpeedupTimer(deltaTime);
    CountJumpupTimer(deltaTime);
});

function CountInvincibleTime(t){
    // 無敵中じゃない時は何もしない
    if (!isInvincible) return;

    // 無敵タイマーを進める
    invincibleTimer += t;

    // 設定した無敵時間が経過したら
    if (invincibleTimer >= InvincibleDuration) {
        isInvincible = false; // 無敵解除
        invincibleTimer = 0;
    }
}

function CountSpeedupTimer(t){
    if(SpeedupTimer <= 0) return;
    SpeedupTimer -= t;
    if(SpeedupTimer <= 0){
        _.setMoveSpeedRate(1.0);
        SpeedupTimer = 0;
    }
}

function CountJumpupTimer(t){
    if(JumpupTimer <= 0) return;
    JumpupTimer -= t;
    if(JumpupTimer <= 0){
        _.setJumpSpeedRate(1.0);
        JumpupTimer = 0;
    }
}

function ResetPlayerStatus(){
     _.resetPlayerEffects()
    SpeedupTimer = 0;
    JumpupTimer = 0;
    hp = MaxHp;   
}