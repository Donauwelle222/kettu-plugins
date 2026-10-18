(function () {
  function log() {
    try {
      vendetta.logger.log.apply(null, ["[RealVoiceMessage]"].concat(Array.prototype.slice.call(arguments)));
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

  function safeKeys(names) {
    try {
      var mod = vendetta.metro.findByProps.apply(null, names);
      if (!mod) return null;
      try {
        return Object.keys(mod);
      } catch (e2) {
        return "keys-error:" + e2;
      }
    } catch (e) {
      return "find-error:" + e;
    }
  }

  function onLoad() {
    var report = {};

    try {
      report.sendMessageModKeys = safeKeys(["sendMessage"]);
      report.restPostModKeys = safeKeys(["post", "get", "put", "patch", "del"]);
      report.restPostOnlyKeys = safeKeys(["post", "get"]);
      report.apiBaseModKeys = safeKeys(["getAPIBaseURL"]);
      report.cloudUploadModKeys = safeKeys(["CloudUpload"]);
      report.endpointsModKeys = safeKeys(["Endpoints"]);
      report.httpClientModKeys = safeKeys(["HTTPClient"]);

      report.typeofFetch = typeof global.fetch;
      report.typeofXHR = typeof global.XMLHttpRequest;
      report.fetchDescriptor = (function () {
        try {
          var d = Object.getOwnPropertyDescriptor(global, "fetch");
          return d ? JSON.stringify({ writable: d.writable, configurable: d.configurable, hasGetSet: !!(d.get || d.set) }) : "no-descriptor";
        } catch (e) {
          return "err:" + e;
        }
      })();

      clip("RVM module scan:\n" + JSON.stringify(report, null, 2));
      toast("RVM: skan zapisany na schowek (nic nie patchowane)");
      log("Skan zakonczony:", report);
    } catch (e) {
      toast("RVM scan blad: " + e);
      log("Blad skanu:", e);
    }
  }

  function onUnload() {
    log("Odladowano (ten build nic nie patchuje).");
  }

  return { onLoad: onLoad, onUnload: onUnload };
})();
