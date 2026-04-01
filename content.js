(function() {
  if (!document.body) return;
  if (document.body.tagName === 'FRAMESET') return;
  if (!window.location.href.includes('prodLst.phtml')) return;

  if (document.getElementById('img-editor-btn')) {
    const p = document.getElementById('img-editor-panel');
    if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
    return;
  }

  const btn = document.createElement('div');
  btn.id = 'img-editor-btn';
  btn.textContent = '🖼 이미지수정';
  Object.assign(btn.style, {
    position: 'fixed', bottom: '30px', right: '30px',
    background: '#2563eb', color: 'white', padding: '12px 20px',
    borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
    fontWeight: 'bold', fontFamily: 'Malgun Gothic,sans-serif',
    boxShadow: '0 4px 16px rgba(37,99,235,0.5)',
    zIndex: '2147483647', userSelect: 'none'
  });
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'img-editor-panel';
  Object.assign(panel.style, {
    position: 'fixed', bottom: '90px', right: '30px',
    background: '#1e1e2e', border: '1px solid #3b3b52',
    borderRadius: '10px', padding: '16px', width: '340px',
    maxHeight: '520px', overflowY: 'auto', zIndex: '2147483646',
    display: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    fontFamily: 'Malgun Gothic,sans-serif', color: '#e0e0e0'
  });
  panel.innerHTML = `
    <div style="font-size:13px;font-weight:bold;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <span>📦 상품 선택</span>
      <span id="imgep-close" style="cursor:pointer;color:#888;font-size:20px;line-height:1">×</span>
    </div>
    <button id="imgep-scan" style="width:100%;padding:9px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin-bottom:12px;font-family:inherit;font-weight:bold">🔍 상품 목록 스캔</button>
    <div id="imgep-list"></div>
    <div id="imgep-count" style="color:#888;font-size:11px;margin-top:10px;text-align:center"></div>
    <button id="imgep-edit" style="width:100%;padding:10px;background:#16a34a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin-top:10px;display:none;font-family:inherit;font-weight:bold">✏ 선택한 상품 편집하기</button>
  `;
  document.body.appendChild(panel);

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  let selectedProducts = [], panelOpen = false;

  btn.addEventListener('click', () => {
    panelOpen = !panelOpen;
    panel.style.display = panelOpen ? 'block' : 'none';
    if (panelOpen) scan();
  });
  panel.querySelector('#imgep-close').addEventListener('click', () => {
    panelOpen = false; panel.style.display = 'none';
  });
  panel.querySelector('#imgep-scan').addEventListener('click', scan);
  panel.querySelector('#imgep-edit').addEventListener('click', openEditor);

  function scan() {
    const list = panel.querySelector('#imgep-list');
    list.innerHTML = '<div style="color:#888;font-size:12px;text-align:center;padding:10px">스캔 중...</div>';
    selectedProducts = [];
    updateCount();

    setTimeout(() => {
      const results = [];
      const seen = new Set();

      document.querySelectorAll('table tr').forEach((row) => {
        const img = row.querySelector('img[src*="img.shopling.co.kr/prodImg/"]');
        if (!img) return;
        const src = img.src;
        if (seen.has(src)) return;
        seen.add(src);

        let name = '상품 ' + (results.length + 1);
        const a = row.querySelector('a');
        if (a && a.textContent.trim().length > 2) name = a.textContent.trim().slice(0, 50);

        let prodId = '';
        const tds = row.querySelectorAll('td');
        tds.forEach(td => {
          const lines = td.innerText.split('\n').map(l => l.trim());
          lines.forEach(line => {
            if (/^\d{5,6}$/.test(line) && !prodId) prodId = line;
          });
        });

        const detailEditUrl = prodId
          ? 'https://a.shopling.co.kr/prod/webedit.phtml?p_mode=&prod_id=' + prodId + '&srcing_url='
          : '';

        results.push({ imgUrl: src, name, prodId, detailEditUrl });
      });

      if (results.length === 0) {
        list.innerHTML = '<div style="color:#f87171;font-size:12px;text-align:center;padding:10px;line-height:1.6">이미지를 찾을 수 없습니다.<br>검색 후 다시 시도해주세요.</div>';
        return;
      }

      list.innerHTML = '';
      results.slice(0, 50).forEach((p) => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;gap:10px;background:#2a2a3e;border:1.5px solid #3b3b52;border-radius:6px;padding:8px;cursor:pointer;margin-bottom:4px';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.style.cssText = 'width:16px;height:16px;flex-shrink:0;cursor:pointer';

        const imgEl = document.createElement('img');
        imgEl.src = p.imgUrl;
        imgEl.style.cssText = 'width:44px;height:44px;object-fit:cover;border-radius:4px;flex-shrink:0;background:#333';

        const info = document.createElement('div');
        info.style.cssText = 'flex:1;overflow:hidden;min-width:0';
        const safeName = escapeHtml(p.name);
        const safeProdId = escapeHtml(p.prodId || '');
        const badge = p.prodId
          ? '<span style="color:#22c55e;font-size:10px">✓ prod_id: ' + safeProdId + '</span>'
          : '<span style="color:#f87171;font-size:10px">✗ prod_id 없음</span>';
        info.innerHTML = `
          <div style="color:#e0e0e0;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safeName}</div>
          <div style="margin-top:2px">${badge}</div>
        `;

        item.appendChild(chk);
        item.appendChild(imgEl);
        item.appendChild(info);

        chk.addEventListener('change', () => {
          if (chk.checked) { selectedProducts.push(p); item.style.borderColor = '#2563eb'; }
          else { selectedProducts = selectedProducts.filter(s => s !== p); item.style.borderColor = '#3b3b52'; }
          updateCount();
        });
        item.addEventListener('click', (e) => { if (e.target !== chk) chk.click(); });
        list.appendChild(item);
      });

    }, 300);
  }

  function updateCount() {
    panel.querySelector('#imgep-count').textContent = selectedProducts.length > 0 ? selectedProducts.length + '개 선택됨' : '';
    panel.querySelector('#imgep-edit').style.display = selectedProducts.length > 0 ? 'block' : 'none';
  }

  function openEditor() {
    if (!selectedProducts.length) return;
    chrome.storage.local.set({ shoplingProducts: selectedProducts }, () => {
      window.open('chrome-extension://' + chrome.runtime.id + '/editor.html', '_blank');
    });
    panelOpen = false;
    panel.style.display = 'none';
  }

})();
