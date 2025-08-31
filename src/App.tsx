import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CompaniesProvider } from './context/CompaniesContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import CompaniesPage from './pages/CompaniesPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile');

  return (
      <AuthProvider>
        <CompaniesProvider>
          <Router>
            <div className="min-h-screen bg-cover bg-center bg-fixed"
                 style={{backgroundImage: `url(${require('./assets/main_screen_picture.jpeg')})`}}>
              <Routes>
                <Route path="/login" element={<LoginPage/>}/>
                <Route path="/auth/:provider/callback" element={<OAuthCallbackPage/>}/>
                <Route path="*" element={
                  <ProtectedRoute>
                    <>
                      <Header/>
                      <div className="flex pt-16 min-h-screen">
                        <Sidebar activeTab={activeTab} onTabChange={setActiveTab}/>
                        <div className="flex-1 ml-6 mb-8"> {/* Увеличили отступ слева */}
                          <main className="min-h-[calc(100vh-8rem)] ml-4"> {/* Увеличили отступ слева */}
                            {activeTab === 'profile' && <ProfilePage/>}
                            {activeTab === 'companies' && <CompaniesPage/>}
                          </main>
                        </div>
                      </div>
                    </>
                  </ProtectedRoute>
                }/>
              </Routes>
            </div>
          </Router>
        </CompaniesProvider>
      </AuthProvider>
  );
};

export default App;