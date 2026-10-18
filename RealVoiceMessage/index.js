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

  function isMessagesUrl(url) {
    return typeof url === "string" && /\/channels\/\d+\/messages(\?.*)?$/.test(url);
  }

  function isAudioFilename(fn) {
    return /\.(ogg|opus|mp3|m4a|wav|aac|flac)$/i.test(String(fn || ""));
  }

  // Jesli body to pojedyncza wiadomosc z dokladnie jednym zalacznikiem audio
  // i bez wlasnego tekstu, dopisuje flage VOICE_MESSAGE oraz
  // duration_secs/waveform na zalaczniku - dokladnie to, czego Discord
  // wymaga zeby uznac wiadomosc za prawdziwa glosowke (widoczna u kazdego
  // odbiorcy, nie tylko w Kettu). Zwraca zmieniony JSON (string) albo null,
  // jesli nic nie trzeba bylo zmieniac.
  function tryInjectVoiceFlags(bodyStr) {
    try {
      var body = JSON.parse(bodyStr);

      var atts = body && body.attachments;
      if (!Array.isArray(atts) || atts.length !== 1) return null;

      var contentEmpty = !body.content || String(body.content).trim() === "";
      if (!contentEmpty) return null;

      var att = atts[0];
      if (!isAudioFilename(att.filename)) return null;

      body.flags = (body.flags | 0) | VOICE_MESSAGE_FLAG;
      if (att.duration_secs === undefined || att.duration_secs === null) att.duration_secs = DEFAULT_DURATION;
      if (!att.waveform) att.waveform = DEFAULT_WAVEFORM;

      log("Oznaczono jako glosowke, flags:", body.flags);
      return JSON.stringify(body);
    } catch (e) {
      err("tryInjectVoiceFlags blad:", e);
      return null;
    }
  }

  function patchFetch() {
    var origFetch = globalThis.fetch;
    if (typeof origFetch !== "function") return null;

    globalThis.fetch = function (input, init) {
      try {
        var url = typeof input === "string" ? input : input && input.url;
        var method = (init && init.method) || (typeof input === "object" && input && input.method) || "GET";

        if (isMessagesUrl(url) && String(method).toUpperCase() === "POST" && init && typeof init.body === "string") {
          var newBody = tryInjectVoiceFlags(init.body);
          if (newBody) {
            init = Object.assign({}, init, { body: newBody });
          }
        }
      } catch (e) {
        err("fetch patch blad:", e);
      }
      return origFetch.call(this, input, init);
    };

    return function () {
      globalThis.fetch = origFetch;
    };
  }

  function patchXHR() {
    var proto = globalThis.XMLHttpRequest && globalThis.XMLHttpRequest.prototype;
    if (!proto) return null;

    var origOpen = proto.open;
    var origSend = proto.send;

    proto.open = function (method, url) {
      this.__rvm_method = method;
      this.__rvm_url = url;
      return origOpen.apply(this, arguments);
    };

    proto.send = function (body) {
      try {
        if (
          this.__rvm_url &&
          isMessagesUrl(this.__rvm_url) &&
          String(this.__rvm_method).toUpperCase() === "POST" &&
          typeof body === "string"
        ) {
          var newBody = tryInjectVoiceFlags(body);
          if (newBody) {
            body = newBody;
          }
        }
      } catch (e) {
        err("xhr patch blad:", e);
      }
      return origSend.call(this, body);
    };

    return function () {
      proto.open = origOpen;
      proto.send = origSend;
    };
  }

  function onLoad() {
    try {
      var unFetch = patchFetch();
      if (unFetch) unpatchers.push(unFetch);
    } catch (e) {
      err("patchFetch blad:", e);
    }

    try {
      var unXhr = patchXHR();
      if (unXhr) unpatchers.push(unXhr);
    } catch (e) {
      err("patchXHR blad:", e);
    }

    log("RealVoiceMessage zaladowany, podpieto pod:", unpatchers.length, "hooki.");
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
