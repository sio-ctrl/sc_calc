# SC_Calc — Stacker Crane Cycle Time Calculator

물류자동화 설비의 Stacker Crane 입고 / 출고 / Dual Cycle Time을 계산하는
**서버 없는 Local HTML 계산기**입니다.

## 1. 프로그램 개요

| 항목 | 내용 |
|---|---|
| 프로그램명 | SC_Calc |
| 정식 명칭 | Stacker Crane Cycle Time Calculator |
| 개발 방식 | Local HTML (HTML/CSS/JavaScript) |
| 실행 방식 | `index.html` 더블클릭 |
| 서버 사용 | 없음 |
| 인터넷 연결 | 불필요 |
| 결과 저장 | Excel `.xlsx` (SheetJS) |
| 설정 저장 | LocalStorage + JSON Export/Import |

## 2. 실행 방법

1. `SC_Calc_Local` 폴더 전체를 원하는 위치(로컬 PC, 공유 폴더, USB)에 복사합니다.
2. `index.html`을 더블클릭하여 Chrome 또는 Edge로 엽니다.
3. 별도 설치나 서버 실행 없이 바로 사용할 수 있습니다.

## 3. Local 공유 방법

- 폴더 전체를 압축(zip)하여 메신저/이메일/공유 폴더로 전달하면 됩니다.
- 압축을 풀고 `index.html`을 더블클릭하면 동일하게 동작합니다.
- 외부 CDN을 사용하지 않으므로 인터넷이 없는 사내망 PC에서도 동작합니다.
- `vendor/xlsx.full.min.js`(SheetJS)가 폴더 안에 이미 포함되어 있어 Excel 저장 기능도 별도 설치 없이 바로 동작합니다.

## 4. 폴더 구조

```
SC_Calc_Local/
  index.html
  README.md
  assets/
    css/
      style.css
    js/
      default-config.js   # 기본 입력값
      calculator.js       # 계산 로직 (UI와 분리)
      storage.js           # LocalStorage + JSON Import/Export
      excel-exporter.js    # Excel(.xlsx) 저장
      ui.js                 # 화면 제어
      app.js                # 앱 초기화
  vendor/
    xlsx.full.min.js      # SheetJS 라이브러리 (포함됨, 15번 항목 참고)
  sample/
    sample_config.json     # 샘플 설정 파일
```

모든 JS 파일은 classic script(`<script src="...">`) 방식으로 로드되며,
`window.SC_Calc` 네임스페이스 아래에서 동작합니다. ES Module을 사용하지 않으므로
`file://` 실행 시 CORS 문제가 발생하지 않습니다.

## 5. 주요 기능

- 입고 / 출고 / Dual Cycle 3가지 Cycle 유형 계산
- Rack Size 기준(%) 또는 Bay/Level Pitch 기준 거리 계산 방식 선택
- 주행/승강 축 가감속을 반영한 이동 시간 계산 (사다리꼴/삼각형 속도 프로파일)
- 포크 동작, Load/Unload, 위치 결정, 통신/센서 확인, 여유 시간 등 부가 시간 자동 반영
- 계산 결과 Summary + 구간별(Segment) Breakdown 화면 표시
- Excel(.xlsx) 저장 (Summary, Segment_Breakdown 2개 시트)
- LocalStorage 자동 저장/불러오기, 기본값 초기화
- 설정 JSON 내보내기/가져오기 (다른 PC와 설정 공유)

## 6. 입력 항목과 단위

| 항목 | 단위 |
|---|---|
| 거리 | mm |
| 속도 | mm/s |
| 가감속도 | mm/s² |
| 시간 | sec |
| 위치 비율 | % |

가속도와 감속도는 항상 동일한 값을 사용합니다. 별도의 감속도 입력 항목은 없습니다.
화면과 Excel의 결과값은 거리(mm)는 소수점 2자리, 시간(sec)은 소수점 1자리로 표시됩니다
(축별 속도사양 탭 포함, 전체 화면 공통 규칙). 장비 사양의 속도(mm/s)·가감속도(mm/s²)와
부가 시간(sec/회, sec/Cycle) 입력값도 기본값 로드/불러오기 및 축별 속도사양 탭에서
"Cycle Time에 적용" 시 소수점 1자리로 반올림되어 채워집니다. 내부 계산은 float(배정밀도)로
수행되며 반올림하지 않습니다.

## 7. Cycle 유형 설명

- **입고**: 단일 구간, 출발 위치(입고 Station) → 도착 위치(보관 Rack)
- **출고**: 단일 구간, 출발 위치(보관 Rack) → 도착 위치(출고 Station)

Cycle 유형을 입고 또는 출고로 변경하면 단일 구간 입력값이 Dual Cycle 위치에서
자동으로 채워집니다 — 입고는 Dual 1구간(입고 Station→입고 Rack), 출고는
Dual 3구간(출고 Rack→출고 Station)과 동일한 위치입니다. 필요 시 자동 반영된 값을
직접 수정할 수 있습니다.
- **Dual Cycle**: 3개 구간을 연계
  1. 입고 Station → 입고 Rack
  2. 입고 Rack → 출고 Rack
  3. 출고 Rack → 출고 Station

## 8. 거리 계산 방식 설명

- **Rack Size 기준**: Rack 주행 기준 길이 / 승강 기준 높이에 대한 위치 비율(%)로 좌표를 산출합니다.
  Layout 최대 크기 = Rack 주행 기준 길이 × Rack 승강 기준 높이(=100%).
- **Bay/Level Pitch 기준**: Bay 번호·Level 번호 차이에 Rack Size(Bay Pitch) / Rack Size(Level Pitch)
  (1개 Bay·Level의 크기, mm)를 곱해 거리를 산출합니다. Layout 최대 크기는 별도로 입력하는
  Max Bay × Rack Size(Bay Pitch), Max Level × Rack Size(Level Pitch)로 정의되며, 다이어그램의
  Rack 경계(배치 기준)와 위치 입력 검증(Bay는 0~Max Bay, Level은 0~Max Level)에 사용됩니다.
  거리 계산식 자체에는 사용되지 않습니다.

Cycle 유형과 거리 계산 방식 선택에 따라 입력 화면이 자동으로 전환됩니다. 화면 상단
Layout 다이어그램의 각 위치 라벨은 Rack Size 기준이면 `(주행%, 승강%)` 아래에 실제 위치를
천단위 콤마가 포함된 mm 값으로 `(40,800, 12,000) mm` 형식으로 한 줄 더 표시하고, Bay/Level
Pitch 기준이면 `(Bay, Level)` 형식으로 표시됩니다.

## 9. 계산 방식

### 9.1 축 이동 시간 (calculator.js `calculateAxisTime`)

```
d = 이동 거리, v = 최대 속도, a = 가감속도

d == 0            → 이동 시간 = 0
d >= v² / a       → 이동 시간 = v/a (가속) + (d - v²/a)/v (정속) + v/a (감속)
d <  v² / a       → 이동 시간 = 2 × sqrt(d / a)
```

### 9.2 구간 이동 시간

```
구간 이동 시간 = max(구간 주행 시간, 구간 승강 시간)   // 주행/승강 동시 동작
```

### 9.3 Dual Cycle 전체 이동 시간

```
Dual Cycle 이동 시간 = 1구간 이동 시간 + 2구간 이동 시간 + 3구간 이동 시간
```

### 9.4 총 Cycle Time

```
총 Cycle Time = 이동 시간 + 포크 동작 시간 + Load/Unload 시간
              + 위치 결정 시간 합계 + 통신/센서 확인 시간 합계 + 여유 시간
```

부가 시간 적용 횟수(입고/출고/Dual Cycle별 포크 동작 위치 수, Load/Unload 횟수,
위치 결정 횟수, 통신/센서 확인 횟수)는 `assets/js/calculator.js`의 `CYCLE_COUNTS`에 정의되어 있습니다.

### 9.5 검증용 계산 예시

**축 이동 시간 (긴 거리)**
```
distance=10000mm, v=1000mm/s, a=500mm/s²
최고속도 도달 필요 거리 = 1000²/500 = 2000mm
가속 2sec + 정속 8000/1000=8sec + 감속 2sec = 12.0 sec
```

**축 이동 시간 (짧은 거리)**
```
distance=500mm, v=1000mm/s, a=500mm/s²
500 < 2000 → 2 × sqrt(500/500) = 2.0 sec
```

**동시 동작**
```
주행 시간=12sec, 승강 시간=8sec → 이동 시간 = max(12,8) = 12.0 sec
```

## 10. Excel 저장 방법

1. `vendor/xlsx.full.min.js` (SheetJS)가 폴더 안에 이미 포함되어 있어 별도 설치가 필요 없습니다.
2. 계산을 먼저 실행한 뒤 상단의 **Excel 저장** 버튼을 클릭합니다.
3. File System Access API를 지원하는 브라우저(Chrome/Edge 최신 버전)에서는
   저장 위치를 직접 선택하는 대화상자가 뜹니다. 취소하거나 미지원 브라우저인 경우
   기본 다운로드 방식(`SC_Calc_Result_YYYYMMDD_HHMMSS.xlsx`)으로 저장됩니다.
4. `vendor/xlsx.full.min.js` 파일이 삭제되거나 손상된 경우에만 "Excel 파일 저장에 실패했습니다.
   xlsx 라이브러리가 포함되어 있는지 확인하세요." 오류 메시지가 표시됩니다.
5. Excel 파일에는 `Summary`, `Segment_Breakdown` 2개 시트가 생성됩니다.

## 11. LocalStorage 저장 방식

- 저장 키: `SC_Calc:lastConfig:v1`
- **설정 저장**: 현재 입력값 전체를 브라우저 LocalStorage에 저장합니다.
- **설정 불러오기**: 저장된 값을 화면에 반영합니다. 저장된 값이 없으면 안내 메시지를 표시합니다.
- **기본값 초기화**: 화면 입력값을 기본값으로 되돌립니다. LocalStorage 삭제 여부는 확인창으로 물어봅니다.
- 앱을 처음 열 때 LocalStorage에 저장된 값이 있으면 자동으로 불러옵니다.
- LocalStorage는 브라우저/PC별로 별도 저장되며 외부로 전송되지 않습니다.

## 12. JSON 설정 내보내기/가져오기

- **설정 JSON 내보내기**: 현재 입력값을 `SC_Calc_Config_YYYYMMDD_HHMMSS.json` 파일로 다운로드합니다.
- **설정 JSON 가져오기**: 선택한 JSON 파일을 읽어 화면에 반영합니다. 형식이 올바르지 않으면 오류 메시지를 표시합니다.
- `sample/sample_config.json`을 예시로 참고할 수 있습니다.

## 13. 사용 시 주의사항

> 본 프로그램의 계산 결과는 설계 검토용 예상값입니다.

> 장비 제조사에서 제공한 공식 사양값, 제어 시퀀스, 안전 인터록 조건, 사내 표준 계산식이 있는 경우
> 해당 기준이 본 프로그램의 기본 계산식보다 우선합니다.

> Dual Cycle 계산은 본 프로그램에서 정의한 기본 시퀀스(입고 Station → 입고 Rack → 출고 Rack → 출고 Station)
> 기준으로 계산됩니다. 실제 장비 시퀀스가 다른 경우 계산 결과가 달라질 수 있습니다.

> 본 프로그램은 서버 없이 Local HTML 방식으로 실행됩니다.

> 외부 CDN을 사용하지 않으며, 필요한 JavaScript 라이브러리는 배포 폴더 내부에 포함해야 합니다.

> Excel 저장을 위해 `vendor/xlsx.full.min.js` 파일이 포함되어 있어야 합니다.

## 14. 브라우저 호환성

- 최신 Chrome, Edge 기준으로 테스트되었습니다.
- 최소 권장 해상도: 1280 × 720 (PC 브라우저 사용 우선, 모바일 최적화 대상 아님)
- 저장 위치 선택(File System Access API)은 Chrome/Edge 최신 버전에서만 지원되며,
  미지원 브라우저에서는 자동으로 일반 다운로드로 대체됩니다.

## 15. vendor/xlsx.full.min.js 포함 안내

`vendor/xlsx.full.min.js`는 [SheetJS](https://sheetjs.com/)의 배포 빌드(Apache-2.0 라이선스)이며,
이 폴더에 이미 포함되어 있습니다. 별도로 내려받거나 설치할 필요 없이 `index.html`을
열면 바로 Excel 저장 기능이 동작합니다.

이 파일은 SheetJS 공식 배포처(`cdn.sheetjs.com`)에서 받은 것이며, 실행 시점에는 어떤
외부 CDN이나 네트워크에도 접속하지 않고 폴더 내부의 로컬 파일로만 로드됩니다
(`index.html`의 `<script src="./vendor/xlsx.full.min.js">`).

버전을 갱신하거나 파일이 손상된 경우, https://sheetjs.com/ 또는
https://github.com/SheetJS/sheetjs 에서 `xlsx.full.min.js`를 다시 받아 같은 경로에
동일한 파일명으로 덮어쓰면 됩니다. 파일이 없으면 계산 기능은 정상 동작하되 Excel 저장
버튼을 눌렀을 때만 오류 메시지가 표시됩니다.

## 16. Dual Cycle 예제 (Layout 참고)

앱 기본값(설정 초기화 시에도 동일)은 아래와 같은 실제 Layout 예제로 채워져 있어,
처음 실행했을 때부터 Dual Cycle의 3구간 시퀀스를 바로 확인할 수 있습니다.
화면 상단의 Layout 다이어그램(SVG)은 표가 아니라 실제 Rack Layout처럼 그려지며,
입력값을 바꾸면 좌표와 화살표가 그 자리에서 다시 그려집니다(주황: 입고 구간, 파랑: 출고 구간).
Rack 내부에는 Cell 배치를 나타내는 회색 격자가 표시됩니다 — Bay/Level Pitch 기준은
1 Bay × 1 Level 단위(Max Bay/Max Level 반영), Rack Size 기준은 10% 간격입니다.
Bay/Level Pitch 기준은 네 모서리에 min/max 좌표((Bay 0, Level 0)~(Max Bay, Max Level))가 표시되고,
Rack Size 기준은 승강(세로) 축에만 0%~100% 눈금이 표시됩니다(주행/가로 축 눈금은 표시하지 않으며,
각 위치의 실제 mm 값은 마커 라벨에 표시됩니다).

Layout: Rack 전체 주행 51000mm × 승강 15000mm. 좌측 하단에 입고 Station(0%),
우측 하단에 출고 Station(100%), Rack 내부에 CELL 1(입고 Rack), CELL 2(출고 Rack)가
있습니다. (최초 참고 이미지 대비 좌우 반전 배치)

| 프로그램 용어 | Layout 상 위치 | Travel(주행) | Lift(승강) |
|---|---|---|---|
| 입고 Station | 좌측 하단 | 0mm (0%) / Bay 0 | 0mm (0%) / Level 0 |
| 입고 Rack | CELL 1 | 40800mm (80%) / Bay 40 | 12000mm (80%) / Level 4 |
| 출고 Rack | CELL 2 | 20400mm (40%) / Bay 20 | 9000mm (60%) / Level 3 |
| 출고 Station | 우측 하단 | 51000mm (100%) / Bay 50 | 0mm (0%) / Level 0 |

Rack Size 기준(%)과 Bay/Level Pitch 기준(Rack Size(Bay Pitch) 1020mm, Rack Size(Level Pitch) 3000mm,
Max Bay 50, Max Level 5)은 같은 위치와 같은 Layout 최대 크기(51000×15000mm)를 나타내도록
맞춰져 있어, 거리 계산 방식을 바꿔도 동일한 구간 거리와 동일한 다이어그램이 나옵니다.

Dual Cycle 3구간 시퀀스와 구간별 이동 거리:

```
1구간: 입고 Station → 입고 Rack   (CELL1)   주행 40800mm, 승강 12000mm
2구간: 입고 Rack(CELL1) → 출고 Rack(CELL2)   주행 20400mm, 승강  3000mm
3구간: 출고 Rack(CELL2) → 출고 Station        주행 30600mm, 승강  9000mm
```

기본 장비 사양(주행 1500mm/s·500mm/s², 승강 800mm/s·300mm/s²)과 부가 시간 기본값 기준
총 Cycle Time은 약 108.2 sec입니다. `sample/sample_config.json`도 동일한 예제를 담고 있습니다.

크레인의 Home Pos(대기 위치)는 특정 Station과 인접한 크레인 초기/대기 지점을 나타내며,
Dual Cycle 계산 자체에는 별도 구간으로 포함되지 않습니다 (계산은 입고 Station에서 시작).

## 17. 축별 속도사양 탭 (주행축 / 승강축 / Fork축 / 전체 시각화)

화면 상단에 탭 5개가 있습니다: **Cycle Time**(기존 계산 화면, 변경 없음), **주행축**, **승강축**,
**Fork축**, **전체 시각화**. 뒤의 4개 탭은 Stacker Crane 각 축의 속도사양(스트로크·목표
최고속도·가속도·감속도)을 입력해 편도 운전 프로파일(사다리꼴/경계/삼각형)을 계산·시각화하는
설계 보조 도구이며, **버튼을 눌러야만** 기존 Cycle Time 계산에 반영됩니다(자동 반영 없음).

### 17.1 계산 방식

내부 계산은 SI 단위(m, m/s, m/s², s)를 사용합니다.

```
S = 스트로크(mm)/1000, V = 목표 최고속도(m/min)/60, a = 가속도(mm/s²)/1000, d = 감속도(mm/s²)/1000
최고속도 도달 필요 거리 Srequired = V²/(2a) + V²/(2d)

S > Srequired  → 사다리꼴 (목표속도 도달, 등속 구간 존재)
S = Srequired  → 경계 프로파일 (목표속도에 순간 도달, 등속 없음)
S < Srequired  → 삼각형 (목표속도 도달 실패, 실제 최고속도 Vpeak = √(2Sad/(a+d)))
```

이 사다리꼴/삼각형 판정식은 기존 Cycle Time의 `calculateAxisTime()`과 물리적으로 동일한 모델입니다
(단위만 mm/mm·s⁻¹/mm·s⁻²에서 m/m·s⁻¹/m·s⁻²로 다를 뿐, 계산 결과는 항상 일치합니다).

가속도·감속도는 **mm/s² / sec** 두 가지 단위를 동시에 입력·확인할 수 있습니다. 둘 중 아무 필드나
값을 바꾸면 나머지 필드가 자동으로 갱신됩니다(계산·저장에 실제로 쓰이는 값은 항상 mm/s²이며,
sec는 그것과 서로 변환되는 보조 입력입니다).

```
mm/s² → sec  : 목표 최고속도까지 도달하는 시간 = V / a  (V = 목표 최고속도, m/s 환산값)
sec → mm/s²  : a = V / sec × 1000
```

sec는 "목표 최고속도까지 도달하는 시간"이며 **스트로크와 무관**합니다. 결과 영역의 "가속시간(Ta)"과는
다른 값일 수 있습니다 — 삼각형 프로파일(스트로크가 짧아 목표속도에 도달하지 못하는 경우)에서는 실제
가속시간이 이 값보다 짧아집니다. 목표 최고속도를 바꾸면 mm/s²는 그대로 유지되고 sec만 다시
계산됩니다(가속도는 장비의 물리적 사양이므로 특정 이동의 목표속도가 바뀌었다고 값이 바뀌지 않는다는
전제입니다).

### 17.2 기본값

- **주행축/승강축**: 기존 프로젝트의 장비 사양(주행 1500mm/s·500mm/s², 승강 800mm/s·300mm/s², Rack
  주행 51000mm·승강 15000mm)에서 그대로 가져온 값입니다. 임의의 예제값이 아닙니다.
- **Fork축**: 기존 프로젝트에는 Fork의 스트로크·속도 사양이 없고 "1회당 인출/인입 시간(sec)" 고정값만
  있습니다. 따라서 Fork 기본값(스트로크 1300mm, 30m/min, 가감속 980mm/s²)은 **프로젝트 가정값**이며
  화면에도 이 사실이 표시됩니다. 실제 사양으로 바꿔서 사용하세요.

### 17.3 기존 Cycle Time에 적용

- **주행축/승강축** [Cycle Time에 적용]: 계산된 V(m/s→mm/s)·a(m/s²→mm/s²)를 기존 "주행/승강 최대
  속도·가감속도" 입력칸에 씁니다. 기존 Cycle Time 모델은 가속도와 감속도를 항상 같은 값으로 가정하므로,
  가속도(a) ≠ 감속도(d)로 입력한 경우 **가속도(a) 값만 반영**되고 화면에 안내 메시지가 표시됩니다.
- **Fork축** [Cycle Time에 적용]: 계산된 편도 운전시간을 기존 "포크 인출 시간"·"포크 인입 시간" 두
  입력칸에 동일하게 씁니다(1차 범위에서는 인출/인입에 같은 속도사양을 사용하는 것으로 가정).
- 적용 전 각 탭 하단에 "기존값 vs 계산값(적용 시)"을 미리 계산해서 보여줍니다. 적용 후 축 입력을
  다시 바꾸면 상태가 "적용됨"에서 "설정 변경됨 / Cycle Time 재적용 필요"로 바뀝니다.
- [Cycle Time에 적용]을 누르면 적용과 동시에 현재 입력값 전체가 기존 "설정 저장" 버튼과 동일하게
  LocalStorage(`SC_Calc:lastConfig:v1`)에 저장됩니다. 다음에 앱을 열면 자동으로 불러와집니다.
- [Cycle Time에 적용]은 그 값을 Cycle Time의 **기본값(초기값)** 으로도 갱신합니다. 이후 같은
  세션에서 Cycle Time 탭의 "기본값 초기화"를 눌러도 원래 예제값이 아니라 방금 적용한 축 계산값으로
  되돌아갑니다(주행축/승강축/Fork축 세 탭 모두 동일하게 동작).
- **축 탭 자체의 입력값**(스트로크·목표 최고속도·가속도·감속도)도 [Cycle Time에 적용]을 누른 시점에
  별도의 LocalStorage 키(`SC_Calc:axisSettings:v1`, 축별로 독립 저장)에 저장됩니다. 화면을
  새로고침하거나 앱을 다시 열어도 각 축 탭은 원래 예제값이 아니라 **마지막으로 적용한 입력값**으로
  열립니다.
- [현재 축 초기화]는 해당 축을 **마지막으로 적용한 값**으로 되돌립니다(입력칸을 실험적으로 바꿔봤다가
  되돌리는 용도). 그 축을 한 번도 적용한 적이 없으면 원래 기본값으로 되돌립니다. 메인 Cycle Time
  전체를 원래 기본값으로 초기화하려면 기존의 "기본값 초기화" 버튼(Cycle Time 탭)을 사용하세요.

### 17.4 전체 시각화 탭

주행·승강·Fork 세 축의 운전시간과 프로파일을 비교표로 보여주고, 전체 Cycle Time을 가로 타임라인으로
표시합니다. **주행·승강은 기존 계산식대로 동시 운전(max)** 이며, 타임라인에서 실제 두 축이 겹치는
구간으로 표시됩니다. 반면 포크 동작·Load/Unload·위치 결정·통신확인·여유시간은 기존 계산식에서
**합산으로만 정의**되어 있어 그 사이의 실제 시간 순서(어느 것이 먼저 일어나는지)는 기존 코드에서
확인할 수 없었습니다 — 타임라인은 화면 표시 순서를 그대로 사용한 것이며, 실제 제어 시퀀스가 있다면
별도로 반영이 필요합니다(탭 안내 문구에도 명시되어 있습니다).

### 17.5 설계 보조 도구 안내

이 계산은 등가속도(사다리꼴/삼각형) 모델이며 실제 설비 성능·안전을 보증하지 않습니다. 인버터 제어
특성, S-커브, 저크, 제어 지연, 기계 백래시, 진동, 휠 슬립, 하중 변화, 비상정지 및 안전 규격은
포함하지 않으며, 모터·감속기·브레이크·회생장치 선정 기능도 없습니다. "축별 편도 운전시간"과
"전체 Stacker Crane Cycle Time"은 서로 다른 값이니 혼동하지 마십시오.
