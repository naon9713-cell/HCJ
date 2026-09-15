/**
 * 드미트리 & 로렐라이 모바일 청첩장 스크립트 (script.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  initCountdown();
  initPetalCanvas();
  initScrollReveal();
  initContactModal();
  initLightbox();
  initGuestbook();
});

/* ==========================================================================
   1. 실시간 D-DAY 카운트다운 타이머 애니메이션
   ========================================================================== */
function initCountdown() {
  // 결혼식 일시: 2099년 12월 26일 (토) 12:00:00 (KST, UTC+9)
  const weddingDate = new Date(2099, 11, 26, 12, 0, 0); // 월은 0부터 시작하므로 11 = 12월

  const daysEl = document.getElementById('cd-days');
  const hoursEl = document.getElementById('cd-hours');
  const minutesEl = document.getElementById('cd-minutes');
  const secondsEl = document.getElementById('cd-seconds');

  const daysBox = document.getElementById('cd-days-box');
  const hoursBox = document.getElementById('cd-hours-box');
  const minutesBox = document.getElementById('cd-minutes-box');
  const secondsBox = document.getElementById('cd-seconds-box');
  
  const ddayCountEl = document.getElementById('dday-count');

  let prevDays = null;
  let prevHours = null;
  let prevMinutes = null;
  let prevSeconds = null;

  function updateTimer() {
    const now = new Date();
    const diff = weddingDate - now;

    if (diff <= 0) {
      if (daysEl) daysEl.textContent = '00';
      if (hoursEl) hoursEl.textContent = '00';
      if (minutesEl) minutesEl.textContent = '00';
      if (secondsEl) secondsEl.textContent = '00';
      const msg = document.getElementById('countdown-msg');
      if (msg) msg.innerHTML = '💍 <strong>오늘</strong>은 드미트리와 로렐라이의 결혼식 날입니다!';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    const pad = (n) => String(n).padStart(2, '0');

    // 숫자 갱신 및 플립 애니메이션
    if (days !== prevDays) {
      if (daysEl) daysEl.textContent = days;
      animateBox(daysBox);
      prevDays = days;
      if (ddayCountEl) ddayCountEl.textContent = days;
    }

    if (hours !== prevHours) {
      if (hoursEl) hoursEl.textContent = pad(hours);
      animateBox(hoursBox);
      prevHours = hours;
    }

    if (minutes !== prevMinutes) {
      if (minutesEl) minutesEl.textContent = pad(minutes);
      animateBox(minutesBox);
      prevMinutes = minutes;
    }

    if (seconds !== prevSeconds) {
      if (secondsEl) secondsEl.textContent = pad(seconds);
      animateBox(secondsBox);
      prevSeconds = seconds;
    }
  }

  function animateBox(box) {
    if (!box) return;
    box.classList.remove('flip');
    void box.offsetWidth; // 트리거 리플로우
    box.classList.add('flip');
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

/* ==========================================================================
   2. 은은하게 흩날리는 벚꽃/꽃잎 파티클 캔버스
   ========================================================================== */
function initPetalCanvas() {
  const canvas = document.getElementById('petal-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const petals = [];
  const TOTAL_PETALS = 32;
  let isRunning = true;

  class Petal {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : -20;
      this.size = Math.random() * 8 + 7;
      this.speedY = Math.random() * 1.2 + 0.8;
      this.speedX = Math.random() * 1.5 - 0.75;
      this.rotation = Math.random() * 360;
      this.rotSpeed = (Math.random() - 0.5) * 1.5;
      this.opacity = Math.random() * 0.4 + 0.4;
      this.swingSpeed = Math.random() * 0.02 + 0.01;
      this.swingStep = Math.random() * 100;
      
      // 분홍빛~샴페인빛 꽃잎 색조 변형
      const colors = [
        'rgba(255, 218, 222, ',
        'rgba(255, 230, 235, ',
        'rgba(247, 225, 205, ',
        'rgba(250, 200, 205, '
      ];
      this.colorPrefix = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
      this.y += this.speedY;
      this.swingStep += this.swingSpeed;
      this.x += Math.sin(this.swingStep) * 1.2 + this.speedX;
      this.rotation += this.rotSpeed;

      if (this.y > height + 20 || this.x < -30 || this.x > width + 30) {
        this.reset();
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate((this.rotation * Math.PI) / 180);
      ctx.fillStyle = this.colorPrefix + this.opacity + ')';
      ctx.beginPath();
      // 꽃잎 곡선 형태 그리기
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(this.size, -this.size / 2, this.size, this.size, 0, this.size * 1.6);
      ctx.bezierCurveTo(-this.size, this.size, -this.size, -this.size / 2, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < TOTAL_PETALS; i++) {
    petals.push(new Petal());
  }

  function loop() {
    if (!isRunning) return;
    ctx.clearRect(0, 0, width, height);
    for (let p of petals) {
      p.update();
      p.draw();
    }
    requestAnimationFrame(loop);
  }

  loop();

  // 상단 토글 버튼
  const toggleBtn = document.getElementById('toggle-petal-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isRunning = !isRunning;
      canvas.style.display = isRunning ? 'block' : 'none';
      toggleBtn.style.opacity = isRunning ? '1' : '0.4';
      showToast(isRunning ? '꽃잎 효과가 켜졌습니다 🌸' : '꽃잎 효과가 꺼졌습니다.');
      if (isRunning) loop();
    });
  }
}

/* ==========================================================================
   3. 스크롤 인터랙션 (Reveal on Scroll)
   ========================================================================== */
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          obs.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.1
    });

    reveals.forEach(el => observer.observe(el));
  } else {
    // Fallback for older browsers
    reveals.forEach(el => el.classList.add('active'));
  }
}

/* ==========================================================================
   4. 연락처 팝업 모달 인터랙션 (신랑 / 신부)
   ========================================================================== */
function initContactModal() {
  const modal = document.getElementById('contact-modal');
  const closeBtn = document.getElementById('close-contact-modal');
  const groomBtn = document.getElementById('groom-contact-btn');
  const brideBtn = document.getElementById('bride-contact-btn');

  const tagEl = document.getElementById('contact-target-tag');
  const titleEl = document.getElementById('contact-modal-title');
  const phoneDisplayEl = document.getElementById('contact-phone-display');
  const telLink = document.getElementById('modal-tel-link');
  const smsLink = document.getElementById('modal-sms-link');

  const contacts = {
    groom: {
      tag: '신랑 연락처',
      title: '드미트리에게 축하 전하기',
      phone: '010-2099-1226',
      telHref: 'tel:01020991226',
      smsHref: 'sms:01020991226?body=' + encodeURIComponent('드미트리님, 결혼을 진심으로 축하드립니다!')
    },
    bride: {
      tag: '신부 연락처',
      title: '로렐라이에게 축하 전하기',
      phone: '010-2099-1227',
      telHref: 'tel:01020991227',
      smsHref: 'sms:01020991227?body=' + encodeURIComponent('로렐라이님, 결혼을 진심으로 축하드립니다!')
    }
  };

  function openModal(type) {
    const data = contacts[type];
    if (!data) return;

    tagEl.textContent = data.tag;
    titleEl.textContent = data.title;
    phoneDisplayEl.textContent = data.phone;
    telLink.href = data.telHref;
    smsLink.href = data.smsHref;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (groomBtn) groomBtn.addEventListener('click', () => openModal('groom'));
  if (brideBtn) brideBtn.addEventListener('click', () => openModal('bride'));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

/* ==========================================================================
   5. 사진 갤러리 라이트박스 뷰어
   ========================================================================== */
function initLightbox() {
  const images = [
    'pictures/함께1.png',
    'pictures/함께2.png',
    'pictures/함께3.png',
    'pictures/신랑.png',
    'pictures/신부.png'
  ];

  let currentIndex = 0;
  const modal = document.getElementById('lightbox-modal');
  const currentImg = document.getElementById('lightbox-current-img');
  const counter = document.getElementById('lightbox-counter');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');
  const closeBtn = document.getElementById('close-lightbox');

  const galleryItems = document.querySelectorAll('.gallery-item');

  function showImage(index) {
    if (index < 0) index = images.length - 1;
    if (index >= images.length) index = 0;
    currentIndex = index;

    currentImg.src = images[currentIndex];
    counter.textContent = `${currentIndex + 1} / ${images.length}`;
  }

  function openLightbox(index) {
    showImage(index);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.getAttribute('data-index'), 10) || 0;
      openLightbox(idx);
    });
  });

  if (prevBtn) prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showImage(currentIndex - 1);
  });

  if (nextBtn) nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showImage(currentIndex + 1);
  });

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('lightbox-img-wrap')) {
      closeLightbox();
    }
  });

  // 키보드 좌우 키 및 ESC 지원
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('active')) return;
    if (e.key === 'ArrowLeft') showImage(currentIndex - 1);
    if (e.key === 'ArrowRight') showImage(currentIndex + 1);
    if (e.key === 'Escape') closeLightbox();
  });

  // 모바일 터치 스와이프 지원
  let touchStartX = 0;
  let touchEndX = 0;

  modal.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  modal.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        showImage(currentIndex - 1); // 오른쪽 스와이프: 이전
      } else {
        showImage(currentIndex + 1); // 왼쪽 스와이프: 다음
      }
    }
  }
}

/* ==========================================================================
   6. 계좌 아코디언 토글 & 클립보드 복사
   ========================================================================== */
function toggleAccordion(type) {
  const targetId = type === 'groom' ? 'groom-acc-item' : 'bride-acc-item';
  const target = document.getElementById(targetId);
  if (!target) return;

  const isActive = target.classList.contains('active');
  target.classList.toggle('active', !isActive);
}

function copyToClipboard(text, accountLabel) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${accountLabel} 번호가 복사되었습니다.`);
    }).catch(() => {
      fallbackCopy(text, accountLabel);
    });
  } else {
    fallbackCopy(text, accountLabel);
  }
}

function fallbackCopy(text, accountLabel) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast(`${accountLabel} 번호가 복사되었습니다.`);
  } catch (err) {
    showToast(`계좌번호: ${text}`);
  }
  document.body.removeChild(textArea);
}

/* ==========================================================================
   7. 오시는 길 지도 바로가기
   ========================================================================== */
function openMap(type) {
  const venue = '나나컨벤션센터';
  let url = '';

  switch (type) {
    case 'naver':
      url = `https://map.naver.com/v5/search/${encodeURIComponent(venue)}`;
      break;
    case 'kakao':
      url = `https://map.kakao.com/link/search/${encodeURIComponent(venue)}`;
      break;
    case 'tmap':
      url = `https://tmap.co.kr/tmap2/mobile/route.jsp?name=${encodeURIComponent(venue)}`;
      break;
    default:
      url = `https://map.naver.com/v5/search/${encodeURIComponent(venue)}`;
  }
  window.open(url, '_blank');
}

/* ==========================================================================
   8. 방명록 (Guestbook) 로직
   ========================================================================== */
function initGuestbook() {
  const form = document.getElementById('guestbook-form');
  const nameInput = document.getElementById('gb-name');
  const msgInput = document.getElementById('gb-message');
  const listEl = document.getElementById('gb-list');

  const STORAGE_KEY = 'wedding_guestbook_messages';

  // 기본 환영 샘플 메시지
  const defaultMessages = [
    {
      name: '이수현',
      message: '드미트리, 로렐라이 두 사람의 앞날에 늘 찬란한 축복과 행복만 가득하길 바랍니다. 진심으로 축하해!',
      date: '2099.12.10'
    },
    {
      name: '김도윤',
      message: '세상에서 가장 아름다운 두 분의 새로운 시작을 응원합니다. 항상 서로를 향해 웃어주며 예쁘게 살아가세요 💐',
      date: '2099.12.12'
    }
  ];

  function loadMessages() {
    let stored = [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        stored = JSON.parse(data);
      }
    } catch (e) {
      console.error('LocalStorage error', e);
    }

    const all = [...stored, ...defaultMessages];
    renderMessages(all);
  }

  function renderMessages(messages) {
    if (!listEl) return;
    listEl.innerHTML = '';

    messages.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gb-card';
      card.innerHTML = `
        <div class="gb-card-header">
          <span class="gb-card-name">${escapeHtml(item.name)}</span>
          <span class="gb-card-date">${escapeHtml(item.date)}</span>
        </div>
        <div class="gb-card-msg">${escapeHtml(item.message)}</div>
      `;
      listEl.appendChild(card);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const message = msgInput.value.trim();

      if (!name || !message) return;

      const now = new Date();
      const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

      const newEntry = { name, message, date: dateStr };

      let stored = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) stored = JSON.parse(raw);
      } catch (e) {}

      stored.unshift(newEntry);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch (e) {}

      renderMessages([...stored, ...defaultMessages]);

      nameInput.value = '';
      msgInput.value = '';
      showToast('소중한 축하 메시지가 등록되었습니다 ✨');
    });
  }

  loadMessages();
}

/* ==========================================================================
   9. 링크 복사 & 카카오톡 공유
   ========================================================================== */
function copyPageLink() {
  const url = window.location.href;
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('청첩장 링크가 복사되었습니다 💌');
    }).catch(() => {
      fallbackCopy(url, '청첩장 링크');
    });
  } else {
    fallbackCopy(url, '청첩장 링크');
  }
}

function shareKakao() {
  if (navigator.share) {
    navigator.share({
      title: '드미트리 & 로렐라이 결혼합니다',
      text: '2099년 12월 26일 (토) 12시, 드미트리와 로렐라이의 결혼식에 초대합니다.',
      url: window.location.href
    }).catch(() => {});
  } else {
    copyPageLink();
  }
}

// 상단 헤더의 공유 버튼 연결
document.getElementById('share-top-btn')?.addEventListener('click', shareKakao);

/* ==========================================================================
   10. 토스트 알림 헬퍼
   ========================================================================== */
let toastTimeout = null;
function showToast(message) {
  const container = document.getElementById('toast-message');
  if (!container) return;

  container.textContent = message;
  container.classList.add('show');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    container.classList.remove('show');
  }, 2600);
}
