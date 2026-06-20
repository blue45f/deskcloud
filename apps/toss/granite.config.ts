import { defineConfig } from '@apps-in-toss/web-framework/config';

// AI 소식·도구 큐레이션 다이제스트. 비게임=partner.
export default defineConfig({
  appName: 'aidigestdesk',
  brand: { displayName: 'AI다이제스트', primaryColor: '#6EA8FE', icon: '' },
  web: { host: 'localhost', port: 5183, commands: { dev: 'vite', build: 'vite build' } },
  permissions: [
    { name: 'clipboard', access: 'read' },
    { name: 'clipboard', access: 'write' },
  ],
  outdir: 'dist',
  webViewProps: { type: 'partner' },
  navigationBar: { withBackButton: true, withHomeButton: true },
});
