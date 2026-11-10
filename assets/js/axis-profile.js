/* SC_Calc 축별 속도 프로파일 계산 엔진. DOM 접근 없음 (순수 함수).
   기존 calculator.js의 calculateAxisTime(사다리꼴/삼각형 판정)과 물리 모델은 동일하다.
   차이점: 이 모듈은 가속/등속/감속 구간을 분리해 절점·거리 breakdown까지 반환하고,
   입력 단위가 mm/min/mm·s⁻²인 스펙 시트 형태라는 점, 그리고 기존 Cycle Time과는 독립적으로
   "축 사양"만 검토하기 위한 용도라는 점이다. (섹션 1.3 계산 책임 구분) */
window.SC_Calc = window.SC_Calc || {};

(function () {
  "use strict";

  // 섹션 4.1: 기존 프로젝트 값(equipment.travelMaxSpeed 등, mm/s·mm/s^2)에서 그대로 가져온 기본값.
  // 주행/승강 스트로크는 기존 rackSize.rackTravelLength/rackLiftHeight(=Bay/Level Max 환산값과 동일, 51000/15000mm)를 사용.
  // Fork는 기존 프로젝트에 스트로크·속도 데이터가 없어 프로젝트 가정값을 사용한다 (화면에 "가정값" 표시).
  var DEFAULT_AXIS_SETTINGS = {
    travel: {
      strokeMm: 51000,
      targetSpeedMPerMin: 90,          // = 1500mm/s
      accelerationMmS2: 500,
      decelerationMmS2: 500,
      isAssumed: false
    },
    lift: {
      strokeMm: 15000,
      targetSpeedMPerMin: 48,          // = 800mm/s
      accelerationMmS2: 300,
      decelerationMmS2: 300,
      isAssumed: false
    },
    fork: {
      // 기존 프로젝트의 forkOutTime/forkInTime은 "1회당 sec" 고정값일 뿐 스트로크·속도 사양이 없다.
      // 아래 값은 프로젝트 가정값(assumption)이며 화면과 주석에 명시한다.
      strokeMm: 1300,
      targetSpeedMPerMin: 30,
      accelerationMmS2: 980,
      decelerationMmS2: 980,
      isAssumed: true
    }
  };

  var AXIS_LABELS = { travel: "주행축", lift: "승강축", fork: "Fork축" };

  function isPositiveFiniteNumber(v) {
    return typeof v === "number" && isFinite(v) && v > 0;
  }

  // 섹션 19. 입력 검증
  function scValidateAxisInputs(inputs) {
    var errors = [];
    function check(v, label) {
      if (v === "" || v === null || v === undefined || typeof v !== "number" || isNaN(v)) {
        errors.push(label + "은(는) 0보다 큰 숫자로 입력해야 합니다.");
      } else if (!isFinite(v)) {
        errors.push(label + " 값이 유효하지 않습니다(Infinity). 입력값을 확인하십시오.");
      } else if (v <= 0) {
        errors.push(label + "은(는) 0보다 큰 숫자로 입력해야 합니다.");
      }
    }
    check(inputs.strokeMm, "스트로크");
    check(inputs.targetSpeedMPerMin, "목표 최고속도");
    check(inputs.accelerationMmS2, "가속도");
    check(inputs.decelerationMmS2, "감속도");
    return { valid: errors.length === 0, errors: errors };
  }

  // 섹션 7. 단위 변환 (mm/min/mm·s⁻² -> SI: m, m/s, m/s^2)
  function scConvertAxisUnits(inputs) {
    return {
      S: inputs.strokeMm / 1000,
      V: inputs.targetSpeedMPerMin / 60,
      a: inputs.accelerationMmS2 / 1000,
      d: inputs.decelerationMmS2 / 1000
    };
  }

  // 섹션 8~9. 축별 속도 프로파일 계산 (사다리꼴/경계/삼각형 자동 판정)
  // 반환값은 반올림하지 않은 raw 값. 화면 표시 시점에만 반올림한다 (섹션 10.4).
  function scCalculateSpeedProfile(rawInputs) {
    var validation = scValidateAxisInputs(rawInputs);
    if (!validation.valid) {
      return { valid: false, errors: validation.errors };
    }

    var si = scConvertAxisUnits(rawInputs);
    var S = si.S, V = si.V, a = si.a, d = si.d;

    // 비정상적으로 큰 값으로 무한대가 되는 경우 방어 (섹션 19)
    if (!isFinite(S) || !isFinite(V) || !isFinite(a) || !isFinite(d) || !isFinite(V * V)) {
      return { valid: false, errors: ["계산값이 허용 범위를 초과했습니다. 입력 단위를 확인하십시오."] };
    }

    var Ta_target = V / a;
    var Td_target = V / d;
    var Sa_target = (V * V) / (2 * a);
    var Sd_target = (V * V) / (2 * d);
    var Srequired = Sa_target + Sd_target;
    var epsilon = Math.max(1e-9, Srequired * 1e-9);

    var profileType, reachesTarget, Vpeak, Ta, Td, Sa, Sd, Sc, Tc;

    if (S > Srequired + epsilon) {
      profileType = "trapezoid";
      reachesTarget = true;
      Vpeak = V;
      Ta = Ta_target; Td = Td_target;
      Sa = Sa_target; Sd = Sd_target;
      Sc = S - Sa - Sd;
      Tc = Sc / V;
    } else if (Math.abs(S - Srequired) <= epsilon) {
      profileType = "boundary";
      reachesTarget = true;
      Vpeak = V;
      Ta = Ta_target; Td = Td_target;
      Sa = Sa_target; Sd = Sd_target;
      Sc = 0; Tc = 0;
    } else {
      profileType = "triangle";
      reachesTarget = false;
      Vpeak = Math.sqrt((2 * S * a * d) / (a + d));
      Ta = Vpeak / a; Td = Vpeak / d;
      Sa = (Vpeak * Vpeak) / (2 * a); Sd = (Vpeak * Vpeak) / (2 * d);
      Sc = 0; Tc = 0;
    }

    var Ttotal = Ta + Tc + Td;

    if (!isFinite(Ttotal) || !isFinite(Sa) || !isFinite(Sd)) {
      return { valid: false, errors: ["계산값이 허용 범위를 초과했습니다. 입력 단위를 확인하십시오."] };
    }

    return {
      valid: true,
      axisInputs: rawInputs,
      si: si,
      profileType: profileType,   // "trapezoid" | "boundary" | "triangle"
      reachesTarget: reachesTarget,
      targetSpeedMPerMin: rawInputs.targetSpeedMPerMin,
      Vpeak: Vpeak,               // m/s
      Srequired: Srequired,       // m
      epsilon: epsilon,
      Ta: Ta, Tc: Tc, Td: Td, Ttotal: Ttotal,     // s
      Sa: Sa, Sc: Sc, Sd: Sd, S: S,                 // m
      decelStartTime: Ta + Tc,
      decelStartPos: Sa + Sc
    };
  }

  // 섹션 11. 프로파일 절점 데이터. 등속 구간이 0이면 중복 절점을 만들지 않는다.
  function scBuildProfilePoints(result) {
    if (!result || !result.valid) return [];
    var points = [{ label: "시작", t: 0, v: 0, s: 0 }];
    if (result.Tc > 0) {
      points.push({ label: "가속 완료", t: result.Ta, v: result.Vpeak, s: result.Sa });
      points.push({ label: "감속 시작", t: result.decelStartTime, v: result.Vpeak, s: result.decelStartPos });
    } else {
      points.push({ label: "최고속도 지점", t: result.Ta, v: result.Vpeak, s: result.Sa });
    }
    points.push({ label: "이동 완료", t: result.Ttotal, v: 0, s: result.S });
    return points;
  }

  // 섹션 18. 결과 무결성 검증
  function scValidateProfileResult(result) {
    if (!result || !result.valid) return { valid: false, errors: ["계산 결과가 없습니다."] };
    var errors = [];
    var tol = Math.max(1e-6, result.S * 1e-6);
    if (Math.abs((result.Sa + result.Sc + result.Sd) - result.S) > tol) {
      errors.push("거리 무결성 오류: Sa+Sc+Sd가 스트로크와 일치하지 않습니다.");
    }
    var tTol = Math.max(1e-6, result.Ttotal * 1e-6);
    if (Math.abs((result.Ta + result.Tc + result.Td) - result.Ttotal) > tTol) {
      errors.push("시간 무결성 오류: Ta+Tc+Td가 편도 운전시간과 일치하지 않습니다.");
    }
    return { valid: errors.length === 0, errors: errors };
  }

  window.SC_Calc.AxisProfile = {
    DEFAULT_AXIS_SETTINGS: DEFAULT_AXIS_SETTINGS,
    AXIS_LABELS: AXIS_LABELS,
    scValidateAxisInputs: scValidateAxisInputs,
    scConvertAxisUnits: scConvertAxisUnits,
    scCalculateSpeedProfile: scCalculateSpeedProfile,
    scBuildProfilePoints: scBuildProfilePoints,
    scValidateProfileResult: scValidateProfileResult
  };
})();
