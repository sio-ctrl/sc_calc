/* SC_Calc Layout 다이어그램 -> Excel 네이티브 XY 분산형 차트.
   SheetJS Community(xlsx.full.min.js)는 차트/이미지 쓰기를 지원하지 않으므로,
   XLSX.write()가 만든 zip에 JSZip(vendor/jszip.min.js)으로 차트 파츠(OOXML)를
   직접 주입한다. 좌표/색상/라벨 규칙은 ui.js의 renderDiagram()·calculator.js의
   buildPoints()/getLayoutBounds()와 동일한 결과가 나오도록 그대로 옮겨서 재사용한다
   (ui.js는 DOM 전용이라 함수를 export하지 않으므로, 순수 로직만 복제했다). */
window.SC_Calc = window.SC_Calc || {};

(function () {
  "use strict";

  var ORANGE = "D2691E", BLUE = "3A6EA5", DARK = "1F2430", GRAY = "808080";
  var LIGHT_GRAY = "D5D8DE"; // ui.js renderDiagram()의 격자선 색상(#d5d8de)과 동일

  function round2(n) { return window.SC_Calc.Util.round2(n); }
  function fmtMm(n) { return Math.round(n).toLocaleString("en-US"); }

  // ---- ui.js와 동일한 규칙(색상/도형/라벨) ----
  // ui.js:pointColor 그대로: 입고=주황, 출고=파랑, Dual Cycle은 1구간(입고Station→입고Rack)만 주황.
  function pointColor(cycleType, idx) {
    if (cycleType === "출고") return BLUE;
    if (cycleType === "입고") return ORANGE;
    return idx <= 1 ? ORANGE : BLUE;
  }
  // ui.js: isStation = p.name.indexOf("Station") !== -1
  function isStationPoint(p) { return p.name.indexOf("Station") !== -1; }
  // ui.js:formatCoordLabel 그대로
  function formatCoordLabel(distanceMethod, p) {
    if (distanceMethod === "Rack Size") return "(" + round2(p.rawTravel) + "%, " + round2(p.rawLift) + "%)";
    return "(" + p.rawTravel + ", " + p.rawLift + ")";
  }
  // ui.js:formatMmLabel 그대로
  function formatMmLabel(p) { return "(" + fmtMm(p.travel) + ", " + fmtMm(p.lift) + ") mm"; }

  // 세그먼트(구간)를 ui.js와 동일한 색상 규칙으로 색칠한 뒤, 색이 이어지는 구간을 하나의
  // 꺾은선 계열(series)로 묶는다 - 네이티브 엑셀 차트는 한 계열에 한 선 색만 가능하기 때문.
  function buildColorGroups(points, cycleType) {
    var groups = [];
    var current = null;
    for (var i = 0; i < points.length - 1; i++) {
      var color = pointColor(cycleType, i + 1);
      if (!current || current.color !== color) {
        if (current) groups.push(current);
        current = { color: color, points: [points[i]] };
      }
      current.points.push(points[i + 1]);
    }
    if (current) groups.push(current);
    return groups;
  }

  // 현재 pointColor() 규칙상 같은 색 그룹은 최대 1개뿐이지만, 혹시 여러 개가 생기는 경우를
  // 대비해 등장 순번을 붙인다(예: "입고 경로 2").
  function seriesName(group, groups) {
    var sameColor = groups.filter(function (g) { return g.color === group.color; });
    var base = group.color === ORANGE ? "입고 경로" : "출고 경로";
    if (sameColor.length <= 1) return base;
    return base + " " + (sameColor.indexOf(group) + 1);
  }

  var LAYOUT_SHEET_NAME = "Layout";
  var CHART_ROW_SPAN = 37, CHART_COL_SPAN = 16; // 기존 전용 시트 때와 동일한 차트 크기
  var DATA_HEADER_ROW1 = 2; // "Layout_Data" 제목이 1행을 차지하므로 표 헤더는 2행부터 시작

  // ---- Layout_Data 표(편집 가능한 원본 좌표 표 - 차트가 이 표를 데이터 계열로 참조한다) ----
  function buildLayoutDataRows(points, distanceMethod) {
    var xLabel = distanceMethod === "Rack Size" ? "X [%]" : "X [Bay]";
    var yLabel = distanceMethod === "Rack Size" ? "Y [%]" : "Y [Level]";
    var rows = [["구분", "종류", xLabel, yLabel, "X [mm]", "Y [mm]"]];
    points.forEach(function (p) {
      rows.push([p.name, isStationPoint(p) ? "Station" : "Rack", p.rawTravel, p.rawLift, Math.round(p.travel), Math.round(p.lift)]);
    });
    return rows;
  }

  // "Layout_Data" 제목 + 표 + 빈 줄 + "Layout_Chart" 제목까지의 행. 이 배열 길이가 곧 차트가
  // 시작될 0-based 행 번호가 되므로, 시트를 만드는 addLayoutSheets와 이후 zip에 차트를 앉히는
  // injectLayoutChart가 항상 같은 위치를 쓰도록 이 함수 하나로 공유한다.
  function buildLayoutHeaderRows(points, distanceMethod) {
    var rows = [["Layout_Data"]];
    buildLayoutDataRows(points, distanceMethod).forEach(function (r) { rows.push(r); });
    rows.push([]);
    rows.push(["Layout_Chart"]);
    return rows;
  }

  function computeChartAnchor(points, distanceMethod) {
    var startRow0 = buildLayoutHeaderRows(points, distanceMethod).length;
    return { startRow0: startRow0, endRow0: startRow0 + CHART_ROW_SPAN };
  }

  // 워크북에 Layout_Data(좌표 표) -> Layout_Chart(차트가 들어갈 빈 자리) -> Segment_Breakdown(구간별 표)
  // 순서로 한 시트("Layout")를 만든다. 실제 차트(OOXML)는 XLSX.write() 이후 injectLayoutChart()에서
  // zip에 주입되므로, 여기서는 차트가 들어갈 자리만큼 빈 행을 확보해 둔다.
  function addLayoutSheets(wb, input, points, segmentRows) {
    var rows = buildLayoutHeaderRows(points, input.distanceMethod);
    var chartEndRow0 = rows.length + CHART_ROW_SPAN;
    while (rows.length <= chartEndRow0) rows.push([]);
    rows.push([]);
    rows.push(["Segment_Breakdown"]);
    (segmentRows || []).forEach(function (r) { rows.push(r); });

    var sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, sheet, LAYOUT_SHEET_NAME);
  }

  // ---- 차트 XML(OOXML) 조립 ----
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function dLblXml(localIdx, p, distanceMethod) {
    var lines = [p.name, formatCoordLabel(distanceMethod, p), formatMmLabel(p)];
    var paras = lines.map(function (line, i) {
      var sz = i === 0 ? 900 : 800, b = i === 0 ? 1 : 0;
      return '<a:p><a:pPr><a:defRPr sz="' + sz + '" b="' + b + '"/></a:pPr>' +
        '<a:r><a:rPr lang="ko-KR" sz="' + sz + '" b="' + b + '"/><a:t>' + esc(line) + '</a:t></a:r></a:p>';
    }).join("");
    return '<c:dLbl><c:idx val="' + localIdx + '"/>' +
      '<c:tx><c:rich><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"/><a:lstStyle/>' + paras + '</c:rich></c:tx>' +
      '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>' +
      '</c:dLbl>';
  }

  function dPtXml(localIdx, p, color) {
    var symbol = isStationPoint(p) ? "square" : "circle";
    var size = isStationPoint(p) ? 9 : 7;
    return '<c:dPt><c:idx val="' + localIdx + '"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/>' +
      '<c:marker><c:symbol val="' + symbol + '"/><c:size val="' + size + '"/>' +
      '<c:spPr><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="' + DARK + '"/></a:solidFill></a:ln></c:spPr>' +
      '</c:marker></c:dPt>';
  }

  function numCache(values) {
    return '<c:formatCode>General</c:formatCode><c:ptCount val="' + values.length + '"/>' +
      values.map(function (v, i) { return '<c:pt idx="' + i + '"><c:v>' + v + '</c:v></c:pt>'; }).join("");
  }

  // group.rowStart = Layout_Data 시트에서 이 계열의 첫 점이 있는 행(1-based, 헤더 포함)
  function serXml(idx, order, group, name, dataSheetName, distanceMethod) {
    var n = group.points.length;
    var r0 = group.rowStart, r1 = group.rowStart + n - 1;
    // Layout_Data 열 순서 고정: A=구분, B=종류, C=X, D=Y, E=X[mm], F=Y[mm]
    var xRange = "'" + dataSheetName + "'!$C$" + r0 + ":$C$" + r1;
    var yRange = "'" + dataSheetName + "'!$D$" + r0 + ":$D$" + r1;
    var dPts = group.points.map(function (p, i) { return dPtXml(i, p, group.color); }).join("");
    var dLbls = group.points.map(function (p, i) { return dLblXml(i, p, distanceMethod); }).join("");
    return '<c:ser><c:idx val="' + idx + '"/><c:order val="' + order + '"/>' +
      '<c:tx><c:v>' + esc(name) + '</c:v></c:tx>' +
      '<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="' + group.color + '"/></a:solidFill></a:ln></c:spPr>' +
      '<c:marker><c:symbol val="circle"/><c:size val="7"/><c:spPr><a:solidFill><a:srgbClr val="' + group.color + '"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="' + DARK + '"/></a:solidFill></a:ln></c:spPr></c:marker>' +
      dPts +
      '<c:dLbls>' + dLbls + '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>' +
      '<c:xVal><c:numRef><c:f>' + xRange + '</c:f><c:numCache>' + numCache(group.points.map(function (p) { return p.rawTravel; })) + '</c:numCache></c:numRef></c:xVal>' +
      '<c:yVal><c:numRef><c:f>' + yRange + '</c:f><c:numCache>' + numCache(group.points.map(function (p) { return p.rawLift; })) + '</c:numCache></c:numRef></c:yVal>' +
      '<c:smooth val="0"/></c:ser>';
  }

  function axisTitleXml(text) {
    return '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="ko-KR"/><a:t>' + esc(text) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>';
  }

  function majorGridlinesXml() {
    return '<c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="' + LIGHT_GRAY + '"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>';
  }

  function buildChartXml(groups, dataSheetName, input) {
    var AX1 = 111111111, AX2 = 222222222;
    var isRackSize = input.distanceMethod === "Rack Size";
    var xTitle = isRackSize ? "주행 위치 [%]" : "Bay";
    var yTitle = isRackSize ? "승강 위치 [%]" : "Level";
    var xMax = isRackSize ? 100 : input.bayLevel.maxBay;
    var yMax = isRackSize ? 100 : input.bayLevel.maxLevel;
    var majorUnit = isRackSize ? 10 : 1; // Rack Size(%) 기준은 10 단위, Bay/Level 기준은 1 단위
    var title = "Layout 다이어그램 - " + input.cycleType;

    var rowCursor = DATA_HEADER_ROW1 + 1; // 표 헤더 다음 행(첫 데이터 점)부터 시작
    var sers = groups.map(function (g, i) {
      g.rowStart = rowCursor;
      rowCursor += g.points.length - 1; // 다음 계열의 시작행은 이 계열의 마지막 점(공유 연결점)과 겹친다
      return serXml(i, i, g, seriesName(g, groups), dataSheetName, input.distanceMethod);
    }).join("");

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<c:chart>' +
      '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="1"/></a:pPr><a:r><a:rPr lang="ko-KR" sz="1400" b="1"/><a:t>' + esc(title) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>' +
      '<c:autoTitleDeleted val="0"/>' +
      '<c:plotArea><c:layout/>' +
      '<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>' +
      sers +
      '<c:axId val="' + AX1 + '"/><c:axId val="' + AX2 + '"/></c:scatterChart>' +
      '<c:valAx><c:axId val="' + AX1 + '"/><c:scaling><c:orientation val="minMax"/><c:max val="' + xMax + '"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>' +
      majorGridlinesXml() + axisTitleXml(xTitle) +
      '<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' +
      '<c:crossAx val="' + AX2 + '"/><c:crosses val="autoZero"/><c:majorUnit val="' + majorUnit + '"/></c:valAx>' +
      '<c:valAx><c:axId val="' + AX2 + '"/><c:scaling><c:orientation val="minMax"/><c:max val="' + yMax + '"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>' +
      majorGridlinesXml() + axisTitleXml(yTitle) +
      '<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' +
      '<c:crossAx val="' + AX1 + '"/><c:crosses val="autoZero"/><c:majorUnit val="' + majorUnit + '"/></c:valAx>' +
      '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="' + GRAY + '"/></a:solidFill></a:ln></c:spPr>' +
      '</c:plotArea>' +
      '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' +
      '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>' +
      '</c:chart>' +
      '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="' + GRAY + '"/></a:solidFill></a:ln></c:spPr>' +
      '</c:chartSpace>';
  }

  // input: collectInputData() 결과, points: Calculator.buildPoints(input) 결과.
  // zipArrayBuffer: XLSX.write(wb, {type:"array"}) 결과. 반환값: 차트가 삽입된 최종 zip(ArrayBuffer).
  // zip 패치 자체(시트 찾기·drawing/rels/ContentTypes 작성)는 excel-chart-injector.js가 공통으로 담당한다.
  function injectLayoutChart(zipArrayBuffer, input, points) {
    var groups = buildColorGroups(points, input.cycleType);
    var chartXml = buildChartXml(groups, LAYOUT_SHEET_NAME, input);
    var anchor = computeChartAnchor(points, input.distanceMethod);
    anchor.endCol0 = CHART_COL_SPAN;
    return window.SC_Calc.ExcelChartInjector.injectChart(zipArrayBuffer, LAYOUT_SHEET_NAME, chartXml, anchor);
  }

  window.SC_Calc.ExcelLayoutChart = {
    addLayoutSheets: addLayoutSheets,
    injectLayoutChart: injectLayoutChart
  };
})();
