import React, {useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {motion} from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';
import {useSelectedCompany} from '../context/SelectedCompanyContext';
import StoragePhoto from '../components/StoragePhoto';
import AccountConnections from '../components/AccountConnections';
import {ROLE_DISPLAY_NAMES} from '../services/roleService';

const getRoleName = (role:string) => ROLE_DISPLAY_NAMES[role] || role;

const ProfilePage: React.FC = () => {
    const {userInfo, sessionError, retrySession} = useAuth();
    const {selectedCompany: selectedCompanyId, selectedRole} = useSelectedCompany();
    const [photoDefaultContainer,setPhotoDefaultContainer]=useState<HTMLDivElement|null>(null);
    const [methodsContainer,setMethodsContainer]=useState<HTMLDivElement|null>(null);

    // Форматирование даты
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="workspace-page">
            {!userInfo && (sessionError ? <div role="alert" className="workspace-card bg-white">
                <p>{sessionError}</p>
                <button type="button" onClick={retrySession}>Повторить загрузку</button>
            </div> : <LoadingSpinner text="Загрузка профиля…"/>)}

            {/* Информация о пользователе */}
            {userInfo && (
                <motion.div
                    initial={{opacity: 0, y: 10, scale: 0.98}}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    transition={{duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94]}}
                    className="workspace-card bg-white mb-6"
                >
                    <h2 className="section-title">Личная информация</h2>
                    <div className="profile-personal-layout">
                    <div className="profile-personal-fields">
                    <div className="profile-photo-identity">
                        {selectedCompanyId && selectedRole && !['PORTAL_ROLE_USER','PORTAL_ROLE_SUPER_ADMIN'].includes(selectedRole.role) &&
                            <StoragePhoto key={`${selectedCompanyId}:${selectedRole.role}`} companyId={selectedCompanyId} role={selectedRole.role} editable defaultControlContainer={photoDefaultContainer} title={`Фото — ${getRoleName(selectedRole.role)}`} />}
                        <div className="profile-name-column">
                        <div>
                            <p className="text-gray-600 text-sm">Имя</p>
                            <p className="font-medium text-coffee-dark">{userInfo.name}</p>
                        </div>

                        <div>
                            <p className="text-gray-600 text-sm">Фамилия</p>
                            <p className="font-medium text-coffee-dark">{userInfo.surname}</p>
                        </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-gray-600 text-sm">Телефон</p>
                            <p className="font-medium text-coffee-dark">{userInfo.phone}</p>
                        </div>

                        <div>
                            <p className="text-gray-600 text-sm">Email</p>
                            <p className="font-medium text-coffee-dark">{userInfo.email || 'Не указан'}</p>
                        </div>

                        <div>
                            <p className="text-gray-600 text-sm">Статус</p>
                            <p className="font-medium text-coffee-dark">
                                {userInfo.is_active ? 'Активен' : 'Неактивен'}
                            </p>
                        </div>

                        <div>
                            <p className="text-gray-600 text-sm">Дата создания</p>
                            <p className="font-medium text-coffee-dark">{formatDate(userInfo.time_created)}</p>
                        </div>

                        <div>
                            <p className="text-gray-600 text-sm">Последнее обновление</p>
                            <p className="font-medium text-coffee-dark">{formatDate(userInfo.time_updated)}</p>
                        {selectedRole && (
                            <div className="mt-4">
                                <p className="text-gray-600 text-sm">Роль в системе</p>
                                <p className="font-medium text-coffee-dark">
                                    {
                                        selectedRole.role === 'PORTAL_ROLE_SUPER_ADMIN'
                                            ? 'Супер администратор'
                                            : selectedRole.role === 'PORTAL_ROLE_USER'
                                                ? 'Пользователь'
                                                : getRoleName(selectedRole.role)
                                    }
                                </p>
                            </div>
                        )}
                        </div>
                        <div>
                            <p className="text-gray-600 text-sm">ID пользователя</p>
                            <p className="font-medium text-coffee-dark text-xs">{userInfo.user_id}</p>
                            <div className="profile-photo-default" ref={setPhotoDefaultContainer}/>
                        </div>
                    </div>
                    </div>
                    <div className="profile-login-column" ref={setMethodsContainer}/>
                    </div>
                </motion.div>
            )}
            {userInfo && <AccountConnections methodsContainer={methodsContainer} />}
        </div>
    );
};

export default ProfilePage;
