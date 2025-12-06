// 백그라운드 스크립트
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getHeaders') {
        // 기본 headers 반환
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'User-Agent': navigator.userAgent
        };

        // Referer 설정 (현재 URL)
        if (request.url) {
            try {
                const url = new URL(request.url);
                headers['Origin'] = `${url.protocol}//${url.host}`;
                headers['Referer'] = request.url;
            } catch (e) {
                console.error('Invalid URL:', e);
            }
        }

        sendResponse(headers);
    }

    return true; // 비동기 응답을 위해 true 반환
});
