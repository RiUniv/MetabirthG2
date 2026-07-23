const FireRate = 1.6;       // 射撃間隔
const MaxBullets = 4;       // 弾数
const ReloadTime = 2.4;     // リロード時間
const ShotVelocity = 25;    //弾速（物理の初速。落とすとボテボテ落ちる山なりになります）


$.onStart(() => {
    $.state.Bullets = MaxBullets;
    $.state.maxBullets = MaxBullets;
    $.state.isReloading = false;
    $.state.reloadTimer = 0;
    $.state.shotTimer = FireRate; 

    $.setStateCompat("owner", "RemainBullets", $.state.Bullets);
});

$.onUse(isDown => {
    if (!isDown) return;
    let owner = $.getOwner();
    if (!owner || !owner.exists()) return;

    // リロードガード
    if ($.state.isReloading) return;

    // 弾切れチェック
    if ($.state.Bullets <= 0) {
        StartReload();
        return;
    }

    // クールダウンチェック
    let sTimer = $.state.shotTimer ?? 0;
    if (sTimer < FireRate) return;

    //発射
    $.state.shotTimer = 0;
    ShootLauncher(owner);
});

$.onUpdate((deltaTime) => {
    // リロード監視
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
        }
    }

    // レートタイマー
    let sTimer = $.state.shotTimer ?? 0;
    sTimer += deltaTime;
    $.state.shotTimer = sTimer;
});

function ShootLauncher(player) {
    let bullets = $.state.Bullets;
    let myPos = $.getPosition();
    let myRot = $.getRotation();

    // 銃の少し前方に弾を出す位置を計算
    let forwardDir = new Vector3(0, 0, 1).applyQuaternion(myRot);
    let spawnPos = myPos.clone().add(forwardDir.multiplyScalar(1.0));

    // 残弾減少と発射音シグナル
    bullets--;
    $.state.Bullets = bullets;
    $.setStateCompat("owner", "RemainBullets", bullets);
    $.sendSignalCompat("this", "Shoot");

    const BulletTemplate = new WorldItemTemplateId("GrenadeBulletPrefab"); 
    let spawnedBullet = $.createItem(BulletTemplate, spawnPos, myRot);

    spawnedBullet.send("SetupAttacker", {
            attacker: player,
            attackerIdStr: "" + player.userId
    });

    if (bullets <= 0) {
        StartReload();
    }
}

function StartReload() {
    if ($.state.isReloading || $.state.Bullets === $.state.maxBullets) return;
    $.state.isReloading = true;
    $.state.reloadTimer = 0;
    $.sendSignalCompat("this", "Reloading");
}