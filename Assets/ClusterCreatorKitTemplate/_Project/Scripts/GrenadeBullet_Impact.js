// GrenadeBullet.js（弾側）

const ExplodeTime = 2.5; //撃ち出されてから爆発するまでの時間
const DestroyTime = 4;
const ExplodeRadius = 3; //爆風が届く半径
const MaxDamage = 50;    //爆心の最大ダメージ
let isExplode = false;
const model = $.subNode("Bullet");

$.onStart(() => {
    $.state.timer = 0;
    $.state.isExploded = false;
    
    // 銃から受け取る攻撃者データ
    $.state.attacker = null;
    $.state.attackerIdStr = "";
});

$.onReceive((messageType, arg, sender) => {
    //銃から生成された直後に届く、攻撃者情報の登録命令
    if (messageType === "SetupAttacker") {
        $.state.attacker = arg.attacker;
        $.state.attackerIdStr = arg.attackerIdStr;
    }
});

$.onCollide((collision) => {
    if ($.state.isExploded || isExplode) return;
    TriggerExplosion();
});

$.onUpdate((deltaTime) => {
    if ($.state.isExploded) return;

    let timer = $.state.timer ?? 0;
    timer += deltaTime;
    $.state.timer = timer;

    //2.5秒経ったら自動で大爆発
    if (timer >= ExplodeTime && !isExplode) {
        let myPos = $.getPosition();
        let myRot = $.getRotation();
        const Effect = new WorldItemTemplateId("ExplodeEffect"); 
        $.createItem(Effect, myPos, myRot);
        Explode();
        isExplode = true;
    }
    if (timer >= DestroyTime) {
        $.destroy();
    }
});

function TriggerExplosion() {
    isExplode = true;
    let myPos = $.getPosition();
    let myRot = $.getRotation();
    const Effect = new WorldItemTemplateId("ExplodeEffect"); 
    $.createItem(Effect, myPos, myRot);
    
    Explode();
}

/**
周囲のプレイヤーを巻き込んで爆発する関数
 */
function Explode() {
    $.state.isExploded = true;
    
    // Unity側の爆発エフェクト・爆発音を再生
    $.sendSignalCompat("this", "ExplosionEffect");

    let myPos = $.getPosition();
    let attacker = $.state.attacker;
    let attackerIdStr = $.state.attackerIdStr;

    let airOrigin = myPos.clone().add(new Vector3(0, 1.2, 0));
    //爆発位置から半径 4m 以内にいる全プレイヤーを検知
    let hitPlayers = $.getPlayersNear(airOrigin, ExplodeRadius);

    $.log(hitPlayers);
    hitPlayers.forEach(player => {
        if (player && player.exists()) {
            if (("" + player.userId) === attackerIdStr) {
                $.log("【自爆ガード】撃った本人への爆風ダメージを無効化しました");
                return; // forEach内の次のループへ進む
            }
            let pPos = player.getPosition();
            
            let diffX = myPos.x - pPos.x;
            let diffY = myPos.y - pPos.y;
            let diffZ = myPos.z - pPos.z;

            let distance = Math.sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ);

            let damageFactor = 1.0 - (distance / ExplodeRadius);
            if (damageFactor < 0) damageFactor = 0;

            // 最終ダメージの計算
            let finalDamage = Math.floor(MaxDamage * damageFactor);

            if (finalDamage > 5) { // わずかでもダメージがあれば送信
                
                player.send("damage", {
                    value: finalDamage,
                    attacker: attacker, // 銃から引き継いだ本物のPlayerId
                    attackerIdStr: attackerIdStr // 銃から引き継いだ確定文字列ID
                });
            }
        }
    });
    model.setEnabled(false);
}