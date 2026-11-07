import {useState, useRef, useCallback, useEffect} from 'react';

export const useApi = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requests = useRef(new Set<AbortController>());
    const latest = useRef<AbortController | null>(null);

    const cancelRequest = useCallback(() => {
        requests.current.forEach(controller => controller.abort());
        requests.current.clear();
        latest.current = null;
        setLoading(false);
        setError(null);
    }, []);

    useEffect(() => {
        const pending = requests.current;
        return () => {
            pending.forEach(controller => controller.abort());
            pending.clear();
        };
    }, []);

    const callApi = useCallback(async <T,>(
        apiCall: (signal: AbortSignal) => Promise<T>
    ): Promise<T | null> => {
        const controller = new AbortController();
        requests.current.add(controller);
        latest.current = controller;
        setLoading(true);
        setError(null);
        try {
            const result = await apiCall(controller.signal);
            return controller.signal.aborted ? null : result;
        } catch (err: any) {
            if (controller.signal.aborted || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return null;
            if (latest.current === controller) {
                setError(typeof err?.message === 'string' ? err.message : 'Произошла ошибка');
            }
            // Keep the nullable API for readers that explicitly handle a failed load.
            // Mutations use their service directly so callers can handle HTTP errors.
            return null;
        } finally {
            requests.current.delete(controller);
            if (!controller.signal.aborted) setLoading(requests.current.size > 0);
        }
    }, []);

    return {callApi, loading, error, cancelRequest};
};
