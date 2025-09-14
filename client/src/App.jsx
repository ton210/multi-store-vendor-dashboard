import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Toolbar } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';

// Components
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';

// Pages
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Stores from './pages/Stores';
import Vendors from './pages/Vendors';
import Messages from './pages/Messages';
import Analytics from './pages/Analytics';
import Assignments from './pages/Assignments';
import Settings from './pages/Settings';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </Box>
    );
  }

  return user ? children : <Navigate to="/auth" />;
};

const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);

  return isLogin ? (
    <Login onSwitchToRegister={() => setIsLogin(false)} />
  ) : (
    <Register onSwitchToLogin={() => setIsLogin(true)} />
  );
};

const MainLayout = ({ children }) => {
  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Navbar />
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/auth"
        element={user ? <Navigate to="/dashboard" /> : <AuthScreen />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Orders />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stores"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Stores />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendors"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Vendors />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Messages />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/assignments"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Assignments />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Analytics />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Settings />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;