import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';
import {CompaniesProvider} from "./context/CompaniesContext";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";

const App: React.FC = () => {
  return (
      <AuthProvider>
        <CompaniesProvider>
        <Router>
          <div className="min-h-screen flex flex-col bg-cover bg-center"
               style={{ backgroundImage: `url(${require('./assets/main_screen_picture.jpeg')})` }}>
            <Header />

            <main className="flex-grow py-8">
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/:provider/callback" element={<OAuthCallbackPage/>} />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="*" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
              </Routes>

            </main>

            <footer className="bg-coffee-dark text-white text-center p-4">
              © {new Date().getFullYear()} CoffeeStaff. Все права защищены.
            </footer>
          </div>
        </Router>
      </CompaniesProvider>
      </AuthProvider>
  );
};

export default App;