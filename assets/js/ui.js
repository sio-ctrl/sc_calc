/* SC_Calc UI 제어: DOM 조회/반영, 동적 표시, 결과 표시, 이벤트 바인딩 */
window.SC_Calc = window.SC_Calc || {};

(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function round2(n) { return window.SC_Calc.Util.round2(n); }
  function round1(n) { return window.SC_Calc.Util.round1(n); }
  function fmt(n) { return round2(n).toFixed(2); } // 거리(mm) 등 시간 외 값
  function fmtSec(n) { return round1(n).toFixed(1); } // 시간(sec) - 전체 화면 공통 소수점 1자리

  function toNumber(v) {
    if (v === "" || v === null || v === undefined) return NaN;
    return Number(v);
  }

  // ---- 입력값 수집 ----
  function collectInputData() {
    return {
      cycleType: $("cycleType").value,
      distanceMethod: $("distanceMethod").value,
      equipment: {
        travelMaxSpeed: toNumber($("travelMaxSpeed").value),
        travelAccel: toNumber($("travelAccel").value),
        travelDecel: toNumber($("travelDecel").value),
        liftMaxSpeed: toNumber($("liftMaxSpeed").value),
        liftAccel: toNumber($("liftAccel").value),
        liftDecel: toNumber($("liftDecel").value)
      },
      rackSize: {
        rackTravelLength: toNumber($("rackTravelLength").value),
        rackLiftHeight: toNumber($("rackLiftHeight").value),
        single: {
          startTravelPercent: toNumber($("rs_startTravelPercent").value),
          startLiftPercent: toNumber($("rs_startLiftPercent").value),
          endTravelPercent: toNumber($("rs_endTravelPercent").value),
          endLiftPercent: toNumber($("rs_endLiftPercent").value)
        },
        dual: {
          inStationTravelPercent: toNumber($("rs_inStationTravelPercent").value),
          inStationLiftPercent: toNumber($("rs_inStationLiftPercent").value),
          inRackTravelPercent: toNumber($("rs_inRackTravelPercent").value),
          inRackLiftPercent: toNumber($("rs_inRackLiftPercent").value),
          outRackTravelPercent: toNumber($("rs_outRackTravelPercent").value),
          outRackLiftPercent: toNumber($("rs_outRackLiftPercent").value),
          outStationTravelPercent: toNumber($("rs_outStationTravelPercent").value),
          outStationLiftPercent: toNumber($("rs_outStationLiftPercent").value)
        }
      },
      bayLevel: {
        bayPitch: toNumber($("bayPitch").value),
        levelPitch: toNumber($("levelPitch").value),
        maxBay: toNumber($("bl_maxBay").value),
        maxLevel: toNumber($("bl_maxLevel").value),
        single: {
          startBay: toNumber($("bl_startBay").value),
          startLevel: toNumber($("bl_startLevel").value),
          endBay: toNumber($("bl_endBay").value),
          endLevel: toNumber($("bl_endLevel").value)
        },
        dual: {
          inStationBay: toNumber($("bl_inStationBay").value),
          inStationLevel: toNumber($("bl_inStationLevel").value),
          inRackBay: toNumber($("bl_inRackBay").value),
          inRackLevel: toNumber($("bl_inRackLevel").value),
          outRackBay: toNumber($("bl_outRackBay").value),
          outRackLevel: toNumber($("bl_outRackLevel").value),
          outStationBay: toNumber($("bl_outStationBay").value),
          outStationLevel: toNumber($("bl_outStationLevel").value)
        }
      },
      additionalTime: {
        forkOutTime: toNumber($("forkOutTime").value),
        forkInTime: toNumber($("forkInTime").value),
        loadTime: toNumber($("loadTime").value),
        unloadTime: toNumber($("unloadTime").value),
        positioningTime: toNumber($("positioningTime").value),
        communicationTime: toNumber($("communicationTime").value),
        marginTime: toNumber($("marginTime").value)
      }
    };
  }

  // ---- 입력값 화면 반영 ----
  function populateInputData(cfg) {
    $("cycleType").value = cfg.cycleType;
    $("distanceMethod").value = cfg.distanceMethod;

    // 속도(mm/s)·가감속도(mm/s²) 값은 소수점 1자리까지만 표시한다.
    $("travelMaxSpeed").value = round1(cfg.equipment.travelMaxSpeed);
    $("travelAccel").value = round1(cfg.equipment.travelAccel);
    $("travelDecel").value = round1(cfg.equipment.travelDecel);
    $("liftMaxSpeed").value = round1(cfg.equipment.liftMaxSpeed);
    $("liftAccel").value = round1(cfg.equipment.liftAccel);
    $("liftDecel").value = round1(cfg.equipment.liftDecel);

    $("rackTravelLength").value = cfg.rackSize.rackTravelLength;
    $("rackLiftHeight").value = cfg.rackSize.rackLiftHeight;
    var rs = cfg.rackSize.single;
    $("rs_startTravelPercent").value = rs.startTravelPercent;
    $("rs_startLiftPercent").value = rs.startLiftPercent;
    $("rs_endTravelPercent").value = rs.endTravelPercent;
    $("rs_endLiftPercent").value = rs.endLiftPercent;
    var rd = cfg.rackSize.dual;
    $("rs_inStationTravelPercent").value = rd.inStationTravelPercent;
    $("rs_inStationLiftPercent").value = rd.inStationLiftPercent;
    $("rs_inRackTravelPercent").value = rd.inRackTravelPercent;
    $("rs_inRackLiftPercent").value = rd.inRackLiftPercent;
    $("rs_outRackTravelPercent").value = rd.outRackTravelPercent;
    $("rs_outRackLiftPercent").value = rd.outRackLiftPercent;
    $("rs_outStationTravelPercent").value = rd.outStationTravelPercent;
    $("rs_outStationLiftPercent").value = rd.outStationLiftPercent;

    $("bayPitch").value = cfg.bayLevel.bayPitch;
    $("levelPitch").value = cfg.bayLevel.levelPitch;
    $("bl_maxBay").value = cfg.bayLevel.maxBay;
    $("bl_maxLevel").value = cfg.bayLevel.maxLevel;
    var bs = cfg.bayLevel.single;
    $("bl_startBay").value = bs.startBay;
    $("bl_startLevel").value = bs.startLevel;
    $("bl_endBay").value = bs.endBay;
    $("bl_endLevel").value = bs.endLevel;
    var bd = cfg.bayLevel.dual;
    $("bl_inStationBay").value = bd.inStationBay;
    $("bl_inStationLevel").value = bd.inStationLevel;
    $("bl_inRackBay").value = bd.inRackBay;
    $("bl_inRackLevel").value = bd.inRackLevel;
    $("bl_outRackBay").value = bd.outRackBay;
    $("bl_outRackLevel").value = bd.outRackLevel;
    $("bl_outStationBay").value = bd.outStationBay;
    $("bl_outStationLevel").value = bd.outStationLevel;

    // 부가 시간(sec/회, sec/Cycle)은 소수점 1자리까지만 표시한다.
    var at = cfg.additionalTime;
    $("forkOutTime").value = round1(at.forkOutTime);
    $("forkInTime").value = round1(at.forkInTime);
    $("loadTime").value = round1(at.loadTime);
    $("unloadTime").value = round1(at.unloadTime);
    $("positioningTime").value = round1(at.positioningTime);
    $("communicationTime").value = round1(at.communicationTime);
    $("marginTime").value = round1(at.marginTime);

    updateDynamicVisibility();
    renderDiagram();
  }

  // ---- Layout 다이어그램 (SVG) ----
  var SVG_NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    return el;
  }

  function pointColor(cycleType, idx) {
    if (cycleType === "출고") return "#3a6ea5";
    if (cycleType === "입고") return "#d2691e";
    return idx <= 1 ? "#d2691e" : "#3a6ea5"; // Dual Cycle: 앞 절반(입고) 주황, 뒤 절반(출고) 파랑
  }

  function formatMmComma(n) { return Math.round(n).toLocaleString("en-US"); }

  // Rack Size 기준: (주행%, 승강%) / Bay/Level Pitch 기준: (Bay, Level) - 사용자가 입력한 단위 그대로 표시
  function formatCoordLabel(distanceMethod, point) {
    if (distanceMethod === "Rack Size") {
      return "(" + round2(point.rawTravel) + "%, " + round2(point.rawLift) + "%)";
    }
    return "(" + point.rawTravel + ", " + point.rawLift + ")";
  }

  // 실제 위치를 천단위 콤마 포함 mm 값으로 표시 (Rack Size%/Bay,Level 라벨 아래에 추가로 표시)
  function formatMmLabel(point) {
    return "(" + formatMmComma(point.travel) + ", " + formatMmComma(point.lift) + ") mm";
  }

  function renderDiagram() {
    var g = $("layoutSvgG");
    while (g.firstChild) g.removeChild(g.firstChild);

    var input = collectInputData();
    var points = window.SC_Calc.Calculator.buildPoints(input);
    var valid = points.every(function (p) { return isFinite(p.travel) && isFinite(p.lift); });
    if (!valid) return;

    var bounds = window.SC_Calc.Calculator.getLayoutBounds(input);
    var minT = bounds.minTravel, maxT = bounds.maxTravel, minL = bounds.minLift, maxL = bounds.maxLift;
    if (!isFinite(minT) || !isFinite(maxT) || !isFinite(minL) || !isFinite(maxL) || maxT - minT <= 0 || maxL - minL <= 0) return;

    var svgW = 900, svgH = 330;
    var marginX = 90, marginY = 35;
    var plotW = svgW - marginX * 2;
    var plotH = 230; // 고정 - 위치 라벨(%, mm 2줄)이 들어갈 만큼만 하단 여백을 svgH에서 확보한다.
    function xOf(t) { return marginX + (t - minT) / (maxT - minT) * plotW; }
    function yOf(l) { return marginY + plotH - (l - minL) / (maxL - minL) * plotH; }

    var isRackSize = input.distanceMethod === "Rack Size";

    // Cell 격자 (회색선): Bay/Level 기준은 1 Bay × 1 Level 단위, Rack Size 기준은 10% 간격
    var gridX = [], gridY = [];
    if (isRackSize) {
      for (var gi = 1; gi < 10; gi++) {
        gridX.push(minT + (maxT - minT) * gi / 10);
        gridY.push(minL + (maxL - minL) * gi / 10);
      }
    } else {
      // ponytail: Bay 수가 아주 많으면 선이 뭉개지므로 간격을 자동으로 넓힘
      var bayStep = Math.max(1, Math.ceil(input.bayLevel.maxBay / 60));
      var levelStep = Math.max(1, Math.ceil(input.bayLevel.maxLevel / 60));
      for (var b = bayStep; b < input.bayLevel.maxBay; b += bayStep) gridX.push(b * input.bayLevel.bayPitch);
      for (var lv = levelStep; lv < input.bayLevel.maxLevel; lv += levelStep) gridY.push(lv * input.bayLevel.levelPitch);
    }
    gridX.forEach(function (t) {
      g.appendChild(svgEl("line", { x1: xOf(t), y1: marginY, x2: xOf(t), y2: marginY + plotH, stroke: "#d5d8de", "stroke-width": 0.8 }));
    });
    gridY.forEach(function (l) {
      g.appendChild(svgEl("line", { x1: marginX, y1: yOf(l), x2: marginX + plotW, y2: yOf(l), stroke: "#d5d8de", "stroke-width": 0.8 }));
    });

    // Rack 경계
    g.appendChild(svgEl("rect", {
      x: marginX, y: marginY, width: plotW, height: plotH,
      fill: "none", stroke: "#1f2430", "stroke-width": 1.5
    }));

    // 승강(세로) 축 눈금 라인 - 양 끝에 "위치 | 실제mm(Rack 총 높이)" 값을 표기한다.
    // 세로 라벨은 좌측 여백이 좁아 두 줄(위치, mm)로 표기한다.
    function drawLiftRuler(topLine1, bottomLine1, liftHeightMm) {
      var rulerX = marginX - 18;
      g.appendChild(svgEl("line", { x1: rulerX, y1: marginY, x2: rulerX, y2: marginY + plotH, stroke: "#444", "stroke-width": 1 }));
      [marginY, marginY + plotH].forEach(function (y) {
        g.appendChild(svgEl("line", { x1: rulerX - 4, y1: y, x2: rulerX + 4, y2: y, stroke: "#444", "stroke-width": 1 }));
      });
      [
        { y: marginY + plotH, line1: bottomLine1, line2: "0mm" },
        { y: marginY, line1: topLine1, line2: liftHeightMm + "mm" }
      ].forEach(function (pt) {
        var dy1 = pt.y === marginY ? 3 : -6;
        var dy2 = pt.y === marginY ? 15 : 6;
        var t1 = svgEl("text", { x: rulerX - 6, y: pt.y + dy1, "text-anchor": "end", "font-size": 10, "font-weight": "600", fill: "#444" });
        t1.textContent = pt.line1;
        g.appendChild(t1);
        var t2 = svgEl("text", { x: rulerX - 6, y: pt.y + dy2, "text-anchor": "end", "font-size": 10, "font-weight": "600", fill: "#444" });
        t2.textContent = pt.line2;
        g.appendChild(t2);
      });
    }

    if (isRackSize) {
      // 주행(가로) 축 눈금은 표시하지 않는다 - 위치별 mm 값은 각 마커 라벨에 이미 표시된다.
      drawLiftRuler("100%", "0%", input.rackSize.rackLiftHeight);
      // 우측 상단 모서리에 Rack 전체 크기(주행 길이, 승강 높이) mm 값을 표시한다.
      var maxXYLabel = svgEl("text", {
        x: marginX + plotW, y: marginY - 10, "text-anchor": "end", "font-size": 10, "font-weight": "600", fill: "#444"
      });
      maxXYLabel.textContent = "(" + formatMmComma(input.rackSize.rackTravelLength) + ", " + formatMmComma(input.rackSize.rackLiftHeight) + ") mm";
      g.appendChild(maxXYLabel);
    } else {
      // Bay/Level Pitch 기준: 우측 상단 모서리에 (Bay, Level) 최대값 라벨 + 좌측에 Rack 총 높이(mm) 눈금.
      // 좌측 상단(Bay 0, Level maxLevel)은 눈금과 같은 자리라 생략하고, 하단(Level 0)은 항상 0으로
      // 자명하고 마커(Station)에 가려지므로 표시하지 않는다.
      var maxRawT = input.bayLevel.maxBay;
      var maxRawL = input.bayLevel.maxLevel;
      drawLiftRuler("Level " + maxRawL, "Level 0", maxL);
      var cornerLabel = svgEl("text", {
        x: marginX + plotW, y: marginY - 20, "text-anchor": "end", "font-size": 10, "font-weight": "600", fill: "#444"
      });
      cornerLabel.textContent = "(Bay " + maxRawT + ", Level " + maxRawL + ")";
      g.appendChild(cornerLabel);
      var cornerMmLabel = svgEl("text", {
        x: marginX + plotW, y: marginY - 8, "text-anchor": "end", "font-size": 10, "font-weight": "600", fill: "#444"
      });
      cornerMmLabel.textContent = "(" + formatMmComma(maxT) + ", " + formatMmComma(maxL) + ") mm";
      g.appendChild(cornerMmLabel);
    }

    var cycleType = input.cycleType;

    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i], b = points[i + 1];
      var color = pointColor(cycleType, i + 1);
      g.appendChild(svgEl("line", {
        x1: xOf(a.travel), y1: yOf(a.lift), x2: xOf(b.travel), y2: yOf(b.lift),
        stroke: color, "stroke-width": 2.5,
        "marker-end": "url(#arrow-" + (color === "#d2691e" ? "orange" : "blue") + ")"
      }));
    }

    points.forEach(function (p, idx) {
      var color = pointColor(cycleType, idx);
      var isStation = p.name.indexOf("Station") !== -1;
      var cx = xOf(p.travel), cy = yOf(p.lift);

      if (isStation) {
        var w = 92, h = 26;
        g.appendChild(svgEl("rect", { x: cx - w / 2, y: cy - h / 2, width: w, height: h, fill: color, stroke: "#1f2430", "stroke-width": 1, rx: 3 }));
        var st = svgEl("text", { x: cx, y: cy + 4, "text-anchor": "middle", fill: "#fff", "font-size": 12, "font-weight": "600" });
        st.textContent = p.name;
        g.appendChild(st);
      } else {
        g.appendChild(svgEl("circle", { cx: cx, cy: cy, r: 14, fill: color, stroke: "#1f2430", "stroke-width": 1 }));
        var ct = svgEl("text", { x: cx, y: cy - 20, "text-anchor": "middle", "font-size": 12, "font-weight": "600", fill: "#1f2430" });
        ct.textContent = p.name;
        g.appendChild(ct);
      }

      var coordText = svgEl("text", { x: cx, y: cy + (isStation ? 22 : 30), "text-anchor": "middle", "font-size": 10, fill: "#6b7280" });
      coordText.textContent = formatCoordLabel(input.distanceMethod, p);
      g.appendChild(coordText);

      // 기존 %/Bay,Level 라벨은 그대로 두고, 그 아래에 실제 mm 위치를 추가로 표시한다.
      var mmText = svgEl("text", { x: cx, y: cy + (isStation ? 35 : 43), "text-anchor": "middle", "font-size": 11, "font-weight": "600", fill: "#222" });
      mmText.textContent = formatMmLabel(p);
      g.appendChild(mmText);
    });
  }

  // Cycle 유형 변경 시 단일 구간 입력을 Dual Cycle 위치에서 가져온다.
  // 입고 = Dual 1구간(입고 Station→입고 Rack), 출고 = Dual 3구간(출고 Rack→출고 Station)
  function syncSingleFromDual() {
    var ct = $("cycleType").value;
    if (ct === "Dual Cycle") return;
    var inbound = ct === "입고";

    $("rs_startTravelPercent").value = inbound ? $("rs_inStationTravelPercent").value : $("rs_outRackTravelPercent").value;
    $("rs_startLiftPercent").value = inbound ? $("rs_inStationLiftPercent").value : $("rs_outRackLiftPercent").value;
    $("rs_endTravelPercent").value = inbound ? $("rs_inRackTravelPercent").value : $("rs_outStationTravelPercent").value;
    $("rs_endLiftPercent").value = inbound ? $("rs_inRackLiftPercent").value : $("rs_outStationLiftPercent").value;

    $("bl_startBay").value = inbound ? $("bl_inStationBay").value : $("bl_outRackBay").value;
    $("bl_startLevel").value = inbound ? $("bl_inStationLevel").value : $("bl_outRackLevel").value;
    $("bl_endBay").value = inbound ? $("bl_inRackBay").value : $("bl_outStationBay").value;
    $("bl_endLevel").value = inbound ? $("bl_inRackLevel").value : $("bl_outStationLevel").value;
  }

  // ---- 동적 UI 처리 ----
  function updateDynamicVisibility() {
    var cycleType = $("cycleType").value;
    var distanceMethod = $("distanceMethod").value;
    var isDual = cycleType === "Dual Cycle";

    $("rackSizeSection").classList.toggle("hidden", distanceMethod !== "Rack Size");
    $("bayLevelSection").classList.toggle("hidden", distanceMethod !== "Bay/Level Pitch");

    $("rsSingleBlock").classList.toggle("hidden", isDual);
    $("rsDualBlock").classList.toggle("hidden", !isDual);
    $("blSingleBlock").classList.toggle("hidden", isDual);
    $("blDualBlock").classList.toggle("hidden", !isDual);

    var hint = cycleType === "출고"
      ? "출발 위치 = 보관 Rack(CELL 2), 도착 위치 = 출고 Station — Cycle 유형 변경 시 Dual Cycle의 출고 Rack→출고 Station 위치가 자동 반영됩니다."
      : "출발 위치 = 입고 Station, 도착 위치 = 보관 Rack(CELL 1) — Cycle 유형 변경 시 Dual Cycle의 입고 Station→입고 Rack 위치가 자동 반영됩니다.";
    $("rsSingleHint").textContent = hint;
    $("blSingleHint").textContent = hint;
  }

  // ---- 오류/상태 메시지 ----
  function showErrors(errors) {
    var box = $("errorBox");
    var list = $("errorList");
    list.innerHTML = "";
    errors.forEach(function (msg) {
      var li = document.createElement("li");
      li.textContent = msg;
      list.appendChild(li);
    });
    box.classList.remove("hidden");
  }

  function clearErrors() {
    $("errorBox").classList.add("hidden");
    $("errorList").innerHTML = "";
  }

  var statusTimer = null;
  function showStatus(message, isError) {
    var box = $("statusBox");
    box.textContent = message;
    box.classList.remove("hidden");
    box.classList.toggle("status-box--error", !!isError);
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { box.classList.add("hidden"); }, 4000);
  }

  // ---- 결과 표시 ----
  function displayResult(result) {
    var s = result.summary;
    var c = result.additionalCounts;

    $("totalCycleTimeValue").textContent = fmtSec(s.totalCycleTime);

    var rows = [
      ["Cycle 유형", s.cycleType],
      ["거리 계산 방식", s.distanceMethod],
      ["총 주행 거리 [mm]", fmt(s.totalTravelDistance)],
      ["총 승강 거리 [mm]", fmt(s.totalLiftDistance)],
      ["총 주행 시간 [sec]", fmtSec(s.totalTravelTime)],
      ["총 승강 시간 [sec]", fmtSec(s.totalLiftTime)],
      ["총 이동 시간 [sec]", fmtSec(s.totalMovementTime)],
      ["포크 동작 시간 [sec] (" + c.forkPositions + "개 위치)", fmtSec(s.forkOperationTime)],
      ["Load/Unload 시간 [sec] (Load " + c.loadCount + "회 / Unload " + c.unloadCount + "회)", fmtSec(s.loadUnloadTime)],
      ["위치 결정 시간 합계 [sec] (" + c.positioningCount + "회)", fmtSec(s.positioningTimeTotal)],
      ["통신 또는 센서 확인 시간 합계 [sec] (" + c.communicationCount + "회)", fmtSec(s.communicationTimeTotal)],
      ["여유 시간 [sec]", fmtSec(s.marginTime)],
      ["총 Cycle Time [sec]", fmtSec(s.totalCycleTime)]
    ];

    var tbody = $("summaryTableBody");
    tbody.innerHTML = "";
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      var td1 = document.createElement("td");
      td1.textContent = r[0];
      var td2 = document.createElement("td");
      td2.textContent = r[1];
      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
    });

    var segBody = $("segmentTableBody");
    segBody.innerHTML = "";
    result.segments.forEach(function (seg) {
      var tr = document.createElement("tr");
      [seg.name, seg.startName, seg.endName,
        fmt(seg.travelDistance), fmt(seg.liftDistance),
        fmtSec(seg.travelTime), fmtSec(seg.liftTime), fmtSec(seg.movementTime)
      ].forEach(function (val) {
        var td = document.createElement("td");
        td.textContent = val;
        tr.appendChild(td);
      });
      segBody.appendChild(tr);
    });
  }

  var lastResult = null;

  function handleCalculate() {
    clearErrors();
    var input = collectInputData();
    var result = window.SC_Calc.Calculator.calculateCycle(input);
    if (!result.valid) {
      showErrors(result.errors);
      lastResult = null;
      return;
    }
    lastResult = result;
    displayResult(result);
  }

  function handleExportExcel() {
    if (!lastResult) {
      showStatus("먼저 계산을 실행하세요.", true);
      return;
    }
    window.SC_Calc.ExcelExporter.exportResultToExcel(lastResult).then(function () {
      showStatus("Excel 파일이 저장되었습니다.", false);
    }).catch(function (err) {
      showStatus(err.message, true);
    });
  }

  function handleSaveConfig() {
    window.SC_Calc.Storage.save(collectInputData());
    showStatus("설정이 저장되었습니다.", false);
  }

  function handleLoadConfig() {
    var cfg = window.SC_Calc.Storage.load();
    if (!cfg) {
      showStatus("저장된 설정이 없습니다.", true);
      return;
    }
    populateInputData(cfg);
    showStatus("저장된 설정을 불러왔습니다.", false);
  }

  function handleResetConfig() {
    if (!confirm("입력값을 기본값으로 초기화합니다. 저장된 LocalStorage 설정도 삭제할까요?\n(취소를 누르면 화면 값만 초기화됩니다.)")) {
      populateInputData(window.SC_Calc.DEFAULT_CONFIG);
      showStatus("화면 입력값을 기본값으로 초기화했습니다.", false);
      return;
    }
    window.SC_Calc.Storage.clear();
    populateInputData(window.SC_Calc.DEFAULT_CONFIG);
    showStatus("기본값으로 초기화하고 저장된 설정을 삭제했습니다.", false);
  }

  function handleExportJSON() {
    window.SC_Calc.Storage.downloadJSON(collectInputData());
    showStatus("설정 JSON 파일을 내보냈습니다.", false);
  }

  function handleImportJSONChange(evt) {
    var file = evt.target.files[0];
    if (!file) return;
    window.SC_Calc.Storage.importJSONFile(file, function (err, cfg) {
      if (err) {
        showStatus(err.message, true);
        return;
      }
      if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) {
        showStatus("JSON 파일 형식이 올바르지 않습니다. SC_Calc 설정 파일인지 확인하세요.", true);
        return;
      }
      populateInputData(window.SC_Calc.Util.mergeConfig(window.SC_Calc.DEFAULT_CONFIG, cfg));
      showStatus("설정 JSON 파일을 불러왔습니다.", false);
    });
    evt.target.value = "";
  }

  function bindEvents() {
    $("btnCalculate").addEventListener("click", handleCalculate);
    $("btnExportExcel").addEventListener("click", handleExportExcel);
    $("btnSaveConfig").addEventListener("click", handleSaveConfig);
    $("btnLoadConfig").addEventListener("click", handleLoadConfig);
    $("btnResetConfig").addEventListener("click", handleResetConfig);
    $("btnExportJSON").addEventListener("click", handleExportJSON);
    $("btnImportJSONTrigger").addEventListener("click", function () { $("btnImportJSON").click(); });
    $("btnImportJSON").addEventListener("change", handleImportJSONChange);
    $("cycleType").addEventListener("change", function () {
      syncSingleFromDual();
      updateDynamicVisibility();
    });
    $("distanceMethod").addEventListener("change", updateDynamicVisibility);

    var panel = document.querySelector(".input-panel");
    panel.addEventListener("input", renderDiagram);
    panel.addEventListener("change", renderDiagram);
  }

  window.SC_Calc.UI = {
    collectInputData: collectInputData,
    populateInputData: populateInputData,
    updateDynamicVisibility: updateDynamicVisibility,
    renderDiagram: renderDiagram,
    bindEvents: bindEvents,
    showStatus: showStatus,
    // 축별 속도사양 탭(axis-ui.js)이 "Cycle Time에 적용" 후 기존 계산 로직을 그대로 재사용하기 위한 진입점.
    calculate: handleCalculate
  };
})();
