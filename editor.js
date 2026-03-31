// ── 유틸 ────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── 전역 상태 ──────────────────────────────────
let products = [], currentProduct = null, selectedImageUrl = null;
let editHistory = [], isCropping = false, cropStart = null, cropEnd = null, isDrawing = false;

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const cropCvs = document.getElementById('cropCanvas');
const cropCtx = cropCvs.getContext('2d', { willReadFrequently: true });

// ── 탭 전환 ────────────────────────────────────
function goPage(n) {
  const pages = ['products','detail','edit','save'];
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + pages[n-1]).classList.add('active');
  document.getElementById('tab' + n).classList.add('active');
}
document.getElementById('tab1').addEventListener('click', () => goPage(1));
document.getElementById('tab2').addEventListener('click', () => { if(currentProduct) goPage(2); });
document.getElementById('tab3').addEventListener('click', () => { if(selectedImageUrl) goPage(3); });
document.getElementById('tab4').addEventListener('click', () => goPage(4));

// ── 1단계: 상품 목록 ───────────────────────────
chrome.storage.local.get(['shoplingProducts'], (r) => {
  products = r.shoplingProducts || [];
  if (products.length > 0) currentProduct = products[0];
  renderProducts();
});

function renderProducts() {
  const grid = document.getElementById('productGrid');
  document.getElementById('noProducts').style.display = products.length ? 'none' : 'flex';
  document.getElementById('listCount').textContent = products.length ? products.length + '개 상품' : '상품 없음';
  grid.querySelectorAll('.product-card').forEach(el => el.remove());

  products.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'product-card' + (i === 0 ? ' active' : '');
    card.innerHTML = `<img src="${escapeHtml(p.imgUrl)}" onerror="this.style.background='#333'">
      <div class="info">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="pid">${escapeHtml(p.prodId || '')}  ${p.prodId ? '✓' : '✗ prod_id 없음'}</div>
      </div>`;
    card.addEventListener('click', () => {
      currentProduct = p;
      document.querySelectorAll('.product-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
    grid.appendChild(card);
  });
}

document.getElementById('goDetailBtn').addEventListener('click', () => {
  if (!currentProduct && products.length > 0) currentProduct = products[0];
  if (!currentProduct) return;
  loadDetailImages(currentProduct);
  goPage(2);
});

// ── 2단계: 상세설명 이미지 ─────────────────────
function loadDetailImages(product) {
  document.getElementById('detailProductInfo').innerHTML =
    '<b>' + escapeHtml(product.name) + '</b><br>prod_id: ' + escapeHtml(product.prodId || '없음');

  const area = document.getElementById('detailImageArea');
  area.innerHTML = '<div style="color:#888;font-size:13px;text-align:center;padding:30px">상세설명 이미지 불러오는 중...</div>';

  if (!product.prodId) {
    area.innerHTML = '<div style="color:#f87171;font-size:13px;padding:20px">prod_id가 없어서 불러올 수 없습니다.</div>';
    return;
  }

  chrome.runtime.sendMessage({ action: 'fetchDetailImages', prodId: product.prodId }, (res) => {
    if (!res || !res.success || !res.imgUrls.length) {
      area.innerHTML = '<div style="color:#f87171;font-size:13px;padding:20px">상세설명 이미지를 찾을 수 없습니다.</div>';
      return;
    }

    area.innerHTML = '<div style="font-size:12px;color:#888;margin-bottom:12px">이미지를 클릭하면 편집 화면으로 이동합니다</div>';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px';

    res.imgUrls.forEach(url => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'border:2px solid #3b3b52;border-radius:8px;overflow:hidden;cursor:pointer;background:#222;transition:border-color 0.15s';
      wrap.addEventListener('mouseenter', () => wrap.style.borderColor = '#2563eb');
      wrap.addEventListener('mouseleave', () => wrap.style.borderColor = selectedImageUrl === url ? '#22c55e' : '#3b3b52');

      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'width:100%;display:block;object-fit:cover';
      img.onerror = () => { wrap.style.display = 'none'; };

      const label = document.createElement('div');
      label.style.cssText = 'font-size:10px;color:#888;padding:4px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      label.textContent = url.split('/').pop();

      wrap.appendChild(img);
      wrap.appendChild(label);
      wrap.addEventListener('click', () => {
        selectedImageUrl = url;
        document.querySelectorAll('#detailImageArea > div > div').forEach(w => w.style.borderColor = '#3b3b52');
        wrap.style.borderColor = '#22c55e';
        loadImageToCanvas(url, true); // true = 로드 후 자르기 자동 진입
        goPage(3);
      });
      grid.appendChild(wrap);
    });

    area.appendChild(grid);
  });
}

// ── 3단계: 편집 ────────────────────────────────
// 사이즈 프리셋 버튼
document.querySelectorAll('[data-w][data-h]').forEach(btn => {
  btn.addEventListener('click', () => applyPreset(+btn.dataset.w, +btn.dataset.h));
});

// 되돌리기
document.getElementById('undoBtn').addEventListener('click', undoEdit);

function loadImageToCanvas(url, autoCrop = false) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { initCanvas(img); if (autoCrop) setTimeout(startCrop, 300); };
  img.onerror = () => {
    // CORS fallback: background service worker를 통해 이미지를 dataURL로 변환
    chrome.runtime.sendMessage({ action: 'fetchImageAsDataUrl', url }, (res) => {
      if (res?.success) {
        const img2 = new Image();
        img2.onload = () => { initCanvas(img2); if (autoCrop) setTimeout(startCrop, 300); };
        img2.src = res.dataUrl;
      } else {
        document.getElementById('statusBar').textContent = '이미지를 불러올 수 없습니다: ' + (res?.error || 'CORS 차단');
      }
    });
  };
  img.src = url;
}

function initCanvas(img) {
  editHistory = [];
  canvas.width = img.width; canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  pushHistory(); adjustScale();
  document.getElementById('statusBar').textContent = img.width + ' × ' + img.height + ' px';
  document.getElementById('sizeInfo').textContent = img.width + '×' + img.height;
}

function adjustScale() {
  const area = document.querySelector('.canvas-area');
  // 가로는 화면에 꽉 차게, 세로는 비율 유지 (스크롤 가능)
  const availW = area.clientWidth - 40;
  const scale = Math.min(1, availW / canvas.width);
  const w = Math.round(canvas.width * scale);
  const h = Math.round(canvas.height * scale);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  cropCvs.width = canvas.width; cropCvs.height = canvas.height;
  cropCvs.style.width = w + 'px'; cropCvs.style.height = h + 'px';
  document.getElementById('sizeInfo').textContent = canvas.width + '×' + canvas.height;
  // 세로 긴 이미지는 스크롤 허용
  area.style.overflowY = 'auto';
  area.style.alignItems = 'flex-start';
}

function pushHistory() {
  editHistory.push({ data: ctx.getImageData(0,0,canvas.width,canvas.height), w: canvas.width, h: canvas.height });
  if (editHistory.length > 20) editHistory.shift();
}

function undoEdit() {
  if (editHistory.length < 2) return;
  editHistory.pop();
  const b = editHistory[editHistory.length-1];
  canvas.width = b.w; canvas.height = b.h; ctx.putImageData(b.data, 0, 0); adjustScale();
}

['brightness','contrast','saturation'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    document.getElementById(id+'Val').textContent = document.getElementById(id).value;
    previewFilters();
  });
});

function previewFilters() {
  if (!editHistory.length) return;
  const b = editHistory[editHistory.length-1];
  canvas.width = b.w; canvas.height = b.h; ctx.putImageData(b.data, 0, 0);
  const bv = +document.getElementById('brightness').value*2.55;
  const cv = +document.getElementById('contrast').value/100+1;
  const sv = +document.getElementById('saturation').value/100+1;
  const id = ctx.getImageData(0,0,canvas.width,canvas.height), d = id.data;
  for (let i=0;i<d.length;i+=4) {
    let r=Math.min(255,Math.max(0,d[i]+bv)),g=Math.min(255,Math.max(0,d[i+1]+bv)),bl=Math.min(255,Math.max(0,d[i+2]+bv));
    r=Math.min(255,Math.max(0,(r-128)*cv+128));g=Math.min(255,Math.max(0,(g-128)*cv+128));bl=Math.min(255,Math.max(0,(bl-128)*cv+128));
    const gray=0.299*r+0.587*g+0.114*bl;
    d[i]=Math.min(255,Math.max(0,gray+sv*(r-gray)));d[i+1]=Math.min(255,Math.max(0,gray+sv*(g-gray)));d[i+2]=Math.min(255,Math.max(0,gray+sv*(bl-gray)));
  }
  ctx.putImageData(id,0,0);
}

function commitFilters() { previewFilters(); pushHistory(); resetFilters(); }
function resetFilters() {
  ['brightness','contrast','saturation'].forEach(k => { document.getElementById(k).value=0; document.getElementById(k+'Val').textContent=0; });
}

function applyPreset(w,h) {
  if (!canvas.width) return; commitFilters();
  const tmp=document.createElement('canvas'); tmp.width=w; tmp.height=h;
  const tc=tmp.getContext('2d'); tc.fillStyle='#fff'; tc.fillRect(0,0,w,h);
  const scale=Math.min(w/canvas.width,h/canvas.height);
  tc.drawImage(canvas,Math.round((w-canvas.width*scale)/2),Math.round((h-canvas.height*scale)/2),Math.round(canvas.width*scale),Math.round(canvas.height*scale));
  canvas.width=w;canvas.height=h;ctx.drawImage(tmp,0,0);pushHistory();adjustScale();
  document.getElementById('sizeInfo').textContent=w+'×'+h;
}

function rotate(deg) {
  commitFilters();
  const tmp=document.createElement('canvas');
  if(Math.abs(deg)===90){tmp.width=canvas.height;tmp.height=canvas.width;}else{tmp.width=canvas.width;tmp.height=canvas.height;}
  const tc=tmp.getContext('2d');tc.translate(tmp.width/2,tmp.height/2);tc.rotate(deg*Math.PI/180);tc.drawImage(canvas,-canvas.width/2,-canvas.height/2);
  canvas.width=tmp.width;canvas.height=tmp.height;ctx.drawImage(tmp,0,0);pushHistory();adjustScale();
}

function flipH() {
  commitFilters();
  const tmp=document.createElement('canvas');tmp.width=canvas.width;tmp.height=canvas.height;
  const tc=tmp.getContext('2d');tc.translate(canvas.width,0);tc.scale(-1,1);tc.drawImage(canvas,0,0);
  ctx.drawImage(tmp,0,0);pushHistory();
}

// 자르기
function startCrop() {
  isCropping=true; cropCvs.style.display='block';
  document.getElementById('cropBtn').style.display='none';
  document.getElementById('cropConfirm').style.display='';
  document.getElementById('cropCancel').style.display='';
  cropCtx.clearRect(0,0,cropCvs.width,cropCvs.height);
  cropCvs.onmousedown=e=>{isDrawing=true;cropStart=gc(e);};
  cropCvs.onmousemove=e=>{if(!isDrawing)return;cropEnd=gc(e);drawCropBox();};
  cropCvs.onmouseup=e=>{isDrawing=false;cropEnd=gc(e);};
  document.getElementById('statusBar').textContent = '원하는 영역을 드래그로 선택하세요';
}

document.getElementById('cropBtn').addEventListener('click', startCrop);
function gc(e){const r=cropCvs.getBoundingClientRect();return{x:Math.round((e.clientX-r.left)*cropCvs.width/r.width),y:Math.round((e.clientY-r.top)*cropCvs.height/r.height)};}
function drawCropBox(){
  cropCtx.clearRect(0,0,cropCvs.width,cropCvs.height);cropCtx.fillStyle='rgba(0,0,0,0.4)';cropCtx.fillRect(0,0,cropCvs.width,cropCvs.height);
  const x=Math.min(cropStart.x,cropEnd.x),y=Math.min(cropStart.y,cropEnd.y),w=Math.abs(cropEnd.x-cropStart.x),h=Math.abs(cropEnd.y-cropStart.y);
  cropCtx.clearRect(x,y,w,h);cropCtx.strokeStyle='#fff';cropCtx.lineWidth=2;cropCtx.strokeRect(x,y,w,h);
}
document.getElementById('cropConfirm').addEventListener('click', () => {
  if(!cropStart||!cropEnd)return cancelCropEdit();
  const x=Math.min(cropStart.x,cropEnd.x),y=Math.min(cropStart.y,cropEnd.y),w=Math.abs(cropEnd.x-cropStart.x),h=Math.abs(cropEnd.y-cropStart.y);
  if(w<2||h<2)return cancelCropEdit();
  commitFilters();
  const tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;
  tmp.getContext('2d').drawImage(canvas,x,y,w,h,0,0,w,h);
  canvas.width=w;canvas.height=h;ctx.drawImage(tmp,0,0);pushHistory();adjustScale();cancelCropEdit();
});
document.getElementById('cropCancel').addEventListener('click', cancelCropEdit);
function cancelCropEdit(){
  isCropping=false;cropCvs.style.display='none';cropCtx.clearRect(0,0,cropCvs.width,cropCvs.height);
  document.getElementById('cropBtn').style.display='';document.getElementById('cropConfirm').style.display='none';document.getElementById('cropCancel').style.display='none';
  cropStart=null;cropEnd=null;
}

document.getElementById('doneBtn').addEventListener('click', () => {
  commitFilters();
  document.getElementById('compareOriginal').src = currentProduct ? currentProduct.imgUrl : '';
  const nc = document.getElementById('compareNew');
  nc.width = canvas.width; nc.height = canvas.height;
  nc.getContext('2d').drawImage(canvas,0,0);
  // canvas 표시 크기 조정
  nc.style.width = '100%';
  nc.style.height = 'auto';
  goPage(4);
});

// ── 4단계: 저장 ────────────────────────────────
document.getElementById('backEditBtn').addEventListener('click', () => goPage(3));

document.getElementById('savePngBtn').addEventListener('click', () => {
  commitFilters();
  try {
    const a=document.createElement('a');
    a.download=(currentProduct?currentProduct.name.slice(0,20):'편집이미지')+'_edited.png';
    a.href=canvas.toDataURL('image/png');a.click();
  } catch (e) {
    alert('이미지를 내보낼 수 없습니다. (보안 제한)\n다른 이미지를 선택해주세요.');
  }
});

document.getElementById('uploadShopling').addEventListener('click', () => {
  if (!currentProduct?.prodId) {
    document.getElementById('saveStatus').textContent = '❌ prod_id가 없습니다.';
    return;
  }
  commitFilters();
  const status = document.getElementById('saveStatus');
  status.textContent = '⏳ 이미지 저장 중...';
  status.style.color = '#fbbf24';

  let dataUrl;
  try {
    dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  } catch (e) {
    status.textContent = '❌ 이미지를 내보낼 수 없습니다. (보안 제한)';
    status.style.color = '#f87171';
    return;
  }

  chrome.storage.local.get(['shoplingApi'], (r) => {
    if (chrome.runtime.lastError) {
      status.textContent = '❌ 설정을 불러올 수 없습니다: ' + chrome.runtime.lastError.message;
      status.style.color = '#f87171';
      return;
    }
    const folderName = r.shoplingApi?.folderName || 'shopling_images';
    chrome.runtime.sendMessage({
      action: 'downloadAndQueue',
      prodId: currentProduct.prodId,
      imageDataUrl: dataUrl,
      folderName: folderName
    }, res => {
      if (chrome.runtime.lastError) {
        status.textContent = '❌ ' + chrome.runtime.lastError.message;
        status.style.color = '#f87171';
        return;
      }
      if (res?.success) {
        status.textContent = '✅ 저장 완료! 총 ' + res.count + '개 대기 중. upload_shopling.py 실행하면 자동 업로드됩니다.';
        status.style.color = '#22c55e';
      } else {
        status.textContent = '❌ ' + (res?.error || '저장 실패');
        status.style.color = '#f87171';
      }
    });
  });
});

window.addEventListener('resize', () => { if(canvas.width) adjustScale(); });
