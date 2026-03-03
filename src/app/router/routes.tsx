import { Route, Routes } from 'react-router-dom';
import type { AppRuntimeOptions } from './runtime.ts';
import AppRoot from '../AppRoot.tsx';

export function AppRoutes({ runtime }: { runtime: AppRuntimeOptions }) {
  return (
    <Routes>
      <Route path="/" element={<AppRoot runtime={runtime} />} />
      <Route path="/guidelines" element={<AppRoot runtime={runtime} />} />
      <Route path="/player-guide" element={<AppRoot runtime={runtime} />} />
      <Route path="/offline" element={<AppRoot runtime={runtime} />} />
      <Route path="/rooms/:roomId" element={<AppRoot runtime={runtime} />} />
      <Route path="*" element={<AppRoot runtime={runtime} />} />
    </Routes>
  );
}
