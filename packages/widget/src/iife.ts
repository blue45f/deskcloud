/**
 * IIFE 진입점 — 브라우저 <script> 임베드용. react/react-dom 인라인 번들.
 * vite.iife.config.ts 가 이 파일을 빌드해 dist/filedesk-widget.js 로 내보내고,
 * window.FileDesk = { mount, init } 으로 노출한다.
 *
 *   <div id="filedesk-upload"></div>
 *   <script src="https://files.example.com/filedesk-widget.js"></script>
 *   <script>
 *     FileDesk.init({
 *       target: '#filedesk-upload',
 *       publishableKey: 'pk_…',
 *       endpoint: 'https://files.example.com',
 *     })
 *   </script>
 */
import { mount, init } from './vanilla'

// named export 만 — vite IIFE 가 window.FileDesk = { mount, init } 으로 펼친다.
export { mount, init }
