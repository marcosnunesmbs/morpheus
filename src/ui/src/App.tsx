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
import { Projects } from './pages/Projects';
import { Tasks } from './pages/Tasks';

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
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/tasks" element={<Tasks />} />
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
