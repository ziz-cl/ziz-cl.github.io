# 바코드 생성기

CODE128 형식의 바코드를 생성하는 웹 애플리케이션입니다.

## 기능

- CODE128 바코드 생성 (Auto, A, B, C)
- 실시간 바코드 미리보기
- 바코드 이미지 저장 (PNG)
- 바코드 인쇄
- 바코드 이미지 및 텍스트 복사
- 커스터마이징 옵션:
  - Bar width 조절
  - Height 조절
  - Margin 조절
  - Font size 조절
  - Text margin 조절
  - Background color 변경
  - Line color 변경

## GitHub Pages 배포 방법

### 1. GitHub 리포지토리 생성

1. GitHub에 로그인합니다.
2. 우측 상단의 `+` 버튼을 클릭하고 `New repository`를 선택합니다.
3. Repository name을 `[username].github.io` 형식으로 입력합니다.
   - 예: 사용자명이 `john`이면 `john.github.io`
4. Public으로 설정합니다.
5. `Create repository` 버튼을 클릭합니다.

### 2. 파일 업로드

#### 방법 1: GitHub 웹사이트에서 직접 업로드
1. 생성한 리포지토리로 이동합니다.
2. `Add file` > `Upload files`를 클릭합니다.
3. 다음 파일들을 드래그 앤 드롭하거나 선택합니다:
   - `index.html`
   - `style.css`
   - `script.js`
   - `README.md`
4. Commit message를 입력합니다 (예: "Initial commit")
5. `Commit changes` 버튼을 클릭합니다.

#### 방법 2: Git 명령어 사용
```bash
# 리포지토리 클론
git clone https://github.com/[username]/[username].github.io.git
cd [username].github.io

# 파일 복사
# 프로젝트 파일들을 이 폴더로 복사합니다

# Git에 추가 및 커밋
git add .
git commit -m "Initial commit"
git push origin main
```

### 3. GitHub Pages 활성화 확인

1. 리포지토리의 `Settings` 탭으로 이동합니다.
2. 좌측 메뉴에서 `Pages`를 클릭합니다.
3. Source가 `Deploy from a branch`로 설정되어 있는지 확인합니다.
4. Branch가 `main` (또는 `master`)로 설정되어 있는지 확인합니다.
5. 몇 분 후 `https://[username].github.io`로 접속하면 사이트를 볼 수 있습니다.

### 4. 사이트 접속

- URL: `https://[username].github.io`
- 배포까지 최대 10분 정도 소요될 수 있습니다.
- 배포 상태는 리포지토리의 `Actions` 탭에서 확인할 수 있습니다.

## 기술 스택

- HTML5
- CSS3
- JavaScript (ES6+)
- JsBarcode 라이브러리
- Google Fonts (Roboto, Noto Sans KR)

## 브라우저 지원

- Chrome (권장)
- Firefox
- Safari
- Edge

## 라이선스

MIT License
