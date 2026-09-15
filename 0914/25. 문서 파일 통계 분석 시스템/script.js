// PDF.js 워커 설정
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const screens = {
  upload: document.getElementById("upload-screen"),
  loading: document.getElementById("loading-screen"),
  result: document.getElementById("result-screen"),
  error: document.getElementById("error-screen"),
};

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const uploadError = document.getElementById("upload-error");
const loadingText = document.getElementById("loading-text");

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function resetAll() {
  fileInput.value = "";
  uploadError.hidden = true;
  showScreen("upload");
}

document.getElementById("reset-btn").addEventListener("click", resetAll);
document.getElementById("error-reset-btn").addEventListener("click", resetAll);

// ---- 업로드 UI 이벤트 ----
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

const MAX_SIZE = 50 * 1024 * 1024;

function handleFile(file) {
  uploadError.hidden = true;
  const ext = file.name.split(".").pop().toLowerCase();

  if (!["pdf", "docx"].includes(ext)) {
    uploadError.textContent = "PDF 또는 DOCX 파일만 업로드할 수 있습니다.";
    uploadError.hidden = false;
    return;
  }
  if (file.size > MAX_SIZE) {
    uploadError.textContent = "파일 용량은 50MB를 넘을 수 없습니다.";
    uploadError.hidden = false;
    return;
  }

  showScreen("loading");
  loadingText.textContent = "문서를 분석하는 중입니다...";

  const process = ext === "pdf" ? analyzePDF : analyzeDOCX;
  process(file)
    .then((data) => renderResult(file, ext, data))
    .catch((err) => {
      console.error(err);
      document.getElementById("error-text").textContent =
        "문서를 읽는 중 오류가 발생했습니다. 파일이 손상되었거나 암호로 보호되어 있을 수 있습니다.";
      showScreen("error");
    });
}

// ---------------- 텍스트 통계 계산 ----------------
function computeStats(text) {
  const charsWithSpace = text.length;
  const spaceMatches = text.match(/\s/g);
  const spaces = spaceMatches ? spaceMatches.length : 0;
  const charsNoSpace = charsWithSpace - spaces;
  const wordMatches = text.trim().length ? text.trim().split(/\s+/) : [];
  const words = wordMatches.filter((w) => w.length > 0).length;
  return { charsWithSpace, charsNoSpace, spaces, words };
}

// ---------------- PDF 분석 ----------------
async function analyzePDF(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let fullText = "";
  let imageCount = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    loadingText.textContent = `문서를 분석하는 중입니다... (${i}/${pdf.numPages} 페이지)`;
    const page = await pdf.getPage(i);

    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n";

    const opList = await page.getOperatorList();
    for (const fn of opList.fnArray) {
      if (
        fn === pdfjsLib.OPS.paintImageXObject ||
        fn === pdfjsLib.OPS.paintImageXObjectRepeat ||
        fn === pdfjsLib.OPS.paintInlineImageXObject
      ) {
        imageCount++;
      }
    }
  }

  const stats = computeStats(fullText);
  return {
    ...stats,
    images: imageCount,
    extraLabel: "페이지 수",
    extraValue: pdf.numPages,
    fullText: fullText.trim(),
  };
}

// ---------------- DOCX 분석 ----------------
async function analyzeDOCX(file) {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) throw new Error("올바른 DOCX 파일이 아닙니다.");
  const xml = await docXmlFile.async("string");

  // 문단 개수 (텍스트 추출 전에 카운트)
  const paraMatches = xml.match(/<w:p(?:\s[^>]*)?>/g);
  const paragraphCount = paraMatches ? paraMatches.length : 0;

  // 문단 단위로 분리 후, 각 문단 안에서 텍스트(<w:t>) · 탭(<w:tab/>) · 줄바꿈(<w:br/>)을
  // 순서대로 조합해 원문에 가까운 텍스트를 복원한다.
  const RUN_TOKEN_RE = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g;
  const paragraphs = xml.split(/<\/w:p>/);
  const paraTexts = paragraphs.map((p) => {
    let text = "";
    let m;
    RUN_TOKEN_RE.lastIndex = 0;
    while ((m = RUN_TOKEN_RE.exec(p)) !== null) {
      if (m[1] !== undefined) {
        text += decodeXmlEntities(m[1]);
      } else if (m[0].startsWith("<w:tab")) {
        text += "\t";
      } else if (m[0].startsWith("<w:br")) {
        text += "\n";
      }
    }
    return text;
  });
  const fullText = paraTexts.filter((t) => t.length > 0).join("\n");

  // 이미지 개수: document.xml 안의 그림(<w:drawing>) 요소 개수를 센다.
  // (word/media 폴더 안 파일 개수만 세면, 동일한 이미지를 여러 번 삽입했을 때
  //  Word가 파일을 하나로 재사용해서 실제 삽입 개수보다 적게 집계되는 문제가 있음)
  const drawingMatches = xml.match(/<w:drawing\b/g);
  let imageCount = drawingMatches ? drawingMatches.length : 0;

  // 혹시 document.xml에 그림 참조가 전혀 없는 예외적인 경우를 대비해,
  // media 폴더의 실제 이미지 파일 수와 비교해 더 큰 값을 사용한다.
  const mediaFiles = Object.keys(zip.files).filter((name) =>
    /^word\/media\/.+\.(png|jpe?g|gif|bmp|emf|wmf|tiff?|svg)$/i.test(name)
  );
  imageCount = Math.max(imageCount, mediaFiles.length);

  const stats = computeStats(fullText);
  return {
    ...stats,
    images: imageCount,
    extraLabel: "문단 수",
    extraValue: paragraphCount,
    fullText: fullText.trim(),
  };
}

function decodeXmlEntities(str) {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// ---------------- 결과 렌더링 ----------------
function renderResult(file, ext, data) {
  document.getElementById("file-name").textContent = file.name;
  document.getElementById("file-meta").textContent = `${ext.toUpperCase()} · ${formatBytes(file.size)}`;

  document.getElementById("stat-chars-with-space").textContent = data.charsWithSpace.toLocaleString();
  document.getElementById("stat-chars-no-space").textContent = data.charsNoSpace.toLocaleString();
  document.getElementById("stat-words").textContent = data.words.toLocaleString();
  document.getElementById("stat-spaces").textContent = data.spaces.toLocaleString();
  document.getElementById("stat-images").textContent = data.images.toLocaleString();
  document.getElementById("stat-extra-label").textContent = data.extraLabel;
  document.getElementById("stat-extra").textContent = data.extraValue.toLocaleString();

  document.getElementById("text-preview").textContent =
    data.fullText.length > 0 ? data.fullText : "(추출된 텍스트가 없습니다)";

  showScreen("result");
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
