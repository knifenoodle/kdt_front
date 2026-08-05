// 라우트 셸 전용. 로직·문자열·색을 갖지 않는다 —
// 화면 구현은 전부 src/screens/ 에 있다(uiux기획/CLAUDE.md:22-33 구조 보존, docs/02 §D).
import { Talk } from '@/screens/Talk';

export default function Page() {
  return <Talk />;
}
