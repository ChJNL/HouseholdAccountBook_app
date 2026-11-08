# GitHub Copilot 작업 인수인계

작성일: 2026-11-08

## 1. 이 문서로 이어서 할 작업

사용자는 APK를 업데이트할 때마다 USB로 파일을 옮기는 과정을 번거롭게 느낀다. 현재 앱 개발 내용을 이어받고, USB 없이 APK를 업데이트할 수 있는 작업 계획을 먼저 제시한다.

후속 작업 후보는 다음 두 가지다. 사용자는 무선 설치와 GitHub 다운로드 방식에 대한 설명을 받은 상태이며, 두 방식 중 하나의 구현을 별도로 승인한 상태는 아니다.

1. 개발 중에는 같은 와이파이에서 무선 ADB로 태블릿에 업데이트 설치한다.
2. 배포 시에는 GitHub Releases에 APK를 첨부하고 최신 APK를 받는 고정 링크를 제공한다.

이 문서를 작성한 작업에서는 무선 연결, 기기 설치, GitHub Release 생성, 원격 푸시를 실행하지 않았다.

## 2. 사용자 지침

- 사용자에게는 한국어로만 설명하고 보고한다. 명령어, 경로, 프로그램 이름은 원문을 유지한다.
- 새 작업 전에 현재 상태를 확인하고 단계별 계획을 제시한다. 각 단계를 `작업 스텝`으로 명명하고 사용자 승인 후 실행한다.
- 승인한 범위에서 직접 작업하고 단계별로 작업·검증·요청·상태를 보고한다.
- 사용자가 직접 수동으로 기능과 화면을 확인한다. 자동 테스트, 브라우저 자동 검증, 에뮬레이터 검증을 추가로 실행하지 않는다.
- 개발과 APK 빌드는 진행할 수 있다. 빌드 성공을 실제 태블릿에서의 동작 확인으로 표현하지 않는다.
- APK를 전달할 때 파일 이름과 정확한 위치를 함께 알린다.
- 데스크톱과 태블릿 화면을 우선 고려한다. 태블릿 가로·세로 방향을 지원한다.
- 골드 계열 노란색 디자인을 유지한다. 초록색 중심으로 되돌리지 않는다.
- 기존 사용자 기록을 자동으로 초기화하거나 앱 삭제를 기본 해결 방법으로 제안하지 않는다.

## 3. 저장소와 현재 기준

| 항목 | 내용 |
| --- | --- |
| 저장소 | https://github.com/ChJNL/HouseholdAccountBook_app |
| 로컬 작업 폴더 | `C:\Users\skjam\OneDrive\Desktop\HouseholdAccountBook_app` |
| 작성 시 브랜치 | `main` |
| 문서 작성 전 기준 커밋 | `8d66507` / `Update 1.0.1` |
| 웹 패키지 버전 | `1.0.1` |
| Android 버전 | `versionName = 1.0.1`, `versionCode = 2` |
| 미리보기 앱 ID | `io.chagok.accountbook.dev` |
| 정식 앱 ID | `io.chagok.accountbook` |
| 사용자 확인 기기 | 레노버 태블릿. 정확한 모델·Android·WebView 버전은 확인되지 않았다. |

다른 환경에서 이어받으면 브랜치와 파일 상태를 다시 확인한다. 이 문서에 적힌 로컬 경로를 다른 PC에 그대로 적용하지 않는다.

## 4. 앱 구조와 기능

로그인, 금융 연동, 백엔드, 외부 금융 API 없이 사용하는 가계부다. HTML·CSS·Vanilla JavaScript 화면을 Android WebView에서도 사용한다.

- 메인: 총 자산, 오늘 남은 예산, 월 수입·지출, 목표 저축액, 최근 지출, 남은 고정비.
- 돈 쓰기 / 벌기: 계좌별 수입·지출과 날짜·카테고리·감정 태그 입력.
- 내역 보기: 월별 조회, 검색, 유형·카테고리·감정 필터, 수정·삭제.
- 지출 분석: 전월 동기간 비교, 카테고리 상위 5개, 소비 속도, 낭비 지출.
- 내 계좌 모음: 등록, 잔액 조정, 대표 계좌, 보관·복원.
- 고정비 스케줄러: 반복 지출, 납부 처리, 반복 중단, 미납 금액과 가용 자산.
- 설정: 가계부 이름, 월별 목표, JSON 백업·복원.

| 파일 | 역할 |
| --- | --- |
| `web/index.html` | 기본 화면, 메뉴, 대화상자, 시작 안내. |
| `web/boot.js` | 시작 오류 안내. 구형 문법으로 작성한 별도 부트스트랩. |
| `web/app.js` | 화면 렌더링, 메뉴·버튼, 입력, 복구 안내. |
| `web/core.js` | 계좌·거래·예산·고정비·통계 계산. |
| `web/storage.js` | 첫 실행과 기존 기록 복원 분리, 저장, 백업. |
| `web/compat.js` | 호환 기능과 식별자 생성. |
| `web/styles.css` | 골드 색상, 데스크톱·태블릿 반응형 화면. |
| `web/sw.js` | 웹 화면의 오프라인 캐시. APK에서는 등록하지 않는다. |
| `scripts/build.mjs` | esbuild로 ES2017 단일 실행 파일을 생성하고 정적 파일을 `dist/`에 모은다. |
| `scripts/serve.mjs` | 웹 빌드 후 개발 서버 실행과 변경 시 재빌드. |
| `android/app/src/main/java/io/chagok/accountbook/MainActivity.kt` | 로컬 파일 로딩, 시스템 여백, 뒤로 이동, Android JSON 입출력. |
| `android/app/build.gradle.kts` | 버전·앱 ID·웹 빌드와 파일 포함 설정. |
| `.github/workflows/pages.yml` | 웹 빌드와 GitHub Pages 배포 절차. APK 배포 기능은 없다. |

## 5. 최근 문제와 수정 상태

### 사용자에게 보고받은 문제

- 레노버 태블릿에서 첫 실행이 진행되지 않고 버튼이 동작하지 않았다.
- 초록색 디자인이 적용되어 사용자가 원한 골드 계열 노란색과 달랐다.

### 1.0.1에서 수정한 내용

- 빈 가계부 화면과 메뉴를 먼저 생성하고 저장 데이터 복원은 별도로 수행한다.
- 저장 데이터가 없으면 기존 기록의 파싱·복원을 시도하지 않는다.
- 손상 기록은 보존한다. 빈 임시 화면과 복구 안내를 제공하고 기존 기록을 읽지 못한 상태의 저장은 제한한다.
- 초기화 오류가 발생했을 때 모든 메뉴 이동을 일괄 차단하던 처리를 제거했다.
- 필수 기능에서 `Object.hasOwn`, `Array.at`, `structuredClone`, `crypto.randomUUID`의 직접 의존을 제거했다.
- 웹 코드를 `app.bundle.js`로 묶어 ES2017 문법의 일반 스크립트로 실행한다. 원본 `app.js`를 모듈로 직접 로드하는 구조로 되돌리지 않는다.
- 시작 파일 로딩 오류와 다시 시작 버튼을 제공한다.
- 기본 대화상자 API를 지원하지 않는 환경의 대체 처리를 추가했다.
- Android 시스템 여백은 WebView 바깥 컨테이너에 적용한다. 로컬 JavaScript와 CSS 응답의 MIME 형식을 지정한다.
- 골드 색상과 아이콘을 적용하고 Android 버전 코드를 2로 올렸다.

### 확인한 범위

`1.0.1` 웹 파일 생성과 Android 미리보기·서명 전 릴리스 APK 빌드는 성공했다. 수정본의 레노버 태블릿 실행 결과는 아직 전달받지 못했다. 실제 태블릿 오류의 최초 원인은 확정되지 않았으며, 위 변경을 실기기에서 확인한 해결 결과로 표현하면 안 된다.

사용자는 참고 이미지를 처음 전달했다고 설명했다. 이 대화에서 확인 가능한 내용에는 `!image.png` 문구만 남아 있어 실제 이미지를 확인하지 못했다. 현재 디자인이 그 이미지와 일치한다고 주장하지 않는다.

현재 적용한 색상은 다음과 같다.

- 주요 골드: `#E6BD4B`
- 밝은 골드: `#F2CD64`
- 아이보리 배경: `#FAF8F1`
- 짙은 배경: `#24221D`

## 6. 데이터와 계산에서 유지할 기준

- 저장 키는 `household-book:v1`이며 데이터 형식 버전은 1이다. 앱 버전 변경만으로 이 키를 바꾸지 않는다.
- 웹과 APK는 각각의 저장소를 사용한다. 기기 간 자동 동기화는 없고 JSON 백업으로 이동한다.
- Android 로컬 콘텐츠의 출처는 `https://appassets.androidplatform.net/assets/`다. 출처 변경은 기존 기록 접근에 영향을 줄 수 있다.
- 계좌 잔액은 시작 잔액과 거래 합계로 계산한다. 수정·삭제 때 잔액을 중복 차감하지 않는다.
- 잔액 직접 조정은 수입·지출 통계에서 제외한다.
- 고정비는 예정일만으로 자동 출금하지 않는다. 납부 거래와 연결하고 변동비에서 중복 차감하지 않는다.
- 월별 목표와 고정비 스냅샷을 보존한다.
- 손상 데이터나 저장 실패 때 원본을 자동 삭제하지 않는다.
- APK에는 로컬 화면을 포함한다. 현재 앱은 인터넷 권한을 요청하지 않는다. PC에서의 무선 설치를 위해 앱 인터넷 권한을 추가할 필요는 없다.

자세한 계산 규칙은 [DEVELOPMENT.md](DEVELOPMENT.md)를 읽는다.

## 7. 실행과 APK 빌드

필요 도구는 Node.js 20.11 이상, JDK 17 이상, Android SDK 36, Gradle 8.14.3이다. Android 최소 버전은 8.0이다. 웹 빌드 도구는 `esbuild`이며 현재 잠금 파일에 버전을 고정했다.

프로젝트 루트에서 실행한다.

```powershell
npm ci
npm run dev
```

웹 배포 파일만 생성한다.

```powershell
npm run build
```

Android 미리보기 APK를 생성한다. Gradle이 웹 빌드와 `dist/` 파일 포함을 수행한다.

```powershell
cd android
.\gradlew.bat :app:assembleDebug
```

기본 출력 파일은 `android/app/build/outputs/apk/debug/app-debug.apk`다. `:app:assembleRelease`의 현재 출력은 서명하지 않은 릴리스 APK이므로 그대로 설치용 파일로 전달하지 않는다.

OneDrive 경로에서 Kotlin 빌드 캐시 파일 잠금 오류가 있었다. 해당 환경에서는 별도 빌드 경로를 지정했다. 경로는 작업 PC에 맞게 결정한다.

```powershell
.\gradlew.bat "-PchagokBuildRoot=C:/Users/skjam/OneDrive/Desktop/HouseholdAccountBook_app/.build/android-gold-1.0.1" :app:assembleDebug
```

이 옵션을 사용하면 위 경로 아래 `app/outputs/apk/debug/app-debug.apk`에 생성된다. 기본 출력 경로와 혼동하지 않는다.

현재 작업 PC의 Gradle 캐시 접근과 공식 의존성 다운로드에는 별도 실행 권한 승인이 필요했다. 이 환경의 권한 문제를 앱 코드 오류로 단정하지 않는다.

## 8. 현재 전달한 생성 파일

파일은 로컬 프로젝트의 `artifacts/` 폴더에 있다.

| 파일 | 용도 |
| --- | --- |
| `chagok-preview-1.0.1-gold.apk` | 사용자에게 전달한 설치용 미리보기 APK. |
| `chagok-release-1.0.1-gold-unsigned.apk` | 정식 서명 전 릴리스 APK. |
| `chagok-web-1.0.1-gold.zip` | `dist/` 폴더를 포함한 웹 배포 압축 파일. |

설치용 APK의 전체 경로는 다음과 같다.

```text
C:\Users\skjam\OneDrive\Desktop\HouseholdAccountBook_app\artifacts\chagok-preview-1.0.1-gold.apk
```

`chagok-preview.apk`, `chagok-release-unsigned.apk`, `chagok-web.zip` 이름의 사본도 최신 생성 파일로 갱신했다.

`artifacts/`, `dist/`, `node_modules/`, `.build/`, Android 빌드 출력과 로컬 SDK 설정은 Git에서 제외한다. 다른 PC나 GitHub의 Copilot에는 소스만 전달되고 이 파일들은 없을 수 있다. 필요한 파일은 다시 빌드하거나 승인된 배포 수단으로 전달한다.

## 9. 후속 작업 A: 무선 설치

계획을 제시하고 승인받은 뒤 진행한다.

1. 작업 스텝 1: 태블릿 Android 버전과 무선 디버깅 지원 여부를 확인한다. Android 11 이상에서의 무선 ADB 연결을 우선 사용한다.
2. 작업 스텝 2: PC와 태블릿을 같은 와이파이에 연결한다. 태블릿의 개발자 옵션 활성화와 무선 디버깅 허용·페어링은 사용자가 기기에서 승인한다.
3. 작업 스텝 3: 기존 Android SDK의 ADB로 페어링한다. 페어링 포트와 실제 연결 포트가 다를 수 있으므로 구분한다.
4. 작업 스텝 4: APK를 빌드하고 지정한 기기에 업데이트 설치하는 스크립트를 만든다. 연결된 기기가 여러 개면 대상 기기를 명시하고, APK 설치는 `adb -s <대상> install -r <APK>` 형태로 처리한다.
5. 작업 스텝 5: 빌드·설치 결과와 APK 위치를 보고한다. 기능 확인은 사용자가 수행한다.

현재 작업 PC에서 확인했던 ADB 위치는 `C:\Users\skjam\AppData\Local\Android\Sdk\platform-tools\adb.exe`다. 다른 환경에서는 SDK 설정에서 찾는다. 페어링 코드와 일시적인 연결 주소를 저장소에 기록하지 않는다.

이 작업에는 앱 내 자동 업데이트 기능을 새로 넣을 필요가 없다.

## 10. 후속 작업 B: GitHub APK 다운로드

무선 설치와 별개로 계획을 제시하고 승인받는다.

1. 작업 스텝 1: 저장소 접근 권한과 배포 범위를 확인하고 수동 APK 첨부 또는 자동 빌드 중 방식을 정한다.
2. 작업 스텝 2: 앱 ID, 서명 키, 증가하는 `versionCode` 정책을 확정한다.
3. 작업 스텝 3: GitHub Releases에 설치 가능한 서명 APK를 첨부한다. 최신 파일의 첨부 이름을 `chagok-preview.apk`처럼 고정한다.
4. 작업 스텝 4: README에 태블릿에서 누를 수 있는 최신 APK 링크를 제공한다.
5. 작업 스텝 5: 자동화까지 승인받았다면 버전 태그를 기준으로 빌드·첨부하는 별도 워크플로를 작성한다. 사용자 요청에 따라 자동 테스트나 기기 검증은 넣지 않는다.

구성이 완료된 뒤 사용할 수 있는 링크 형식은 아래와 같다. 현재 이 주소에 APK가 공개되어 있다고 보장하지 않는다.

```text
https://github.com/ChJNL/HouseholdAccountBook_app/releases/latest/download/chagok-preview.apk
```

현재 `.github/workflows/pages.yml`은 웹 배포용이다. 여기에 APK가 자동으로 배포된다고 설명하지 않는다.

### 서명 키를 먼저 결정해야 하는 이유

기존 앱 위에 업데이트하려면 같은 앱 ID와 같은 서명 키를 유지하고 버전 코드를 올려야 한다. 현재 설치용 APK는 작업 PC의 기본 디버그 서명 설정으로 생성했다.

GitHub Actions의 새 실행 환경에서 기본 디버그 키를 새로 만들면 기존 설치본과 서명이 달라질 수 있다. 자동 배포 전에 기존 서명 유지 방법을 확정한다. 키와 비밀번호를 소스에 기록하거나 로그에 출력하지 않는다. 기존 키를 외부 서비스에 등록하는 작업은 사용자 승인을 받은 뒤 진행한다.

서명 불일치를 앱 삭제로 우회하는 방식을 기본 절차로 만들지 않는다. 정식 앱 ID로 전환하면 미리보기 앱과 별도 앱이 되며 기록 이전 방법도 필요하다.

## 11. 기존 테스트 코드의 상태

테스트 코드는 남아 있지만 최근 수정 후 자동 테스트를 실행하지 않았다. 최신 코드가 모든 기존 테스트를 통과한다고 표현하지 않는다.

소스 확인으로 다음과 같은 이전 가정이 남아 있는 것을 확인했다.

- `tests/storage.test.js`에는 손상 데이터의 `load()`가 예외를 던진다는 이전 기대값이 있다. 현재는 `store.error`에 오류를 보관하고 빈 화면 상태를 제공한다.
- `tests/web.test.js`에는 `app.js`를 모듈로 직접 로드한다는 이전 기대값과 `web/`에서 생성 번들을 찾는 검사가 있다. 현재 실행 파일은 빌드 결과인 `dist/app.bundle.js`다.
- Android 자동 검증용 코드도 남아 있으나 이번 작업에서 실행하지 않았다.

이전 테스트의 가정에 맞추기 위해 첫 실행 분리나 호환 번들 변경을 되돌리지 않는다. 사용자가 자동 검증을 다시 요청하면 현행 명세에 맞게 검토한다.

## 12. Copilot에 붙여 넣을 요청문

> `docs/COPILOT_HANDOFF.md`, `README.md`, `docs/DEVELOPMENT.md`를 읽고 현재 상태를 확인해 주세요. 우선 USB 없이 레노버 태블릿에 APK를 업데이트하는 작업 계획을 제시해 주세요. 개발 중에는 무선 ADB 설치를, 배포 시에는 GitHub Releases의 최신 APK 다운로드 링크를 검토해 주세요. 구현 전에 사용자 승인을 받고, 모든 설명과 보고는 한국어로 작성해 주세요. 자동 테스트와 기기 검증은 실행하지 말고 기능 확인은 제가 직접 하겠습니다. 기존 데이터, 골드 색상, 앱 ID와 업데이트 서명 조건을 유지하고 완료 시 APK 이름과 정확한 위치를 알려 주세요.

## 13. 참고 문서

- [프로젝트 실행과 사용 방법](../README.md)
- [개발 기준과 데이터 규칙](DEVELOPMENT.md)
- [사용자 수동 확인 안내](MANUAL_REVIEW.md)
- [Android 공식 무선 ADB 안내](https://developer.android.com/tools/adb#wireless)
- [GitHub 공식 최신 Release 링크 안내](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases)
