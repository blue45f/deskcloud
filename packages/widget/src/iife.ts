/**
 * IIFE 진입점 — 브라우저 <script> 임베드용. react/react-dom 인라인 번들.
 * vite.iife.config.ts 가 이 파일을 빌드해 dist/notify-widget.js 로 내보내고,
 * window.NotifyDesk = { mount, init } 으로 노출한다.
 *
 *   <div id="notify-bell"></div>
 *   <script src="https://notify.example.com/notify-widget.js"></script>
 *   <script>
 *     NotifyDesk.init({
 *       target: '#notify-bell',
 *       recipientId: 'user_42',
 *       publishableKey: 'pk_…',
 *       endpoint: 'https://notify.example.com',
 *     })
 *   </script>
 */
import { mount, init } from './vanilla'

// named export 만 — vite IIFE 가 window.NotifyDesk = { mount, init } 으로 펼친다.
export { mount, init }
