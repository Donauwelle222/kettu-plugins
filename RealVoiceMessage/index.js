(function () {
  var VOICE_MESSAGE_FLAG = 1 << 13; // 8192 - ta sama flaga co w oficjalnym kliencie Discorda
  var DEFAULT_WAVEFORM = "AEtWPyUaGA4OEAcA"; // placka fala, wplywa tylko na wyglad paskow
  var DEFAULT_DURATION = 4; // sekundy, fallback gdy nie da sie odczytac realnego czasu
  var PREFIX = "/voice";

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

  // Przerabia body zapytania REST POST /channels/:id/messages na "glosowke" -
  // dokladnie to samo co robi dzialajacy juz plugin na Macu (Equicord voiceMessages):
  // flaga 8192 NA WIADOMOSCI (nie na lokalnym uploadzie!) + waveform/duration_secs
  // na zalaczniku. To wlasnie ten poziom sprawia ze widzi to KAZDY odbiorca.
  function transformBody(body) {
    if (!body || typeof body.content !== "string") return false;
    if (body.content.indexOf(PREFIX) !== 0) return false;

    var idx = findAudioIndex(body.attachments);
    if (idx === -1) {
      toast("RealVoiceMessage: dolacz plik audio przed wyslaniem /voice");
      return false;
    }

    body.content = body.content.slice(PREFIX.length).replace(/^\s/, "");
    body.flags = (body.flags || 0) | VOICE_MESSAGE_FLAG;

    var att = body.attachments[idx];
    att.waveform = att.waveform || DEFAULT_WAVEFORM;
    att.duration_secs = att.duration_secs || DEFAULT_DURATION;

    return true;
  }

  // Probujemy znalezc modul REST po kilku najbardziej prawdopodobnych zestawach propsow.
  function findRest() {
    var candidates = [
      ["post", "get", "put", "patch", "del"],
      ["post", "get", "put", "patch"],
      ["getAPIBaseURL", "post"],
    ];
    for (var i = 0; i < candidates.length; i++) {
      try {
        var mod = vendetta.metro.findByProps.apply(null, candidates[i]);
        if (mod && mod.post) {
          log("Znaleziono modul REST po propsach:", candidates[i].join(","));
          return mod;
        }
      } catch (e) {}
    }
    return null;
  }

  function onLoad() {
    var RestAPI = findRest();
    if (!RestAPI) {
      err("Nie znalazlem modulu REST - API Kettu moglo sie zmienic.");
      toast("RealVoiceMessage: nie moge sie podpiac pod wysylke (zglos Tomkowi)");
      return;
    }

    var unpatch = vendetta.patcher.before("post", RestAPI, function (args) {
      try {
        var config = args[0];
        if (!config || typeof config.url !== "string") return;
        if (!/\/channels\/\d+\/messages$/.test(config.url)) return;

        if (transformBody(config.body)) {
          log("Wyslano jako glosowke, url:", config.url);
          toast("Wysylam jako glosowke...");
        }
      } catch (e) {
        err("Blad podczas przechwytywania zapytania:", e);
      }
    });

    unpatchers.push(unpatch);
    log("Zaladowano.");
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
