/**
 * Smart QR Studio - High-End Interactive Script
 * script.js
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('qr-form');
  const urlInput = document.getElementById('url-input');
  const clearBtn = document.getElementById('clear-btn');
  const pasteBtn = document.getElementById('paste-btn');
  const qrcodeContainer = document.getElementById('qrcode');
  const qrCard = document.getElementById('qr-card');
  const scanLine = document.getElementById('scan-line');
  const urlPreview = document.getElementById('qr-target-url-preview');
  const logoRefresh = document.getElementById('logo-refresh');
  const cardDownloadBtn = document.getElementById('card-download-btn');
  const cardCopyBtn = document.getElementById('card-copy-btn');
  const interactiveBg = document.getElementById('interactive-bg');

  let currentQRCode = null;
  let currentTargetUrl = '';

  // --------------------------------------------------------------------------
  // 0. 마우스 커서 위치에 따른 실시간 그라데이션 색상 & 오라 추적 인터랙션
  // --------------------------------------------------------------------------
  initInteractiveGradient();

  function initInteractiveGradient() {
    if (!interactiveBg) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let isMouseMoving = false;
    let autoTime = 0;

    // 마우스 이동 시 좌표 및 색조(Hue) 계산
    window.addEventListener('mousemove', (e) => {
      isMouseMoving = true;
      targetX = e.clientX;
      targetY = e.clientY;

      const xRatio = targetX / window.innerWidth;
      const yRatio = targetY / window.innerHeight;

      // 마우스 위치에 따른 색조 회전 (좌우/상하 이동에 따라 -35deg ~ +35deg 범위의 은은한 파스텔 시프트)
      const hueShift = Math.round((xRatio - 0.5) * 45 + (yRatio - 0.5) * 30);
      
      const xPercent = (xRatio * 100).toFixed(1);
      const yPercent = (yRatio * 100).toFixed(1);

      interactiveBg.style.setProperty('--mouse-x-num', xPercent);
      interactiveBg.style.setProperty('--mouse-y-num', yPercent);
      interactiveBg.style.setProperty('--hue-shift', `${hueShift}deg`);
    });

    // 모바일 터치 드래그 지원
    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        isMouseMoving = true;
        targetX = e.touches[0].clientX;
        targetY = e.touches[0].clientY;

        const xRatio = targetX / window.innerWidth;
        const yRatio = targetY / window.innerHeight;
        const hueShift = Math.round((xRatio - 0.5) * 40);

        interactiveBg.style.setProperty('--mouse-x-num', (xRatio * 100).toFixed(1));
        interactiveBg.style.setProperty('--mouse-y-num', (yRatio * 100).toFixed(1));
        interactiveBg.style.setProperty('--hue-shift', `${hueShift}deg`);
      }
    }, { passive: true });

    // 부드러운 감속 추적(Lerp) 렌더링 루프
    function renderAura() {
      // 마우스가 멈춰있을 때는 살랑살랑 숨쉬는 미세 자율 모션
      if (!isMouseMoving) {
        autoTime += 0.015;
        targetX = (window.innerWidth / 2) + Math.sin(autoTime) * (window.innerWidth * 0.18);
        targetY = (window.innerHeight / 2) + Math.cos(autoTime * 0.8) * (window.innerHeight * 0.12);
        
        const autoHue = Math.sin(autoTime * 0.5) * 20;
        interactiveBg.style.setProperty('--hue-shift', `${autoHue}deg`);
      }

      // 선형 보간으로 쫀득하고 매끄럽게 마우스 따라가기
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;

      interactiveBg.style.setProperty('--cursor-x', `${currentX.toFixed(1)}px`);
      interactiveBg.style.setProperty('--cursor-y', `${currentY.toFixed(1)}px`);

      requestAnimationFrame(renderAura);
    }

    renderAura();

    // 마우스가 일정 시간 멈추면 자율 모드로 전환
    let idleTimer = null;
    window.addEventListener('mousemove', () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isMouseMoving = false;
      }, 3000);
    });
  }

  // --------------------------------------------------------------------------
  // 1. 입력창 실시간 상태 관리 (x 버튼 및 붙여넣기 버튼)
  // --------------------------------------------------------------------------
  urlInput.addEventListener('input', () => {
    updateInputControls();
  });

  function updateInputControls() {
    if (urlInput.value.trim().length > 0) {
      clearBtn.classList.add('visible');
      if (pasteBtn) pasteBtn.style.display = 'none';
    } else {
      clearBtn.classList.remove('visible');
      if (pasteBtn && window.innerWidth > 640) pasteBtn.style.display = 'block';
    }
  }

  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    updateInputControls();
    urlInput.focus();
  });

  // 붙여넣기 버튼 클릭
  if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            urlInput.value = text.trim();
            updateInputControls();
            showToast('클립보드 내용이 붙여넣어졌습니다 📋');
          }
        } else {
          urlInput.focus();
        }
      } catch (err) {
        urlInput.focus();
      }
    });
  }

  // --------------------------------------------------------------------------
  // 2. 폼 제출 -> QR코드 생성 및 트랜지션 애니메이션 (요구사항 4)
  // --------------------------------------------------------------------------
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawValue = urlInput.value.trim();

    if (!rawValue) {
      showToast('URL 주소를 입력해 주세요.');
      urlInput.focus();
      return;
    }

    // URL 프로토콜 자동 보정
    let finalUrl = rawValue;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    currentTargetUrl = finalUrl;

    // QR 코드 생성
    generateQRCode(finalUrl);

    // 상태 전환: 입력창이 하단으로 슬라이드 다운 & 중앙에 QR 생성
    document.body.classList.remove('state-initial');
    document.body.classList.add('state-generated');

    // URL 프리뷰 업데이트
    if (urlPreview) {
      urlPreview.textContent = finalUrl;
      urlPreview.title = '클릭하여 복사: ' + finalUrl;
    }

    // 네온 레이저 스캔 애니메이션 트리거
    triggerScanLine();

    showToast('고화질 QR코드가 생성되었습니다 ✨');
  });

  // --------------------------------------------------------------------------
  // 3. QR코드 렌더링 함수
  // --------------------------------------------------------------------------
  function generateQRCode(url) {
    qrcodeContainer.innerHTML = '';

    currentQRCode = new QRCode(qrcodeContainer, {
      text: url,
      width: 230,
      height: 230,
      colorDark: '#054395', // 로고의 딥 블루로 더욱 세련된 QR 렌더링
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  function triggerScanLine() {
    if (!scanLine) return;
    scanLine.classList.remove('scanning');
    void scanLine.offsetWidth; // Force Reflow
    scanLine.classList.add('scanning');
  }

  // --------------------------------------------------------------------------
  // 4. 요구사항 5: QR코드 클릭 시 고화질 JPG 파일 다운로드
  // --------------------------------------------------------------------------
  qrCard.addEventListener('click', (e) => {
    // 하단 버튼을 직접 클릭한 경우는 중복 방지
    if (e.target.closest('#card-copy-btn') || e.target.closest('#card-download-btn') || e.target.closest('#qr-target-url-preview')) {
      return;
    }
    if (!currentTargetUrl) return;
    downloadQRCodeAsJpg(currentTargetUrl);
  });

  if (cardDownloadBtn) {
    cardDownloadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!currentTargetUrl) return;
      downloadQRCodeAsJpg(currentTargetUrl);
    });
  }

  // --------------------------------------------------------------------------
  // 5. 800x800 무손실 JPG 다운로드 엔진
  // --------------------------------------------------------------------------
  function downloadQRCodeAsJpg(url) {
    const sourceCanvas = qrcodeContainer.querySelector('canvas');
    const sourceImg = qrcodeContainer.querySelector('img');

    if (!sourceCanvas && !sourceImg) {
      showToast('QR코드를 준비 중입니다. 잠시 후 다시 클릭해 주세요.');
      return;
    }

    const exportSize = 800;
    const padding = 100;
    const qrSize = exportSize - (padding * 2);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    const ctx = exportCanvas.getContext('2d');

    // 순백색 배경 채우기 (스캔 정확도 100% 보장)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, exportSize, exportSize);

    function triggerDownload() {
      const jpgDataUrl = exportCanvas.toDataURL('image/jpeg', 0.96);

      let domain = 'code';
      try {
        const urlObj = new URL(url);
        domain = urlObj.hostname.replace(/[^a-zA-Z0-9]/g, '_');
      } catch (e) {
        domain = 'qr';
      }

      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `SmartQR_${domain}_${timestamp}.jpg`;

      const downloadLink = document.createElement('a');
      downloadLink.href = jpgDataUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      showToast(`'${filename}' 파일이 다운로드되었습니다 📥`);
    }

    if (sourceCanvas) {
      ctx.drawImage(sourceCanvas, padding, padding, qrSize, qrSize);
      triggerDownload();
    } else if (sourceImg && sourceImg.src) {
      const tempImg = new Image();
      tempImg.crossOrigin = 'anonymous';
      tempImg.onload = () => {
        ctx.drawImage(tempImg, padding, padding, qrSize, qrSize);
        triggerDownload();
      };
      tempImg.src = sourceImg.src;
    }
  }

  // --------------------------------------------------------------------------
  // 6. URL 복사 기능
  // --------------------------------------------------------------------------
  function copyCurrentUrl() {
    if (!currentTargetUrl) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentTargetUrl).then(() => {
        showToast('URL 주소가 복사되었습니다 🔗');
      }).catch(() => fallbackCopy(currentTargetUrl));
    } else {
      fallbackCopy(currentTargetUrl);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('URL 주소가 복사되었습니다 🔗');
    } catch (e) {}
    document.body.removeChild(ta);
  }

  if (cardCopyBtn) {
    cardCopyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyCurrentUrl();
    });
  }

  if (urlPreview) {
    urlPreview.addEventListener('click', (e) => {
      e.stopPropagation();
      copyCurrentUrl();
    });
  }

  // --------------------------------------------------------------------------
  // 7. QR 카드 3D 틸트 (Tilt) 인터랙션
  // --------------------------------------------------------------------------
  if (window.matchMedia('(pointer: fine)').matches) {
    qrCard.addEventListener('mousemove', (e) => {
      const rect = qrCard.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      const rotateX = -(y / (rect.height / 2)) * 6;
      const rotateY = (x / (rect.width / 2)) * 6;

      qrCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale(1.02)`;
    });

    qrCard.addEventListener('mouseleave', () => {
      qrCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)';
    });
  }

  // --------------------------------------------------------------------------
  // 8. 상단 로고 클릭 시 홈으로 리셋
  // --------------------------------------------------------------------------
  if (logoRefresh) {
    logoRefresh.addEventListener('click', (e) => {
      e.preventDefault();
      document.body.classList.remove('state-generated');
      document.body.classList.add('state-initial');
      urlInput.value = '';
      updateInputControls();
      qrcodeContainer.innerHTML = '';
      currentTargetUrl = '';
      urlInput.focus();
    });
  }

  // --------------------------------------------------------------------------
  // 9. 글래스 토스트 알림 헬퍼
  // --------------------------------------------------------------------------
  let toastTimer = null;
  function showToast(message) {
    const toastContainer = document.getElementById('toast-message');
    if (!toastContainer) return;

    const textEl = toastContainer.querySelector('.toast-text');
    if (textEl) {
      textEl.textContent = message;
    } else {
      toastContainer.textContent = message;
    }

    toastContainer.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastContainer.classList.remove('show');
    }, 2800);
  }

  // 초기 로드 시 입력창 포커스
  setTimeout(() => {
    urlInput.focus();
    updateInputControls();
  }, 120);
});
