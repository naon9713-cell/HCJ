(() => {
  'use strict';

  // ===== DOM 참조 =====
  const setupScreen = document.getElementById('setupScreen');
  const displayScreen = document.getElementById('displayScreen');
  const setupForm = document.getElementById('setupForm');

  const scheduleInput = document.getElementById('scheduleInput');
  const returnTimeInput = document.getElementById('returnTimeInput');
  const durationHours = document.getElementById('durationHours');
  const durationMinutes = document.getElementById('durationMinutes');
  const noteInput = document.getElementById('noteInput');
  const errorMsg = document.getElementById('errorMsg');

  const toggleBtns = document.querySelectorAll('.toggle-btn');
  const timeModeBox = document.getElementById('timeModeBox');
  const durationModeBox = document.getElementById('durationModeBox');

  const nowClock = document.getElementById('nowClock');
  const nowDate = document.getElementById('nowDate');
  const scheduleText = document.getElementById('scheduleText');
  const returnTimeText = document.getElementById('returnTimeText');
  const countdownText = document.getElementById('countdownText');
  const countdownLabel = document.getElementById('countdownLabel');
  const noteText = document.getElementById('noteText');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const editBtn = document.getElementById('editBtn');

  const STORAGE_KEY = 'awayScreenState';
  let currentMode = 'time'; // 'time' | 'duration'
  let tickTimer = null;
  let wakeLockRef = null;

  // ===== 모드 전환 (특정 시각 vs 몇 분 후) =====
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      if (currentMode === 'time') {
        timeModeBox.classList.remove('hidden');
        durationModeBox.classList.add('hidden');
      } else {
        timeModeBox.classList.add('hidden');
        durationModeBox.classList.remove('hidden');
      }
    });
  });

  // ===== 복귀 시각 계산 =====
  function calcTargetFromTime(now, hh, mm) {
    const target = new Date(now);
    target.setHours(hh, mm, 0, 0);
    if (target <= now) {
      target.setDate(target.getDate() + 1); // 이미 지난 시각이면 다음날로 이월
    }
    return target;
  }

  function calcTargetFromDuration(now, hours, minutes) {
    return new Date(now.getTime() + hours * 3600000 + minutes * 60000);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatCountdown(ms) {
    const overtime = ms < 0;
    const abs = Math.abs(ms);
    const totalSec = Math.floor(abs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return { text: (overtime ? '-' : '') + `${pad(h)}:${pad(m)}:${pad(s)}`, overtime };
  }

  function formatClockTime(date) {
    let h = date.getHours();
    const m = date.getMinutes();
    const ampm = h < 12 ? '오전' : '오후';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${ampm} ${h12}:${pad(m)}`;
  }

  function formatFullDate(date) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  }

  // ===== 폼 제출 =====
  setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    errorMsg.classList.add('hidden');

    const schedule = scheduleInput.value.trim();
    if (!schedule) {
      showError('일정을 입력해 주세요.');
      return;
    }

    const now = new Date();
    let target;

    if (currentMode === 'time') {
      if (!returnTimeInput.value) {
        showError('돌아오는 시각을 선택해 주세요.');
        return;
      }
      const [hh, mm] = returnTimeInput.value.split(':').map(Number);
      target = calcTargetFromTime(now, hh, mm);
    } else {
      const h = parseInt(durationHours.value, 10) || 0;
      const m = parseInt(durationMinutes.value, 10) || 0;
      if (h === 0 && m === 0) {
        showError('시간 또는 분을 1 이상 입력해 주세요.');
        return;
      }
      target = calcTargetFromDuration(now, h, m);
    }

    const note = noteInput.value.trim();

    const state = {
      schedule,
      targetISO: target.toISOString(),
      note
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    startDisplay(state);
  });

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
  }

  // ===== 표시 화면 시작 =====
  function startDisplay(state) {
    scheduleText.textContent = state.schedule;

    if (state.note) {
      noteText.textContent = state.note;
      noteText.classList.remove('hidden');
    } else {
      noteText.textContent = '';
      noteText.classList.add('hidden');
    }

    const target = new Date(state.targetISO);
    returnTimeText.textContent = formatClockTime(target);

    setupScreen.classList.remove('active');
    setupScreen.classList.add('hidden');
    displayScreen.classList.remove('hidden');
    displayScreen.classList.add('active');

    requestWakeLock();

    if (tickTimer) clearInterval(tickTimer);
    tick(target);
    tickTimer = setInterval(() => tick(target), 1000);
  }

  function tick(target) {
    const now = new Date();
    nowClock.textContent = now.toLocaleTimeString('ko-KR', { hour12: false });
    nowDate.textContent = formatFullDate(now);

    const diff = target.getTime() - now.getTime();
    const { text, overtime } = formatCountdown(diff);
    countdownText.textContent = text;

    countdownText.classList.remove('overtime', 'almost');
    if (overtime) {
      countdownLabel.textContent = '초과된 시간';
      countdownText.classList.add('overtime');
    } else if (diff <= 60000) {
      countdownLabel.textContent = '남은 시간';
      countdownText.classList.add('almost');
    } else {
      countdownLabel.textContent = '남은 시간';
    }
  }

  // ===== 설정으로 돌아가기 =====
  editBtn.addEventListener('click', () => {
    if (tickTimer) clearInterval(tickTimer);
    releaseWakeLock();
    displayScreen.classList.remove('active');
    displayScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    setupScreen.classList.add('active');
  });

  // ===== 전체화면 =====
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      fullscreenBtn.textContent = '⛶ 전체화면 종료';
    } else {
      document.exitFullscreen().catch(() => {});
      fullscreenBtn.textContent = '⛶ 전체화면';
    }
  });

  document.addEventListener('fullscreenchange', () => {
    fullscreenBtn.textContent = document.fullscreenElement ? '⛶ 전체화면 종료' : '⛶ 전체화면';
  });

  // ===== 화면 꺼짐 방지 (지원 브라우저 한정) =====
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      // 지원하지 않거나 실패해도 앱 동작에는 영향 없음
    }
  }

  function releaseWakeLock() {
    if (wakeLockRef) {
      wakeLockRef.release().catch(() => {});
      wakeLockRef = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && displayScreen.classList.contains('active')) {
      requestWakeLock();
    }
  });

  // ===== 새로고침 시 이전 상태 복원 =====
  window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        const target = new Date(state.targetISO);
        // 목표 시각이 아직 유효(과거로부터 24시간 이내 초과 포함)하면 복원
        if (!isNaN(target.getTime())) {
          scheduleInput.value = state.schedule || '';
          noteInput.value = state.note || '';
          startDisplay(state);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  });

})();
