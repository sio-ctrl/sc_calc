/* SC_Calc 축별 속도사양 탭 UI: 주행축/승강축/Fork축/전체 시각화.
   기존 Cycle Time 기능(index.html의 tabPanel-cycle, calculator.js, ui.js)은 건드리지 않고
   window.SC_Calc.Calculator / window.SC_Calc.UI의 기존 함수를 재사용해서 확장한다.
   (섹션 1.2 최소 수정 원칙, 섹션 1.3 계산 책임 구분) */
window.SC_Calc = window.SC_Calc || {};

(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var AP; // AxisProfile - DOMContentLoaded 이후 바인딩

  var PROFILE_LABELS = { trapezoid: "사다리꼴", boundary: "경계 프로파일", triangle: "삼각형" };
  var PROFILE_STATUS_LABELS = {
    trapezoid: "목표 최고속도 도달 및 등속 운전 가능",
    boundary: "목표 최고속도 순간 도달, 등속 운전 불가",
    triangle: "목표 최고속도 도달 실패"
  };

  // 축 탭 <-> 기존 메인 Cycle Time 입력 필드의 연결 지점.
  // travel/lift는 "속도 사양"(equipment.*MaxSpeed/*Accel/*Decel)을 적용하고,
  // fork는 기존에 스트로크/속도 개념이 없고 forkOutTime/forkInTime(sec/회) 고정값만 있으므로
  // 계산된 편도 운전시간을 그 두 필드에 직접 적용한다 (섹션 13.1, 미확정 사항 F 참고).
  var AXIS_CONFIG = {
    travel: {
      prefix: "axis_travel", label: "주행축", color: "#1f5fb0", applyType: "speedSpec", strokeLabel: "주행거리",
      mainMaxSpeedId: "travelMaxSpeed", mainAccelId: "travelAccel", mainDecelId: "travelDecel",
      mainTimeSummaryKey: "totalTravelTime", mainTimeLabel: "주행시간"
    },
    lift: {
      prefix: "axis_lift", label: "승강축", color: "#2f7d5c", applyType: "speedSpec", strokeLabel: "승강거리",
      mainMaxSpeedId: "liftMaxSpeed", mainAccelId: "liftAccel", mainDecelId: "liftDecel",
      mainTimeSummaryKey: "totalLiftTime", mainTimeLabel: "승강시간"
    },
    fork: {
      prefix: "axis_fork", label: "Fork축", color: "#b5651d", applyType: "time", strokeLabel: "스트로크",
      mainOutTimeId: "forkOutTime", mainInTimeId: "forkInTime",
      mainTimeSummaryKey: "forkOperationTime", mainTimeLabel: "Fork 시간(합계)"
    }
  };

  // 계산 결과/적용 상태는 페이지 메모리에서만 유지한다(탭 전환 시 보존, 새로고침 시 초기화).
  // 축 탭의 원시 입력값(스트로크/목표속도/가속도/감속도)만 "Cycle Time에 적용" 시점에
  // Storage.saveAxisSettings로 LocalStorage에 별도 저장되어 새로고침 후에도 복원된다.
  var axisState = {
    travel: { result: null, appliedSnapshot: null },
    lift: { result: null, appliedSnapshot: null },
    fork: { result: null, appliedSnapshot: null }
  };

  // ---- 포맷 (내부값은 반올림하지 않고, 표시 시점에만 반올림) ----
  // 초(sec)는 소수점 1자리로 표시한다 (전체 화면 공통 규칙).
  function fmtTime(s) { return (typeof s === "number" && isFinite(s)) ? window.SC_Calc.Util.round1(s).toFixed(1) : "-"; }
  function fmtDistMm(mm) { return (typeof mm === "number" && isFinite(mm)) ? mm.toFixed(1) : "-"; }
  function fmtSpeedMin(v) { return (typeof v === "number" && isFinite(v)) ? v.toFixed(1) : "-"; }
  function fmtSpeedS(v) { return (typeof v === "number" && isFinite(v)) ? v.toFixed(4) : "-"; }
  function fmtAccel(v) { return (typeof v === "number" && isFinite(v)) ? v.toFixed(4) : "-"; }

  function svgEl(tag, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function fillTable(tbodyEl, rows) {
    tbodyEl.innerHTML = ""; // 표를 비우는 용도일 뿐 사용자 입력을 그대로 출력하지 않음 (섹션 21.3)
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      r.forEach(function (val) {
        var td = document.createElement("td");
        td.textContent = val; // 항상 textContent만 사용
        tr.appendChild(td);
      });
      tbodyEl.appendChild(tr);
    });
  }

  function emptyRow(tbodyEl, colspan, message) {
    tbodyEl.innerHTML = "";
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = colspan;
    td.className = "empty-row";
    td.textContent = message;
    tr.appendChild(td);
    tbodyEl.appendChild(tr);
  }

  // ---- 축 입력 읽기/쓰기 (섹션 17: scReadAxisInputs) ----
  function scReadAxisInputs(axisType) {
    var p = AXIS_CONFIG[axisType].prefix;
    function num(suffix) {
      var v = $(p + "_" + suffix).value;
      if (v === "" || v === null || v === undefined) return NaN;
      return Number(v);
    }
    return {
      strokeMm: num("strokeMm"),
      targetSpeedMPerMin: num("targetSpeedMPerMin"),
      accelerationMmS2: num("accelerationMmS2"),
      decelerationMmS2: num("decelerationMmS2")
    };
  }

  function scWriteAxisInputs(axisType, values) {
    var p = AXIS_CONFIG[axisType].prefix;
    $(p + "_strokeMm").value = values.strokeMm;
    $(p + "_targetSpeedMPerMin").value = values.targetSpeedMPerMin;
    $(p + "_accelerationMmS2").value = values.accelerationMmS2;
    $(p + "_decelerationMmS2").value = values.decelerationMmS2;
    // mm/s² 값 기준으로 sec(목표 최고속도 도달시간) 동반 필드도 함께 채운다.
    refreshAccelSecField(axisType, "acceleration");
    refreshAccelSecField(axisType, "deceleration");
  }

  // ---- 가속도/감속도 mm/s² ↔ sec 단위 동기화 ----
  // 저장/계산에 쓰이는 값(scReadAxisInputs)은 항상 accelerationMmS2/decelerationMmS2이며,
  // sec 필드는 그것과 서로 변환되어 보여지는 화면 전용 보조 입력이다. sec(목표 최고속도
  // 도달 시간)는 목표 최고속도(V)에도 의존하므로, V가 바뀌면 sec만 다시 계산한다.
  function accelUnitFields(axisType, kind) {
    var p = AXIS_CONFIG[axisType].prefix;
    return { mmS2: $(p + "_" + kind + "MmS2"), sec: $(p + "_" + kind + "Sec") };
  }

  function currentTargetSpeedMPerS(axisType) {
    var v = Number($(AXIS_CONFIG[axisType].prefix + "_targetSpeedMPerMin").value);
    return isFinite(v) ? v / 60 : NaN;
  }

  // mm/s² 값을 기준으로 sec를 다시 계산해서 채운다.
  function refreshAccelSecField(axisType, kind) {
    var fields = accelUnitFields(axisType, kind);
    var aSI = Number(fields.mmS2.value) / 1000; // m/s^2
    if (!isFinite(aSI)) return;
    var V = currentTargetSpeedMPerS(axisType);
    if (isFinite(V) && V > 0 && aSI > 0) {
      fields.sec.value = window.SC_Calc.Util.round1(V / aSI);
    }
  }

  function scSyncAccelFromMmS2(axisType, kind) {
    refreshAccelSecField(axisType, kind);
  }

  function scSyncAccelFromSec(axisType, kind) {
    var fields = accelUnitFields(axisType, kind);
    var sec = Number(fields.sec.value);
    var V = currentTargetSpeedMPerS(axisType);
    if (!isFinite(sec) || sec <= 0 || !isFinite(V) || V <= 0) return;
    var aSI = V / sec; // m/s^2
    fields.mmS2.value = window.SC_Calc.Util.round1(aSI * 1000);
  }

  // 목표 최고속도가 바뀌면 가속도/감속도의 sec(도달시간)만 다시 계산한다 (mm/s²는 그대로 유지).
  function scRefreshAccelSecOnSpeedChange(axisType) {
    refreshAccelSecField(axisType, "acceleration");
    refreshAccelSecField(axisType, "deceleration");
  }

  // ---- 오류 표시 (섹션 19: 입력 필드 가까이에 한국어 문장으로) ----
  function showAxisErrors(axisType, errors) {
    var box = $(AXIS_CONFIG[axisType].prefix + "_errors");
    var ul = box.querySelector("ul");
    ul.innerHTML = "";
    errors.forEach(function (msg) {
      var li = document.createElement("li");
      li.textContent = msg;
      ul.appendChild(li);
    });
    box.classList.remove("hidden");
  }

  function clearAxisErrors(axisType) {
    var box = $(AXIS_CONFIG[axisType].prefix + "_errors");
    box.classList.add("hidden");
    box.querySelector("ul").innerHTML = "";
  }

  function focusFirstInvalidAxisField(axisType, inputs) {
    var order = ["strokeMm", "targetSpeedMPerMin", "accelerationMmS2", "decelerationMmS2"];
    for (var i = 0; i < order.length; i++) {
      var v = inputs[order[i]];
      if (typeof v !== "number" || isNaN(v) || !isFinite(v) || v <= 0) {
        $(AXIS_CONFIG[axisType].prefix + "_" + order[i]).focus();
        return;
      }
    }
  }

  // ---- 축별 요약(10.1) ----
  function scRenderAxisSummary(axisType, result) {
    var el = $(AXIS_CONFIG[axisType].prefix + "_summary");
    el.innerHTML = "";
    var items = [
      ["프로파일 종류", PROFILE_LABELS[result.profileType]],
      ["도달 상태", PROFILE_STATUS_LABELS[result.profileType]],
      ["목표 최고속도", fmtSpeedMin(result.targetSpeedMPerMin) + " m/min"],
      ["실제 최고속도", fmtSpeedMin(result.Vpeak * 60) + " m/min"],
      ["편도 운전시간", fmtTime(result.Ttotal) + " s"]
    ];
    items.forEach(function (pair) {
      var div = document.createElement("div");
      div.className = "axis-summary__item";
      var lab = document.createElement("span");
      lab.className = "axis-summary__label";
      lab.textContent = pair[0];
      var val = document.createElement("span");
      val.className = "axis-summary__value";
      val.textContent = pair[1];
      div.appendChild(lab);
      div.appendChild(val);
      el.appendChild(div);
    });
  }

  // ---- 축별 시간/거리 결과 + 절점표 (10.2, 10.3, 11) ----
  function scRenderAxisTable(axisType, result) {
    var cfg = AXIS_CONFIG[axisType];
    var p = cfg.prefix;
    var detailRows = [
      ["가속시간 (Ta)", fmtTime(result.Ta) + " s"],
      ["등속시간 (Tc)", fmtTime(result.Tc) + " s"],
      ["감속시간 (Td)", fmtTime(result.Td) + " s"],
      ["편도 운전시간", fmtTime(result.Ttotal) + " s"],
      ["입력 " + cfg.strokeLabel, fmtDistMm(result.axisInputs.strokeMm) + " mm"],
      ["최고속도 도달거리", fmtDistMm(result.Sa * 1000) + " mm"],
      ["목표속도 운전 최소 " + cfg.strokeLabel, fmtDistMm(result.Srequired * 1000) + " mm"],
      ["가속거리 (Sa)", fmtDistMm(result.Sa * 1000) + " mm"],
      ["등속거리 (Sc)", fmtDistMm(result.Sc * 1000) + " mm"],
      ["감속거리 (Sd)", fmtDistMm(result.Sd * 1000) + " mm"],
      ["감속 시작 위치", fmtDistMm(result.decelStartPos * 1000) + " mm"],
      ["최종 위치", fmtDistMm(result.S * 1000) + " mm"],
      ["환산 목표속도 (V)", fmtSpeedS(result.si.V) + " m/s"],
      ["환산 가속도 (a)", fmtAccel(result.si.a) + " m/s²"],
      ["환산 감속도 (d)", fmtAccel(result.si.d) + " m/s²"]
    ];
    fillTable($(p + "_detailTable").querySelector("tbody"), detailRows);

    var pts = AP.scBuildProfilePoints(result);
    var nodeRows = pts.map(function (pt) {
      return [pt.label, fmtTime(pt.t), fmtSpeedMin(pt.v * 60), fmtDistMm(pt.s * 1000)];
    });
    fillTable($(p + "_nodeTable").querySelector("tbody"), nodeRows);
  }

  // ---- 축별 속도-시간(V-T) 그래프 (섹션 12) ----
  function scRenderAxisChart(axisType, result) {
    var svg = $(AXIS_CONFIG[axisType].prefix + "_chart");
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var W = 640, H = 260;
    var left = 60, right = 18, top = 40, bottom = 56;
    var plotW = W - left - right, plotH = H - top - bottom;
    var color = AXIS_CONFIG[axisType].color;

    var pts = AP.scBuildProfilePoints(result); // t(s), v(m/s), s(m)
    var maxT = result.Ttotal > 0 ? result.Ttotal : 1;
    var maxVmin = Math.max(result.targetSpeedMPerMin, result.Vpeak * 60, 1);

    function xOf(t) { return left + (t / maxT) * plotW; }
    function yOf(vMin) { return top + plotH - (vMin / maxVmin) * plotH; }

    // 제목/설명
    var title = svgEl("text", { x: W / 2, y: 16, "text-anchor": "middle", "font-size": 13, "font-weight": "700", fill: "#1f2430" });
    title.textContent = AXIS_CONFIG[axisType].label + " 속도-시간(V-T) 그래프";
    svg.appendChild(title);
    var subtitle = svgEl("text", { x: W / 2, y: 31, "text-anchor": "middle", "font-size": 11, fill: "#6b7280" });
    subtitle.textContent = PROFILE_LABELS[result.profileType] + " · 실제 최고속도 " + fmtSpeedMin(result.Vpeak * 60) + " m/min · 편도 " + fmtTime(result.Ttotal) + "s";
    svg.appendChild(subtitle);

    // 축
    svg.appendChild(svgEl("line", { x1: left, y1: top, x2: left, y2: top + plotH, stroke: "#1f2430", "stroke-width": 1.2 }));
    svg.appendChild(svgEl("line", { x1: left, y1: top + plotH, x2: left + plotW, y2: top + plotH, stroke: "#1f2430", "stroke-width": 1.2 }));

    // Y축 눈금 (최대 5개, "최대 7개" 제한 내)
    var yTickCount = 4;
    for (var i = 0; i <= yTickCount; i++) {
      var vTick = (maxVmin * i) / yTickCount;
      var yy = yOf(vTick);
      if (i > 0) svg.appendChild(svgEl("line", { x1: left, y1: yy, x2: left + plotW, y2: yy, stroke: "#eceff2", "stroke-width": 1 }));
      var yLabel = svgEl("text", { x: left - 6, y: yy + 3, "text-anchor": "end", "font-size": 9, fill: "#6b7280" });
      yLabel.textContent = vTick.toFixed(0);
      svg.appendChild(yLabel);
    }
    var yAxisTitle = svgEl("text", { x: 12, y: top - 8, "font-size": 10, fill: "#6b7280" });
    yAxisTitle.textContent = "속도[m/min]";
    svg.appendChild(yAxisTitle);

    // 목표 최고속도 기준선
    var yTarget = yOf(result.targetSpeedMPerMin);
    svg.appendChild(svgEl("line", { x1: left, y1: yTarget, x2: left + plotW, y2: yTarget, stroke: "#b0301f", "stroke-width": 1, "stroke-dasharray": "4,3" }));
    var targetLabel = svgEl("text", { x: left + plotW, y: yTarget - 4, "text-anchor": "end", "font-size": 9, fill: "#b0301f" });
    targetLabel.textContent = "목표 " + fmtSpeedMin(result.targetSpeedMPerMin) + " m/min";
    svg.appendChild(targetLabel);

    // X축 눈금 = 절점 시간(최대 4개, "최대 8개" 제한 내)
    pts.forEach(function (pt) {
      var xx = xOf(pt.t);
      svg.appendChild(svgEl("line", { x1: xx, y1: top + plotH, x2: xx, y2: top + plotH + 4, stroke: "#1f2430", "stroke-width": 1 }));
      var xLabel = svgEl("text", { x: xx, y: top + plotH + 15, "text-anchor": "middle", "font-size": 9, fill: "#6b7280" });
      xLabel.textContent = fmtTime(pt.t) + "s";
      svg.appendChild(xLabel);
    });
    var xAxisTitle = svgEl("text", { x: left + plotW, y: top + plotH + 30, "text-anchor": "end", "font-size": 10, fill: "#6b7280" });
    xAxisTitle.textContent = "시간[sec]";
    svg.appendChild(xAxisTitle);

    // 구간명 라벨 (가속/등속/감속)
    for (var s = 0; s < pts.length - 1; s++) {
      var segLabel = s === 0 ? "가속" : (pts.length === 4 && s === 1 ? "등속" : "감속");
      var midT = (pts[s].t + pts[s + 1].t) / 2;
      var segText = svgEl("text", { x: xOf(midT), y: top + plotH + 42, "text-anchor": "middle", "font-size": 10, "font-weight": "600", fill: color });
      segText.textContent = segLabel;
      svg.appendChild(segText);
    }

    // 실제 속도 프로파일 라인
    var lineStr = pts.map(function (pt) { return xOf(pt.t) + "," + yOf(pt.v * 60); }).join(" ");
    svg.appendChild(svgEl("polyline", { points: lineStr, fill: "none", stroke: color, "stroke-width": 2.5 }));

    // 절점 마커 + 누적거리 라벨
    pts.forEach(function (pt, idx) {
      var cx = xOf(pt.t), cy = yOf(pt.v * 60);
      svg.appendChild(svgEl("circle", { cx: cx, cy: cy, r: 4, fill: color, stroke: "#1f2430", "stroke-width": 1 }));
      var above = idx % 2 === 0;
      var distText = svgEl("text", {
        x: cx, y: above ? cy - 10 : cy + 16, "text-anchor": idx === 0 ? "start" : (idx === pts.length - 1 ? "end" : "middle"),
        "font-size": 9, fill: "#1f2430"
      });
      distText.textContent = fmtDistMm(pt.s * 1000) + "mm";
      svg.appendChild(distText);
    });
  }

  // ---- 기존 Cycle Time과의 비교 미리보기 (섹션 13.3) ----
  // calculateCycle은 순수 함수이므로 DOM을 바꾸지 않고 "적용 시 예상값"을 미리 계산할 수 있다.
  function computeMainPreview(axisType, result) {
    var UI = window.SC_Calc.UI, Calculator = window.SC_Calc.Calculator;
    var current = UI.collectInputData();
    var preview = JSON.parse(JSON.stringify(current));
    var cfg = AXIS_CONFIG[axisType];
    if (cfg.applyType === "speedSpec") {
      // 실제 적용 시(scApplyAxisResultToCycle)와 동일하게 속도(mm/s)·가속도·감속도(mm/s²)를
      // 소수점 1자리로 반올림해서 미리보기한다.
      preview.equipment[cfg.mainMaxSpeedId] = window.SC_Calc.Util.round1(result.si.V * 1000);
      preview.equipment[cfg.mainAccelId] = window.SC_Calc.Util.round1(result.si.a * 1000);
      preview.equipment[cfg.mainDecelId] = window.SC_Calc.Util.round1(result.si.d * 1000);
    } else {
      // 부가 시간(sec/회)도 실제 적용 시와 동일하게 소수점 1자리로 반올림해서 미리보기한다.
      var roundedTime = window.SC_Calc.Util.round1(result.Ttotal);
      preview.additionalTime[cfg.mainOutTimeId] = roundedTime;
      preview.additionalTime[cfg.mainInTimeId] = roundedTime;
    }
    return {
      existingResult: Calculator.calculateCycle(current),
      previewResult: Calculator.calculateCycle(preview)
    };
  }

  function diffStr(before, after) {
    if (typeof before !== "number" || typeof after !== "number") return "-";
    var d = after - before;
    var sign = d > 0 ? "+" : "";
    return sign + fmtTime(d) + " s";
  }

  function renderAxisCompare(axisType) {
    var st = axisState[axisType];
    var cfg = AXIS_CONFIG[axisType];
    var tbody = $(cfg.prefix + "_compareTable").querySelector("tbody");
    if (!st.result) {
      emptyRow(tbody, 4, "먼저 [축 계산]을 실행하세요.");
      return;
    }
    var cmp = computeMainPreview(axisType, st.result);
    var ex = cmp.existingResult.valid ? cmp.existingResult.summary : null;
    var nw = cmp.previewResult.valid ? cmp.previewResult.summary : null;

    var rows = [
      [cfg.mainTimeLabel, ex ? fmtTime(ex[cfg.mainTimeSummaryKey]) + " s" : "-", nw ? fmtTime(nw[cfg.mainTimeSummaryKey]) + " s" : "-", (ex && nw) ? diffStr(ex[cfg.mainTimeSummaryKey], nw[cfg.mainTimeSummaryKey]) : "-"],
      ["전체 Cycle Time", ex ? fmtTime(ex.totalCycleTime) + " s" : "-", nw ? fmtTime(nw.totalCycleTime) + " s" : "-", (ex && nw) ? diffStr(ex.totalCycleTime, nw.totalCycleTime) : "-"]
    ];
    fillTable(tbody, rows);
    if (!cmp.existingResult.valid) {
      var note = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 4; td.className = "empty-row";
      td.textContent = "메인 Cycle Time 입력값에 오류가 있어 '기존값'을 계산할 수 없습니다 (Cycle Time 탭 확인).";
      note.appendChild(td);
      tbody.appendChild(note);
    }
  }

  function renderAxisApplyStatus(axisType) {
    var st = axisState[axisType];
    var badge = $(AXIS_CONFIG[axisType].prefix + "_applyStatus");
    if (!st.appliedSnapshot) {
      badge.textContent = "미적용";
      badge.className = "sc-badge sc-badge--muted";
      return;
    }
    var current = scReadAxisInputs(axisType);
    var same = JSON.stringify(current) === JSON.stringify(st.appliedSnapshot);
    if (same) {
      badge.textContent = "적용됨";
      badge.className = "sc-badge sc-badge--applied";
    } else {
      badge.textContent = "설정 변경됨 / Cycle Time 재적용 필요";
      badge.className = "sc-badge sc-badge--stale";
    }
  }

  // ---- 버튼 핸들러 ----
  function scCalculateAxis(axisType) {
    clearAxisErrors(axisType);
    var inputs = scReadAxisInputs(axisType);
    var result = AP.scCalculateSpeedProfile(inputs);
    if (!result.valid) {
      // 섹션19: 오류 시 해당 축 결과를 갱신하지 않는다 (이전 정상 결과를 화면에 유지).
      showAxisErrors(axisType, result.errors);
      focusFirstInvalidAxisField(axisType, inputs);
      return;
    }
    var integrity = AP.scValidateProfileResult(result);
    if (!integrity.valid) {
      showAxisErrors(axisType, integrity.errors);
      return;
    }
    axisState[axisType].result = result;
    scRenderAxisSummary(axisType, result);
    scRenderAxisTable(axisType, result);
    scRenderAxisChart(axisType, result);
    renderAxisCompare(axisType);
    renderAxisApplyStatus(axisType);
  }

  // 현재 축 계산 결과(입력·요약·V-T 그래프·절점·상세결과)를 화면과 같은 순서로 Excel 1개
  // 시트에 저장한다. Layout 다이어그램 Excel 저장(excel-layout-chart.js)과 동일한 방식으로
  // excel-axis-chart.js가 네이티브 차트를 만들고, excel-save.js가 저장 다이얼로그를 띄운다.
  function scExportAxisToExcel(axisType) {
    var st = axisState[axisType];
    if (!st.result) {
      window.SC_Calc.UI.showStatus(AXIS_CONFIG[axisType].label + " 계산을 먼저 실행하세요.", true);
      return;
    }
    if (!window.SC_Calc.ExcelAxisChart) {
      window.SC_Calc.UI.showStatus("Excel 저장 기능을 불러오지 못했습니다.", true);
      return;
    }
    var cfg = AXIS_CONFIG[axisType];
    window.SC_Calc.ExcelAxisChart.exportAxisToExcel({
      sheetName: cfg.label,
      label: cfg.label,
      color: cfg.color.replace("#", "").toUpperCase(),
      strokeLabel: cfg.strokeLabel,
      axisInputs: scReadAxisInputs(axisType),
      result: st.result
    }).then(function () {
      window.SC_Calc.UI.showStatus(cfg.label + " 계산 결과를 Excel로 저장했습니다.", false);
    }).catch(function (e) {
      window.SC_Calc.UI.showStatus(e.message, true);
    });
  }

  // 섹션 13.1~13.2: 검증된 결과만 적용, 자동 적용 금지 (버튼을 눌러야만 반영)
  function scApplyAxisResultToCycle(axisType) {
    var st = axisState[axisType];
    if (!st.result) {
      window.SC_Calc.UI.showStatus(AXIS_CONFIG[axisType].label + " 계산을 먼저 실행하세요.", true);
      return;
    }
    var cfg = AXIS_CONFIG[axisType];

    // Cycle Time의 DEFAULT_CONFIG 자체를 갱신해서, 이후 "기본값 초기화"를 눌러도
    // 지금 적용한 축 계산값이 초기값으로 유지되도록 한다 (주행축/승강축/Fork축 공통 로직).
    if (cfg.applyType === "speedSpec") {
      // 속도(mm/s)·가속도·감속도(mm/s²) 모두 소수점 1자리까지만 적용한다.
      var roundedSpeed = window.SC_Calc.Util.round1(st.result.si.V * 1000);
      var roundedAccel = window.SC_Calc.Util.round1(st.result.si.a * 1000);
      var roundedDecel = window.SC_Calc.Util.round1(st.result.si.d * 1000);
      $(cfg.mainMaxSpeedId).value = roundedSpeed;
      $(cfg.mainAccelId).value = roundedAccel;
      $(cfg.mainDecelId).value = roundedDecel;
      window.SC_Calc.DEFAULT_CONFIG.equipment[cfg.mainMaxSpeedId] = roundedSpeed;
      window.SC_Calc.DEFAULT_CONFIG.equipment[cfg.mainAccelId] = roundedAccel;
      window.SC_Calc.DEFAULT_CONFIG.equipment[cfg.mainDecelId] = roundedDecel;
    } else {
      // 부가 시간(sec/회)은 소수점 1자리까지만 적용한다.
      var roundedTime = window.SC_Calc.Util.round1(st.result.Ttotal);
      $(cfg.mainOutTimeId).value = roundedTime;
      $(cfg.mainInTimeId).value = roundedTime;
      window.SC_Calc.DEFAULT_CONFIG.additionalTime[cfg.mainOutTimeId] = roundedTime;
      window.SC_Calc.DEFAULT_CONFIG.additionalTime[cfg.mainInTimeId] = roundedTime;
    }

    window.SC_Calc.UI.renderDiagram();
    scRecalculateExistingCycle();

    // 적용된 값을 기존 "설정 저장" 버튼과 동일한 방식으로 LocalStorage에 저장한다
    // (Storage.save를 그대로 재사용 - 저장 로직 중복 구현 금지).
    window.SC_Calc.Storage.save(window.SC_Calc.UI.collectInputData());

    // 축 탭에 입력한 스트로크/목표속도/가속도/감속도 자체도 저장해서,
    // 화면을 새로고침해도 이 탭이 마지막 입력값(최종값)으로 열리도록 한다.
    var currentAxisInputs = scReadAxisInputs(axisType);
    window.SC_Calc.Storage.saveAxisSettings(axisType, currentAxisInputs);

    st.appliedSnapshot = JSON.parse(JSON.stringify(currentAxisInputs));
    renderAxisApplyStatus(axisType);
    renderAxisCompare(axisType);

    window.SC_Calc.UI.showStatus(cfg.label + " 계산 결과를 Cycle Time에 적용하고 설정 저장·초기값으로 반영했습니다.", false);
  }

  // 기존 handleCalculate를 그대로 재사용 (계산 로직 중복 구현 금지)
  function scRecalculateExistingCycle() {
    window.SC_Calc.UI.calculate();
  }

  // 저장된 "마지막 적용값"이 있으면 그 값을, 없으면 원래 기본값을 반환한다.
  // (initAxisPanel과 scResetAxis가 동일한 규칙을 공유하기 위한 공통 헬퍼)
  function loadLastAppliedOrDefault(axisType) {
    var saved = window.SC_Calc.Storage.loadAxisSettings(axisType, AP.DEFAULT_AXIS_SETTINGS[axisType]);
    return { values: saved || AP.DEFAULT_AXIS_SETTINGS[axisType], fromSaved: !!saved };
  }

  // "현재 축 초기화": 마지막으로 "Cycle Time에 적용"한 값이 있으면 그 값으로 되돌리고,
  // 적용 이력이 없으면(한 번도 적용한 적 없음) 원래 기본값으로 되돌린다.
  function scResetAxis(axisType) {
    var loaded = loadLastAppliedOrDefault(axisType);
    scWriteAxisInputs(axisType, loaded.values);
    // 지금 화면에 채운 값 = 이미 적용되어 있는 값이므로 적용 상태 배지도 맞춰준다.
    axisState[axisType].appliedSnapshot = loaded.fromSaved ? JSON.parse(JSON.stringify(loaded.values)) : null;
    clearAxisErrors(axisType);
    axisState[axisType].result = null;
    $(AXIS_CONFIG[axisType].prefix + "_summary").innerHTML = "";
    emptyRow($(AXIS_CONFIG[axisType].prefix + "_detailTable").querySelector("tbody"), 2, "축 계산을 실행하세요.");
    emptyRow($(AXIS_CONFIG[axisType].prefix + "_nodeTable").querySelector("tbody"), 4, "축 계산을 실행하세요.");
    var svg = $(AXIS_CONFIG[axisType].prefix + "_chart");
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    renderAxisApplyStatus(axisType);
    renderAxisCompare(axisType);
    var msg = loaded.fromSaved
      ? AXIS_CONFIG[axisType].label + " 입력값을 마지막 적용값으로 되돌렸습니다."
      : AXIS_CONFIG[axisType].label + ": 적용 이력이 없어 기본값으로 초기화했습니다.";
    window.SC_Calc.UI.showStatus(msg, false);
  }

  function initAxisPanel(axisType) {
    // 이전에 "Cycle Time에 적용"으로 저장해 둔 값이 있으면 그 값으로, 없으면 기본값으로 시작한다.
    var loaded = loadLastAppliedOrDefault(axisType);
    scWriteAxisInputs(axisType, loaded.values);
    if (loaded.fromSaved) axisState[axisType].appliedSnapshot = JSON.parse(JSON.stringify(loaded.values));
    emptyRow($(AXIS_CONFIG[axisType].prefix + "_detailTable").querySelector("tbody"), 2, "축 계산을 실행하세요.");
    emptyRow($(AXIS_CONFIG[axisType].prefix + "_nodeTable").querySelector("tbody"), 4, "축 계산을 실행하세요.");
    renderAxisApplyStatus(axisType);
    renderAxisCompare(axisType);

    var p = AXIS_CONFIG[axisType].prefix;
    $(p + "_btnCalc").addEventListener("click", function () { scCalculateAxis(axisType); });
    $(p + "_btnApply").addEventListener("click", function () { scApplyAxisResultToCycle(axisType); });
    $(p + "_btnReset").addEventListener("click", function () { scResetAxis(axisType); });
    $(p + "_btnExportExcel").addEventListener("click", function () { scExportAxisToExcel(axisType); });

    // 목표 최고속도가 바뀌면 가속도/감속도의 sec(도달시간) 표시도 함께 갱신한다.
    $(p + "_targetSpeedMPerMin").addEventListener("input", function () {
      scRefreshAccelSecOnSpeedChange(axisType);
      renderAxisApplyStatus(axisType);
    });

    // 가속도/감속도: mm/s²·sec 중 어느 것을 수정해도 나머지 값이 자동으로 반영된다.
    ["acceleration", "deceleration"].forEach(function (kind) {
      $(p + "_" + kind + "MmS2").addEventListener("input", function () {
        scSyncAccelFromMmS2(axisType, kind);
        renderAxisApplyStatus(axisType);
      });
      $(p + "_" + kind + "Sec").addEventListener("input", function () {
        scSyncAccelFromSec(axisType, kind);
        renderAxisApplyStatus(axisType);
      });
    });

    // 입력값이 바뀌면(적용 후 변경 등) 상태 배지를 재평가한다. 자동으로 재계산하거나
    // Cycle Time에 반영하지는 않는다 (섹션 13.2 자동 적용 금지).
    $(p + "_strokeMm").addEventListener("input", function () { renderAxisApplyStatus(axisType); });
  }

  // ---- 전체 시각화 탭 (섹션 15) ----
  function computeSegmentAxisProfile(seg, axisKey, input) {
    var eq = input.equipment;
    var distMm = axisKey === "travel" ? seg.travelDistance : seg.liftDistance;
    var maxSpeedMmS = axisKey === "travel" ? eq.travelMaxSpeed : eq.liftMaxSpeed;
    var accelMmS2 = axisKey === "travel" ? eq.travelAccel : eq.liftAccel;
    var decelMmS2 = axisKey === "travel" ? eq.travelDecel : eq.liftDecel;
    if (!distMm || distMm <= 0) return null;
    var profile = AP.scCalculateSpeedProfile({
      strokeMm: distMm,
      targetSpeedMPerMin: (maxSpeedMmS * 60) / 1000,
      accelerationMmS2: accelMmS2,
      decelerationMmS2: decelMmS2
    });
    return profile.valid ? profile : null;
  }

  function renderOverviewCards(result) {
    var container = $("overview_cards");
    container.innerHTML = "";
    if (!result.valid) {
      var warn = document.createElement("p");
      warn.className = "field-note";
      warn.textContent = "메인 Cycle Time 입력값에 오류가 있어 계산할 수 없습니다. Cycle Time 탭에서 입력값을 확인하세요.";
      container.appendChild(warn);
      return;
    }
    var s = result.summary;
    var sequentialTime = s.totalCycleTime - s.totalMovementTime;
    var cards = [
      ["전체 Cycle Time", fmtTime(s.totalCycleTime) + " s"],
      ["주행축 운전시간(현재)", fmtTime(s.totalTravelTime) + " s"],
      ["승강축 운전시간(현재)", fmtTime(s.totalLiftTime) + " s"],
      ["Fork축 운전시간(현재)", fmtTime(s.forkOperationTime) + " s"],
      ["동시 운전 구간(이동)", fmtTime(s.totalMovementTime) + " s"],
      ["순차 운전 구간(부가)", fmtTime(sequentialTime) + " s"]
    ];
    cards.forEach(function (pair) {
      var div = document.createElement("div");
      div.className = "overview-card";
      var lab = document.createElement("span"); lab.className = "overview-card__label"; lab.textContent = pair[0];
      var val = document.createElement("span"); val.className = "overview-card__value"; val.textContent = pair[1];
      div.appendChild(lab); div.appendChild(val);
      container.appendChild(div);
    });
  }

  function renderOverviewAxisTable() {
    var tbody = $("overview_axisTable").querySelector("tbody");
    var rows = ["travel", "lift", "fork"].map(function (axisType) {
      var cfg = AXIS_CONFIG[axisType];
      var st = axisState[axisType];
      if (!st.result) {
        return [cfg.label, "-", "-", "-", "미계산", "-", "미적용"];
      }
      var r = st.result;
      var badge = $(cfg.prefix + "_applyStatus");
      return [
        cfg.label,
        fmtDistMm(r.axisInputs.strokeMm),
        fmtSpeedMin(r.targetSpeedMPerMin),
        fmtSpeedMin(r.Vpeak * 60),
        PROFILE_LABELS[r.profileType],
        fmtTime(r.Ttotal),
        badge ? badge.textContent : "미적용"
      ];
    });
    fillTable(tbody, rows);
  }

  // 섹션 14.4: 기존 계산식(합산)은 fork/load-unload/positioning/communication/margin의
  // "시간 순서"를 명시하지 않는다 (덧셈이라 순서 무관). 아래 순서는 화면 표시 순서(섹션 14.2/16 예시)를
  // 그대로 따른 것으로, 실제 제어 시퀀스와 다를 수 있다는 점을 타임라인 캡션에 명시한다.
  function buildCycleTimeline(result) {
    var input = result.input;
    var isDual = input.cycleType === "Dual Cycle";
    var lanes = { travel: [], lift: [], fork: [], extra: [] };
    var t = 0;

    result.segments.forEach(function (seg, idx) {
      var segStart = t;
      var travelProfile = computeSegmentAxisProfile(seg, "travel", input);
      var liftProfile = computeSegmentAxisProfile(seg, "lift", input);
      var segLabel = isDual ? seg.name : "이동";
      if (travelProfile) {
        lanes.travel.push({ label: segLabel + " 주행", start: segStart, profile: travelProfile });
      }
      if (liftProfile) {
        lanes.lift.push({ label: segLabel + " 승강", start: segStart, profile: liftProfile });
      }
      t += seg.movementTime;
    });

    var movementEnd = t;

    if (result.summary.forkOperationTime > 0) {
      lanes.fork.push({ label: "포크 동작(합계)", start: t, end: t + result.summary.forkOperationTime });
      t += result.summary.forkOperationTime;
    }

    [
      ["Load/Unload", result.summary.loadUnloadTime],
      ["위치 결정", result.summary.positioningTimeTotal],
      ["통신/센서 확인", result.summary.communicationTimeTotal],
      ["여유 시간", result.summary.marginTime]
    ].forEach(function (pair) {
      if (pair[1] > 0) {
        lanes.extra.push({ label: pair[0], start: t, end: t + pair[1] });
        t += pair[1];
      }
    });

    return { lanes: lanes, movementEnd: movementEnd, totalTime: t };
  }

  function renderOverviewTimeline(result) {
    var svg = $("overview_timeline");
    var note = $("overview_timelineNote");
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    if (!result.valid) {
      note.textContent = "메인 Cycle Time 입력값에 오류가 있어 타임라인을 표시할 수 없습니다.";
      return;
    }
    note.textContent = "※ 이동(주행·승강)은 기존 계산식대로 동시 운전(max)입니다. 포크·Load/Unload·위치결정·통신확인·여유시간은 " +
      "기존 계산식에서 합산으로만 정의되어 있어 화면 표시 순서(위 나열 순서)를 그대로 사용했습니다 — 실제 제어 시퀀스상의 순서는 " +
      "기존 코드에서 확인되지 않았으므로 다르면 별도 검토가 필요합니다. 막대 길이는 시간에 비례하며 속도를 나타내지 않습니다.";

    var timeline = buildCycleTimeline(result);
    var totalTime = timeline.totalTime > 0 ? timeline.totalTime : 1;

    var W = 900, H = 220;
    var left = 100, right = 20, top = 30, bottom = 30;
    var laneNames = [["travel", "주행축"], ["lift", "승강축"], ["fork", "Fork축"], ["extra", "부가시간"]];
    var laneH = (H - top - bottom) / laneNames.length;
    var plotW = W - left - right;

    function xOf(tSec) { return left + (tSec / totalTime) * plotW; }

    laneNames.forEach(function (ln, idx) {
      var y = top + idx * laneH;
      var label = svgEl("text", { x: 8, y: y + laneH / 2 + 4, "font-size": 11, "font-weight": "600", fill: "#1f2430" });
      label.textContent = ln[1];
      svg.appendChild(label);
      svg.appendChild(svgEl("line", { x1: left, y1: y + laneH, x2: left + plotW, y2: y + laneH, stroke: "#eceff2", "stroke-width": 1 }));
    });

    var PHASE_COLOR = { accel: "#a9c4e6", const: "#1f5fb0", decel: "#a9c4e6" };

    function drawProfileBar(y, h, item) {
      var pr = item.profile;
      var segs = [];
      if (pr.Tc > 0) {
        segs = [
          { s: item.start, e: item.start + pr.Ta, c: PHASE_COLOR.accel },
          { s: item.start + pr.Ta, e: item.start + pr.Ta + pr.Tc, c: PHASE_COLOR.const },
          { s: item.start + pr.Ta + pr.Tc, e: item.start + pr.Ttotal, c: PHASE_COLOR.decel }
        ];
      } else {
        segs = [
          { s: item.start, e: item.start + pr.Ta, c: PHASE_COLOR.accel },
          { s: item.start + pr.Ta, e: item.start + pr.Ttotal, c: PHASE_COLOR.decel }
        ];
      }
      segs.forEach(function (sg) {
        if (sg.e <= sg.s) return;
        svg.appendChild(svgEl("rect", {
          x: xOf(sg.s), y: y, width: Math.max(0.5, xOf(sg.e) - xOf(sg.s)), height: h,
          fill: sg.c, stroke: "#1f2430", "stroke-width": 0.5
        }));
      });
    }

    laneNames.forEach(function (ln, idx) {
      var y = top + idx * laneH + 6;
      var h = laneH - 12;
      var items = timeline.lanes[ln[0]];
      items.forEach(function (item) {
        if (item.profile) {
          drawProfileBar(y, h, item);
        } else {
          svg.appendChild(svgEl("rect", {
            x: xOf(item.start), y: y, width: Math.max(0.5, xOf(item.end) - xOf(item.start)), height: h,
            fill: "#6b7280", stroke: "#1f2430", "stroke-width": 0.5
          }));
          if (xOf(item.end) - xOf(item.start) > 40) {
            var lbl = svgEl("text", { x: (xOf(item.start) + xOf(item.end)) / 2, y: y + h / 2 + 4, "text-anchor": "middle", "font-size": 9, fill: "#fff" });
            lbl.textContent = item.label;
            svg.appendChild(lbl);
          }
        }
      });
    });

    // X축 시간 눈금 (최대 8개)
    var tickCount = 6;
    for (var i = 0; i <= tickCount; i++) {
      var tt = (totalTime * i) / tickCount;
      var xx = xOf(tt);
      svg.appendChild(svgEl("line", { x1: xx, y1: top, x2: xx, y2: H - bottom + 4, stroke: "#d5d8de", "stroke-width": 1 }));
      var xl = svgEl("text", { x: xx, y: H - bottom + 16, "text-anchor": "middle", "font-size": 9, fill: "#6b7280" });
      xl.textContent = fmtTime(tt) + "s";
      svg.appendChild(xl);
    }
    // 동시 운전 종료(=이동 종료) 지점 표시
    var mx = xOf(timeline.movementEnd);
    svg.appendChild(svgEl("line", { x1: mx, y1: top, x2: mx, y2: H - bottom, stroke: "#b0301f", "stroke-width": 1, "stroke-dasharray": "3,3" }));
  }

  function renderOverviewSteps(result) {
    var tbody = $("overview_stepsTable").querySelector("tbody");
    if (!result.valid) {
      emptyRow(tbody, 7, "메인 Cycle Time 입력값을 확인하세요.");
      return;
    }
    var timeline = buildCycleTimeline(result);
    var rows = [];
    var order = 1;

    result.segments.forEach(function (seg) {
      var segStart = 0;
      var acc = 0;
      result.segments.some(function (s2) {
        if (s2 === seg) { segStart = acc; return true; }
        acc += s2.movementTime;
        return false;
      });
      rows.push([
        String(order++), (result.input.cycleType === "Dual Cycle" ? seg.name + " 이동" : "이동") + " (주행·승강)",
        "주행·승강", fmtTime(segStart), fmtTime(segStart + seg.movementTime), fmtTime(seg.movementTime), "동시"
      ]);
    });

    var t = timeline.movementEnd;
    if (result.summary.forkOperationTime > 0) {
      rows.push([String(order++), "포크 동작", "Fork", fmtTime(t), fmtTime(t + result.summary.forkOperationTime), fmtTime(result.summary.forkOperationTime), "순차"]);
      t += result.summary.forkOperationTime;
    }
    [
      ["Load/Unload", "-", result.summary.loadUnloadTime],
      ["위치 결정", "-", result.summary.positioningTimeTotal],
      ["통신/센서 확인", "-", result.summary.communicationTimeTotal],
      ["여유 시간", "-", result.summary.marginTime]
    ].forEach(function (item) {
      if (item[2] > 0) {
        rows.push([String(order++), item[0], item[1], fmtTime(t), fmtTime(t + item[2]), fmtTime(item[2]), "순차"]);
        t += item[2];
      }
    });

    fillTable(tbody, rows);
  }

  function refreshOverview() {
    var Calculator = window.SC_Calc.Calculator, UI = window.SC_Calc.UI;
    var input = UI.collectInputData();
    var result = Calculator.calculateCycle(input);
    renderOverviewCards(result);
    renderOverviewAxisTable();
    renderOverviewTimeline(result);
    renderOverviewSteps(result);
  }

  // ---- 탭 전환 (WAI-ARIA 탭 패턴, 섹션 20) ----
  var TAB_IDS = ["cycle", "travel", "lift", "fork", "overview"];

  function activateTab(tabId, focusButton) {
    TAB_IDS.forEach(function (id) {
      var btn = $("tabBtn-" + id);
      var panel = $("tabPanel-" + id);
      var active = id === tabId;
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
      panel.classList.toggle("hidden", !active);
    });
    if (focusButton) $("tabBtn-" + tabId).focus();
    if (tabId === "overview") refreshOverview();
  }

  function bindTabs() {
    TAB_IDS.forEach(function (id, idx) {
      var btn = $("tabBtn-" + id);
      btn.addEventListener("click", function () { activateTab(id, false); });
      btn.addEventListener("keydown", function (evt) {
        var newIdx = null;
        if (evt.key === "ArrowRight") newIdx = (idx + 1) % TAB_IDS.length;
        else if (evt.key === "ArrowLeft") newIdx = (idx - 1 + TAB_IDS.length) % TAB_IDS.length;
        else if (evt.key === "Home") newIdx = 0;
        else if (evt.key === "End") newIdx = TAB_IDS.length - 1;
        else if (evt.key === "Enter" || evt.key === " ") { evt.preventDefault(); activateTab(id, true); return; }
        if (newIdx !== null) {
          evt.preventDefault();
          activateTab(TAB_IDS[newIdx], true);
        }
      });
    });
  }

  function initAxisTabs() {
    AP = window.SC_Calc.AxisProfile;
    bindTabs();
    ["travel", "lift", "fork"].forEach(initAxisPanel);
    $("overview_btnRefresh").addEventListener("click", refreshOverview);
  }

  window.SC_Calc.AxisUI = { initAxisTabs: initAxisTabs, refreshOverview: refreshOverview };
})();
