// 현재 탭 정보
let currentTab = null;
let currentUrl = '';

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentTab();
  await loadRequests();
  setupEventListeners();
});

// 현재 탭 정보 가져오기
async function loadCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];
  currentUrl = new URL(currentTab.url).origin;

  document.getElementById('currentUrl').textContent = currentUrl;

  // 기본값으로 현재 URL을 폼에 설정
  const urlInput = document.getElementById('url');
  if (!urlInput.value) {
    urlInput.value = currentUrl;
  }
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTab = e.target.dataset.tab;
      switchTab(targetTab);
    });
  });

  // 폼 제출
  document.getElementById('requestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveRequest();
  });

  // 취소 버튼
  document.getElementById('cancelBtn').addEventListener('click', () => {
    document.getElementById('requestForm').reset();
    toggleBatchMode(false);
    switchTab('requests');
  });

  // 응답 닫기
  document.getElementById('closeResponse').addEventListener('click', () => {
    document.getElementById('responseSection').classList.add('hidden');
  });

  // 배치 모드 토글
  document.getElementById('batchMode').addEventListener('change', (e) => {
    toggleBatchMode(e.target.checked);
  });

  // 배치 모달 취소
  document.getElementById('cancelBatch').addEventListener('click', () => {
    closeBatchModal();
  });

  // 배치 실행
  document.getElementById('executeBatch').addEventListener('click', async () => {
    await executeBatchRequests();
  });

  // 기본값 체크박스 설정
  document.getElementById('useCurrentHeaders').checked = true;
  document.getElementById('useCurrentCookies').checked = true;
}

// 배치 모드 UI 토글
function toggleBatchMode(enabled) {
  const normalSection = document.getElementById('normalParamsSection');
  const batchSection = document.getElementById('batchParamsSection');

  if (enabled) {
    normalSection.classList.add('hidden');
    batchSection.classList.remove('hidden');
  } else {
    normalSection.classList.remove('hidden');
    batchSection.classList.add('hidden');
  }
}

// 탭 전환
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });
}

// 저장된 요청 불러오기
async function loadRequests() {
  const data = await chrome.storage.local.get(['requests']);
  const allRequests = data.requests || {};

  // 현재 사이트의 요청과 모든 사이트 요청 필터링
  const relevantRequests = Object.entries(allRequests).filter(([id, req]) => {
    return req.applyToAllSites || req.siteUrl === currentUrl;
  });

  displayRequests(relevantRequests);
}

// 요청 목록 표시
function displayRequests(requests) {
  const requestsList = document.getElementById('requestsList');

  if (requests.length === 0) {
    requestsList.innerHTML = '<p class="empty-message">저장된 요청이 없습니다.</p>';
    return;
  }

  requestsList.innerHTML = requests.map(([id, req]) => `
    <div class="request-item" data-id="${id}">
      <div class="request-header">
        <span class="method-badge method-${req.method.toLowerCase()}">${req.method}</span>
        <span class="request-name">${req.name}</span>
        ${req.applyToAllSites ? '<span class="badge-all">모든 사이트</span>' : ''}
        ${req.batchMode ? '<span class="badge-batch">배치</span>' : ''}
      </div>
      <div class="request-url">${req.url}</div>
      ${req.batchMode ? `<div class="batch-info">배치 파라미터: <strong>${req.batchParamKey}</strong></div>` : ''}
      <div class="request-actions">
        <button class="btn btn-small btn-execute" data-id="${id}">${req.batchMode ? '배치 실행' : '실행'}</button>
        <button class="btn btn-small btn-edit" data-id="${id}">편집</button>
        <button class="btn btn-small btn-delete" data-id="${id}">삭제</button>
      </div>
    </div>
  `).join('');

  // 이벤트 리스너 추가
  requestsList.querySelectorAll('.btn-execute').forEach(btn => {
    btn.addEventListener('click', () => executeRequest(btn.dataset.id));
  });

  requestsList.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editRequest(btn.dataset.id));
  });

  requestsList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteRequest(btn.dataset.id));
  });
}

// 요청 저장
async function saveRequest() {
  const name = document.getElementById('requestName').value;
  const method = document.getElementById('method').value;
  const url = document.getElementById('url').value;
  const bodyText = document.getElementById('body').value;
  const useCurrentHeaders = document.getElementById('useCurrentHeaders').checked;
  const useCurrentCookies = document.getElementById('useCurrentCookies').checked;
  const applyToAllSites = document.getElementById('applyToAllSites').checked;
  const batchMode = document.getElementById('batchMode').checked;

  // JSON 파싱 검증
  let params = {};
  let body = {};
  let batchParamKey = '';
  let staticParams = {};

  if (batchMode) {
    // 배치 모드인 경우
    batchParamKey = document.getElementById('batchParamKey').value.trim();
    const staticParamsText = document.getElementById('staticParams').value;

    if (!batchParamKey) {
      alert('배치 파라미터 키를 입력해주세요.');
      return;
    }

    if (staticParamsText.trim()) {
      try {
        staticParams = JSON.parse(staticParamsText);
      } catch (e) {
        alert('고정 파라미터 JSON 형식이 올바르지 않습니다.');
        return;
      }
    }
  } else {
    // 일반 모드인 경우
    const paramsText = document.getElementById('params').value;

    if (paramsText.trim()) {
      try {
        params = JSON.parse(paramsText);
      } catch (e) {
        alert('파라미터 JSON 형식이 올바르지 않습니다.');
        return;
      }
    }
  }

  if (bodyText.trim()) {
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      alert('Body JSON 형식이 올바르지 않습니다.');
      return;
    }
  }

  const request = {
    id: Date.now().toString(),
    name,
    method,
    url,
    params,
    body,
    useCurrentHeaders,
    useCurrentCookies,
    applyToAllSites,
    batchMode,
    batchParamKey,
    staticParams,
    siteUrl: currentUrl,
    createdAt: new Date().toISOString()
  };

  // 저장
  const data = await chrome.storage.local.get(['requests']);
  const requests = data.requests || {};
  requests[request.id] = request;
  await chrome.storage.local.set({ requests });

  // UI 초기화 및 업데이트
  document.getElementById('requestForm').reset();
  document.getElementById('useCurrentHeaders').checked = true;
  document.getElementById('useCurrentCookies').checked = true;
  toggleBatchMode(false);
  switchTab('requests');
  await loadRequests();

  alert('요청이 저장되었습니다.');
}

// 요청 실행
async function executeRequest(id) {
  console.log('executeRequest called with id:', id); // 디버깅용

  const data = await chrome.storage.local.get(['requests']);
  const request = data.requests[id];
  console.log('request data:', request); // 디버깅용

  if (!request) {
    console.error('Request not found for id:', id); // 디버깅용
    alert('요청을 찾을 수 없습니다.');
    return;
  }

  // 배치 모드인 경우 모달 표시
  if (request.batchMode) {
    console.log('Batch mode detected, showing modal'); // 디버깅용
    showBatchModal(request);
    return;
  }

  try {
    console.log('Sending single request to background...'); // 디버깅용
    console.log('Request details:', {
      method: request.method,
      url: request.url,
      params: request.params,
      body: request.body
    }); // 디버깅용

    // 백그라운드 스크립트로 요청 전송
    const response = await chrome.runtime.sendMessage({
      action: 'executeRequest',
      request: request,
      tabId: currentTab.id
    });

    console.log('Response received:', response); // 디버깅용
    displayResponse(response);
  } catch (error) {
    console.error('Error executing single request:', error); // 디버깅용
    alert('요청 실행 중 오류가 발생했습니다: ' + error.message);
  }
}

// 요청 편집
async function editRequest(id) {
  const data = await chrome.storage.local.get(['requests']);
  const request = data.requests[id];

  if (!request) {
    alert('요청을 찾을 수 없습니다.');
    return;
  }

  // 폼에 데이터 채우기
  document.getElementById('requestName').value = request.name;
  document.getElementById('method').value = request.method;
  document.getElementById('url').value = request.url;
  document.getElementById('body').value = Object.keys(request.body || {}).length > 0
    ? JSON.stringify(request.body, null, 2)
    : '';
  document.getElementById('useCurrentHeaders').checked = request.useCurrentHeaders;
  document.getElementById('useCurrentCookies').checked = request.useCurrentCookies;
  document.getElementById('applyToAllSites').checked = request.applyToAllSites;

  // 배치 모드 설정
  const batchMode = request.batchMode || false;
  document.getElementById('batchMode').checked = batchMode;
  toggleBatchMode(batchMode);

  if (batchMode) {
    document.getElementById('batchParamKey').value = request.batchParamKey || '';
    document.getElementById('staticParams').value = Object.keys(request.staticParams || {}).length > 0
      ? JSON.stringify(request.staticParams, null, 2)
      : '';
  } else {
    document.getElementById('params').value = Object.keys(request.params || {}).length > 0
      ? JSON.stringify(request.params, null, 2)
      : '';
  }

  // 기존 요청 삭제 (업데이트를 위해)
  await deleteRequest(id, false);

  // 새 요청 탭으로 전환
  switchTab('new');
}

// 요청 삭제
async function deleteRequest(id, confirm = true) {
  if (confirm && !window.confirm('이 요청을 삭제하시겠습니까?')) {
    return;
  }

  const data = await chrome.storage.local.get(['requests']);
  const requests = data.requests || {};
  delete requests[id];
  await chrome.storage.local.set({ requests });

  await loadRequests();
}

// 응답 표시
function displayResponse(response) {
  const responseSection = document.getElementById('responseSection');
  const responseStatus = document.getElementById('responseStatus');
  const responseBody = document.getElementById('responseBody');

  if (response.error) {
    responseStatus.textContent = `Error: ${response.error}`;
    responseStatus.className = 'response-status error';
    responseBody.innerHTML = `<pre>${response.details || ''}</pre>`;
  } else {
    responseStatus.textContent = `Status: ${response.status} ${response.statusText}`;
    responseStatus.className = response.status >= 200 && response.status < 300
      ? 'response-status success'
      : 'response-status error';

    try {
      responseBody.innerHTML = `<pre>${JSON.stringify(response.data, null, 2)}</pre>`;
    } catch (e) {
      responseBody.innerHTML = `<pre>${response.data}</pre>`;
    }
  }

  responseSection.classList.remove('hidden');
}

// 배치 실행 모달 표시
let currentBatchRequest = null;

function showBatchModal(request) {
  currentBatchRequest = request;
  document.getElementById('batchParamKeyDisplay').textContent = request.batchParamKey;
  document.getElementById('batchValues').value = '';
  document.getElementById('batchModal').classList.remove('hidden');
}

function closeBatchModal() {
  currentBatchRequest = null;
  document.getElementById('batchModal').classList.add('hidden');
}

// 배치 요청 실행
async function executeBatchRequests() {
  console.log('executeBatchRequests called'); // 디버깅용
  console.log('currentBatchRequest:', currentBatchRequest); // 디버깅용

  if (!currentBatchRequest) {
    console.error('currentBatchRequest is null!');
    return;
  }

  const valuesText = document.getElementById('batchValues').value;
  console.log('valuesText:', valuesText); // 디버깅용

  const values = valuesText.split('\n').map(v => v.trim()).filter(v => v);
  console.log('parsed values:', values); // 디버깅용

  if (values.length === 0) {
    alert('값을 입력해주세요.');
    return;
  }

  console.log('Starting batch execution...'); // 디버깅용

  // 결과를 수집할 배열
  const results = [];

  // 각 값마다 요청 실행
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    console.log(`Processing value ${i + 1}/${values.length}:`, value); // 디버깅용

    // 배치 파라미터 추가
    const batchParams = {
      ...currentBatchRequest.staticParams,
      [currentBatchRequest.batchParamKey]: value
    };
    console.log('batchParams:', batchParams); // 디버깅용

    // 임시 요청 객체 생성
    const tempRequest = {
      ...currentBatchRequest,
      params: batchParams
    };
    console.log('tempRequest:', tempRequest); // 디버깅용

    try {
      console.log('Sending message to background...'); // 디버깅용
      const response = await chrome.runtime.sendMessage({
        action: 'executeRequest',
        request: tempRequest,
        tabId: currentTab.id
      });
      console.log('Response received:', response); // 디버깅용

      results.push({
        value: value,
        success: !response.error,
        response: response
      });
    } catch (error) {
      console.error('Error executing request:', error); // 디버깅용
      results.push({
        value: value,
        success: false,
        response: { error: error.message }
      });
    }
  }

  console.log('All requests completed. Results:', results); // 디버깅용
  console.log('Calling displayBatchResults...'); // 디버깅용

  // 배치 결과 표시
  displayBatchResults(results);

  // 모든 처리가 끝난 후 모달 닫기
  closeBatchModal();
  console.log('Modal closed after batch execution completed'); // 디버깅용
}

// HTML 이스케이프 함수
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 배치 결과 표시
function displayBatchResults(results) {
  const responseSection = document.getElementById('responseSection');
  const responseStatus = document.getElementById('responseStatus');
  const responseBody = document.getElementById('responseBody');

  console.log('displayBatchResults called with:', results); // 디버깅용

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  responseStatus.textContent = `배치 실행 완료: ${successCount}/${totalCount} 성공`;
  responseStatus.className = successCount === totalCount
    ? 'response-status success'
    : 'response-status error';

  // 테이블 형식으로 결과 표시
  const tableHTML = `
    <div class="batch-results-table">
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>값</th>
            <th>상태</th>
            <th>응답 요약</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${results.map((result, index) => {
            const statusClass = result.success ? 'success' : 'error';
            const statusIcon = result.success ? '✓' : '✗';
            const statusText = result.response && result.response.status
              ? `${result.response.status} ${result.response.statusText || ''}`
              : (result.response && result.response.error) || 'Error';

            // 응답 데이터 요약
            let summary = '';
            if (result.success && result.response && result.response.data) {
              if (typeof result.response.data === 'object' && result.response.data !== null) {
                const keys = Object.keys(result.response.data);
                summary = keys.length > 0
                  ? `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`
                  : 'Empty object';
              } else {
                summary = String(result.response.data).substring(0, 30);
                if (String(result.response.data).length > 30) summary += '...';
              }
            } else if (result.response && result.response.error) {
              summary = String(result.response.error).substring(0, 30);
            }

            const responseData = result.response && (result.response.data || result.response.error)
              ? JSON.stringify(result.response.data || result.response.error, null, 2)
              : 'No data';

            return `
              <tr class="result-row ${statusClass}" data-index="${index}">
                <td>${index + 1}</td>
                <td class="value-cell">${escapeHtml(String(result.value))}</td>
                <td class="status-cell">
                  <span class="status-icon ${statusClass}">${statusIcon}</span>
                  ${escapeHtml(statusText)}
                </td>
                <td class="summary-cell">${escapeHtml(summary)}</td>
                <td class="expand-cell">
                  <button class="btn-expand" data-index="${index}">상세</button>
                </td>
              </tr>
              <tr class="detail-row hidden" id="detail-${index}">
                <td colspan="5">
                  <div class="detail-content">
                    <pre>${escapeHtml(responseData)}</pre>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  console.log('Setting innerHTML:', tableHTML.substring(0, 200)); // 디버깅용
  responseBody.innerHTML = tableHTML;
  console.log('responseBody after set:', responseBody.innerHTML.substring(0, 200)); // 디버깅용

  // 상세 보기 버튼 이벤트 리스너
  responseBody.querySelectorAll('.btn-expand').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = e.target.dataset.index;
      const detailRow = document.getElementById(`detail-${index}`);
      const isHidden = detailRow.classList.contains('hidden');

      detailRow.classList.toggle('hidden');
      e.target.textContent = isHidden ? '접기' : '상세';
    });
  });

  responseSection.classList.remove('hidden');
  console.log('responseSection hidden class removed'); // 디버깅용
}
