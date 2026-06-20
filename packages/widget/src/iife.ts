/**
 * IIFE 진입점 — 브라우저 <script> 임베드용. react/react-dom 인라인 번들.
 * vite.iife.config.ts 가 이 파일을 빌드해 dist/report-button.js 로 내보내고,
 * window.ModerationDesk = { mount, init } 으로 노출한다.
 *
 *   <script src="https://moderate.example.com/report-button.js"></script>
 *   <script>
 *     ModerationDesk.init({
 *       target: '#report-slot',
 *       subjectType: 'comment', subjectId: 'c_123',
 *       publishableKey: 'pk_...', endpoint: 'https://moderate.example.com'
 *     })
 *   </script>
 */
import { mount, init } from './vanilla'

// named export 만 — vite IIFE 가 window.ModerationDesk = { mount, init } 으로 펼친다.
export { mount, init }
