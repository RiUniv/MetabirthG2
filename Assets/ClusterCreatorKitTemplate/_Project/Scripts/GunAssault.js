// ====== 武器パラメータ設定エリア ======
const IsFullAuto = true;    // 単発なら false / 長押し連射なら true
const FireRate = 0.35;      //射撃間隔（秒）
const Damage = 16;          
const MaxBullets = 18;      
const ReloadTime = 2.3;     
const MaxDistance = 50;     
const BulletRadius = 0.2;
// ==========================================

$.onStart(() => {
    $.state.Bullets = MaxBullets;
    $.state.maxBullets = MaxBullets;
    
    $.state.isReloading = false;
    $.state.reloadTimer = 0;

    // 最後に撃ってからの経過時間を蓄積するタイマー
    // 初期値を FireRate 以上にしておくことで、持った瞬間すぐに1発目が撃てる
    $.state.shotTimer = FireRate; 
    
    $.state.isTriggerPulled = false;

    $.setStateCompat("owner", "RemainBullets", $.state.Bullets);
});

//画面をクリック（トリガーを引いた）した時
$.onUse(isDown => {
    if (!isDown) {
        $.state.isTriggerPulled = false;
        return;
    }

    let owner = $.getOwner();
    if (!owner || !owner.exists()) return;

    if (IsFullAuto) {
        $.state.isTriggerPulled = true;
    } else {
        // 単発タイプ
        TryShoot(owner);
    }
});

//毎フレームの更新処理（すべてのタイマー進行,フルオート連射チェック）
$.onUpdate((deltaTime) => {
    // 1.リロードタイマーの進行
    if ($.state.isReloading) {
        let rTimer = $.state.reloadTimer ?? 0;
        rTimer += deltaTime;
        $.state.reloadTimer = rTimer;

        if (rTimer >= ReloadTime) {
            $.state.Bullets = $.state.maxBullets;
            $.setStateCompat("owner", "RemainBullets", $.state.Bullets);
            $.state.isReloading = false;
            $.state.reloadTimer = 0;

            $.sendSignalCompat("this", "ReloadEnd");
            $.log("リロードが完了しました！");
        }
    }

    // 2.射撃クールダウンタイマーの進行
    // 毎フレーム deltaTime を足し算して、前回の発砲からの経過時間を自前で計る
    let sTimer = $.state.shotTimer ?? 0;
    sTimer += deltaTime;
    $.state.shotTimer = sTimer;

    // 3.フルオート（長押し）の連射処理
    if (IsFullAuto && $.state.isTriggerPulled) {
        let owner = $.getOwner();
        if (owner && owner.exists()) {
            TryShoot(owner);
        } else {
            $.state.isTriggerPulled = false;
        }
    }
});


function TryShoot(player) {
    if ($.state.isReloading) return;

    if ($.state.Bullets <= 0) {
        StartReload();
        return;
    }

    // 自前で溜めたタイマーが、設定されたFireRateに達しているかチェック
    let sTimer = $.state.shotTimer ?? 0;
    if (sTimer < FireRate) {
        return; // クールダウンが明けていないなら撃てない
    }

    // レートチェック 通過タイマーをリセット
    $.state.shotTimer = 0;
    
    Shoot(player);
}

/**
 * 実際に弾を発射する関数
 */
function Shoot(player) {
    let bullets = $.state.Bullets;
    let position = $.getPosition();
    let rotation = $.getRotation();
    
    //プレイヤーの向いている正面ベクトル
    let direction = new Vector3(0, 0, 1).applyQuaternion(rotation);

    let rightDirection = new Vector3(1, 0, 0).applyQuaternion(rotation);

    //スライドさせる距離を計算
    let offsetVector = rightDirection.multiplyScalar(BulletRadius);

    //飛ばす3本のスタート地点を計算
    let posCenter = position;                            // 基準（真ん中）
    let posRight  = position.clone().add(offsetVector);  // 右にずらした地点
    let posLeft   = position.clone().sub(offsetVector);  // 左にずらした地点

    // 3本のレイキャストを一斉に発射
    let rayCenter = $.raycast(posCenter, direction, MaxDistance);
    let rayRight  = $.raycast(posRight, direction, MaxDistance);
    let rayLeft   = $.raycast(posLeft, direction, MaxDistance);

    // 残弾の減少と演出
    bullets--;
    $.state.Bullets = bullets;
    $.setStateCompat("owner", "RemainBullets", bullets);
    $.sendSignalCompat("this", "Shoot");

    // 3本のレイの結果を順番にチェックして、最初にプレイヤーに当たったものを採用する
    let finalHitHandle = null;

    let hitPosition = null;
    let isHitToPlayer = false;

    // 真ん中のラインのチェック
    if (rayCenter != null && rayCenter.hit) {
        hitPosition = rayCenter.hit.point; // 壁でも床でもプレイヤーでも、ぶつかった3D座標を取得
        if (rayCenter.handle != null && rayCenter.handle.type == "player") {
            finalHitHandle = rayCenter.handle;
            isHitToPlayer = true;
        }
    }
    // 右側のラインのチェック（真ん中が何にも当たっていなかった場合）
    else if (rayRight != null && rayRight.hit) {
        hitPosition = rayRight.hit.point;
        if (rayRight.handle != null && rayRight.handle.type == "player") {
            finalHitHandle = rayRight.handle;
            isHitToPlayer = true;
        }
    }
    // 左側のラインのチェック
    else if (rayLeft != null && rayLeft.hit) {
        hitPosition = rayLeft.hit.point;
        if (rayLeft.handle != null && rayLeft.handle.type == "player") {
            finalHitHandle = rayLeft.handle;
            isHitToPlayer = true;
        }
    }

    if(hitPosition != null){
        if(isHitToPlayer){
            const HitEffect_player = new WorldItemTemplateId("HitEffect_player"); 
            $.createItem(HitEffect_player, hitPosition, rotation);
        } else{
            const HitEffect_object = new WorldItemTemplateId("HitEffect_object"); 
            $.createItem(HitEffect_object, hitPosition, rotation);
        }

    }

    //3本のどこか1つでもプレイヤーを捕らえていたらダメージ処理を発動
    if (finalHitHandle != null) {
        $.sendSignalCompat("this", "Hit");
        
        //味方ガード用データ
        finalHitHandle.send("damage", { 
            value: Damage, 
            attacker: player,
            attackerIdStr: "" + player.userId 
        });
    }

    if (bullets <= 0) {
        $.state.isTriggerPulled = false;
        StartReload();
    }
}


function StartReload() {
    if ($.state.isReloading || $.state.Bullets === $.state.maxBullets) return;

    $.state.isReloading = true;
    $.state.reloadTimer = 0;
    
    $.sendSignalCompat("this", "Reloading");
    $.log("リロードを開始します...");
}