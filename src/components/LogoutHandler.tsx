import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedCompany } from '../context/SelectedCompanyContext';

const LogoutHandler: React.FC = () => {
    const { logout: authLogout } = useAuth();
    const { resetSelectedCompany } = useSelectedCompany();

    const handleLogout = () => {
        // Вызываем обе функции очистки
        authLogout();
        resetSelectedCompany();

        // Перенаправляем на страницу логина
        window.location.href = '/login';
    };

    // Этот компонент не рендерит ничего видимого,
    // но предоставляет функцию handleLogout для использования в других компонентах
    return null;
};

export default LogoutHandler;