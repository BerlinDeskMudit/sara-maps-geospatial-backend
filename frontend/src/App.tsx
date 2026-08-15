import { AppProvider } from './app/store';
import AppShell from './app/AppShell';

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
