// hooks/useFolderLoading.ts
import { useState, useCallback } from 'react';

export const useFolderLoading = () => {
    const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

    const startFolderLoading = useCallback((folderKey: string) => {
        setLoadingFolders(prev => {
            const newSet = new Set(prev);
            newSet.add(folderKey);
            return newSet;
        });
    }, []);

    const stopFolderLoading = useCallback((folderKey: string) => {
        setLoadingFolders(prev => {
            const newSet = new Set(prev);
            newSet.delete(folderKey);
            return newSet;
        });
    }, []);

    const isFolderLoading = useCallback((folderKey: string) => {
        return loadingFolders.has(folderKey);
    }, [loadingFolders]);

    return {
        loadingFolders,
        startFolderLoading,
        stopFolderLoading,
        isFolderLoading
    };
};