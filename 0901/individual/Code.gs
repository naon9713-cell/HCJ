/**
 * 웹 앱 접속 시 index.html 화면을 렌더링합니다.
 */
function doGet() {
  const output = HtmlService.createTemplateFromFile('index').evaluate();
  
  output.setTitle('교육자료 신청 및 설문조사')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  return output;
}

/**
 * 프론트엔드(index.html)에서 제출한 폼 데이터를 처리하여 스프레드시트에 저장합니다.
 * @param {Object} formData 클라이언트에서 전송한 데이터 객체
 */
function submitData(formData) {
  try {
    // 바인딩된 현재 활성 스프레드시트를 가져옵니다.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('신청응답');
    
    // '신청응답' 시트가 없을 경우 자동 생성 및 헤더(첫 행) 설정
    if (!sheet) {
      sheet = ss.insertSheet('신청응답');
      sheet.appendRow([
        '제출일시', 
        '신청자명', 
        '소속/학과',
        '학번/직번',
        '연락처 이메일', 
        '강의 만족도', 
        '희망하는 추가 교육주제',
        '교수님께 전하는 메시지'
      ]);
      // 헤더 스타일 지정 (굵게, 배경색 적용)
      sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#f3f4f6');
    }

    // 제출 시간 생성 (한국 표준시 기준)
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    
    // 데이터 행 추가
    sheet.appendRow([
      now,
      formData.userName,
      formData.department,
      formData.studentId,
      formData.userEmail,
      formData.satisfaction,
      formData.desiredTopic,
      formData.message
    ]);

    return { status: 'success' };
  } catch (error) {
    return { status: 'error', message: error.toString() };
  }
}
