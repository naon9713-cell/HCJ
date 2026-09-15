const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const fileList = document.getElementById('fileList');

const DOC_EXTS = ['doc', 'docx', 'ppt', 'pptx'];
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
const PDF_EXT = 'pdf';
const HWP_EXTS = ['hwp', 'hwpx'];
const ALLOWED_EXTS = [...DOC_EXTS, ...IMAGE_EXTS, PDF_EXT];

const ZIP_BASED = ['docx', 'pptx'];
const LEGACY_BINARY = ['doc', 'ppt'];

// PDF 저화질 스캔본 압축 설정
const PDF_RENDER_SCALE = 1.0;   // 1.0 = 원본 페이지 크기(72dpi) 그대로 캡처 → 이미 저해상도 효과
const PDF_JPEG_QUALITY = 0.5;   // JPEG 품질 50% → 스캔본 느낌의 화질 저하

uploadBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.remove('dragover');
  });
});
dropzone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  if (dt && dt.files) handleFiles(dt.files);
});

const badgeClass = (ext) => {
  if (ext === 'pdf') return 'pdf';
  if (ext === 'ppt' || ext === 'pptx') return 'ppt';
  if (ext === 'doc' || ext === 'docx') return 'doc';
  if (IMAGE_EXTS.includes(ext)) return 'img';
  return 'doc';
};

function getExt(name) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function handleFiles(fileArr) {
  Array.from(fileArr).forEach(file => {
    const ext = getExt(file.name);

    // ✅ HWP는 별도 안내만 하고 업로드 자체를 막음
    if (HWP_EXTS.includes(ext)) {
      alert(
        'HWP 파일은 지원되지 않습니다.\n' +
        'PDF 또는 Word(DOC/DOCX) 파일로 변환한 후 다시 업로드해주세요.'
      );
      return;
    }

    if (!ALLOWED_EXTS.includes(ext)) {
      alert(file.name + ' : 지원하지 않는 파일 형식입니다.\nPDF, 워드, PPT, 이미지 파일만 업로드 가능합니다.');
      return;
    }

    addFileItem(file, ext);
  });
}

function addFileItem(file, ext) {
  const item = document.createElement('div');
  item.className = 'file-item';
  item.innerHTML = `
    <div class="file-badge ${badgeClass(ext)}">${ext.toUpperCase()}</div>
    <div class="file-info">
      <div class="file-name">${file.name}</div>
      <div class="file-meta">${formatBytes(file.size)}</div>
      <div class="progress-bar-bg"><div class="progress-bar-fill"></div></div>
      <div class="status-text">대기 중...</div>
    </div>
    <button class="download-btn" type="button">다운로드</button>
  `;
  fileList.appendChild(item);

  const fill = item.querySelector('.progress-bar-fill');
  const statusText = item.querySelector('.status-text');
  const downloadBtn = item.querySelector('.download-btn');

  const setProgress = (pct) => {
    fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
  };

  processFile(file, ext, setProgress, statusText)
    .then(result => {
      setProgress(100);
      fill.classList.add('done');
      const savedPct = result.originalSize > 0
        ? Math.round((1 - result.blob.size / result.originalSize) * 100)
        : 0;
      if (result.kept) {
        statusText.textContent = '원본 유지 (안전한 재압축 불가 형식)';
      } else if (savedPct > 0) {
        statusText.textContent = `완료 · ${savedPct}% 절감 (${formatBytes(result.blob.size)})`;
      } else {
        statusText.textContent = `완료 · 처리됨 (${formatBytes(result.blob.size)})`;
      }
      downloadBtn.classList.add('active');
      downloadBtn.disabled = false;
      downloadBtn.addEventListener('click', () => {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'compressed_' + file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    })
    .catch(err => {
      console.error(err);
      statusText.textContent = '오류 발생: 압축 실패';
      fill.style.background = '#E4574C';
    });
}

async function processFile(file, ext, setProgress, statusText) {
  const originalSize = file.size;
  statusText.textContent = '분석 중...';
  setProgress(5);

  if (ext === PDF_EXT) {
    return await compressPdfAsScan(file, setProgress, statusText);
  }

  if (IMAGE_EXTS.includes(ext)) {
    statusText.textContent = '이미지 압축 중...';
    return await compressImage(file, ext, setProgress);
  }

  if (ZIP_BASED.includes(ext)) {
    statusText.textContent = '재압축 중 (ZIP 구조 최적화)...';
    const buf = await file.arrayBuffer();
    setProgress(15);
    try {
      const zip = await JSZip.loadAsync(buf);
      const blob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } },
        (meta) => { setProgress(15 + meta.percent * 0.75); }
      );
      setProgress(95);
      if (blob.size >= originalSize) {
        return { blob: new Blob([buf]), originalSize, kept: false };
      }
      return { blob, originalSize, kept: false };
    } catch (e) {
      const blob = new Blob([buf]);
      return { blob, originalSize, kept: true };
    }
  }

  if (LEGACY_BINARY.includes(ext)) {
    statusText.textContent = '구형 바이너리 형식 - 안전 모드로 처리 중...';
    const buf = await file.arrayBuffer();
    for (let p = 10; p <= 90; p += 20) {
      await new Promise(r => setTimeout(r, 150));
      setProgress(p);
    }
    const blob = new Blob([buf]);
    return { blob, originalSize, kept: true };
  }

  const buf = await file.arrayBuffer();
  return { blob: new Blob([buf]), originalSize, kept: true };
}

// ✅ PDF: 모든 페이지를 캡처(렌더링) → 저화질 JPEG로 압축 → 새 PDF로 재조립 (저화질 스캔본 효과)
async function compressPdfAsScan(file, setProgress, statusText) {
  const originalSize = file.size;
  const buf = await file.arrayBuffer();

  statusText.textContent = 'PDF 분석 중...';
  const loadingTask = pdfjsLib.getDocument({ data: buf.slice(0) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const newPdfDoc = await PDFLib.PDFDocument.create();

  for (let i = 1; i <= numPages; i++) {
    statusText.textContent = `페이지 캡처 및 압축 중... (${i}/${numPages})`;

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;

    // 저화질 JPEG로 변환 (스캔본 효과)
    const jpegDataUrl = canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY);
    const jpegBytes = dataUrlToUint8Array(jpegDataUrl);

    const embeddedImg = await newPdfDoc.embedJpg(jpegBytes);
    const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
    newPage.drawImage(embeddedImg, {
      x: 0, y: 0,
      width: viewport.width,
      height: viewport.height
    });

    // 페이지별 진행률 반영 (5% ~ 90% 구간 사용)
    setProgress(5 + (i / numPages) * 85);
  }

  statusText.textContent = 'PDF 재조립 중...';
  const newPdfBytes = await newPdfDoc.save();
  setProgress(95);

  const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
  return { blob, originalSize, kept: false };
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) { bytes[i] = binary.charCodeAt(i); }
  return bytes;
}

// ✅ 이미지 압축 (Canvas API)
function compressImage(file, ext, setProgress) {
  return new Promise((resolve) => {
    const originalSize = file.size;

    if (ext === 'gif' || ext === 'bmp') {
      setProgress(90);
      resolve({ blob: file, originalSize, kept: true });
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      setProgress(30);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      setProgress(60);

      let mime, quality;
      if (ext === 'jpg' || ext === 'jpeg') { mime = 'image/jpeg'; quality = 0.8; }
      else if (ext === 'webp') { mime = 'image/webp'; quality = 0.8; }
      else if (ext === 'png') { mime = 'image/png'; quality = undefined; }
      else { mime = file.type || 'image/jpeg'; quality = 0.8; }

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        setProgress(90);
        if (!blob) {
          resolve({ blob: file, originalSize, kept: true });
          return;
        }
        if (blob.size < originalSize) {
          resolve({ blob, originalSize, kept: false });
        } else {
          resolve({ blob: file, originalSize, kept: true });
        }
      }, mime, quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ blob: file, originalSize, kept: true });
    };

    img.src = url;
  });
}