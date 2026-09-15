/* =========================================================
   문서 요약기 - 메인 스크립트
   PDF/DOCX 텍스트 추출 + TextRank 요약 + UI 제어
   ========================================================= */

// pdf.js worker 설정
if (window['pdfjsLib']) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ---------- DOM 참조 ----------
const screens = {
  upload: document.getElementById('upload-screen'),
  loading: document.getElementById('loading-screen'),
  result: document.getElementById('result-screen'),
};
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const uploadError = document.getElementById('upload-error');
const loadingText = document.getElementById('loading-text');

const fileTypeIcon = document.getElementById('file-type-icon');
const fileNameEl = document.getElementById('file-name');
const fileStatsEl = document.getElementById('file-stats');
const resetBtn = document.getElementById('reset-btn');

const slider = document.getElementById('sentence-slider');
const sliderBadge = document.getElementById('slider-value-badge');
const presetRow = document.getElementById('preset-row');

const summaryList = document.getElementById('summary-list');
const copyBtn = document.getElementById('copy-btn');
const copyToast = document.getElementById('copy-toast');
const originalTextView = document.getElementById('original-text-view');

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ---------- 상태 ----------
let state = {
  fileName: '',
  fileExt: '',
  fullText: '',
  analysis: null,      // { sentences, ranking }
  currentTopSet: null, // Set of indices currently shown as summary
};

// ---------- 화면 전환 ----------
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ---------- 업로드 이벤트 ----------
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
  if (e.target.files.length > 0) handleFile(e.target.files[0]);
  fileInput.value = '';
});

function showUploadError(msg) {
  uploadError.textContent = msg;
  uploadError.hidden = false;
}

async function handleFile(file) {
  uploadError.hidden = true;
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'pdf' && ext !== 'docx') {
    showUploadError('⚠️ PDF 또는 DOCX 파일만 업로드할 수 있어요.');
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    showUploadError('⚠️ 파일 크기는 최대 50MB까지 지원해요.');
    return;
  }

  showScreen('loading');
  loadingText.textContent = '문서에서 텍스트를 추출하고 있어요...';

  try {
    let text = '';
    if (ext === 'pdf') {
      text = await extractPdfText(file);
    } else {
      text = await extractDocxText(file);
    }

    if (!text || text.trim().length < 10) {
      showScreen('upload');
      showUploadError('⚠️ 문서에서 텍스트를 추출하지 못했어요. 이미지로만 구성된 문서일 수 있어요.');
      return;
    }

    loadingText.textContent = 'TextRank 알고리즘으로 핵심 문장을 분석하고 있어요...';
    // 렌더 프레임을 한 번 양보해 로딩 텍스트가 반영되도록 함
    await new Promise(r => setTimeout(r, 30));

    const analysis = TextRankEngine.analyze(text);
    if (analysis.sentences.length === 0) {
      showScreen('upload');
      showUploadError('⚠️ 문서에서 문장을 찾지 못했어요.');
      return;
    }

    state.fileName = file.name;
    state.fileExt = ext;
    state.fullText = text;
    state.analysis = analysis;

    setupResultScreen();
    showScreen('result');
  } catch (err) {
    console.error(err);
    showScreen('upload');
    showUploadError('⚠️ 문서를 읽는 중 오류가 발생했어요. 파일이 손상되었거나 암호로 보호되어 있을 수 있어요.');
  }
}

// ---------- PDF 텍스트 추출 ----------
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    loadingText.textContent = `문서에서 텍스트를 추출하고 있어요... (${i}/${pdf.numPages}페이지)`;
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    text += pageText + '\n\n';
  }
  return text;
}

// ---------- DOCX 텍스트 추출 ----------
async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error('올바른 DOCX 구조가 아닙니다.');
  const xml = await docXmlFile.async('string');

  // <w:p> 단위(문단)로 분리해 문단 사이에 줄바꿈을 보존
  const paragraphs = xml.split(/<w:p[ >]/).slice(1);
  const lines = [];
  for (const p of paragraphs) {
    // <w:tab/> 같은 자기종결 태그가 <w:t>로 오인되지 않도록 속성까지 포함해 매칭
    const matches = [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)];
    const paragraphText = matches.map(m => m[1]).join('');
    if (paragraphText.trim().length > 0) lines.push(paragraphText);
  }
  return lines.join('\n\n');
}

// ---------- 결과 화면 구성 ----------
function setupResultScreen() {
  fileTypeIcon.textContent = state.fileExt === 'pdf' ? '📕' : '📘';
  fileNameEl.textContent = state.fileName;

  const totalWords = state.analysis.sentences.reduce(
    (sum, s) => sum + TextRankEngine.tokenize(s).length, 0
  );
  fileStatsEl.textContent = `문장 ${state.analysis.sentences.length}개 · 단어 약 ${totalWords}개`;

  // 문장 수가 5개 미만이면 슬라이더 최대값을 문장 수에 맞게 제한
  const maxN = Math.max(1, Math.min(5, state.analysis.sentences.length));
  slider.max = maxN;
  if (Number(slider.value) > maxN) slider.value = maxN;
  presetRow.querySelectorAll('.preset-btn').forEach(btn => {
    const v = Number(btn.dataset.value);
    btn.style.display = v <= maxN ? '' : 'none';
  });

  renderSummary(Number(slider.value));
}

function renderSummary(n) {
  const top = TextRankEngine.getTopSentences(state.analysis, n);
  state.currentTopSet = new Set(top.map(t => t.index));

  summaryList.innerHTML = '';
  top.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.text;
    summaryList.appendChild(li);
  });

  sliderBadge.textContent = `${n}문장`;
  slider.value = n;
  presetRow.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.value) === n);
  });

  renderOriginalWithHighlight();
}

function renderOriginalWithHighlight() {
  originalTextView.innerHTML = '';
  state.analysis.sentences.forEach((sentence, idx) => {
    const span = document.createElement('span');
    span.textContent = sentence + ' ';
    if (state.currentTopSet.has(idx)) span.className = 'highlight-sentence';
    originalTextView.appendChild(span);
  });
}

// ---------- 슬라이더 & 프리셋 ----------
slider.addEventListener('input', () => renderSummary(Number(slider.value)));
presetRow.addEventListener('click', e => {
  const btn = e.target.closest('.preset-btn');
  if (!btn || btn.style.display === 'none') return;
  renderSummary(Number(btn.dataset.value));
});

// ---------- 복사 ----------
copyBtn.addEventListener('click', async () => {
  const top = TextRankEngine.getTopSentences(state.analysis, Number(slider.value));
  const summaryText = top.map(t => t.text).join(' ');
  try {
    await navigator.clipboard.writeText(summaryText);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = summaryText;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  copyToast.hidden = false;
  setTimeout(() => (copyToast.hidden = true), 1800);
});

// ---------- 초기화 ----------
resetBtn.addEventListener('click', () => {
  state = { fileName: '', fileExt: '', fullText: '', analysis: null, currentTopSet: null };
  showScreen('upload');
});
