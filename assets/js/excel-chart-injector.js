/* SC_Calc 공용 네이티브 엑셀 차트 주입기.
   SheetJS Community(xlsx.full.min.js)는 차트/이미지 쓰기를 지원하지 않으므로,
   XLSX.write()가 만든 zip에 JSZip(vendor/jszip.min.js)으로 차트 파츠(OOXML)를 직접
   주입한다. 이 모듈은 "어느 시트의 어느 위치에 이 chartSpace XML을 앉힌다"는 기계적인
   zip 패치만 담당하고, 차트 내용(계열·색상·좌표)은 호출자(excel-layout-chart.js,
   excel-axis-chart.js)가 만든다. 워크북마다 차트가 하나뿐이라는 전제로 항상
   chart1.xml/drawing1.xml 이름을 쓴다(호출자는 매번 새 워크북을 만들어 넘긴다). */
window.SC_Calc = window.SC_Calc || {};

(function () {
  "use strict";

  function findSheetPath(zip, sheetName) {
    return zip.file("xl/workbook.xml").async("string").then(function (wbXml) {
      // matchAll()은 이터레이터를 반환하므로 slice.call()로는 배열화되지 않는다 (array-like 아님) - Array.from 사용.
      var sheetMatches = Array.from(wbXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g));
      var entry = sheetMatches.filter(function (m) { return m[1] === sheetName; })[0];
      if (!entry) throw new Error(sheetName + " 시트를 workbook.xml에서 찾지 못했습니다.");
      var rid = entry[2];
      return zip.file("xl/_rels/workbook.xml.rels").async("string").then(function (relsXml) {
        var relMatches = Array.from(relsXml.matchAll(/<Relationship[^>]*Id="(rId\d+)"[^>]*Target="(worksheets\/sheet\d+\.xml)"/g));
        var target = relMatches.filter(function (m) { return m[1] === rid; })[0];
        if (!target) throw new Error(sheetName + " 시트의 워크시트 파일을 찾지 못했습니다.");
        return { path: "xl/" + target[2], fileName: target[2].split("/")[1] };
      });
    });
  }

  // zipArrayBuffer: XLSX.write(wb, {type:"array"}) 결과(ArrayBuffer).
  // sheetName: 차트를 앉힐 시트 이름. chartXml: c:chartSpace 전체 XML 문자열.
  // anchor: {startRow0, endRow0, startCol0(생략 시 0), endCol0} (0-based twoCellAnchor 좌표).
  // 반환값: 차트가 삽입된 최종 zip(ArrayBuffer) - Blob/FileSystemWritableFileStream에 바로 쓸 수 있다.
  function injectChart(zipArrayBuffer, sheetName, chartXml, anchor) {
    var startCol0 = anchor.startCol0 || 0;
    return JSZip.loadAsync(zipArrayBuffer).then(function (zip) {
      return findSheetPath(zip, sheetName).then(function (sheetInfo) {
        var drawingXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
          '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<xdr:twoCellAnchor>' +
          '<xdr:from><xdr:col>' + startCol0 + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + anchor.startRow0 + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
          '<xdr:to><xdr:col>' + anchor.endCol0 + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + anchor.endRow0 + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
          '<xdr:graphicFrame macro="">' +
          '<xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>' +
          '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
          '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
          '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>' +
          '</a:graphicData></a:graphic>' +
          '</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>';

        var drawingRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>' +
          '</Relationships>';

        var sheetRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
          '</Relationships>';

        zip.file("xl/charts/chart1.xml", chartXml);
        zip.file("xl/drawings/drawing1.xml", drawingXml);
        zip.file("xl/drawings/_rels/drawing1.xml.rels", drawingRelsXml);
        zip.file("xl/worksheets/_rels/" + sheetInfo.fileName + ".rels", sheetRelsXml);

        return zip.file(sheetInfo.path).async("string").then(function (sheetXml) {
          sheetXml = sheetXml.replace("</worksheet>", '<drawing r:id="rId1"/></worksheet>');
          zip.file(sheetInfo.path, sheetXml);

          return zip.file("[Content_Types].xml").async("string").then(function (ct) {
            ct = ct.replace("</Types>",
              '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' +
              '<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>' +
              '</Types>');
            zip.file("[Content_Types].xml", ct);
            // 주의: JSZip의 "array" 타입은 SheetJS의 "array"(ArrayBuffer)와 달리 순수 숫자 배열이라
            // Blob/FileSystemWritableFileStream에 바로 쓸 수 없다. 반드시 "arraybuffer"를 사용한다.
            return zip.generateAsync({ type: "arraybuffer" });
          });
        });
      });
    });
  }

  window.SC_Calc.ExcelChartInjector = { injectChart: injectChart };
})();
