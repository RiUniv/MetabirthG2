// ====== ⚙️ 武器パラメータ設定エリア ======
const IsFullAuto = true;    // 単発なら false / 長押し連射なら true
const FireRate = 0.3;      //射撃間隔（秒）
const Damage = 16;          
const MaxBullets = 20;      
const ReloadTime = 2.5;     
const MaxDistance = 30;     
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
    let direction = new Vector3(0, 0, 1).applyQuaternion($.getRotation());
    let raycastResult = $.raycast(position, direction, MaxDistance);

    bullets--;
    $.state.Bullets = bullets;
    $.setStateCompat("owner", "RemainBullets", bullets);
    $.sendSignalCompat("this", "Shoot");
  
    if (raycastResult != null) {
        let handle = raycastResult.handle;
        if (handle != null && handle.type == "player") {
            $.sendSignalCompat("this", "Hit");
            
            // 完璧になった味方ガード用データ
            handle.send("damage", { 
                value: Damage, 
                attacker: player,
                attackerIdStr: "" + player.userId 
            });
        }
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