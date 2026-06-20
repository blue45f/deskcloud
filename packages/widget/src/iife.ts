/**
 * IIFE 진입점 — 브라우저 <script> 임베드용. react/react-dom/@searchdesk/sdk 인라인 번들.
 * vite.iife.config.ts 가 이 파일을 빌드해 dist/search-widget.js 로 내보내고,
 * window.SearchDesk = { mountPalette, mountBox, init } 으로 노출한다.
 *
 *   <script src="https://search.example.com/search-widget.js"></script>
 *   <script>
 *     SearchDesk.init({ publishableKey: 'pk_…', endpoint: 'https://search.example.com' })
 *   </script>
 */
import { mountPalette, mountBox, init } from './vanilla'

// named export 만 — vite IIFE 가 window.SearchDesk = { … } 으로 펼친다.
export { mountPalette, mountBox, init }
