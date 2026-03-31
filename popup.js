document.addEventListener('DOMContentLoaded', () => {
  // 저장된 API 설정 불러오기
  chrome.storage.local.get(['shoplingApi'], (r) => {
    if (r.shoplingApi) {
      document.getElementById('loginId').value = r.shoplingApi.loginId || '';
      document.getElementById('companyId').value = r.shoplingApi.companyId || '';
      document.getElementById('apiKey').value = r.shoplingApi.apiKey || '';
      document.getElementById('folderName').value = r.shoplingApi.folderName || 'shopling_images';
    }
  });

  // API 설정 저장
  document.getElementById('saveApiBtn').addEventListener('click', () => {
    const config = {
      loginId: document.getElementById('loginId').value.trim(),
      companyId: document.getElementById('companyId').value.trim(),
      apiKey: document.getElementById('apiKey').value.trim(),
      folderName: document.getElementById('folderName').value.trim() || 'shopling_images'
    };
    chrome.storage.local.set({ shoplingApi: config }, () => {
      const msg = document.getElementById('savedMsg');
      msg.style.display = 'block';
      setTimeout(() => msg.style.display = 'none', 2000);
    });
  });

  document.getElementById('runOnPage').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      const tab = tabs[0];
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
        alert('이 페이지에서는 실행할 수 없습니다.\n샵플링 A4 페이지에서 실행해주세요.');
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          alert('스크립트 실행 실패: ' + chrome.runtime.lastError.message);
          return;
        }
        window.close();
      });
    });
  });

  document.getElementById('openEditor').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
    window.close();
  });

  document.getElementById('openShopling').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.shopling.co.kr' });
    window.close();
  });
});
