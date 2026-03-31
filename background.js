chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.action === 'openEditorWithData') {
    chrome.storage.local.set({ shoplingProducts: msg.products }, () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
    });
    return true;
  }

  if (msg.action === 'fetchDetailImages') {
    const prodId = msg.prodId;
    const url = 'https://a.shopling.co.kr/prod/prodInfo.phtml?mode=modify&opt_mode=modify&popup=Y&prod_id=' + prodId;
    fetch(url, { credentials: 'include' })
      .then(r => r.text())
      .then(html => {
        const m = html.match(/name=["']dtl_desc["'][^>]*>([\s\S]*?)<\/textarea>/i);
        let detailHtml = m ? m[1] : '';
        detailHtml = detailHtml
          .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
        const imgUrls = [];
        const re = /<img[^>]+src=["']([^"']+)["']/gi;
        let m2;
        while ((m2 = re.exec(detailHtml)) !== null) {
          let src = m2[1].trim();
          if (!src.startsWith('http')) src = 'https:' + src;
          if (!imgUrls.includes(src)) imgUrls.push(src);
        }
        sendResponse({ success: true, imgUrls });
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.action === 'downloadAndQueue') {
    const { prodId, imageDataUrl, folderName } = msg;
    const folder = folderName || 'shopling_images';
    const imgFilename = folder + '/prod_' + prodId + '.jpg';

    // 1단계: 이미지 다운로드
    chrome.downloads.download({
      url: imageDataUrl,
      filename: imgFilename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      chrome.downloads.onChanged.addListener(function listener(delta) {
        if (delta.id !== downloadId || !delta.state || delta.state.current !== 'complete') return;
        chrome.downloads.onChanged.removeListener(listener);

        chrome.downloads.search({ id: downloadId }, (results) => {
          const filePath = results[0]?.filename || imgFilename;

          // 2단계: storage에서 기존 queue 읽어서 추가
          chrome.storage.local.get(['uploadQueue'], (r) => {
            const queue = r.uploadQueue || [];
            // 같은 prodId가 있으면 교체
            const idx = queue.findIndex(q => q.prodId === prodId);
            if (idx >= 0) queue[idx] = { prodId, filePath };
            else queue.push({ prodId, filePath });

            chrome.storage.local.set({ uploadQueue: queue }, () => {
              // 3단계: upload_queue.json 파일로 저장
              const jsonData = JSON.stringify(queue, null, 2);
              const blob = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(jsonData)));
              chrome.downloads.download({
                url: blob,
                filename: folder + '/upload_queue.json',
                saveAs: false,
                conflictAction: 'overwrite'
              }, () => {
                sendResponse({ success: true, filePath, count: queue.length });
              });
            });
          });
        });
      });
    });

    return true;
  }

});
