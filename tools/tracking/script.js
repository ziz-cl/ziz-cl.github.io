// IndexedDB 설정 (Dexie.js 사용)
const db = new Dexie('WorkTrackingDB');
db.version(1).stores({
    data: '++id, workDate, employee',
    metadata: 'key, value'
});

// 전역 변수
let currentData = [];
let currentWorkDate = null;

// DOM 요소
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const clearDataBtn = document.getElementById('clear-data-btn');
const mainTabsSection = document.getElementById('main-tabs-section');
const mainTabs = document.getElementById('main-tabs');
const workerStatusTab = document.getElementById('worker-status-tab');
const rawDataTab = document.getElementById('raw-data-tab');
const workerSearch = document.getElementById('worker-search');
const toast = document.getElementById('toast');

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

    // 파일명에서 날짜 추출 (worker_history_YYYYMMDDHHmmss)
    const dateMatch = file.name.match(/worker_history_(\d{14})/);
    if (dateMatch) {
        const dateStr = dateMatch[1];
        currentWorkDate = `${dateStr.substr(0,4)}-${dateStr.substr(4,2)}-${dateStr.substr(6,2)} ${dateStr.substr(8,2)}:${dateStr.substr(10,2)}:${dateStr.substr(12,2)}`;
        console.log('작업 날짜:', currentWorkDate);
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

            const jsonData = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: '' });

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

        tasks.push(task);
    }

    currentData = tasks;
    await db.data.bulkAdd(tasks);
    await db.metadata.put({ key: 'lastUpdate', value: new Date().toLocaleString() });
    await db.metadata.put({ key: 'workDate', value: currentWorkDate });
}

// UI 표시
function showUI() {
    mainTabsSection.classList.remove('hidden');
    clearDataBtn.classList.remove('hidden');
    switchTab('worker-status');
}

// 탭 전환
mainTabs.addEventListener('click', (e) => {
    if (e.target.dataset.tab) {
        switchTab(e.target.dataset.tab);
    }
});

function switchTab(tabName) {
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
    rawDataTab.classList.add('hidden');

    if (tabName === 'worker-status') {
        workerStatusTab.classList.remove('hidden');
        displayWorkerStatus();
    } else if (tabName === 'raw-data') {
        rawDataTab.classList.remove('hidden');
        displayRawData();
    }
}

// 작업자 현황 표시
async function displayWorkerStatus(filter = '') {
    const data = await db.data.toArray();
    if (data.length === 0) return;

    // 작업자별 데이터 집계
    const workerStats = {};

    data.forEach(task => {
        const employee = task['Employee'] || '이름 없음';

        if (!workerStats[employee]) {
            workerStats[employee] = {
                name: employee,
                totalMH: 0,
                totalQty: 0,
                hourlyData: Array(9).fill(null).map(() => ({ mh: 0, qty: 0 })) // 00~08시
            };
        }

        // HTP Start, HTP End 파싱
        const htpStart = task['HTP Start'];
        const htpEnd = task['HTP End'];
        const unitQty = parseFloat(task['Unit Qty']) || 0;

        if (htpStart && htpEnd) {
            const mh = calculateMH(htpStart, htpEnd);
            const { startHour, endHour } = getHourRange(htpStart, htpEnd);

            workerStats[employee].totalMH += mh;
            workerStats[employee].totalQty += unitQty;

            // 시간대별 할당
            distributeToHours(workerStats[employee].hourlyData, htpStart, htpEnd, mh, unitQty);
        }
    });

    // 필터 적용
    let workers = Object.values(workerStats);
    if (filter) {
        workers = workers.filter(w => w.name.toLowerCase().includes(filter.toLowerCase()));
    }

    // 테이블 생성
    const tbody = document.getElementById('worker-status-body');
    tbody.innerHTML = '';

    workers.forEach(worker => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';

        let html = `
            <td class="px-3 py-2 font-medium sticky left-0 bg-white">${worker.name}</td>
            <td class="px-3 py-2 text-center">${worker.totalMH.toFixed(2)}</td>
            <td class="px-3 py-2 text-center">${worker.totalQty.toFixed(0)}</td>
        `;

        // 00~08시 데이터
        for (let i = 0; i < 9; i++) {
            const hourData = worker.hourlyData[i];
            if (hourData.mh > 0) {
                html += `<td class="px-3 py-2 text-center text-xs">
                    <div class="font-semibold text-indigo-600">${hourData.mh.toFixed(2)}</div>
                    <div class="text-gray-500">${hourData.qty.toFixed(0)}</div>
                </td>`;
            } else {
                html += `<td class="px-3 py-2 text-center text-gray-300">-</td>`;
            }
        }

        row.innerHTML = html;
        tbody.appendChild(row);
    });
}

// HTP 시간 차이 계산 (MH = (HTP End - HTP Start) * 24)
function calculateMH(htpStart, htpEnd) {
    const start = parseTime(htpStart);
    const end = parseTime(htpEnd);

    let diffHours = end - start;

    // 자정을 넘어가는 경우 처리
    if (diffHours < 0) {
        diffHours += 24;
    }

    return diffHours;
}

// 시간 문자열을 시간(소수)로 변환
function parseTime(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
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

// 시간대별로 MH와 수량 분배
function distributeToHours(hourlyData, htpStart, htpEnd, totalMH, totalQty) {
    const start = parseTime(htpStart);
    const end = parseTime(htpEnd);

    let currentTime = start;
    const endTime = end > start ? end : end + 24;

    while (currentTime < endTime) {
        const currentHour = Math.floor(currentTime) % 24;
        const nextHour = currentTime + 1;
        const segmentEnd = Math.min(Math.ceil(currentTime), endTime);

        const segmentDuration = segmentEnd - currentTime;
        const ratio = segmentDuration / totalMH;

        // 00~08시 범위만 처리
        if (currentHour >= 0 && currentHour <= 8) {
            hourlyData[currentHour].mh += segmentDuration;
            hourlyData[currentHour].qty += totalQty * ratio;
        }

        currentTime = segmentEnd;
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

// 작업자 검색
workerSearch.addEventListener('input', (e) => {
    displayWorkerStatus(e.target.value);
});

// 데이터 초기화
clearDataBtn.addEventListener('click', async () => {
    if (confirm('모든 데이터를 삭제하시겠습니까?')) {
        await db.data.clear();
        await db.metadata.clear();

        mainTabsSection.classList.add('hidden');
        workerStatusTab.classList.add('hidden');
        rawDataTab.classList.add('hidden');
        clearDataBtn.classList.add('hidden');

        currentData = [];
        currentWorkDate = null;

        showToast('모든 데이터가 삭제되었습니다.');
    }
});

// 페이지 로드 시 저장된 데이터 표시
window.addEventListener('load', async () => {
    const data = await db.data.toArray();
    if (data.length > 0) {
        currentData = data;
        const metadata = await db.metadata.get('workDate');
        if (metadata) {
            currentWorkDate = metadata.value;
        }
        showUI();
    }
});
