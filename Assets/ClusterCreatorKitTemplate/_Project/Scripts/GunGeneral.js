const maxDistance = 30;
const Damage = 10;

//リロードにかかる時間（秒）
const ReloadTime = 2.0; 

$.onStart(() => {
    $.state.Bullets = 20; // 初期弾数を最大値に合わせて20に
    $.state.maxBullets = 20;
    
    $.state.isReloading = false;
    $.state.reloadTimer = 0;

    $.setStateCompat("owner", "RemainBullets", $.state.Bullets);
});

// アイテムを使った時（トリガーを引いた時）
$.onUse(isDown => {
    if (!isDown) return;

    //リロード中なら絶対に撃てないようにガード
    if ($.state.isReloading) {
        $.log("リロード中のため撃てません");
        return;
    }

    // 弾があれば撃つ
    if ($.state.Bullets > 0) {
        Shoot();
    } else {
        //弾が0ならリロードを開始する
        StartReload();
    } 
});

/**
 * リロード開始処理
 */
function StartReload() {
    // すでにリロード中、またはすでに弾が満タンならスキップ
    if ($.state.isReloading || $.state.Bullets === $.state.maxBullets) return;

    $.state.isReloading = true;
    $.state.reloadTimer = 0; // タイマーをリセット
    
    // Unity側の演出（アニメーションやSE）を再生したい時用のシグナル
    $.sendSignalCompat("this", "Reloading");
    $.log("リロードを開始します...");
}

/**
 * 毎フレームの更新処理（リロードのタイマーを進める）
 */
$.onUpdate((deltaTime) => {
    // リロード中以外は何もしない
    if (!$.state.isReloading) return;

    let timer = $.state.reloadTimer ?? 0;
    timer += deltaTime;
    $.state.reloadTimer = timer;

    // 指定したリロード時間が経過したら
    if (timer >= ReloadTime) {
        // 弾数を最大まで回復
        $.state.Bullets = $.state.maxBullets;
        $.setStateCompat("owner", "RemainBullets", $.state.Bullets);
        
        // リロード状態を解除
        $.state.isReloading = false;
        $.state.reloadTimer = 0;

        $.sendSignalCompat("this", "ReloadEnd");
        $.log("リロードが完了しました！");
    }
});

function Shoot(){
    let bullets = $.state.Bullets;
    let position = $.getPosition();
    let direction = new Vector3(0, 0, 1).applyQuaternion($.getRotation());
    let raycastResult = $.raycast(position, direction, maxDistance);

    bullets--;
    $.state.Bullets = bullets;
    $.setStateCompat("owner", "RemainBullets", bullets);
    $.sendSignalCompat("this", "Shoot");
  
    // 直線上に何も見つからなかった場合
    if (raycastResult == null) {
        if (bullets <= 0) StartReload();
        return;
    }

    let handle = raycastResult.handle;
    if (handle == null) {
        if (bullets <= 0) StartReload();
        return;
    }

    if (handle.type == "player") {
        $.sendSignalCompat("this", "Hit");
        handle.send("damage", { 
            value: Damage, 
            attacker: $.getOwner(),
            attackerIdStr: "" + $.getOwner().userId 
        });
    }

    if (bullets <= 0) StartReload();
}