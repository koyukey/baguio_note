# Baguio Study App 🌲

필리핀 바기오 어학연수 동반자. 시간표, 할 일, 루틴, 영어 학습, 가계부.

## 🚀 가장 빠른 배포 — GitHub + Vercel (약 10분)

Node.js 설치 안 해도 됩니다. 브라우저만 있으면 OK.

### 1단계 — GitHub에 코드 올리기

1. https://github.com 가입 (없으면)
2. 우측 상단 `+` → **New repository**
3. Repository name: `baguio-app` (아무거나)
4. Public 선택 → **Create repository**
5. 다음 화면에서 **uploading an existing file** 클릭
6. 압축 푼 이 폴더의 모든 파일을 드래그해서 업로드
   - `src/` 폴더 통째로
   - `public/` 폴더 통째로
   - `package.json`, `vite.config.js`, `index.html`, `.gitignore` 파일들
   - (`node_modules`는 없을 거예요 — 원래 안 올리는 거)
7. 하단 **Commit changes** 클릭

### 2단계 — Vercel 연결

1. https://vercel.com 접속 → **Sign Up** → **Continue with GitHub**
2. 가입 완료되면 대시보드에서 **Add New... → Project**
3. 방금 만든 `baguio-app` 옆 **Import** 클릭
4. 설정은 그대로 두고 **Deploy** 클릭
5. 1~2분 기다리면 `https://baguio-app-xxxx.vercel.app` 같은 주소 생성됨

### 3단계 — 핸드폰에서 홈 화면에 추가

**iPhone (Safari)**
1. Safari로 Vercel 주소 열기
2. 하단 공유 버튼 📤 탭
3. **홈 화면에 추가** 선택 → **추가**

**Android (Chrome)**
1. Chrome으로 Vercel 주소 열기
2. 우측 상단 ⋮ 메뉴 탭
3. **앱 설치** 또는 **홈 화면에 추가**

이제 홈 화면에 아이콘이 생기고, 탭하면 진짜 앱처럼 풀스크린으로 열립니다.

## 💾 데이터 저장 안내

- 데이터는 핸드폰 브라우저의 **localStorage**에 저장됨
- 같은 브라우저에서 다시 열면 그대로 유지
- ⚠️ 브라우저 데이터 초기화하면 사라짐 — 중요한 메모는 가끔 백업
- ⚠️ 다른 기기와 동기화 안 됨 (기기별 따로 저장)

## 🛠 로컬에서 테스트하고 싶다면

Node.js 18+ 설치 (https://nodejs.org) 후:

```bash
npm install
npm run dev
```

http://localhost:5173 에서 열림.

## 🔄 코드 수정

GitHub에서 파일 편집 → 저장하면 Vercel이 자동 재배포 (1~2분).

대부분의 수정은 `src/BaguioApp.jsx`에서. 그 외:
- 아이콘 변경: `public/icon.svg`
- 글로벌 스타일: `src/index.css`
- 메타데이터: `index.html`

## 📁 파일 구조

```
baguio-app/
├── index.html              # HTML 엔트리
├── package.json            # 의존성
├── vite.config.js          # 빌드 설정
├── src/
│   ├── main.jsx            # React 진입점
│   ├── BaguioApp.jsx       # 메인 앱 (모든 로직)
│   └── index.css           # 글로벌 스타일
└── public/
    ├── icon.svg            # 앱 아이콘
    └── manifest.json       # PWA 매니페스트
```

## 🌿 Mabuhay!

Salamat po. 🇵🇭
