/**
 * IIFE 진입점 — 브라우저 <script> 임베드용. react/react-dom·@realtimedesk/sdk 인라인 번들.
 * vite.iife.config.ts 가 이 파일을 빌드해 dist/realtime-widget.js 로 내보내고,
 * window.RealtimeDesk = { mount, init } 으로 노출한다.
 *
 *   <script src="https://realtime.example.com/realtime-widget.js"></script>
 *   <script>
 *     RealtimeDesk.init({
 *       target: '#presence', channel: 'room:42',
 *       publishableKey: 'pk_…', endpoint: 'https://realtime.example.com',
 *     })
 *   </script>
 */
import { mount, init } from "./vanilla";

// named export 만 — vite IIFE 가 window.RealtimeDesk = { mount, init } 으로 펼친다.
export { mount, init };
