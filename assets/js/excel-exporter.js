/* SC_Calc Excel(.xlsx) 저장 - SheetJS(vendor/xlsx.full.min.js) 사용 */
window.SC_Calc = window.SC_Calc || {};

(function () {
  "use strict";

  var round2 = function (n) { return window.SC_Calc.Util.round2(n); };
  var round1 = function (n) { return window.SC_Calc.Util.round1(n); }; // 시간(sec) - 전체 화면 공통 소수점 1자리

  var DISCLAIMER = [
    "본 프로그램의 계산 결과는 설계 검토용 예상값입니다.",
    "장비 제조사에서 제공한 공식 사양값, 제어 시퀀스, 안전 인터록 조건, 사내 표준 계산식이 있는 경우 해당 기준이 본 프로그램의 기본 계산식보다 우선합니다.",
    "Dual Cycle 계산은 본 프로그램에서 정의한 기본 시퀀스 기준으로 계산됩니다. 실제 장비 시퀀스가 다른 경우 계산 결과가 달라질 수 있습니다."
  ];

  // Cycle Time 탭 화면의 "Rack Size 기준 위치" / "Bay/Level Pitch 기준 위치" fieldset을
  // 그 안의 필드 순서 그대로 옮긴다(길이/높이 -> 위치). 위치는 화면처럼 (x, y) 한 줄로 표시한다.
  function buildPositionRows(input) {
    var rows = [];
    var isDual = input.cycleType === "Dual Cycle";
    if (input.distanceMethod === "Rack Size") {
      rows.push(["Rack Size 기준 위치"]);
      rows.push(["Rack 주행 기준 길이 [mm]", input.rackSize.rackTravelLength]);
      rows.push(["Rack 승강 기준 높이 [mm]", input.rackSize.rackLiftHeight]);
      if (isDual) {
        var d = input.rackSize.dual;
        rows.push(["입고 Station 위치 (주행%, 승강%)", d.inStationTravelPercent + ", " + d.inStationLiftPercent]);
        rows.push(["입고 Rack 위치 (주행%, 승강%)", d.inRackTravelPercent + ", " + d.inRackLiftPercent]);
        rows.push(["출고 Rack 위치 (주행%, 승강%)", d.outRackTravelPercent + ", " + d.outRackLiftPercent]);
        rows.push(["출고 Station 위치 (주행%, 승강%)", d.outStationTravelPercent + ", " + d.outStationLiftPercent]);
      } else {
        var s = input.rackSize.single;
        rows.push(["출발 위치 (주행%, 승강%)", s.startTravelPercent + ", " + s.startLiftPercent]);
        rows.push(["도착 위치 (주행%, 승강%)", s.endTravelPercent + ", " + s.endLiftPercent]);
      }
    } else {
      rows.push(["Bay/Level Pitch 기준 위치"]);
      rows.push(["Rack Size (Bay Pitch) [mm]", input.bayLevel.bayPitch]);
      rows.push(["Rack Size (Level Pitch) [mm]", input.bayLevel.levelPitch]);
      rows.push(["Max Bay (Layout 최대)", input.bayLevel.maxBay]);
      rows.push(["Max Level (Layout 최대)", input.bayLevel.maxLevel]);
      if (isDual) {
        var bd = input.bayLevel.dual;
        rows.push(["입고 Station 위치 (Bay, Level)", bd.inStationBay + ", " + bd.inStationLevel]);
        rows.push(["입고 Rack 위치 (Bay, Level)", bd.inRackBay + ", " + bd.inRackLevel]);
        rows.push(["출고 Rack 위치 (Bay, Level)", bd.outRackBay + ", " + bd.outRackLevel]);
        rows.push(["출고 Station 위치 (Bay, Level)", bd.outStationBay + ", " + bd.outStationLevel]);
      } else {
        var bs = input.bayLevel.single;
        rows.push(["출발 위치 (Bay, Level)", bs.startBay + ", " + bs.startLevel]);
        rows.push(["도착 위치 (Bay, Level)", bs.endBay + ", " + bs.endLevel]);
      }
    }
    return rows;
  }

  // Cycle Time 탭 "결과" 패널의 요약 표(displayResult)와 동일한 라벨(횟수 표기 포함)·순서로 만든다.
  function buildResultSummaryRows(result) {
    var s = result.summary;
    var c = result.additionalCounts;
    return [
      ["Cycle 유형", s.cycleType],
      ["거리 계산 방식", s.distanceMethod],
      ["총 주행 거리 [mm]", round2(s.totalTravelDistance)],
      ["총 승강 거리 [mm]", round2(s.totalLiftDistance)],
      ["총 주행 시간 [sec]", round1(s.totalTravelTime)],
      ["총 승강 시간 [sec]", round1(s.totalLiftTime)],
      ["총 이동 시간 [sec]", round1(s.totalMovementTime)],
      ["포크 동작 시간 [sec] (" + c.forkPositions + "개 위치)", round1(s.forkOperationTime)],
      ["Load/Unload 시간 [sec] (Load " + c.loadCount + "회 / Unload " + c.unloadCount + "회)", round1(s.loadUnloadTime)],
      ["위치 결정 시간 합계 [sec] (" + c.positioningCount + "회)", round1(s.positioningTimeTotal)],
      ["통신 또는 센서 확인 시간 합계 [sec] (" + c.communicationCount + "회)", round1(s.communicationTimeTotal)],
      ["여유 시간 [sec]", round1(s.marginTime)],
      ["총 Cycle Time [sec]", round1(s.totalCycleTime)]
    ];
  }

  // Cycle Time 탭 화면 구성(입력 패널의 기본 설정→장비 사양→위치→부가 시간, 결과 패널의
  // 총 Cycle Time→요약 표 순서) 그대로 시트에 옮긴다. Layout 다이어그램(SVG)만 제외한다.
  function buildSummarySheetData(result) {
    var s = result.summary;
    var at = result.input.additionalTime;
    var rows = [];

    rows.push(["SC_Calc - Stacker Crane Cycle Time Calculator"]);
    rows.push(["계산 일시", window.SC_Calc.Util.formatDateTime()]);
    rows.push([]);
    rows.push(["입력"]);
    rows.push([]);
    rows.push(["기본 설정"]);
    rows.push(["Cycle 유형", s.cycleType]);
    rows.push(["거리 계산 방식", s.distanceMethod]);
    rows.push([]);
    rows.push(["장비 사양"]);
    rows.push(["주행 최대 속도 [mm/s]", result.input.equipment.travelMaxSpeed]);
    rows.push(["주행 가속도 [mm/s²]", result.input.equipment.travelAccel]);
    rows.push(["주행 감속도 [mm/s²]", result.input.equipment.travelDecel]);
    rows.push(["승강 최대 속도 [mm/s]", result.input.equipment.liftMaxSpeed]);
    rows.push(["승강 가속도 [mm/s²]", result.input.equipment.liftAccel]);
    rows.push(["승강 감속도 [mm/s²]", result.input.equipment.liftDecel]);
    rows.push([]);
    buildPositionRows(result.input).forEach(function (r) { rows.push(r); });
    rows.push([]);
    rows.push(["부가 시간 (1회 기준)"]);
    rows.push(["포크 인출 시간 [sec/회]", at.forkOutTime]);
    rows.push(["포크 인입 시간 [sec/회]", at.forkInTime]);
    rows.push(["Load 시간 [sec/회]", at.loadTime]);
    rows.push(["Unload 시간 [sec/회]", at.unloadTime]);
    rows.push(["위치 결정 시간 [sec/회]", at.positioningTime]);
    rows.push(["통신/센서 확인 시간 [sec/회]", at.communicationTime]);
    rows.push(["여유 시간 [sec/Cycle]", at.marginTime]);
    rows.push([]);
    rows.push(["결과"]);
    rows.push([]);
    rows.push(["총 Cycle Time [sec]", round1(s.totalCycleTime)]);
    rows.push([]);
    buildResultSummaryRows(result).forEach(function (r) { rows.push(r); });
    rows.push([]);
    rows.push(["구간별 Breakdown", "-> Layout 시트 참고"]);
    rows.push([]);
    rows.push(["계산 결과 사용 주의사항"]);
    DISCLAIMER.forEach(function (line) { rows.push([line]); });

    return rows;
  }

  function buildSegmentSheetData(result) {
    var rows = [["구간", "시작 위치", "종료 위치", "주행 거리 [mm]", "승강 거리 [mm]", "주행 시간 [sec]", "승강 시간 [sec]", "구간 이동 시간 [sec]"]];
    result.segments.forEach(function (seg) {
      rows.push([
        seg.name, seg.startName, seg.endName,
        round2(seg.travelDistance), round2(seg.liftDistance),
        round1(seg.travelTime), round1(seg.liftTime), round1(seg.movementTime)
      ]);
    });
    return rows;
  }

  function buildWorkbook(result) {
    var wb = XLSX.utils.book_new();
    var summarySheet = XLSX.utils.aoa_to_sheet(buildSummarySheetData(result));
    summarySheet["!cols"] = [{ wch: 38 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
    // Layout_Data(좌표 표) -> Layout_Chart(네이티브 차트) -> Segment_Breakdown(구간별 표) 순서로
    // 한 시트("Layout")에 모아 담는다. 좌표는 Calculator.buildPoints를 그대로 재사용한다.
    // 네이티브 차트(OOXML) 자체는 XLSX.write() 이후 zip 후처리 단계에서 삽입된다 (ExcelLayoutChart.injectLayoutChart).
    if (window.SC_Calc.ExcelLayoutChart) {
      var points = window.SC_Calc.Calculator.buildPoints(result.input);
      window.SC_Calc.ExcelLayoutChart.addLayoutSheets(wb, result.input, points, buildSegmentSheetData(result));
    }
    return wb;
  }

  // Promise 반환. resolve() 성공 / reject(Error) 실패(사용자 취소는 resolve 처리)
  function exportResultToExcel(result) {
    return new Promise(function (resolve, reject) {
      if (typeof XLSX === "undefined") {
        reject(new Error("Excel 파일 저장에 실패했습니다. xlsx 라이브러리가 포함되어 있는지 확인하세요."));
        return;
      }

      var filename = "SC_Calc_Result_" + window.SC_Calc.Util.formatTimestamp() + ".xlsx";
      var wb;
      var arrayBuffer;
      try {
        wb = buildWorkbook(result);
        arrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      } catch (e) {
        reject(new Error("Excel 파일 생성에 실패했습니다. (" + e.message + ")"));
        return;
      }

      // Layout 다이어그램에 해당하는 네이티브 XY 차트를 zip에 주입한다. JSZip이 없거나
      // 주입 중 오류가 나면 차트 없이(표 데이터만 포함된) 파일로 조용히 대체한다 - 기존
      // Excel 저장 기능(요약/구간 표) 자체는 이 실패로 인해 막히지 않아야 한다.
      var withChart;
      if (window.SC_Calc.ExcelLayoutChart && typeof JSZip !== "undefined") {
        var points = window.SC_Calc.Calculator.buildPoints(result.input);
        withChart = window.SC_Calc.ExcelLayoutChart.injectLayoutChart(arrayBuffer, result.input, points).catch(function (e) {
          if (window.console) console.warn("Layout 차트 삽입 실패, 데이터 시트만 포함해 저장합니다.", e);
          return arrayBuffer;
        });
      } else {
        withChart = Promise.resolve(arrayBuffer);
      }

      withChart.then(function (finalBuffer) {
        window.SC_Calc.ExcelSave.saveWorkbookBuffer(finalBuffer, filename).then(resolve);
      });
    });
  }

  window.SC_Calc.ExcelExporter = {
    exportResultToExcel: exportResultToExcel
  };
})();
