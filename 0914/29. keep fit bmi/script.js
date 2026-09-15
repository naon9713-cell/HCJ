(function () {
  'use strict';

  // ---------- 상태 ----------
  let selectedGender = 'male';

  // ---------- DOM ----------
  const genderBtns = document.querySelectorAll('.gender-btn');
  const heightInput = document.getElementById('height');
  const weightInput = document.getElementById('weight');
  const errorMsg = document.getElementById('error-msg');
  const calcBtn = document.getElementById('calc-btn');
  const resetBtn = document.getElementById('reset-btn');

  const inputScreen = document.getElementById('input-screen');
  const resultScreen = document.getElementById('result-screen');

  const bmiValueEl = document.getElementById('bmi-value');
  const bmiCategoryEl = document.getElementById('bmi-category');
  const infoDetailEl = document.getElementById('info-detail');
  const standardWeightEl = document.getElementById('standard-weight');
  const obesityPctEl = document.getElementById('obesity-pct');

  // ---------- 성별 토글 ----------
  genderBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      genderBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedGender = btn.dataset.gender;
    });
  });

  // ---------- 계산 로직 (순수 함수: 검증 용이) ----------

  /**
   * BMI 계산
   * @param {number} weightKg
   * @param {number} heightCm
   * @returns {number}
   */
  function calcBMI(weightKg, heightCm) {
    const hM = heightCm / 100;
    return weightKg / (hM * hM);
  }

  /**
   * 표준체중 계산 (대한비만학회 통용 공식: 남 22, 여 21)
   * @param {number} heightCm
   * @param {'male'|'female'} gender
   * @returns {number}
   */
  function calcStandardWeight(heightCm, gender) {
    const hM = heightCm / 100;
    const factor = gender === 'male' ? 22 : 21;
    return hM * hM * factor;
  }

  /**
   * 비만도(%) = 현재체중 / 표준체중 * 100
   */
  function calcObesityPercent(weightKg, standardWeightKg) {
    return (weightKg / standardWeightKg) * 100;
  }

  /**
   * 90/100/110% 각 기준 목표체중 계산
   * @returns {{p90:number, p100:number, p110:number}}
   */
  function calcTargetWeights(standardWeightKg) {
    return {
      p90: standardWeightKg * 0.9,
      p100: standardWeightKg * 1.0,
      p110: standardWeightKg * 1.1,
    };
  }

  /**
   * 현재 체중과 목표 체중 간 차이
   * @returns {{diff:number, direction:'down'|'up'|'same'}}
   */
  function calcDiff(currentWeightKg, targetWeightKg) {
    const diff = currentWeightKg - targetWeightKg;
    const rounded = Math.round(Math.abs(diff) * 10) / 10;
    let direction;
    if (rounded < 0.05) direction = 'same';
    else if (diff > 0) direction = 'down'; // 목표보다 무거움 -> 감량 필요
    else direction = 'up'; // 목표보다 가벼움 -> 증량 필요
    return { diff: rounded, direction };
  }

  /**
   * BMI 값에 따른 대한비만학회(2022) 분류
   */
  function classifyBMI(bmi) {
    if (bmi < 18.5) return { label: '저체중', cls: 'under' };
    if (bmi < 23) return { label: '정상', cls: 'normal' };
    if (bmi < 25) return { label: '비만 전단계', cls: 'pre' };
    if (bmi < 30) return { label: '1단계 비만', cls: 'obese1' };
    if (bmi < 35) return { label: '2단계 비만', cls: 'obese2' };
    return { label: '3단계 비만', cls: 'obese3' };
  }

  function formatKg(n) {
    return `${n.toFixed(1)}kg`;
  }

  // ---------- 입력 검증 ----------
  function validateInputs(heightVal, weightVal) {
    if (heightVal === '' || weightVal === '') {
      return '키와 몸무게를 모두 입력해 주세요.';
    }
    const h = parseFloat(heightVal);
    const w = parseFloat(weightVal);
    if (Number.isNaN(h) || Number.isNaN(w)) {
      return '숫자만 입력할 수 있어요.';
    }
    if (h < 50 || h > 250) {
      return '키는 50cm ~ 250cm 사이로 입력해 주세요.';
    }
    if (w < 10 || w > 300) {
      return '몸무게는 10kg ~ 300kg 사이로 입력해 주세요.';
    }
    return null;
  }

  // ---------- 결과 렌더링 ----------
  function renderResult(heightCm, weightKg, gender) {
    const bmi = calcBMI(weightKg, heightCm);
    const standardWeight = calcStandardWeight(heightCm, gender);
    const obesityPct = calcObesityPercent(weightKg, standardWeight);
    const targets = calcTargetWeights(standardWeight);
    const category = classifyBMI(bmi);

    bmiValueEl.textContent = bmi.toFixed(1);

    bmiCategoryEl.textContent = category.label;
    bmiCategoryEl.className = `category-badge ${category.cls}`;

    const genderLabel = gender === 'male' ? '남성' : '여성';
    infoDetailEl.textContent = `${genderLabel} · ${heightCm}cm · ${weightKg}kg`;

    standardWeightEl.textContent = formatKg(standardWeight);
    obesityPctEl.textContent = `${obesityPct.toFixed(1)}%`;

    renderTarget('target-90', targets.p90, weightKg);
    renderTarget('target-100', targets.p100, weightKg);
    renderTarget('target-110', targets.p110, weightKg);
  }

  function renderTarget(cardId, targetWeight, currentWeight) {
    const card = document.getElementById(cardId);
    const weightEl = card.querySelector('[data-target-weight]');
    const diffEl = card.querySelector('[data-target-diff]');

    weightEl.textContent = formatKg(targetWeight);

    const { diff, direction } = calcDiff(currentWeight, targetWeight);

    diffEl.classList.remove('down', 'up', 'same');
    if (direction === 'same') {
      diffEl.textContent = '이미 도달!';
      diffEl.classList.add('same');
    } else if (direction === 'down') {
      diffEl.textContent = `${formatKg(diff)} 감량`;
      diffEl.classList.add('down');
    } else {
      diffEl.textContent = `${formatKg(diff)} 증량`;
      diffEl.classList.add('up');
    }
  }

  // ---------- 이벤트 ----------
  calcBtn.addEventListener('click', () => {
    const heightVal = heightInput.value.trim();
    const weightVal = weightInput.value.trim();

    const errText = validateInputs(heightVal, weightVal);
    if (errText) {
      errorMsg.textContent = errText;
      errorMsg.hidden = false;
      return;
    }
    errorMsg.hidden = true;

    const heightCm = parseFloat(heightVal);
    const weightKg = parseFloat(weightVal);

    renderResult(heightCm, weightKg, selectedGender);

    inputScreen.hidden = true;
    resultScreen.hidden = false;
  });

  resetBtn.addEventListener('click', () => {
    resultScreen.hidden = true;
    inputScreen.hidden = false;
    errorMsg.hidden = true;
  });

  // Enter 키로도 계산 실행
  [heightInput, weightInput].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') calcBtn.click();
    });
  });
})();
