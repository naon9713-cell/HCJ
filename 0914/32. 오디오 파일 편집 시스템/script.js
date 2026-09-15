'use strict';

/* ============================================================
   순수 로직 함수 (DOM에 의존하지 않아 Node.js로 독립 테스트 가능)
   ============================================================ */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// 초 -> "M:SS.d" 형식 문자열
function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

// 트림 시작/끝(초) -> 샘플 인덱스로 변환 (범위를 벗어나면 clamp, 뒤바뀌면 자동 교정)
function computeTrimSamples(sampleRate, totalSamples, startSec, endSec) {
  let startSample = Math.round(startSec * sampleRate);
  let endSample = Math.round(endSec * sampleRate);
  startSample = clamp(startSample, 0, totalSamples);
  endSample = clamp(endSample, 0, totalSamples);
  if (endSample < startSample) {
    const tmp = startSample;
    startSample = endSample;
    endSample = tmp;
  }
  return { startSample, endSample };
}

// 게인 적용 + 클리핑 방지(하드 클램프). clipped 발생 여부도 함께 반환
function applyGainSample(sample, gain) {
  const v = sample * gain;
  const clamped = clamp(v, -1, 1);
  return { value: clamped, clipped: clamped !== v };
}

// 여러 채널의 원본 데이터에서 최대 절댓값 진폭을 계산 (클리핑 경고용 사전 분석)
function computeMaxAbsAmplitude(channelDataArrays) {
  let max = 0;
  for (const arr of channelDataArrays) {
    for (let i = 0; i < arr.length; i++) {
      const a = Math.abs(arr[i]);
      if (a > max) max = a;
    }
  }
  return max;
}

// 특정 볼륨(gain)에서 클리핑이 발생할지 사전 계산된 최대진폭으로 판단
function willClip(maxAmplitude, gain) {
  return maxAmplitude * gain > 1.0001; // 부동소수 오차 허용
}

// float32 PCM(-1~1) 배열 -> 16bit little-endian 인터리브 버퍼에 기록
function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = clamp(input[i], -1, 1);
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// 여러 채널의 float32 데이터를 표준 WAV(PCM16) ArrayBuffer로 인코딩
function encodeWAV(channelData, sampleRate) {
  const numChannels = channelData.length;
  const numFrames = channelData[0].length;

  // 채널 인터리브
  const interleaved = new Float32Array(numFrames * numChannels);
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      interleaved[frame * numChannels + ch] = channelData[ch][frame];
    }
  }

  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = interleaved.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          // fmt chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);          // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  floatTo16BitPCM(view, 44, interleaved);

  return buffer;
}

// float32(-1~1) -> Int16 샘플 배열 (lamejs 입력용)
function floatToInt16Array(float32arr) {
  const out = new Int16Array(float32arr.length);
  for (let i = 0; i < float32arr.length; i++) {
    const s = clamp(float32arr[i], -1, 1);
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// 노드/브라우저 모두에서 테스트 가능하도록 export (Node에서 require될 때만 동작)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    clamp, formatTime, computeTrimSamples, applyGainSample,
    computeMaxAbsAmplitude, willClip, floatTo16BitPCM, encodeWAV,
    floatToInt16Array
  };
}

/* ============================================================
   브라우저 전용 코드 (DOM / Web Audio API 사용)
   ============================================================ */

if (typeof window !== 'undefined') {
(function () {

  // ---------- 상태 ----------
  const state = {
    file: null,
    audioBuffer: null,      // 원본 디코딩된 AudioBuffer
    duration: 0,
    trimStart: 0,
    trimEnd: 0,
    volume: 1.0,            // 0.0 ~ 2.0
    maxAmplitude: 0,
    seekTime: 0,
    format: 'wav',
    mp3Bitrate: 192,
    isDraggingHandle: null, // 'start' | 'end' | null
    playback: {
      sourceNode: null,
      gainNode: null,
      isPlaying: false,
      startedAt: 0,         // audioContext.currentTime 기준
      playFrom: 0,
      playUntil: 0,
      rafId: null
    },
    exportObjectUrl: null
  };

  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const dropzone = $('dropzone');
  const fileInput = $('file-input');
  const uploadError = $('upload-error');

  const screens = {
    upload: $('upload-screen'),
    loading: $('loading-screen'),
    editor: $('editor-screen'),
    exportS: $('export-screen'),
    done: $('done-screen')
  };

  const fileNameEl = $('file-name');
  const fileMetaEl = $('file-meta');
  const btnReset = $('btn-reset');

  const canvas = $('waveform');
  const trimOverlay = $('trim-overlay');
  const trimRegion = $('trim-region');
  const handleStart = $('handle-start');
  const handleEnd = $('handle-end');
  const playheadEl = $('playhead');

  const trimStartLabel = $('trim-start-label');
  const trimEndLabel = $('trim-end-label');
  const trimDurationLabel = $('trim-duration-label');
  const btnResetTrim = $('btn-reset-trim');

  const btnPlayFull = $('btn-play-full');
  const btnPlaySelection = $('btn-play-selection');
  const btnStop = $('btn-stop');

  const volumeSlider = $('volume-slider');
  const volumeLabel = $('volume-label');
  const clippingWarning = $('clipping-warning');

  const formatRadios = document.querySelectorAll('input[name="format"]');
  const mp3BitrateRow = $('mp3-bitrate-row');
  const mp3BitrateSelect = $('mp3-bitrate');

  const btnExport = $('btn-export');
  const exportStatus = $('export-status');
  const exportProgress = $('export-progress');

  const doneFileInfo = $('done-file-info');
  const doneAudioPreview = $('done-audio-preview');
  const btnDownload = $('btn-download');
  const btnEditMore = $('btn-edit-more');
  const btnNewFile = $('btn-new-file');

  function showScreen(name) {
    Object.values(screens).forEach((el) => { el.hidden = true; });
    screens[name].hidden = false;
  }

  function showUploadError(msg) {
    uploadError.textContent = msg;
    uploadError.hidden = false;
  }
  function clearUploadError() {
    uploadError.hidden = true;
  }

  // ---------- 파일 업로드 ----------
  const ACCEPTED_EXT = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
  const MAX_SIZE = 100 * 1024 * 1024;

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    clearUploadError();
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_EXT.includes(ext) && !file.type.startsWith('audio/')) {
      showUploadError('지원하지 않는 파일 형식입니다. MP3, WAV, OGG, M4A, AAC, FLAC 파일을 업로드해주세요.');
      return;
    }
    if (file.size > MAX_SIZE) {
      showUploadError('파일 용량이 너무 큽니다. 100MB 이하 파일을 업로드해주세요.');
      return;
    }
    loadAudioFile(file);
  }

  function loadAudioFile(file) {
    showScreen('loading');
    state.file = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      getAudioContext().decodeAudioData(
        e.target.result.slice(0),
        (buffer) => {
          onAudioDecoded(buffer);
        },
        (err) => {
          console.error(err);
          showScreen('upload');
          showUploadError('오디오 파일을 해석할 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.');
        }
      );
    };
    reader.onerror = () => {
      showScreen('upload');
      showUploadError('파일을 읽는 중 오류가 발생했습니다.');
    };
    reader.readAsArrayBuffer(file);
  }

  function onAudioDecoded(buffer) {
    state.audioBuffer = buffer;
    state.duration = buffer.duration;
    state.trimStart = 0;
    state.trimEnd = buffer.duration;
    state.seekTime = 0;
    state.volume = 1.0;

    // 클리핑 경고를 위한 최대 진폭 사전 계산
    const channelArrays = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      channelArrays.push(buffer.getChannelData(ch));
    }
    state.maxAmplitude = computeMaxAbsAmplitude(channelArrays);

    // UI 초기화
    fileNameEl.textContent = state.file.name;
    fileMetaEl.textContent =
      `${formatTime(buffer.duration)} · ${buffer.numberOfChannels === 1 ? '모노' : '스테레오'} · ${buffer.sampleRate}Hz · ${(state.file.size / 1024 / 1024).toFixed(2)}MB`;

    volumeSlider.value = 100;
    volumeLabel.textContent = '100%';
    clippingWarning.hidden = true;

    formatRadios.forEach((r) => { r.checked = (r.value === 'wav'); });
    state.format = 'wav';
    mp3BitrateRow.hidden = true;
    syncFormatCardStyles();

    drawWaveform(buffer);
    updateTrimUI();
    updatePlayheadVisual(0);

    showScreen('editor');
  }

  // ---------- 파형 그리기 ----------
  function drawWaveform(buffer) {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 700;
    const cssHeight = 120;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // 모든 채널을 평균내어 하나의 파형으로 표시
    const numChannels = buffer.numberOfChannels;
    const length = buffer.length;
    const mixed = new Float32Array(length);
    for (let ch = 0; ch < numChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) mixed[i] += data[i] / numChannels;
    }

    const samplesPerPixel = Math.max(1, Math.floor(length / cssWidth));
    const mid = cssHeight / 2;

    ctx.fillStyle = '#8b7cf6';
    for (let x = 0; x < cssWidth; x++) {
      const start = x * samplesPerPixel;
      const end = Math.min(length, start + samplesPerPixel);
      let min = 1.0, max = -1.0;
      for (let i = start; i < end; i++) {
        const v = mixed[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (start >= end) { min = 0; max = 0; }
      const y1 = mid + min * mid * 0.9;
      const y2 = mid + max * mid * 0.9;
      ctx.fillRect(x, Math.min(y1, y2), 1, Math.max(1, Math.abs(y2 - y1)));
    }
  }

  // ---------- 트림 핸들 ----------
  function timeToPercent(t) {
    return state.duration > 0 ? (t / state.duration) * 100 : 0;
  }
  function percentToTime(p) {
    return (p / 100) * state.duration;
  }

  function updateTrimUI() {
    const startPct = timeToPercent(state.trimStart);
    const endPct = timeToPercent(state.trimEnd);
    handleStart.style.left = `${startPct}%`;
    handleEnd.style.left = `${endPct}%`;
    trimRegion.style.left = `${startPct}%`;
    trimRegion.style.width = `${Math.max(0, endPct - startPct)}%`;

    trimStartLabel.textContent = formatTime(state.trimStart);
    trimEndLabel.textContent = formatTime(state.trimEnd);
    trimDurationLabel.textContent = formatTime(state.trimEnd - state.trimStart);
  }

  const MIN_TRIM_GAP = 0.05; // 최소 구간 길이(초), 핸들이 겹치지 않도록

  function startHandleDrag(which) {
    state.isDraggingHandle = which;
    function onMove(e) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const rect = canvas.getBoundingClientRect();
      let pct = ((clientX - rect.left) / rect.width) * 100;
      pct = clamp(pct, 0, 100);
      let t = percentToTime(pct);
      if (which === 'start') {
        t = Math.min(t, state.trimEnd - MIN_TRIM_GAP);
        state.trimStart = clamp(t, 0, state.duration);
      } else {
        t = Math.max(t, state.trimStart + MIN_TRIM_GAP);
        state.trimEnd = clamp(t, 0, state.duration);
      }
      updateTrimUI();
    }
    function onUp() {
      state.isDraggingHandle = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  handleStart.addEventListener('mousedown', (e) => { e.preventDefault(); startHandleDrag('start'); });
  handleStart.addEventListener('touchstart', (e) => { startHandleDrag('start'); });
  handleEnd.addEventListener('mousedown', (e) => { e.preventDefault(); startHandleDrag('end'); });
  handleEnd.addEventListener('touchstart', (e) => { startHandleDrag('end'); });

  // 파형(빈 공간) 클릭 -> 재생 위치(seek) 이동
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const pct = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    state.seekTime = percentToTime(pct);
    updatePlayheadVisual(state.seekTime);
  });

  btnResetTrim.addEventListener('click', () => {
    state.trimStart = 0;
    state.trimEnd = state.duration;
    updateTrimUI();
  });

  function updatePlayheadVisual(t) {
    playheadEl.style.left = `${timeToPercent(t)}%`;
    playheadEl.style.display = 'block';
  }

  // ---------- 재생 ----------
  function stopPlayback() {
    const pb = state.playback;
    if (pb.sourceNode) {
      try { pb.sourceNode.stop(); } catch (e) { /* 이미 정지된 경우 */ }
      pb.sourceNode.disconnect();
      pb.sourceNode = null;
    }
    if (pb.rafId) {
      cancelAnimationFrame(pb.rafId);
      pb.rafId = null;
    }
    pb.isPlaying = false;
    btnStop.disabled = true;
  }

  function playRange(fromSec, toSec) {
    stopPlayback();
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = state.audioBuffer;
    const gainNode = ctx.createGain();
    gainNode.gain.value = state.volume;
    source.connect(gainNode).connect(ctx.destination);

    const duration = Math.max(0, toSec - fromSec);
    source.start(0, fromSec, duration);

    state.playback.sourceNode = source;
    state.playback.gainNode = gainNode;
    state.playback.isPlaying = true;
    state.playback.startedAt = ctx.currentTime;
    state.playback.playFrom = fromSec;
    state.playback.playUntil = toSec;
    btnStop.disabled = false;

    source.onended = () => {
      state.playback.isPlaying = false;
      btnStop.disabled = true;
      updatePlayheadVisual(toSec >= state.duration - 0.02 ? 0 : toSec);
    };

    function tick() {
      if (!state.playback.isPlaying) return;
      const elapsed = ctx.currentTime - state.playback.startedAt;
      const current = clamp(fromSec + elapsed, fromSec, toSec);
      updatePlayheadVisual(current);
      state.playback.rafId = requestAnimationFrame(tick);
    }
    tick();
  }

  btnPlayFull.addEventListener('click', () => {
    playRange(state.seekTime || 0, state.duration);
  });
  btnPlaySelection.addEventListener('click', () => {
    playRange(state.trimStart, state.trimEnd);
  });
  btnStop.addEventListener('click', stopPlayback);

  // ---------- 볼륨 ----------
  volumeSlider.addEventListener('input', () => {
    const pct = Number(volumeSlider.value);
    volumeLabel.textContent = `${pct}%`;
    state.volume = pct / 100;
    if (state.playback.gainNode) {
      state.playback.gainNode.gain.value = state.volume;
    }
    clippingWarning.hidden = !willClip(state.maxAmplitude, state.volume);
  });

  // ---------- 포맷 선택 ----------
  function syncFormatCardStyles() {
    formatRadios.forEach((r) => {
      const body = r.nextElementSibling;
      if (r.checked) body.classList.add('is-checked');
      else body.classList.remove('is-checked');
    });
  }
  formatRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      state.format = radio.value;
      mp3BitrateRow.hidden = radio.value !== 'mp3';
      syncFormatCardStyles();
    });
  });
  mp3BitrateSelect.addEventListener('change', () => {
    state.mp3Bitrate = Number(mp3BitrateSelect.value);
  });

  // ---------- 내보내기 ----------
  function extractTrimmedGainedChannelData() {
    const buffer = state.audioBuffer;
    const { startSample, endSample } = computeTrimSamples(
      buffer.sampleRate, buffer.length, state.trimStart, state.trimEnd
    );
    const outLength = endSample - startSample;
    const channels = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const out = new Float32Array(outLength);
      for (let i = 0; i < outLength; i++) {
        out[i] = applyGainSample(src[startSample + i], state.volume).value;
      }
      channels.push(out);
    }
    return { channels, sampleRate: buffer.sampleRate, length: outLength };
  }

  function encodeMP3(channels, sampleRate, bitrate, onProgress) {
    return new Promise((resolve, reject) => {
      try {
        const numChannels = Math.min(2, channels.length);
        const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
        const blockSize = 1152;
        const mp3Data = [];
        const int16Channels = channels.slice(0, numChannels).map(floatToInt16Array);
        const total = int16Channels[0].length;

        let i = 0;
        function step() {
          const end = Math.min(total, i + blockSize);
          let mp3buf;
          if (numChannels === 1) {
            mp3buf = encoder.encodeBuffer(int16Channels[0].subarray(i, end));
          } else {
            mp3buf = encoder.encodeBuffer(
              int16Channels[0].subarray(i, end),
              int16Channels[1].subarray(i, end)
            );
          }
          if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));
          i = end;
          if (onProgress) onProgress(Math.min(1, i / total));

          if (i < total) {
            setTimeout(step, 0); // UI 블로킹 방지
          } else {
            const finalBuf = encoder.flush();
            if (finalBuf.length > 0) mp3Data.push(new Int8Array(finalBuf));
            resolve(new Blob(mp3Data, { type: 'audio/mp3' }));
          }
        }
        step();
      } catch (err) {
        reject(err);
      }
    });
  }

  btnExport.addEventListener('click', async () => {
    stopPlayback();
    showScreen('exportS');
    exportProgress.style.width = '0%';
    exportStatus.textContent = '오디오 처리 중...';

    // 다음 프레임으로 넘겨서 화면 전환이 먼저 그려지도록
    await new Promise((r) => setTimeout(r, 30));

    try {
      const { channels, sampleRate } = extractTrimmedGainedChannelData();

      let blob, ext;
      if (state.format === 'wav') {
        exportStatus.textContent = 'WAV로 인코딩 중...';
        exportProgress.style.width = '60%';
        await new Promise((r) => setTimeout(r, 10));
        const arrayBuffer = encodeWAV(channels, sampleRate);
        blob = new Blob([arrayBuffer], { type: 'audio/wav' });
        ext = 'wav';
        exportProgress.style.width = '100%';
      } else {
        exportStatus.textContent = 'MP3로 인코딩 중... (0%)';
        blob = await encodeMP3(channels, sampleRate, state.mp3Bitrate, (p) => {
          exportProgress.style.width = `${Math.round(p * 100)}%`;
          exportStatus.textContent = `MP3로 인코딩 중... (${Math.round(p * 100)}%)`;
        });
        ext = 'mp3';
      }

      if (state.exportObjectUrl) URL.revokeObjectURL(state.exportObjectUrl);
      const url = URL.createObjectURL(blob);
      state.exportObjectUrl = url;

      const baseName = state.file.name.replace(/\.[^.]+$/, '');
      const outName = `${baseName}_edited.${ext}`;

      btnDownload.href = url;
      btnDownload.download = outName;
      doneAudioPreview.src = url;
      doneFileInfo.textContent = `${outName} · ${(blob.size / 1024 / 1024).toFixed(2)}MB`;

      showScreen('done');
    } catch (err) {
      console.error(err);
      exportStatus.textContent = '오류가 발생했습니다: ' + err.message;
    }
  });

  // ---------- 리셋 / 재편집 ----------
  function resetAll() {
    stopPlayback();
    if (state.exportObjectUrl) {
      URL.revokeObjectURL(state.exportObjectUrl);
      state.exportObjectUrl = null;
    }
    state.file = null;
    state.audioBuffer = null;
    fileInput.value = '';
    clearUploadError();
    showScreen('upload');
  }

  btnReset.addEventListener('click', resetAll);
  btnNewFile.addEventListener('click', resetAll);

  btnEditMore.addEventListener('click', () => {
    // 방금 내보낸 결과물을 다시 편집 대상으로 불러오기
    fetch(state.exportObjectUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const newName = btnDownload.download || state.file.name;
        const newFile = new File([blob], newName, { type: blob.type });
        loadAudioFile(newFile);
      });
  });

})();
}
