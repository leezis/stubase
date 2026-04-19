# dsy-stubase-web

React + Vite 프론트엔드에 Supabase 연결을 바로 시작할 수 있도록 기본 구성을 추가해 둔 프로젝트입니다.

## 시작하기

1. 의존성 설치

```bash
npm install
```

2. 환경변수 파일 만들기

`.env.example`을 참고해서 프로젝트 루트에 `.env.local` 파일을 만들고 값을 채워 주세요.

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

값은 Supabase 대시보드의 `Project Settings > API`에서 확인할 수 있습니다.

3. 개발 서버 실행

```bash
npm run dev
```

앱이 열리면 첫 화면에서 환경변수 로드 여부와 Supabase 도달 가능 여부를 바로 확인할 수 있습니다.

## 주요 파일

- `src/lib/supabase.js`: 공용 Supabase 클라이언트와 연결 확인 함수
- `src/App.jsx`: 연결 상태를 보여주는 시작 화면
- `.env.example`: 필요한 환경변수 이름 예시

## 예시 쿼리

```js
import { supabase } from './lib/supabase'

const { data, error } = await supabase.from('todos').select('*')
```

실제 테이블 이름은 Supabase 프로젝트에 맞게 바꿔서 사용하면 됩니다.
