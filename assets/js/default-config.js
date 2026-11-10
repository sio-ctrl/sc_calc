/* SC_Calc default configuration */
window.SC_Calc = window.SC_Calc || {};

window.SC_Calc.DEFAULT_CONFIG = {
  // 기본값은 아래 "Dual Cycle 레이아웃 예제"를 반영한다 (README "16. Dual Cycle 예제" 참고).
  // 입고 Station(좌측, 0%) - 입고 Rack(CELL1) - 출고 Rack(CELL2) - 출고 Station(우측, 100%)
  cycleType: "Dual Cycle",
  distanceMethod: "Bay/Level Pitch",
  equipment: {
    travelMaxSpeed: 1500,
    travelAccel: 500,
    travelDecel: 500,
    liftMaxSpeed: 800,
    liftAccel: 300,
    liftDecel: 300
  },
  rackSize: {
    rackTravelLength: 51000,
    rackLiftHeight: 15000,
    // 입고 기본값 = Dual 1구간(입고 Station→입고 Rack CELL1)과 동일.
    // 출고 선택 시에는 Dual 3구간(출고 Rack CELL2→출고 Station) 값이 화면에서 자동 반영된다.
    single: {
      startTravelPercent: 0,
      startLiftPercent: 0,
      endTravelPercent: 80,
      endLiftPercent: 80
    },
    dual: {
      // 입고 Station (좌측, Travel 0=0%)
      inStationTravelPercent: 0,
      inStationLiftPercent: 0,
      // 입고 Rack = CELL1 (Travel 40800=80%, Lift 12000=80%)
      inRackTravelPercent: 80,
      inRackLiftPercent: 80,
      // 출고 Rack = CELL2 (Travel 20400=40%, Lift 9000=60%)
      outRackTravelPercent: 40,
      outRackLiftPercent: 60,
      // 출고 Station (우측, Travel 51000=100%)
      outStationTravelPercent: 100,
      outStationLiftPercent: 0
    }
  },
  bayLevel: {
    // Rack Size(Bay Pitch) 1020mm / Rack Size(Level Pitch) 3000mm 기준으로 위 Rack Size % 예제와 동일한 위치를 표현한다.
    bayPitch: 1020,
    levelPitch: 3000,
    // Layout 최대 크기(Max Bay/Max Level) - 다이어그램의 Rack 경계(배치 기준)로 사용된다.
    maxBay: 50,
    maxLevel: 5,
    single: {
      startBay: 0,
      startLevel: 0,
      endBay: 40,
      endLevel: 4
    },
    dual: {
      inStationBay: 0,
      inStationLevel: 0,
      inRackBay: 40,
      inRackLevel: 4,
      outRackBay: 20,
      outRackLevel: 3,
      outStationBay: 50,
      outStationLevel: 0
    }
  },
  additionalTime: {
    forkOutTime: 2,
    forkInTime: 2,
    loadTime: 3,
    unloadTime: 3,
    positioningTime: 1,
    communicationTime: 1,
    marginTime: 2
  }
};

// 공용 포맷 유틸 (여러 js 파일에서 재사용)
window.SC_Calc.Util = {
  round2: function (n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  },
  // 시간(sec) 표시 전용 - 전체 화면 공통으로 소수점 1자리를 사용한다.
  round1: function (n) {
    return Math.round((n + Number.EPSILON) * 10) / 10;
  },
  // 저장된 설정(구버전 포함)을 기본값 위에 덮어쓴다.
  // 구버전 설정에 없는 필드(maxBay 등)는 기본값으로 채워져 undefined 유입을 막는다.
  mergeConfig: function mergeConfig(defaults, override) {
    if (typeof override !== "object" || override === null || Array.isArray(override)) return defaults;
    var out = {};
    Object.keys(defaults).forEach(function (key) {
      var d = defaults[key];
      var o = override[key];
      if (typeof d === "object" && d !== null) {
        out[key] = mergeConfig(d, o);
      } else {
        out[key] = (o === undefined || o === null) ? d : o;
      }
    });
    return out;
  },
  formatTimestamp: function () {
    var d = new Date();
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    return "" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "_" +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  },
  formatDateTime: function () {
    var d = new Date();
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " +
      pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
};
