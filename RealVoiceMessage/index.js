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
  function clip(text) {
    try {
      vendetta.metro.common.clipboard.setString(String(text));
    } catch (e) {}
  }

  function isMessagesUrl(url) {
    return typeof url === "string" && /\/channels\/\d+\/messages(\?.*)?$/.test(url);
  }

  function isAudioFilename(fn) {
    return /\.(ogg|opus|mp3|m4a|wav|aac|flac)$/i.test(String(fn || ""));
  }

  // Probuje zmienic JSON-owy body requestu POST do /channels/:id/messages tak,
  // zeby zawieral flage VOICE_MESSAGE (8192) na wiadomosci i poprawne
  // duration_secs/waveform na zalaczniku. Zwraca nowy string body (albo null,
  // jesli nic nie trzeba bylo zmieniac) oraz zawsze zrzuca oryginalny JSON na
  // schowek do diagnostyki.
  function tryInjectVoiceFlags(bodyStr, tag) {
    try {
      var body = JSON.parse(bodyStr);

      clip("RVM[" + tag + "] RAW body przed zmiana:\n" + JSON.stringify(body));

      var atts = body && body.attachments;
      if (!Array.isArray(atts) || atts.length !== 1) return null;

      var contentEmpty = !body.content || String(body.content).trim() === "";
      if (!contentEmpty) return null;

      var att = atts[0];
      if (!isAudioFilename(att.filename)) return null;

      body.flags = (body.flags | 0) | VOICE_MESSAGE_FLAG;
      if (att.duration_secs === undefined || att.duration_secs === null) att.duration_secs = DEFAULT_DURATION;
      if (!att.waveform) att.waveform = DEFAULT_WAVEFORM;

      var out = JSON.stringify(body);
      toast("RVM[" + tag + "]: wstrzykniety flags=" + body.flags + " w realnym requescie");
      clip("RVM[" + tag + "] body PO zmianie:\n" + out);
      log("RVM[" + tag + "] zmieniono body:", out);
      return out;
    } catch (e) {
      err("tryInjectVoiceFlags blad:", e);
      toast("RVM[" + tag + "] blad parsowania: " + e);
      return null;
    }
  }

  function patchFetch() {
    var origFetch = global.fetch;
    if (typeof origFetch !== "function") {
      log("global.fetch niedostepny.");
      return null;
    }

    global.fetch = function (input, init) {
      try {
        var url = typeof input === "string" ? input : input && input.url;
        var method = (init && init.method) || (typeof input === "object" && input && input.method) || "GET";

        if (isMessagesUrl(url) && String(method).toUpperCase() === "POST" && init && typeof init.body === "string") {
          var newBody = tryInjectVoiceFlags(init.body, "fetch");
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
      global.fetch = origFetch;
    };
  }

  function patchXHR() {
    var proto = global.XMLHttpRequest && global.XMLHttpRequest.prototype;
    if (!proto) {
      log("XMLHttpRequest niedostepny.");
      return null;
    }

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
          var newBody = tryInjectVoiceFlags(body, "xhr");
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
    var hooked = [];
    var diag = {
      typeofGlobalFetch: typeof global.fetch,
      typeofXHR: typeof global.XMLHttpRequest,
      typeofXHRProto: typeof (global.XMLHttpRequest && global.XMLHttpRequest.prototype),
      fetchErr: null,
      xhrErr: null,
    };

    try {
      var unFetch = patchFetch();
      if (unFetch) {
        unpatchers.push(unFetch);
        hooked.push("fetch");
      } else {
        diag.fetchErr = "patchFetch zwrocilo null (fetch niedostepny)";
      }
    } catch (e) {
      diag.fetchErr = String((e && e.message) || e);
      err("patchFetch blad:", e);
    }

    try {
      var unXhr = patchXHR();
      if (unXhr) {
        unpatchers.push(unXhr);
        hooked.push("xhr");
      } else {
        diag.xhrErr = "patchXHR zwrocilo null (XHR niedostepny)";
      }
    } catch (e) {
      diag.xhrErr = String((e && e.message) || e);
      err("patchXHR blad:", e);
    }

    toast("RealVoiceMessage zaladowany: " + (hooked.join(",") || "NIC - BLAD"));
    clip("RVM diag onLoad:\n" + JSON.stringify(diag, null, 2));
    log("Zaladowano, podpieto pod:", hooked.join(","), "diag:", diag);
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
