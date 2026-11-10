/* SC_Calc LocalStorage 저장 + JSON Export/Import */
window.SC_Calc = window.SC_Calc || {};

(function () {
  "use strict";

  var STORAGE_KEY = "SC_Calc:lastConfig:v1";
  var AXIS_STORAGE_KEY = "SC_Calc:axisSettings:v1"; // 주행축/승강축/Fork축 속도사양 입력값 (탭별)

  function save(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function load() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      // 구버전 설정에 없는 필드는 기본값으로 채운다.
      return window.SC_Calc.Util.mergeConfig(window.SC_Calc.DEFAULT_CONFIG, JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function loadAxisSettingsRaw() {
    var raw = localStorage.getItem(AXIS_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  // axisType 하나의 속도사양 입력값을 저장한다(다른 축의 저장값은 유지).
  function saveAxisSettings(axisType, values) {
    var all = loadAxisSettingsRaw() || {};
    all[axisType] = values;
    localStorage.setItem(AXIS_STORAGE_KEY, JSON.stringify(all));
  }

  // 저장된 값이 있으면 defaults와 병합(누락 필드 보완)해서 반환, 없으면 null.
  function loadAxisSettings(axisType, defaults) {
    var all = loadAxisSettingsRaw();
    if (!all || !all[axisType]) return null;
    return window.SC_Calc.Util.mergeConfig(defaults, all[axisType]);
  }

  function downloadJSON(config) {
    var filename = "SC_Calc_Config_" + window.SC_Calc.Util.formatTimestamp() + ".json";
    var blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // callback(error, config)
  function importJSONFile(file, callback) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var config = JSON.parse(reader.result);
        callback(null, config);
      } catch (e) {
        callback(new Error("JSON 파일 형식이 올바르지 않습니다."), null);
      }
    };
    reader.onerror = function () {
      callback(new Error("파일을 읽는 중 오류가 발생했습니다."), null);
    };
    reader.readAsText(file);
  }

  window.SC_Calc.Storage = {
    STORAGE_KEY: STORAGE_KEY,
    AXIS_STORAGE_KEY: AXIS_STORAGE_KEY,
    save: save,
    load: load,
    clear: clear,
    saveAxisSettings: saveAxisSettings,
    loadAxisSettings: loadAxisSettings,
    downloadJSON: downloadJSON,
    importJSONFile: importJSONFile
  };
})();
