import { useState, useRef, useCallback } from 'react';

export const useApi = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const callApi = useCallback(async <T,>(apiCall: () => Promise<T>): Promise<T | null> => {
        // Создаем новый AbortController для каждого запроса
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            return await apiCall();
        } catch (err: any) {
            // ИГНОРИРУЕМ ОШИБКИ ОТМЕНЫ ЗАПРОСА
            if (err.name === 'AbortError') {
                console.log('Запрос был отменен (это нормально в Strict Mode)');
                return null;
            }

            // Логируем только реальные ошибки
            console.error('API Error:', err);
            setError(err.message || 'Произошла ошибка');
            return null;
        } finally {
            // Сбрасываем AbortController только если это текущий запрос
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
            setLoading(false);
        }
    }, []);

    // Функция для отмены запросов (опционально)
    const cancelRequest = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    return { callApi, loading, error, cancelRequest };
};