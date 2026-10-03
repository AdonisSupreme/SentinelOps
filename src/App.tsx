import { AccessProvider, PageAccess } from './contexts/AccessContext';
import AccessManagementPage from './pages/AccessManagementPage';
// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ChecklistProvider } from './contexts/checklistContext';
import { AppConfigProvider } from './contexts/AppConfigContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DatabaseStatsPage from './pages/DatabaseStatsPage';
import ChecklistPage from './pages/ChecklistPage';
import ChecklistsPage from './pages/ChecklistsPage';
import TaskCenterPage from './pages/TaskCenterPage';
import PerformancePage from './pages/PerformancePage';
import NotFoundPage from './pages/NotFoundPage';
import UserManagementPage from './pages/UserManagementPage';
import AdvancedTeamManagementPage from './pages/AdvancedTeamManagementPage';
import UserScheduleDashboard from './pages/UserScheduleDashboard';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import SentinelManualPage from './pages/SentinelManualPage';
import TemplateManagerPage from './pages/TemplateManagerPage';
import TrustlinkOperationsPage from './pages/TrustlinkOperationsPage';
import NetworkSentinelPage from './pages/NetworkSentinelPage';
import NexusPage from './pages/NexusPage';
import FundsCustodyPage from './pages/FundsCustodyPage';
import ReportsPage from './pages/ReportsPage';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import ScrollToTop from './components/ui/ScrollToTop';
import PrivateRoute from './components/auth/PrivateRoute';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { GlobalStyles } from './styles/GlobalStyles';
import './App.css';
import './styles/variables.css';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ThemeProvider>
          <AuthProvider>
            <AccessProvider><AppConfigProvider>
              <NotificationProvider>
                <ChecklistProvider>
                <GlobalStyles />
                
                <div className="app-layout">
                  <Header />
                  
                  <main className="main-content">
                    <AnimatePresence mode="wait">
                      <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        
                        {/* Protected Routes */}
                        <Route element={<PrivateRoute />}>
                          <Route path="/" element={<PageAccess><DashboardPage /></PageAccess>} />
                          <Route path="/database-stats" element={<PageAccess><DatabaseStatsPage /></PageAccess>} />
                          <Route path="/checklists" element={<PageAccess><ChecklistsPage /></PageAccess>} />
                          <Route path="/checklist/:id" element={<PageAccess><ChecklistPage /></PageAccess>} />
                          <Route path="/tasks" element={<PageAccess><TaskCenterPage /></PageAccess>} />
                          <Route path="/templates" element={<PageAccess><TemplateManagerPage /></PageAccess>} />
                          <Route path="/trustlink" element={<PageAccess><TrustlinkOperationsPage /></PageAccess>} />
                          <Route path="/network-sentinel" element={<PageAccess><NetworkSentinelPage /></PageAccess>} />
                          <Route path="/nexus" element={<PageAccess><NexusPage /></PageAccess>} />
                          <Route path="/funds-custody" element={<PageAccess><FundsCustodyPage /></PageAccess>} />
                          <Route path="/reports" element={<PageAccess><ReportsPage /></PageAccess>} />
                          <Route path="/performance" element={<PageAccess><PerformancePage /></PageAccess>} />
                          <Route path="/access" element={<PageAccess><AccessManagementPage /></PageAccess>} />
                          <Route path="/users" element={<PageAccess><UserManagementPage /></PageAccess>} />
                          <Route path="/team" element={<PageAccess><AdvancedTeamManagementPage /></PageAccess>} />
                          <Route path="/schedule" element={<PageAccess><UserScheduleDashboard /></PageAccess>} />
                          <Route path="/settings" element={<PageAccess><ProfileSettingsPage /></PageAccess>} />
                          <Route path="/manual" element={<PageAccess><SentinelManualPage /></PageAccess>} />
                        </Route>

                        <Route path="*" element={<NotFoundPage />} />
                      </Routes>
                    </AnimatePresence>
                  </main>
                  
                  <Footer />
                </div>

                <ScrollToTop />
                </ChecklistProvider>
              </NotificationProvider>
            </AppConfigProvider></AccessProvider>
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
