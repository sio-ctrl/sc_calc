/* SC_Calc calculation engine. No DOM access here. */
window.SC_Calc = window.SC_Calc || {};

(function () {
  "use strict";

  var CYCLE_COUNTS = {
    "입고": { forkPositions: 2, loadCount: 1, unloadCount: 1, positioningCount: 2, communicationCount: 2, marginCount: 1 },
    "출고": { forkPositions: 2, loadCount: 1, unloadCount: 1, positioningCount: 2, communicationCount: 2, marginCount: 1 },
    "Dual Cycle": { forkPositions: 4, loadCount: 2, unloadCount: 2, positioningCount: 4, communicationCount: 4, marginCount: 1 }
  };

  function isFiniteNumber(v) {
    return typeof v === "number" && isFinite(v);
  }

  var ADDITIONAL_TIME_LABELS = {
    forkOutTime: "포크 인출 시간",
    forkInTime: "포크 인입 시간",
    loadTime: "Load 시간",
    unloadTime: "Unload 시간",
    positioningTime: "위치 결정 시간",
    communicationTime: "통신 또는 센서 확인 시간",
    marginTime: "여유 시간"
  };

  // 오류 메시지에 내부 필드명 대신 화면 라벨을 표시하기 위한 매핑
  var POSITION_LABELS = {
    startTravelPercent: "출발 주행 위치", startLiftPercent: "출발 승강 위치",
    endTravelPercent: "도착 주행 위치", endLiftPercent: "도착 승강 위치",
    inStationTravelPercent: "입고 Station 주행 위치", inStationLiftPercent: "입고 Station 승강 위치",
    inRackTravelPercent: "입고 Rack 주행 위치", inRackLiftPercent: "입고 Rack 승강 위치",
    outRackTravelPercent: "출고 Rack 주행 위치", outRackLiftPercent: "출고 Rack 승강 위치",
    outStationTravelPercent: "출고 Station 주행 위치", outStationLiftPercent: "출고 Station 승강 위치",
    startBay: "출발 Bay", startLevel: "출발 Level",
    endBay: "도착 Bay", endLevel: "도착 Level",
    inStationBay: "입고 Station Bay", inStationLevel: "입고 Station Level",
    inRackBay: "입고 Rack Bay", inRackLevel: "입고 Rack Level",
    outRackBay: "출고 Rack Bay", outRackLevel: "출고 Rack Level",
    outStationBay: "출고 Station Bay", outStationLevel: "출고 Station Level"
  };

  // 11. 축별 이동 시간 계산 로직 (가속도/감속도 분리 - 비대칭 사다리꼴/삼각형)
  function calculateAxisTime(distance, maxSpeed, accel, decel) {
    if (!distance || distance === 0) return 0;
    var d = Math.abs(distance);
    var accelDist = (maxSpeed * maxSpeed) / (2 * accel);
    var decelDist = (maxSpeed * maxSpeed) / (2 * decel);
    if (d >= accelDist + decelDist) {
      var accelTime = maxSpeed / accel;
      var decelTime = maxSpeed / decel;
      var constTime = (d - accelDist - decelDist) / maxSpeed;
      return accelTime + constTime + decelTime;
    }
    var vPeak = Math.sqrt((2 * d * accel * decel) / (accel + decel));
    return vPeak / accel + vPeak / decel;
  }

  // 15. 입력값 검증
  function validateInput(input) {
    var errors = [];
    var eq = input.equipment;

    function checkNumber(value, label) {
      if (!isFiniteNumber(value)) errors.push(label + "은(는) 숫자로 입력해야 합니다.");
    }

    checkNumber(eq.travelMaxSpeed, "주행 최대 속도");
    checkNumber(eq.travelAccel, "주행 가속도");
    checkNumber(eq.travelDecel, "주행 감속도");
    checkNumber(eq.liftMaxSpeed, "승강 최대 속도");
    checkNumber(eq.liftAccel, "승강 가속도");
    checkNumber(eq.liftDecel, "승강 감속도");

    if (isFiniteNumber(eq.travelMaxSpeed) && eq.travelMaxSpeed <= 0) errors.push("주행 최대 속도는 0보다 커야 합니다.");
    if (isFiniteNumber(eq.travelAccel) && eq.travelAccel <= 0) errors.push("주행 가속도는 0보다 커야 합니다.");
    if (isFiniteNumber(eq.travelDecel) && eq.travelDecel <= 0) errors.push("주행 감속도는 0보다 커야 합니다.");
    if (isFiniteNumber(eq.liftMaxSpeed) && eq.liftMaxSpeed <= 0) errors.push("승강 최대 속도는 0보다 커야 합니다.");
    if (isFiniteNumber(eq.liftAccel) && eq.liftAccel <= 0) errors.push("승강 가속도는 0보다 커야 합니다.");
    if (isFiniteNumber(eq.liftDecel) && eq.liftDecel <= 0) errors.push("승강 감속도는 0보다 커야 합니다.");

    var at = input.additionalTime;
    ["forkOutTime", "forkInTime", "loadTime", "unloadTime", "positioningTime", "communicationTime", "marginTime"].forEach(function (key) {
      checkNumber(at[key], ADDITIONAL_TIME_LABELS[key]);
      if (isFiniteNumber(at[key]) && at[key] < 0) errors.push(ADDITIONAL_TIME_LABELS[key] + "은(는) 0 이상이어야 합니다.");
    });

    var isDual = input.cycleType === "Dual Cycle";

    if (input.distanceMethod === "Rack Size") {
      var rs = input.rackSize;
      checkNumber(rs.rackTravelLength, "Rack 주행 기준 길이");
      checkNumber(rs.rackLiftHeight, "Rack 승강 기준 높이");
      if (isFiniteNumber(rs.rackTravelLength) && rs.rackTravelLength <= 0) errors.push("Rack 주행 기준 길이는 0보다 커야 합니다.");
      if (isFiniteNumber(rs.rackLiftHeight) && rs.rackLiftHeight <= 0) errors.push("Rack 승강 기준 높이는 0보다 커야 합니다.");

      var percentFields = isDual
        ? ["inStationTravelPercent", "inStationLiftPercent", "inRackTravelPercent", "inRackLiftPercent", "outRackTravelPercent", "outRackLiftPercent", "outStationTravelPercent", "outStationLiftPercent"]
        : ["startTravelPercent", "startLiftPercent", "endTravelPercent", "endLiftPercent"];
      var group = isDual ? rs.dual : rs.single;
      percentFields.forEach(function (key) {
        var v = group[key];
        var label = POSITION_LABELS[key];
        checkNumber(v, label);
        if (isFiniteNumber(v) && (v < 0 || v > 100)) errors.push(label + " 비율은 0 이상 100 이하로 입력해야 합니다.");
      });
    } else {
      var bl = input.bayLevel;
      checkNumber(bl.bayPitch, "Rack Size(Bay Pitch)");
      checkNumber(bl.levelPitch, "Rack Size(Level Pitch)");
      if (isFiniteNumber(bl.bayPitch) && bl.bayPitch <= 0) errors.push("Rack Size(Bay Pitch)는 0보다 커야 합니다.");
      if (isFiniteNumber(bl.levelPitch) && bl.levelPitch <= 0) errors.push("Rack Size(Level Pitch)는 0보다 커야 합니다.");

      checkNumber(bl.maxBay, "Max Bay");
      checkNumber(bl.maxLevel, "Max Level");
      if (isFiniteNumber(bl.maxBay) && bl.maxBay <= 0) errors.push("Max Bay는 0보다 커야 합니다.");
      if (isFiniteNumber(bl.maxLevel) && bl.maxLevel <= 0) errors.push("Max Level은 0보다 커야 합니다.");
      if (isFiniteNumber(bl.maxBay) && !Number.isInteger(bl.maxBay)) errors.push("Max Bay는 정수로 입력해야 합니다.");
      if (isFiniteNumber(bl.maxLevel) && !Number.isInteger(bl.maxLevel)) errors.push("Max Level은 정수로 입력해야 합니다.");

      var blFields = isDual
        ? ["inStationBay", "inStationLevel", "inRackBay", "inRackLevel", "outRackBay", "outRackLevel", "outStationBay", "outStationLevel"]
        : ["startBay", "startLevel", "endBay", "endLevel"];
      var blGroup = isDual ? bl.dual : bl.single;
      blFields.forEach(function (key) {
        var v = blGroup[key];
        var label = POSITION_LABELS[key];
        checkNumber(v, label);
        if (!isFiniteNumber(v)) return;
        if (!Number.isInteger(v)) errors.push(label + "은(는) 정수로 입력해야 합니다.");
        if (v < 0) errors.push(label + "은(는) 0 이상이어야 합니다.");
        var isBay = key.indexOf("Bay") !== -1;
        var max = isBay ? bl.maxBay : bl.maxLevel;
        if (v >= 0 && isFiniteNumber(max) && max > 0 && v > max) {
          errors.push(label + "은(는) " + (isBay ? "Max Bay" : "Max Level") + "(" + max + ") 이하로 입력해야 합니다.");
        }
      });
    }

    return { valid: errors.length === 0, errors: errors };
  }

  // 8, 9. 구간(좌표) 목록 생성 -> [{name, travel, lift, rawTravel, rawLift}]
  // rawTravel/rawLift는 사용자가 입력한 단위 그대로(Rack Size=%, Bay/Level=Bay·Level 정수)이며
  // 화면 다이어그램 라벨 표시에 사용된다. travel/lift는 계산에 사용되는 mm 환산값이다.
  function buildPoints(input) {
    var isDual = input.cycleType === "Dual Cycle";

    if (input.distanceMethod === "Rack Size") {
      var rs = input.rackSize;
      var L = rs.rackTravelLength;
      var H = rs.rackLiftHeight;
      if (isDual) {
        var d = rs.dual;
        return [
          { name: "입고 Station", travel: L * d.inStationTravelPercent / 100, lift: H * d.inStationLiftPercent / 100, rawTravel: d.inStationTravelPercent, rawLift: d.inStationLiftPercent },
          { name: "입고 Rack", travel: L * d.inRackTravelPercent / 100, lift: H * d.inRackLiftPercent / 100, rawTravel: d.inRackTravelPercent, rawLift: d.inRackLiftPercent },
          { name: "출고 Rack", travel: L * d.outRackTravelPercent / 100, lift: H * d.outRackLiftPercent / 100, rawTravel: d.outRackTravelPercent, rawLift: d.outRackLiftPercent },
          { name: "출고 Station", travel: L * d.outStationTravelPercent / 100, lift: H * d.outStationLiftPercent / 100, rawTravel: d.outStationTravelPercent, rawLift: d.outStationLiftPercent }
        ];
      }
      var s = rs.single;
      var startName = input.cycleType === "출고" ? "보관 Rack" : "입고 Station";
      var endName = input.cycleType === "출고" ? "출고 Station" : "보관 Rack";
      return [
        { name: startName, travel: L * s.startTravelPercent / 100, lift: H * s.startLiftPercent / 100, rawTravel: s.startTravelPercent, rawLift: s.startLiftPercent },
        { name: endName, travel: L * s.endTravelPercent / 100, lift: H * s.endLiftPercent / 100, rawTravel: s.endTravelPercent, rawLift: s.endLiftPercent }
      ];
    }

    // Bay/Level Pitch
    var bl = input.bayLevel;
    var bp = bl.bayPitch;
    var lp = bl.levelPitch;
    if (isDual) {
      var bd = bl.dual;
      return [
        { name: "입고 Station", travel: bd.inStationBay * bp, lift: bd.inStationLevel * lp, rawTravel: bd.inStationBay, rawLift: bd.inStationLevel },
        { name: "입고 Rack", travel: bd.inRackBay * bp, lift: bd.inRackLevel * lp, rawTravel: bd.inRackBay, rawLift: bd.inRackLevel },
        { name: "출고 Rack", travel: bd.outRackBay * bp, lift: bd.outRackLevel * lp, rawTravel: bd.outRackBay, rawLift: bd.outRackLevel },
        { name: "출고 Station", travel: bd.outStationBay * bp, lift: bd.outStationLevel * lp, rawTravel: bd.outStationBay, rawLift: bd.outStationLevel }
      ];
    }
    var bsingle = bl.single;
    var bStartName = input.cycleType === "출고" ? "보관 Rack" : "입고 Station";
    var bEndName = input.cycleType === "출고" ? "출고 Station" : "보관 Rack";
    return [
      { name: bStartName, travel: bsingle.startBay * bp, lift: bsingle.startLevel * lp, rawTravel: bsingle.startBay, rawLift: bsingle.startLevel },
      { name: bEndName, travel: bsingle.endBay * bp, lift: bsingle.endLevel * lp, rawTravel: bsingle.endBay, rawLift: bsingle.endLevel }
    ];
  }

  // Layout 전체 경계(mm) - Rack Size는 (0..rackTravelLength)x(0..rackLiftHeight),
  // Bay/Level Pitch는 (0..maxBay*bayPitch)x(0..maxLevel*levelPitch). 다이어그램의 배치 기준(Max 사이즈)으로 사용한다.
  function getLayoutBounds(input) {
    if (input.distanceMethod === "Rack Size") {
      return { minTravel: 0, maxTravel: input.rackSize.rackTravelLength, minLift: 0, maxLift: input.rackSize.rackLiftHeight };
    }
    var bl = input.bayLevel;
    return { minTravel: 0, maxTravel: bl.maxBay * bl.bayPitch, minLift: 0, maxLift: bl.maxLevel * bl.levelPitch };
  }

  function buildSegment(segName, from, to, eq) {
    var travelDistance = Math.abs(to.travel - from.travel);
    var liftDistance = Math.abs(to.lift - from.lift);
    var travelTime = calculateAxisTime(travelDistance, eq.travelMaxSpeed, eq.travelAccel, eq.travelDecel);
    var liftTime = calculateAxisTime(liftDistance, eq.liftMaxSpeed, eq.liftAccel, eq.liftDecel);
    return {
      name: segName,
      startName: from.name,
      endName: to.name,
      travelDistance: travelDistance,
      liftDistance: liftDistance,
      travelTime: travelTime,
      liftTime: liftTime,
      movementTime: Math.max(travelTime, liftTime)
    };
  }

  // 20.1 필수 함수: 전체 계산 진입점
  function calculateCycle(inputData) {
    var validation = validateInput(inputData);
    if (!validation.valid) {
      return { valid: false, errors: validation.errors };
    }

    var eq = inputData.equipment;
    var points = buildPoints(inputData);
    var isDual = inputData.cycleType === "Dual Cycle";

    var segments = isDual
      ? [
          buildSegment("1구간", points[0], points[1], eq),
          buildSegment("2구간", points[1], points[2], eq),
          buildSegment("3구간", points[2], points[3], eq)
        ]
      : [buildSegment("1구간", points[0], points[1], eq)];

    var totalTravelDistance = 0, totalLiftDistance = 0, totalTravelTime = 0, totalLiftTime = 0, totalMovementTime = 0;
    segments.forEach(function (seg) {
      totalTravelDistance += seg.travelDistance;
      totalLiftDistance += seg.liftDistance;
      totalTravelTime += seg.travelTime;
      totalLiftTime += seg.liftTime;
      totalMovementTime += seg.movementTime;
    });

    var counts = CYCLE_COUNTS[inputData.cycleType];
    var at = inputData.additionalTime;

    var forkOperationTime = (at.forkOutTime + at.forkInTime) * counts.forkPositions;
    var loadUnloadTime = at.loadTime * counts.loadCount + at.unloadTime * counts.unloadCount;
    var positioningTimeTotal = at.positioningTime * counts.positioningCount;
    var communicationTimeTotal = at.communicationTime * counts.communicationCount;
    var marginTime = at.marginTime * counts.marginCount;

    var totalCycleTime = totalMovementTime + forkOperationTime + loadUnloadTime + positioningTimeTotal + communicationTimeTotal + marginTime;

    return {
      valid: true,
      summary: {
        cycleType: inputData.cycleType,
        distanceMethod: inputData.distanceMethod,
        totalTravelDistance: totalTravelDistance,
        totalLiftDistance: totalLiftDistance,
        totalTravelTime: totalTravelTime,
        totalLiftTime: totalLiftTime,
        totalMovementTime: totalMovementTime,
        forkOperationTime: forkOperationTime,
        loadUnloadTime: loadUnloadTime,
        positioningTimeTotal: positioningTimeTotal,
        communicationTimeTotal: communicationTimeTotal,
        marginTime: marginTime,
        totalCycleTime: totalCycleTime
      },
      additionalCounts: counts,
      segments: segments,
      input: inputData
    };
  }

  window.SC_Calc.Calculator = {
    calculateAxisTime: calculateAxisTime,
    validateInput: validateInput,
    calculateCycle: calculateCycle,
    buildPoints: buildPoints,
    getLayoutBounds: getLayoutBounds
  };
})();
