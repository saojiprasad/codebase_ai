import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ApiExplorer } from "./pages/ApiExplorer";
import { Architecture } from "./pages/Architecture";
import { BugReport } from "./pages/BugReport";
import { Chat } from "./pages/Chat";
import { Dashboard } from "./pages/Dashboard";
import { Landing } from "./pages/Landing";
import { Overview } from "./pages/Overview";
import { ReadmePage } from "./pages/ReadmePage";
import { Settings } from "./pages/Settings";
import { Upload } from "./pages/Upload";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="/api" element={<ApiExplorer />} />
        <Route path="/bugs" element={<BugReport />} />
        <Route path="/readme" element={<ReadmePage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

