import {useEffect, useRef, useState} from 'react';

// Each scope change invalidates callbacks from requests already in progress.
export function useScopedOperation(scope: string) {
    const current = useRef({scope, generation: 0});
    if (current.current.scope !== scope) {
        current.current = {scope, generation: current.current.generation + 1};
    }
    const mounted = useRef(true);
    const running = useRef<object | null>(null);
    const [activeScope, setActiveScope] = useState<object | null>(null);
    useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
    const begin = () => {
        const identity = current.current;
        if (running.current === identity) return null;
        running.current = identity;
        setActiveScope(identity);
        return {
            isCurrent: () => mounted.current && current.current === identity,
            finish: () => {
                if (running.current === identity) running.current = null;
                if (mounted.current) setActiveScope(value => value === identity ? null : value);
            }
        };
    };
    return {begin, busy: activeScope === current.current};
}
