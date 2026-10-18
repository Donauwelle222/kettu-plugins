(function () {
  var VOICE_MESSAGE_FLAG = 1 << 13; // 8192 - ta sama flaga co w oficjalnym kliencie Discorda
  var DEFAULT_WAVEFORM = "AEtWPyUaGA4OEAcA"; // placka fala, wplywa tylko na wyglad paskow
  var DEFAULT_DURATION = 4; // sekundy, fallback gdy nie da sie odczytac realnego czasu

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
      vendetta.ui.toasts.showToast(msg);
    } catch (e) {}
  }

  function isAudioAttachment(att) {
    if (!att) return false;
    if (att.content_type && att.content_type.indexOf("audio") === 0) return true;
    if (att.mimeType && att.mimeType.indexOf("audio") === 0) return true;
    if (att.filename && /\.(ogg|opus|mp3|m4a|wav|aac|flac)$/i.test(att.filename)) return true;
    return false;
  }

  function findAudioIndex(attachments) {
    if (!attachments) return -1;
    for (var i = 0; i < attachments.length; i++) {
      if (isAudioAttachment(attachments[i])) return i;
    }
    return -1;
  }

  // AUTOMAT: kazda wiadomosc z DOKLADNIE jednym zalacznikiem audio, bez wlasnego
  // tekstu, dostaje flage 8192 (prawdziwa glosowka) - tak jak dziala to w oryginalnym
  // pluginie Kettu, tylko tu robimy to NA WIADOMOSCI (REST), a nie na lokalnym uploadzie,
  // zeby bylo widoczne u kazdego odbiorcy, nie tylko w Kettu.
  function transformBody(body) {
    if (!body) return false;
    if (body.content && body.content.trim().length > 0) return false; // zostaw zwykle wiadomosci z tekstem w spokoju
    if ((body.flags || 0) & VOICE_MESSAGE_FLAG) return false; // juz jest glosowka

    var attachments = body.attachments;
    if (!attachments || attachments.length !== 1) return false;

    var idx = findAudioIndex(attachments);
    if (idx === -1) return false;

    body.flags = (body.flags || 0) | VOICE_MESSAGE_FLAG;

    var att = attachments[idx];
    att.waveform = att.waveform || DEFAULT_WAVEFORM;
    att.duration_secs = att.duration_secs || DEFAULT_DURATION;

    return true;
  }

  function findRest() {
    var candidates = [
      ["post", "get", "put", "patch", "del"],
      ["post", "get", "put", "patch"],
      ["getAPIBaseURL", "post"],
      ["post", "patch", "put"],
    ];
    var tried = [];
    for (var i = 0; i < candidates.length; i++) {
      try {
        var mod = vendetta.metro.findByProps.apply(null, candidates[i]);
        tried.push(candidates[i].join(",") + "=" + (mod ? "found" : "null"));
        if (mod && typeof mod.post === "function") {
          log("Znaleziono modul REST po propsach:", candidates[i].join(","));
          return mod;
        }
      } catch (e) {
        tried.push(candidates[i].join(",") + "=blad:" + e);
      }
    }
    err("Zaden kandydat nie trafil REST:", tried.join(" | "));
    return null;
  }

  function onLoad() {
    var RestAPI = findRest();

    if (!RestAPI) {
      toast("RealVoiceMessage: BLAD - nie znalazlem modulu REST");
      return;
    }

    try {
      var unpatch = vendetta.patcher.before("post", RestAPI, function (args) {
        try {
          var config = args[0];
          if (!config || typeof config.url !== "string") return;
          if (!/\/channels\/\d+\/messages$/.test(config.url)) return;

          if (transformBody(config.body)) {
            log("Wyslano jako glosowke, url:", config.url);
          }
        } catch (e) {
          err("Blad podczas przechwytywania zapytania:", e);
        }
      });
      unpatchers.push(unpatch);
      toast("RealVoiceMessage: zaladowany OK");
      log("Zaladowano, podpieto pod post().");
    } catch (e) {
      err("Nie udalo sie podpiac patchera:", e);
      toast("RealVoiceMessage: BLAD patchera - " + e);
    }
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
