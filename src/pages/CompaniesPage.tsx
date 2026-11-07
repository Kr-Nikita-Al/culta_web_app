import React, {useState, useEffect, useCallback} from 'react';
import {useCompanyEditLease,companyLeaseError} from '../hooks/useCompanyEditLease';
import AccountStatusAdmin from '../components/AccountStatusAdmin';
import { useAuth } from '../context/AuthContext';
import {useScopedOperation} from '../hooks/useScopedOperation';
import { getCompanyById, updateCompany } from '../services/companyService';
import { Company } from '../types/authTypes';
import { useSelectedCompany } from '../context/SelectedCompanyContext';
import { useCompanies } from '../context/CompaniesContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { grantStaffPrivilege, revokeStaffPrivilege, ROLE_DISPLAY_NAMES } from '../services/roleService';
import { motion } from 'framer-motion';
import CreateCompanyForm from '../components/CreateCompanyForm';
import { useNotifications } from '../context/NotificationContext';
import StoragePhoto from '../components/StoragePhoto';
import CompanyInfrastructure from '../components/CompanyInfrastructure';
import StaffCandidatePicker from '../components/StaffCandidatePicker';
import StaffRolesTable from '../components/StaffRolesTable';

type StaffRole = 'PORTAL_ROLE_OWNER' | 'PORTAL_ROLE_ADMIN' | 'PORTAL_ROLE_MODERATOR' | 'PORTAL_ROLE_WAITER' | 'PORTAL_ROLE_COOK' | 'PORTAL_ROLE_HOSTESS';


const CompaniesPage: React.FC = () => {
    const [companyTab, setCompanyTab] = useState<'info'|'access'|'infrastructure'>('info');
    const [adminTab, setAdminTab] = useState<'create'|'access'|'accounts'>('create');
    const [companyData, setCompanyData] = useState<Company | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedCompany, setEditedCompany] = useState<Partial<Company>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [delegateAction, setDelegateAction] = useState<'grant' | 'revoke'>('grant');
    const [delegateUserId, setDelegateUserId] = useState('');
    const [candidateReset, setCandidateReset] = useState(0);
    const [superAdminSelectedCompany, setSuperAdminSelectedCompany] = useState<string>('');
    const { addNotification } = useNotifications();
    const { selectedCompany: contextSelectedCompany, selectedRole } = useSelectedCompany();
    const editOperation=useScopedOperation(JSON.stringify([contextSelectedCompany,selectedRole?.role]));
    const lease=useCompanyEditLease(contextSelectedCompany || '');
    const releaseLease=lease.release;
    useEffect(()=>{setIsEditing(false);void releaseLease();},[contextSelectedCompany,selectedRole?.role,releaseLease]);
    const { companies, refreshCompanies, isLoading: companiesLoading } = useCompanies();
    const { token } = useAuth();
    const saveOperation=useScopedOperation(JSON.stringify([contextSelectedCompany,selectedRole?.role]));
    const { updateSelectedCompany } = useSelectedCompany();
    const [companyCache, setCompanyCache] = useState<Record<string, Company>>({});
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const [selectedCompanyName, setSelectedCompanyName] = useState('');
    const isSuperAdmin = selectedRole?.role === 'PORTAL_ROLE_SUPER_ADMIN';
    const [delegateRole, setDelegateRole] = useState<StaffRole>(() => {
        // Устанавливаем начальную роль в зависимости от прав пользователя
        if (isSuperAdmin) return 'PORTAL_ROLE_ADMIN';
        if (selectedRole?.role === 'PORTAL_ROLE_ADMIN') return 'PORTAL_ROLE_ADMIN';
        if (selectedRole?.role === 'PORTAL_ROLE_OWNER') return 'PORTAL_ROLE_ADMIN';
        return 'PORTAL_ROLE_ADMIN';
    });
    const accessCompanyId = (isSuperAdmin ? superAdminSelectedCompany : contextSelectedCompany) || '';
    useEffect(() => {setDelegateUserId('');}, [accessCompanyId, delegateRole, delegateAction]);
    const accessOperation=useScopedOperation(JSON.stringify([accessCompanyId,delegateRole,delegateAction,delegateUserId]));
    // Регулярные выражения для валидации
    const phoneRegex = /^(\+7|8)[0-9]{10}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Загрузка данных компании при изменении выбранной компании
    useEffect(() => {
        let active=true;
        setError(null);
        setCompanyData(null);
        setEditedCompany({});
        if (isSuperAdmin) {
            setLoading(false);
            return;
        }

        if (contextSelectedCompany && token) {
            // Проверяем кеш
            if (companyCache[contextSelectedCompany]) {
                setCompanyData(companyCache[contextSelectedCompany]);
                setEditedCompany(companyCache[contextSelectedCompany]);
                setLoading(false);
                return;
            }

            const loadCompanyData = async () => {
                setLoading(true);
                try {
                    const data = await getCompanyById(contextSelectedCompany);
                    if(!active)return;
                    if (data) {
                        setCompanyData(data);
                        setEditedCompany(data);
                        // Сохраняем в кеш
                        setCompanyCache(prev => ({
                            ...prev,
                            [contextSelectedCompany]: data
                        }));
                    }
                } catch (err) {
                    if(!active)return;
                    setError('Ошибка загрузки данных компании');
                } finally {
                    if(active)setLoading(false);
                }
            };

            loadCompanyData();
        } else setLoading(false);
        return()=>{active=false;};
    }, [contextSelectedCompany, token, isSuperAdmin, companyCache]);

    // Валидация полей
    const validateField = (name: string, value: string): string => {
        switch (name) {
            case 'company_name':
                return !value.trim() ? 'Укажите название компании' : Array.from(value).length > 20 ? 'Название компании — не более 20 символов' : '';
            case 'address':
                return !value.trim() ? 'Укажите адрес компании' : Array.from(value).length > 50 ? 'Адрес — не более 50 символов' : '';
            case 'bonus_payment_perc':
            case 'bonus_accrual_perc':
                return /^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) <= 100
                    ? '' : 'Укажите процент от 0 до 100, не более двух знаков после точки';
            case 'phone':
                if (!value.trim()) return 'Телефон обязателен для заполнения';
                return phoneRegex.test(value.replace(/\s/g, '')) ? '' : 'Неверный формат телефона';
            case 'email':
                if (!value.trim()) return 'Email обязателен для заполнения';
                return emailRegex.test(value) ? '' : 'Неверный формат email';
            default:
                return '';
        }
    };

    // Проверка всей формы
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};
        for (const field of ['bonus_payment_perc', 'bonus_accrual_perc'] as const) {
            const error = validateField(field, editedCompany[field] ?? '0');
            if (error) newErrors[field] = error;
        }

        for (const field of ['company_name', 'address'] as const) {
            const message=validateField(field, editedCompany[field] || '');
            if(message)newErrors[field]=message;
        }
        // Проверяем телефон
        if (editedCompany.phone) {
            const phoneError = validateField('phone', editedCompany.phone);
            if (phoneError) newErrors.phone = phoneError;
        }

        // Проверяем email
        if (editedCompany.email) {
            const emailError = validateField('email', editedCompany.email);
            if (emailError) newErrors.email = emailError;
        }

        setFieldErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        const fieldValue = type === 'checkbox' ? checked : value;

        setEditedCompany(prev => ({
            ...prev,
            [name]: fieldValue
        }));

        // Валидация при изменении
        if (name === 'company_name' || name === 'address' || name === 'phone' || name === 'email' || name.startsWith('bonus_')) {
            const error = validateField(name, value);
            setFieldErrors(prev => {
                const next = { ...prev };
                if (error) next[name] = error; else delete next[name];
                return next;
            });
        }
    };

    const resetEditingState = () => {
        void lease.release();
        setIsEditing(false);
        // Восстанавливаем оригинальные данные из companyData
        setEditedCompany(companyData || {});
        setFieldErrors({});
    };

    const hasChanges = useCallback(() => {
        if (!companyData) return false;

        return Object.keys(editedCompany).some(key => {
            const companyKey = key as keyof Company;
            return editedCompany[companyKey] !== companyData[companyKey];
        });
    }, [companyData, editedCompany]);

    const beginEdit=async()=>{
        const operation=editOperation.begin();
        if(!operation)return;
        try{
            const acquired=await lease.acquire();
            if(!acquired||!operation.isCurrent())return;
            const fresh=await getCompanyById(contextSelectedCompany!);
            if(!operation.isCurrent())return;
            setCompanyData(fresh);setEditedCompany(fresh);setFieldErrors({});setIsEditing(true);
        }catch{
            if(!operation.isCurrent())return;
            await lease.release();
            if(operation.isCurrent())addNotification('Не удалось загрузить актуальные данные компании','error');
        }finally{operation.finish();}
    };

    const handleSave = async () => {
        if (!contextSelectedCompany || !token || !lease.token || !validateForm()) return;

        // Проверяем, есть ли изменения
        if (!hasChanges()) {
            addNotification('Нет изменений для сохранения', 'info');
            resetEditingState();
            return;
        }

        const operation=saveOperation.begin();
        if(!operation)return;
        setLoading(true);

        try {
            await updateCompany(contextSelectedCompany,{...editedCompany,bonus_payment_perc:undefined,bonus_accrual_perc:undefined},lease.token);
            if(!operation.isCurrent())return;
            const updated={...companyData,...editedCompany} as Company;
            setCompanyData(updated);
            setCompanyCache(prev=>({...prev,[contextSelectedCompany]:updated}));
            updateSelectedCompany(updated);
            setIsEditing(false);
            await lease.release();
            if(!operation.isCurrent())return;
            addNotification('Изменения компании сохранены успешно','success');
        } catch(e:any) {
            if(!operation.isCurrent())return;
            addNotification(e.response?.status===423?companyLeaseError(e):'Ошибка сохранения. Ваши правки остаются в форме.','error');
            if(e.response?.status===423)await lease.release();
        } finally {if(operation.isCurrent())setLoading(false);operation.finish();}
    };

    const getAvailableRoles = () => {
        if (isSuperAdmin) {
            return ['PORTAL_ROLE_OWNER', 'PORTAL_ROLE_ADMIN'] as StaffRole[];
        } else if (selectedRole?.role === 'PORTAL_ROLE_ADMIN') {
            // Админ может только выдавать права, но не отзывать админские
            if (delegateAction === 'revoke') {
                return ['PORTAL_ROLE_MODERATOR', 'PORTAL_ROLE_WAITER', 'PORTAL_ROLE_COOK', 'PORTAL_ROLE_HOSTESS'] as StaffRole[];
            } else {
                return ['PORTAL_ROLE_ADMIN', 'PORTAL_ROLE_MODERATOR', 'PORTAL_ROLE_WAITER', 'PORTAL_ROLE_COOK', 'PORTAL_ROLE_HOSTESS'] as StaffRole[];
            }
        } else if (selectedRole?.role === 'PORTAL_ROLE_OWNER') {
            return ['PORTAL_ROLE_ADMIN', 'PORTAL_ROLE_MODERATOR', 'PORTAL_ROLE_WAITER', 'PORTAL_ROLE_COOK', 'PORTAL_ROLE_HOSTESS'] as StaffRole[];
        }
        return [] as StaffRole[];
    };

    // Определим, может ли пользователь отзывать права
    const canRevokeRole = (role: StaffRole): boolean => {
        if (isSuperAdmin) return true; // Суперадмин может все

        if (selectedRole?.role === 'PORTAL_ROLE_OWNER') {
            // Владелец может отозвать любые роли, кроме своей
            return role !== 'PORTAL_ROLE_OWNER';
        }

        if (selectedRole?.role === 'PORTAL_ROLE_ADMIN') {
            // Админ может отозвать только не-админские роли
            return role !== 'PORTAL_ROLE_ADMIN' && role !== 'PORTAL_ROLE_OWNER';
        }

        return false;
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            // Ctrl+Enter или Cmd+Enter - сохранить
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
            // Enter в любом поле input - сохранить
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            // Escape - отмена
            e.preventDefault();
            resetEditingState();
        }
    };

    const handleDelegateRights = async () => {
        const targetCompanyId = isSuperAdmin ? superAdminSelectedCompany : contextSelectedCompany;

        if (!targetCompanyId || !delegateRole || !delegateUserId) {
            setError('Заполните все поля');
            addNotification('Заполните все поля', 'error');
            return;
        }

        // Проверка прав на выполнение действия
        if (delegateAction === 'revoke' && !canRevokeRole(delegateRole)) {
            setError('У вас нет прав для отзыва этой роли');
            addNotification('У вас нет прав для отзыва этой роли', 'error');
            return;
        }

        const operation=accessOperation.begin();
        if(!operation)return;
        setError(null);

        try {
            let response;
            if (delegateAction === 'grant') {
                response = await grantStaffPrivilege(token!, {
                    promo_user_id: delegateUserId,
                    company_id: targetCompanyId,
                    role: delegateRole
                });
            } else {
                response = await revokeStaffPrivilege(token!, {
                    demo_user_id: delegateUserId,
                    company_id: targetCompanyId,
                    role: delegateRole
                });
            }

            if(!operation.isCurrent())return;
            if (response) {
                const actionText = delegateAction === 'grant' ? 'выданы' : 'отозваны';
                addNotification(`Права ${ROLE_DISPLAY_NAMES[delegateRole]} успешно ${actionText}`, 'success');
                setDelegateUserId('');
                setCandidateReset(v => v + 1);
            }
        } catch (error: any) {
            if(!operation.isCurrent())return;

            let errorMessage = 'Ошибка при делегировании прав';

            if (error.response?.status === 400) {
                errorMessage = typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'Некорректный запрос';
            } else if (error.response?.status === 403) {
                errorMessage = 'Недостаточно прав для выполнения действия';
            } else if (error.response?.status === 404) {
                errorMessage = 'Пользователь или компания не найдены';
            } else if (error.response?.status === 405) {
                errorMessage = 'Метод не разрешен';
            } else if (error.response?.status === 500) {
                errorMessage = 'Внутренняя ошибка сервера';
            }

            setError(errorMessage);
            addNotification(errorMessage, 'error');
        } finally {operation.finish();}
    };

    if (loading) {
        return <LoadingSpinner text="Загрузка..." />;
    }

    if (!contextSelectedCompany && !isSuperAdmin) {
        return <div>Компания не выбрана</div>;
    }

    return (
        <div className="workspace-page workspace-card company-page--tabbed">
            <h1 className="section-title">{isSuperAdmin?'Компании':'Информация о компании'}</h1>
            {isSuperAdmin && <div className="company-tabs" role="tablist" aria-label="Разделы управления компаниями">
                {([['create','Создание компании'],['access','Управление доступом'],['accounts','Статусы аккаунтов']] as const).map(([id,label])=>
                    <button key={id} type="button" role="tab" id={`admin-company-tab-${id}`} aria-controls={`admin-company-panel-${id}`} aria-selected={adminTab===id} onClick={()=>setAdminTab(id)}>{label}</button>)}
            </div>}
            {isSuperAdmin && <div role="tabpanel" id="admin-company-panel-accounts" aria-labelledby="admin-company-tab-accounts" hidden={adminTab!=='accounts'}><AccountStatusAdmin/></div>}
            {!isSuperAdmin && <div className="company-tabs" role="tablist" aria-label="Разделы компании">
                {([['info','Основная информация'],['access','Управление доступом'],['infrastructure','Инфраструктура']] as const).map(([id,label])=>
                    <button key={id} type="button" role="tab" aria-selected={companyTab===id} disabled={isEditing}
                        onClick={()=>{if(isEditing){if(!window.confirm('Закрыть редактирование без сохранения?'))return;resetEditingState();}setCompanyTab(id);}}>{label}</button>)}
            </div>}
            {!isSuperAdmin && contextSelectedCompany && <div hidden={companyTab!=='infrastructure'} className="company-infrastructure-panel">
                <CompanyInfrastructure key={contextSelectedCompany} companyId={contextSelectedCompany}/></div>}

            {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                    {error}
                </div>
            )}


            {/* Информация о компании (только для не-суперадминов) */}
            {isSuperAdmin ? (
                <motion.div
                    hidden={adminTab!=='create'} role="tabpanel" id="admin-company-panel-create" aria-labelledby="admin-company-tab-create"
                    initial={false}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    transition={{duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94]}}
                >
                    <CreateCompanyForm/>
                </motion.div>
            ) : companyData && companyTab==='info' && (
                <motion.div
                    initial={false}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    transition={{duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94]}}
                    className="workspace-card bg-white mb-6 company-info-panel"
                >
                    {lease.error&&<p role="alert">{lease.error}{isEditing&&!lease.token&&<button type="button" className="menu-secondary" onClick={()=>{if(window.confirm('Загрузить актуальные данные? Несохранённые правки будут потеряны.'))void beginEdit();}}>Открыть редактирование заново</button>}</p>}
                    <div className="company-info-tools flex justify-end items-center">
                        <div className="flex items-center space-x-4">
                            {!isEditing ? (
                                <motion.button
                                    whileHover={{scale: 1.05}}
                                    whileTap={{scale: 0.95}}
                                    onClick={beginEdit} disabled={lease.pending || editOperation.busy || loading}
                                    className="company-edit-button" aria-label="Редактировать компанию" title="Редактировать компанию"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                    </svg>
                                </motion.button>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={resetEditingState}
                                        className="company-edit-button" aria-label="Отмена" title="Отмена"
                                        disabled={loading}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                        </svg>
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={Object.keys(fieldErrors).length > 0 || loading || !lease.token || !hasChanges()}
                                        className="company-edit-button" aria-label={loading?'Сохранение…':'Сохранить'} title="Сохранить"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                                </svg>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="company-details-layout"><StoragePhoto key={companyData.company_id} companyId={companyData.company_id} title="Фото компании" leaseToken={lease.token}
                        editable={['PORTAL_ROLE_ADMIN','PORTAL_ROLE_OWNER'].includes(selectedRole?.role || '')} />
                    <form onKeyDown={handleKeyDown} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <fieldset className="md:col-span-2">
                            <legend className="text-gray-600 text-sm mb-2">Клиентские заказы</legend>
                            <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {([
                                    ['allow_client_orders_inside', 'Внутри заведения'],
                                    ['allow_client_orders_outside', 'Вне заведения'],
                                ] as const).map(([field, label]) => <label key={field} className="flex items-center gap-2">
                                    <input type="checkbox" name={field} disabled={!isEditing}
                                        checked={Boolean((isEditing ? editedCompany : companyData)[field])}
                                        onChange={handleInputChange} className="accent-amber-700" />
                                    {label}
                                </label>)}
                            </div>
                        </fieldset>
                        <div>
                            <label className="block text-gray-600 text-sm mb-1" htmlFor="service-type">Тип обслуживания</label>
                            {isEditing ? <select id="service-type" className="w-full p-2 border border-gray-300 rounded"
                                value={editedCompany.service_type || 'self_service'}
                                onChange={event => setEditedCompany(prev => ({ ...prev,
                                    service_type: event.target.value as 'self_service' | 'waiter_service' }))}>
                                <option value="self_service">Самообслуживание — один заказ в чеке</option>
                                <option value="waiter_service">Официант — несколько заказов в чеке</option>
                            </select> : <p>{companyData.service_type === 'waiter_service' ? 'Обслуживание официантом' : 'Самообслуживание'}</p>}
                            <p className="text-sm text-gray-500">Изменение применяется к новым чекам. Существующие чеки сохраняют свой тип.</p>
                        </div>
                        {/* Название компании */}
                        <div>
                            <label htmlFor="company-company_name" className="block text-gray-600 text-sm mb-1">Название компании</label>
                            {isEditing && fieldErrors.company_name && <p role="alert" className="text-red-600 text-sm">{fieldErrors.company_name}</p>}
                            {isEditing ? (
                                <motion.input
                                    initial={false}
                                    animate={{ opacity: 1, scale: 1 }}
                                    type="text"
                                    id="company-company_name" name="company_name"
                                    value={editedCompany.company_name || ''}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            ) : (
                                <motion.p
                                    initial={false}
                                    animate={{ opacity: 1 }}
                                    className="font-medium"
                                >
                                    {companyData.company_name}
                                </motion.p>
                            )}
                        </div>

                        {/* Адрес */}
                        <div>
                            <label htmlFor="company-address" className="block text-gray-600 text-sm mb-1">Адрес</label>
                            {isEditing && fieldErrors.address && <p role="alert" className="text-red-600 text-sm">{fieldErrors.address}</p>}
                            {isEditing ? (
                                <motion.input
                                    initial={false}
                                    animate={{ opacity: 1, scale: 1 }}
                                    type="text"
                                    id="company-address" name="address"
                                    value={editedCompany.address || ''}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            ) : (
                                <motion.p
                                    initial={false}
                                    animate={{ opacity: 1 }}
                                    className="font-medium"
                                >
                                    {companyData.address}
                                </motion.p>
                            )}
                        </div>

                        {/* Телефон */}
                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Телефон</label>
                            {isEditing ? (
                                <motion.div
                                    initial={false}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    <input
                                        type="text"
                                        name="phone"
                                        value={editedCompany.phone || ''}
                                        onChange={handleInputChange}
                                        className={`w-full p-2 border rounded ${
                                            fieldErrors.phone ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-amber-500'
                                        } focus:outline-none focus:ring-2`}
                                        placeholder="+79991234567"
                                    />
                                    {fieldErrors.phone && (
                                        <motion.p
                                            initial={false}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-red-500 text-sm mt-1"
                                        >
                                            {fieldErrors.phone}
                                        </motion.p>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.p
                                    initial={false}
                                    animate={{ opacity: 1 }}
                                    className="font-medium"
                                >
                                    {companyData.phone}
                                </motion.p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Email</label>
                            {isEditing ? (
                                <motion.div
                                    initial={false}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    <input
                                        type="email"
                                        name="email"
                                        value={editedCompany.email || ''}
                                        onChange={handleInputChange}
                                        className={`w-full p-2 border rounded ${
                                            fieldErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-amber-500'
                                        } focus:outline-none focus:ring-2`}
                                    />
                                    {fieldErrors.email && (
                                        <motion.p
                                            initial={false}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-red-500 text-sm mt-1"
                                        >
                                            {fieldErrors.email}
                                        </motion.p>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.p
                                    initial={false}
                                    animate={{ opacity: 1 }}
                                    className="font-medium"
                                >
                                    {companyData.email}
                                </motion.p>
                            )}
                        </div>

                        {/* Возрастное ограничение */}
                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Возрастное ограничение</label>
                            {isEditing ? (
                                <motion.label
                                    initial={false}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center"
                                >
                                    <input
                                        type="checkbox"
                                        name="age_limit"
                                        checked={editedCompany.age_limit || false}
                                        onChange={handleInputChange}
                                        className="mr-2"
                                    />
                                    <span>Включено</span>
                                </motion.label>
                            ) : (
                                <motion.p
                                    initial={false}
                                    animate={{ opacity: 1 }}
                                    className="font-medium"
                                >
                                    {companyData.age_limit ? 'Да' : 'Нет'}
                                </motion.p>
                            )}
                        </div>
                    </form></div>

                    {/* Подсказка по горячим клавишам */}
                    {isEditing && (
                        <motion.div
                            initial={false}
                            animate={{ opacity: 1 }}
                            className="mt-4 text-xs text-gray-500 flex items-center space-x-4"
                        >
                            <span>💡 Горячие клавиши:</span>
                            <span>Enter — Сохранить</span>
                            <span>Escape — Отмена</span>
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* Блок управления доступами для администраторов и суперадминов */}
            {(isSuperAdmin ? adminTab==='access' : companyTab==='access') && (isSuperAdmin || selectedRole?.role === 'PORTAL_ROLE_ADMIN' || selectedRole?.role === 'PORTAL_ROLE_OWNER') && (
                <motion.div
                    role={isSuperAdmin?'tabpanel':undefined} id={isSuperAdmin?'admin-company-panel-access':undefined} aria-labelledby={isSuperAdmin?'admin-company-tab-access':undefined}
                    initial={false}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    transition={{duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94]}}
                    className="workspace-card bg-white"
                >
                    <h2 className="section-title">Управление доступом</h2>
                    {/* Блок выбора компании только для суперадмина */}
                    {isSuperAdmin && (
                        <div className="mb-4">
                            <label className="block text-gray-600 mb-2">Выберите компанию:</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={selectedCompanyName}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSelectedCompanyName(value);
                                        setShowCompanyDropdown(true);
                                        // Сбрасываем ID если название изменилось
                                        const foundCompany = companies.find(c =>
                                            c.company_name.toLowerCase() === value.toLowerCase()
                                        );
                                        if (!foundCompany) {
                                            setSuperAdminSelectedCompany('');
                                        }
                                    }}
                                    onFocus={() => {
                                        setShowCompanyDropdown(true);
                                        void refreshCompanies();
                                    }}
                                    onBlur={() => {
                                        setTimeout(() => setShowCompanyDropdown(false), 200);
                                    }}
                                    placeholder="Начните вводить название компании..."
                                    className="w-full p-2 pl-3 pr-10 border border-gray-300 rounded"
                                />

                                {/* Кнопка очистки */}
                                {selectedCompanyName && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedCompanyName('');
                                            setSuperAdminSelectedCompany('');
                                            setShowCompanyDropdown(false);
                                        }}
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}

                                {showCompanyDropdown && companiesLoading && <p role="status" className="text-sm text-gray-500">Обновление компаний…</p>}
                                {/* Выпадающий список */}
                                {showCompanyDropdown && companies.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {companies
                                            .filter(company => {
                                                if (!selectedCompanyName) return true;
                                                const searchTerm = selectedCompanyName.toLowerCase();
                                                return company.company_name.toLowerCase().includes(searchTerm);
                                            })
                                            .map(company => (
                                                <div
                                                    key={company.company_id}
                                                    onClick={() => {
                                                        setSuperAdminSelectedCompany(company.company_id);
                                                        setSelectedCompanyName(company.company_name);
                                                        setShowCompanyDropdown(false);
                                                    }}
                                                    className="p-2 hover:bg-gray-100 cursor-pointer transition-colors"
                                                >
                                                    <div className="font-medium">{company.company_name}</div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="company-access-fields">
                        <div>
                            <label className="block text-gray-600 mb-2">Действие:</label>
                            <select
                                value={delegateAction}
                                onChange={(e) => setDelegateAction(e.target.value as 'grant' | 'revoke')}
                                className="w-full p-2 border border-gray-300 rounded"
                            >
                                <option value="grant">Выдать права</option>
                                <option value="revoke">Забрать права</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-600 mb-2">Роль:</label>
                            <select
                                value={delegateRole}
                                onChange={(e) => setDelegateRole(e.target.value as StaffRole)}
                                disabled={loading}
                                className="w-full p-2 border border-gray-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                <option value="">-- Выберите роль --</option>
                                {getAvailableRoles().map(role => (
                                    <option
                                        key={role}
                                        value={role}
                                        disabled={delegateAction === 'revoke' && !canRevokeRole(role)}
                                    >
                                        {ROLE_DISPLAY_NAMES[role]}
                                        {delegateAction === 'revoke' && !canRevokeRole(role) ? ' (недоступно для отзыва)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <StaffCandidatePicker key={`${accessCompanyId}:${delegateRole}:${delegateAction}:${candidateReset}`}
                            companyId={accessCompanyId} role={delegateRole} action={delegateAction}
                            value={delegateUserId} onChange={setDelegateUserId}/>

                        <div className="company-access-submit">
                            <button
                                onClick={handleDelegateRights}
                                disabled={!accessCompanyId || !delegateUserId || loading || accessOperation.busy}
                                className="company-access-action"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7z"/><path d={delegateAction==='grant'?'m8 12 3 3 5-6':'M8 12h8'}/></svg>
                                {delegateAction === 'grant' ? 'Выдать права' : 'Забрать права'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
            {(isSuperAdmin ? adminTab==='access' : companyTab==='access') && accessCompanyId && (isSuperAdmin || selectedRole?.role==='PORTAL_ROLE_OWNER' || selectedRole?.role==='PORTAL_ROLE_ADMIN') &&
                <StaffRolesTable key={accessCompanyId} companyId={accessCompanyId} revision={candidateReset}/>}
        </div>
    );
};

export default CompaniesPage;
