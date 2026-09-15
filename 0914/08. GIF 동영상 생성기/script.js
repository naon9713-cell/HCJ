// ===== 로고 이미지 없을 시 숨김 처리 =====
const logoImg = document.getElementById('logoImg');
logoImg.addEventListener('error', () => {
  logoImg.style.display = 'none';
});

// ===== 요소 참조 =====
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const fileList = document.getElementById('fileList');
const hiddenVideo = document.getElementById('hiddenVideo');
const hiddenCanvas = document.getElementById('hiddenCanvas');
const ctx = hiddenCanvas.getContext('2d');

const widthInput = document.getElementById('widthInput');
const durationInput = document.getElementById('durationInput');
const fpsInput = document.getElementById('fpsInput');

const MAX_FPS = 29;

// ===== 업로드 버튼 & 드래그앤드롭 이벤트 =====
uploadBtn.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('click', (e) => {
  if (e.target === uploadBtn) return;
  fileInput.click();
});

['dragenter', 'dragover'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
  handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  handleFiles(files);
  fileInput.value = '';
});

// ===== 파일 처리 진입점 =====
function handleFiles(files) {
  files.forEach(file => {
    const item = createFileItem(file);
    processVideoToGif(file, item);
  });
}

// ===== 파일 목록 UI 아이템 생성 =====
function createFileItem(file) {
  const wrapper = document.createElement('div');
  wrapper.className = 'file-item';

  const thumb = document.createElement('video');
  thumb.className = 'file-thumb';
  thumb.src = URL.createObjectURL(file);
  thumb.muted = true;
  thumb.playsInline = true;

  const info = document.createElement('div');
  info.className = 'file-info';

  const name = document.createElement('div');
  name.className = 'file-name';
  name.textContent = file.name;

  const track = document.createElement('div');
  track.className = 'progress-track';
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  track.appendChild(fill);

  const label = document.createElement('div');
  label.className = 'progress-label';
  label.textContent = '대기 중...';

  info.appendChild(name);
  info.appendChild(track);
  info.appendChild(label);

  const actions = document.createElement('div');
  actions.className = 'file-actions';
  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'download-btn';
  downloadBtn.textContent = '다운로드';
  actions.appendChild(downloadBtn);

  wrapper.appendChild(thumb);
  wrapper.appendChild(info);
  wrapper.appendChild(actions);
  fileList.appendChild(wrapper);

  return { wrapper, fill, label, downloadBtn, fileName: file.name };
}

function updateProgress(item, percent, text) {
  const p = Math.min(100, Math.max(0, percent));
  item.fill.style.width = p + '%';
  item.label.textContent = text || `${Math.round(p)}%`;
}

function enableDownload(item, blob, fileName) {
  item.downloadBtn.classList.add('active');
  item.downloadBtn.onclick = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.[^/.]+$/, '') + '.gif';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
}

// ===== 동영상 -> GIF 변환 메인 로직 =====
function processVideoToGif(file, item) {
  const targetWidth = parseInt(widthInput.value) || 320;
  const userDuration = parseFloat(durationInput.value) || 0;
  let fps = parseInt(fpsInput.value) || 15;
  fps = Math.min(fps, MAX_FPS); // FPS 29 제한

  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;

  video.addEventListener('loadedmetadata', () => {
    const totalDuration = userDuration > 0 ? Math.min(userDuration, video.duration) : video.duration;
    const scale = targetWidth / video.videoWidth;
    const targetHeight = Math.round(video.videoHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');

    const frameInterval = 1 / fps;
    const totalFrames = Math.floor(totalDuration * fps);
    let currentFrame = 0;
    const frames = [];

    updateProgress(item, 0, '프레임 추출 중...');

    function captureNextFrame() {
      if (currentFrame >= totalFrames) {
        encodeGif(frames, targetWidth, targetHeight, fps, item, file.name);
        return;
      }
      const t = currentFrame * frameInterval;
      video.currentTime = t;
    }

    video.addEventListener('seeked', function onSeeked() {
      context.drawImage(video, 0, 0, targetWidth, targetHeight);
      frames.push(context.getImageData(0, 0, targetWidth, targetHeight));
      currentFrame++;

      const captureProgress = (currentFrame / totalFrames) * 50; // 0~50%
      updateProgress(item, captureProgress, `프레임 추출 중... ${currentFrame}/${totalFrames}`);

      captureNextFrame();
    });

    captureNextFrame();
  });

  video.addEventListener('error', () => {
    updateProgress(item, 0, '오류: 파일을 읽을 수 없습니다');
  });
}

// ===== GIF 인코딩 =====
function encodeGif(frames, width, height, fps, item, fileName) {
  updateProgress(item, 50, 'GIF 인코딩 중...');

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: width,
    height: height,
    workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
  });

  const delay = Math.round(1000 / fps);

  frames.forEach(frameData => {
    gif.addFrame(frameData, { delay: delay });
  });

  gif.on('progress', (p) => {
    const encodeProgress = 50 + p * 50; // 50~100%
    updateProgress(item, encodeProgress, `GIF 인코딩 중... ${Math.round(p * 100)}%`);
  });

  gif.on('finished', (blob) => {
    updateProgress(item, 100, '완료!');
    enableDownload(item, blob, fileName);
    checkAllDone();
  });

  gif.render();
}

// ===== 전체 완료 체크 (필요 시 확장 가능) =====
function checkAllDone() {
  const allBtns = document.querySelectorAll('.download-btn');
  const allActive = Array.from(allBtns).every(btn => btn.classList.contains('active'));
  if (allActive && allBtns.length > 0) {
    console.log('모든 GIF 변환이 완료되었습니다.');
  }
}
