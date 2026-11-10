/* SC_Calc 앱 초기화 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var UI = window.SC_Calc.UI;
    var saved = window.SC_Calc.Storage.load();
    UI.populateInputData(saved || window.SC_Calc.DEFAULT_CONFIG);
    UI.bindEvents();
    // 축별 속도사양 탭(axis-ui.js)은 메인 Cycle Time 입력값이 채워진 뒤에 초기화한다.
    if (window.SC_Calc.AxisUI) window.SC_Calc.AxisUI.initAxisTabs();
  });
})();
