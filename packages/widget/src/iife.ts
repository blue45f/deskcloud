/**
 * IIFE 진입점 — 브라우저 <script> 임베드용. react/react-dom·@chatdesk/sdk 인라인 번들.
 * vite.iife.config.ts 가 이 파일을 빌드해 dist/chat-widget.js 로 내보내고,
 * window.ChatDesk = { mount, init } 으로 노출한다.
 *
 *   <script src="https://chat.example.com/chat-widget.js"></script>
 *   <script>
 *     ChatDesk.init({ publishableKey: 'pk_demo', endpoint: 'https://chat.example.com', memberId: 'alice' })
 *   </script>
 */
import { mount, init } from './vanilla'

// named export 만 — vite IIFE 가 window.ChatDesk = { mount, init } 으로 펼친다.
export { mount, init }
