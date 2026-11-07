
export interface ApiError {
    response?: {
        status?: number;
        data?: {
            detail?: string;
        };
    };
    message?: string;
}

export const handleImageError = (error: ApiError, addNotification: (message: string, type: 'success' | 'error' | 'info') => void): void => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;

    console.error('Image operation error:', { status, detail, error });

    if (status === 503 && detail === 'Storage write access denied') {
        addNotification('Хранилище запретило загрузку. Обратитесь к администратору для проверки прав записи.', 'error');
        return;
    }

    // Обработка специфичных ошибок
    if (status === 405 && detail?.includes('Quota objects over limited')) {
        addNotification('Превышено максимальное количество изображений', 'error');
        return;
    }

    if (status === 422) {
        if (detail?.includes('Incorrect file size')) {
            addNotification('Превышен лимит размера изображения или общей квоты памяти ', 'error');
            return;
        }
        if (detail?.includes('Incorrect file path or file name')) {
            addNotification('Некорректный путь или название файла', 'error');
            return;
        }
    }

    if (status === 403 && detail?.includes('Keys not found')) {
        addNotification('Не настроен доступ к хранилищу. Обратитесь к администратору.', 'error');
        return;
    }

    if (status === 404 && detail?.includes('File not found')) {
        addNotification('Изображение не найдено', 'error');
        return;
    }

    if (status === 409 && detail?.includes('already exist in storage')) {
        addNotification('Папка с таким названием уже существует', 'error');
        return;
    }

    // Общие ошибки по статусам
    switch (status) {
        case 400:
            addNotification('Некорректный запрос', 'error');
            break;
        case 401:
            addNotification('Ошибка авторизации', 'error');
            break;
        case 403:
            addNotification('Доступ запрещен', 'error');
            break;
        case 404:
            addNotification('Ресурс не найден', 'error');
            break;
        case 409:
            addNotification('Конфликт данных', 'error');
            break;
        case 422:
            addNotification('Ошибка валидации данных', 'error');
            break;
        case 429:
            addNotification('Слишком много запросов', 'error');
            break;
        case 500:
            addNotification('Внутренняя ошибка сервера', 'error');
            break;
        case 502:
            addNotification('Ошибка gateway', 'error');
            break;
        case 503:
            addNotification('Сервис временно недоступен', 'error');
            break;
        default:
            addNotification('Произошла неизвестная ошибка', 'error');
            break;
    }
};

// Хелпер для обертки API вызовов
export const withErrorHandling = async <T>(
    apiCall: () => Promise<T>,
    addNotification: (message: string, type: 'success' | 'error' | 'info') => void,
    successMessage?: string
): Promise<T | null> => {
    try {
        const result = await apiCall();
        if (successMessage) {
            addNotification(successMessage, 'success');
        }
        return result;
    } catch (error) {
        handleImageError(error as ApiError, addNotification);
        return null;
    }
};