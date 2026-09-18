# 09. GIF 편집 스튜디오

업로드한 GIF 파일의 정보를 보여주고, 리사이즈·크롭·다운사이징·포맷 변환·회전·최적화·역재생·속도 조절 등을 적용해볼 수 있는 GIF 편집기(GIF Studio)입니다.

## 파일 구성

| 파일 | 설명 |
| --- | --- |
| `index.html` | 업로드 화면, 원본/결과 미리보기 패널, 편집 도구 그리드 |
| `style.css` | 패널·도구 그리드·미리보기 레이아웃 스타일 |
| `script.js` | GIF 디코딩/인코딩, 각 편집 도구 로직 |
| `logo.png` | 헤더 로고 이미지 |

## 주요 기능

- GIF 업로드 시 파일 크기, 해상도, 프레임레이트(FPS), 총 프레임 수 표시
- 편집 도구: **Resize, Crop, Downsizing, Format Convert, Rotate(90/180/270·좌우/상하 반전), Optimize, Reverse(역재생), Speed(재생 속도 조절)**
- 편집 결과를 별도 패널로 렌더링, 원본/결과 각각 다운로드 가능

## 알려진 문제

- 도구 중 **Cut(구간 자르기)** 은 "Coming Soon" 상태로, 코드상 실제 기능은 구현되어 있지 않고 안내 문구만 표시됩니다.
- GIF 디코딩/인코딩에 `gifuct-js`, `gif.js.optimized`, `jszip`, `gifsicle-wasm-browser`를 CDN(jsdelivr)에서 불러오므로, **인터넷 연결이 없으면 편집 기능이 동작하지 않습니다.**
