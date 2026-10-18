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

  var buffer = [];
  function pushDump(label, obj) {
    try {
      var dumpStr = JSON.stringify(safeKeys(obj, 3));
      buffer.push("=== " + label + " ===\n" + dumpStr);
      vendetta.metro.common.clipboard.setString(buffer.join("\n\n"));
      toast("RVM[" + label + "]: dump w schowku (" + buffer.length + ")");
      log("RVM[" + label + "] dump:", dumpStr);
    } catch (e) {
      toast("RVM[" + label + "] clipboard blad: " + e);
    }
  }

  function onLoad() {
    var found = [];

    // Hak 1: CloudUpload - poczatek uploadu (wiemy ze TO odpala sie, ale nie wplywa
    // na finalna wiadomosc - to jest tylko deskryptor pliku do wyslania na serwer).
    ["uploadLocalFiles", "CloudUpload"].forEach(function (name) {
      try {
        var mod = vendetta.metro.findByProps(name);
        if (!mod) { log("Nie znaleziono modulu dla:", name); return; }
        found.push(name);
        var unpatch = vendetta.patcher.before(name, mod, function (args) {
          try {
            var a0 = args[0];
            var item = (a0 && a0.items && a0.items[0]) || a0;
            pushDump("CloudUpload:" + name, a0);
          } catch (e) { err("Blad w patchu", name, ":", e); }
        });
        unpatchers.push(unpatch);
      } catch (e) { err("Nie udalo sie podpiac pod:", name, e); }
    });

    // Hak 2: funkcja ktora FAKTYCZNIE wysyla wiadomosc (wyzej w stosie niz CloudUpload) -
    // to tu trzeba ustawic flage, zeby trafila do finalnego zapytania do serwera.
    ["sendMessage", "editMessage"].forEach(function (propSet) {
      try {
        var mod = vendetta.metro.findByProps(propSet);
        if (!mod || typeof mod[propSet] !== "function") return;
        found.push(propSet);
        var unpatch = vendetta.patcher.before(propSet, mod, function (args) {
          try {
            pushDump(propSet + " args", args);
          } catch (e) { err("Blad w patchu", propSet, ":", e); }
        });
        unpatchers.push(unpatch);
      } catch (e) { err("Nie udalo sie podpiac pod:", propSet, e); }
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
