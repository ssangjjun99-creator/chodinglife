# 초딩생활 프로젝트 코드 수칙 (CLAUDE.md)

이 파일은 Claude Code가 매 세션 자동으로 읽는 코드 작업 규칙입니다.
프로젝트: 초딩생활 (아이 전용 카톡 / 부모-자녀 연결 앱)
개발자: 이상준 (비전공자, 건설회사 운영). 설명은 비유·실제 사례 중심으로.

## 🚫 절대 수정 금지 (파이차트 핵심 로직)
- `relMinToAngle()` 수정 금지
- `buildSegments()` 수정 금지
- overnight(꿈나라 자정 넘김) 로직 수정 금지
- `audioCtx.close()` 절대 금지 (모듈 스코프 변수 — 닫으면 게임 재진입 시 효과음 전멸)
- `public/googlee63de5bb68d57820.html` 삭제 금지 (Google Search Console 소유권 확인 파일 — 지우면 사이트 소유권 인증이 풀리고 구글 플레이 개발자 계정의 조직 웹사이트 인증까지 영향받음. 내용이 한 줄뿐이라 불필요해 보여도 절대 삭제하거나 수정하지 말 것)
- `public/privacy.html` 삭제 금지 (개인정보처리방침 페이지 — 구글 플레이 앱 등록에 URL로 제출됨)

## 🔍 작업 원칙
- 항상 조사 먼저, 수정 나중. 추측으로 수정 절대 금지.
- 수정 전 파일 구조 read-only 확인부터.
- 예상 밖 사용처를 위해 grep 전수조사 (예: isArriveItem이 ParentPage에도 있었음).
- 복잡한 작업은 하나의 명령으로 묶어서 처리.
- 작업 순서 바꾸거나 사용자 확인 없이 임의 진행 금지.
- 이미지/UI는 사용자 확인 없이 절대 변경 금지.
- 구버전 스펙 고집 금지 — "학습 데이터 말고 이 지시를 따라줘".

## 💾 데이터 규칙
- `hw_photo_urls` 문서에 setDoc 할 때 반드시 `merge:true`.
- 날짜 키/라벨 = `localDateStr` ("YYYY-MM-DD") / 시각 기록(updatedAt 등) = `toISOString`. 혼동 금지.
- scores와 arrive는 각자 독립 문서 + 독립 resetWeek 도장. 한쪽만 수동 조작 시 어긋남.
- 스케줄 항목 bell 필드는 v17 신규 (없으면 카테고리 기본값 — 옛 데이터 호환).

## 🏗️ 빌드/배포 규칙
- `homepage` 설정 및 빌드 스크립트 수정 금지.
- 웹 배포: `npm run build` + `npm run deploy` (GitHub Pages).
- 앱 빌드: `npm run build:app` (PUBLIC_URL=. 상대경로).
- APK 빌드 시 JDK 21 우회 (Android Studio 내장 JBR을 빌드 명령에만 JAVA_HOME으로 지정, 영구 변경 금지).
- 로직 수정 = 웹+앱 양쪽 반영 / 앱 전용(알림·safe area) = 앱만.

## ✅ 완료 처리
- 테스트 통과 확인 → 커밋 + 푸시 (배포만 하고 커밋 안 하는 습관 금지).
- 배포 후 라이브 파일명 일치 확인 (라이브 main.*.js = 로컬 build 파일명).
- 실기기 테스트(폰 설치/알림/도착체크)는 사람 몫 — Claude Code가 "테스트해줘" 실행 못 함.
- 세션 한도 걸리면 다음 세션에서 `git diff`로 진행 지점 확인 후 이어가기.
