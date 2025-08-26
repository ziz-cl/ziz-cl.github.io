let currentBarcode = null;
let isAutoMode = localStorage.getItem('barcodeAutoMode') === 'true';
let barcodeValues = [];
let currentBarcodeIndex = 0;

const barcodeValue = document.getElementById('barcode-value');
const barcodeFormat = document.getElementById('barcode-format');
const barcodeCaption = document.getElementById('barcode-caption');
const autoBtn = document.getElementById('auto-btn');
const autoCleanBtn = document.getElementById('auto-clean-btn');
const barcodeIndexDisplay = document.getElementById('barcode-index');
const prevBarcodeBtn = document.getElementById('prev-barcode');
const nextBarcodeBtn = document.getElementById('next-barcode');
const barcodeIndicators = document.getElementById('barcode-indicators');

const barWidthSlider = document.getElementById('bar-width');
const heightSlider = document.getElementById('height');
const marginSlider = document.getElementById('margin');
const fontSizeSlider = document.getElementById('font-size');
const textMarginSlider = document.getElementById('text-margin');

const barWidthValue = document.getElementById('bar-width-value');
const heightValue = document.getElementById('height-value');
const marginValue = document.getElementById('margin-value');
const fontSizeValue = document.getElementById('font-size-value');
const textMarginValue = document.getElementById('text-margin-value');

const backgroundColorInput = document.getElementById('background-color');
const backgroundColorPicker = document.getElementById('background-color-picker');
const lineColorInput = document.getElementById('line-color');
const lineColorPicker = document.getElementById('line-color-picker');

const saveBtn = document.getElementById('save-btn');
const printBtn = document.getElementById('print-btn');
const copyBtn = document.getElementById('copy-btn');

const toast = document.getElementById('toast');
const barcodeDisplay = document.querySelector('.barcode-display');

// 메모 관련 요소들
const memoWaitingBtn = document.getElementById('memo-waiting');
const memoShortageBtn = document.getElementById('memo-shortage');
const memoPackingBtn = document.getElementById('memo-packing');
const memoCustomInput = document.getElementById('memo-custom');
const barcodeMemo = document.getElementById('barcode-memo');

// 각 바코드별 메모 상태 저장
let barcodeMemosState = {};

function parseBarcodeValues() {
    const inputText = barcodeValue.value.trim();
    if (!inputText) {
        return ['1234567890'];
    }
    
    const values = inputText.split('\n')
        .map(v => v.trim())
        .filter(v => v.length > 0);
    
    return values.length > 0 ? values : ['1234567890'];
}

function updateBarcodeNavigation() {
    barcodeValues = parseBarcodeValues();
    
    if (currentBarcodeIndex >= barcodeValues.length) {
        currentBarcodeIndex = barcodeValues.length - 1;
    }
    if (currentBarcodeIndex < 0) {
        currentBarcodeIndex = 0;
    }
    
    barcodeIndexDisplay.textContent = `${currentBarcodeIndex + 1}/${barcodeValues.length}`;
    
    prevBarcodeBtn.disabled = currentBarcodeIndex === 0;
    nextBarcodeBtn.disabled = currentBarcodeIndex === barcodeValues.length - 1;
    
    const showNavigation = barcodeValues.length > 1;
    document.querySelector('.barcode-navigation').style.display = showNavigation ? 'flex' : 'none';
    
    updateIndicators();
}

function updateIndicators() {
    barcodeIndicators.innerHTML = '';
    
    if (barcodeValues.length > 1) {
        barcodeValues.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = 'indicator-dot';
            if (index === currentBarcodeIndex) {
                dot.classList.add('active');
            }
            dot.addEventListener('click', () => {
                currentBarcodeIndex = index;
                generateBarcode();
            });
            barcodeIndicators.appendChild(dot);
        });
    }
}

// 메모 상태 업데이트 함수
function updateMemoDisplay() {
    const currentValue = barcodeValues[currentBarcodeIndex] || '1234567890';
    const memoState = barcodeMemosState[currentValue];
    
    // 바코드 값은 캡션 영역에 표시
    barcodeCaption.textContent = currentValue;
    
    // 메모는 별도 영역에 표시
    let memoText = '';
    if (memoState) {
        if (memoState.custom) {
            memoText = memoState.custom;
        } else if (memoState.packing) {
            memoText = '패킹';
        } else {
            const memos = [];
            if (memoState.waiting) memos.push('대기');
            if (memoState.shortage) memos.push('수량부족');
            memoText = memos.join(', ');
        }
    }
    
    barcodeMemo.textContent = memoText;
}

// 메모 상태 초기화 함수
function resetMemoState() {
    // UI 상태 초기화
    memoWaitingBtn.classList.remove('active');
    memoShortageBtn.classList.remove('active');
    memoPackingBtn.classList.remove('active');
    memoCustomInput.classList.remove('active');
    memoCustomInput.value = '';
    
    // 현재 바코드의 메모 상태 로드
    const currentValue = barcodeValues[currentBarcodeIndex] || '1234567890';
    const memoState = barcodeMemosState[currentValue];
    
    if (memoState) {
        if (memoState.custom) {
            memoCustomInput.value = memoState.custom;
            memoCustomInput.classList.add('active');
        } else {
            if (memoState.waiting) memoWaitingBtn.classList.add('active');
            if (memoState.shortage) memoShortageBtn.classList.add('active');
            if (memoState.packing) memoPackingBtn.classList.add('active');
        }
    }
    
    updateMemoDisplay();
}

function generateBarcode() {
    barcodeValues = parseBarcodeValues();
    updateBarcodeNavigation();
    
    const value = barcodeValues[currentBarcodeIndex] || '1234567890';
    const format = barcodeFormat.value;
    
    // 바코드 변경 시 메모 상태 초기화/복원
    resetMemoState();
    
    const options = {
        format: format,
        width: parseFloat(barWidthSlider.value),
        height: parseInt(heightSlider.value),
        margin: parseInt(marginSlider.value),
        fontSize: parseInt(fontSizeSlider.value),
        textMargin: parseInt(textMarginSlider.value),
        background: backgroundColorInput.value,
        lineColor: lineColorInput.value,
        displayValue: false,
        font: 'Roboto',
        fontOptions: 'bold',
        textAlign: 'center',
        textPosition: 'bottom',
        valid: function(valid) {
            if (!valid) {
                showToast(`유효하지 않은 바코드 값: ${value}`);
            }
        }
    };
    
    try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, value, options);
        
        const barcodeImg = document.getElementById('barcode');
        barcodeImg.src = canvas.toDataURL('image/png');
        
        barcodeCaption.textContent = value;
        barcodeCaption.removeAttribute('title');
        currentBarcode = value;
    } catch (error) {
        showToast('바코드 생성 중 오류가 발생했습니다.');
        console.error('Barcode generation error:', error);
    }
}

function navigateToPreviousBarcode() {
    if (currentBarcodeIndex > 0) {
        currentBarcodeIndex--;
        generateBarcode();
    }
}

function navigateToNextBarcode() {
    if (currentBarcodeIndex < barcodeValues.length - 1) {
        currentBarcodeIndex++;
        generateBarcode();
    }
}

prevBarcodeBtn.addEventListener('click', navigateToPreviousBarcode);
nextBarcodeBtn.addEventListener('click', navigateToNextBarcode);

document.addEventListener('keydown', (e) => {
    if (document.activeElement === barcodeValue) {
        return;
    }
    
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateToPreviousBarcode();
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateToNextBarcode();
    }
});

function updateSliderValue(slider, valueElement) {
    valueElement.textContent = slider.value;
}

barWidthSlider.addEventListener('input', () => {
    updateSliderValue(barWidthSlider, barWidthValue);
    generateBarcode();
});

heightSlider.addEventListener('input', () => {
    updateSliderValue(heightSlider, heightValue);
    generateBarcode();
});

marginSlider.addEventListener('input', () => {
    updateSliderValue(marginSlider, marginValue);
    generateBarcode();
});

fontSizeSlider.addEventListener('input', () => {
    updateSliderValue(fontSizeSlider, fontSizeValue);
    generateBarcode();
});

textMarginSlider.addEventListener('input', () => {
    updateSliderValue(textMarginSlider, textMarginValue);
    generateBarcode();
});

function syncColorInputs(textInput, colorPicker) {
    textInput.addEventListener('input', () => {
        const color = textInput.value;
        if (/^#[0-9A-F]{6}$/i.test(color)) {
            colorPicker.value = color;
            generateBarcode();
        }
    });
    
    colorPicker.addEventListener('input', () => {
        textInput.value = colorPicker.value.toUpperCase();
        generateBarcode();
    });
}

syncColorInputs(backgroundColorInput, backgroundColorPicker);
syncColorInputs(lineColorInput, lineColorPicker);

function adjustTextareaHeight() {
    barcodeValue.style.height = 'auto';
    const lines = barcodeValue.value.split('\n').length;
    const minLines = 10;
    const maxLines = 40;
    const actualLines = Math.max(minLines, Math.min(lines + 2, maxLines));
    barcodeValue.rows = actualLines;
}

barcodeValue.addEventListener('input', () => {
    currentBarcodeIndex = 0;
    adjustTextareaHeight();
    generateBarcode();
});

barcodeFormat.addEventListener('change', generateBarcode);

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function saveBarcodeAsImage() {
    const barcodeImg = document.getElementById('barcode');
    
    const a = document.createElement('a');
    a.href = barcodeImg.src;
    a.download = `barcode_${currentBarcode || 'image'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('바코드가 저장되었습니다.');
}

saveBtn.addEventListener('click', saveBarcodeAsImage);

printBtn.addEventListener('click', () => {
    window.print();
    // showToast('인쇄 대화상자가 열렸습니다.');
});

async function copyBarcodeToClipboard() {
    try {
        const barcodeImg = document.getElementById('barcode');
        
        const response = await fetch(barcodeImg.src);
        const blob = await response.blob();
        
        if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);
            showToast('바코드 이미지가 복사되었습니다.');
        } else {
            showToast('이미지 복사가 지원되지 않습니다.');
        }
    } catch (error) {
        console.error('Copy error:', error);
        showToast('이미지 복사에 실패했습니다.');
    }
}

// barcodeCaption.addEventListener('click', function() {
//     const selection = window.getSelection();
//     const range = document.createRange();
//     range.selectNodeContents(this);
//     selection.removeAllRanges();
//     selection.addRange(range);
//     showToast('텍스트가 선택되었습니다. Ctrl+C로 복사하세요.');
// });

autoBtn.addEventListener('click', function() {
    isAutoMode = !isAutoMode;
    this.classList.toggle('active', isAutoMode);
    localStorage.setItem('barcodeAutoMode', isAutoMode);
    // showToast(isAutoMode ? 'Auto 모드 활성화' : 'Auto 모드 비활성화');
});

autoCleanBtn.addEventListener('click', function() {
    const inputText = barcodeValue.value.trim();
    if (!inputText) {
        showToast('정규화할 데이터가 없습니다.');
        return;
    }
    
    // GC-로 시작하고 -1 또는 -2로 끝나는 패턴 찾기
    const regex = /GC-[\w\-]+(?:-[12])/g;
    const matches = inputText.match(regex);
    
    if (matches && matches.length > 0) {
        // 중복 제거
        const uniqueMatches = [...new Set(matches)];
        barcodeValue.value = uniqueMatches.join('\n');
        adjustTextareaHeight();
        currentBarcodeIndex = 0;
        generateBarcode();
        showToast(`${uniqueMatches.length}개의 바코드가 추출되었습니다.`);
    } else {
        showToast('GC-로 시작하고 -1 또는 -2로 끝나는 데이터를 찾을 수 없습니다.');
    }
});

barcodeValue.addEventListener('click', function() {
    if (isAutoMode) {
        this.value = '';
        this.focus();
        showToast('붙여넣기 준비 완료 (Ctrl+V)');
    }
});

copyBtn.addEventListener('click', copyBarcodeToClipboard);

barcodeDisplay.addEventListener('click', function() {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(this);
    selection.removeAllRanges();
    selection.addRange(range);
});

// 메모 버튼 이벤트 리스너
function saveMemoState() {
    const currentValue = barcodeValues[currentBarcodeIndex] || '1234567890';
    
    if (memoCustomInput.classList.contains('active') && memoCustomInput.value.trim()) {
        // 커스텀 입력이 활성화되어 있고 값이 있을 때
        barcodeMemosState[currentValue] = {
            custom: memoCustomInput.value.trim(),
            waiting: false,
            shortage: false,
            packing: false
        };
    } else {
        // 기본 버튼들 상태 저장
        barcodeMemosState[currentValue] = {
            custom: '',
            waiting: memoWaitingBtn.classList.contains('active'),
            shortage: memoShortageBtn.classList.contains('active'),
            packing: memoPackingBtn.classList.contains('active')
        };
    }
    
    updateMemoDisplay();
}

// 대기 버튼
memoWaitingBtn.addEventListener('click', function() {
    if (memoCustomInput.classList.contains('active')) {
        // 커스텀이 활성화되어 있으면 모든 상태 초기화
        memoCustomInput.classList.remove('active');
        memoCustomInput.value = '';
        memoPackingBtn.classList.remove('active');
    } else if (memoPackingBtn.classList.contains('active')) {
        // 패킹이 활성화되어 있으면 패킹 해제
        memoPackingBtn.classList.remove('active');
    }
    
    this.classList.toggle('active');
    saveMemoState();
});

// 부족 버튼
memoShortageBtn.addEventListener('click', function() {
    if (memoCustomInput.classList.contains('active')) {
        // 커스텀이 활성화되어 있으면 모든 상태 초기화
        memoCustomInput.classList.remove('active');
        memoCustomInput.value = '';
        memoPackingBtn.classList.remove('active');
    } else if (memoPackingBtn.classList.contains('active')) {
        // 패킹이 활성화되어 있으면 패킹 해제
        memoPackingBtn.classList.remove('active');
    }
    
    this.classList.toggle('active');
    saveMemoState();
});

// 패킹 버튼 (단독 선택)
memoPackingBtn.addEventListener('click', function() {
    // 다른 모든 상태 해제
    memoWaitingBtn.classList.remove('active');
    memoShortageBtn.classList.remove('active');
    memoCustomInput.classList.remove('active');
    memoCustomInput.value = '';
    
    this.classList.toggle('active');
    saveMemoState();
});

// 커스텀 입력 (단독 사용)
memoCustomInput.addEventListener('input', function() {
    if (this.value.trim()) {
        // 입력이 있으면 다른 모든 버튼 해제
        memoWaitingBtn.classList.remove('active');
        memoShortageBtn.classList.remove('active');
        memoPackingBtn.classList.remove('active');
        this.classList.add('active');
    } else {
        this.classList.remove('active');
    }
    
    saveMemoState();
});

memoCustomInput.addEventListener('focus', function() {
    if (this.value.trim()) {
        this.classList.add('active');
    }
});

// 고급 설정 토글 기능
const advancedToggleBtn = document.getElementById('advanced-toggle');
const advancedSettings = document.getElementById('advanced-settings');

advancedToggleBtn.addEventListener('click', function() {
    const isShowing = advancedSettings.classList.contains('show');
    
    if (isShowing) {
        advancedSettings.classList.remove('show');
        this.classList.remove('active');
    } else {
        advancedSettings.classList.add('show');
        this.classList.add('active');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    autoBtn.classList.toggle('active', isAutoMode);
    adjustTextareaHeight();
    generateBarcode();
});