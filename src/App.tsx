import React, { useState, useEffect, useMemo } from 'react';
import {BrowserRouter as Router, Routes, Route, useLocation, Navigate, useNavigate} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CompaniesProvider } from './context/CompaniesContext';
import { SelectedCompanyProvider, useSelectedCompany } from './context/SelectedCompanyContext';
import Sidebar from './components/Sidebar';
import {NotificationProvider, NotificationContainer} from "./context/NotificationContext";
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import CompaniesPage from './pages/CompaniesPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import ProtectedRoute from './components/ProtectedRoute';
import CompanySelector from './components/CompanySelector';
import { useAuth } from './context/AuthContext';
import { useCompanies } from './context/CompaniesContext';
import './index.css';
import ImagesPage from './pages/ImagesPage';

const AppContent: React.FC = () => {
    const [activeTab, setActiveTab] = useState('profile');
    const [isCheckingRoles, setIsCheckingRoles] = useState(true);
    const { token, roles } = useAuth();
    const { companies } = useCompanies();
    const { availableCompanies, setAvailableCompanies, selectedCompany, selectedRole, setSelectedCompany } = useSelectedCompany();
    const location = useLocation();
    const navigate = useNavigate();
    const isSuperAdmin = roles?.some(role => role.role === 'PORTAL_ROLE_SUPER_ADMIN');

    const companiesWithNames = useMemo(() => {
        if (!roles || !companies) return [];

        return roles
            .filter(role =>
                role.role !== 'PORTAL_ROLE_USER' &&
                role.role !== 'PORTAL_ROLE_SUPER_ADMIN' && // Исключаем суперадминистратора
                role.company_id // Убеждаемся, что есть company_id
            )
            .map(role => {
                const company = companies.find(c => c.company_id === role.company_id);
                return {
                    companyId: role.company_id,
                    companyName: company?.company_name || 'Загрузка...',
                    role: role
                };
            });
    }, [roles, companies]);

    useEffect(() => {
        if (location.pathname.includes('/profile/company')) {
            setActiveTab('companies');
        } else if (location.pathname.includes('/profile/user_info')) {
            setActiveTab('profile');
        } else if (location.pathname.includes('/profile/images')) {
            setActiveTab('images');
        }
    }, [location]);

    useEffect(() => {
        if (token && roles && !selectedCompany && !selectedRole && !isCheckingRoles) {
            // Если у пользователя только роль "Пользователь", автоматически выбираем ее
            const hasOnlyUserRole = roles.length === 1 && roles[0].role === 'PORTAL_ROLE_USER';
            if (hasOnlyUserRole) {
                setSelectedCompany(null, roles[0]);
            }
            // Если пользователь суперадминистратор с ролью "Пользователь", выбираем роль "Пользователь"
            else if (isSuperAdmin && roles.some(role => role.role === 'PORTAL_ROLE_USER')) {
                const userRole = roles.find(role => role.role === 'PORTAL_ROLE_USER');
                if (userRole) {
                    setSelectedCompany(null, userRole);
                }
            }
        }
    }, [token, roles, selectedCompany, selectedRole, isCheckingRoles, isSuperAdmin, setSelectedCompany]);

    // Устанавливаем доступные компании
    useEffect(() => {
        setAvailableCompanies(companiesWithNames);
    }, [companiesWithNames, setAvailableCompanies]);

    const hasOnlyUserRole = roles && roles.length === 1 && roles[0].role === 'PORTAL_ROLE_USER';

    // Автоматически устанавливаем роль суперадминистратора при загрузке
    useEffect(() => {
        if (token && roles) {
            setIsCheckingRoles(false);

            // Если у пользователя есть админские роли, сразу показываем селектор
            const hasAdminRoles = roles.some(role =>
                role.role === 'PORTAL_ROLE_ADMIN' ||
                role.role === 'PORTAL_ROLE_SUPER_ADMIN'
            );

            if (hasAdminRoles && !selectedCompany) {
                // Не устанавливаем активную вкладку, чтобы не показывать профиль
            }
        }
    }, [token, roles, selectedCompany]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (tab === 'profile') {
            navigate('/profile/user_info');
        } else if (tab === 'companies') {
            navigate('/profile/company');
        } else if (tab === 'images') {
            navigate('/profile/images');
        }
    };

    const shouldShowCompanySelector = token &&
        availableCompanies.length > 0 &&
        !selectedCompany &&
        !selectedRole &&
        !hasOnlyUserRole &&
        !isSuperAdmin;

    useEffect(() => {
        if (token && roles && !isCheckingRoles) {
            // Если у пользователя несколько ролей и нужно показать селектор,
            // перенаправляем на /profile/selector
            if (shouldShowCompanySelector && location.pathname !== '/profile/selector') {
                navigate('/profile/selector', { replace: true });
            }
            // Если у пользователя только одна роль (USER), перенаправляем на профиль
            else if (hasOnlyUserRole && location.pathname !== '/profile/user_info') {
                navigate('/profile/user_info', { replace: true });
            }
        }
    }, [token, roles, isCheckingRoles, shouldShowCompanySelector, hasOnlyUserRole, location.pathname, navigate]);


    if (shouldShowCompanySelector && location.pathname !== '/profile/selector') {
        return <Navigate to="/profile/selector" replace />;
    }

    if (isCheckingRoles && token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-coffee-light">
                <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto mb-4"></div>
                    <p className="text-gray-600">Загрузка данных...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-cover bg-center bg-fixed"
             style={{backgroundImage: `url(${require('./assets/main_screen_picture.jpeg')})`}}>
            <Routes>
                <Route path="/login" element={<LoginPage/>}/>
                <Route path="/auth/:provider/callback" element={<OAuthCallbackPage/>}/>
                <Route path="/profile/selector" element={
                    <ProtectedRoute>
                        <CompanySelector />
                    </ProtectedRoute>
                }/>
                <Route path="/profile/user_info" element={
                    <ProtectedRoute>
                        <Header/>
                        <div className="flex pt-16 min-h-screen">
                            <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
                            <div className="flex-1 ml-6 mb-8">
                                <main className="min-h-[calc(100vh-8rem)] ml-4">
                                    <ProfilePage />
                                </main>
                            </div>
                        </div>
                    </ProtectedRoute>
                }/>
                <Route path="/profile/company" element={
                    <ProtectedRoute>
                        <Header/>
                        <div className="flex pt-16 min-h-screen">
                            <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
                            <div className="flex-1 ml-6 mb-8">
                                <main className="min-h-[calc(100vh-8rem)] ml-4">
                                    <CompaniesPage />
                                </main>
                            </div>
                        </div>
                    </ProtectedRoute>
                }/>
                <Route path="/profile/images" element={
                    <ProtectedRoute>
                        <>
                            <Header/>
                            <div className="flex pt-16 min-h-screen">
                                <Sidebar activeTab={activeTab} onTabChange={handleTabChange}/>
                                <div className="flex-1 ml-6 mb-8">
                                    <main className="min-h-[calc(100vh-8rem)] ml-4">
                                        <ImagesPage />
                                    </main>
                                </div>
                            </div>
                        </>
                    </ProtectedRoute>
                }/>
                <Route path="*" element={<Navigate to="/profile/user_info" replace />} />
            </Routes>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <div className="min-h-screen bg-cover bg-center bg-fixed"
             style={{backgroundImage: `url(${require('./assets/main_screen_picture.jpeg')})`}}>
            <AuthProvider>
                <CompaniesProvider>
                    <SelectedCompanyProvider>
                        <NotificationProvider>
                            <Router>
                                <AppContent />
                            </Router>
                            <NotificationContainer />
                        </NotificationProvider>
                    </SelectedCompanyProvider>
                </CompaniesProvider>
            </AuthProvider>
        </div>
    );
};

export default App;