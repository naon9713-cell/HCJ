const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const fileList = document.getElementById('fileList');
const settingsPanel = document.getElementById('settingsPanel');
const applyBtn = document.getElementById('applyBtn');
const bulkDownloadBtn = document.getElementById('bulkDownloadBtn');

const ratioButtons = document.querySelectorAll('.ratio-btn:not(#customRatioBtn)');
const customRatioBtn = document.getElementById('customRatioBtn');
const customRatioInputs = document.getElementById('customRatioInputs');
const customW = document.getElementById('customW');
const customH = document.getElementById('customH');

const paddingModeBtn = document.getElementById('paddingModeBtn');
const cropModeBtn = document.getElementById('cropModeBtn');
const colorGroup = document.getElementById('colorGroup');
const padColorInput = document.getElementById('padColor');
const colorValueText = document.getElementById('colorValueText');

let isCustomRatio = false;
let selectedMode = 'padding'; // 'padding' | 'crop'
let filesData = []; // { id, file, name, itemEl, progressFill, statusText, downloadBtn, blob, done }

/* ---------------- 업로드 처리 ---------------- */
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

function handleFiles(fileArr) {
    Array.from(fileArr).forEach(file => {
        if (!file.type.startsWith('image/')) {
            alert(file.name + ' : 이미지 파일만 업로드할 수 있습니다.');
            return;
        }
        addFileItem(file);
    });
    if (filesData.length > 0) {
        settingsPanel.classList.add('show');
    }
    updateBulkButtonState();
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function addFileItem(file) {
    const id = 'f' + Date.now() + Math.random().toString(36).slice(2, 8);
    const thumbURL = URL.createObjectURL(file);

    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
    <img class="file-thumb" src="${thumbURL}" alt="thumb">
    <div class="file-info">
      <div class="file-name">${file.name}</div>
      <div class="file-meta">${formatBytes(file.size)}</div>
      <div class="progress-bar-bg"><div class="progress-bar-fill"></div></div>
      <div class="status-text">대기 중...</div>
    </div>
    <button class="download-btn" type="button">다운로드</button>
  `;
    fileList.appendChild(item);

    const fileObj = {
        id,
        file,
        name: file.name,
        itemEl: item,
        progressFill: item.querySelector('.progress-bar-fill'),
        statusText: item.querySelector('.status-text'),
        downloadBtn: item.querySelector('.download-btn'),
        blob: null,
        done: false
    };

    filesData.push(fileObj);
}

/* ---------------- 비율 선택 ---------------- */
ratioButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        ratioButtons.forEach(b => b.classList.remove('active'));
        customRatioBtn.classList.remove('active');
        btn.classList.add('active');
        isCustomRatio = false;
        customRatioInputs.classList.remove('show');
    });
});

customRatioBtn.addEventListener('click', () => {
    ratioButtons.forEach(b => b.classList.remove('active'));
    customRatioBtn.classList.add('active');
    isCustomRatio = true;
    customRatioInputs.classList.add('show');
});

function getSelectedRatio() {
    if (isCustomRatio) {
        const w = parseFloat(customW.value) || 1;
        const h = parseFloat(customH.value) || 1;
        return { w, h };
    }
    const activeBtn = document.querySelector('.ratio-btn.active');
    return {
        w: parseFloat(activeBtn.dataset.w),
        h: parseFloat(activeBtn.dataset.h)
    };
}

/* ---------------- 모드 선택 (Padding / Crop) ---------------- */
paddingModeBtn.addEventListener('click', () => {
    selectedMode = 'padding';
    paddingModeBtn.classList.add('active');
    cropModeBtn.classList.remove('active');
    colorGroup.classList.add('show');
});
cropModeBtn.addEventListener('click', () => {
    selectedMode = 'crop';
    cropModeBtn.classList.add('active');
    paddingModeBtn.classList.remove('active');
    colorGroup.classList.remove('show');
});

padColorInput.addEventListener('input', () => {
    colorValueText.textContent = padColorInput.value.toUpperCase();
});

/* ---------------- 변환 시작 ---------------- */
applyBtn.addEventListener('click', () => {
    if (filesData.length === 0) {
        alert('먼저 이미지를 업로드해주세요.');
        return;
    }
    if (typeof JSZip === 'undefined') {
        alert('압축 라이브러리(jszip.min.js)를 찾을 수 없습니다.\nindex.html과 같은 폴더에 jszip.min.js 파일이 있는지 확인해주세요.');
    }

    const ratio = getSelectedRatio();
    const mode = selectedMode;
    const padColor = padColorInput.value;

    filesData.forEach(fileObj => {
        fileObj.done = false;
        fileObj.blob = null;
        fileObj.downloadBtn.classList.remove('active');
        fileObj.downloadBtn.disabled = true;
        fileObj.progressFill.classList.remove('done');
        fileObj.progressFill.style.width = '0%';
        fileObj.progressFill.style.background = '';
        processImage(fileObj, ratio, mode, padColor);
    });

    updateBulkButtonState();
});

/* ---------------- 이미지 처리 (Canvas 기반) ---------------- */
function processImage(fileObj, ratio, mode, padColor) {
    const { file, progressFill, statusText, downloadBtn } = fileObj;
    const setProgress = (pct) => { progressFill.style.width = pct + '%'; };

    statusText.textContent = '이미지 불러오는 중...';
    setProgress(10);

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
        setProgress(35);
        statusText.textContent = '캔버스 계산 중...';

        setTimeout(() => {
            const imgW = img.naturalWidth;
            const imgH = img.naturalHeight;
            const ratioValue = ratio.w / ratio.h;

            const base = Math.max(imgW, imgH);
            let canvasW, canvasH;
            if (ratioValue >= 1) {
                canvasW = Math.round(base);
                canvasH = Math.round(base / ratioValue);
            } else {
                canvasH = Math.round(base);
                canvasW = Math.round(base * ratioValue);
            }

            const canvas = document.createElement('canvas');
            canvas.width = canvasW;
            canvas.height = canvasH;
            const ctx = canvas.getContext('2d');

            setProgress(60);
            statusText.textContent = mode === 'padding' ? '여백 추가 중...' : '이미지 자르는 중...';

            if (mode === 'padding') {
                ctx.fillStyle = padColor;
                ctx.fillRect(0, 0, canvasW, canvasH);

                const scale = Math.min(canvasW / imgW, canvasH / imgH);
                const drawW = imgW * scale;
                const drawH = imgH * scale;
                const dx = (canvasW - drawW) / 2;
                const dy = (canvasH - drawH) / 2;
                ctx.drawImage(img, dx, dy, drawW, drawH);
            } else {
                const scale = Math.max(canvasW / imgW, canvasH / imgH);
                const drawW = imgW * scale;
                const drawH = imgH * scale;
                const dx = (canvasW - drawW) / 2;
                const dy = (canvasH - drawH) / 2;
                ctx.drawImage(img, dx, dy, drawW, drawH);
            }

            setProgress(85);
            statusText.textContent = '이미지 인코딩 중...';

            let mime = file.type;
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
                mime = 'image/png';
            }
            const quality = (mime === 'image/jpeg' || mime === 'image/webp') ? 0.92 : undefined;

            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);

                if (!blob) {
                    statusText.textContent = '오류: 인코딩에 실패했습니다.';
                    progressFill.style.background = '#E4574C';
                    return;
                }

                fileObj.blob = blob;
                fileObj.done = true;

                setProgress(100);
                progressFill.classList.add('done');
                statusText.textContent = '완료 ✅';

                downloadBtn.classList.add('active');
                downloadBtn.disabled = false;
                downloadBtn.onclick = () => {
                    const dlUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = dlUrl;
                    a.download = 'resized_' + file.name;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(dlUrl);
                };

                updateBulkButtonState();
            }, mime, quality);

        }, 200);
    };

    img.onerror = () => {
        URL.revokeObjectURL(url);
        statusText.textContent = '오류: 이미지를 불러올 수 없습니다.';
        progressFill.style.background = '#E4574C';
    };

    img.src = url;
}

/* ---------------- 일괄 다운로드 (ZIP) ---------------- */
function updateBulkButtonState() {
    const allDone = filesData.length > 0 && filesData.every(f => f.done);
    bulkDownloadBtn.disabled = !allDone;
}

bulkDownloadBtn.addEventListener('click', async () => {
    if (bulkDownloadBtn.disabled) return;

    if (typeof JSZip === 'undefined') {
        alert('압축 라이브러리(jszip.min.js)를 찾을 수 없습니다.\nindex.html과 같은 폴더에 jszip.min.js 파일이 있는지 확인해주세요.');
        return;
    }

    bulkDownloadBtn.disabled = true;
    bulkDownloadBtn.textContent = '⏳ 압축 중...';

    try {
        const zip = new JSZip();
        filesData.forEach(fileObj => {
            if (fileObj.blob) {
                zip.file('resized_' + fileObj.name, fileObj.blob);
            }
        });

        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'resized_images.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error(err);
        alert('ZIP 생성 중 오류가 발생했습니다.');
    } finally {
        bulkDownloadBtn.textContent = '📦 전체 ZIP 다운로드';
        bulkDownloadBtn.disabled = false;
    }
});