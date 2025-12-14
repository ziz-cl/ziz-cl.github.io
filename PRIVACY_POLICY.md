# Privacy Policy / 개인정보처리방침

**Last Updated / 최종 수정일: 2024-12-14**

## English

### Introduction

WMS Custom ("the Extension") is a browser extension designed to enhance the user experience on WMS (Warehouse Management System) web pages. This Privacy Policy explains how we handle user data.

### Data Collection

**We do not collect any personal data.**

The Extension does not collect, transmit, or store any personally identifiable information (PII) or sensitive user data.

### Data Storage

The Extension stores the following data **locally on your device only** using Chrome's `chrome.storage.local` API:

- **Feature Settings**: Your preferences for enabling/disabling extension features (e.g., auto-center selection, custom search, barcode display)
- **User Preferences**: Favorite centers and search presets you configure

This data:
- Is stored only on your local device
- Is never transmitted to external servers
- Is never shared with third parties
- Can be exported/imported by you at any time
- Is deleted when you uninstall the extension

### Network Requests

The Extension makes a single network request to fetch a remote configuration file (JSON) for the kill-switch feature. This request:
- Only retrieves configuration settings (boolean values)
- Does not send any user data
- Does not contain any tracking or analytics

### Permissions

The Extension requests the following permissions:

| Permission | Purpose |
|------------|---------|
| `storage` | Store your feature settings locally |
| `alarms` | Periodically check remote configuration (every 24 hours) |
| `activeTab` | Identify the current page to show relevant features |
| `tabs` | Get current tab URL and reload page when settings change |
| `host_permissions` | Inject content scripts to add features on WMS pages |

### Third-Party Services

The Extension does not use any third-party analytics, tracking, or advertising services.

### Children's Privacy

The Extension is not directed at children under 13 years of age and does not knowingly collect information from children.

### Changes to This Policy

We may update this Privacy Policy from time to time. Any changes will be reflected in the "Last Updated" date above.

### Contact

If you have any questions about this Privacy Policy, please contact:
- GitHub: [github.com/ziz-cl](https://github.com/ziz-cl)

---

## 한국어

### 소개

WMS 커스텀("본 확장프로그램")은 WMS(창고관리시스템) 웹 페이지의 사용자 경험을 향상시키기 위한 브라우저 확장프로그램입니다. 본 개인정보처리방침은 사용자 데이터 처리 방식을 설명합니다.

### 데이터 수집

**본 확장프로그램은 어떠한 개인정보도 수집하지 않습니다.**

개인 식별 정보(PII)나 민감한 사용자 데이터를 수집, 전송 또는 저장하지 않습니다.

### 데이터 저장

본 확장프로그램은 Chrome의 `chrome.storage.local` API를 사용하여 다음 데이터를 **사용자 기기에만 로컬로** 저장합니다:

- **기능 설정**: 확장프로그램 기능의 활성화/비활성화 설정 (예: 센터 자동 선택, 커스텀 검색, 바코드 표시)
- **사용자 환경설정**: 사용자가 설정한 즐겨찾기 센터 및 검색 프리셋

이 데이터는:
- 사용자의 로컬 기기에만 저장됩니다
- 외부 서버로 전송되지 않습니다
- 제3자와 공유되지 않습니다
- 언제든지 내보내기/가져오기가 가능합니다
- 확장프로그램 제거 시 삭제됩니다

### 네트워크 요청

본 확장프로그램은 킬스위치 기능을 위해 원격 설정 파일(JSON)을 가져오는 단일 네트워크 요청을 수행합니다. 이 요청은:
- 설정값(boolean)만 가져옵니다
- 사용자 데이터를 전송하지 않습니다
- 추적이나 분석 기능을 포함하지 않습니다

### 권한

본 확장프로그램은 다음 권한을 요청합니다:

| 권한 | 목적 |
|------|------|
| `storage` | 기능 설정을 로컬에 저장 |
| `alarms` | 원격 설정을 주기적으로 확인 (24시간마다) |
| `activeTab` | 현재 페이지를 식별하여 관련 기능 표시 |
| `tabs` | 현재 탭 URL 확인 및 설정 변경 시 페이지 새로고침 |
| `host_permissions` | WMS 페이지에 기능을 추가하기 위한 콘텐츠 스크립트 주입 |

### 제3자 서비스

본 확장프로그램은 제3자 분석, 추적 또는 광고 서비스를 사용하지 않습니다.

### 아동 개인정보 보호

본 확장프로그램은 13세 미만 아동을 대상으로 하지 않으며, 아동의 정보를 의도적으로 수집하지 않습니다.

### 정책 변경

본 개인정보처리방침은 수시로 업데이트될 수 있습니다. 변경사항은 상단의 "최종 수정일"에 반영됩니다.

### 문의

본 개인정보처리방침에 대한 문의사항이 있으시면 아래로 연락해 주세요:
- GitHub: [github.com/ziz-cl](https://github.com/ziz-cl)
