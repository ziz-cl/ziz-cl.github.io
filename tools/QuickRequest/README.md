# QuickRequest - Chrome Extension

사이트별 프리셋으로 빠르게 HTTP POST 요청을 보내는 크롬 확장 프로그램입니다.

## 주요 기능

- **HTTP POST 요청 전송**: 간편하게 POST 요청을 보낼 수 있습니다
- **현재 사이트 정보 활용**:
  - 현재 사이트의 Headers 자동 사용 (선택 가능)
  - 현재 사이트의 Cookies 자동 사용 (선택 가능)
- **프리셋 관리**:
  - 사이트별 프리셋 저장 (해당 사이트에서만 표시)
  - 글로벌 프리셋 저장 (모든 사이트에서 사용 가능)
  - 프리셋 로드 및 삭제 기능

## 설치 방법

1. Chrome 브라우저에서 `chrome://extensions/` 접속
2. 우측 상단의 "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `tools/QuickRequest` 폴더 선택

**주의**: 아이콘 파일이 필요합니다. 다음 파일들을 추가해주세요:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

또는 manifest.json에서 icons 부분을 제거하셔도 됩니다.

## 사용 방법

### 1. 기본 사용

1. 확장 프로그램 아이콘 클릭
2. 요청 URL 입력
3. Request Body 입력 (JSON 형식)
4. "요청 보내기" 클릭

### 2. Headers와 Cookies 설정

- **현재 사이트의 Headers 사용**: 체크 시 현재 탭의 기본 헤더 사용
  - 체크 해제 시 커스텀 Headers 입력 가능 (JSON 형식)
- **현재 사이트의 Cookies 사용**: 체크 시 현재 탭의 쿠키 자동 포함

### 3. 프리셋 저장

1. 요청 정보 입력
2. 프리셋 이름 입력
3. 저장 범위 선택:
   - **현재 사이트에서만 사용**: 해당 도메인에서만 프리셋 표시
   - **모든 사이트에서 사용**: 모든 도메인에서 프리셋 사용 가능
4. "프리셋 저장" 클릭

### 4. 프리셋 사용

1. 상단의 "프리셋 선택" 드롭다운에서 원하는 프리셋 선택
2. 자동으로 저장된 정보가 로드됨
3. 필요시 수정 후 "요청 보내기" 클릭

### 5. 프리셋 삭제

1. 삭제할 프리셋 선택
2. "삭제" 버튼 클릭
3. 확인 후 삭제

## 예제

### API 테스트 예제

**요청 URL:**
```
https://api.example.com/users
```

**Request Body:**
```json
{
  "name": "홍길동",
  "email": "hong@example.com",
  "age": 25
}
```

### 커스텀 Headers 예제

**Custom Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer your_token_here",
  "X-Custom-Header": "custom_value"
}
```

## 권한

이 확장 프로그램은 다음 권한을 요청합니다:

- `activeTab`: 현재 탭의 URL 정보 접근
- `cookies`: 쿠키 읽기
- `storage`: 프리셋 저장
- `<all_urls>`: 모든 사이트에 요청 전송

## 기술 스택

- Manifest V3
- Chrome Extension APIs
- Vanilla JavaScript
- CSS3

## 주의사항

- CORS 정책에 따라 일부 요청이 차단될 수 있습니다
- Request Body는 반드시 유효한 JSON 형식이어야 합니다
- 민감한 정보(토큰, 비밀번호 등)를 프리셋에 저장할 때 주의하세요
