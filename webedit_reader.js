// webedit.phtml에 자동 주입 - ir1 textarea 값을 읽어 storage에 저장
(function() {
  const prodId = new URL(location.href).searchParams.get('prod_id');
  if (!prodId) return;

  function readAndStore() {
    const ta = document.getElementById('ir1');
    if (!ta || !ta.value) return false;

    const html = ta.value;
    const imgUrls = [];
    const re = /<img[^>]+src\s*=\s*(?:['"]([^'"]*?)['"]|([^\s>]+))/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      let src = (m[1] || m[2] || '').trim();
      if (!src) continue;
      if (!src.startsWith('http')) src = 'https:' + src;
      if (!imgUrls.includes(src)) imgUrls.push(src);
    }

    chrome.storage.local.set({ ['detailImages_' + prodId]: imgUrls }, () => {
      // editor에 알림 (리스너 없으면 무시)
      chrome.runtime.sendMessage({ action: 'detailImagesReady', prodId, imgUrls }).catch(() => {});
    });
    return true;
  }

  // 즉시 시도 → 안되면 지수 백오프로 재시도 (최대 약 10초)
  if (!readAndStore()) {
    let tries = 0;
    let delay = 500;
    function retry() {
      tries++;
      if (readAndStore() || tries >= 20) return;
      delay = Math.min(delay * 1.5, 3000);
      setTimeout(retry, delay);
    }
    setTimeout(retry, delay);
  }
})();
