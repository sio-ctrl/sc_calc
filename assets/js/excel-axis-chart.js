/* SC_Calc 축별 속도사양(주행축/승강축/Fork축) 화면 -> Excel 1개 시트 + 네이티브 V-T 차트.
   화면 순서(속도사양 입력 -> 축 요약 -> V-T 그래프 -> 절점 표 -> 시간·거리 결과 표)를 그대로
   한 시트에 옮긴다. 절점(시간/속도) 계산은 axis-profile.js의 scBuildProfilePoints를 그대로
   재사용하고, 차트 삽입은 excel-chart-injector.js(공용 zip 패치)·저장은 excel-save.js(공용
   저장 다이얼로그)를 재사용한다 - Layout 차트(excel-layout-chart.js)와 동일한 구조. */
window.SC_Calc = window.SC_Calc || {};

(function () {
  "use strict";

  var GRAY = "808080", DARK = "1F2430", LIGHT_GRAY = "D5D8DE";
  var CHART_ROW_SPAN = 20, CHART_COL_SPAN = 12;

  function round1(n) { return window.SC_Calc.Util.round1(n); }

  var PROFILE_LABELS = { trapezoid: "사다리꼴", boundary: "경계 프로파일", triangle: "삼각형" };
  var PROFILE_STATUS_LABELS = {
    trapezoid: "목표 최고속도 도달 및 등속 운전 가능",
    boundary: "목표 최고속도 순간 도달, 등속 운전 불가",
    triangle: "목표 최고속도 도달 실패"
  };

  // ---- 시트 행 배치: axis-ui.js 화면 순서(속도사양 입력 -> 축 요약 -> 그래프 -> 절점 -> 상세결과) 그대로 ----
  function buildHeaderRows(axisInputs, strokeLabel, result) {
    var rows = [];
    rows.push(["속도사양 입력"]);
    rows.push([strokeLabel + " [mm]", axisInputs.strokeMm]);
    rows.push(["목표 최고속도 [m/min]", axisInputs.targetSpeedMPerMin]);
    rows.push(["가속도 [mm/s²]", axisInputs.accelerationMmS2]);
    rows.push(["감속도 [mm/s²]", axisInputs.decelerationMmS2]);
    rows.push([]);
    rows.push(["축 요약"]);
    rows.push(["프로파일 종류", PROFILE_LABELS[result.profileType]]);
    rows.push(["도달 상태", PROFILE_STATUS_LABELS[result.profileType]]);
    rows.push(["목표 최고속도 [m/min]", round1(result.targetSpeedMPerMin)]);
    rows.push(["실제 최고속도 [m/min]", round1(result.Vpeak * 60)]);
    rows.push(["편도 운전시간 [s]", round1(result.Ttotal)]);
    rows.push([]);
    rows.push(["V-T 그래프"]);
    return rows;
  }

  function buildNodeRows(points) {
    var rows = [["절점", "시간[s]", "속도[m/min]", "누적거리[mm]"]];
    points.forEach(function (p) {
      rows.push([p.label, round1(p.t), round1(p.v * 60), round1(p.s * 1000)]);
    });
    return rows;
  }

  function buildDetailRows(result, strokeLabel) {
    function t(s) { return round1(s); }
    function d(mm) { return round1(mm); }
    return [
      ["가속시간 (Ta) [s]", t(result.Ta)],
      ["등속시간 (Tc) [s]", t(result.Tc)],
      ["감속시간 (Td) [s]", t(result.Td)],
      ["편도 운전시간 [s]", t(result.Ttotal)],
      ["입력 " + strokeLabel + " [mm]", d(result.axisInputs.strokeMm)],
      ["최고속도 도달거리 [mm]", d(result.Sa * 1000)],
      ["목표속도 운전 최소 " + strokeLabel + " [mm]", d(result.Srequired * 1000)],
      ["가속거리 (Sa) [mm]", d(result.Sa * 1000)],
      ["등속거리 (Sc) [mm]", d(result.Sc * 1000)],
      ["감속거리 (Sd) [mm]", d(result.Sd * 1000)],
      ["감속 시작 위치 [mm]", d(result.decelStartPos * 1000)],
      ["최종 위치 [mm]", d(result.S * 1000)],
      ["환산 목표속도 (V) [m/s]", result.si.V],
      ["환산 가속도 (a) [m/s²]", result.si.a],
      ["환산 감속도 (d) [m/s²]", result.si.d]
    ];
  }

  // "속도사양 입력" ~ "V-T 그래프" 제목 + 차트가 들어갈 빈 행 + 절점 표 앞 빈 줄까지.
  // 이 배열 길이(+1)가 곧 절점 표 헤더가 위치할 1-based 행 번호이므로, 시트를 만드는
  // addAxisSheet와 차트 XML의 데이터 참조(nodeHeaderRow1)가 항상 같은 값을 쓰도록 공유한다.
  function buildPreNodeRows(axisInputs, strokeLabel, result) {
    var rows = buildHeaderRows(axisInputs, strokeLabel, result);
    var chartEndRow0 = rows.length + CHART_ROW_SPAN;
    while (rows.length <= chartEndRow0) rows.push([]);
    rows.push([]);
    return rows;
  }

  function computeChartAnchor(axisInputs, strokeLabel, result) {
    var startRow0 = buildHeaderRows(axisInputs, strokeLabel, result).length;
    return { startRow0: startRow0, endRow0: startRow0 + CHART_ROW_SPAN, endCol0: CHART_COL_SPAN };
  }

  // sheetName: 시트명(예: "주행축"). strokeLabel: "주행거리"/"승강거리"/"스트로크".
  // axisInputs: scReadAxisInputs() 결과. result: scCalculateSpeedProfile() 결과.
  function addAxisSheet(wb, sheetName, strokeLabel, axisInputs, result, points) {
    var rows = buildPreNodeRows(axisInputs, strokeLabel, result);
    buildNodeRows(points).forEach(function (r) { rows.push(r); });
    rows.push([]);
    rows.push(["시간·거리 결과"]);
    buildDetailRows(result, strokeLabel).forEach(function (r) { rows.push(r); });

    var sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  }

  // ---- 차트 XML(OOXML) ----
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function numCache(values) {
    return '<c:formatCode>General</c:formatCode><c:ptCount val="' + values.length + '"/>' +
      values.map(function (v, i) { return '<c:pt idx="' + i + '"><c:v>' + v + '</c:v></c:pt>'; }).join("");
  }

  function dLblXml(localIdx, p) {
    var lines = [p.label, round1(p.t) + "s, " + round1(p.v * 60) + "m/min"];
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

  function axisTitleXml(text) {
    return '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="ko-KR"/><a:t>' + esc(text) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>';
  }

  function majorGridlinesXml() {
    return '<c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="' + LIGHT_GRAY + '"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>';
  }

  // nodeHeaderRow1 = 절점 표 헤더가 위치한 1-based 행 번호(시간=B열, 속도=C열).
  function buildChartXml(sheetName, label, color, result, points, nodeHeaderRow1) {
    var AX1 = 111111111, AX2 = 222222222;
    var r0 = nodeHeaderRow1 + 1, r1 = nodeHeaderRow1 + points.length;
    var xRange = "'" + sheetName + "'!$B$" + r0 + ":$B$" + r1;
    var yRange = "'" + sheetName + "'!$C$" + r0 + ":$C$" + r1;
    var xVals = points.map(function (p) { return round1(p.t); });
    var yVals = points.map(function (p) { return round1(p.v * 60); });
    var title = label + " 속도-시간(V-T) 그래프 - " + PROFILE_LABELS[result.profileType] + " · 편도 " + round1(result.Ttotal) + "s";
    var yMax = Math.max(result.targetSpeedMPerMin, result.Vpeak * 60, 1);
    var xMax = Math.max(result.Ttotal, 1);

    var dLbls = points.map(function (p, i) { return dLblXml(i, p); }).join("");
    var ser = '<c:ser><c:idx val="0"/><c:order val="0"/>' +
      '<c:tx><c:v>' + esc(label) + '</c:v></c:tx>' +
      '<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill></a:ln></c:spPr>' +
      '<c:marker><c:symbol val="circle"/><c:size val="7"/><c:spPr><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="' + DARK + '"/></a:solidFill></a:ln></c:spPr></c:marker>' +
      '<c:dLbls>' + dLbls + '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>' +
      '<c:xVal><c:numRef><c:f>' + xRange + '</c:f><c:numCache>' + numCache(xVals) + '</c:numCache></c:numRef></c:xVal>' +
      '<c:yVal><c:numRef><c:f>' + yRange + '</c:f><c:numCache>' + numCache(yVals) + '</c:numCache></c:numRef></c:yVal>' +
      '<c:smooth val="0"/></c:ser>';

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<c:chart>' +
      '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="1"/></a:pPr><a:r><a:rPr lang="ko-KR" sz="1400" b="1"/><a:t>' + esc(title) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>' +
      '<c:autoTitleDeleted val="0"/>' +
      '<c:plotArea><c:layout/>' +
      '<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>' +
      ser +
      '<c:axId val="' + AX1 + '"/><c:axId val="' + AX2 + '"/></c:scatterChart>' +
      '<c:valAx><c:axId val="' + AX1 + '"/><c:scaling><c:orientation val="minMax"/><c:max val="' + xMax + '"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>' +
      majorGridlinesXml() + axisTitleXml("시간[sec]") +
      '<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' +
      '<c:crossAx val="' + AX2 + '"/><c:crosses val="autoZero"/></c:valAx>' +
      '<c:valAx><c:axId val="' + AX2 + '"/><c:scaling><c:orientation val="minMax"/><c:max val="' + yMax + '"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>' +
      majorGridlinesXml() + axisTitleXml("속도[m/min]") +
      '<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' +
      '<c:crossAx val="' + AX1 + '"/><c:crosses val="autoZero"/></c:valAx>' +
      '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="' + GRAY + '"/></a:solidFill></a:ln></c:spPr>' +
      '</c:plotArea>' +
      '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' +
      '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>' +
      '</c:chart>' +
      '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="' + GRAY + '"/></a:solidFill></a:ln></c:spPr>' +
      '</c:chartSpace>';
  }

  // ---- 공개 API ----
  // opts: { sheetName, label, color(6자리 hex, # 없음), strokeLabel, axisInputs, result }
  // result: axis-profile.js scCalculateSpeedProfile()의 유효한(valid:true) 결과.
  // 반환값: Promise<ArrayBuffer> (차트가 삽입된 최종 xlsx 바이트).
  function buildAxisWorkbookBuffer(opts) {
    var points = window.SC_Calc.AxisProfile.scBuildProfilePoints(opts.result);
    var wb = XLSX.utils.book_new();
    addAxisSheet(wb, opts.sheetName, opts.strokeLabel, opts.axisInputs, opts.result, points);
    var arrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    if (!window.SC_Calc.ExcelChartInjector || typeof JSZip === "undefined") {
      return Promise.resolve(arrayBuffer);
    }
    // buildPreNodeRows()의 길이 바로 다음 행(1-based)이 절점 표 헤더 - addAxisSheet가 실제로
    // 그 자리에 헤더를 쓰는 것과 정확히 같은 함수를 써서 행 번호가 어긋나지 않게 한다.
    var nodeHeaderRow1 = buildPreNodeRows(opts.axisInputs, opts.strokeLabel, opts.result).length + 1;
    var anchor = computeChartAnchor(opts.axisInputs, opts.strokeLabel, opts.result);
    var chartXml = buildChartXml(opts.sheetName, opts.label, opts.color, opts.result, points, nodeHeaderRow1);
    return window.SC_Calc.ExcelChartInjector.injectChart(arrayBuffer, opts.sheetName, chartXml, anchor).catch(function (e) {
      if (window.console) console.warn(opts.label + " 차트 삽입 실패, 표 데이터만 포함해 저장합니다.", e);
      return arrayBuffer;
    });
  }

  // Promise 반환. resolve() 성공(취소 포함) / reject(Error) 실패.
  function exportAxisToExcel(opts) {
    if (typeof XLSX === "undefined") {
      return Promise.reject(new Error("Excel 파일 저장에 실패했습니다. xlsx 라이브러리가 포함되어 있는지 확인하세요."));
    }
    var filename = "SC_Calc_" + opts.sheetName + "_" + window.SC_Calc.Util.formatTimestamp() + ".xlsx";
    return buildAxisWorkbookBuffer(opts).then(function (finalBuffer) {
      return window.SC_Calc.ExcelSave.saveWorkbookBuffer(finalBuffer, filename);
    });
  }

  window.SC_Calc.ExcelAxisChart = { exportAxisToExcel: exportAxisToExcel };
})();
