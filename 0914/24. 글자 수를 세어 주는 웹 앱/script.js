const textInput = document.getElementById('textInput');
const charCountEl = document.getElementById('charCount');
const charCountNoSpaceEl = document.getElementById('charCountNoSpace');
const byteCountEl = document.getElementById('byteCount');
const wordCountEl = document.getElementById('wordCount');
const lineCountEl = document.getElementById('lineCount');
const koreanCountEl = document.getElementById('koreanCount');
const otherCountEl = document.getElementById('otherCount');
const clearBtn = document.getElementById('clearBtn');

// 한글 완성형(가-힣) + 자음/모음(ㄱ-ㅎ, ㅏ-ㅣ) 판별
function isKorean(ch) {
  const code = ch.codePointAt(0);
  return (
    (code >= 0xac00 && code <= 0xd7a3) || // 가-힣 완성형
    (code >= 0x3131 && code <= 0x314e) || // ㄱ-ㅎ 자음
    (code >= 0x314f && code <= 0x3163)    // ㅏ-ㅣ 모음
  );
}

function analyzeText(text) {
  // 코드 포인트 단위로 분리 (이모지 등 서로게이트 쌍 안전 처리)
  const chars = Array.from(text);

  let byteCount = 0;
  let koreanCount = 0;
  let otherCount = 0;

  for (const ch of chars) {
    if (isKorean(ch)) {
      byteCount += 2;
      koreanCount += 1;
    } else {
      byteCount += 1;
      otherCount += 1;
    }
  }

  const charCount = chars.length;
  const charCountNoSpace = chars.filter((ch) => !/\s/.test(ch)).length;

  const trimmed = text.trim();
  const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;

  const lineCount = text.length === 0 ? 0 : text.split(/\n/).length;

  return {
    charCount,
    charCountNoSpace,
    byteCount,
    wordCount,
    lineCount,
    koreanCount,
    otherCount,
  };
}

function updateStats() {
  const result = analyzeText(textInput.value);

  charCountEl.textContent = result.charCount.toLocaleString();
  charCountNoSpaceEl.textContent = result.charCountNoSpace.toLocaleString();
  byteCountEl.textContent = result.byteCount.toLocaleString() + ' byte';
  wordCountEl.textContent = result.wordCount.toLocaleString();
  lineCountEl.textContent = result.lineCount.toLocaleString();
  koreanCountEl.textContent = result.koreanCount.toLocaleString() + '자';
  otherCountEl.textContent = result.otherCount.toLocaleString() + '자';
}

textInput.addEventListener('input', updateStats);

clearBtn.addEventListener('click', () => {
  textInput.value = '';
  updateStats();
  textInput.focus();
});

// 초기 렌더링
updateStats();
