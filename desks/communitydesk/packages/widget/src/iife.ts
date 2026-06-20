/**
 * IIFE 진입점 — 브라우저 <script> 임베드용. react/react-dom/@communitydesk/sdk 인라인 번들.
 * vite.iife.config.ts 가 이 파일을 빌드해 dist/community-widget.js 로 내보내고,
 * window.CommunityDesk = { mount, mountFeed, init } 으로 노출한다.
 *
 *   <script src="https://community.example.com/community-widget.js"></script>
 *   <script>
 *     CommunityDesk.init({
 *       target: '#community', boardSlug: 'free',
 *       publishableKey: 'pk_...', endpoint: 'https://community.example.com',
 *     })
 *   </script>
 */
import { mount, mountFeed, init } from './vanilla'

// named export 만 — vite IIFE 가 window.CommunityDesk = { mount, mountFeed, init } 으로 펼친다.
export { mount, mountFeed, init }
