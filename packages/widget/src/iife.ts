/**
 * IIFE 진입점 — 브라우저 <script> 임베드용. react/react-dom 인라인 번들.
 * vite.iife.config.ts 가 이 파일을 빌드해 dist/feedback-widget.js 로 내보내고,
 * window.SurveyDesk = { mount, init } 으로 노출한다.
 *
 *   <script src="https://surveys.example.com/feedback-widget.js"></script>
 *   <script>
 *     SurveyDesk.init({ appId: 'offhours', endpoint: 'https://surveys.example.com' })
 *   </script>
 */
import { mount, init } from './vanilla'

// named export 만 — vite IIFE 가 window.SurveyDesk = { mount, init } 으로 펼친다.
export { mount, init }
