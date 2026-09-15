/* ===================== 전역 상태 ===================== */
const state = {
  file: null,
  fileName: '',
  fileURL: null,
  info: null,          // {width, height, frameCount, fps, size}
  resultCount: 0,       // 생성된 결과 패널 수 (id 구분용)
};

/* ===================== DOM 참조 ===================== */
const uploadScreen = document.getElementById('uploadScreen');
const editScreen = document.getElementById('editScreen');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const chooseAnotherBtn = document.getElementById('chooseAnotherBtn');

const originalPreview = document.getElementById('originalPreview');
const originalPanel = document.getElementById('originalPanel');
const originalCollapseBtn = document.getElementById('originalCollapseBtn');
const originalDownloadBtn = document.getElementById('originalDownloadBtn');
const resultPanels = document.getElementById('resultPanels');

const infoSize = document.getElementById('infoSize');
const infoResolution = document.getElementById('infoResolution');
const infoFps = document.getElementById('infoFps');
const infoFrames = document.getElementById('infoFrames');

const toolsGrid = document.getElementById('toolsGrid');
const toolOptions = document.getElementById('toolOptions');

/* ===================== 유틸 ===================== */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

/* ===================== GIF 헤더 파싱 (정보 표시용) ===================== */
function parseGifInfo(arrayBuffer) {
  const buf = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);
  let p = 6; // "GIF87a" / "GIF89a"
  const width = dv.getUint16(p, true); p += 2;
  const height = dv.getUint16(p, true); p += 2;
  const packed = buf[p]; p += 1;
  const gctFlag = (packed & 0x80) !== 0;
  const gctSize = 2 << (packed & 0x07);
  p += 1; // background color index
  p += 1; // pixel aspect ratio
  if (gctFlag) p += gctSize * 3;

  let frameCount = 0;
  let totalDelay = 0; // centiseconds

  while (p < buf.length) {
    const sep = buf[p];
    if (sep === 0x21) {
      p += 1;
      const label = buf[p]; p += 1;
      if (label === 0xF9) {
        const blockSize = buf[p]; p += 1;
        const delay = dv.getUint16(p + 1, true);
        totalDelay += delay;
        p += blockSize;
        p += 1; // terminator
      } else {
        while (true) {
          const blockSize = buf[p]; p += 1;
          if (blockSize === 0) break;
          p += blockSize;
        }
      }
    } else if (sep === 0x2C) {
      frameCount += 1;
      p += 1;
      p += 8;
      const imgPacked = buf[p]; p += 1;
      const localFlag = (imgPacked & 0x80) !== 0;
      const localSize = 2 << (imgPacked & 0x07);
      if (localFlag) p += localSize * 3;
      p += 1; // LZW min code size
      while (true) {
        const blockSize = buf[p]; p += 1;
        if (blockSize === 0) break;
        p += blockSize;
      }
    } else if (sep === 0x3B) {
      break;
    } else {
      break;
    }
  }

  const avgDelayCs = frameCount > 0 ? totalDelay / frameCount : 0;
  const fps = avgDelayCs > 0 ? (100 / avgDelayCs) : 0;

  return { width, height, frameCount, fps, totalDelayMs: totalDelay * 10 };
}

function renderFileInfo(file, info) {
  infoSize.textContent = formatBytes(file.size);
  infoResolution.textContent = `${info.width} x ${info.height}`;
  infoFps.textContent = info.fps > 0 ? `${info.fps.toFixed(1)} fps` : '-';
  infoFrames.textContent = `${info.frameCount}`;
}

/* ===================== 업로드 처리 ===================== */
function handleFile(file) {
  if (!file || !file.type.includes('gif')) {
    alert('GIF 파일만 업로드할 수 있습니다.');
    return;
  }
  resetWorkspace();

  state.file = file;
  state.fileName = file.name;
  const url = URL.createObjectURL(file);
  state.fileURL = url;

  originalPreview.src = url;

  file.arrayBuffer().then((buf) => {
    const info = parseGifInfo(buf);
    state.info = info;
    renderFileInfo(file, info);
  });

  uploadScreen.style.display = 'none';
  editScreen.style.display = 'block';
}

function resetWorkspace() {
  if (state.fileURL) URL.revokeObjectURL(state.fileURL);
  state.file = null;
  state.fileName = '';
  state.fileURL = null;
  state.info = null;
  state.resultCount = 0;

  originalPreview.src = '';
  infoSize.textContent = '-';
  infoResolution.textContent = '-';
  infoFps.textContent = '-';
  infoFrames.textContent = '-';

  originalPanel.classList.remove('collapsed');
  originalCollapseBtn.textContent = '▼';

  resultPanels.innerHTML = '';

  toolOptions.style.display = 'none';
  toolOptions.innerHTML = '';
  toolsGrid.style.display = 'grid';
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));

  fileInput.value = '';
}

chooseFileBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (e) => {
  if (e.target === chooseFileBtn) return;
  fileInput.click();
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
});
['dragenter', 'dragover'].forEach(evt => {
  dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(evt => {
  dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});

chooseAnotherBtn.addEventListener('click', () => {
  resetWorkspace();
  uploadScreen.style.display = 'flex';
  editScreen.style.display = 'none';
});

/* 패널 접기/펼치기 */
originalCollapseBtn.addEventListener('click', () => {
  originalPanel.classList.toggle('collapsed');
  originalCollapseBtn.textContent = originalPanel.classList.contains('collapsed') ? '▶' : '▼';
});

originalDownloadBtn.addEventListener('click', () => {
  if (!state.fileURL) return;
  const a = document.createElement('a');
  a.href = state.fileURL;
  a.download = state.fileName;
  a.click();
});

/* ===================== 도구 버튼 클릭 ===================== */
toolsGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.tool-btn');
  if (!btn) return;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tool = btn.dataset.tool;
  toolsGrid.style.display = 'none';
  toolOptions.style.display = 'flex';
  renderToolPanel(tool);
});

function backToGrid() {
  toolOptions.style.display = 'none';
  toolOptions.innerHTML = '';
  toolsGrid.style.display = 'grid';
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
}

function toolHeader(title) {
  return `
    <div class="option-back-row">
      <button class="btn btn-secondary btn-back-inline" id="btnBackToGrid">← Back</button>
      <span class="tool-title">${title}</span>
    </div>
  `;
}

function renderToolPanel(tool) {
  switch (tool) {
    case 'resize': renderResizePanel(); break;
    case 'crop': renderCropPanel(); break;
    case 'downsize': renderDownsizePanel(); break;
    case 'convert': renderConvertPanel(); break;
    case 'rotate': renderRotatePanel(); break;
    case 'optimize': renderOptimizePanel(); break;
    case 'reverse': renderReversePanel(); break;
    case 'speed': renderSpeedPanel(); break;
    case 'cut': renderComingSoon('Cut'); break;
    default: renderComingSoon(tool);
  }
  const backBtn = document.getElementById('btnBackToGrid');
  if (backBtn) backBtn.addEventListener('click', backToGrid);
}

function renderComingSoon(title) {
  toolOptions.innerHTML = `
    ${toolHeader(title)}
    <p style="color:#8a93a3; font-size:14px;">이 기능은 곧 제공될 예정입니다. 🚧</p>
  `;
  document.getElementById('btnBackToGrid').addEventListener('click', backToGrid);
}

/* ===================== 결과 패널 생성 공통 함수 ===================== */
function createResultPanel(label, blob, fileNamePrefix) {
  state.resultCount += 1;
  const id = `result_${state.resultCount}`;
  const url = URL.createObjectURL(blob);
  const downloadName = `${fileNamePrefix}.${state.fileName}`;

  const wrapper = document.createElement('div');
  wrapper.className = 'panel';
  wrapper.id = id;

  const isImageForInfo = blob.type === 'image/gif';

  wrapper.innerHTML = `
    <div class="panel-header">
      <button class="collapse-btn" title="패널 접기/펼치기">▼</button>
      <h2>${label}</h2>
      <button class="btn btn-download">⬇ Download</button>
    </div>
    <div class="panel-body">
      <div class="preview-box">
        ${blob.type.startsWith('video') ?
          `<video src="${url}" controls class="preview-img"></video>` :
          `<img src="${url}" class="preview-img" alt="${label}">`}
      </div>
      <div class="file-info">
        <div class="info-item"><span class="info-label">File size</span><span class="info-value" id="${id}_size">${formatBytes(blob.size)}</span></div>
        <div class="info-item"><span class="info-label">Resolution</span><span class="info-value" id="${id}_res">-</span></div>
        <div class="info-item"><span class="info-label">Frame rate</span><span class="info-value" id="${id}_fps">-</span></div>
        <div class="info-item"><span class="info-label">Total frames</span><span class="info-value" id="${id}_frames">-</span></div>
      </div>
    </div>
  `;

  resultPanels.prepend(wrapper);

  const collapseBtn = wrapper.querySelector('.collapse-btn');
  collapseBtn.addEventListener('click', () => {
    wrapper.classList.toggle('collapsed');
    collapseBtn.textContent = wrapper.classList.contains('collapsed') ? '▶' : '▼';
  });

  wrapper.querySelector('.btn-download').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    a.click();
  });

  if (isImageForInfo) {
    blob.arrayBuffer().then((buf) => {
      const info = parseGifInfo(buf);
      wrapper.querySelector(`#${id}_res`).textContent = `${info.width} x ${info.height}`;
      wrapper.querySelector(`#${id}_fps`).textContent = info.fps > 0 ? `${info.fps.toFixed(1)} fps` : '-';
      wrapper.querySelector(`#${id}_frames`).textContent = `${info.frameCount}`;
    });
  } else {
    wrapper.querySelector(`#${id}_res`).textContent = '-';
    wrapper.querySelector(`#${id}_fps`).textContent = '-';
    wrapper.querySelector(`#${id}_frames`).textContent = '-';
  }

  // 원본 패널 자동 접기
  originalPanel.classList.add('collapsed');
  originalCollapseBtn.textContent = '▶';

  return { url, wrapper };
}

/* ===================== GIF 디코딩 (gifuct-js) ===================== */
async function decodeGifFrames(arrayBuffer) {
  const gif = window.GIF ? null : null; // no-op guard
  const { parseGIF, decompressFrames } = window.gifuct;
  const parsed = parseGIF(arrayBuffer);
  const frames = decompressFrames(parsed, true);
  const width = parsed.lsd.width;
  const height = parsed.lsd.height;
  return { frames, width, height };
}

/* 프레임들을 전체 캔버스 크기의 ImageData 배열로 합성 (disposal 처리) */
function composeFrames(frames, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  let previousImageData = null;
  const composed = [];
  const delays = [];

  frames.forEach((frame) => {
    const dims = frame.dims;

    if (frame.disposalType === 3 && !previousImageData) {
      previousImageData = ctx.getImageData(0, 0, width, height);
    }

    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = dims.width;
    patchCanvas.height = dims.height;
    const patchCtx = patchCanvas.getContext('2d');
    const patchImageData = patchCtx.createImageData(dims.width, dims.height);
    patchImageData.data.set(frame.patch);
    patchCtx.putImageData(patchImageData, 0, 0);

    ctx.drawImage(patchCanvas, dims.left, dims.top);

    composed.push(ctx.getImageData(0, 0, width, height));
    delays.push(frame.delay > 0 ? frame.delay : 100); // gifuct delay is ms; fallback

    if (frame.disposalType === 2) {
      ctx.clearRect(dims.left, dims.top, dims.width, dims.height);
    } else if (frame.disposalType === 3 && previousImageData) {
      ctx.putImageData(previousImageData, 0, 0);
      previousImageData = null;
    }
  });

  return { composed, delays };
}

/* ===================== GIF 인코딩 (gif.js) ===================== */
function encodeGif(imageDataList, delaysMs, width, height, quality = 10) {
  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality,
      width,
      height,
      workerScript: 'https://cdn.jsdelivr.net/npm/gif.js.optimized@1.0.1/dist/gif.worker.js'
    });

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = width;
    tmpCanvas.height = height;
    const tmpCtx = tmpCanvas.getContext('2d');

    imageDataList.forEach((imgData, i) => {
      tmpCtx.putImageData(imgData, 0, 0);
      gif.addFrame(tmpCtx, { copy: true, delay: delaysMs[i] });
    });

    gif.on('finished', (blob) => resolve(blob));
    gif.on('abort', () => reject(new Error('GIF encoding aborted')));
    gif.render();
  });
}

/* 진행률 표시가 필요한 경우 progress 콜백 지원 버전 */
function encodeGifWithProgress(imageDataList, delaysMs, width, height, quality, onProgress) {
  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality,
      width,
      height,
      workerScript: 'https://cdn.jsdelivr.net/npm/gif.js.optimized@1.0.1/dist/gif.worker.js'
    });

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = width;
    tmpCanvas.height = height;
    const tmpCtx = tmpCanvas.getContext('2d');

    imageDataList.forEach((imgData, i) => {
      tmpCtx.putImageData(imgData, 0, 0);
      gif.addFrame(tmpCtx, { copy: true, delay: delaysMs[i] });
    });

    gif.on('progress', (p) => onProgress && onProgress(p));
    gif.on('finished', (blob) => resolve(blob));
    gif.on('abort', () => reject(new Error('GIF encoding aborted')));
    gif.render();
  });
}

/* =========================================================
   RESIZE
   ========================================================= */
function renderResizePanel() {
  const w = state.info.width;
  const h = state.info.height;
  const minW = Math.max(1, Math.round(w * 0.05));
  const maxW = Math.round(w * 3);
  const minH = Math.max(1, Math.round(h * 0.05));
  const maxH = Math.round(h * 3);

  toolOptions.innerHTML = `
    ${toolHeader('Resize')}
    <div class="slider-group">
      <div class="slider-row">
        <span class="axis-icon">↔️</span>
        <input type="range" id="resizeX" min="${minW}" max="${maxW}" value="${w}">
        <span class="slider-value" id="resizeXVal">${w}px</span>
      </div>
      <div class="lock-row">
        <button class="lock-btn" id="lockBtn" data-locked="true">🔒</button>
      </div>
      <div class="slider-row">
        <span class="axis-icon">↕️</span>
        <input type="range" id="resizeY" min="${minH}" max="${maxH}" value="${h}">
        <span class="slider-value" id="resizeYVal">${h}px</span>
      </div>
    </div>
    <div class="progress-wrap" id="resizeProgressWrap">
      <div class="progress-bar-bg"><div class="progress-bar-fill" id="resizeProgressFill"></div></div>
      <div class="progress-label" id="resizeProgressLabel">처리 중...</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-back" id="resizeBackBtn">Back</button>
      <button class="btn btn-go" id="resizeGoBtn">Go!</button>
    </div>
  `;

  const resizeX = document.getElementById('resizeX');
  const resizeY = document.getElementById('resizeY');
  const resizeXVal = document.getElementById('resizeXVal');
  const resizeYVal = document.getElementById('resizeYVal');
  const lockBtn = document.getElementById('lockBtn');

  const ratio = w / h;

  resizeX.addEventListener('input', () => {
    resizeXVal.textContent = `${resizeX.value}px`;
    if (lockBtn.dataset.locked === 'true') {
      const newY = clamp(Math.round(resizeX.value / ratio), Number(resizeY.min), Number(resizeY.max));
      resizeY.value = newY;
      resizeYVal.textContent = `${newY}px`;
    }
  });
  resizeY.addEventListener('input', () => {
    resizeYVal.textContent = `${resizeY.value}px`;
    if (lockBtn.dataset.locked === 'true') {
      const newX = clamp(Math.round(resizeY.value * ratio), Number(resizeX.min), Number(resizeX.max));
      resizeX.value = newX;
      resizeXVal.textContent = `${newX}px`;
    }
  });
  lockBtn.addEventListener('click', () => {
    const locked = lockBtn.dataset.locked === 'true';
    lockBtn.dataset.locked = (!locked).toString();
    lockBtn.textContent = !locked ? '🔒' : '🔓';
  });

  document.getElementById('resizeBackBtn').addEventListener('click', backToGrid);
  document.getElementById('resizeGoBtn').addEventListener('click', async () => {
    const targetW = Number(resizeX.value);
    const targetH = Number(resizeY.value);
    const goBtn = document.getElementById('resizeGoBtn');
    goBtn.disabled = true;
    document.getElementById('resizeProgressWrap').style.display = 'flex';

    try {
      const buf = await state.file.arrayBuffer();
      const { frames, width, height } = await decodeGifFrames(buf);
      const { composed, delays } = composeFrames(frames, width, height);

      const resizedImageData = composed.map((imgData) => {
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = width; srcCanvas.height = height;
        srcCanvas.getContext('2d').putImageData(imgData, 0, 0);

        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = targetW; dstCanvas.height = targetH;
        const dstCtx = dstCanvas.getContext('2d');
        dstCtx.drawImage(srcCanvas, 0, 0, targetW, targetH);
        return dstCtx.getImageData(0, 0, targetW, targetH);
      });

      const blob = await encodeGifWithProgress(resizedImageData, delays, targetW, targetH, 10, (p) => {
        document.getElementById('resizeProgressFill').style.width = `${Math.round(p * 100)}%`;
        document.getElementById('resizeProgressLabel').textContent = `처리 중... ${Math.round(p * 100)}%`;
      });

      createResultPanel('Resized GIF', blob, 'Resized');
      backToGrid();
    } catch (err) {
      console.error(err);
      alert('Resize 처리 중 오류가 발생했습니다.');
    } finally {
      goBtn.disabled = false;
    }
  });
}

/* =========================================================
   CROP
   ========================================================= */
function renderCropPanel() {
  const w = state.info.width;
  const h = state.info.height;

  toolOptions.innerHTML = `
    ${toolHeader('Crop')}
    <div>
      <p style="font-size:13px; font-weight:700; margin-bottom:8px;">Aspect Ratio</p>
      <div class="ratio-grid" id="ratioGrid">
        <button class="ratio-btn" data-ratio="1/1">1:1</button>
        <button class="ratio-btn" data-ratio="3/4">3:4</button>
        <button class="ratio-btn" data-ratio="4/3">4:3</button>
        <button class="ratio-btn" data-ratio="9/16">9:16</button>
        <button class="ratio-btn" data-ratio="16/9">16:9</button>
        <button class="ratio-btn" data-ratio="custom">Custom</button>
      </div>
      <div class="field-row" id="customRatioRow" style="display:none; margin-top:8px;">
        <input type="number" id="customW" value="1" min="1"> :
        <input type="number" id="customH" value="1" min="1">
      </div>
    </div>
    <div>
      <p style="font-size:13px; font-weight:700; margin-bottom:8px;">Empty Space</p>
      <div class="mode-cards" id="modeCards">
        <div class="mode-card" data-mode="pad">
          <span class="mode-icon">🎨</span>
          Fill with solid color
        </div>
        <div class="mode-card" data-mode="cover">
          <span class="mode-icon">🔍</span>
          Scale to fill (crop)
        </div>
      </div>
      <div class="field-row" id="colorRow" style="display:none; margin-top:10px;">
        <label style="font-size:13px;">Fill color</label>
        <input type="color" id="fillColor" class="color-input" value="#ffffff">
      </div>
    </div>
    <div class="progress-wrap" id="cropProgressWrap">
      <div class="progress-bar-bg"><div class="progress-bar-fill" id="cropProgressFill"></div></div>
      <div class="progress-label" id="cropProgressLabel">처리 중...</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-back" id="cropBackBtn">Back</button>
      <button class="btn btn-go" id="cropGoBtn" disabled>Go!</button>
    </div>
  `;

  let selectedRatio = null; // {rw, rh}
  let selectedMode = null;

  function checkReady() {
    document.getElementById('cropGoBtn').disabled = !(selectedRatio && selectedMode);
  }

  document.getElementById('ratioGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.ratio-btn');
    if (!btn) return;
    document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const val = btn.dataset.ratio;
    const customRow = document.getElementById('customRatioRow');
    if (val === 'custom') {
      customRow.style.display = 'flex';
      selectedRatio = { rw: Number(document.getElementById('customW').value), rh: Number(document.getElementById('customH').value) };
    } else {
      customRow.style.display = 'none';
      const [rw, rh] = val.split('/').map(Number);
      selectedRatio = { rw, rh };
    }
    checkReady();
  });

  ['customW', 'customH'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      selectedRatio = {
        rw: Number(document.getElementById('customW').value) || 1,
        rh: Number(document.getElementById('customH').value) || 1
      };
      checkReady();
    });
  });

  document.getElementById('modeCards').addEventListener('click', (e) => {
    const card = e.target.closest('.mode-card');
    if (!card) return;
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    selectedMode = card.dataset.mode;
    document.getElementById('colorRow').style.display = selectedMode === 'pad' ? 'flex' : 'none';
    checkReady();
  });

  document.getElementById('cropBackBtn').addEventListener('click', backToGrid);
  document.getElementById('cropGoBtn').addEventListener('click', async () => {
    const goBtn = document.getElementById('cropGoBtn');
    goBtn.disabled = true;
    document.getElementById('cropProgressWrap').style.display = 'flex';

    try {
      const targetRatio = selectedRatio.rw / selectedRatio.rh;
      // 면적을 원본과 동일하게 유지하며 비율에 맞는 목표 해상도 계산
      const area = w * h;
      let targetW = Math.round(Math.sqrt(area * targetRatio));
      let targetH = Math.round(targetW / targetRatio);

      const fillColor = document.getElementById('fillColor').value;

      const buf = await state.file.arrayBuffer();
      const { frames, width, height } = await decodeGifFrames(buf);
      const { composed, delays } = composeFrames(frames, width, height);

      const cropped = composed.map((imgData) => {
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = width; srcCanvas.height = height;
        srcCanvas.getContext('2d').putImageData(imgData, 0, 0);

        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = targetW; dstCanvas.height = targetH;
        const dstCtx = dstCanvas.getContext('2d');

        if (selectedMode === 'pad') {
          dstCtx.fillStyle = fillColor;
          dstCtx.fillRect(0, 0, targetW, targetH);
          const scale = Math.min(targetW / width, targetH / height);
          const dw = width * scale, dh = height * scale;
          const dx = (targetW - dw) / 2, dy = (targetH - dh) / 2;
          dstCtx.drawImage(srcCanvas, dx, dy, dw, dh);
        } else {
          const scale = Math.max(targetW / width, targetH / height);
          const dw = width * scale, dh = height * scale;
          const dx = (targetW - dw) / 2, dy = (targetH - dh) / 2;
          dstCtx.drawImage(srcCanvas, dx, dy, dw, dh);
        }
        return dstCtx.getImageData(0, 0, targetW, targetH);
      });

      const blob = await encodeGifWithProgress(cropped, delays, targetW, targetH, 10, (p) => {
        document.getElementById('cropProgressFill').style.width = `${Math.round(p * 100)}%`;
        document.getElementById('cropProgressLabel').textContent = `처리 중... ${Math.round(p * 100)}%`;
      });

      createResultPanel('Cropped GIF', blob, 'Cropped');
      backToGrid();
    } catch (err) {
      console.error(err);
      alert('Crop 처리 중 오류가 발생했습니다.');
    } finally {
      goBtn.disabled = false;
    }
  });
}

/* =========================================================
   DOWNSIZING
   ========================================================= */
function renderDownsizePanel() {
  const w = state.info.width;
  const h = state.info.height;
  const totalFrames = state.info.frameCount;

  toolOptions.innerHTML = `
    ${toolHeader('Downsizing')}

    <div>
      <label class="checkbox-row"><input type="checkbox" id="chkQuality"> 🎨 Reduce Color Quality (사이즈 축소)</label>
      <div class="sub-option" id="qualityOptions" style="display:none; margin-top:8px;">
        <div class="slider-row">
          <input type="range" id="qualitySlider" min="1" max="30" value="10">
          <span class="slider-value" id="qualityVal">10</span>
        </div>
      </div>
    </div>

    <div>
      <label class="checkbox-row"><input type="checkbox" id="chkFrames"> 🗑️ Delete Frames (프레임 삭제)</label>
      <div class="sub-option" id="framesOptions" style="display:none; margin-top:8px;">
        <div class="slider-row">
          <input type="range" id="framesSlider" min="0" max="90" value="30">
          <span class="slider-value" id="framesVal">30%</span>
        </div>
        <p style="font-size:12px; color:#8a93a3; margin-top:4px;" id="framesPreview"></p>
      </div>
    </div>

    <div>
      <label class="checkbox-row"><input type="checkbox" id="chkRes"> 📐 Lower Resolution (해상도 낮추기)</label>
      <div class="sub-option" id="resOptions" style="display:none; margin-top:8px;">
        <div class="slider-row">
          <input type="range" id="resSlider" min="10" max="100" value="70">
          <span class="slider-value" id="resVal">70%</span>
        </div>
        <p style="font-size:12px; color:#8a93a3; margin-top:4px;" id="resPreview"></p>
      </div>
    </div>

    <div class="progress-wrap" id="downProgressWrap">
      <div class="progress-bar-bg"><div class="progress-bar-fill" id="downProgressFill"></div></div>
      <div class="progress-label" id="downProgressLabel">처리 중...</div>
    </div>

    <div class="btn-row">
      <button class="btn btn-back" id="downBackBtn">Back</button>
      <button class="btn btn-go" id="downGoBtn" disabled>Go!</button>
    </div>
  `;

  function updatePreviews() {
    const framePct = Number(document.getElementById('framesSlider').value);
    const remain = Math.max(1, Math.round(totalFrames * (1 - framePct / 100)));
    document.getElementById('framesPreview').textContent = `${totalFrames}개 프레임 → 약 ${remain}개 프레임`;

    const resPct = Number(document.getElementById('resSlider').value);
    const newW = Math.max(1, Math.round(w * resPct / 100));
    const newH = Math.max(1, Math.round(h * resPct / 100));
    document.getElementById('resPreview').textContent = `${w}x${h} → ${newW}x${newH}`;
  }

  function checkReady() {
    const any = document.getElementById('chkQuality').checked ||
                document.getElementById('chkFrames').checked ||
                document.getElementById('chkRes').checked;
    document.getElementById('downGoBtn').disabled = !any;
  }

  document.getElementById('chkQuality').addEventListener('change', (e) => {
    document.getElementById('qualityOptions').style.display = e.target.checked ? 'block' : 'none';
    checkReady();
  });
  document.getElementById('chkFrames').addEventListener('change', (e) => {
    document.getElementById('framesOptions').style.display = e.target.checked ? 'block' : 'none';
    checkReady();
  });
  document.getElementById('chkRes').addEventListener('change', (e) => {
    document.getElementById('resOptions').style.display = e.target.checked ? 'block' : 'none';
    checkReady();
  });

  document.getElementById('qualitySlider').addEventListener('input', (e) => {
    document.getElementById('qualityVal').textContent = e.target.value;
  });
  document.getElementById('framesSlider').addEventListener('input', () => {
    document.getElementById('framesVal').textContent = `${document.getElementById('framesSlider').value}%`;
    updatePreviews();
  });
  document.getElementById('resSlider').addEventListener('input', () => {
    document.getElementById('resVal').textContent = `${document.getElementById('resSlider').value}%`;
    updatePreviews();
  });

  updatePreviews();

  document.getElementById('downBackBtn').addEventListener('click', backToGrid);
  document.getElementById('downGoBtn').addEventListener('click', async () => {
    const goBtn = document.getElementById('downGoBtn');
    goBtn.disabled = true;
    document.getElementById('downProgressWrap').style.display = 'flex';

    try {
      const useQuality = document.getElementById('chkQuality').checked;
      const useFrames = document.getElementById('chkFrames').checked;
      const useRes = document.getElementById('chkRes').checked;

      const qualityVal = Number(document.getElementById('qualitySlider').value);
      const framePct = Number(document.getElementById('framesSlider').value);
      const resPct = Number(document.getElementById('resSlider').value);

      const buf = await state.file.arrayBuffer();
      const { frames, width, height } = await decodeGifFrames(buf);
      let { composed, delays } = composeFrames(frames, width, height);

      // 1) 프레임 삭제 (재생시간 보존)
      if (useFrames && framePct > 0) {
        const keepRatio = 1 - framePct / 100;
        const n = composed.length;
        const keepCount = Math.max(1, Math.round(n * keepRatio));
        const step = n / keepCount;

        const keepIndexes = new Set();
        for (let i = 0; i < keepCount; i++) {
          keepIndexes.add(Math.min(n - 1, Math.floor(i * step)));
        }

        const newComposed = [];
        const newDelays = [];
        let carry = 0;
        for (let i = 0; i < n; i++) {
          if (keepIndexes.has(i)) {
            newComposed.push(composed[i]);
            newDelays.push(delays[i] + carry);
            carry = 0;
          } else {
            carry += delays[i];
          }
        }
        // 남은 carry(마지막 프레임들이 삭제된 경우)는 마지막 유지 프레임에 합산
        if (carry > 0 && newDelays.length > 0) {
          newDelays[newDelays.length - 1] += carry;
        }
        composed = newComposed;
        delays = newDelays;
      }

      // 2) 해상도 축소
      let curW = width, curH = height;
      if (useRes && resPct < 100) {
        const newW = Math.max(1, Math.round(width * resPct / 100));
        const newH = Math.max(1, Math.round(height * resPct / 100));
        composed = composed.map((imgData) => {
          const srcCanvas = document.createElement('canvas');
          srcCanvas.width = curW; srcCanvas.height = curH;
          srcCanvas.getContext('2d').putImageData(imgData, 0, 0);
          const dstCanvas = document.createElement('canvas');
          dstCanvas.width = newW; dstCanvas.height = newH;
          dstCanvas.getContext('2d').drawImage(srcCanvas, 0, 0, newW, newH);
          return dstCanvas.getContext('2d').getImageData(0, 0, newW, newH);
        });
        curW = newW; curH = newH;
      }

      // 3) 색상 품질(압축 레벨) 적용은 인코딩 quality 값으로 반영
      const quality = useQuality ? qualityVal : 10;

      const blob = await encodeGifWithProgress(composed, delays, curW, curH, quality, (p) => {
        document.getElementById('downProgressFill').style.width = `${Math.round(p * 100)}%`;
        document.getElementById('downProgressLabel').textContent = `처리 중... ${Math.round(p * 100)}%`;
      });

      createResultPanel('Downsized GIF', blob, 'Downsized');
      backToGrid();
    } catch (err) {
      console.error(err);
      alert('Downsizing 처리 중 오류가 발생했습니다.');
    } finally {
      goBtn.disabled = false;
    }
  });
}

/* =========================================================
   ROTATE / FLIP
   ========================================================= */
function renderRotatePanel() {
  toolOptions.innerHTML = `
    ${toolHeader('Rotate / Flip')}
    <div class="ratio-grid" id="rotateGrid">
      <button class="ratio-btn" data-action="rotate90">↻ Rotate 90°</button>
      <button class="ratio-btn" data-action="rotate180">↕️ Rotate 180°</button>
      <button class="ratio-btn" data-action="rotate270">↺ Rotate 270°</button>
      <button class="ratio-btn" data-action="flipH">⇋ Flip Horizontal</button>
      <button class="ratio-btn" data-action="flipV">⇵ Flip Vertical</button>
    </div>
    <div class="progress-wrap" id="rotateProgressWrap">
      <div class="progress-bar-bg"><div class="progress-bar-fill" id="rotateProgressFill"></div></div>
      <div class="progress-label" id="rotateProgressLabel">처리 중...</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-back" id="rotateBackBtn">Back</button>
      <button class="btn btn-go" id="rotateGoBtn" disabled>Go!</button>
    </div>
  `;

  let selectedAction = null;
  document.getElementById('rotateGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.ratio-btn');
    if (!btn) return;
    document.querySelectorAll('#rotateGrid .ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedAction = btn.dataset.action;
    document.getElementById('rotateGoBtn').disabled = false;
  });

  document.getElementById('rotateBackBtn').addEventListener('click', backToGrid);
  document.getElementById('rotateGoBtn').addEventListener('click', async () => {
    const goBtn = document.getElementById('rotateGoBtn');
    goBtn.disabled = true;
    document.getElementById('rotateProgressWrap').style.display = 'flex';

    try {
      const buf = await state.file.arrayBuffer();
      const { frames, width, height } = await decodeGifFrames(buf);
      const { composed, delays } = composeFrames(frames, width, height);

      let targetW = width, targetH = height;
      if (selectedAction === 'rotate90' || selectedAction === 'rotate270') {
        targetW = height; targetH = width;
      }

      const transformed = composed.map((imgData) => {
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = width; srcCanvas.height = height;
        srcCanvas.getContext('2d').putImageData(imgData, 0, 0);

        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = targetW; dstCanvas.height = targetH;
        const ctx = dstCanvas.getContext('2d');

        ctx.save();
        switch (selectedAction) {
          case 'rotate90':
            ctx.translate(targetW, 0); ctx.rotate(Math.PI / 2);
            ctx.drawImage(srcCanvas, 0, 0);
            break;
          case 'rotate180':
            ctx.translate(targetW, targetH); ctx.rotate(Math.PI);
            ctx.drawImage(srcCanvas, 0, 0);
            break;
          case 'rotate270':
            ctx.translate(0, targetH); ctx.rotate(-Math.PI / 2);
            ctx.drawImage(srcCanvas, 0, 0);
            break;
          case 'flipH':
            ctx.translate(targetW, 0); ctx.scale(-1, 1);
            ctx.drawImage(srcCanvas, 0, 0);
            break;
          case 'flipV':
            ctx.translate(0, targetH); ctx.scale(1, -1);
            ctx.drawImage(srcCanvas, 0, 0);
            break;
        }
        ctx.restore();

        return ctx.getImageData(0, 0, targetW, targetH);
      });

      const blob = await encodeGifWithProgress(transformed, delays, targetW, targetH, 10, (p) => {
        document.getElementById('rotateProgressFill').style.width = `${Math.round(p * 100)}%`;
        document.getElementById('rotateProgressLabel').textContent = `처리 중... ${Math.round(p * 100)}%`;
      });

      createResultPanel('Rotated GIF', blob, 'Rotated');
      backToGrid();
    } catch (err) {
      console.error(err);
      alert('Rotate 처리 중 오류가 발생했습니다.');
    } finally {
      goBtn.disabled = false;
    }
  });
}

/* =========================================================
   REVERSE
   ========================================================= */
function renderReversePanel() {
  toolOptions.innerHTML = `
    ${toolHeader('Reverse')}
    <p style="font-size:13px; color:#667085;">GIF 애니메이션을 역순으로 재생되도록 만듭니다.</p>
    <div class="progress-wrap" id="reverseProgressWrap">
      <div class="progress-bar-bg"><div class="progress-bar-fill" id="reverseProgressFill"></div></div>
      <div class="progress-label" id="reverseProgressLabel">처리 중...</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-back" id="reverseBackBtn">Back</button>
      <button class="btn btn-go" id="reverseGoBtn">Go!</button>
    </div>
  `;

  document.getElementById('reverseBackBtn').addEventListener('click', backToGrid);
  document.getElementById('reverseGoBtn').addEventListener('click', async () => {
    const goBtn = document.getElementById('reverseGoBtn');
    goBtn.disabled = true;
    document.getElementById('reverseProgressWrap').style.display = 'flex';

    try {
      const buf = await state.file.arrayBuffer();
      const { frames, width, height } = await decodeGifFrames(buf);
      const { composed, delays } = composeFrames(frames, width, height);

      const reversedComposed = [...composed].reverse();
      const reversedDelays = [...delays].reverse();

      const blob = await encodeGifWithProgress(reversedComposed, reversedDelays, width, height, 10, (p) => {
        document.getElementById('reverseProgressFill').style.width = `${Math.round(p * 100)}%`;
        document.getElementById('reverseProgressLabel').textContent = `처리 중... ${Math.round(p * 100)}%`;
      });

      createResultPanel('Reversed GIF', blob, 'Reversed');
      backToGrid();
    } catch (err) {
      console.error(err);
      alert('Reverse 처리 중 오류가 발생했습니다.');
    } finally {
      goBtn.disabled = false;
    }
  });
}

/* =========================================================
   SPEED
   ========================================================= */
function renderSpeedPanel() {
  const totalMs = state.info.totalDelayMs || 0;

  toolOptions.innerHTML = `
    ${toolHeader('Speed')}
    <p style="font-size:13px; color:#667085;">애니메이션 재생 속도를 조절합니다. (배율이 클수록 빠르게 재생)</p>

    <div class="speed-presets" id="speedPresets">
      <button class="speed-preset-btn" data-mult="0.25">0.25x</button>
      <button class="speed-preset-btn" data-mult="0.5">0.5x</button>
      <button class="speed-preset-btn active" data-mult="1">1x</button>
      <button class="speed-preset-btn" data-mult="1.5">1.5x</button>
      <button class="speed-preset-btn" data-mult="2">2x</button>
      <button class="speed-preset-btn" data-mult="3">3x</button>
      <button class="speed-preset-btn" data-mult="4">4x</button>
    </div>

    <div class="slider-row">
      <span class="axis-icon">⏱️</span>
      <input type="range" id="speedSlider" min="10" max="400" value="100">
      <span class="slider-value" id="speedVal">1.00x</span>
    </div>

    <div class="duration-compare">
      <span>Original: <b id="origDuration">${(totalMs / 1000).toFixed(2)}s</b></span>
      <span class="arrow">→</span>
      <span>New: <b id="newDuration">${(totalMs / 1000).toFixed(2)}s</b></span>
    </div>

    <div class="progress-wrap" id="speedProgressWrap">
      <div class="progress-bar-bg"><div class="progress-bar-fill" id="speedProgressFill"></div></div>
      <div class="progress-label" id="speedProgressLabel">처리 중...</div>
    </div>

    <div class="btn-row">
      <button class="btn btn-back" id="speedBackBtn">Back</button>
      <button class="btn btn-go" id="speedGoBtn">Go!</button>
    </div>
  `;

  const speedSlider = document.getElementById('speedSlider');
  const speedVal = document.getElementById('speedVal');
  const newDurationEl = document.getElementById('newDuration');

  function updateSpeedUI(mult) {
    speedVal.textContent = `${mult.toFixed(2)}x`;
    newDurationEl.textContent = `${(totalMs / mult / 1000).toFixed(2)}s`;
    document.querySelectorAll('.speed-preset-btn').forEach(b => {
      b.classList.toggle('active', Math.abs(Number(b.dataset.mult) - mult) < 0.001);
    });
  }

  speedSlider.addEventListener('input', () => {
    const mult = Number(speedSlider.value) / 100;
    updateSpeedUI(mult);
  });

  document.getElementById('speedPresets').addEventListener('click', (e) => {
    const btn = e.target.closest('.speed-preset-btn');
    if (!btn) return;
    const mult = Number(btn.dataset.mult);
    speedSlider.value = mult * 100;
    updateSpeedUI(mult);
  });

  document.getElementById('speedBackBtn').addEventListener('click', backToGrid);
  document.getElementById('speedGoBtn').addEventListener('click', async () => {
    const goBtn = document.getElementById('speedGoBtn');
    goBtn.disabled = true;
    document.getElementById('speedProgressWrap').style.display = 'flex';

    try {
      const multiplier = Number(speedSlider.value) / 100;

      const buf = await state.file.arrayBuffer();
      const { frames, width, height } = await decodeGifFrames(buf);
      const { composed, delays } = composeFrames(frames, width, height);

      // gifuct-js의 delay는 ms 단위. 배율 적용 후 최소 20ms로 clamp (GIF 표준 최소치 고려)
      const newDelays = delays.map((d) => Math.max(20, Math.round(d / multiplier)));

      const blob = await encodeGifWithProgress(composed, newDelays, width, height, 10, (p) => {
        document.getElementById('speedProgressFill').style.width = `${Math.round(p * 100)}%`;
        document.getElementById('speedProgressLabel').textContent = `처리 중... ${Math.round(p * 100)}%`;
      });

      createResultPanel('Speed-adjusted GIF', blob, 'Speed');
      backToGrid();
    } catch (err) {
      console.error(err);
      alert('Speed 처리 중 오류가 발생했습니다.');
    } finally {
      goBtn.disabled = false;
    }
  });
}

/* =========================================================
   FORMAT CONVERT (MP4 / JPG)
   ========================================================= */
function renderConvertPanel() {
  toolOptions.innerHTML = `
    ${toolHeader('Format Convert')}
    <div class="mode-cards" id="convertModeCards">
      <div class="mode-card" data-mode="mp4">
        <span class="mode-icon">🎬</span>
        MP4 Video
      </div>
      <div class="mode-card" data-mode="jpg">
        <span class="mode-icon">🖼️</span>
        JPG Image
      </div>
    </div>
    <div id="convertSubOptions"></div>
    <div class="progress-wrap" id="convertProgressWrap">
      <div class="progress-bar-bg"><div class="progress-bar-fill" id="convertProgressFill"></div></div>
      <div class="progress-label" id="convertProgressLabel">처리 중...</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-back" id="convertBackBtn">Back</button>
      <button class="btn btn-go" id="convertGoBtn" disabled>Go!</button>
    </div>
  `;

  let selectedMode = null;

  document.getElementById('convertModeCards').addEventListener('click', (e) => {
    const card = e.target.closest('.mode-card');
    if (!card) return;
    document.querySelectorAll('#convertModeCards .mode-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    selectedMode = card.dataset.mode;
    document.getElementById('convertGoBtn').disabled = false;
    renderSubOptions(selectedMode);
  });

  function renderSubOptions(mode) {
    const el = document.getElementById('convertSubOptions');
    if (mode === 'jpg') {
      el.innerHTML = `
        <div class="ratio-grid" style="margin-bottom:10px;">
          <button class="ratio-btn active" data-jpgmode="first">First frame only</button>
          <button class="ratio-btn" data-jpgmode="all">All frames (ZIP)</button>
        </div>
        <div class="slider-row">
          <span style="font-size:13px; width:70px;">Quality</span>
          <input type="range" id="jpgQuality" min="1" max="100" value="90">
          <span class="slider-value" id="jpgQualityVal">90</span>
        </div>
        <div class="field-row" style="margin-top:8px;">
          <label style="font-size:13px;">Background color</label>
          <input type="color" id="jpgBgColor" class="color-input" value="#ffffff">
        </div>
      `;
      let jpgMode = 'first';
      el.querySelectorAll('[data-jpgmode]').forEach(btn => {
        btn.addEventListener('click', () => {
          el.querySelectorAll('[data-jpgmode]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          jpgMode = btn.dataset.jpgmode;
        });
      });
      document.getElementById('jpgQuality').addEventListener('input', (e) => {
        document.getElementById('jpgQualityVal').textContent = e.target.value;
      });
      el.dataset.getJpgMode = 'stored'; // marker
      el._getJpgMode = () => jpgMode;
    } else if (mode === 'mp4') {
      el.innerHTML = `
        <div class="slider-row">
          <span style="font-size:13px; width:90px;">Frame rate</span>
          <input type="range" id="mp4Fps" min="5" max="30" value="15">
          <span class="slider-value" id="mp4FpsVal">15 fps</span>
        </div>
        <div class="note-box" style="margin-top:10px;">
          ⚠️ MP4 변환은 브라우저 내 동영상 인코딩 엔진(FFmpeg.wasm)을 사용합니다. 이 기능은 <b>http://</b> 또는 <b>https://</b> 로 페이지를 열었을 때만 정상 동작하며, 파일을 더블클릭해서 연 경우(file://)에는 동작하지 않을 수 있습니다.
        </div>
      `;
      document.getElementById('mp4Fps').addEventListener('input', (e) => {
        document.getElementById('mp4FpsVal').textContent = `${e.target.value} fps`;
      });
    }
  }

  document.getElementById('convertBackBtn').addEventListener('click', backToGrid);
  document.getElementById('convertGoBtn').addEventListener('click', async () => {
    const goBtn = document.getElementById('convertGoBtn');
    goBtn.disabled = true;
    document.getElementById('convertProgressWrap').style.display = 'flex';

    try {
      if (selectedMode === 'jpg') {
        await handleJpgConvert();
      } else if (selectedMode === 'mp4') {
        await handleMp4Convert();
      }
      backToGrid();
    } catch (err) {
      console.error(err);
      alert('변환 중 오류가 발생했습니다.');
    } finally {
      goBtn.disabled = false;
    }
  });

  async function handleJpgConvert() {
    const el = document.getElementById('convertSubOptions');
    const jpgMode = el._getJpgMode ? el._getJpgMode() : 'first';
    const quality = Number(document.getElementById('jpgQuality').value) / 100;
    const bgColor = document.getElementById('jpgBgColor').value;

    const buf = await state.file.arrayBuffer();
    const { frames, width, height } = await decodeGifFrames(buf);
    const { composed } = composeFrames(frames, width, height);

    function toJpgBlob(imgData) {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      const tmp = document.createElement('canvas');
      tmp.width = width; tmp.height = height;
      tmp.getContext('2d').putImageData(imgData, 0, 0);
      ctx.drawImage(tmp, 0, 0);
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    }

    if (jpgMode === 'first') {
      const blob = await toJpgBlob(composed[0]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Converted.${state.fileName.replace(/\.gif$/i, '')}.jpg`;
      a.click();
      document.getElementById('convertProgressFill').style.width = '100%';
    } else {
      const zip = new JSZip();
      for (let i = 0; i < composed.length; i++) {
        const blob = await toJpgBlob(composed[i]);
        zip.file(`frame_${String(i + 1).padStart(3, '0')}.jpg`, blob);
        const pct = Math.round(((i + 1) / composed.length) * 100);
        document.getElementById('convertProgressFill').style.width = `${pct}%`;
        document.getElementById('convertProgressLabel').textContent = `프레임 변환 중... ${pct}%`;
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Converted.${state.fileName.replace(/\.gif$/i, '')}.zip`;
      a.click();
    }
  }

  async function handleMp4Convert() {
    const fps = Number(document.getElementById('mp4Fps').value);

    const { FFmpeg } = window.FFmpegWASM;
    const { fetchFile } = window.FFmpegUtil;
    const ffmpeg = new FFmpeg();

    ffmpeg.on('progress', ({ progress }) => {
      const pct = Math.round(progress * 100);
      document.getElementById('convertProgressFill').style.width = `${pct}%`;
      document.getElementById('convertProgressLabel').textContent = `인코딩 중... ${pct}%`;
    });

    await ffmpeg.load();

    const buf = await state.file.arrayBuffer();
    const { frames, width, height } = await decodeGifFrames(buf);
    const { composed } = composeFrames(frames, width, height);

    for (let i = 0; i < composed.length; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').putImageData(composed[i], 0, 0);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const arrBuf = await blob.arrayBuffer();
      await ffmpeg.writeFile(`frame_${String(i).padStart(4, '0')}.png`, new Uint8Array(arrBuf));
    }

    await ffmpeg.exec([
      '-framerate', String(fps),
      '-i', 'frame_%04d.png',
      '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      'output.mp4'
    ]);

    const data = await ffmpeg.readFile('output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    createResultPanel('Converted MP4', blob, 'Converted');
  }
}

/* =========================================================
   OPTIMIZE
   ========================================================= */
function renderOptimizePanel() {
  toolOptions.innerHTML = `
    ${toolHeader('Optimize')}
    <p style="font-size:13px; color:#667085;">gifsicle 엔진을 사용해 화질 손실 없이(무손실) 용량을 최적화합니다.</p>

    <div class="ratio-grid" id="optLevelGrid">
      <button class="ratio-btn" data-level="1">Basic (-O1)</button>
      <button class="ratio-btn" data-level="2">Balanced (-O2)</button>
      <button class="ratio-btn active" data-level="3">Maximum (-O3)</button>
    </div>

    <label class="checkbox-row"><input type="checkbox" id="chkLossy"> 추가 압축 사용 (약간의 화질 손실 감수)</label>
    <div class="sub-option" id="lossyOptions" style="display:none;">
      <div class="slider-row">
        <span style="font-size:13px; width:110px;">Lossy strength</span>
        <input type="range" id="lossySlider" min="1" max="200" value="30">
        <span class="slider-value" id="lossyVal">30</span>
      </div>
      <label class="checkbox-row" style="margin-top:8px;"><input type="checkbox" id="chkColors"> 색상 팔레트 제한</label>
      <div class="field-row" id="colorsRow" style="display:none; margin-top:6px;">
        <input type="number" id="colorsCount" value="256" min="2" max="256"> 색
      </div>
    </div>

    <div class="progress-wrap" id="optProgressWrap">
      <div class="progress-bar-bg"><div class="progress-bar-fill" id="optProgressFill"></div></div>
      <div class="progress-label" id="optProgressLabel">처리 중...</div>
    </div>
    <div class="result-summary" id="optSummary" style="display:none;"></div>

    <div class="btn-row">
      <button class="btn btn-back" id="optBackBtn">Back</button>
      <button class="btn btn-go" id="optGoBtn">Go!</button>
    </div>
  `;

  let level = 3;
  document.getElementById('optLevelGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.ratio-btn');
    if (!btn) return;
    document.querySelectorAll('#optLevelGrid .ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    level = Number(btn.dataset.level);
  });

  document.getElementById('chkLossy').addEventListener('change', (e) => {
    document.getElementById('lossyOptions').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('lossySlider').addEventListener('input', (e) => {
    document.getElementById('lossyVal').textContent = e.target.value;
  });
  document.getElementById('chkColors').addEventListener('change', (e) => {
    document.getElementById('colorsRow').style.display = e.target.checked ? 'flex' : 'none';
  });

  document.getElementById('optBackBtn').addEventListener('click', backToGrid);
  document.getElementById('optGoBtn').addEventListener('click', async () => {
    const goBtn = document.getElementById('optGoBtn');
    goBtn.disabled = true;
    document.getElementById('optProgressWrap').style.display = 'flex';
    document.getElementById('optProgressFill').style.width = '30%';
    document.getElementById('optProgressLabel').textContent = '최적화 중...';

    try {
      const useLossy = document.getElementById('chkLossy').checked;
      const lossyVal = Number(document.getElementById('lossySlider').value);
      const useColors = document.getElementById('chkColors').checked;
      const colorsVal = Number(document.getElementById('colorsCount').value);

      const args = [`-O${level}`];
      if (useLossy) args.push(`--lossy=${lossyVal}`);
      if (useColors) args.push(`--colors=${colorsVal}`);
      args.push('input.gif', '-o', '/out/output.gif');

      const gifsicle = window.gifsicle || (await import('https://cdn.jsdelivr.net/npm/gifsicle-wasm-browser@1.0.6/dist/index.js')).default;

      const result = await gifsicle.run({
        input: [{ file: state.file, name: 'input.gif' }],
        command: [args.join(' ')]
      });

      document.getElementById('optProgressFill').style.width = '100%';

      const blob = result[0];
      const originalSize = state.file.size;
      const newSize = blob.size;
      const reduction = (((originalSize - newSize) / originalSize) * 100).toFixed(1);

      const summary = document.getElementById('optSummary');
      summary.style.display = 'block';
      summary.textContent = `Original ${formatBytes(originalSize)} → Optimized ${formatBytes(newSize)} (▼ ${reduction}% 감소)`;

      createResultPanel('Optimized GIF', blob, 'Optimized');
    } catch (err) {
      console.error(err);
      alert('Optimize 처리 중 오류가 발생했습니다. (네트워크 연결을 확인해주세요)');
    } finally {
      goBtn.disabled = false;
    }
  });
}
