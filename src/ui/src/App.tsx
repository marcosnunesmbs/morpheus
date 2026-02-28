import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ChatPage } from './pages/Chat';
import Settings from './pages/Settings';
import { Logs } from './pages/Logs';
import { UsageStats } from './pages/UsageStats';
import { Login } from './pages/Login';
import { AuthGuard } from './components/AuthGuard';
import { SatiMemories } from './pages/SatiMemories';
import { MCPManager } from './pages/MCPManager';
import { ModelPricing } from './pages/ModelPricing';
import { WebhookManager } from './pages/WebhookManager';
import { Notifications } from './pages/Notifications';
import { TasksPage } from './pages/Tasks';
import { TrinityDatabases } from './pages/TrinityDatabases';
import { ChronosPage } from './pages/Chronos';
import { SkillsPage } from './pages/Skills';
import { SmithsPage } from './pages/Smiths';
import { SessionAudit } from './pages/SessionAudit';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/zaion" element={<Settings />} />
                  <Route path="/logs" element={<Logs />} />
                  <Route path="/stats" element={<UsageStats />} />
                  <Route path="/sati-memories" element={<SatiMemories />} />
                  <Route path="/mcp-servers" element={<MCPManager />} />
                  <Route path="/model-pricing" element={<ModelPricing />} />
                  <Route path="/webhooks" element={<WebhookManager />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/trinity-databases" element={<TrinityDatabases />} />
                  <Route path="/chronos" element={<ChronosPage />} />
                  <Route path="/skills" element={<SkillsPage />} />
                  <Route path="/smiths" element={<SmithsPage />} />
                  <Route path="/sessions/:id/audit" element={<SessionAudit />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
