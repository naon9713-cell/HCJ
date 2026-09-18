# 06. 문서 용량 압축기

워드(.doc/.docx), 파워포인트(.ppt/.pptx), PDF, 이미지(.jpg/.jpeg/.png/.webp/.hwp/.hwpx) 파일을 업로드해 용량을 줄이는 문서 압축기(Smart Doc Compressor)입니다.

## 파일 구성

| 파일/폴더 | 설명 |
| --- | --- |
| `index.html` | 업로드 영역, 압축 진행률, 결과 다운로드 UI |
| `style.css` | 인터랙티브 배경, 카드, 진행률 바 스타일 |
| `script.js` | 파일 형식 판별, 압축 처리, 다운로드 로직 |
| `logo.png` | 헤더 로고 이미지 |
| `docs/` | 작업 확인용 스크린샷 보관 폴더 (앱 실행에는 사용되지 않음) |

## 주요 기능

- 이미지(jpg/jpeg/png/webp)는 `<canvas>`로 다시 인코딩해 원본보다 작을 때만 압축본을 사용 (gif/bmp는 원본 그대로 유지)
- 워드/PPT 파일(zip 컨테이너)은 `JSZip`으로 다시 압축(DEFLATE, level 9)
- PDF는 `compressPdfAsScan` 로직으로 페이지를 이미지로 변환해 재조립
- 압축 진행률 표시 및 압축 완료 후 파일 다운로드

## 알려진 문제 (수정됨 / 남은 문제)

- ~~`script.js`가 `getElementById('uploadBtn')`, `getElementById('fileInput')`, `getElementById('fileList')`로 존재하지 않는 id를 참조해 페이지 로드 즉시 스크립트가 멈추는 버그가 있었습니다.~~ → 실제 `index.html`의 id(`file-input`, `file-cards-list`)에 맞게 수정했고, 업로드 버튼 역할을 하던 `uploadBtn` 관련 코드는 (이미 `<label for="file-input">`가 같은 역할을 하고 있어) 제거했습니다. 브라우저로 이미지 파일을 실제로 업로드해 카드가 정상 생성되는 것까지 확인했습니다.
- `index.html`이 `pdf.min.js`, `jspdf.umd.min.js` 스크립트를 불러오도록 되어 있지만 해당 라이브러리 파일이 폴더 안에 존재하지 않습니다. 이 상태로는 **PDF 압축 기능이 콘솔 오류와 함께 동작하지 않습니다.**
- 워드/PPT 압축에 쓰이는 `JSZip` 라이브러리도 `index.html`에 스크립트로 포함되어 있지 않아 **워드/PPT 압축 기능도 동작하지 않습니다.**
- 이미지 압축 기능은 외부 라이브러리 없이 브라우저 캔버스만으로 동작하며, 업로드→압축→다운로드까지 정상 동작을 확인했습니다.
