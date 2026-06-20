/**
 * IIFE 진입점 — 브라우저 <script> 임베드용. react/react-dom/@mediadesk/sdk 인라인 번들.
 * vite.iife.config.ts 가 이 파일을 빌드해 dist/media-widget.js 로 내보내고,
 * window.MediaDesk = { mountUploader, mountGallery, init, createClient } 으로 노출한다.
 *
 *   <script src="https://media.example.com/media-widget.js"></script>
 *   <script>
 *     MediaDesk.mountUploader('#uploader', { publishableKey: 'pk_…', endpoint: 'https://media.example.com' })
 *   </script>
 */
import { createClient, init, mountGallery, mountUploader } from './vanilla'

// named export 만 — vite IIFE 가 window.MediaDesk = { … } 으로 펼친다.
export { mountUploader, mountGallery, init, createClient }
