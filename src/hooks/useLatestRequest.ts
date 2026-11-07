import {useEffect, useRef, useCallback} from 'react';
export function useLatestRequest(scope: string) {
    const state = useRef({scope, sequence: 0});
    const mounted = useRef(true);
    if (state.current.scope !== scope) state.current = {scope, sequence: 0};
    useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
    return useCallback(() => {
        const identity = state.current;
        const sequence = ++identity.sequence;
        return () => mounted.current && state.current === identity && identity.sequence === sequence;
    }, []);
}
