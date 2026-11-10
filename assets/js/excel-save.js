/* SC_Calc 공용 파일 저장 유틸: showSaveFilePicker 지원 시 이를 사용하고,
   미지원/취소/실패 시 앵커 다운로드로 대체한다. excel-exporter.js·excel-axis-chart.js가 공유한다. */
window.SC_Calc = window.SC_Calc || {};

(function () {
  "use strict";

  function downloadFallback(arrayBuffer, filename) {
    var blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Promise 반환. resolve() 성공(사용자 취소 포함) / reject(Error) 실패.
  function saveWorkbookBuffer(arrayBuffer, filename) {
    return new Promise(function (resolve) {
      if (window.showSaveFilePicker) {
        window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "Excel Workbook", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }]
        }).then(function (handle) {
          return handle.createWritable().then(function (writable) {
            return writable.write(arrayBuffer).then(function () { return writable.close(); });
          });
        }).then(function () {
          resolve();
        }).catch(function (err) {
          if (err && err.name === "AbortError") {
            resolve();
            return;
          }
          downloadFallback(arrayBuffer, filename);
          resolve();
        });
      } else {
        downloadFallback(arrayBuffer, filename);
        resolve();
      }
    });
  }

  window.SC_Calc.ExcelSave = { saveWorkbookBuffer: saveWorkbookBuffer };
})();
