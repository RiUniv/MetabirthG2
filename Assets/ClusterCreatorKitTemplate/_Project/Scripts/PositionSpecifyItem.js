$.onReceive((messageType, arg, sender) => {
    // GameManagerから「あなたの座標を教えて」と言われたら
    if (messageType === "RequestLocation") {
        if (!sender) return;

        // 自分の正確な座標と回転を取得する
        let myPos = $.getPosition();
        let myRot = $.getRotation();

        // 呼び出してきたGameManager（sender）に向けて、座標データと自分のポイント番号を返信する
        sender.send("ReplyLocation", {
            pointIndex: arg.pointIndex, // GameManagerから送られてきた番号をそのまま返す
            position: myPos,
            rotation: myRot
        });
    }
});