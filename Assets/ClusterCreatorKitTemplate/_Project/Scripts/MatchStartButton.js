const matchReadyManagerId = $.worldItemReference("MatchReadyManager"); 

$.onInteract((player) => {
    if (!player || !player.exists()) return;
    if (matchReadyManagerId) {
        matchReadyManagerId.send("RequestStartCheck", null);
    }
});