// webedit.phtml에 자동 주입 - ir1 textarea 값을 읽어 storage에 저장
(function() {
  const prodId = new URL(location.href).searchParams.get('prod_id');
  if (!prodId) return;

  function readAndStore() {
    const ta = document.getElementById('ir1');
    if (!ta || !ta.value) return false;

    const html = ta.value;
    const imgUrls = [];
    const re = /<img[^>]+src=['"]([^'"]+)['"]/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      let src = m[1].trim();
      if (!src.startsWith('http')) src = 'https:' + src;
      if (!imgUrls.includes(src)) imgUrls.push(src);
    }

    chrome.storage.local.set({ ['detailImages_' + prodId]: imgUrls }, () => {
      // editor에 알림
      chrome.runtime.sendMessage({ action: 'detailImagesReady', prodId, imgUrls });
    });
    return true;
  }

  // 즉시 시도 → 안되면 500ms 간격으로 재시도 (최대 10초)
  if (!readAndStore()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (readAndStore() || tries > 20) clearInterval(timer);
    }, 500);
  }
})();
