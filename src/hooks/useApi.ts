import { useState, useCallback } from 'react';

export const useApi = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const callApi = useCallback(async <T,>(apiCall: () => Promise<T>): Promise<T | null> => {
        setLoading(true);
        setError(null);

        try {
            return await apiCall();
        } catch (err: any) {
            setError(err.message || 'Произошла ошибка');
            return null;
        } finally {
            setLoading(false);
        }
    }, []); // Пустой массив зависимостей для стабильности

    return {
        callApi,
        loading,
        error
    };
};