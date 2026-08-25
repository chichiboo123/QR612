# QR612

**https://qr612.chichiboo.link**

URL을 입력하면 그 URL을 인코딩한 QR코드를 **어린왕자 세계관의 4가지 테마 3D 씬**으로
보여주는 웹앱입니다. 아이소메트릭 뷰에서는 하나의 장면처럼 보이지만,
**화면을 탭하면 탑다운 뷰로 전환되며 실제로 스캔 가능한 QR코드**가 됩니다.

모든 처리는 브라우저 안에서 끝나며, 입력한 URL은 어떤 서버로도 전송되지 않습니다.

## 테마

| 테마 | 설명 | 팔레트 |
|---|---|---|
| **B612** | 완만한 구면(리틀 플래닛) 위의 블록 그리드 + 바오밥나무 · 화산 · 작은 의자, 지평선에 낮게 걸린 여러 개의 태양 | 세이지그린 `#8FA998` · 코발트블루 `#2C5F8A` |
| **별이 빛나는 밤하늘** | dark 모듈만 낮은 발광 강도의 별로, light 모듈은 어두운 배경으로 남겨 은하수 대비를 만듦. 작은 행성 가장자리의 어린왕자 실루엣 | 딥네이비 `#0D1B3E` · 골드 `#F2C14E` |
| **사막과 여우** | 블록 높이차로 모래 언덕(사구)을 표현. 여우 실루엣 · 작은 우물 · 절차적으로 이어지는 발자국 트레일 | 선셋오렌지 `#E8896B` · 샌드베이지 `#E8D5B5` |
| **장미** | 유리돔 안 원형 정원 타일. 중심의 로우폴리 장미 한 송이와 작은 물뿌리개 | 로즈핑크 `#E8A0B4` · 미드나잇그린 `#1F3D2E` |

> 모든 오브젝트는 기본 도형(박스 · 원뿔 · 구 · 실린더)만 조합해 만든 독자적인 로우폴리
> 실루엣입니다. 생텍쥐페리 원작 삽화를 재현하지 않습니다.

## 실행

```bash
npm install
npm run dev       # 개발 서버 (http://localhost:5173)
npm run build     # 프로덕션 빌드 → dist/
npm run preview   # 빌드 결과 미리보기
```

## 구조

```
QR612/
├── index.html
├── vite.config.js
├── .github/workflows/
│   └── deploy.yml            # GitHub Pages 자동 배포
├── public/
│   ├── CNAME                 # 커스텀 도메인 (qr612.chichiboo.link)
│   └── favicon.svg
└── src/
    ├── main.js               # 앱 조립 · 상태 · 공유 파라미터 처리
    ├── core/
    │   ├── qrEncode.js       # URL → boolean 매트릭스 (테마·Three.js 무관)
    │   ├── sceneEngine.js    # 매트릭스 → InstancedMesh 블록 그리드 (테마 무관 공통 엔진)
    │   └── transition.js     # progress(0~1) 기반 3D↔2D 보간 (순수 계산 계층)
    ├── themes/
    │   ├── _shared.js        # 로우폴리 프리미티브 헬퍼
    │   ├── b612.js
    │   ├── starryNight.js
    │   ├── desertFox.js
    │   ├── rose.js
    │   └── index.js          # 테마 레지스트리
    ├── ui/
    │   ├── urlInput.js
    │   ├── themePicker.js
    │   ├── shareButton.js
    │   ├── credits.js
    │   └── footer.js
    └── styles/
        └── main.css          # KRDS / 치치부 디자인 변수
```

### 3D ↔ 2D 전환

카메라의 FOV · 고도 · 방위각 · 거리, 블록 높이, 블록 XZ 스케일, 장식 투명도,
색상 평탄화, 구면 곡률, 안개를 **단일 `progress` 값(0~1)** 으로 보간합니다.

- `progress = 0` — 완전한 아이소메트릭 3D 씬 (FOV 42°, 고도 31°)
- `progress = 1` — 완전한 탑다운 스캔 뷰 (FOV 7°, 고도 89.4°)

FOV를 아주 작게 주고 카메라를 멀리 떨어뜨려 **원근 왜곡이 거의 없는 정사영에 가까운
탑다운 뷰**를 만드는 것이 스캔 성공률의 핵심입니다.

### 스캔 가능성 보장

장식이 대비를 해치지 않도록 여러 겹의 안전장치를 둡니다.

1. **장식 완전 페이드아웃** — 장식·배경 오브젝트는 `progress ≈ 0.42` 에서 이미 완전히 사라집니다.
2. **블록 XZ 스케일 1.0** — 탑다운에서 모듈 사이 틈이 생기지 않도록 정확히 맞물립니다.
3. **emissive 평탄화** — 조명·안개의 영향을 제거하고 순수 스캔 색상만 출력합니다.
4. **스캔 보장 오버레이** — `progress ≥ 0.86` 부터 "정확히 1×1 모듈, 순수 흑백,
   quiet zone 포함" 평면이 페이드인되어 최종 QR을 그립니다.
   덕분에 테마는 블록 지오메트리를 자유롭게(별 모양, 원형 타일 등) 쓸 수 있습니다.
5. **에러 정정 레벨 Q** — 약 25% 복원 여유를 확보합니다.

`.scratch/verify.mjs` 성격의 헤드리스 검증(4개 테마 × 모바일/데스크톱 뷰포트에서
탑다운 화면을 캡처해 QR 디코더로 되읽기)으로 스캔 가능 여부를 확인했습니다.

### 테마 인터페이스

`src/themes/{themeName}.js` 는 아래 인터페이스를 따르며, 공통 엔진 위에
플러그인처럼 갈아끼울 수 있습니다.

```js
getBlockGeometry(isDark)  // → { geometry, material, height }  블록 지오메트리/재질
getPalette()              // → { dark, light, ground, sky, scanDark, scanLight, ... }
placeDecorations(size)    // → [{ type, position, rotation, scale }]  배치 좌표 배열
getBackgroundSetup()      // → { background, fog, lights, objects }
```

선택 확장:

```js
getCurvature()            // → 구면 배치 강도 (0 = 평면)
buildDecoration(spec)     // → THREE.Object3D  (배치 스펙 → 실제 오브젝트)
```

블록 지오메트리는 엔진이 **밑면 1×1, 높이 1, 원점은 밑면 중앙**으로 정규화하므로
테마는 크기를 신경 쓰지 않고 형태만 정의하면 됩니다.

## 공유 링크

현재 URL과 선택한 테마는 쿼리 파라미터로 인코딩됩니다.

```
https://<host>/?url=<encodeURIComponent(URL)>&theme=b612
```

공유받은 사람이 이 링크로 접속하면 동일한 씬이 그대로 재생성됩니다.
테마를 바꾸거나 새로 생성할 때마다 주소창도 같은 형식으로 갱신됩니다.

## 디자인 시스템

UI 크롬(입력창 · 버튼 · 테마 카드 · 헤더 · 푸터)은 치치부 웹앱 표준을 따릅니다.

- 폰트: Pretendard GOV (폴백 Pretendard, `pretendard@v1.3.9` CDN)
- 아이콘: Google Material Icons Outlined
- 색상: KRDS 기반 (`--color-primary: #006DD2` 등)
- 컴포넌트: border-radius 8px 기준, 은은한 box-shadow
- 반응형: 480 / 768 / 1024px 브레이크포인트, 모바일 우선
- 푸터 고정 삽입: [교육뮤지컬 꿈꾸는 치수쌤](https://litt.ly/chichiboo)

3D 씬 내부 색상은 위 표준이 아니라 각 테마 팔레트를 따릅니다.

## 배포

**https://qr612.chichiboo.link** — GitHub Actions 로 GitHub Pages 에 자동 배포됩니다.

기본 브랜치에 push 되면 `.github/workflows/deploy.yml` 이 돌면서
`npm ci` → `npm run build` → `dist/` 를 Pages 아티팩트로 업로드하고 배포합니다.
Actions 탭에서 `workflow_dispatch` 로 수동 실행할 수도 있습니다.

커스텀 도메인은 `public/CNAME` 에 담겨 있어 빌드할 때마다 `dist/CNAME` 으로 복사됩니다.
워크플로에 이 파일의 존재를 확인하는 단계를 넣어두었으므로, 실수로 지워지면 배포가
성공한 뒤 도메인이 풀리는 대신 빌드 단계에서 바로 실패합니다.

DNS 는 `qr612` 서브도메인에 CNAME 레코드로 `chichiboo123.github.io` 를 가리키면 됩니다.
저장소 Settings → Pages 에서 **Enforce HTTPS** 를 켜두는 것을 권장합니다.

정적 사이트이므로 다른 호스팅(Cloudflare Pages, Netlify 등)에 올릴 수도 있습니다.
빌드 명령 `npm run build`, 출력 디렉터리 `dist`, Node 18 이상이면 되고,
`vite.config.js` 의 `base: './'` 덕분에 서브 경로 배포에서도 동작합니다.

## 아이디어를 얻은 곳

**QR 매트릭스를 3D 오브젝트의 배치와 높이로 인코딩하고, 카메라 전환으로 2D 스캔 뷰를
드러낸다**는 구조적 아이디어는 아래 작업들에서 얻었습니다.

- [tree.icqr.com](https://tree.icqr.com/) — URL을 3D 나무와 QR코드로 바꾸는 서비스
  (by [@logotypercom](https://x.com/logotypercom))
- [@reactiive_](https://x.com/reactiive_)

QR612 는 나무 모티브 대신 어린왕자 모티브로 완전히 다르게 재해석했으며,
코드와 에셋은 어느 것도 가져오지 않고 모두 독자적으로 구현했습니다.

---

Created by. 교육뮤지컬 꿈꾸는 치수쌤 — https://litt.ly/chichiboo
