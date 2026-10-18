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

  function safeKeys(obj, depth) {
    if (!obj || typeof obj !== "object" || depth <= 0) return obj;
    var out = {};
    for (var k in obj) {
      try {
        var v = obj[k];
        if (v === null || v === undefined) { out[k] = v; continue; }
        var t = typeof v;
        if (t === "function") { out[k] = "[fn]"; continue; }
        if (t === "object") {
          if (Array.isArray(v)) {
            out[k] = v.slice(0, 3).map(function (item) { return safeKeys(item, depth - 1); });
          } else {
            out[k] = safeKeys(v, depth - 1);
          }
          continue;
        }
        out[k] = v;
      } catch (e) {
        out[k] = "[err]";
      }
    }
    return out;
  }

  function isAudio(mime, filename) {
    if (mime && mime.indexOf("audio") === 0) return true;
    if (filename && /\.(ogg|opus|mp3|m4a|wav|aac|flac)$/i.test(filename)) return true;
    return false;
  }

  function onLoad() {
    var found = [];
    var names = ["uploadLocalFiles", "CloudUpload"];

    names.forEach(function (name) {
      try {
        var mod = vendetta.metro.findByProps(name);
        if (!mod) {
          log("Nie znaleziono modulu dla:", name);
          return;
        }
        found.push(name);

        var unpatch = vendetta.patcher.before(name, mod, function (args) {
          try {
            var a0 = args[0];
            var item = (a0 && a0.items && a0.items[0]) || a0;
            var mime = item && (item.mimeType || item.type);
            var filename = item && (item.filename || item.name);

            var dump = safeKeys(a0, 3);
            var dumpStr = JSON.stringify(dump);
            log("RVM[" + name + "] arg dump:", dumpStr);
            try {
              vendetta.metro.common.clipboard.setString("RVM[" + name + "] mime=" + mime + " file=" + filename + "\n" + dumpStr);
              toast("RVM[" + name + "]: dump w schowku, wklej Tomkowi");
            } catch (ce) {
              toast("RVM[" + name + "] mime=" + mime + " file=" + filename + " (clipboard blad: " + ce + ")");
            }

            if (item && isAudio(mime, filename)) {
              item.mimeType = "audio/ogg";
              item.waveform = DEFAULT_WAVEFORM;
              item.durationSecs = DEFAULT_DURATION;
              item.duration_secs = DEFAULT_DURATION;
              item.isVoiceMessage = true;
              item.flags = VOICE_MESSAGE_FLAG;
              if (a0.message) {
                a0.message.flags = (a0.message.flags || 0) | VOICE_MESSAGE_FLAG;
              }
              if (a0.options) {
                a0.options.flags = (a0.options.flags || 0) | VOICE_MESSAGE_FLAG;
                a0.options.isVoiceMessage = true;
              }
              toast("RVM[" + name + "]: oznaczono audio");
            }
          } catch (e) {
            err("Blad w patchu", name, ":", e);
            toast("RVM blad [" + name + "]: " + e);
          }
        });
        unpatchers.push(unpatch);
      } catch (e) {
        err("Nie udalo sie podpiac pod:", name, e);
      }
    });

    toast("RealVoiceMessage zaladowany, podpieto: " + (found.join(",") || "NIC"));
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
