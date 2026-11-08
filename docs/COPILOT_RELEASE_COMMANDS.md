# Copilot 전달용 릴리스 갱신 명령어

대상 저장소: `ChJNL/HouseholdAccountBook_app`

대상 버전: `1.0.4` / 태그 `v1.0.4` / Android 버전 코드 5

이 문서는 명령어 전달용이다. 이번 개발 작업에서는 GitHub 릴리스를 생성·수정하거나 원격 저장소에 푸시하지 않는다. 실제 게시 작업은 사용자가 Copilot에 실행을 요청한 뒤 진행한다.

## 1. 준비

- 프로젝트 루트에서 PowerShell을 사용한다. `gh`는 GitHub CLI다.
- 버전 1.0.4의 소스 변경을 검토하여 커밋하고 원격 저장소에 반영한다. 무관한 변경을 함께 커밋하지 않는다.
- 설치용 파일은 `artifacts/chagok-v1.0.4.apk`다. 사용자 금융 기록과 서명하지 않은 릴리스 APK를 첨부하지 않는다.
- 기존 설치본에 업데이트하려면 앱 ID와 서명 키를 유지해야 한다. 다른 PC나 GitHub Actions에서 새 디버그 키를 생성한 APK는 기존 설치본과 서명이 다를 수 있다. 서명 키를 소스에 넣지 않는다.
- 자동 테스트와 기기 검증은 실행하지 않는다. APK 빌드는 수행할 수 있다.

```powershell
gh auth status
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI 로그인을 먼저 완료해야 합니다.' }

git status --short
git log -1 --oneline

$taskVersion = (Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json).version
if ($taskVersion -ne '1.0.4') { throw '이 문서는 1.0.4 릴리스용입니다. 버전을 먼저 확인해 주세요.' }
$taskRepo = 'ChJNL/HouseholdAccountBook_app'
$taskTag = "v$taskVersion"
$taskApk = Join-Path (Get-Location).Path "artifacts/chagok-v$taskVersion.apk"
$taskNotes = Join-Path (Get-Location).Path 'docs/RELEASE_NOTES_1.0.4.md'
if (!(Test-Path -LiteralPath $taskApk -PathType Leaf)) { throw '설치용 APK가 없습니다. 아래 빌드 절차로 생성해 주세요.' }
$taskCommit = (git rev-parse HEAD).Trim()
```

`$taskCommit`은 1.0.4 변경 사항을 포함하고 원격 저장소에도 존재하는 커밋이어야 한다. 로컬에만 있는 변경으로 APK를 만들고 과거 원격 커밋에 릴리스 태그를 붙이지 않는다.

## 2. APK가 없을 때 빌드

기존 설치본과 같은 서명 환경에서 실행한다. Android SDK 경로는 해당 PC의 환경에 맞게 설정한다.

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw '빌드 도구 설치에 실패했습니다.' }

Push-Location android
try {
    .\gradlew.bat :app:assembleDebug
    if ($LASTEXITCODE -ne 0) { throw 'APK 빌드에 실패했습니다.' }
} finally {
    Pop-Location
}

New-Item -ItemType Directory -Path artifacts -Force | Out-Null
Copy-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk' -Destination 'artifacts/chagok-v1.0.4.apk' -Force
```

`-PchagokBuildRoot=절대경로`를 사용했다면 기본 경로 대신 지정한 경로 아래 `app/outputs/apk/debug/app-debug.apk`를 복사한다. 현재 개발 PC에서 생성한 파일은 이미 `artifacts/chagok-v1.0.4.apk`에 정리한다.

## 3. 새 버전 릴리스 만들기

`v1.0.4` 릴리스가 아직 없을 때 사용한다. 태그가 없으면 `--target`으로 지정한 커밋에서 생성한다. 이전 버전 태그를 강제로 이동하지 않는다.

```powershell
gh release create $taskTag $taskApk --repo $taskRepo --target $taskCommit --title "차곡 $taskVersion" --notes-file $taskNotes --latest
if ($LASTEXITCODE -ne 0) { throw '릴리스 생성에 실패했습니다. 기존 태그와 릴리스 상태를 확인해 주세요.' }

gh release view $taskTag --repo $taskRepo
```

## 4. 같은 버전의 기존 릴리스 파일만 교체하기

`v1.0.4` 릴리스가 이미 있을 때 사용한다. `--clobber`는 같은 이름의 기존 첨부 파일을 지운 뒤 올리므로 같은 버전 파일을 교체할 때만 사용한다. 업로드에 실패하면 기존 첨부 파일이 사라질 수 있다. 이전 버전 릴리스를 자동 삭제하지 않는다.

```powershell
gh release upload $taskTag $taskApk --repo $taskRepo --clobber
if ($LASTEXITCODE -ne 0) { throw 'APK 업로드에 실패했습니다. 첨부 파일 상태를 확인해 주세요.' }

gh release edit $taskTag --repo $taskRepo --title "차곡 $taskVersion" --notes-file $taskNotes --latest
if ($LASTEXITCODE -ne 0) { throw '릴리스 설명 갱신에 실패했습니다.' }

gh release view $taskTag --repo $taskRepo
```

## 5. 사용자에게 전달할 주소

릴리스 게시 성공을 확인한 뒤 안내한다. 현재 이 주소에 파일이 게시되어 있다고 가정하지 않는다.

```text
https://github.com/ChJNL/HouseholdAccountBook_app/releases/download/v1.0.4/chagok-v1.0.4.apk
```

파일 이름에 버전을 넣기 때문에 버전이 바뀌면 직접 다운로드 주소도 바뀐다. 최신 릴리스 목록을 여는 고정 주소는 다음과 같다.

```text
https://github.com/ChJNL/HouseholdAccountBook_app/releases/latest
```

## 6. Copilot에 붙여 넣을 요청문

> `docs/COPILOT_HANDOFF.md`와 `docs/COPILOT_RELEASE_COMMANDS.md`를 읽고 릴리스 갱신 계획을 먼저 설명해 주세요. 승인 후 `ChJNL/HouseholdAccountBook_app` 저장소의 `v1.0.4` 릴리스에 설치용 `artifacts/chagok-v1.0.4.apk`를 게시해 주세요. 새 버전이면 새 릴리스를 만들고 같은 버전이면 첨부 파일과 설명을 갱신해 주세요. 소스 커밋, APK 버전, 앱 ID와 서명 유지 조건을 확인해 주세요. 자동 테스트와 기기 검증은 실행하지 마세요. 완료 후 릴리스 주소와 APK 다운로드 주소를 한국어로 알려 주세요.

## 공식 명령어 문서

- [릴리스 생성](https://cli.github.com/manual/gh_release_create)
- [첨부 파일 업로드와 교체](https://cli.github.com/manual/gh_release_upload)
- [릴리스 설명 갱신](https://cli.github.com/manual/gh_release_edit)
