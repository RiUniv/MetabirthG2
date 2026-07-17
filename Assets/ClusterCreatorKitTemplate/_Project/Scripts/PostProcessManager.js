$.onReceive((messageType, arg, sender) => {
    if (messageType === "FadeIn") {
        $.sendSignalCompat("this", "FadeIn");
    }
    if (messageType === "FadeOut") {
        $.sendSignalCompat("this", "FadeOut");
    }

}, { player: true });