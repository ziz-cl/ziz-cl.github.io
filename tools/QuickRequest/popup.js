let currentUrl = '';
let currentDomain = '';

// DOM 요소
const elements = {
    currentSite: document.getElementById('currentSite'),
    presetSelect: document.getElementById('presetSelect'),
    deletePresetBtn: document.getElementById('deletePresetBtn'),
    requestUrl: document.getElementById('requestUrl'),
    useCurrentHeaders: document.getElementById('useCurrentHeaders'),
    customHeadersSection: document.getElementById('customHeadersSection'),
    customHeaders: document.getElementById('customHeaders'),
    useCurrentCookies: document.getElementById('useCurrentCookies'),
    requestBody: document.getElementById('requestBody'),
    singleRequestSection: document.getElementById('singleRequestSection'),
    bulkRequestSection: document.getElementById('bulkRequestSection'),
    bulkTemplate: document.getElementById('bulkTemplate'),
    bulkPlaceholder: document.getElementById('bulkPlaceholder'),
    bulkValues: document.getElementById('bulkValues'),
    presetName: document.getElementById('presetName'),
    sendRequestBtn: document.getElementById('sendRequestBtn'),
    savePresetBtn: document.getElementById('savePresetBtn'),
    responseStatus: document.getElementById('responseStatus'),
    responseBody: document.getElementById('responseBody')
};

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    await getCurrentTab();
    await loadPresets();
    setupEventListeners();
});

// 현재 탭 정보 가져오기
async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentUrl = tab.url;

    try {
        const url = new URL(currentUrl);
        currentDomain = url.hostname;
        elements.currentSite.textContent = `현재 사이트: ${currentDomain}`;
    } catch (e) {
        elements.currentSite.textContent = '유효하지 않은 URL';
    }
}

// 프리셋 로드
async function loadPresets() {
    const result = await chrome.storage.local.get(['presets']);
    const presets = result.presets || {};

    // 프리셋 선택 초기화
    elements.presetSelect.innerHTML = '<option value="">새 요청</option>';

    // 현재 사이트의 프리셋 추가
    const sitePresets = presets[currentDomain] || [];
    if (sitePresets.length > 0) {
        const siteGroup = document.createElement('optgroup');
        siteGroup.label = '현재 사이트 프리셋';
        sitePresets.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = `site_${index}`;
            option.textContent = preset.name;
            siteGroup.appendChild(option);
        });
        elements.presetSelect.appendChild(siteGroup);
    }

    // 글로벌 프리셋 추가
    const globalPresets = presets['__global__'] || [];
    if (globalPresets.length > 0) {
        const globalGroup = document.createElement('optgroup');
        globalGroup.label = '모든 사이트 프리셋';
        globalPresets.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = `global_${index}`;
            option.textContent = preset.name;
            globalGroup.appendChild(option);
        });
        elements.presetSelect.appendChild(globalGroup);
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // Headers 체크박스
    elements.useCurrentHeaders.addEventListener('change', (e) => {
        elements.customHeadersSection.style.display = e.target.checked ? 'none' : 'block';
    });

    // 요청 모드 변경
    document.querySelectorAll('input[name="requestMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'single') {
                elements.singleRequestSection.style.display = 'block';
                elements.bulkRequestSection.style.display = 'none';
            } else {
                elements.singleRequestSection.style.display = 'none';
                elements.bulkRequestSection.style.display = 'block';
            }
        });
    });

    // 프리셋 선택
    elements.presetSelect.addEventListener('change', async (e) => {
        if (!e.target.value) {
            clearForm();
            return;
        }

        await loadPresetData(e.target.value);
    });

    // 프리셋 삭제
    elements.deletePresetBtn.addEventListener('click', async () => {
        if (!elements.presetSelect.value) {
            alert('삭제할 프리셋을 선택하세요.');
            return;
        }

        if (confirm('선택한 프리셋을 삭제하시겠습니까?')) {
            await deletePreset(elements.presetSelect.value);
        }
    });

    // 요청 보내기
    elements.sendRequestBtn.addEventListener('click', sendRequest);

    // 프리셋 저장
    elements.savePresetBtn.addEventListener('click', savePreset);
}

// 프리셋 데이터 로드
async function loadPresetData(presetId) {
    const [type, index] = presetId.split('_');
    const result = await chrome.storage.local.get(['presets']);
    const presets = result.presets || {};

    let preset;
    if (type === 'site') {
        preset = presets[currentDomain][parseInt(index)];
    } else {
        preset = presets['__global__'][parseInt(index)];
    }

    if (preset) {
        elements.requestUrl.value = preset.url || '';
        elements.useCurrentHeaders.checked = preset.useCurrentHeaders !== false;
        elements.useCurrentCookies.checked = preset.useCurrentCookies !== false;

        // 요청 모드 설정
        const requestMode = preset.requestMode || 'single';
        document.querySelector(`input[name="requestMode"][value="${requestMode}"]`).checked = true;

        if (requestMode === 'single') {
            elements.singleRequestSection.style.display = 'block';
            elements.bulkRequestSection.style.display = 'none';
            elements.requestBody.value = preset.body || '';
        } else {
            elements.singleRequestSection.style.display = 'none';
            elements.bulkRequestSection.style.display = 'block';
            elements.bulkTemplate.value = preset.bulkTemplate || '';
            elements.bulkPlaceholder.value = preset.bulkPlaceholder || '{{VALUE}}';
            elements.bulkValues.value = preset.bulkValues || '';
        }

        if (!preset.useCurrentHeaders && preset.customHeaders) {
            elements.customHeaders.value = JSON.stringify(preset.customHeaders, null, 2);
            elements.customHeadersSection.style.display = 'block';
        } else {
            elements.customHeadersSection.style.display = 'none';
        }

        elements.presetName.value = preset.name || '';
    }
}

// 폼 초기화
function clearForm() {
    elements.requestUrl.value = '';
    elements.useCurrentHeaders.checked = true;
    elements.useCurrentCookies.checked = true;
    elements.requestBody.value = '';
    elements.bulkTemplate.value = '';
    elements.bulkPlaceholder.value = '{{VALUE}}';
    elements.bulkValues.value = '';
    elements.presetName.value = '';
    elements.customHeaders.value = '';
    elements.customHeadersSection.style.display = 'none';
    elements.responseStatus.textContent = '';
    elements.responseBody.textContent = '';

    // 단일 요청 모드로 초기화
    document.querySelector('input[name="requestMode"][value="single"]').checked = true;
    elements.singleRequestSection.style.display = 'block';
    elements.bulkRequestSection.style.display = 'none';
}

// 프리셋 삭제
async function deletePreset(presetId) {
    const [type, index] = presetId.split('_');
    const result = await chrome.storage.local.get(['presets']);
    const presets = result.presets || {};

    if (type === 'site') {
        presets[currentDomain].splice(parseInt(index), 1);
        if (presets[currentDomain].length === 0) {
            delete presets[currentDomain];
        }
    } else {
        presets['__global__'].splice(parseInt(index), 1);
        if (presets['__global__'].length === 0) {
            delete presets['__global__'];
        }
    }

    await chrome.storage.local.set({ presets });
    await loadPresets();
    clearForm();
    alert('프리셋이 삭제되었습니다.');
}

// 요청 보내기
async function sendRequest() {
    const url = elements.requestUrl.value.trim();
    if (!url) {
        alert('요청 URL을 입력하세요.');
        return;
    }

    const requestMode = document.querySelector('input[name="requestMode"]:checked').value;

    if (requestMode === 'single') {
        await sendSingleRequest(url);
    } else {
        await sendBulkRequests(url);
    }
}

// 단일 요청 보내기
async function sendSingleRequest(url) {
    try {
        const { headers, body } = await prepareRequest();

        // 요청 보내기
        elements.responseStatus.textContent = '요청 중...';
        elements.responseStatus.className = 'response-status loading';
        elements.responseBody.textContent = '';

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body || undefined,
            credentials: 'include'
        });

        const responseText = await response.text();

        // 응답 표시
        elements.responseStatus.textContent = `Status: ${response.status} ${response.statusText}`;
        elements.responseStatus.className = `response-status ${response.ok ? 'success' : 'error'}`;

        try {
            const jsonResponse = JSON.parse(responseText);
            elements.responseBody.textContent = JSON.stringify(jsonResponse, null, 2);
        } catch (e) {
            elements.responseBody.textContent = responseText;
        }

    } catch (error) {
        elements.responseStatus.textContent = `Error: ${error.message}`;
        elements.responseStatus.className = 'response-status error';
        elements.responseBody.textContent = error.stack || '';
    }
}

// 다중 요청 보내기
async function sendBulkRequests(url) {
    try {
        const template = elements.bulkTemplate.value.trim();
        const placeholder = elements.bulkPlaceholder.value.trim() || '{{VALUE}}';
        const valuesText = elements.bulkValues.value.trim();

        if (!template) {
            alert('템플릿을 입력하세요.');
            return;
        }

        if (!valuesText) {
            alert('값 목록을 입력하세요.');
            return;
        }

        // 템플릿 JSON 유효성 검사 (placeholder를 임시 값으로 대체)
        try {
            // placeholder를 0으로 대체해서 JSON 유효성 검사
            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const testTemplate = template.replace(new RegExp(escapedPlaceholder, 'g'), '0');
            JSON.parse(testTemplate);
        } catch (e) {
            alert('템플릿 JSON 형식이 올바르지 않습니다.\n플레이스홀더를 제외한 나머지 부분이 유효한 JSON이어야 합니다.');
            return;
        }

        // 값 목록 파싱 (줄바꿈으로 구분)
        const values = valuesText.split('\n').map(v => v.trim()).filter(v => v);

        if (values.length === 0) {
            alert('유효한 값이 없습니다.');
            return;
        }

        const { headers } = await prepareRequest();

        // 응답 초기화
        elements.responseStatus.textContent = `총 ${values.length}개 요청 중...`;
        elements.responseStatus.className = 'response-status loading';
        elements.responseBody.textContent = '';

        const results = [];

        // 각 값에 대해 요청 보내기
        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            const body = template.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);

            try {
                elements.responseStatus.textContent = `요청 중... (${i + 1}/${values.length})`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: body,
                    credentials: 'include'
                });

                const responseText = await response.text();
                let responseData;

                try {
                    responseData = JSON.parse(responseText);
                } catch (e) {
                    responseData = responseText;
                }

                results.push({
                    index: i + 1,
                    value: value,
                    status: response.status,
                    statusText: response.statusText,
                    success: response.ok,
                    response: responseData
                });

            } catch (error) {
                results.push({
                    index: i + 1,
                    value: value,
                    status: 'ERROR',
                    statusText: error.message,
                    success: false,
                    response: error.stack || ''
                });
            }
        }

        // 결과 표시
        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        elements.responseStatus.textContent = `완료: 성공 ${successCount}개, 실패 ${failCount}개`;
        elements.responseStatus.className = `response-status ${failCount === 0 ? 'success' : 'error'}`;

        // 결과 포맷팅
        let resultText = '';
        results.forEach(result => {
            resultText += `\n${'='.repeat(60)}\n`;
            resultText += `[${result.index}] Value: ${result.value}\n`;
            resultText += `Status: ${result.status} ${result.statusText}\n`;
            resultText += `${'-'.repeat(60)}\n`;
            if (typeof result.response === 'object') {
                resultText += JSON.stringify(result.response, null, 2);
            } else {
                resultText += result.response;
            }
            resultText += '\n';
        });

        elements.responseBody.textContent = resultText;

    } catch (error) {
        elements.responseStatus.textContent = `Error: ${error.message}`;
        elements.responseStatus.className = 'response-status error';
        elements.responseBody.textContent = error.stack || '';
    }
}

// 요청 준비 (headers, body)
async function prepareRequest() {
    let headers = {};

    if (elements.useCurrentHeaders.checked) {
        // 현재 사이트의 headers 가져오기
        const currentHeaders = await chrome.runtime.sendMessage({
            action: 'getHeaders',
            url: currentUrl
        });
        headers = currentHeaders || {};
    } else {
        // 커스텀 headers 사용
        const customHeadersText = elements.customHeaders.value.trim();
        if (customHeadersText) {
            try {
                headers = JSON.parse(customHeadersText);
            } catch (e) {
                throw new Error('Headers JSON 형식이 올바르지 않습니다.');
            }
        }
    }

    // Cookies 설정
    if (elements.useCurrentCookies.checked) {
        const cookies = await chrome.cookies.getAll({ url: currentUrl });
        const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        if (cookieHeader) {
            headers['Cookie'] = cookieHeader;
        }
    }

    // Content-Type 기본값 설정
    if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    // Request body (단일 요청 모드일 때만)
    let body = '';
    const requestMode = document.querySelector('input[name="requestMode"]:checked').value;
    if (requestMode === 'single') {
        body = elements.requestBody.value.trim();
        if (body) {
            try {
                // JSON 유효성 검사
                JSON.parse(body);
            } catch (e) {
                throw new Error('Request Body JSON 형식이 올바르지 않습니다.');
            }
        }
    }

    return { headers, body };
}

// 프리셋 저장
async function savePreset() {
    const name = elements.presetName.value.trim();
    if (!name) {
        alert('프리셋 이름을 입력하세요.');
        return;
    }

    const url = elements.requestUrl.value.trim();
    if (!url) {
        alert('요청 URL을 입력하세요.');
        return;
    }

    const scope = document.querySelector('input[name="presetScope"]:checked').value;
    const requestMode = document.querySelector('input[name="requestMode"]:checked').value;

    const preset = {
        name: name,
        url: url,
        useCurrentHeaders: elements.useCurrentHeaders.checked,
        useCurrentCookies: elements.useCurrentCookies.checked,
        requestMode: requestMode
    };

    // 요청 모드에 따라 데이터 저장
    if (requestMode === 'single') {
        preset.body = elements.requestBody.value.trim();
    } else {
        preset.bulkTemplate = elements.bulkTemplate.value.trim();
        preset.bulkPlaceholder = elements.bulkPlaceholder.value.trim() || '{{VALUE}}';
        preset.bulkValues = elements.bulkValues.value.trim();
    }

    // 커스텀 headers가 있으면 저장
    if (!elements.useCurrentHeaders.checked) {
        const customHeadersText = elements.customHeaders.value.trim();
        if (customHeadersText) {
            try {
                preset.customHeaders = JSON.parse(customHeadersText);
            } catch (e) {
                alert('Headers JSON 형식이 올바르지 않습니다.');
                return;
            }
        }
    }

    // 저장
    const result = await chrome.storage.local.get(['presets']);
    const presets = result.presets || {};

    const key = scope === 'global' ? '__global__' : currentDomain;
    if (!presets[key]) {
        presets[key] = [];
    }

    // 같은 이름의 프리셋이 있으면 덮어쓰기
    const existingIndex = presets[key].findIndex(p => p.name === name);
    if (existingIndex !== -1) {
        if (!confirm(`"${name}" 프리셋이 이미 존재합니다. 덮어쓰시겠습니까?`)) {
            return;
        }
        presets[key][existingIndex] = preset;
    } else {
        presets[key].push(preset);
    }

    await chrome.storage.local.set({ presets });
    await loadPresets();

    alert('프리셋이 저장되었습니다.');
}
