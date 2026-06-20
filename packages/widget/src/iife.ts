/**
 * IIFE(브라우저 <script>) 진입점 — react/react-dom 인라인 번들.
 * vite.iife.config.ts 가 이 파일을 빌드해 dist/reviewdesk-widget.js 로 내보내고,
 * window.ReviewDesk = { init, stars, list, form, wall } 으로 노출한다.
 *
 *   <script src="https://reviews.example.com/reviewdesk-widget.js"></script>
 *   <script>
 *     ReviewDesk.init({ publishableKey: 'pk_live_...', endpoint: 'https://reviews.example.com' })
 *   </script>
 */
import { form, init, list, stars, wall } from './vanilla'

// named export 만 — vite IIFE 가 window.ReviewDesk = { ... } 으로 펼친다.
export { init, stars, list, form, wall }
