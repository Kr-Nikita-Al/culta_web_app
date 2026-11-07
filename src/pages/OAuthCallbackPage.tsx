import React, {useEffect, useRef} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {oauthLogin} from "../services/authService";
import api from '../services/api';
import {LINK_FLOW_KEY} from '../components/AccountConnections';
import {useNotifications} from '../context/NotificationContext';

const OAuthCallbackPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const mounted = useRef(false);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const isProcessing = useRef(false); // Флаг для отслеживания процесса
    const {addNotification}=useNotifications();

    const pathParts = window.location.pathname.split('/');
    const provider = pathParts[2];
    const { token, login } = useAuth();

    useEffect(() => {
        let linking: {provider:string;state:string}|null=null;
        try{linking=JSON.parse(sessionStorage.getItem(LINK_FLOW_KEY)||'null');}catch{/* Invalid local marker never authorizes linking. */}
        if(linking?.provider===provider){
            if(isProcessing.current)return;
            isProcessing.current=true;
            const finish=async()=>{
                try{
                    const code=searchParams.get('code'),state=searchParams.get('state');
                    if(!token||!code||state!==linking?.state||searchParams.get('error'))throw new Error('Подключение отменено или истекло. Начните заново из профиля.');
                    const options={withCredentials:true,accountLinkFlow:true};
                    const {data}=provider==='yandex'?await api.get('/login/auth/yandex/callback',{...options,params:{code,state}})
                        :await api.post(`/login/auth/${provider}/callback`,{code,state},options);
                    if(!mounted.current)return;
                    if(data.verification_failed){addNotification('Вход выполнен, но это не предложенный аккаунт. Ничего не подключено и не объединено.','info');return;}
                    if(!data.linked&&!data.separate_account)throw new Error('Неожиданный ответ. Подключение не подтверждено.');
                    addNotification(data.linked?'Способ входа подключён.': 'Доступ подтверждён, но этот способ входа относится к другому профилю. Аккаунты не объединены.',data.linked?'success':'info');
                }catch{if(mounted.current)addNotification('Подключение не завершено. Вернитесь в профиль и попробуйте снова.','error');}
                finally{if(mounted.current){sessionStorage.removeItem(LINK_FLOW_KEY);navigate('/profile/user_info',{replace:true});}}
            };
            void finish();
            return;
        }
        // Если уже аутентифицированы, перенаправляем на профиль
        if (token) {
            navigate('/profile/user_info', { replace: true });
            return;
        }
        const handleOAuthCallback = async () => {
            // Если уже обрабатываем запрос, выходим
            if (isProcessing.current) return;
            isProcessing.current = true;

            const code = searchParams.get('code');
            const error = searchParams.get('error');

            if (error) {
                navigate('/login', {
                    state: { error: `OAuth ошибка: ${error}` }
                });
                isProcessing.current = false;
                return;
            }

            if (!code) {
                navigate('/login', {
                    state: { error: 'Код авторизации не получен' }
                });
                isProcessing.current = false;
                return;
            }

            try {
                const result = await oauthLogin(provider, code, searchParams.get('state')||undefined, () => mounted.current);
                if (!mounted.current) return;

                if (result) {
                    login(result.token, result.userId);

                    navigate('/profile/user_info', { replace: true });
                } else {
                    navigate('/login', {
                        state: { error: 'Не удалось получить токен' }
                    });
                }
            } catch (err: any) {
                if (!mounted.current) return;
                navigate('/login', {
                    state: { error: err.message || 'Ошибка авторизации через ' + provider }
                });
            } finally {
                isProcessing.current = false;
            }
        };

        handleOAuthCallback();
    }, [provider, searchParams, login, navigate, token, addNotification]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto"></div>
                <p className="mt-4 text-gray-600">Завершение авторизации через {provider}...</p>
            </div>
        </div>
    );
};

export default OAuthCallbackPage;
