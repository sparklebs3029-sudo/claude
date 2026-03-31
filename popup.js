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
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, allFrames: true },
        files: ['content.js']
      }, () => { window.close(); });
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
