// HealItem.js
// ====== ⚙️ 回復アイテム設定 ======
const HealAmount = 50;    // 回復量
const RespawnTime = 15;   // 再出現までの秒数
// ================================
const subnode_name_model = "model"

$.onStart(() => {
    $.state.isActive = true;
    $.state.respawnTimer = 0;
});

$.onInteract((player) => {
    if (!$.subNode(subnode_name_model)) return;
    if (!$.state.isActive) return;
    if (!player || !player.exists()) return;

    // プレイヤーのPlayerScriptへ回復メッセージを送る
    player.send("heal", { value: HealAmount });

    // クールダウン開始（見た目を消す）
    //$.state.isActive = false;
    $.state.respawnTimer = 0;
    $.subNode(subnode_name_model).setEnabled(false);

    $.sendSignalCompat("this", "affected"); //自分にシグナル
});

//復活処理
$.onUpdate((deltaTime) => {
    if (!$.subNode(subnode_name_model)) return;
    if($.subNode(subnode_name_model).getEnabled())return;
    //if ($.state.isActive) return;

    let t = $.state.respawnTimer ?? 0;
    t += deltaTime;
    $.state.respawnTimer = t;

    if (t >= RespawnTime) {
        $.state.isActive = true;
        $.state.respawnTimer = 0;
        $.subNode(subnode_name_model).setEnabled(true);
    }
});
