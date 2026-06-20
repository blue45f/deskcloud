/**
 * IIFE 진입점 — 브라우저 <script> 임베드용. react/react-dom 인라인 번들.
 * vite.iife.config.ts 가 이 파일을 빌드해 dist/authdesk-widget.js 로 내보내고,
 * window.AuthDesk = { mount, init } 으로 노출한다.
 *
 *   <div id="authdesk-form"></div>
 *   <script src="https://auth.example.com/authdesk-widget.js"></script>
 *   <script>
 *     AuthDesk.init({
 *       target: '#authdesk-form',
 *       publishableKey: 'pk_…',
 *       endpoint: 'https://auth.example.com',
 *     })
 *   </script>
 */
import { mount, init } from './vanilla'

// named export 만 — vite IIFE 가 window.AuthDesk = { mount, init } 으로 펼친다.
export { mount, init }
