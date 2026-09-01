/*******************************************************
 * 스터디 시간 조율 (Google Apps Script Web App)
 * DB: Google Spreadsheet
 *
 * 시트 헤더 구성 (1행)
 *  A: 타임스탬프
 *  B: 회차(주차)
 *  C: 학번
 *  D: 이름
 *  E: 가능한 시간대
 *  F: 비고
 *  G: 동아리 활동 내용
 *
 * 중복 제출 방지 범위: "같은 회차 안에서 같은 학번"만 막습니다.
 * 회차가 바뀌면(주차가 넘어가면) 같은 학번도 다시 제출할 수 있습니다.
 *******************************************************/

// ▼▼▼ 본인이 만든 스프레드시트 URL로 교체하세요 ▼▼▼
const SHEET_URL  = 'https://docs.google.com/spreadsheets/d/1eB9tVx2mS4ygauWLxutBb7270ukSvjtkYZJ30a1LyuA/edit';
const SHEET_NAME = '시트1';   // 탭 이름이 다르면 수정 (없으면 첫 번째 시트 사용)

// ▼▼▼ 새로운 주차가 시작될 때마다 이 값만 바꾸고
//     "배포 관리 → 연필 아이콘 → 새 버전"으로 재배포하세요. (URL은 그대로 유지됩니다) ▼▼▼
const CURRENT_ROUND = '1주차';

const COL = {
  TIMESTAMP: 1, // A
  ROUND: 2, // B
  STUDENT_ID: 3, // C
  NAME: 4, // D
  TIME_SLOTS: 5, // E
  NOTE: 6, // F
  CLUB_ACTIVITY: 7  // G
};

/** 웹앱 진입점 (회차 값을 화면에 내려줌) */
function doGet() {
  const tpl = HtmlService.createTemplateFromFile('index');
  tpl.currentRound = CURRENT_ROUND;
  return tpl.evaluate()
    .setTitle('스터디 시간 조율')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** 시트 핸들 */
function getSheet_() {
  const ss = SpreadsheetApp.openByUrl(SHEET_URL);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  if (!sheet) throw new Error('시트를 찾을 수 없습니다.');
  return sheet;
}

/** 학번 정규화: 공백 제거 + 대문자 (숫자 서식으로 저장된 값도 문자열로 통일) */
function normalizeId_(value) {
  if (value === null || value === undefined) return '';
  let s = String(value).trim();
  if (typeof value === 'number') s = value.toFixed(0);
  return s.replace(/\s+/g, '').toUpperCase();
}

/** 현재 회차(CURRENT_ROUND)에 이미 제출한 학번 목록 */
function getExistingIdsForCurrentRound_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return {};
  const range = sheet.getRange(2, COL.ROUND, last - 1, COL.STUDENT_ID - COL.ROUND + 1).getValues();
  const map = {};
  for (let i = 0; i < range.length; i++) {
    const round = String(range[i][0]).trim();
    const id = normalizeId_(range[i][1]);
    if (round === CURRENT_ROUND && id) map[id] = true;
  }
  return map;
}

/** 현재 회차 값 조회용 (필요 시 클라이언트에서 재확인) */
function getCurrentRound() {
  return CURRENT_ROUND;
}

/**
 * 실시간 중복 확인 (입력 중 안내용) - 현재 회차 기준
 * @return {{duplicated: boolean}}
 */
function checkStudentId(studentId) {
  const id = normalizeId_(studentId);
  if (!id) return { duplicated: false };
  const exists = getExistingIdsForCurrentRound_(getSheet_());
  return { duplicated: !!exists[id] };
}

/**
 * 제출 처리 (같은 회차 내 학번 중복 시 저장하지 않음)
 * data.timeSlots: ["월 09:00-12:00", "수 15:00-18:00", ...] 형태의 배열
 * @return {{ok: boolean, code?: string, message?: string}}
 */
function submitForm(data) {
  data = data || {};

  const studentId    = normalizeId_(data.studentId);
  const name         = String(data.name || '').trim();
  const note         = String(data.note || '').trim();
  const clubActivity = String(data.clubActivity || '').trim();
  const timeSlots    = Array.isArray(data.timeSlots) ? data.timeSlots.filter(String) : [];

  // 서버측 필수값 검증
  if (!studentId) return { ok: false, code: 'INVALID', message: '학번을 입력해 주세요.' };
  if (!name)      return { ok: false, code: 'INVALID', message: '이름을 입력해 주세요.' };
  if (timeSlots.length === 0) {
    return { ok: false, code: 'INVALID', message: '가능한 시간대를 1개 이상 선택해 주세요.' };
  }
  if (!clubActivity) return { ok: false, code: 'INVALID', message: '동아리 활동 내용을 입력해 주세요.' };

  // 동시 제출로 인한 중복 저장 방지
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    return { ok: false, code: 'BUSY', message: '접속이 몰리고 있습니다. 잠시 후 다시 시도해 주세요.' };
  }

  try {
    const sheet = getSheet_();
    const exists = getExistingIdsForCurrentRound_(sheet);

    if (exists[studentId]) {
      return {
        ok: false,
        code: 'DUPLICATE',
        message: '이미 ' + CURRENT_ROUND + '에 제출한 학번입니다. (회차당 1회만 제출할 수 있습니다)'
      };
    }

    sheet.appendRow([
      new Date(),              // A 타임스탬프
      CURRENT_ROUND,           // B 회차
      studentId,               // C 학번
      name,                    // D 이름
      timeSlots.join(', '),    // E 가능한 시간대
      note,                    // F 비고
      clubActivity             // G 동아리 활동 내용
    ]);

    // 학번이 숫자로 변환되지 않도록 텍스트 서식 고정
    sheet.getRange(sheet.getLastRow(), COL.STUDENT_ID).setNumberFormat('@');

    return { ok: true, message: '스터디 시간 조율에 참여해 주셔서 감사합니다!' };
  } catch (err) {
    return { ok: false, code: 'ERROR', message: '저장 중 오류가 발생했습니다: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

/** (선택) 최초 1회 실행 – 헤더 자동 생성 */
function setupHeader() {
  const sheet = getSheet_();
  const header = ['타임스탬프', '회차', '학번', '이름', '가능한 시간대', '비고', '동아리 활동 내용'];
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  sheet.getRange('C:C').setNumberFormat('@'); // 학번 열 텍스트 서식
  sheet.setFrozenRows(1);
}
