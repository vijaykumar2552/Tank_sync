import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import { FirebaseProvider } from './context/FirebaseContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';
import Login from './pages/Login';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 30000 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FirebaseProvider>
            <AuthProvider>
              <BrowserRouter>
                <ErrorBoundary>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                      path="/*"
                      element={
                        <ProtectedRoute>
                          <App />
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </ErrorBoundary>
              </BrowserRouter>
            </AuthProvider>
          </FirebaseProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </MotionConfig>
  </React.StrictMode>
);
