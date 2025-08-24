import { useState, useRef, useCallback } from 'react';

export const useApi = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const callApi = useCallback(async <T,>(apiCall: () => Promise<T>): Promise<T | null> => {
        // Отменяем предыдущий запрос
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        setLoading(true);
        setError(null);

        try {
            return await apiCall();
        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log('Запрос был отменен');
                return null;
            }
            setError(err.message || 'Произошла ошибка');
            return null;
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    }, []);

    return { callApi, loading, error };
};