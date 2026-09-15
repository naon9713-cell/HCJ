/* =========================================================
   TextRank 요약 엔진
   - Mihalcea & Tarau (2004) 의 문장 유사도(단어 중첩 기반) +
     PageRank 스타일 반복 계산을 사용한 추출적 요약 알고리즘
   ========================================================= */

const TextRankEngine = (() => {

  const STOPWORDS = new Set([
    // English
    'the','a','an','is','are','was','were','be','been','being','of','in','on','at','to','for','and','or','but',
    'with','as','by','this','that','these','those','it','its','from','which','also','than','then','so','if',
    'not','no','can','will','would','should','could','may','might','must','have','has','had','do','does','did',
    'i','you','he','she','we','they','their','our','your','my','his','her',
    // Korean particles / common function words
    '이','그','저','것','수','등','및','를','을','이다','있다','하다','에서','으로','에게','과','와','한',
    '이는','는','은','가','도','만','까지','부터','에','의','들','좀','잘','걍','과의','으로써','로써',
    '하는','했다','한다','합니다','했습니다','있습니다','됩니다','되다','되었다','또한','그리고','하지만',
    '그러나','그래서','따라서','즉','예를','들면','위해','통해'
  ]);

  function splitSentences(rawText) {
    let text = String(rawText || '').replace(/\r\n/g, '\n');

    // 1) 줄 단위 처리: 빈 줄(문단 구분)이나 목록 마커로 시작하는 줄은 독립 문장 경계로 취급
    const lines = text.split('\n');
    const listMarker = /^\s*([0-9]+[.)]|[-*•‣])\s+/;
    let rebuilt = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') { rebuilt += ' \u0001 '; continue; }
      if (listMarker.test(line) && rebuilt.trim() !== '') {
        rebuilt += ' \u0001 ' + line;
      } else {
        rebuilt += (rebuilt.endsWith(' ') || rebuilt === '' ? '' : ' ') + line;
      }
    }
    text = rebuilt;

    // 2) 흔한 영어 약어는 문장 종결로 오인하지 않도록 보호
    const abbrList = ['Mr','Mrs','Ms','Dr','Prof','Sr','Jr','St','vs','etc','approx','Inc','Ltd','Co','No',
      'U\\.S','U\\.K','e\\.g','i\\.e'];
    for (const abbr of abbrList) {
      const re = new RegExp('\\b(' + abbr + ')\\.', 'g');
      text = text.replace(re, '$1\u0003');
    }

    // 3) 숫자 뒤 마침표(목록 번호 / 소수점)는 문장 종결로 오인하지 않도록 보호
    text = text.replace(/(\d)\.(\s|$)/g, '$1\u0002$2');

    // 4) 공백 정리
    text = text.replace(/[ \t\u00A0]+/g, ' ');

    // 5) 문장 종결 부호(한글 종결어미 포함) 뒤 공백 기준 분리 + 문단/목록 마커 기준 분리
    const rough = text.split(/(?<=[.!?다요죠음됨함임])\s+(?=[^\s])|\u0001/);

    const sentences = [];
    for (let s of rough) {
      s = s.replace(/\u0002/g, '.').replace(/\u0003/g, '.').trim();
      if (s.length < 2) continue;
      sentences.push(s);
    }
    return sentences;
  }

  function tokenize(sentence) {
    const cleaned = sentence.toLowerCase().replace(/[^0-9a-z가-힣\s]/g, ' ');
    return cleaned.split(/\s+/).filter(w => w.length > 0 && !STOPWORDS.has(w));
  }

  function buildSimilarityMatrix(tokenLists) {
    const n = tokenLists.length;
    const sim = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const setI = new Set(tokenLists[i]);
        const setJ = new Set(tokenLists[j]);
        let overlap = 0;
        for (const w of setI) if (setJ.has(w)) overlap++;
        const li = Math.log(Math.max(tokenLists[i].length, 2));
        const lj = Math.log(Math.max(tokenLists[j].length, 2));
        const denom = li + lj;
        const s = denom > 0 ? overlap / denom : 0;
        sim[i][j] = s;
        sim[j][i] = s;
      }
    }
    return sim;
  }

  function pageRank(sim, damping = 0.85, maxIter = 100, tol = 1e-4) {
    const n = sim.length;
    const outSum = sim.map(row => row.reduce((a, b) => a + b, 0));
    let scores = new Array(n).fill(1);
    for (let iter = 0; iter < maxIter; iter++) {
      const newScores = new Array(n).fill(0);
      let diff = 0;
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          if (sim[i][j] > 0 && outSum[j] > 0) s += (sim[i][j] / outSum[j]) * scores[j];
        }
        newScores[i] = (1 - damping) + damping * s;
        diff += Math.abs(newScores[i] - scores[i]);
      }
      scores = newScores;
      if (diff < tol) break;
    }
    return scores;
  }

  /**
   * 텍스트를 분석해 전체 문장 순위를 계산한다.
   * @param {string} text
   * @returns {{sentences: string[], ranking: {index:number, score:number}[]}}
   */
  function analyze(text) {
    const sentences = splitSentences(text);
    if (sentences.length === 0) {
      return { sentences: [], ranking: [] };
    }
    if (sentences.length === 1) {
      return { sentences, ranking: [{ index: 0, score: 1 }] };
    }
    const tokenLists = sentences.map(tokenize);
    const sim = buildSimilarityMatrix(tokenLists);
    const scores = pageRank(sim);
    const ranking = scores
      .map((score, index) => ({ index, score }))
      .sort((a, b) => b.score - a.score);
    return { sentences, ranking };
  }

  /**
   * 미리 계산된 랭킹에서 상위 N개 문장을 원문 순서로 반환한다.
   */
  function getTopSentences(analysisResult, n) {
    const { sentences, ranking } = analysisResult;
    const count = Math.min(n, sentences.length);
    const top = ranking.slice(0, count).sort((a, b) => a.index - b.index);
    return top.map(item => ({ index: item.index, text: sentences[item.index], score: item.score }));
  }

  return { analyze, getTopSentences, splitSentences, tokenize };
})();
