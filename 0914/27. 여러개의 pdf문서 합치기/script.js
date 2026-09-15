// ============================================================
// PDF 병합기 - script.js
// pdf-lib(UMD, window.PDFLib)를 사용해 브라우저 안에서만 병합 처리
// ============================================================

const { PDFDocument } = window.PDFLib;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ---------- 상태 ----------
// items: [{ id, file, name, size, pages, valid, errorMsg }]
let items = [];
let mergedBlobUrl = null;
let mergedFileName = "merged.pdf";
let dragSrcId = null;

// ---------- 화면 요소 ----------
const screens = {
  upload: document.getElementById("uploadScreen"),
  list: document.getElementById("listScreen"),
  progress: document.getElementById("progressScreen"),
  done: document.getElementById("doneScreen"),
};

const dropZone = document.getElementById("dropZone");
const browseBtn = document.getElementById("browseBtn");
const fileInput = document.getElementById("fileInput");
const uploadError = document.getElementById("uploadError");

const fileListEl = document.getElementById("fileList");
const addMoreBtn = document.getElementById("addMoreBtn");
const fileInputMore = document.getElementById("fileInputMore");
const totalFilesEl = document.getElementById("totalFiles");
const totalPagesEl = document.getElementById("totalPages");
const totalSizeEl = document.getElementById("totalSize");
const resetBtn = document.getElementById("resetBtn");
const mergeBtn = document.getElementById("mergeBtn");

const progressText = document.getElementById("progressText");
const progressBarInner = document.getElementById("progressBarInner");
const progressDetail = document.getElementById("progressDetail");

const doneSummary = document.getElementById("doneSummary");
const resultFileName = document.getElementById("resultFileName");
const resultFileSize = document.getElementById("resultFileSize");
const downloadBtn = document.getElementById("downloadBtn");
const startOverBtn = document.getElementById("startOverBtn");

const toastEl = document.getElementById("toast");

// ---------- 유틸 ----------
function showScreen(name) {
  Object.values(screens).forEach((s) => (s.hidden = true));
  screens[name].hidden = false;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.hidden = true;
  }, 2400);
}

function uid() {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- 파일 추가 처리 ----------
async function addFiles(fileArray) {
  const pdfFiles = fileArray.filter((f) => {
    const lowerName = f.name.toLowerCase();
    return lowerName.endsWith(".pdf") || f.type === "application/pdf";
  });

  const rejectedCount = fileArray.length - pdfFiles.length;
  if (rejectedCount > 0) {
    showToast(`PDF가 아닌 파일 ${rejectedCount}개는 제외되었어요.`);
  }

  if (pdfFiles.length === 0) {
    if (items.length === 0) {
      uploadError.textContent = "PDF 파일만 업로드할 수 있어요.";
      uploadError.hidden = false;
    }
    return;
  }

  uploadError.hidden = true;

  for (const file of pdfFiles) {
    const entry = {
      id: uid(),
      file,
      name: file.name,
      size: file.size,
      pages: null,
      valid: true,
      errorMsg: "",
    };
    items.push(entry);

    if (file.size > MAX_FILE_SIZE) {
      entry.valid = false;
      entry.errorMsg = `50MB를 초과해요 (${formatBytes(file.size)})`;
      continue;
    }

    try {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      if (pdf.isEncrypted) {
        entry.valid = false;
        entry.errorMsg = "암호로 보호된 PDF는 병합할 수 없어요";
      } else {
        entry.pages = pdf.getPageCount();
      }
    } catch (err) {
      entry.valid = false;
      entry.errorMsg = "손상되었거나 열 수 없는 PDF예요";
    }
  }

  renderList();
  showScreen("list");
}

// ---------- 목록 렌더링 ----------
function renderList() {
  fileListEl.innerHTML = "";

  items.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "file-item";
    li.draggable = true;
    li.dataset.id = item.id;

    const metaText = item.valid
      ? `${formatBytes(item.size)} · ${item.pages}페이지`
      : item.errorMsg;

    li.innerHTML = `
      <span class="file-drag-handle">⠿</span>
      <span class="file-order-badge">${idx + 1}</span>
      <span class="file-icon">${item.valid ? "📄" : "⚠️"}</span>
      <span class="file-info">
        <div class="file-name">${escapeHtml(item.name)}</div>
        <div class="file-meta ${item.valid ? "" : "error"}">${metaText}</div>
      </span>
      <button class="file-remove" data-id="${item.id}" title="삭제">✕</button>
    `;

    fileListEl.appendChild(li);
  });

  attachDragHandlers();
  updateSummary();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function updateSummary() {
  const validItems = items.filter((i) => i.valid);
  const totalPages = validItems.reduce((sum, i) => sum + (i.pages || 0), 0);
  const totalSize = items.reduce((sum, i) => sum + i.size, 0);

  totalFilesEl.textContent = `${items.length}개`;
  totalPagesEl.textContent = `${totalPages}페이지`;
  totalSizeEl.textContent = formatBytes(totalSize);

  mergeBtn.disabled = validItems.length < 2;
}

// ---------- 드래그로 순서 변경 ----------
function attachDragHandlers() {
  const rows = fileListEl.querySelectorAll(".file-item");

  rows.forEach((row) => {
    row.addEventListener("dragstart", () => {
      dragSrcId = row.dataset.id;
      row.classList.add("dragging");
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      rows.forEach((r) => r.classList.remove("drag-over-item"));
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (row.dataset.id !== dragSrcId) {
        row.classList.add("drag-over-item");
      }
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-over-item");
    });

    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drag-over-item");
      const targetId = row.dataset.id;
      if (!dragSrcId || dragSrcId === targetId) return;
      reorderItems(dragSrcId, targetId);
    });
  });

  fileListEl.querySelectorAll(".file-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      items = items.filter((i) => i.id !== id);
      if (items.length === 0) {
        showScreen("upload");
      } else {
        renderList();
      }
    });
  });
}

function reorderItems(srcId, targetId) {
  const srcIdx = items.findIndex((i) => i.id === srcId);
  const targetIdx = items.findIndex((i) => i.id === targetId);
  if (srcIdx === -1 || targetIdx === -1) return;

  const [moved] = items.splice(srcIdx, 1);
  items.splice(targetIdx, 0, moved);
  renderList();
}

// ---------- 병합 실행 ----------
async function mergePdfs() {
  const validItems = items.filter((i) => i.valid);
  if (validItems.length < 2) return;

  showScreen("progress");
  progressBarInner.style.width = "0%";

  try {
    const mergedPdf = await PDFDocument.create();

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      progressText.textContent = "PDF를 병합하는 중입니다...";
      progressDetail.textContent = `(${i + 1}/${validItems.length}) ${item.name} 처리 중...`;

      const bytes = await item.file.arrayBuffer();
      const srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));

      const pct = Math.round(((i + 1) / validItems.length) * 100);
      progressBarInner.style.width = `${pct}%`;
    }

    progressDetail.textContent = "파일을 저장하는 중...";
    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], { type: "application/pdf" });

    if (mergedBlobUrl) URL.revokeObjectURL(mergedBlobUrl);
    mergedBlobUrl = URL.createObjectURL(blob);
    mergedFileName = "merged.pdf";

    const totalPages = mergedPdf.getPageCount();
    doneSummary.textContent = `${validItems.length}개의 PDF, 총 ${totalPages}페이지를 하나로 합쳤어요.`;
    resultFileName.textContent = mergedFileName;
    resultFileSize.textContent = formatBytes(blob.size);

    showScreen("done");
  } catch (err) {
    console.error(err);
    showToast("병합 중 문제가 발생했어요. 다시 시도해 주세요.");
    showScreen("list");
  }
}

// ---------- 초기화 ----------
function resetAll() {
  items = [];
  if (mergedBlobUrl) {
    URL.revokeObjectURL(mergedBlobUrl);
    mergedBlobUrl = null;
  }
  fileInput.value = "";
  fileInputMore.value = "";
  uploadError.hidden = true;
  showScreen("upload");
}

// ---------- 이벤트 바인딩 ----------
dropZone.addEventListener("click", () => fileInput.click());
browseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

["dragenter", "dragover"].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
  })
);
dropZone.addEventListener("drop", (e) => {
  const files = Array.from(e.dataTransfer.files || []);
  if (files.length) addFiles(files);
});

fileInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  if (files.length) addFiles(files);
});

addMoreBtn.addEventListener("click", () => fileInputMore.click());
fileInputMore.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  if (files.length) addFiles(files);
  fileInputMore.value = "";
});

resetBtn.addEventListener("click", resetAll);
mergeBtn.addEventListener("click", mergePdfs);

downloadBtn.addEventListener("click", () => {
  if (!mergedBlobUrl) return;
  const a = document.createElement("a");
  a.href = mergedBlobUrl;
  a.download = mergedFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

startOverBtn.addEventListener("click", resetAll);
