// IndexedDB 설정 (Dexie.js 사용)
const db = new Dexie('WorkTrackingDB');
db.version(9).stores({
    data: '++id, employee, date',
    lmsData: '++id, employeeId, shift, date',
    hlLmsData: '++id, employeeId',
    workerOrder: 'employeeId, sortOrder',
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
const dailyReportTab = document.getElementById('daily-report-tab');
const lmsTab = document.getElementById('lms-tab');
const hlLmsTab = document.getElementById('hl-lms-tab');
const rawDataTab = document.getElementById('raw-data-tab');
const toast = document.getElementById('toast');
const lmsInput = document.getElementById('lms-input');
const parseLmsBtn = document.getElementById('parse-lms-btn');
const clearLmsBtn = document.getElementById('clear-lms-btn');
const lmsResult = document.getElementById('lms-result');
const lmsTableBody = document.getElementById('lms-table-body');
const addHlLmsRowBtn = document.getElementById('add-hl-lms-row');
const hlLmsBody = document.getElementById('hl-lms-body');
const exportHlLmsBtn = document.getElementById('export-hl-lms-btn');
const importHlLmsBtn = document.getElementById('import-hl-lms-btn');
const hlLmsImportInput = document.getElementById('hl-lms-import-input');
const dayLocationHourSelect = document.getElementById('day-location-hour');
const nightLocationHourSelect = document.getElementById('night-location-hour');
const dayLocationHeader = document.getElementById('day-location-header');
const dayLocationBody = document.getElementById('day-location-body');
const nightLocationHeader = document.getElementById('night-location-header');
const nightLocationBody = document.getElementById('night-location-body');

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

        // Work Date 컬럼에서 날짜 추출 (YYYY-MM-DD 형식)
        if (task['Work Date']) {
            // Excel 날짜 형식일 수도 있으므로 처리
            const dateStr = String(task['Work Date']);
            // 이미 YYYY-MM-DD 형식이면 그대로 사용
            if (dateStr.match(/\d{4}-\d{2}-\d{2}/)) {
                task['date'] = dateStr;
            } else {
                // 다른 형식이면 파싱 시도
                const parsedDate = new Date(task['Work Date']);
                if (!isNaN(parsedDate.getTime())) {
                    const year = parsedDate.getFullYear();
                    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                    const day = String(parsedDate.getDate()).padStart(2, '0');
                    task['date'] = `${year}-${month}-${day}`;
                }
            }
        }

        // 복합 키를 위해 htpStart 추가
        task.htpStart = task['HTP Start'] || '';

        tasks.push(task);
    }

    currentData = tasks;

    // bulkPut 사용 (복합 키로 중복 방지 및 업데이트)
    await db.data.bulkPut(tasks);
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
    dailyReportTab.classList.add('hidden');
    lmsTab.classList.add('hidden');
    hlLmsTab.classList.add('hidden');
    rawDataTab.classList.add('hidden');

    if (tabName === 'worker-status') {
        workerStatusTab.classList.remove('hidden');
        displayWorkerStatus();
    } else if (tabName === 'daily-report') {
        dailyReportTab.classList.remove('hidden');
        displayDailyReport();
    } else if (tabName === 'lms') {
        lmsTab.classList.remove('hidden');
        // 저장된 LMS 데이터가 있으면 표시
        const savedLmsData = await db.lmsData.toArray();
        if (savedLmsData.length > 0) {
            displayLmsData(savedLmsData);
            lmsResult.classList.remove('hidden');
        }
    } else if (tabName === 'hl-lms') {
        hlLmsTab.classList.remove('hidden');
        // 저장된 HL LMS 데이터 표시
        await loadHlLmsData();
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

    // 데이터에서 사용 가능한 날짜 찾기
    const dates = [...new Set(data.map(task => task.date).filter(d => d))].sort();
    console.log('사용 가능한 날짜들:', dates);

    // 최신 날짜 (Day 시프트용)
    let latestDate = dates.length > 0 ? dates[dates.length - 1] : null;

    // 전일 날짜 (HL LMS Night 시프트용)
    let previousDate = dates.length > 1 ? dates[dates.length - 2] : null;

    // 날짜 정보가 없으면 'undefined' 사용
    if (!latestDate) {
        console.log('날짜 정보가 없습니다. 전체 데이터를 사용합니다.');
        latestDate = 'undefined';
        previousDate = 'undefined';
    }

    console.log('최신 날짜 (Day/LMS Night):', latestDate);
    console.log('전일 날짜 (HL LMS Night):', previousDate);

    // LMS 데이터 로드 (이름 매칭 및 시프트 시간 범위)
    const lmsData = await db.lmsData.toArray();
    const lmsMap = {};
    lmsData.forEach(item => {
        let employeeId = item.employeeId;

        // employeeId가 8자리가 아니면 다시 추출 (기존 데이터 호환성)
        if (employeeId && employeeId.length !== 8) {
            // 010 다음의 8자리 추출 시도
            const match = String(employeeId).match(/010(\d{8})/);
            if (match) {
                employeeId = match[1];
            } else {
                // 그냥 8자리 숫자 추출
                const fallbackMatch = String(employeeId).match(/\d{8}/);
                if (fallbackMatch) {
                    employeeId = fallbackMatch[0];
                }
            }
        }

        if (employeeId) {
            lmsMap[employeeId] = {
                workerName: item.workerName,
                shift: item.shift,
                shiftStart: item.shiftStart,
                shiftEnd: item.shiftEnd
            };
        }
    });

    // HL LMS 데이터 로드 (이름 매칭 및 시프트 시간 범위)
    const hlLmsData = await db.hlLmsData.toArray();
    const hlLmsEmployeeIds = new Set(); // HL LMS에 속한 작업자 ID 추적

    hlLmsData.forEach(item => {
        const employeeId = item.employeeId;

        if (employeeId) {
            hlLmsEmployeeIds.add(employeeId); // HL LMS 작업자로 표시
            // HL LMS 데이터로 덮어쓰거나 추가 (HL LMS가 우선순위)
            lmsMap[employeeId] = {
                workerName: item.nickname,
                shift: item.shift || item.wave, // shift 우선, 없으면 wave (하위 호환성)
                shiftStart: item.shiftStart,
                shiftEnd: item.shiftEnd,
                isHlLms: true // HL LMS 작업자 표시
            };
        }
    });

    console.log('LMS 매핑 (LMS + HL LMS):', lmsMap);
    console.log('LMS 원본 데이터:', lmsData);
    console.log('HL LMS 원본 데이터:', hlLmsData);
    console.log('HL LMS 작업자 IDs:', Array.from(hlLmsEmployeeIds));

    // 작업자별 데이터 집계 (날짜별로 분리)
    const workerStats = {};

    data.forEach(task => {
        const employee = task['Employee'] || '이름 없음';
        const taskDate = task.date || 'undefined'; // 날짜가 없으면 'undefined' 키 사용

        if (!workerStats[employee]) {
            workerStats[employee] = {
                name: employee,
                dates: {} // 날짜별 데이터 저장
            };
        }

        // 날짜별로 데이터 초기화
        if (!workerStats[employee].dates[taskDate]) {
            workerStats[employee].dates[taskDate] = {
                totalMH: 0,
                totalQty: 0,
                totalHTP: 0,
                hourlyData: Array(33).fill(null).map(() => ({
                    totalMH: 0,
                    totalQty: 0
                })) // 00~32시 (24~32시는 다음날 00~08시 매핑용)
            };
        }

        // HTP Start, HTP End 파싱
        const htpStart = task['HTP Start'];
        const htpEnd = task['HTP End'];
        const processTask = task['Process(Task)'];
        const unitQty = parseFloat(task['Unit Qty']) || 0;
        const hourOfWorkDate = parseInt(task['HourOfWorkDate']) || null;

        if (htpStart && htpEnd) {
            // Process(Task)가 "STOW(STOW)"인 경우만 MH와 수량 모두 반영
            if (processTask === 'STOW(STOW)') {
                const mh = calculateMH(htpStart, htpEnd);
                const qty = unitQty;

                workerStats[employee].dates[taskDate].totalMH += mh;
                workerStats[employee].dates[taskDate].totalQty += qty;

                // 시간대별로 MH와 수량 분배 (HourOfWorkDate 사용)
                if (hourOfWorkDate !== null && hourOfWorkDate >= 0 && hourOfWorkDate <= 32) {
                    // HourOfWorkDate를 인덱스로 사용 (0=00시, 1=01시, ..., 24=00시(다음날), 25=01시(다음날), 32=08시(다음날))
                    workerStats[employee].dates[taskDate].hourlyData[hourOfWorkDate].totalMH += mh;
                    workerStats[employee].dates[taskDate].hourlyData[hourOfWorkDate].totalQty += qty;
                } else {
                    // HourOfWorkDate가 없거나 범위를 벗어나면 기존 방식 사용
                    distributeToHourRangesExtended(workerStats[employee].dates[taskDate].hourlyData, htpStart, htpEnd, mh, qty);
                }
            }
        }
    });

    // 작업자 목록
    let workers = Object.values(workerStats);

    // 사용자 정의 순서 로드
    const workerOrderData = await db.workerOrder.toArray();
    const workerOrderMap = {};
    workerOrderData.forEach(item => {
        workerOrderMap[item.employeeId] = item.sortOrder;
    });

    // 작업자 정렬: 사용자 정의 순서 > LMS 작업자 먼저, HL LMS 작업자 나중에
    workers.sort((a, b) => {
        const aIsHlLms = lmsMap[a.name] && lmsMap[a.name].isHlLms;
        const bIsHlLms = lmsMap[b.name] && lmsMap[b.name].isHlLms;

        // HL LMS 작업자를 아래로
        if (aIsHlLms && !bIsHlLms) return 1;
        if (!aIsHlLms && bIsHlLms) return -1;

        // 같은 그룹 내에서 사용자 정의 순서 적용
        const aOrder = workerOrderMap[a.name] ?? 999999;
        const bOrder = workerOrderMap[b.name] ?? 999999;

        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }

        // 순서가 같으면 이름 순
        return a.name.localeCompare(b.name);
    });

    // Day 테이블 생성
    const dayTbody = document.getElementById('day-status-body');
    dayTbody.innerHTML = '';

    workers.forEach(worker => {
        // LMS에서 이름 및 시프트 시간 찾기
        const lmsInfo = lmsMap[worker.name];
        const workerName = lmsInfo ? lmsInfo.workerName : '-';

        // Day 시프트는 최신 날짜 데이터 사용
        const dayData = worker.dates[latestDate];
        if (!dayData) {
            console.log(`${worker.name}: Day 데이터 없음 (날짜: ${latestDate})`);
            return; // 최신 날짜 데이터가 없으면 건너뜀
        }

        // 시프트 시간 범위 계산 (시 단위)
        let validHours = null;
        if (lmsInfo && lmsInfo.shiftStart && lmsInfo.shiftEnd) {
            const startHour = parseInt(lmsInfo.shiftStart.split(':')[0]);
            const endTimeParts = lmsInfo.shiftEnd.split(':');
            const endHour = parseInt(endTimeParts[0]);
            const endMinute = parseInt(endTimeParts[1]) || 0;

            // 종료 시간이 정각(00분)이면 이전 시간대까지만 포함
            // 예: 09:00 종료 -> 08시까지, 09:30 종료 -> 09시까지
            const actualEndHour = (endMinute === 0 && endHour > 0) ? endHour - 1 : endHour;

            validHours = { start: startHour, end: actualEndHour };
            console.log(`${worker.name} 시프트: ${startHour}시-${actualEndHour}시 (원본: ${lmsInfo.shiftStart}-${lmsInfo.shiftEnd})`);
        }

        // Day 시간대(09~18시)와 시프트가 겹치는지 확인
        let hasValidDayShift = false;
        if (!validHours) {
            // 시프트 정보가 없으면 기존 로직 사용
            hasValidDayShift = true;
        } else {
            // Day 시간대(09~18시) 중 하나라도 시프트 범위에 포함되는지 확인
            for (let i = 9; i <= 18; i++) {
                if (i >= validHours.start && i <= validHours.end) {
                    hasValidDayShift = true;
                    break;
                }
            }
        }

        // Day 시간대 합계 계산 (시프트 범위 내에서만)
        let dayMH = 0;
        let dayQty = 0;
        for (let i = 9; i <= 18; i++) {
            // 시프트 범위 체크
            const isInShiftRange = !validHours || (i >= validHours.start && i <= validHours.end);
            if (isInShiftRange) {
                dayMH += dayData.hourlyData[i].totalMH;
                dayQty += dayData.hourlyData[i].totalQty;
            }
        }

        // Day 시간대에 작업이 있고 시프트가 겹치는 경우에만 표시
        if (dayMH > 0 && hasValidDayShift) {
            const dayRow = document.createElement('tr');
            dayRow.className = 'border-b hover:bg-gray-50 cursor-move';
            dayRow.draggable = true;
            dayRow.dataset.employeeId = worker.name;

            const dayTotalHTP = dayMH > 0 ? dayQty / dayMH : 0;

            // Total HTP 배경색
            const totalBgColor = dayTotalHTP >= 470 ? 'bg-blue-100' : 'bg-red-100';
            const totalTextColor = dayTotalHTP >= 470 ? 'text-blue-800' : 'text-red-800';

            let dayHtml = `
                <td class="px-1 py-2 font-medium text-center sticky left-0 bg-white border border-gray-300">${workerName}</td>
                <td class="px-1 py-2 font-medium text-center border border-gray-300">${worker.name}</td>
                <td class="px-1 py-2 text-center border border-gray-300 ${totalBgColor}">
                    <div class="font-semibold ${totalTextColor}">${dayTotalHTP.toFixed(0)}</div>
                </td>
            `;

            // Day 시간대: 09~18시
            for (let i = 9; i <= 18; i++) {
                const hourData = dayData.hourlyData[i];

                // 시프트 범위 체크 (시프트 시간이 있으면 범위 내에서만 표시)
                const isInShiftRange = !validHours || (i >= validHours.start && i <= validHours.end);

                if (hourData.totalMH > 0 && isInShiftRange) {
                    const htp = hourData.totalQty / hourData.totalMH;
                    const bgColor = htp >= 470 ? 'bg-blue-100' : 'bg-red-100';
                    const textColor = htp >= 470 ? 'text-blue-800' : 'text-red-800';
                    dayHtml += `<td class="px-1 py-2 text-center border border-gray-300 ${bgColor}">
                        <div class="font-semibold ${textColor}">${htp.toFixed(0)}</div>
                    </td>`;
                } else {
                    dayHtml += `<td class="px-1 py-2 text-center text-gray-400 border border-gray-300">-</td>`;
                }
            }

            dayRow.innerHTML = dayHtml;
            dayTbody.appendChild(dayRow);

            // 드래그 이벤트 추가
            setupDragEvents(dayRow, dayTbody);
        }
    });

    // Night 테이블 생성
    const nightTbody = document.getElementById('night-status-body');
    nightTbody.innerHTML = '';

    workers.forEach(worker => {
        // LMS에서 이름 및 시프트 시간 찾기
        const lmsInfo = lmsMap[worker.name];
        const workerName = lmsInfo ? lmsInfo.workerName : '-';
        const isHlLms = lmsInfo && lmsInfo.isHlLms;

        // Night 시프트 데이터 선택
        // LMS 작업자: 최신 날짜의 00~08시 사용
        // HL LMS 작업자: 전일의 24~32시를 00~08시로 매핑
        let nightData = null;
        let useExtendedHours = false;

        if (isHlLms) {
            // HL LMS 작업자: 전일 24~32시 데이터 사용
            nightData = worker.dates[previousDate];
            if (nightData) {
                useExtendedHours = true; // 24~32시 인덱스 사용
                console.log(`${worker.name} (HL LMS): 전일(${previousDate}) 24~32시 데이터 사용`);
            }
        } else {
            // LMS 작업자: 최신 날짜 00~08시 데이터 사용
            nightData = worker.dates[latestDate];
            if (nightData) {
                useExtendedHours = false; // 00~08시 인덱스 사용
                console.log(`${worker.name} (LMS): 최신(${latestDate}) 00~08시 데이터 사용`);
            }
        }

        if (!nightData) {
            console.log(`${worker.name}: Night 데이터 없음 (날짜: ${isHlLms ? previousDate : latestDate})`);
            return; // 데이터가 없으면 건너뜀
        }

        // 시프트 시간 범위 계산 (시 단위)
        let validHours = null;
        if (lmsInfo && lmsInfo.shiftStart && lmsInfo.shiftEnd) {
            const startHour = parseInt(lmsInfo.shiftStart.split(':')[0]);
            const endTimeParts = lmsInfo.shiftEnd.split(':');
            const endHour = parseInt(endTimeParts[0]);
            const endMinute = parseInt(endTimeParts[1]) || 0;

            // 종료 시간이 정각(00분)이면 이전 시간대까지만 포함
            // 예: 09:00 종료 -> 08시까지, 09:30 종료 -> 09시까지
            const actualEndHour = (endMinute === 0 && endHour > 0) ? endHour - 1 : endHour;

            validHours = { start: startHour, end: actualEndHour };
        }

        // Night 시간대(00~08시)와 시프트가 겹치는지 확인
        let hasValidNightShift = false;
        if (!validHours) {
            // 시프트 정보가 없으면 기존 로직 사용
            hasValidNightShift = true;
        } else {
            // Night 시간대(00~08시) 중 하나라도 시프트 범위에 포함되는지 확인
            for (let i = 0; i <= 8; i++) {
                // 자정을 넘어가는 경우 처리
                if (validHours.start < validHours.end) {
                    // 일반적인 경우 (예: 01:30 ~ 09:00)
                    if (i >= validHours.start && i <= validHours.end) {
                        hasValidNightShift = true;
                        break;
                    }
                } else {
                    // 자정을 넘는 경우 (예: 22:00 ~ 06:00)
                    if (i >= validHours.start || i <= validHours.end) {
                        hasValidNightShift = true;
                        break;
                    }
                }
            }
        }

        // Night 시간대 합계 계산 (시프트 범위 내에서만)
        let nightMH = 0;
        let nightQty = 0;
        for (let i = 0; i <= 8; i++) {
            // 시프트 범위 체크
            let isInShiftRange = true;
            if (validHours) {
                if (validHours.start < validHours.end) {
                    isInShiftRange = (i >= validHours.start && i <= validHours.end);
                } else {
                    isInShiftRange = (i >= validHours.start || i <= validHours.end);
                }
            }
            if (isInShiftRange) {
                // HL LMS는 24~32시 인덱스, LMS는 00~08시 인덱스 사용
                const hourIndex = useExtendedHours ? (24 + i) : i;
                nightMH += nightData.hourlyData[hourIndex].totalMH;
                nightQty += nightData.hourlyData[hourIndex].totalQty;
            }
        }

        // Night 시간대에 작업이 있고 시프트가 겹치는 경우에만 표시
        if (nightMH > 0 && hasValidNightShift) {
            const nightRow = document.createElement('tr');
            nightRow.className = 'border-b hover:bg-gray-50 cursor-move';
            nightRow.draggable = true;
            nightRow.dataset.employeeId = worker.name;

            const nightTotalHTP = nightMH > 0 ? nightQty / nightMH : 0;

            // Total HTP 배경색
            const totalBgColor = nightTotalHTP >= 470 ? 'bg-blue-100' : 'bg-red-100';
            const totalTextColor = nightTotalHTP >= 470 ? 'text-blue-800' : 'text-red-800';

            let nightHtml = `
                <td class="px-1 py-2 font-medium text-center sticky left-0 bg-white border border-gray-300">${workerName}</td>
                <td class="px-1 py-2 font-medium text-center border border-gray-300">${worker.name}</td>
                <td class="px-1 py-2 text-center border border-gray-300 ${totalBgColor}">
                    <div class="font-semibold ${totalTextColor}">${nightTotalHTP.toFixed(0)}</div>
                </td>
            `;

            // Night 시간대: 00~08시 (HL LMS는 전일 24~32시 데이터 표시)
            for (let i = 0; i <= 8; i++) {
                // HL LMS는 24~32시 인덱스, LMS는 00~08시 인덱스 사용
                const hourIndex = useExtendedHours ? (24 + i) : i;
                const hourData = nightData.hourlyData[hourIndex];

                // 시프트 범위 체크 (Night는 자정 넘어갈 수 있음)
                let isInShiftRange = true;
                if (validHours) {
                    // 자정을 넘어가는 경우 (예: 01:30 ~ 09:00)
                    if (validHours.start < validHours.end) {
                        isInShiftRange = (i >= validHours.start && i <= validHours.end);
                    } else {
                        // 자정을 넘는 경우 (예: 22:00 ~ 06:00)
                        isInShiftRange = (i >= validHours.start || i <= validHours.end);
                    }
                }

                if (hourData.totalMH > 0 && isInShiftRange) {
                    const htp = hourData.totalQty / hourData.totalMH;
                    const bgColor = htp >= 470 ? 'bg-blue-100' : 'bg-red-100';
                    const textColor = htp >= 470 ? 'text-blue-800' : 'text-red-800';
                    nightHtml += `<td class="px-1 py-2 text-center border border-gray-300 ${bgColor}">
                        <div class="font-semibold ${textColor}">${htp.toFixed(0)}</div>
                    </td>`;
                } else {
                    nightHtml += `<td class="px-1 py-2 text-center text-gray-400 border border-gray-300">-</td>`;
                }
            }

            nightRow.innerHTML = nightHtml;
            nightTbody.appendChild(nightRow);

            // 드래그 이벤트 추가
            setupDragEvents(nightRow, nightTbody);
        }
    });

    // HTP 테이블에 표시된 작업자 목록 수집
    const dayWorkers = [];
    const nightWorkers = [];

    workers.forEach(worker => {
        const lmsInfo = lmsMap[worker.name];
        const isHlLms = lmsInfo && lmsInfo.isHlLms;

        // Day 데이터 확인
        const dayData = latestDate && worker.dates[latestDate] ? worker.dates[latestDate] : null;
        if (dayData) {
            let validHours = null;
            if (lmsInfo && lmsInfo.shiftStart && lmsInfo.shiftEnd) {
                const startHour = parseInt(lmsInfo.shiftStart.split(':')[0]);
                const endTimeParts = lmsInfo.shiftEnd.split(':');
                const endHour = parseInt(endTimeParts[0]);
                const endMinute = parseInt(endTimeParts[1]) || 0;
                const actualEndHour = (endMinute === 0 && endHour > 0) ? endHour - 1 : endHour;
                validHours = { start: startHour, end: actualEndHour };
            }

            let hasValidDayShift = false;
            if (!validHours) {
                hasValidDayShift = true;
            } else {
                for (let i = 9; i <= 18; i++) {
                    if (i >= validHours.start && i <= validHours.end) {
                        hasValidDayShift = true;
                        break;
                    }
                }
            }

            let dayMH = 0;
            for (let i = 9; i <= 18; i++) {
                const isInShiftRange = !validHours || (i >= validHours.start && i <= validHours.end);
                if (isInShiftRange) {
                    dayMH += dayData.hourlyData[i].totalMH;
                }
            }

            if (dayMH > 0 && hasValidDayShift) {
                dayWorkers.push({ worker, isHlLms, lmsInfo });
            }
        }

        // Night 데이터 확인
        let nightData = null;
        if (isHlLms) {
            nightData = previousDate && worker.dates[previousDate] ? worker.dates[previousDate] : null;
        } else {
            nightData = latestDate && worker.dates[latestDate] ? worker.dates[latestDate] : null;
        }

        if (nightData) {
            let validHours = null;
            if (lmsInfo && lmsInfo.shiftStart && lmsInfo.shiftEnd) {
                const startHour = parseInt(lmsInfo.shiftStart.split(':')[0]);
                const endTimeParts = lmsInfo.shiftEnd.split(':');
                const endHour = parseInt(endTimeParts[0]);
                const endMinute = parseInt(endTimeParts[1]) || 0;
                const actualEndHour = (endMinute === 0 && endHour > 0) ? endHour - 1 : endHour;
                validHours = { start: startHour, end: actualEndHour };
            }

            let hasValidNightShift = false;
            if (!validHours) {
                hasValidNightShift = true;
            } else {
                for (let i = 0; i <= 8; i++) {
                    if (validHours.start < validHours.end) {
                        if (i >= validHours.start && i <= validHours.end) {
                            hasValidNightShift = true;
                            break;
                        }
                    } else {
                        if (i >= validHours.start || i <= validHours.end) {
                            hasValidNightShift = true;
                            break;
                        }
                    }
                }
            }

            let nightMH = 0;
            for (let i = 0; i <= 8; i++) {
                let isInShiftRange = true;
                if (validHours) {
                    if (validHours.start < validHours.end) {
                        isInShiftRange = (i >= validHours.start && i <= validHours.end);
                    } else {
                        isInShiftRange = (i >= validHours.start || i <= validHours.end);
                    }
                }
                if (isInShiftRange) {
                    const hourIndex = isHlLms ? (24 + i) : i;
                    nightMH += nightData.hourlyData[hourIndex].totalMH;
                }
            }

            if (nightMH > 0 && hasValidNightShift) {
                nightWorkers.push({ worker, isHlLms, lmsInfo });
            }
        }
    });

    // Location 테이블 표시
    displayLocationTables(data, dayWorkers, nightWorkers, lmsMap);

    // Daily Report 업데이트 (HTP 테이블에 표시된 작업자들의 데이터 전달)
    displayDailyReport(dayWorkers, nightWorkers);
}

// Location별 작업 현황 표시
async function displayLocationTables(data, dayWorkers, nightWorkers, lmsMap) {
    // 날짜 정보
    const dates = [...new Set(data.map(task => task.date).filter(d => d))].sort();
    const latestDate = dates.length > 0 ? dates[dates.length - 1] : 'undefined';
    const previousDate = dates.length > 1 ? dates[dates.length - 2] : 'undefined';

    // 최신 시간 찾기 (데이터가 있는 가장 늦은 시간)
    let latestDayHour = 9;
    let latestNightHour = 0;

    // Day 시간대 (09-18)의 최신 시간 찾기
    for (let hour = 18; hour >= 9; hour--) {
        const hasData = dayWorkers.some(({ worker }) => {
            const dayData = latestDate && worker.dates[latestDate] ? worker.dates[latestDate] : null;
            return dayData && dayData.hourlyData[hour] && dayData.hourlyData[hour].totalMH > 0;
        });
        if (hasData) {
            latestDayHour = hour;
            break;
        }
    }

    // Night 시간대 (00-08)의 최신 시간 찾기
    for (let hour = 8; hour >= 0; hour--) {
        const hasData = nightWorkers.some(({ worker, isHlLms }) => {
            let nightData = null;
            if (isHlLms) {
                nightData = previousDate && worker.dates[previousDate] ? worker.dates[previousDate] : null;
                const hourIndex = 24 + hour;
                return nightData && nightData.hourlyData[hourIndex] && nightData.hourlyData[hourIndex].totalMH > 0;
            } else {
                nightData = latestDate && worker.dates[latestDate] ? worker.dates[latestDate] : null;
                return nightData && nightData.hourlyData[hour] && nightData.hourlyData[hour].totalMH > 0;
            }
        });
        if (hasData) {
            latestNightHour = hour;
            break;
        }
    }

    // 선택된 시간이 없거나 초기값이면 최신 시간으로 설정
    if (!dayLocationHourSelect.value || dayLocationHourSelect.value === '9') {
        dayLocationHourSelect.value = latestDayHour.toString();
    }
    if (!nightLocationHourSelect.value || nightLocationHourSelect.value === '0') {
        nightLocationHourSelect.value = latestNightHour.toString();
    }

    const dayHour = parseInt(dayLocationHourSelect.value);
    const nightHour = parseInt(nightLocationHourSelect.value);

    // Location별, 작업자별, 날짜별 데이터 집계
    const locationData = {};

    data.forEach(task => {
        const employee = task['Employee'] || '이름 없음';
        const location = task['Location'] || '-';
        const taskDate = task.date || 'undefined';
        const htpStart = task['HTP Start'];
        const htpEnd = task['HTP End'];
        const processTask = task['Process(Task)'];
        const unitQty = parseFloat(task['Unit Qty']) || 0;

        if (!htpStart || !htpEnd || processTask !== 'STOW(STOW)') return;

        const startSeconds = parseTimeToSeconds(htpStart);
        const endSeconds = parseTimeToSeconds(htpEnd);

        if (!locationData[location]) {
            locationData[location] = {};
        }
        if (!locationData[location][employee]) {
            locationData[location][employee] = {};
        }
        if (!locationData[location][employee][taskDate]) {
            locationData[location][employee][taskDate] = Array(33).fill(null).map(() => ({ mh: 0, qty: 0 }));
        }

        // 각 시간대에 대해 계산 (00~32시)
        for (let hour = 0; hour < 33; hour++) {
            const actualHour = hour % 24;
            const hourStartSeconds = actualHour * 3600;
            const hourEndSeconds = (actualHour + 1) * 3600 - 1;

            // 이 작업이 해당 시간대와 겹치는지 확인
            const overlapStart = Math.max(startSeconds, hourStartSeconds);
            const overlapEnd = Math.min(endSeconds, hourEndSeconds);

            if (overlapStart <= overlapEnd) {
                const overlapSeconds = overlapEnd - overlapStart + 1;
                const totalSeconds = endSeconds - startSeconds + 1;
                const ratio = overlapSeconds / totalSeconds;

                const mh = (overlapSeconds / 3600);
                const qty = unitQty * ratio;

                // 00~23시 범위에 저장
                if (hour < 24) {
                    locationData[location][employee][taskDate][hour].mh += mh;
                    locationData[location][employee][taskDate][hour].qty += qty;
                }

                // 24~32시 범위 (00~08시를 24~32시로도 저장)
                if (actualHour <= 8 && hour >= 24) {
                    locationData[location][employee][taskDate][hour].mh += mh;
                    locationData[location][employee][taskDate][hour].qty += qty;
                }
            }
        }
    });

    // Day Location 테이블 생성
    displayLocationTable(
        locationData,
        dayWorkers,
        lmsMap,
        dayHour,
        latestDate,
        previousDate,
        dayLocationHeader,
        dayLocationBody,
        'day'
    );

    // Night Location 테이블 생성
    displayLocationTable(
        locationData,
        nightWorkers,
        lmsMap,
        nightHour,
        latestDate,
        previousDate,
        nightLocationHeader,
        nightLocationBody,
        'night'
    );
}

// Location 테이블 표시
function displayLocationTable(locationData, validWorkers, lmsMap, selectedHour, latestDate, previousDate, headerElement, bodyElement, type) {
    // validWorkers는 이미 HTP 테이블에서 필터링되어 전달됨

    // 모든 Location 수집
    const locations = Object.keys(locationData).sort();

    // 헤더 생성 (이름, 작업자, Total Unit, 해당시간 Unit, Location들을 열로)
    headerElement.innerHTML = `
        <th class="px-1 py-2 text-center font-semibold border border-gray-300 sticky left-0 ${type === 'day' ? 'bg-blue-50' : 'bg-indigo-50'}">이름</th>
        <th class="px-1 py-2 text-center font-semibold border border-gray-300 ${type === 'day' ? 'bg-blue-50' : 'bg-indigo-50'}">작업자</th>
        <th class="px-2 py-2 text-center font-semibold border border-gray-300 ${type === 'day' ? 'bg-blue-50' : 'bg-indigo-50'}">Total Unit</th>
        <th class="px-2 py-2 text-center font-semibold border border-gray-300 ${type === 'day' ? 'bg-blue-50' : 'bg-indigo-50'}">${selectedHour}시 Unit</th>
    `;

    locations.forEach(location => {
        headerElement.innerHTML += `<th class="px-2 py-2 text-center font-semibold border border-gray-300">${location}</th>`;
    });

    // 바디 생성 (작업자들을 행으로)
    bodyElement.innerHTML = '';

    validWorkers.forEach(({ worker, isHlLms, lmsInfo }) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';

        const workerName = lmsInfo ? lmsInfo.workerName : worker.name;

        // 시프트 시간 범위 계산
        let validHours = null;
        if (lmsInfo && lmsInfo.shiftStart && lmsInfo.shiftEnd) {
            const startHour = parseInt(lmsInfo.shiftStart.split(':')[0]);
            const endTimeParts = lmsInfo.shiftEnd.split(':');
            const endHour = parseInt(endTimeParts[0]);
            const endMinute = parseInt(endTimeParts[1]) || 0;
            const actualEndHour = (endMinute === 0 && endHour > 0) ? endHour - 1 : endHour;
            validHours = { start: startHour, end: actualEndHour };
        }

        // Total Unit 계산 (시프트 시간 범위 내 모든 Unit Qty의 합)
        let totalUnit = 0;

        locations.forEach(location => {
            const employeeData = locationData[location] && locationData[location][worker.name];
            if (employeeData) {
                if (type === 'day') {
                    const dateData = employeeData[latestDate];
                    if (dateData) {
                        for (let i = 9; i <= 18; i++) {
                            const isInShiftRange = !validHours || (i >= validHours.start && i <= validHours.end);
                            if (isInShiftRange && dateData[i]) {
                                totalUnit += dateData[i].qty;
                            }
                        }
                    }
                } else {
                    // Night
                    if (isHlLms) {
                        const dateData = employeeData[previousDate];
                        if (dateData) {
                            for (let i = 0; i <= 8; i++) {
                                const hourIndex = 24 + i;
                                const isInShiftRange = !validHours || (i >= validHours.start && i <= validHours.end);
                                if (isInShiftRange && dateData[hourIndex]) {
                                    totalUnit += dateData[hourIndex].qty;
                                }
                            }
                        }
                    } else {
                        const dateData = employeeData[latestDate];
                        if (dateData) {
                            for (let i = 0; i <= 8; i++) {
                                const isInShiftRange = !validHours || (
                                    validHours.start < validHours.end ?
                                    (i >= validHours.start && i <= validHours.end) :
                                    (i >= validHours.start || i <= validHours.end)
                                );
                                if (isInShiftRange && dateData[i]) {
                                    totalUnit += dateData[i].qty;
                                }
                            }
                        }
                    }
                }
            }
        });

        // 해당 시간대 Unit 계산 (선택한 시간의 모든 Location 합)
        let selectedHourUnit = 0;
        locations.forEach(location => {
            const employeeData = locationData[location] && locationData[location][worker.name];
            if (employeeData) {
                let dateData = null;
                let hourIndex = selectedHour;

                if (type === 'day') {
                    dateData = employeeData[latestDate];
                } else {
                    if (isHlLms) {
                        dateData = employeeData[previousDate];
                        hourIndex = 24 + selectedHour;
                    } else {
                        dateData = employeeData[latestDate];
                    }
                }

                if (dateData && dateData[hourIndex]) {
                    selectedHourUnit += dateData[hourIndex].qty;
                }
            }
        });

        let rowHtml = `
            <td class="px-1 py-2 font-medium text-center border border-gray-300 sticky left-0 bg-white">${workerName}</td>
            <td class="px-1 py-2 text-center border border-gray-300 bg-white">${worker.name}</td>
            <td class="px-2 py-2 text-center border border-gray-300 bg-white font-semibold">${totalUnit.toFixed(0)}</td>
            <td class="px-2 py-2 text-center border border-gray-300 bg-white font-semibold">${selectedHourUnit.toFixed(0)}</td>
        `;

        locations.forEach(location => {
            const employeeData = locationData[location] && locationData[location][worker.name];

            if (employeeData) {
                // 날짜 및 시간 인덱스 결정
                let dateData = null;
                let hourIndex = selectedHour;

                if (type === 'day') {
                    // Day: 최신 날짜 데이터 사용
                    dateData = employeeData[latestDate];
                } else {
                    // Night
                    if (isHlLms) {
                        // HL LMS: 전일 24~32시
                        dateData = employeeData[previousDate];
                        hourIndex = 24 + selectedHour;
                    } else {
                        // LMS: 최신 날짜 00~08시
                        dateData = employeeData[latestDate];
                    }
                }

                if (dateData && dateData[hourIndex]) {
                    const hourData = dateData[hourIndex];
                    if (hourData.qty > 0) {
                        const qty = hourData.qty;
                        rowHtml += `<td class="px-2 py-2 text-center border border-gray-300">
                            <div class="font-semibold text-gray-800">${qty.toFixed(0)}</div>
                        </td>`;
                    } else {
                        rowHtml += `<td class="px-2 py-2 text-center border border-gray-300 text-gray-400">-</td>`;
                    }
                } else {
                    rowHtml += `<td class="px-2 py-2 text-center border border-gray-300 text-gray-400">-</td>`;
                }
            } else {
                rowHtml += `<td class="px-2 py-2 text-center border border-gray-300 text-gray-400">-</td>`;
            }
        });

        row.innerHTML = rowHtml;
        bodyElement.appendChild(row);
    });
}

// 드래그 앤 드롭 이벤트 설정
function setupDragEvents(row, tbody) {
    row.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.target.classList.add('opacity-50');
    });

    row.addEventListener('dragend', (e) => {
        e.target.classList.remove('opacity-50');
    });

    row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const draggingRow = tbody.querySelector('.opacity-50');
        if (draggingRow && draggingRow !== e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;

            if (e.clientY < midpoint) {
                tbody.insertBefore(draggingRow, e.currentTarget);
            } else {
                tbody.insertBefore(draggingRow, e.currentTarget.nextSibling);
            }
        }
    });

    row.addEventListener('drop', async (e) => {
        e.preventDefault();
        // 순서가 변경되었으므로 저장
        await saveWorkerOrder(tbody);
        // Location 테이블 실시간 업데이트
        await displayWorkerStatus();
    });
}

// 작업자 순서 저장
async function saveWorkerOrder(tbody) {
    const rows = tbody.querySelectorAll('tr');
    const orderData = [];

    rows.forEach((row, index) => {
        const employeeId = row.dataset.employeeId;
        if (employeeId) {
            orderData.push({
                employeeId: employeeId,
                sortOrder: index
            });
        }
    });

    try {
        // 기존 순서 삭제 후 새로 저장
        await db.workerOrder.clear();
        if (orderData.length > 0) {
            await db.workerOrder.bulkAdd(orderData);
        }
        console.log('작업자 순서 저장:', orderData.length, '건');
    } catch (error) {
        console.error('작업자 순서 저장 오류:', error);
    }
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

// 시간대별로 작업시간과 수량 분배 (24~32시 확장)
function distributeToHourRangesExtended(hourlyData, htpStart, htpEnd, totalMH, totalQty) {
    const startSeconds = parseTimeToSeconds(htpStart);
    const endSeconds = parseTimeToSeconds(htpEnd);

    let currentSeconds = startSeconds;
    let remainingSeconds = endSeconds - startSeconds;

    // 자정을 넘어가는 경우 처리
    if (remainingSeconds < 0) {
        remainingSeconds += 24 * 3600;
    }

    while (remainingSeconds > 0) {
        const currentHour = Math.floor(currentSeconds / 3600);

        // 현재 시간대의 끝 (다음 정시)
        const nextHourSeconds = (currentHour + 1) * 3600;

        // 현재 시간대에서 작업한 시간 (초)
        const segmentSeconds = Math.min(nextHourSeconds - currentSeconds, remainingSeconds);

        // 비율 계산
        const ratio = segmentSeconds / (endSeconds - startSeconds > 0 ? endSeconds - startSeconds : endSeconds - startSeconds + 24 * 3600);

        // 00~23시 범위에 데이터 저장
        const hour24 = currentHour % 24;
        if (hour24 >= 0 && hour24 <= 23 && hourlyData[hour24]) {
            hourlyData[hour24].totalMH += segmentSeconds / 3600;
            hourlyData[hour24].totalQty += totalQty * ratio;
        }

        // 24~32시 범위 (00~08시를 24~32시로도 저장)
        if (hour24 >= 0 && hour24 <= 8) {
            const extendedHour = 24 + hour24;
            if (hourlyData[extendedHour]) {
                hourlyData[extendedHour].totalMH += segmentSeconds / 3600;
                hourlyData[extendedHour].totalQty += totalQty * ratio;
            }
        }

        // 다음 구간으로 이동
        currentSeconds = nextHourSeconds;
        remainingSeconds -= segmentSeconds;

        // 무한루프 방지 (24시간 초과 시 리셋)
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
        th.className = 'px-1 py-2 text-left font-semibold';
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
            td.className = 'px-1 py-2 text-sm';
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
            // 최소 8개 컬럼이 있어야 함 (시프트 종료시간까지)
            if (parts.length >= 8) {
                let employeeId = parts[1];
                const workerName = parts[3];
                const shift = parts[5];
                const shiftStart = parts[6];
                const shiftEnd = parts[7];

                // employeeId에서 010 다음의 8자리 숫자 추출
                // 01012345678 -> 12345678
                const match = String(employeeId).match(/010(\d{8})/);
                if (match) {
                    employeeId = match[1]; // 첫 번째 캡처 그룹 (010 제외한 8자리)
                } else {
                    // 010으로 시작하지 않으면 그냥 8자리 숫자 추출
                    const fallbackMatch = String(employeeId).match(/\d{8}/);
                    if (fallbackMatch) {
                        employeeId = fallbackMatch[0];
                    }
                }

                // 필수 데이터가 모두 있는 경우만 추가
                if (employeeId && workerName && shift) {
                    lmsData.push({
                        shift: shift,
                        workerName: workerName,
                        employeeId: employeeId,
                        shiftStart: shiftStart,
                        shiftEnd: shiftEnd
                    });
                    console.log(`✓ 줄 ${i}: 추가됨 - ${employeeId}, ${workerName}, ${shift}, ${shiftStart}-${shiftEnd}`);
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
            // 010 다음의 8자리 추출 시도
            const match = String(employeeId).match(/010(\d{8})/);
            if (match) {
                employeeId = match[1];
            } else {
                // 그냥 8자리 숫자 추출
                const fallbackMatch = String(employeeId).match(/\d{8}/);
                if (fallbackMatch) {
                    employeeId = fallbackMatch[0];
                }
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

// HL LMS 자동 저장 함수
async function autoSaveHlLmsData() {
    const rows = hlLmsBody.querySelectorAll('tr');
    const hlLmsData = [];
    const seenIds = new Set(); // 중복 방지

    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const rowData = {
            nickname: inputs[0].value.trim(),
            employeeId: inputs[1].value.trim(),
            shift: inputs[2].value.trim(),
            shiftStart: inputs[3].value,
            shiftEnd: inputs[4].value
        };

        // 최소한 작업자아이디가 있어야 저장하고, 중복 제거
        if (rowData.employeeId && !seenIds.has(rowData.employeeId)) {
            hlLmsData.push(rowData);
            seenIds.add(rowData.employeeId);
        }
    });

    try {
        // 기존 데이터 삭제 후 새로 저장
        await db.hlLmsData.clear();
        if (hlLmsData.length > 0) {
            await db.hlLmsData.bulkAdd(hlLmsData);
        }
        console.log('HL LMS 자동 저장:', hlLmsData.length, '건 (중복 제거됨)');
    } catch (error) {
        console.error('HL LMS 자동 저장 오류:', error);
    }
}

// HL LMS 관련 함수들
function createHlLmsRow(data = {}) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    row.innerHTML = `
        <td class="border border-gray-300 px-2 py-1">
            <input type="text" class="w-full px-2 py-1 border-0 focus:ring-2 focus:ring-indigo-500 rounded hl-lms-input"
                   placeholder="닉네임" value="${data.nickname || ''}" data-field="nickname">
        </td>
        <td class="border border-gray-300 px-1 py-2">
            <input type="text" class="w-full px-1 py-2 border-0 focus:ring-2 focus:ring-indigo-500 rounded hl-lms-input"
                   placeholder="12345678" value="${data.employeeId || ''}" data-field="employeeId">
        </td>
        <td class="border border-gray-300 px-1 py-2">
            <input type="text" class="w-full px-1 py-2 border-0 focus:ring-2 focus:ring-indigo-500 rounded hl-lms-input"
                   placeholder="Day/Night" value="${data.shift || data.wave || ''}" data-field="shift">
        </td>
        <td class="border border-gray-300 px-1 py-2">
            <input type="text" class="w-full px-1 py-2 border-0 focus:ring-2 focus:ring-indigo-500 rounded hl-lms-input"
                   placeholder="00:00~32:00" value="${data.shiftStart || ''}" data-field="shiftStart" pattern="^([0-2]?[0-9]|3[0-2]):[0-5][0-9]$">
        </td>
        <td class="border border-gray-300 px-1 py-2">
            <input type="text" class="w-full px-1 py-2 border-0 focus:ring-2 focus:ring-indigo-500 rounded hl-lms-input"
                   placeholder="00:00~32:00" value="${data.shiftEnd || ''}" data-field="shiftEnd" pattern="^([0-2]?[0-9]|3[0-2]):[0-5][0-9]$">
        </td>
        <td class="border border-gray-300 px-1 py-2 text-center">
            <button class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs delete-hl-lms-row">
                삭제
            </button>
        </td>
    `;

    // 삭제 버튼 이벤트
    row.querySelector('.delete-hl-lms-row').addEventListener('click', async () => {
        row.remove();
        await autoSaveHlLmsData();
    });

    // 각 input에 자동 저장 이벤트 추가 (blur만 사용하여 중복 방지)
    row.querySelectorAll('.hl-lms-input').forEach(input => {
        input.addEventListener('blur', autoSaveHlLmsData);
    });

    return row;
}

// HL LMS 데이터 로드
async function loadHlLmsData() {
    const data = await db.hlLmsData.toArray();
    hlLmsBody.innerHTML = '';

    if (data.length === 0) {
        // 기본 행 1개 추가
        hlLmsBody.appendChild(createHlLmsRow());
    } else {
        // 중복 제거 (작업자아이디 기준)
        const seenIds = new Set();
        const uniqueData = [];

        data.forEach(item => {
            if (item.employeeId && !seenIds.has(item.employeeId)) {
                uniqueData.push(item);
                seenIds.add(item.employeeId);
            }
        });

        // 중복이 발견되면 DB 정리
        if (uniqueData.length < data.length) {
            console.log(`중복 데이터 ${data.length - uniqueData.length}건 발견, DB 정리 중...`);
            await db.hlLmsData.clear();
            if (uniqueData.length > 0) {
                await db.hlLmsData.bulkAdd(uniqueData);
            }
        }

        uniqueData.forEach(item => {
            hlLmsBody.appendChild(createHlLmsRow(item));
        });
    }
}

// 행 추가 버튼
addHlLmsRowBtn.addEventListener('click', () => {
    hlLmsBody.appendChild(createHlLmsRow());
});

// HL LMS CSV 내보내기
exportHlLmsBtn.addEventListener('click', async () => {
    const data = await db.hlLmsData.toArray();

    if (data.length === 0) {
        showToast('내보낼 데이터가 없습니다.');
        return;
    }

    // CSV 헤더
    const headers = ['NickName', '작업자아이디', 'Shift', '시프트시작시간', '시프트종료시간'];

    // CSV 데이터 생성
    const csvRows = [headers.join(',')];

    data.forEach(item => {
        const row = [
            item.nickname || '',
            item.employeeId || '',
            item.shift || item.wave || '', // shift 우선, 없으면 wave (하위 호환성)
            item.shiftStart || '',
            item.shiftEnd || ''
        ];
        csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    // BOM 추가 (한글 깨짐 방지)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // 다운로드
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // 파일명에 날짜 포함
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    link.download = `HL_LMS_${dateStr}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`${data.length}건의 데이터를 내보냈습니다.`);
});

// HL LMS CSV 가져오기 버튼
importHlLmsBtn.addEventListener('click', () => {
    hlLmsImportInput.click();
});

// HL LMS CSV 파일 선택 이벤트
hlLmsImportInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
        showToast('CSV 파일만 가져올 수 있습니다.');
        return;
    }

    try {
        const text = await file.text();

        // BOM 제거
        const cleanText = text.replace(/^\uFEFF/, '');

        // 줄 단위로 분리
        const lines = cleanText.split(/\r?\n/).filter(line => line.trim());

        if (lines.length < 2) {
            showToast('CSV 파일에 데이터가 없습니다.');
            return;
        }

        // 헤더 제거
        const dataLines = lines.slice(1);

        const importedData = [];

        dataLines.forEach((line, index) => {
            const cols = line.split(',').map(col => col.trim());

            if (cols.length >= 2) { // 최소한 닉네임과 작업자아이디가 있어야 함
                importedData.push({
                    nickname: cols[0] || '',
                    employeeId: cols[1] || '',
                    shift: cols[2] || '',
                    shiftStart: cols[3] || '',
                    shiftEnd: cols[4] || ''
                });
            }
        });

        if (importedData.length === 0) {
            showToast('가져올 수 있는 데이터가 없습니다.');
            return;
        }

        // 기존 데이터 로드
        const existingData = await db.hlLmsData.toArray();
        const existingIds = new Set(existingData.map(item => item.employeeId));

        // 중복 제거 (작업자아이디 기준)
        const newData = importedData.filter(item => !existingIds.has(item.employeeId));

        if (newData.length === 0) {
            showToast('모든 데이터가 이미 존재합니다.');
            return;
        }

        // DB에 추가 (덮어쓰기 아닌 추가)
        await db.hlLmsData.bulkAdd(newData);

        // UI 갱신
        await loadHlLmsData();

        showToast(`${newData.length}건의 데이터를 추가했습니다. (중복 ${importedData.length - newData.length}건 제외)`);
    } catch (error) {
        console.error('CSV 가져오기 오류:', error);
        showToast('CSV 파일을 가져오는 중 오류가 발생했습니다.');
    } finally {
        // 파일 입력 초기화 (같은 파일을 다시 선택할 수 있도록)
        hlLmsImportInput.value = '';
    }
});

// 시간 선택 변경 이벤트
dayLocationHourSelect.addEventListener('change', () => {
    displayWorkerStatus();
});

nightLocationHourSelect.addEventListener('change', () => {
    displayWorkerStatus();
});

// Daily Report 차트 표시
let dailyReportChart = null;

async function displayDailyReport(dayWorkers, nightWorkers) {
    // 파라미터가 없으면 빈 배열 사용
    if (!dayWorkers || !nightWorkers) {
        dayWorkers = [];
        nightWorkers = [];
    }

    // 날짜 정보
    const data = await db.data.toArray();
    const dates = [...new Set(data.map(task => task.date).filter(d => d))].sort();
    const latestDate = dates.length > 0 ? dates[dates.length - 1] : 'undefined';
    const previousDate = dates.length > 1 ? dates[dates.length - 2] : 'undefined';

    // 09~08시 (24시간) 작업수 집계
    const hourlyActual = Array(24).fill(0);

    // Day 시간대 (09~18시) - HTP 테이블에 표시된 작업자만
    for (let hour = 9; hour <= 18; hour++) {
        dayWorkers.forEach(({ worker, lmsInfo }) => {
            const dayData = latestDate && worker.dates[latestDate] ? worker.dates[latestDate] : null;
            if (dayData && dayData.hourlyData[hour]) {
                // 시프트 범위 체크
                let validHours = null;
                if (lmsInfo && lmsInfo.shiftStart && lmsInfo.shiftEnd) {
                    const startHour = parseInt(lmsInfo.shiftStart.split(':')[0]);
                    const endTimeParts = lmsInfo.shiftEnd.split(':');
                    const endHour = parseInt(endTimeParts[0]);
                    const endMinute = parseInt(endTimeParts[1]) || 0;
                    const actualEndHour = (endMinute === 0 && endHour > 0) ? endHour - 1 : endHour;
                    validHours = { start: startHour, end: actualEndHour };
                }

                const isInShiftRange = !validHours || (hour >= validHours.start && hour <= validHours.end);
                if (isInShiftRange) {
                    const hourIndex = hour - 9; // 09시 -> index 0
                    hourlyActual[hourIndex] += dayData.hourlyData[hour].totalQty;
                }
            }
        });
    }

    // Night 시간대 (19~23시) - HTP 테이블에 표시된 작업자만
    for (let hour = 19; hour <= 23; hour++) {
        nightWorkers.forEach(({ worker, lmsInfo }) => {
            const nightData = latestDate && worker.dates[latestDate] ? worker.dates[latestDate] : null;
            if (nightData && nightData.hourlyData[hour]) {
                // 시프트 범위 체크
                let validHours = null;
                if (lmsInfo && lmsInfo.shiftStart && lmsInfo.shiftEnd) {
                    const startHour = parseInt(lmsInfo.shiftStart.split(':')[0]);
                    const endTimeParts = lmsInfo.shiftEnd.split(':');
                    const endHour = parseInt(endTimeParts[0]);
                    const endMinute = parseInt(endTimeParts[1]) || 0;
                    const actualEndHour = (endMinute === 0 && endHour > 0) ? endHour - 1 : endHour;
                    validHours = { start: startHour, end: actualEndHour };
                }

                const isInShiftRange = !validHours || (hour >= validHours.start && hour <= validHours.end);
                if (isInShiftRange) {
                    const hourIndex = hour - 9; // 19시 -> index 10
                    hourlyActual[hourIndex] += nightData.hourlyData[hour].totalQty;
                }
            }
        });
    }

    // Night 시간대 (00~08시) - HTP 테이블에 표시된 작업자만
    for (let hour = 0; hour <= 8; hour++) {
        nightWorkers.forEach(({ worker, isHlLms, lmsInfo }) => {
            let nightData = null;
            if (isHlLms) {
                // HL LMS: 전일 24~32시 사용
                nightData = previousDate && worker.dates[previousDate] ? worker.dates[previousDate] : null;
                if (nightData && nightData.hourlyData[24 + hour]) {
                    // 시프트 범위 체크
                    let validHours = null;
                    if (lmsInfo && lmsInfo.shiftStart && lmsInfo.shiftEnd) {
                        const startHour = parseInt(lmsInfo.shiftStart.split(':')[0]);
                        const endTimeParts = lmsInfo.shiftEnd.split(':');
                        const endHour = parseInt(endTimeParts[0]);
                        const endMinute = parseInt(endTimeParts[1]) || 0;
                        const actualEndHour = (endMinute === 0 && endHour > 0) ? endHour - 1 : endHour;
                        validHours = { start: startHour, end: actualEndHour };
                    }

                    const isInShiftRange = !validHours || (hour >= validHours.start && hour <= validHours.end);
                    if (isInShiftRange) {
                        const hourIndex = 15 + hour; // 00시 -> index 15
                        hourlyActual[hourIndex] += nightData.hourlyData[24 + hour].totalQty;
                    }
                }
            } else {
                // LMS: 최신 날짜 00~08시 사용
                nightData = latestDate && worker.dates[latestDate] ? worker.dates[latestDate] : null;
                if (nightData && nightData.hourlyData[hour]) {
                    // 시프트 범위 체크
                    let validHours = null;
                    if (lmsInfo && lmsInfo.shiftStart && lmsInfo.shiftEnd) {
                        const startHour = parseInt(lmsInfo.shiftStart.split(':')[0]);
                        const endTimeParts = lmsInfo.shiftEnd.split(':');
                        const endHour = parseInt(endTimeParts[0]);
                        const endMinute = parseInt(endTimeParts[1]) || 0;
                        const actualEndHour = (endMinute === 0 && endHour > 0) ? endHour - 1 : endHour;
                        validHours = { start: startHour, end: actualEndHour };
                    }

                    const isInShiftRange = !validHours || (
                        validHours.start < validHours.end ?
                        (hour >= validHours.start && hour <= validHours.end) :
                        (hour >= validHours.start || hour <= validHours.end)
                    );
                    if (isInShiftRange) {
                        const hourIndex = 15 + hour; // 00시 -> index 15
                        hourlyActual[hourIndex] += nightData.hourlyData[hour].totalQty;
                    }
                }
            }
        });
    }

    // 차트 데이터 준비
    const labels = ['09시', '10시', '11시', '12시', '13시', '14시', '15시', '16시', '17시', '18시', '19시', '20시', '21시', '22시', '23시', '00시', '01시', '02시', '03시', '04시', '05시', '06시', '07시', '08시'];

    const ctx = document.getElementById('daily-report-chart');

    // 기존 차트가 있으면 제거
    if (dailyReportChart) {
        dailyReportChart.destroy();
    }

    // 새 차트 생성
    dailyReportChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Actual',
                data: hourlyActual,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.1,
                pointRadius: 4,
                pointHoverRadius: 6,
                datalabels: {
                    align: 'top',
                    anchor: 'end',
                    color: 'rgb(59, 130, 246)',
                    font: {
                        weight: 'bold',
                        size: 10
                    },
                    formatter: (value) => Math.round(value)
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '작업수 (Actual)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '시간'
                    }
                }
            }
        },
    });
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
