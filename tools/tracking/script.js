// IndexedDB 설정 (Dexie.js 사용)
const db = new Dexie('WorkTrackingDB');
db.version(3).stores({
    data: '++id, employee',
    lmsData: '++id, employeeId, shift',
    metadata: 'key, value'
});

// 전역 변수
let currentData = [];

// DOM 요소
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const clearDataBtn = document.getElementById('clear-data-btn');
const mainTabsSection = document.getElementById('main-tabs-section');
const mainTabs = document.getElementById('main-tabs');
const workerStatusTab = document.getElementById('worker-status-tab');
const lmsTab = document.getElementById('lms-tab');
const rawDataTab = document.getElementById('raw-data-tab');
const toast = document.getElementById('toast');
const lmsInput = document.getElementById('lms-input');
const parseLmsBtn = document.getElementById('parse-lms-btn');
const clearLmsBtn = document.getElementById('clear-lms-btn');
const lmsResult = document.getElementById('lms-result');
const lmsTableBody = document.getElementById('lms-table-body');

// 토스트 메시지 표시
function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('translate-x-96');
    setTimeout(() => {
        toast.classList.add('translate-x-96');
    }, 3000);
}

// 파일 업로드 버튼
uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

// 파일 선택 이벤트
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Excel 파일 처리
async function handleFile(file) {
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        showToast('Excel 파일만 업로드 가능합니다.');
        return;
    }

    showToast('파일을 처리하는 중...');

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // 4W1H 시트 찾기
            let targetSheet = null;
            if (workbook.SheetNames.includes('4W1H')) {
                targetSheet = workbook.Sheets['4W1H'];
            } else {
                // 첫 번째 시트 사용
                targetSheet = workbook.Sheets[workbook.SheetNames[0]];
            }

            // raw: false로 설정하여 포맷된 문자열로 읽기
            const jsonData = XLSX.utils.sheet_to_json(targetSheet, {
                header: 1,
                defval: '',
                raw: false  // 포맷된 값 사용
            });

            // 데이터 파싱 및 저장
            await parseAndSaveData(jsonData);

            showToast('파일이 성공적으로 업로드되었습니다!');

            // UI 표시
            showUI();

        } catch (error) {
            console.error('파일 처리 오류:', error);
            showToast('파일 처리 중 오류가 발생했습니다.');
        }
    };
    reader.readAsArrayBuffer(file);
}

// 데이터 파싱 및 저장
async function parseAndSaveData(jsonData) {
    await db.data.clear();

    const headers = jsonData[0];
    const tasks = [];

    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const task = {};
        headers.forEach((header, index) => {
            task[header] = row[index] || '';
        });

        // Employee 컬럼에서 8자리 숫자만 추출
        if (task['Employee']) {
            const match = String(task['Employee']).match(/\d{8}/);
            if (match) {
                task['Employee'] = match[0];
            }
        }

        tasks.push(task);
    }

    currentData = tasks;
    await db.data.bulkAdd(tasks);
    await db.metadata.put({ key: 'lastUpdate', value: new Date().toLocaleString() });

    // UI 업데이트
    showUI();

    // 현재 탭이 작업자 현황이면 즉시 표시
    if (!workerStatusTab.classList.contains('hidden')) {
        displayWorkerStatus();
    }

    // 원본 데이터 탭도 업데이트
    displayRawData();
}

// UI 표시
function showUI() {
    clearDataBtn.classList.remove('hidden');
}

// 탭 전환
mainTabs.addEventListener('click', (e) => {
    if (e.target.dataset.tab) {
        switchTab(e.target.dataset.tab);
    }
});

async function switchTab(tabName) {
    // 탭 버튼 스타일 업데이트
    mainTabs.querySelectorAll('button').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.className = 'px-6 py-3 font-medium border-b-2 border-indigo-600 text-indigo-600';
        } else {
            btn.className = 'px-6 py-3 font-medium text-gray-600 hover:text-indigo-600';
        }
    });

    // 탭 컨텐츠 표시
    workerStatusTab.classList.add('hidden');
    lmsTab.classList.add('hidden');
    rawDataTab.classList.add('hidden');

    if (tabName === 'worker-status') {
        workerStatusTab.classList.remove('hidden');
        displayWorkerStatus();
    } else if (tabName === 'lms') {
        lmsTab.classList.remove('hidden');
        // 저장된 LMS 데이터가 있으면 표시
        const savedLmsData = await db.lmsData.toArray();
        if (savedLmsData.length > 0) {
            displayLmsData(savedLmsData);
            lmsResult.classList.remove('hidden');
        }
    } else if (tabName === 'raw-data') {
        rawDataTab.classList.remove('hidden');
        displayRawData();
    }
}

// 작업자 현황 표시
async function displayWorkerStatus() {
    const data = await db.data.toArray();
    if (data.length === 0) {
        // 데이터가 없으면 빈 테이블 표시
        const dayTbody = document.getElementById('day-status-body');
        const nightTbody = document.getElementById('night-status-body');
        if (dayTbody) dayTbody.innerHTML = '<tr><td colspan="13" class="px-4 py-8 text-center text-gray-500">4W1H 파일을 업로드하세요</td></tr>';
        if (nightTbody) nightTbody.innerHTML = '<tr><td colspan="12" class="px-4 py-8 text-center text-gray-500">4W1H 파일을 업로드하세요</td></tr>';
        return;
    }

    // LMS 데이터 로드 (이름 매칭용)
    const lmsData = await db.lmsData.toArray();
    const lmsMap = {};
    lmsData.forEach(item => {
        let employeeId = item.employeeId;

        // employeeId가 8자리가 아니면 다시 추출 (기존 데이터 호환성)
        if (employeeId && employeeId.length !== 8) {
            const match = String(employeeId).match(/\d{8}/);
            if (match) {
                employeeId = match[0];
            }
        }

        if (employeeId) {
            lmsMap[employeeId] = item.workerName;
        }
    });

    console.log('LMS 매핑:', lmsMap);
    console.log('LMS 원본 데이터:', lmsData);

    // 작업자별 데이터 집계
    const workerStats = {};

    data.forEach(task => {
        const employee = task['Employee'] || '이름 없음';

        if (!workerStats[employee]) {
            workerStats[employee] = {
                name: employee,
                totalMH: 0,
                totalQty: 0,
                totalHTP: 0,
                hourlyData: Array(24).fill(null).map(() => ({
                    totalMH: 0,      // 해당 시간대 총 작업시간
                    totalQty: 0      // 해당 시간대 총 수량
                })) // 00~23시 (전체)
            };
        }

        // HTP Start, HTP End 파싱
        const htpStart = task['HTP Start'];
        const htpEnd = task['HTP End'];
        const processTask = task['Process(Task)'];
        const unitQty = parseFloat(task['Unit Qty']) || 0;

        if (htpStart && htpEnd) {
            const mh = calculateMH(htpStart, htpEnd);

            // Process(Task)가 "STOW(STOW)"인 경우만 수량 반영
            const qty = processTask === 'STOW(STOW)' ? unitQty : 0;

            workerStats[employee].totalMH += mh;
            workerStats[employee].totalQty += qty;

            // 시간대별로 MH와 수량 분배
            distributeToHourRanges(workerStats[employee].hourlyData, htpStart, htpEnd, mh, qty);
        }
    });

    // 전체 평균 HTP 계산
    Object.values(workerStats).forEach(worker => {
        worker.totalHTP = worker.totalMH > 0 ? worker.totalQty / worker.totalMH : 0;
    });

    // 작업자 목록
    let workers = Object.values(workerStats);

    // Day 테이블 생성
    const dayTbody = document.getElementById('day-status-body');
    dayTbody.innerHTML = '';

    workers.forEach(worker => {
        // Day 시간대 합계 계산
        let dayMH = 0;
        let dayQty = 0;
        for (let i = 9; i <= 18; i++) {
            dayMH += worker.hourlyData[i].totalMH;
            dayQty += worker.hourlyData[i].totalQty;
        }

        // Day 시간대에 작업이 있는 경우에만 표시
        if (dayMH > 0) {
            const dayRow = document.createElement('tr');
            dayRow.className = 'border-b hover:bg-gray-50';

            const dayTotalHTP = dayMH > 0 ? dayQty / dayMH : 0;

            // LMS에서 이름 찾기
            const workerName = lmsMap[worker.name] || '-';

            let dayHtml = `
                <td class="px-3 py-2 font-medium sticky left-0 bg-white">${workerName}</td>
                <td class="px-3 py-2 font-medium">${worker.name}</td>
                <td class="px-3 py-2 text-center">
                    <div class="font-semibold text-blue-700">${dayTotalHTP.toFixed(0)}</div>
                </td>
            `;

            // Day 시간대: 09~18시
            for (let i = 9; i <= 18; i++) {
                const hourData = worker.hourlyData[i];
                if (hourData.totalMH > 0) {
                    const htp = hourData.totalQty / hourData.totalMH;
                    dayHtml += `<td class="px-2 py-2 text-center">
                        <div class="font-semibold text-blue-700">${htp.toFixed(0)}</div>
                    </td>`;
                } else {
                    dayHtml += `<td class="px-2 py-2 text-center text-gray-300">-</td>`;
                }
            }

            dayRow.innerHTML = dayHtml;
            dayTbody.appendChild(dayRow);
        }
    });

    // Night 테이블 생성
    const nightTbody = document.getElementById('night-status-body');
    nightTbody.innerHTML = '';

    workers.forEach(worker => {
        // Night 시간대 합계 계산
        let nightMH = 0;
        let nightQty = 0;
        for (let i = 0; i <= 8; i++) {
            nightMH += worker.hourlyData[i].totalMH;
            nightQty += worker.hourlyData[i].totalQty;
        }

        // Night 시간대에 작업이 있는 경우에만 표시
        if (nightMH > 0) {
            const nightRow = document.createElement('tr');
            nightRow.className = 'border-b hover:bg-gray-50';

            const nightTotalHTP = nightMH > 0 ? nightQty / nightMH : 0;

            // LMS에서 이름 찾기
            const workerName = lmsMap[worker.name] || '-';

            let nightHtml = `
                <td class="px-3 py-2 font-medium sticky left-0 bg-white">${workerName}</td>
                <td class="px-3 py-2 font-medium">${worker.name}</td>
                <td class="px-3 py-2 text-center">
                    <div class="font-semibold text-indigo-700">${nightTotalHTP.toFixed(0)}</div>
                </td>
            `;

            // Night 시간대: 00(24)~08시
            for (let i = 0; i <= 8; i++) {
                const hourData = worker.hourlyData[i];
                if (hourData.totalMH > 0) {
                    const htp = hourData.totalQty / hourData.totalMH;
                    nightHtml += `<td class="px-2 py-2 text-center">
                        <div class="font-semibold text-indigo-700">${htp.toFixed(0)}</div>
                    </td>`;
                } else {
                    nightHtml += `<td class="px-2 py-2 text-center text-gray-300">-</td>`;
                }
            }

            nightRow.innerHTML = nightHtml;
            nightTbody.appendChild(nightRow);
        }
    });
}

// HTP 시간 차이 계산 (초 단위로 정확하게 계산)
function calculateMH(htpStart, htpEnd) {
    const startSeconds = parseTimeToSeconds(htpStart);
    const endSeconds = parseTimeToSeconds(htpEnd);

    let diffSeconds = endSeconds - startSeconds;

    // 자정을 넘어가는 경우 처리
    if (diffSeconds < 0) {
        diffSeconds += 24 * 3600; // 24시간을 초로
    }

    // 초를 시간으로 변환
    return diffSeconds / 3600;
}

// 시간을 초로 변환
function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;

    // 숫자인 경우 (Excel 시간 형식: 0.5 = 12시간)
    if (typeof timeStr === 'number') {
        return timeStr * 24 * 3600; // 시간을 초로
    }

    // 문자열인 경우 (HH:MM:SS)
    const str = String(timeStr);
    const parts = str.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
}

// 시간 문자열을 시간(소수)로 변환
function parseTime(timeStr) {
    if (!timeStr) return 0;

    // 숫자인 경우 (Excel 시간 형식: 0.5 = 12시간)
    if (typeof timeStr === 'number') {
        return timeStr * 24;
    }

    // 문자열인 경우
    const str = String(timeStr);
    const parts = str.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return hours + minutes / 60 + seconds / 3600;
}

// 시작/종료 시간대 구하기
function getHourRange(htpStart, htpEnd) {
    const start = parseTime(htpStart);
    const end = parseTime(htpEnd);
    return {
        startHour: Math.floor(start),
        endHour: Math.floor(end)
    };
}

// 시간대별로 작업시간과 수량 분배
function distributeToHourRanges(hourlyData, htpStart, htpEnd, totalMH, totalQty) {
    const startSeconds = parseTimeToSeconds(htpStart);
    const endSeconds = parseTimeToSeconds(htpEnd);

    let currentSeconds = startSeconds;
    let remainingSeconds = endSeconds - startSeconds;

    // 자정을 넘어가는 경우 처리
    if (remainingSeconds < 0) {
        remainingSeconds += 24 * 3600;
    }

    while (remainingSeconds > 0) {
        const currentHour = Math.floor(currentSeconds / 3600) % 24;

        // 현재 시간대의 끝 (다음 정시)
        const nextHourSeconds = (Math.floor(currentSeconds / 3600) + 1) * 3600;

        // 현재 시간대에서 작업한 시간 (초)
        const segmentSeconds = Math.min(nextHourSeconds - currentSeconds, remainingSeconds);

        // 비율 계산
        const ratio = segmentSeconds / (endSeconds - startSeconds > 0 ? endSeconds - startSeconds : endSeconds - startSeconds + 24 * 3600);

        // 해당 시간대에 MH와 수량 누적 (전체 시간대)
        if (currentHour >= 0 && currentHour <= 23) {
            hourlyData[currentHour].totalMH += segmentSeconds / 3600; // 초를 시간으로 변환
            hourlyData[currentHour].totalQty += totalQty * ratio;
        }

        // 다음 구간으로 이동
        currentSeconds = nextHourSeconds;
        remainingSeconds -= segmentSeconds;

        // 무한루프 방지
        if (currentSeconds >= 24 * 3600) {
            currentSeconds = currentSeconds % (24 * 3600);
        }
    }
}

// 원본 데이터 표시
async function displayRawData() {
    const data = await db.data.toArray();
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);

    // 헤더 생성
    const headerRow = document.getElementById('raw-data-header');
    headerRow.innerHTML = '';
    headers.forEach(header => {
        const th = document.createElement('th');
        th.className = 'px-3 py-2 text-left font-semibold';
        th.textContent = header;
        headerRow.appendChild(th);
    });

    // 데이터 생성
    const tbody = document.getElementById('raw-data-body');
    tbody.innerHTML = '';

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-gray-50';

        headers.forEach(header => {
            const td = document.createElement('td');
            td.className = 'px-3 py-2 text-sm';
            td.textContent = row[header] || '-';
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

// 데이터 초기화
clearDataBtn.addEventListener('click', async () => {
    if (confirm('4W1H 데이터를 삭제하시겠습니까?')) {
        await db.data.clear();
        await db.metadata.clear();
        currentData = [];
        clearDataBtn.classList.add('hidden');

        // 테이블 초기화 (빈 상태 메시지 표시)
        displayWorkerStatus();

        // 원본 데이터 탭도 초기화
        const rawDataHeader = document.getElementById('raw-data-header');
        const rawDataBody = document.getElementById('raw-data-body');
        if (rawDataHeader) rawDataHeader.innerHTML = '';
        if (rawDataBody) rawDataBody.innerHTML = '<tr><td class="px-4 py-8 text-center text-gray-500">4W1H 파일을 업로드하세요</td></tr>';

        showToast('4W1H 데이터가 삭제되었습니다.');
    }
});

// LMS 데이터 파싱 함수
async function parseLmsData(inputText) {
    if (!inputText.trim()) {
        showToast('데이터를 입력해주세요.');
        return;
    }

    try {
        console.log('=== 원본 데이터 ===');
        console.log(inputText);
        console.log('=================');

        // 줄바꿈으로 분리 (\r\n, \n, \r 모두 처리)
        const lines = inputText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        const lmsData = [];

        console.log('전체 줄 수 (빈 줄 제외):', lines.length);

        // 모든 줄 처리 (첫 줄이 헤더인지 확인)
        let startIndex = 0;
        if (lines.length > 0 && (lines[0].includes('출근일') || lines[0].includes('사용자'))) {
            startIndex = 1; // 헤더가 있으면 건너뜀
            console.log('헤더 발견, 건너뜀:', lines[0]);
        }

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];

            // 탭으로 구분 시도 (엑셀/HTML 테이블 복사 시 기본)
            let parts = line.split('\t');

            // 탭이 없으면 여러 공백으로 구분 시도
            if (parts.length === 1) {
                parts = line.split(/\s{2,}/);
            }

            // 그래도 안 되면 쉼표로 구분 시도
            if (parts.length === 1) {
                parts = line.split(',');
            }

            // trim 처리
            parts = parts.map(p => p.trim()).filter(p => p.length > 0);

            console.log(`줄 ${i}: 컬럼 수 ${parts.length}`, parts);

            // 출근일, 사용자 아이디, 전화번호, 작업자이름, Wave, 교대, 시프트 시작시간, 시프트 종료 시간, 실제 출근시간
            // 최소 6개 컬럼이 있어야 함 (교대까지)
            if (parts.length >= 6) {
                let employeeId = parts[1];
                const workerName = parts[3];
                const shift = parts[5];

                // employeeId에서 8자리 숫자만 추출
                const match = String(employeeId).match(/\d{8}/);
                if (match) {
                    employeeId = match[0];
                }

                // 필수 데이터가 모두 있는 경우만 추가
                if (employeeId && workerName && shift) {
                    lmsData.push({
                        shift: shift,
                        workerName: workerName,
                        employeeId: employeeId
                    });
                    console.log(`✓ 줄 ${i}: 추가됨 - ${employeeId}, ${workerName}, ${shift}`);
                } else {
                    console.log(`✗ 줄 ${i}: 필수 데이터 누락 - 건너뜀`);
                }
            } else {
                console.log(`✗ 줄 ${i}: 컬럼 수 부족 (${parts.length}개) - 건너뜀`);
            }
        }

        console.log('파싱된 데이터 수:', lmsData.length);

        if (lmsData.length === 0) {
            showToast('파싱할 데이터가 없습니다. 콘솔(F12)을 확인하세요.');
            return;
        }

        // IndexedDB에 저장
        await db.lmsData.clear(); // 기존 데이터 삭제
        await db.lmsData.bulkAdd(lmsData);

        // 테이블에 표시
        displayLmsData(lmsData);
        lmsResult.classList.remove('hidden');
        showToast(`${lmsData.length}개의 데이터를 파싱했습니다.`);
    } catch (error) {
        console.error('LMS 파싱 오류:', error);
        showToast('데이터 파싱 중 오류가 발생했습니다.');
    }
}

// LMS 붙여넣기 이벤트 (자동 파싱)
lmsInput.addEventListener('paste', async (e) => {
    // 짧은 지연 후 파싱 (붙여넣기가 완료된 후 실행)
    setTimeout(async () => {
        await parseLmsData(lmsInput.value);
    }, 100);
});

// LMS 데이터 파싱 버튼
parseLmsBtn.addEventListener('click', async () => {
    await parseLmsData(lmsInput.value);
});

// LMS 입력 초기화
clearLmsBtn.addEventListener('click', async () => {
    lmsInput.value = '';
    lmsTableBody.innerHTML = '';
    lmsResult.classList.add('hidden');
    await db.lmsData.clear();
    showToast('LMS 데이터가 초기화되었습니다.');
});

// LMS 데이터 테이블 표시
function displayLmsData(lmsData) {
    lmsTableBody.innerHTML = '';

    lmsData.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

        // employeeId가 8자리가 아니면 다시 추출 (기존 데이터 호환성)
        let employeeId = item.employeeId;
        if (employeeId && employeeId.length !== 8) {
            const match = String(employeeId).match(/\d{8}/);
            if (match) {
                employeeId = match[0];
            }
        }

        row.innerHTML = `
            <td class="px-4 py-2 border-b">${item.shift}</td>
            <td class="px-4 py-2 border-b">${item.workerName}</td>
            <td class="px-4 py-2 border-b">${employeeId}</td>
        `;
        lmsTableBody.appendChild(row);
    });

    console.log('LMS 테이블 표시 완료:', lmsData.length, '건');
}

// 페이지 로드 시 저장된 데이터 표시
window.addEventListener('load', async () => {
    const data = await db.data.toArray();
    if (data.length > 0) {
        currentData = data;
        showUI();
        displayWorkerStatus();
    }

    // LMS 탭 데이터도 확인
    const lmsData = await db.lmsData.toArray();
    if (lmsData.length > 0) {
        displayLmsData(lmsData);
        lmsResult.classList.remove('hidden');
    }
});
