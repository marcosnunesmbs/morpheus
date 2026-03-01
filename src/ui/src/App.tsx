import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { AuthGuard } from './components/AuthGuard';

const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const ChatPage = lazy(() => import('./pages/Chat').then(m => ({ default: m.ChatPage })));
const Settings = lazy(() => import('./pages/Settings'));
const Logs = lazy(() => import('./pages/Logs').then(m => ({ default: m.Logs })));
const UsageStats = lazy(() => import('./pages/UsageStats').then(m => ({ default: m.UsageStats })));
const SatiMemories = lazy(() => import('./pages/SatiMemories').then(m => ({ default: m.SatiMemories })));
const MCPManager = lazy(() => import('./pages/MCPManager').then(m => ({ default: m.MCPManager })));
const ModelPricing = lazy(() => import('./pages/ModelPricing').then(m => ({ default: m.ModelPricing })));
const WebhookManager = lazy(() => import('./pages/WebhookManager').then(m => ({ default: m.WebhookManager })));
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const TasksPage = lazy(() => import('./pages/Tasks').then(m => ({ default: m.TasksPage })));
const TrinityDatabases = lazy(() => import('./pages/TrinityDatabases').then(m => ({ default: m.TrinityDatabases })));
const ChronosPage = lazy(() => import('./pages/Chronos').then(m => ({ default: m.ChronosPage })));
const SkillsPage = lazy(() => import('./pages/Skills').then(m => ({ default: m.SkillsPage })));
const SmithsPage = lazy(() => import('./pages/Smiths').then(m => ({ default: m.SmithsPage })));
const SessionAudit = lazy(() => import('./pages/SessionAudit').then(m => ({ default: m.SessionAudit })));

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
                <Suspense fallback={null}>
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
                </Suspense>
              </Layout>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
