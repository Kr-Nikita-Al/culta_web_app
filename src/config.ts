const defaultConfig = {
    apiBaseUrl: 'http://193.106.174.216:8000',
    debugMode: false,
    authTokenKey: 'authToken',
    companiesCacheKey: 'cachedCompanies',
    cacheTTL: 60 * 60 * 1000, // 1 час
    rolesMapping: {
        'PORTAL_ROLE_SUPER_ADMIN': 'Супер-админ',
        'PORTAL_ROLE_ADMIN': 'Администратор',
        'PORTAL_ROLE_MODERATOR': 'Модератор',
        'PORTAL_ROLE_USER': 'Пользователь'
    }
};

// Безопасное получение конфига из window
const getRuntimeConfig = () => {
    if (typeof window !== 'undefined' && window.config) {
        return {
            apiBaseUrl: window.config.apiBaseUrl || defaultConfig.apiBaseUrl,
            debugMode: window.config.env === 'development'
        };
    }
    return {
        apiBaseUrl: process.env.REACT_APP_API_BASE_URL || defaultConfig.apiBaseUrl,
        debugMode: process.env.NODE_ENV === 'development'
    };
};

const runtimeConfig = getRuntimeConfig();

export default {
    ...defaultConfig,
    apiBaseUrl: runtimeConfig.apiBaseUrl,
    debugMode: runtimeConfig.debugMode
};