import { useState, useCallback } from 'react';

interface UseApiCallProps<T> {
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
}

export const useApiCall = <T,>({ onSuccess, onError }: UseApiCallProps<T> = {}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<T | null>(null);

    const callApi = useCallback(async (apiCall: () => Promise<T>): Promise<T | null> => {
        setLoading(true);
        setError(null);

        try {
            const result = await apiCall();
            setData(result);
            onSuccess?.(result);
            return result;
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || err.message || 'Произошла ошибка';
            setError(errorMessage);
            onError?.(errorMessage);
            return null;
        } finally {
            setLoading(false);
        }
    }, [onSuccess, onError]);

    return { callApi, loading, error, data };
};