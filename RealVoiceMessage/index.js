(function () {
  var VOICE_MESSAGE_FLAG = 1 << 13; // 8192
  var DEFAULT_WAVEFORM = "AEtWPyUaGA4OEAcA";
  var DEFAULT_DURATION = 4;

  var unpatchers = [];

  function log() {
    try {
      vendetta.logger.log.apply(null, ["[RealVoiceMessage]"].concat(Array.prototype.slice.call(arguments)));
    } catch (e) {}
  }
  function err() {
    try {
      vendetta.logger.error.apply(null, ["[RealVoiceMessage]"].concat(Array.prototype.slice.call(arguments)));
    } catch (e) {}
  }
  function toast(msg) {
    try {
      vendetta.ui.toasts.showToast(String(msg).slice(0, 180));
    } catch (e) {}
  }

  function isAudio(mime, filename) {
    if (mime && mime.indexOf("audio") === 0) return true;
    if (filename && /\.(ogg|opus|mp3|m4a|wav|aac|flac)$/i.test(filename)) return true;
    return false;
  }

  function onLoad() {
    var found = [];

    try {
      var mod = vendetta.metro.findByProps("sendMessage");
      if (mod && typeof mod.sendMessage === "function") {
        found.push("sendMessage");

        var unpatch = vendetta.patcher.before("sendMessage", mod, function (args) {
          try {
            var message = args[1]; // {content, tts, ...} - TO jest obiekt z ktorego Discord buduje finalna wiadomosc
            var extra = args[3]; // {location, attachmentsToUpload: [...], ...}
            var uploads = extra && extra.attachmentsToUpload;

            if (!message || typeof message.content !== "string") return;
            if (message.content.trim().length > 0) return; // zostaw wiadomosci z wlasnym tekstem w spokoju
            if (!uploads || uploads.length !== 1) return; // tylko dokladnie jeden zalacznik

            var up = uploads[0];
            var item = up && up.item;
            var mime = (up && up.mimeType) || (item && item.mimeType);
            var filename = (up && up.filename) || (item && item.filename);

            if (!isAudio(mime, filename)) return;

            message.flags = (message.flags || 0) | VOICE_MESSAGE_FLAG;

            try {
              up.waveform = DEFAULT_WAVEFORM;
              up.durationSecs = DEFAULT_DURATION;
              up.duration_secs = DEFAULT_DURATION;
              if (item) {
                item.waveform = DEFAULT_WAVEFORM;
                item.durationSecs = DEFAULT_DURATION;
              }
            } catch (e2) {}

            toast("RVM: oznaczono jako glosowke (flags=" + message.flags + ")");
            log("RVM sendMessage - oznaczono. flags:", message.flags, "mime:", mime, "file:", filename);
          } catch (e) {
            err("Blad w patchu sendMessage:", e);
            toast("RVM blad: " + e);
          }
        });
        unpatchers.push(unpatch);
      } else {
        log("Modul sendMessage nie ma funkcji sendMessage.");
      }
    } catch (e) {
      err("Nie udalo sie podpiac pod sendMessage:", e);
    }

    toast("RealVoiceMessage zaladowany: " + (found.join(",") || "NIC - BLAD"));
    log("Zaladowano, podpieto pod:", found.join(","));
  }

  function onUnload() {
    unpatchers.forEach(function (u) {
      try {
        u();
      } catch (e) {}
    });
    unpatchers = [];
    log("Odladowano.");
  }

  return { onLoad: onLoad, onUnload: onUnload };
})();
