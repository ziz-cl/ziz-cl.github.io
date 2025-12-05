// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message); // 디버깅용

  if (message.action === 'executeRequest') {
    console.log('[Background] Executing request...'); // 디버깅용
    executeRequest(message.request, message.tabId)
      .then(response => {
        console.log('[Background] Request completed:', response); // 디버깅용
        sendResponse(response);
      })
      .catch(error => {
        console.error('[Background] Request failed:', error); // 디버깅용
        sendResponse({
          error: error.message,
          details: error.stack
        });
      });
    return true; // 비동기 응답을 위해 true 반환
  }
});

// HTTP 요청 실행
async function executeRequest(request, tabId) {
  console.log('[Background] executeRequest called with:', { request, tabId }); // 디버깅용

  try {
    let url = request.url;
    const options = {
      method: request.method,
      headers: {}
    };

    // 헤더 설정
    if (request.useCurrentHeaders) {
      // 기본 헤더 설정
      options.headers['Content-Type'] = 'application/json';
      options.headers['Accept'] = 'application/json';
      console.log('[Background] Added default headers'); // 디버깅용
    }

    // 쿠키 가져오기
    if (request.useCurrentCookies) {
      const cookies = await chrome.cookies.getAll({ url: request.url });
      console.log('[Background] Cookies found:', cookies.length); // 디버깅용
      if (cookies.length > 0) {
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        options.headers['Cookie'] = cookieString;
      }
    }

    // GET 요청의 경우 파라미터를 쿼리 스트링으로 추가
    if (request.method === 'GET' && request.params && Object.keys(request.params).length > 0) {
      const queryString = new URLSearchParams(request.params).toString();
      url += (url.includes('?') ? '&' : '?') + queryString;
      console.log('[Background] Added query string to GET request'); // 디버깅용
    }

    // POST, PUT, PATCH 요청의 경우 body 추가
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      if (request.body && Object.keys(request.body).length > 0) {
        options.body = JSON.stringify(request.body);
        console.log('[Background] Added body from request.body'); // 디버깅용
      } else if (request.params && Object.keys(request.params).length > 0) {
        // body가 없으면 params를 body로 사용
        options.body = JSON.stringify(request.params);
        console.log('[Background] Added body from request.params'); // 디버깅용
      }
    }

    console.log('[Background] Final URL:', url); // 디버깅용
    console.log('[Background] Final options:', options); // 디버깅용
    console.log('[Background] Sending fetch request...'); // 디버깅용

    // 요청 실행
    const response = await fetch(url, options);
    console.log('[Background] Fetch response received:', response.status, response.statusText); // 디버깅용

    // 응답 처리
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      console.log('[Background] Parsed JSON response'); // 디버깅용
    } else {
      data = await response.text();
      console.log('[Background] Parsed text response'); // 디버깅용
    }

    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: data
    };

    console.log('[Background] Returning result:', result); // 디버깅용
    return result;

  } catch (error) {
    console.error('[Background] Error in executeRequest:', error); // 디버깅용
    throw new Error(`요청 실행 실패: ${error.message}`);
  }
}

// 현재 탭의 헤더 가져오기 (webRequest API 사용)
// 참고: 이 기능은 선택적이며, 더 복잡한 헤더 추출이 필요한 경우 사용
async function getCurrentTabHeaders(tabId) {
  return new Promise((resolve) => {
    const headers = {};

    chrome.webRequest.onSendHeaders.addListener(
      (details) => {
        if (details.tabId === tabId) {
          details.requestHeaders.forEach(header => {
            headers[header.name] = header.value;
          });
          resolve(headers);
        }
      },
      { urls: ['<all_urls>'] },
      ['requestHeaders']
    );

    // 타임아웃 설정
    setTimeout(() => resolve({}), 1000);
  });
}
