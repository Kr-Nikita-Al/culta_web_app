import React, {useEffect, useState} from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelectedCompany } from '../context/SelectedCompanyContext';
import { useAuth } from '../context/AuthContext';

const CompanySelector: React.FC = () => {
    const [selectedValue, setSelectedValue] = useState('');
    const { setSelectedCompany, availableCompanies } = useSelectedCompany();
    const { roles } = useAuth();
    const navigate = useNavigate();

    // Проверяем, является ли пользователь суперадминистратором
    const isSuperAdmin = roles?.some(role => role.role === 'PORTAL_ROLE_SUPER_ADMIN');

    // Если суперадминистратор, сразу перенаправляем на профиль
    useEffect(() => {
        if (isSuperAdmin) {
            navigate('/profile', { replace: true });
        }
    }, [isSuperAdmin, navigate]);

    if (isSuperAdmin) {
        return null;
    }

    const getRoleName = (role: string): string => {
        const roleNames: Record<string, string> = {
            'PORTAL_ROLE_ADMIN': 'Администратор',
            'PORTAL_ROLE_MODERATOR': 'Модератор',
            'PORTAL_ROLE_USER': 'Пользователь'
        };
        return roleNames[role] || role;
    };

    const handleCompanySelect = () => {
        if (!selectedValue) {
            alert('Пожалуйста, выберите вариант');
            return;
        }

        if (selectedValue === 'user') {
            // Для роли пользователя
            setSelectedCompany(null, {
                company_id: 'user',
                role: 'PORTAL_ROLE_USER'
            });
            navigate('/profile', { replace: true });
            return;
        }

        // Обработка выбора роли "Супер администратор"
        if (selectedValue === 'superadmin') {
            setSelectedCompany(null, {
                company_id: 'superadmin',
                role: 'PORTAL_ROLE_SUPER_ADMIN'
            });
            navigate('/profile', { replace: true });
            return;
        }

        // Обработка выбора компании
        const selected = availableCompanies.find(c => c.companyId === selectedValue);
        if (selected) {
            setSelectedCompany(selected.companyId, selected.role);
            navigate('/profile', { replace: true });
        } else {
            alert('Выбранная компания не найдена');
        }
    };

    // Проверяем, есть ли у пользователя роль PORTAL_ROLE_USER
    const hasUserRole = roles?.some(role => role.role === 'PORTAL_ROLE_USER');

    return (
        <div className="min-h-screen flex items-center justify-center bg-coffee-light">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold text-coffee-dark mb-6 text-center">
                    Выберите заведение
                </h2>

                <div className="mb-6">
                    <label className="block text-coffee-dark mb-2">Заведение и роль:</label>
                    <select
                        value={selectedValue}
                        onChange={(e) => setSelectedValue(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                        <option value="">-- Выберите заведение --</option>
                        {/* Всегда показываем опцию "Пользователь" если есть соответствующая роль */}
                        {hasUserRole && (
                            <option value="user">Пользователь</option>
                        )}
                        {roles?.some(role => role.role === 'PORTAL_ROLE_SUPER_ADMIN') && (
                            <option value="superadmin">Супер администратор</option>
                        )}
                        {availableCompanies.map(company => (
                            <option key={company.companyId} value={company.companyId}>
                                {company.companyName} ({getRoleName(company.role.role)})
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={handleCompanySelect}
                    disabled={!selectedValue}
                    className="w-full bg-amber-700 hover:bg-amber-800 text-white py-3 rounded transition disabled:opacity-50"
                >
                    Продолжить
                </button>
            </div>
        </div>
    );
};

export default CompanySelector;