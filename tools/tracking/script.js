// IndexedDB 설정 (Dexie.js 사용)
const db = new Dexie('WorkTrackingDB');
db.version(1).stores({
    sheets: '++id, sheetName, data',
    metadata: 'key, value'
});

// 전역 변수
let currentWorkbook = null;
let currentSheetName = null;

// DOM 요소
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const tabsSection = document.getElementById('tabs-section');
const sheetTabs = document.getElementById('sheet-tabs');
const statsSection = document.getElementById('stats-section');
const filterSection = document.getElementById('filter-section');
const dataSection = document.getElementById('data-section');
const dataGrid = document.getElementById('data-grid');
const searchInput = document.getElementById('search-input');
const clearDataBtn = document.getElementById('clear-data-btn');
const detailModal = document.getElementById('detail-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
const toast = document.getElementById('toast');

// 토스트 메시지 표시
function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('translate-x-96');
    setTimeout(() => {
        toast.classList.add('translate-x-96');
    }, 3000);
}

// 파일 업로드 영역 클릭 이벤트
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// 드래그 앤 드롭 이벤트
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('scale-105', 'bg-indigo-100');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('scale-105', 'bg-indigo-100');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('scale-105', 'bg-indigo-100');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
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

            currentWorkbook = workbook;

            // 모든 시트 데이터 저장
            await parseAndSaveAllSheets(workbook);

            showToast('파일이 성공적으로 업로드되었습니다!');

            // 탭 생성
            createSheetTabs(workbook.SheetNames);

            // 첫 번째 시트 표시
            if (workbook.SheetNames.length > 0) {
                await displaySheet(workbook.SheetNames[0]);
            }

        } catch (error) {
            console.error('파일 처리 오류:', error);
            showToast('파일 처리 중 오류가 발생했습니다.');
        }
    };
    reader.readAsArrayBuffer(file);
}

// 모든 시트 데이터 파싱 및 저장
async function parseAndSaveAllSheets(workbook) {
    // 기존 데이터 삭제
    await db.sheets.clear();

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // 시트 데이터 저장
        await db.sheets.add({
            sheetName: sheetName,
            data: jsonData
        });
    }

    // 메타데이터 저장
    await db.metadata.put({ key: 'lastUpdate', value: new Date().toLocaleString() });
}

// 시트 탭 생성
function createSheetTabs(sheetNames) {
    sheetTabs.innerHTML = '';
    tabsSection.classList.remove('hidden');

    sheetNames.forEach(sheetName => {
        const tab = document.createElement('button');
        tab.className = 'px-6 py-3 rounded-lg font-medium transition-all';
        tab.textContent = sheetName;
        tab.dataset.sheetName = sheetName;

        tab.addEventListener('click', () => {
            displaySheet(sheetName);
        });

        sheetTabs.appendChild(tab);
    });

    // 첫 번째 탭 활성화
    if (sheetTabs.firstChild) {
        updateActiveTab(sheetNames[0]);
    }
}

// 활성 탭 업데이트
function updateActiveTab(sheetName) {
    const tabs = sheetTabs.querySelectorAll('button');
    tabs.forEach(tab => {
        if (tab.dataset.sheetName === sheetName) {
            tab.className = 'px-6 py-3 rounded-lg font-medium transition-all bg-indigo-600 text-white shadow-lg';
        } else {
            tab.className = 'px-6 py-3 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200';
        }
    });
}

// 시트 데이터 표시
async function displaySheet(sheetName, filter = '') {
    currentSheetName = sheetName;
    updateActiveTab(sheetName);

    const sheetData = await db.sheets.where('sheetName').equals(sheetName).first();
    if (!sheetData || !sheetData.data || sheetData.data.length === 0) {
        return;
    }

    const jsonData = sheetData.data;
    const headers = jsonData[0];

    // 4W1H 데이터 구조 처리
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

    // 섹션 표시
    statsSection.classList.remove('hidden');
    filterSection.classList.remove('hidden');
    dataSection.classList.remove('hidden');

    // Employee 컬럼 기준으로 집계 (4W1H 데이터 구조)
    const employeeColumn = 'Employee';
    const userStats = {};

    tasks.forEach(task => {
        const userName = task[employeeColumn] || '이름 없음';
        if (!userStats[userName]) {
            userStats[userName] = {
                name: userName,
                count: 0,
                tasks: []
            };
        }
        userStats[userName].count++;
        userStats[userName].tasks.push(task);
    });

    // 필터 적용
    let filteredUsers = Object.values(userStats);
    if (filter) {
        filteredUsers = filteredUsers.filter(user =>
            user.name.toLowerCase().includes(filter.toLowerCase())
        );
    }

    // 통계 업데이트
    document.getElementById('total-users').textContent = Object.keys(userStats).length;
    document.getElementById('total-tasks').textContent = tasks.length;

    const metadata = await db.metadata.get('lastUpdate');
    document.getElementById('last-update').textContent = metadata ? metadata.value : '-';

    // 사용자 카드 생성
    dataGrid.innerHTML = '';
    filteredUsers.forEach(user => {
        const card = document.createElement('div');
        card.className = 'bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white cursor-pointer transition-all hover:-translate-y-2 hover:shadow-2xl';
        card.innerHTML = `
            <div class="text-2xl font-bold mb-4">${user.name}</div>
            <div class="flex justify-between gap-4">
                <div class="flex-1 bg-white bg-opacity-20 rounded-xl p-4 text-center">
                    <div class="text-xs opacity-90 mb-1">작업 수</div>
                    <div class="text-2xl font-bold">${user.count}</div>
                </div>
            </div>
        `;
        card.addEventListener('click', () => showUserDetail(user));
        dataGrid.appendChild(card);
    });
}

// 사용자 상세 정보 표시
function showUserDetail(user) {
    modalTitle.textContent = `${user.name} - 상세 정보`;

    if (user.tasks.length === 0) {
        modalBody.innerHTML = '<p class="text-gray-500">작업 내역이 없습니다.</p>';
        detailModal.classList.remove('hidden');
        detailModal.classList.add('flex');
        return;
    }

    // 테이블 헤더 생성 (첫 번째 작업의 키를 기준으로)
    const headers = Object.keys(user.tasks[0]);

    let tableHTML = `
        <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm">
                <thead>
                    <tr class="bg-indigo-50">
    `;

    headers.forEach(header => {
        tableHTML += `<th class="px-3 py-2 text-left text-indigo-600 font-semibold border-b border-gray-200 whitespace-nowrap">${header}</th>`;
    });

    tableHTML += `
                    </tr>
                </thead>
                <tbody>
    `;

    user.tasks.forEach(task => {
        tableHTML += '<tr class="hover:bg-indigo-50 transition-colors">';
        headers.forEach(header => {
            const value = task[header] || '-';
            tableHTML += `<td class="px-3 py-2 border-b border-gray-100 whitespace-nowrap">${value}</td>`;
        });
        tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table></div>';
    modalBody.innerHTML = tableHTML;

    detailModal.classList.remove('hidden');
    detailModal.classList.add('flex');
}

// 모달 닫기
modalClose.addEventListener('click', () => {
    detailModal.classList.add('hidden');
    detailModal.classList.remove('flex');
});

detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) {
        detailModal.classList.add('hidden');
        detailModal.classList.remove('flex');
    }
});

// 검색 기능
searchInput.addEventListener('input', (e) => {
    if (currentSheetName) {
        displaySheet(currentSheetName, e.target.value);
    }
});

// 데이터 초기화
clearDataBtn.addEventListener('click', async () => {
    if (confirm('모든 데이터를 삭제하시겠습니까?')) {
        await db.sheets.clear();
        await db.metadata.clear();

        tabsSection.classList.add('hidden');
        statsSection.classList.add('hidden');
        filterSection.classList.add('hidden');
        dataSection.classList.add('hidden');

        currentWorkbook = null;
        currentSheetName = null;

        showToast('모든 데이터가 삭제되었습니다.');
    }
});

// 페이지 로드 시 저장된 데이터 표시
window.addEventListener('load', async () => {
    const sheets = await db.sheets.toArray();
    if (sheets.length > 0) {
        const sheetNames = sheets.map(s => s.sheetName);
        createSheetTabs(sheetNames);
        await displaySheet(sheetNames[0]);
    }
});
