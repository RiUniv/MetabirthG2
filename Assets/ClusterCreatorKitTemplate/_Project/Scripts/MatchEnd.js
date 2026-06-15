const gameManagerId = $.worldItemReference("GameManager");
//const switchButtonId = $.worldItemReference("SwitchButton");

$.onInteract(() => {
    if (gameManagerId) {
        //switchButtonId.send("ResetReadyStatus", null);
        gameManagerId.send("endMatch",null);
    }
});