import { UpdateDetailPage } from './pages/UpdateDetailPage.tsx';
import { UpdateListPage } from './pages/UpdateListPage.tsx';
import { useHashPath } from './router';

export function App() {
  const path = useHashPath();
  const m = path.match(/^\/update\/(.+)$/);
  if (m) return <UpdateDetailPage id={decodeURIComponent(m[1])} />;
  return <UpdateListPage />;
}
