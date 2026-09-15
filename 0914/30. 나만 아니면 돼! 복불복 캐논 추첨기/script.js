(() => {
  'use strict';

  /* ============================================================
     0. 상태값 & DOM 참조
  ============================================================ */
  let players = []; // { id, name, color }
  let nextId = 1;

  const $ = (id) => document.getElementById(id);

  const screens = {
    input: $('screen-input'),
    game: $('screen-game'),
    result: $('screen-result'),
  };

  const nameInput = $('name-input');
  const addNameBtn = $('add-name-btn');
  const nameList = $('name-list');
  const nameEmptyMsg = $('name-empty-msg');
  const nameCount = $('name-count');
  const clearAllBtn = $('clear-all-btn');
  const startBtn = $('start-btn');

  const progressText = $('progress-text');
  const skipBtn = $('skip-btn');
  const canvas = $('game-canvas');
  const ctx = canvas.getContext('2d');
  const rankingList = $('ranking-list');

  const winnerNameEl = $('winner-name');
  const finalRankingList = $('final-ranking-list');
  const replaySameBtn = $('replay-same-btn');
  const restartBtn = $('restart-btn');
  const confettiContainer = $('confetti-container');

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  /* ============================================================
     1. 이름 입력 화면 로직
  ============================================================ */
  const COLOR_PALETTE_STEP = 47; // 황금각 비슷하게 색상 겹치지 않도록 회전
  function colorForIndex(i) {
    const hue = (i * COLOR_PALETTE_STEP) % 360;
    return `hsl(${hue}, 78%, 62%)`;
  }

  function addName(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    // 중복 이름이면 자동으로 (2), (3)... 붙여서 구분
    let finalName = trimmed;
    let dupCount = players.filter(p => p.name === trimmed || p.name.startsWith(trimmed + ' (')).length;
    if (players.some(p => p.name === trimmed)) {
      dupCount += 1;
      finalName = `${trimmed} (${dupCount})`;
    }

    players.push({ id: nextId++, name: finalName, color: colorForIndex(players.length) });
    renderNameList();
    nameInput.value = '';
    nameInput.focus();
  }

  function removeName(id) {
    players = players.filter(p => p.id !== id);
    renderNameList();
  }

  function renderNameList() {
    nameList.innerHTML = '';
    nameEmptyMsg.style.display = players.length === 0 ? 'block' : 'none';

    players.forEach((p) => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      left.className = 'chip-name';
      const dot = document.createElement('span');
      dot.className = 'chip-color';
      dot.style.background = p.color;
      left.appendChild(dot);
      left.appendChild(document.createTextNode(p.name));

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.title = '삭제';
      removeBtn.addEventListener('click', () => removeName(p.id));

      li.appendChild(left);
      li.appendChild(removeBtn);
      nameList.appendChild(li);
    });

    nameCount.textContent = `${players.length}명 등록됨`;
    const ok = players.length >= 2;
    startBtn.disabled = !ok;
    startBtn.textContent = ok ? '🚀 추첨 시작' : '🚀 추첨 시작 (최소 2명)';
  }

  addNameBtn.addEventListener('click', () => addName(nameInput.value));
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addName(nameInput.value); }
  });
  clearAllBtn.addEventListener('click', () => { players = []; renderNameList(); });

  startBtn.addEventListener('click', () => {
    if (players.length < 2) return;
    showScreen('game');
    startGame(players);
  });

  /* ============================================================
     2. 도착 순서 판정 로직 (LandingTracker) - 별도 검증된 알고리즘
  ============================================================ */
  class LandingTracker {
    constructor(ids, speedThreshold = 0.05, settleDuration = 800) {
      this.settledSince = new Map(ids.map((id) => [id, null]));
      this.landed = new Map(); // id -> 착지 확정된 시각(정지 시작 시각)
      this.order = []; // 착지 완료 순서 (마지막 = 당첨자)
      this.speedThreshold = speedThreshold;
      this.settleDuration = settleDuration;
    }
    update(now, speedMap) {
      const newlyLanded = [];
      for (const [id, speed] of speedMap) {
        if (this.landed.has(id)) continue;
        if (speed < this.speedThreshold) {
          if (this.settledSince.get(id) == null) {
            this.settledSince.set(id, now);
          } else if (now - this.settledSince.get(id) >= this.settleDuration) {
            this.landed.set(id, this.settledSince.get(id));
            this.order.push(id);
            newlyLanded.push(id);
          }
        } else {
          this.settledSince.set(id, null);
        }
      }
      return newlyLanded;
    }
    allLanded(total) { return this.landed.size === total; }
    forceFinishRemaining(ids, speedMap) {
      const unlanded = ids.filter((id) => !this.landed.has(id));
      unlanded.sort((a, b) => (speedMap.get(a) || 0) - (speedMap.get(b) || 0));
      unlanded.forEach((id) => { this.landed.set(id, Infinity); this.order.push(id); });
    }
    getWinner() { return this.order[this.order.length - 1]; }
  }

  /* ============================================================
     3. Matter.js 물리 월드 구성
  ============================================================ */
  const { Engine, World, Bodies, Body, Vector, Events } = Matter;

  const CW = canvas.width;   // 800
  const CH = canvas.height;  // 1000
  const BALL_R = 13;
  const PEG_R = 7;

  let engine, world;
  let pegs = [];
  let spinners = []; // { body, speed }
  let walls = [];
  let bins = [];
  let ballsMeta = new Map(); // id(string) -> { name, color, body }
  let tracker = null;
  let simRunning = false;
  let finished = false;
  let spawnStartTime = 0;
  let allSpawned = false;
  let spawnTimer = null;
  let landedCountLabel = 0;

  function buildWorld() {
    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = 1.05;

    pegs = [];
    spinners = [];
    walls = [];
    bins = [];

    // 좌우 벽 + 상단은 뚫려있음(대포 발사 공간)
    const wallThickness = 24;
    walls.push(Bodies.rectangle(-wallThickness / 2, CH / 2, wallThickness, CH, { isStatic: true }));
    walls.push(Bodies.rectangle(CW + wallThickness / 2, CH / 2, wallThickness, CH, { isStatic: true }));
    // 바닥
    walls.push(Bodies.rectangle(CW / 2, CH - 15, CW, 30, { isStatic: true, friction: 0.9 }));

    // 페그(장애물) - 지그재그 배열
    const rowCount = 10;
    const rowStartY = 190;
    const rowGap = 62;
    const colGap = 46;
    for (let row = 0; row < rowCount; row++) {
      const y = rowStartY + row * rowGap;
      const offset = row % 2 === 0 ? 0 : colGap / 2;
      for (let x = 40 + offset; x <= CW - 40; x += colGap) {
        pegs.push(Bodies.circle(x, y, PEG_R, {
          isStatic: true,
          restitution: 0.5,
          friction: 0.05,
          render: { fillStyle: '#5a6bb0' },
        }));
      }
    }

    // 회전 장애물(풍차형) - isStatic이지만 매 프레임 수동으로 각도를 바꿔 움직이는 장애물
    const spinnerDefs = [
      { x: 230, y: 330, len: 110, speed: 0.018 },
      { x: 570, y: 330, len: 110, speed: -0.018 },
      { x: 400, y: 560, len: 130, speed: 0.014 },
      { x: 230, y: 760, len: 100, speed: -0.02 },
      { x: 570, y: 760, len: 100, speed: 0.02 },
    ];
    spinnerDefs.forEach((d) => {
      // 주의: chamfer(모서리 둥글리기)를 사용하면 body.vertices 개수가 늘어나
      // draw()에서 정점으로 너비/높이를 역산하는 방식이 부정확해지므로 사용하지 않음.
      // 대신 생성 시 지정한 길이/두께 값을 그대로 저장해 그리기에 사용한다.
      const thickness = 14;
      const body = Bodies.rectangle(d.x, d.y, d.len, thickness, {
        isStatic: true,
        render: { fillStyle: '#8a6bd8' },
      });
      spinners.push({ body, speed: d.speed, len: d.len, thickness });
    });

    // 하단 구분 칸(빈) - 시각적으로 공이 갈라져 정착하도록
    const binCount = 11;
    const binY = CH - 90;
    for (let i = 0; i <= binCount; i++) {
      const x = (CW / binCount) * i;
      bins.push(Bodies.rectangle(x, binY, 6, 130, { isStatic: true, render: { fillStyle: '#3a4380' } }));
    }

    World.add(world, [
      ...walls,
      ...pegs,
      ...spinners.map((s) => s.body),
      ...bins,
    ]);

    ballsMeta = new Map();
    tracker = null;
    finished = false;
    allSpawned = false;
  }

  /* ============================================================
     4. 발사(캐논) 로직
  ============================================================ */
  const CANNON_X = CW / 2;
  const CANNON_Y = 55;
  let cannonRecoil = 0; // 발사 시 잠깐 반동 애니메이션용

  function shuffledOrder(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function spawnBall(player) {
    const spreadX = (Math.random() - 0.5) * 30; // 발사 지점 좌우 미세 랜덤
    const vx = (Math.random() - 0.5) * 5.5;      // 좌우 퍼짐
    const vy = 1.5 + Math.random() * 1.5;        // 아래로 약한 초기 속도(중력이 이어서 가속)

    const body = Bodies.circle(CANNON_X + spreadX, CANNON_Y, BALL_R, {
      restitution: 0.55,
      friction: 0.04,
      frictionAir: 0.0008,
      density: 0.0015,
      label: `ball-${player.id}`,
    });
    Body.setVelocity(body, { x: vx, y: vy });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.3);

    World.add(world, body);
    ballsMeta.set(String(player.id), { name: player.name, color: player.color, body });
    cannonRecoil = 1;
  }

  let pendingOrder = [];
  let pendingIndex = 0;

  function launchAll(orderedPlayers, total) {
    pendingOrder = orderedPlayers;
    pendingIndex = 0;
    progressText.textContent = `🚀 발사 준비중... (0 / ${total})`;
    spawnTimer = setInterval(() => {
      if (pendingIndex >= pendingOrder.length) {
        clearInterval(spawnTimer);
        spawnTimer = null;
        markAllSpawned(total);
        return;
      }
      spawnBall(pendingOrder[pendingIndex]);
      pendingIndex += 1;
      progressText.textContent = `🚀 발사중... (${pendingIndex} / ${total})`;
    }, 380);
  }

  function markAllSpawned(total) {
    allSpawned = true;
    spawnStartTime = engine.timing.timestamp;
    progressText.textContent = `⏳ 도착 대기중... (0 / ${total} 도착)`;
  }

  // 발사가 아직 끝나지 않았다면 남은 사람들을 즉시 전부 발사시킴 (스킵 버튼용)
  function forceSpawnRemaining() {
    if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
    const total = pendingOrder.length;
    while (pendingIndex < pendingOrder.length) {
      spawnBall(pendingOrder[pendingIndex]);
      pendingIndex += 1;
    }
    if (!allSpawned) markAllSpawned(total);
  }

  /* ============================================================
     5. 렌더링(캔버스 직접 그리기)
  ============================================================ */
  function draw() {
    ctx.clearRect(0, 0, CW, CH);

    // 배경
    const grad = ctx.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, '#181c40');
    grad.addColorStop(1, '#0d1030');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);

    // 페그
    pegs.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, PEG_R, 0, Math.PI * 2);
      ctx.fillStyle = '#5a6bb0';
      ctx.fill();
    });

    // 회전 장애물
    spinners.forEach((s) => {
      const b = s.body;
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = '#8a6bd8';
      ctx.fillRect(-s.len / 2, -s.thickness / 2, s.len, s.thickness);
      ctx.restore();
    });

    // 하단 구분 칸
    bins.forEach((bn) => {
      ctx.beginPath();
      ctx.fillStyle = '#3a4380';
      const w2 = 6, h2 = 130;
      ctx.fillRect(bn.position.x - w2 / 2, bn.position.y - h2 / 2, w2, h2);
    });

    // 바닥
    ctx.fillStyle = '#242a5c';
    ctx.fillRect(0, CH - 30, CW, 30);

    // 캐논(대포)
    ctx.save();
    ctx.translate(CANNON_X, CANNON_Y - 25);
    const recoilOffset = cannonRecoil * 6;
    ctx.fillStyle = '#ffb454';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8912e';
    ctx.fillRect(-14, -5 - recoilOffset, 28, 45);
    ctx.restore();
    if (cannonRecoil > 0) cannonRecoil = Math.max(0, cannonRecoil - 0.08);

    // 당첨자 강조(확정 후)
    const winnerId = tracker && tracker.order.length ? tracker.getWinner() : null;

    // 공들
    ballsMeta.forEach((meta, id) => {
      const b = meta.body;
      const isWinner = finished && id === winnerId;

      if (isWinner) {
        ctx.save();
        const glow = 18 + Math.sin(Date.now() / 120) * 6;
        ctx.shadowColor = '#ffd76e';
        ctx.shadowBlur = glow;
      }

      ctx.beginPath();
      ctx.arc(b.position.x, b.position.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = meta.color;
      ctx.fill();
      ctx.lineWidth = isWinner ? 3 : 1;
      ctx.strokeStyle = isWinner ? '#ffd76e' : 'rgba(0,0,0,0.35)';
      ctx.stroke();

      if (isWinner) ctx.restore();

      // 이름 라벨
      ctx.font = '10px Segoe UI, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = meta.name.length > 5 ? meta.name.slice(0, 4) + '…' : meta.name;
      ctx.fillText(label, b.position.x, b.position.y);
    });
  }

  /* ============================================================
     6. 메인 루프 & 판정 콜백
  ============================================================ */
  const FIXED_DELTA = 1000 / 60;
  const MAX_SIM_MS = 26000; // 이 시간이 지나면 강제 종료
  let rafId = null;

  function afterUpdateTick() {
    if (!allSpawned || finished) return;
    const now = engine.timing.timestamp;
    const speedMap = new Map();
    ballsMeta.forEach((meta, id) => {
      speedMap.set(id, Vector.magnitude(meta.body.velocity));
    });
    const newlyLanded = tracker.update(now, speedMap);
    if (newlyLanded.length) {
      newlyLanded.forEach((id) => addRankingEntry(id));
    }

    const total = ballsMeta.size;
    if (tracker.allLanded(total)) {
      finishGame();
      return;
    }

    if (now - spawnStartTime > MAX_SIM_MS) {
      const before = landedCountLabel;
      tracker.forceFinishRemaining([...ballsMeta.keys()], speedMap);
      // 강제 종료로 새로 착지 처리된 항목들도 랭킹 리스트에 표시
      tracker.order.slice(before).forEach((id) => addRankingEntry(id));
      finishGame();
    }
  }

  function addRankingEntry(id) {
    landedCountLabel += 1;
    const meta = ballsMeta.get(id);
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'chip-color';
    dot.style.background = meta.color;
    dot.style.display = 'inline-block';
    const rankNum = document.createElement('span');
    rankNum.className = 'rank-num';
    rankNum.textContent = `${landedCountLabel}`;
    li.appendChild(rankNum);
    li.appendChild(dot);
    li.appendChild(document.createTextNode(meta.name));
    rankingList.appendChild(li);
    rankingList.scrollTop = rankingList.scrollHeight;
    progressText.textContent = `⏳ 도착 대기중... (${landedCountLabel} / ${ballsMeta.size} 도착)`;
  }

  function loop() {
    if (!finished) {
      Engine.update(engine, FIXED_DELTA);
      spinners.forEach((s) => Body.setAngle(s.body, s.body.angle + s.speed));
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function finishGame() {
    if (finished) return;
    finished = true;
    progressText.textContent = `🏁 모두 도착 완료! (${ballsMeta.size} / ${ballsMeta.size})`;
    setTimeout(() => {
      if (rafId) cancelAnimationFrame(rafId); // 결과 화면 전환 후에는 렌더 루프를 멈춰 리소스 절약
      showResult();
    }, 1100);
  }

  /* ============================================================
     7. 게임 시작 / 스킵
  ============================================================ */
  function startGame(playerList) {
    // 초기화
    rankingList.innerHTML = '';
    landedCountLabel = 0;
    if (rafId) cancelAnimationFrame(rafId);
    if (spawnTimer) clearInterval(spawnTimer);

    buildWorld();
    const order = shuffledOrder(playerList);
    tracker = new LandingTracker(playerList.map((p) => String(p.id)));

    launchAll(order, order.length);

    Events.on(engine, 'afterUpdate', afterUpdateTick);

    loop();
  }

  skipBtn.addEventListener('click', () => {
    if (finished) return;
    // 발사가 아직 안 끝났다면 남은 사람들을 즉시 전부 발사시켜 모두 추첨에 포함시킴
    forceSpawnRemaining();
    // 빠른 물리 연산으로 가속 진행 (동기적으로 여러 스텝 실행)
    // 주의: Engine.update()는 'afterUpdate' 이벤트를 자동으로 발생시켜
    // 이미 등록된 afterUpdateTick 리스너를 그대로 호출한다.
    // 따라서 여기서 afterUpdateTick()을 직접 또 호출하면 판정 로직이 중복 실행되므로 호출하지 않는다.
    let steps = 0;
    const maxSteps = Math.ceil(MAX_SIM_MS / FIXED_DELTA) + 50;
    while (!finished && steps < maxSteps) {
      Engine.update(engine, FIXED_DELTA);
      spinners.forEach((s) => Body.setAngle(s.body, s.body.angle + s.speed));
      steps += 1;
    }
    if (!finished) {
      // 정말 안 끝났으면 강제 종료
      const speedMap = new Map();
      ballsMeta.forEach((meta, id) => speedMap.set(id, Vector.magnitude(meta.body.velocity)));
      const before = landedCountLabel;
      tracker.forceFinishRemaining([...ballsMeta.keys()], speedMap);
      // 새로 착지 처리된 항목들 랭킹에 채워넣기
      tracker.order.slice(before).forEach((id) => addRankingEntry(id));
      finishGame();
    }
  });

  /* ============================================================
     8. 결과 화면
  ============================================================ */
  function showResult() {
    const winnerId = tracker.getWinner();
    const winnerMeta = ballsMeta.get(winnerId);
    winnerNameEl.textContent = winnerMeta ? winnerMeta.name : '???';

    finalRankingList.innerHTML = '';
    tracker.order.forEach((id, idx) => {
      const meta = ballsMeta.get(id);
      const li = document.createElement('li');
      if (idx === tracker.order.length - 1) li.classList.add('is-winner');
      const rankNum = document.createElement('span');
      rankNum.className = 'rank-num';
      rankNum.textContent = `${idx + 1}`;
      li.appendChild(rankNum);
      li.appendChild(document.createTextNode(
        (idx === tracker.order.length - 1 ? '🏆 ' : '') + (meta ? meta.name : '???')
      ));
      finalRankingList.appendChild(li);
    });

    launchConfetti();
    showScreen('result');
  }

  function launchConfetti() {
    confettiContainer.innerHTML = '';
    const colors = ['#ffd76e', '#ff9d5c', '#6c8cff', '#7c5cff', '#5cffb0', '#ff6c9d'];
    const count = 90;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      const size = 6 + Math.random() * 6;
      el.style.left = `${Math.random() * 100}%`;
      el.style.width = `${size}px`;
      el.style.height = `${size * (0.5 + Math.random() * 0.8)}px`;
      el.style.background = colors[i % colors.length];
      const duration = 2.6 + Math.random() * 2.2;
      const delay = Math.random() * 0.6;
      el.style.animationDuration = `${duration}s`;
      el.style.animationDelay = `${delay}s`;
      confettiContainer.appendChild(el);
    }
    setTimeout(() => { confettiContainer.innerHTML = ''; }, 6000);
  }

  /* ============================================================
     9. 재시작 버튼들
  ============================================================ */
  replaySameBtn.addEventListener('click', () => {
    if (rafId) cancelAnimationFrame(rafId);
    Events.off(engine, 'afterUpdate', afterUpdateTick);
    showScreen('game');
    startGame(players);
  });

  restartBtn.addEventListener('click', () => {
    if (rafId) cancelAnimationFrame(rafId);
    Events.off(engine, 'afterUpdate', afterUpdateTick);
    players = [];
    renderNameList();
    showScreen('input');
  });

  /* 초기 렌더 */
  renderNameList();
})();
