/* =========================================================
   오늘의 운세 - script.js
   ========================================================= */

// ---------- 상태 ----------
const state = {
  name: "",
  birth: "",
  gender: "male",
  element: null,
};

// ---------- 오행별 데이터 (모두 자체 제작 콘텐츠) ----------
const ELEMENT_DATA = {
  fire: {
    label: "불", icon: "🔥",
    themeColors: ["#ff6b6b", "#ff9a56"],
    luckyColors: ["빨강", "주황", "다홍", "와인색"],
    luckyNumbers: [3, 7, 9, 21, 30],
    luckyItems: ["향초", "붉은색 팔찌", "따뜻한 조명 스탠드", "손난로"],
    luckyDirections: ["남쪽", "남동쪽"],
    total: [
      "{name}님의 내면에서 뜨거운 열정이 솟아오르는 하루예요. 미뤄왔던 일을 시작하기에 더없이 좋은 타이밍입니다.",
      "작은 불씨가 큰 성과로 번질 수 있는 날이에요, {name}님. 자신감을 갖고 한 걸음 내디뎌보세요.",
      "오늘은 감정 기복이 클 수 있으니, {name}님은 중요한 결정을 내리기 전에 잠시 숨을 고르는 게 좋겠어요.",
      "주변 사람들에게 활력을 불어넣는 {name}님의 에너지가 빛나는 하루입니다. 리더십을 발휘해보세요.",
      "너무 서두르면 일을 그르칠 수 있어요. {name}님, 오늘은 속도보다 방향에 집중해보세요.",
      "새로운 아이디어가 번뜩이는 날이에요. {name}님의 창의적인 제안이 좋은 반응을 얻을 수 있습니다.",
      "화를 참기 어려운 순간이 올 수 있어요. {name}님, 한 박자 쉬고 반응하면 후회를 줄일 수 있습니다.",
      "그동안 쌓아온 노력이 슬슬 결실을 보이기 시작하는 시기예요, {name}님. 조금만 더 힘을 내보세요.",
    ],
  },
  water: {
    label: "물", icon: "💧",
    themeColors: ["#4facfe", "#00c6fb"],
    luckyColors: ["파랑", "남색", "청록색", "은색"],
    luckyNumbers: [2, 6, 11, 19, 28],
    luckyItems: ["텀블러", "파란색 스카프", "작은 화분", "향이 좋은 차"],
    luckyDirections: ["북쪽", "북서쪽"],
    total: [
      "{name}님의 마음이 잔잔한 호수처럼 편안해지는 하루예요. 조급해하지 않아도 일이 자연스레 풀립니다.",
      "오늘은 유연하게 흘러가는 물처럼, {name}님도 계획을 조금 바꿔야 할 순간이 생길 수 있어요.",
      "누군가의 고민을 들어주는 것만으로도 {name}님에게 좋은 인연이 시작될 수 있는 날입니다.",
      "생각이 많아지는 하루예요. {name}님, 혼자만의 시간을 가지며 마음을 정리해보세요.",
      "물이 낮은 곳으로 흘러가듯, {name}님도 겸손한 태도를 보일 때 더 큰 신뢰를 얻게 됩니다.",
      "직감이 유난히 예리해지는 날이에요. {name}님의 촉을 믿고 움직여도 좋습니다.",
      "감정에 휩쓸리기보다 차분히 상황을 지켜보는 것이 {name}님에게 유리한 하루입니다.",
      "오랜만에 연락이 뜸했던 사람에게서 반가운 소식이 올 수 있어요, {name}님.",
    ],
  },
  wood: {
    label: "나무", icon: "🌳",
    themeColors: ["#56ab5b", "#a8e063"],
    luckyColors: ["초록", "연두", "카키색", "갈색"],
    luckyNumbers: [1, 4, 8, 15, 24],
    luckyItems: ["작은 식물", "나무 소재 소품", "산책용 운동화", "허브차"],
    luckyDirections: ["동쪽", "동남쪽"],
    total: [
      "{name}님이 꾸준히 쌓아온 노력이 나무처럼 단단하게 자리 잡는 시기입니다. 조급해하지 마세요.",
      "새로운 계획을 세우기 좋은 날이에요, {name}님. 오늘 심은 씨앗이 나중에 큰 결실이 됩니다.",
      "주변 사람들과의 관계에서 성장할 기회가 생겨요. {name}님, 마음을 열고 다가가 보세요.",
      "몸이 조금 뻐근하게 느껴질 수 있어요. {name}님, 가볍게 스트레칭을 해주면 컨디션이 좋아집니다.",
      "고집을 부리기보다 유연하게 대처할 때 {name}님에게 더 좋은 결과가 따르는 하루입니다.",
      "배움에 대한 의욕이 샘솟는 날이에요. {name}님, 새로운 것을 하나 배워보는 건 어떨까요.",
      "오늘 내린 결정이 앞으로 꽤 오랫동안 {name}님에게 영향을 미칠 수 있으니 신중하게 생각해보세요.",
      "자연 속에서 잠깐이라도 시간을 보내면 {name}님의 기운이 한결 맑아지는 하루입니다.",
    ],
  },
  earth: {
    label: "땅", icon: "⛰️",
    themeColors: ["#c79a5b", "#8d6e3c"],
    luckyColors: ["황토색", "베이지", "갈색", "카멜색"],
    luckyNumbers: [5, 10, 16, 22, 29],
    luckyItems: ["도자기 소품", "가죽 다이어리", "따뜻한 담요", "원목 액세서리"],
    luckyDirections: ["중앙", "서남쪽"],
    total: [
      "{name}님에게 안정감이 필요한 하루예요. 익숙한 루틴을 지키는 것만으로도 마음이 편안해집니다.",
      "든든한 기반을 다지기 좋은 날입니다. {name}님, 저축이나 정리정돈 같은 일을 해보면 좋아요.",
      "신뢰가 중요한 하루예요. {name}님이 맡은 일을 성실히 해내면 주변의 인정을 받게 됩니다.",
      "변화보다는 유지가 필요한 시기예요. {name}님, 무리한 확장이나 큰 지출은 잠시 미뤄두세요.",
      "가족이나 오랜 친구와의 시간에서 큰 위안을 얻을 수 있는 하루입니다, {name}님.",
      "느리지만 확실하게 나아가는 것이 {name}님에게 어울리는 오늘의 전략입니다.",
      "책임감 있게 행동하는 {name}님의 모습이 주변에 좋은 인상을 남기는 날이에요.",
      "작은 습관 하나를 다시 세우기 좋은 타이밍이에요, {name}님. 꾸준함이 곧 실력이 됩니다.",
    ],
  },
  wind: {
    label: "바람", icon: "🌪️",
    themeColors: ["#7de2d1", "#a3f7bf"],
    luckyColors: ["하늘색", "민트색", "흰색", "라벤더색"],
    luckyNumbers: [2, 5, 13, 18, 27],
    luckyItems: ["가벼운 스카프", "이어폰", "여행용 파우치", "노트"],
    luckyDirections: ["서쪽", "북동쪽"],
    total: [
      "{name}님 주변에 새로운 소식이나 기회가 바람처럼 스쳐 지나갈 수 있어요. 놓치지 말고 잡아보세요.",
      "오늘은 계획에 없던 만남이나 제안이 찾아올 수 있는 날입니다, {name}님.",
      "생각의 전환이 필요한 하루예요. {name}님, 익숙한 방식에서 벗어나 보는 것도 좋습니다.",
      "여러 일이 한꺼번에 몰려 정신없을 수 있어요. {name}님, 우선순위를 정하면 한결 수월해집니다.",
      "가벼운 마음으로 하루를 시작하면 {name}님에게 뜻밖의 즐거운 일이 생길 수 있어요.",
      "소통이 중요한 날이에요. {name}님의 말 한마디가 누군가에게 큰 힘이 될 수 있습니다.",
      "변화의 바람이 부는 시기예요. {name}님, 두려워하지 말고 새로운 환경에 몸을 맡겨보세요.",
      "집중력이 흐트러지기 쉬운 하루입니다. {name}님, 짧게 끊어서 일을 처리하면 효율이 올라가요.",
    ],
  },
};

// ---------- 카테고리별 코멘트 풀 (별점 1~5 공통) ----------
const CATEGORY_DATA = {
  love: {
    icon: "💕", name: "애정운",
    comments: {
      1: ["오해가 생기기 쉬운 날이니 말을 조금 더 신중하게 골라보세요.", "혼자만의 시간을 가지며 마음을 정리하는 것도 좋겠어요."],
      2: ["소소한 다툼이 있을 수 있지만 금방 풀릴 기미가 보여요.", "상대방의 입장을 한 번 더 헤아려보면 도움이 됩니다."],
      3: ["평온한 하루예요. 무리하지 않고 자연스럽게 흘러가도 좋습니다.", "큰 변화는 없지만 안정적인 관계를 이어갈 수 있어요."],
      4: ["다정한 대화가 관계를 한층 가깝게 만들어주는 날이에요.", "고백이나 화해를 시도하기에 나쁘지 않은 타이밍입니다."],
      5: ["설레는 만남이나 좋은 소식이 기다리고 있을 수 있어요!", "마음을 표현하면 생각보다 훨씬 좋은 반응이 돌아옵니다."],
    },
  },
  money: {
    icon: "💰", name: "재물운",
    comments: {
      1: ["예상치 못한 지출이 생길 수 있으니 큰 소비는 잠시 미뤄두세요.", "충동구매를 조심해야 하는 하루입니다."],
      2: ["돈이 나갈 곳이 많아 보이니 지출 계획을 다시 점검해보세요.", "무리한 투자보다는 관망하는 자세가 필요합니다."],
      3: ["큰 변동 없이 안정적인 흐름이 이어지는 하루예요.", "지출과 수입의 균형이 잘 맞는 날입니다."],
      4: ["작은 행운이 따르는 날이에요. 알뜰한 소비가 이득으로 돌아옵니다.", "생각지 못한 곳에서 도움이 될 소식이 들려올 수 있어요."],
      5: ["뜻밖의 수입이나 좋은 제안이 들어올 수 있는 날이에요!", "투자나 재테크에 관심을 가져보기 좋은 타이밍입니다."],
    },
  },
  health: {
    icon: "🍀", name: "건강운",
    comments: {
      1: ["컨디션 관리가 필요한 날이에요. 무리한 일정은 피해주세요.", "충분한 수면을 챙기는 것이 오늘의 최우선 과제입니다."],
      2: ["몸이 조금 무겁게 느껴질 수 있어요. 가벼운 스트레칭이 도움이 됩니다.", "과식이나 과음은 피하는 것이 좋겠어요."],
      3: ["평소와 비슷한 컨디션을 유지할 수 있는 하루입니다.", "특별한 이상은 없지만 규칙적인 생활을 이어가세요."],
      4: ["몸도 마음도 가벼운 활기찬 하루가 될 것 같아요.", "운동이나 야외 활동을 하기에 좋은 컨디션입니다."],
      5: ["에너지가 넘치는 하루예요! 활동적인 계획을 세워도 좋습니다.", "몸과 마음이 모두 상쾌한, 컨디션 최고의 날입니다."],
    },
  },
  work: {
    icon: "📚", name: "학업 · 직장운",
    comments: {
      1: ["집중력이 떨어질 수 있으니 중요한 업무는 오전에 처리해보세요.", "실수가 생기기 쉬우니 마무리 점검을 꼼꼼히 해주세요."],
      2: ["예상보다 일이 더디게 풀릴 수 있어요. 조급해하지 마세요.", "동료나 상사와의 소통에서 오해가 없도록 유의하세요."],
      3: ["무난하게 흘러가는 하루예요. 맡은 일에 집중하면 됩니다.", "특별한 이슈 없이 평소 페이스를 유지할 수 있어요."],
      4: ["집중력이 잘 발휘되어 성과를 내기 좋은 날이에요.", "새로운 아이디어나 제안이 좋은 평가를 받을 수 있습니다."],
      5: ["노력한 만큼 인정받는 뿌듯한 하루가 될 것 같아요!", "중요한 발표나 시험에서 좋은 결과를 기대해도 좋습니다."],
    },
  },
};

// ---------- 시드 기반 랜덤 (같은 날, 같은 입력이면 같은 결과) ----------
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ---------- 화면 전환 ----------
const screens = {
  1: document.getElementById("screen1"),
  2: document.getElementById("screen2"),
  3: document.getElementById("screen3"),
};

function showScreen(n) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[n].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- STEP 1 ----------
const nameInput = document.getElementById("nameInput");
const birthInput = document.getElementById("birthInput");
const step1Error = document.getElementById("step1Error");

document.getElementById("toStep2Btn").addEventListener("click", () => {
  const name = nameInput.value.trim();
  const birth = birthInput.value;
  const gender = document.querySelector('input[name="gender"]:checked').value;

  if (!name) {
    step1Error.textContent = "이름을 입력해주세요.";
    nameInput.focus();
    return;
  }
  if (!birth) {
    step1Error.textContent = "생년월일을 선택해주세요.";
    birthInput.focus();
    return;
  }

  step1Error.textContent = "";
  state.name = name;
  state.birth = birth;
  state.gender = gender;

  showScreen(2);
});

document.getElementById("toStep1Btn").addEventListener("click", () => {
  showScreen(1);
});

// ---------- STEP 2 ----------
const elementCards = document.querySelectorAll(".element-card");
const toResultBtn = document.getElementById("toResultBtn");

elementCards.forEach((card) => {
  card.addEventListener("click", () => {
    elementCards.forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    state.element = card.dataset.element;
    toResultBtn.disabled = false;
  });
});

toResultBtn.addEventListener("click", () => {
  renderResult();
  showScreen(3);
});

document.getElementById("reshuffleBtn").addEventListener("click", () => {
  showScreen(2);
});

document.getElementById("restartBtn").addEventListener("click", () => {
  // 전체 초기화
  state.name = "";
  state.birth = "";
  state.gender = "male";
  state.element = null;
  nameInput.value = "";
  birthInput.value = "";
  document.querySelector('input[name="gender"][value="male"]').checked = true;
  elementCards.forEach((c) => c.classList.remove("selected"));
  toResultBtn.disabled = true;
  step1Error.textContent = "";
  showScreen(1);
});

// ---------- STEP 3: 결과 렌더링 ----------
function renderResult() {
  const el = ELEMENT_DATA[state.element];
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

  // 시드 생성: 이름 + 생일 + 성별 + 오행 + 오늘 날짜
  const seedStr = `${state.name}|${state.birth}|${state.gender}|${state.element}|${dateKey}`;
  const rng = mulberry32(hashString(seedStr));

  // 배경 테마 변경
  document.body.style.background = `linear-gradient(135deg, ${el.themeColors[0]} 0%, ${el.themeColors[1]} 100%)`;

  // 헤더
  document.getElementById("resultElementIcon").textContent = el.icon;
  document.getElementById("resultGreeting").textContent = `${state.name}님의 오늘의 운세`;
  document.getElementById("resultDate").textContent = `${dateStr} · ${el.label}(${el.icon})의 기운`;

  // 총운
  const totalText = pick(rng, el.total).replaceAll("{name}", state.name);
  document.getElementById("totalFortuneText").textContent = totalText;

  // 카테고리별 운세
  const categoriesEl = document.getElementById("fortuneCategories");
  categoriesEl.innerHTML = "";
  Object.entries(CATEGORY_DATA).forEach(([key, cat]) => {
    const score = randInt(rng, 1, 5);
    const comment = pick(rng, cat.comments[score]);
    const starsFull = "★".repeat(score);
    const starsEmpty = "☆".repeat(5 - score);

    const item = document.createElement("div");
    item.className = "category-item";
    item.innerHTML = `
      <div class="category-top">
        <span class="category-name">${cat.icon} ${cat.name}</span>
        <span class="stars">${starsFull}${starsEmpty}</span>
      </div>
      <p class="category-comment">${comment}</p>
    `;
    categoriesEl.appendChild(item);
  });

  // 행운의 아이템
  const luckyGrid = document.getElementById("luckyGrid");
  const luckyData = [
    { label: "행운의 색", value: pick(rng, el.luckyColors) },
    { label: "행운의 숫자", value: pick(rng, el.luckyNumbers) },
    { label: "행운의 아이템", value: pick(rng, el.luckyItems) },
    { label: "행운의 방향", value: pick(rng, el.luckyDirections) },
  ];
  luckyGrid.innerHTML = luckyData
    .map(
      (item) => `
      <div class="lucky-item">
        <div class="lucky-label">${item.label}</div>
        <div class="lucky-value">${item.value}</div>
      </div>
    `
    )
    .join("");
}
