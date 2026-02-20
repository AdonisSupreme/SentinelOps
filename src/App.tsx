// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ChecklistProvider } from './contexts/checklistContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DatabaseStatsPage from './pages/DatabaseStatsPage';
import ChecklistPage from './pages/ChecklistPage';
import ChecklistsPage from './pages/ChecklistsPage';
import PerformancePage from './pages/PerformancePage';
import NotFoundPage from './pages/NotFoundPage';
import UserManagementPage from './pages/UserManagementPage';
import AdvancedTeamManagementPage from './pages/AdvancedTeamManagementPage';
import UserScheduleDashboard from './pages/UserScheduleDashboard';
import TemplateManagerPage from './pages/TemplateManagerPage';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import ScrollToTop from './components/ui/ScrollToTop';
import PrivateRoute from './components/auth/PrivateRoute';
import NotificationContainer from './components/ui/NotificationContainer';
import { GlobalStyles } from './styles/GlobalStyles';
import './App.css';
import './styles/variables.css';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
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
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/database-stats" element={<DatabaseStatsPage />} />
                        <Route path="/checklists" element={<ChecklistsPage />} />
                        <Route path="/checklist/:id" element={<ChecklistPage />} />
                        <Route path="/templates" element={<TemplateManagerPage />} />
                        <Route path="/performance" element={<PerformancePage />} />
                        <Route path="/users" element={<UserManagementPage />} />
                        <Route path="/team" element={<AdvancedTeamManagementPage />} />
                        <Route path="/schedule" element={<UserScheduleDashboard />} />
                      </Route>

                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </AnimatePresence>
                </main>
                
                <Footer />
              </div>

              <ScrollToTop />
              <NotificationContainer />
            </ChecklistProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;