import React, {createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef} from 'react';
import { useAuth } from './AuthContext';
import {getFolderImages, getImageById, refreshFolderUrls} from '../services/imageService';
import {useFolderLoading} from "../hooks/useFolderLoading";
import {imageSessionScope} from '../utils/imageSessionScope';

interface Image {
    image_id: string;
    company_id: string;
    type_col: string;
    image_type: string;
    file_path: string;
    title: string;
    file_name: string;
    resolution: string;
    tags: string;
    order_number: number;
    size: number;
    width: number;
    height: number;
    is_hidden: boolean;
    is_used: boolean;
    company_group_id: string;
    creator_id: string;
    time_created: string;
    url?: string;
}

interface ImageCacheItem {
    url: string;
    timestamp: number;
    imageData: Image;
    blobUrl?: string;
    blobTimestamp?: number;
    blob?: Blob;
}

const BLOB_CACHE_DURATION = 24 * 60 * 60 * 1000;
const FOLDER_CACHE_DURATION = 10 * 60 * 1000;

interface FolderCache {
    images: string[];
    timestamp: number;
    data: Image[];
    loading?: boolean;
    isLoadedFromServer?: boolean; // ← ДОБАВИТЬ ЭТО
}

interface FolderStructureCache {
    objects: { [key: string]: number };
    timestamp: number;
}

const FOLDER_STRUCTURE_CACHE_DURATION = 30 * 60 * 1000; // 30 минут

interface ImageCacheContextType {
    cache: Record<string, ImageCacheItem>;
    folderCache: Record<string, FolderCache>;
    getCurrentFolderImages: (folderPath: string) => Image[];
    loadFolderImages: (companyId: string, folderPath: string, includeSubfolders?: boolean, forceRefresh?: boolean) => Promise<void>;
    refreshFolderUrls: (companyId: string, folderPath: string) => Promise<void>;
    getCachedImageUrl: (imageId: string) => string | null;
    getCachedImage: (imageId: string) => { url: string; isBlob: boolean } | null;
    clearImageCache: () => void;
    loading: boolean;
    error: string | null;
    addImagesToCache: (companyId: string, folderPath: string, images: Image[]) => void;
    removeImageFromCache: (companyId: string, folderPath: string, imageId: string) => void;
    updateImageInCache: (companyId: string, folderPath: string, imageId: string, updatedImage: Image) => void;
    getCachedFolderData: (companyId: string, folderPath: string) => Image[] | null;
    invalidateFolderCache: (companyId: string, folderPath: string, keepImages: boolean) => void;
    getFolderImages_: (folderPath: string) => Image[];
    preloadImages: (images: Image[]) => Promise<void>;
    loadAndCacheImage: (imageData: Image, url: string) => Promise<string | null>;
    refreshExistingBlobs: (images: Image[]) => Promise<void>;
    getCachedFolderStructure: (companyId: string) => { [key: string]: number } | null;
    invalidateCachedFolderStructure: (companyId: string) => void;
    setCachedFolderStructure: (companyId: string, objects: { [key: string]: number }) => void;
    updateFolderCacheDirectly: (companyId: string, folderPath: string, images: Image[], forceIsLoadedFromServer: boolean | undefined) => void;
    getImageFromAnyFolder: (imageId: string) => Image | null;
    moveImageBetweenFolders: (imageId: string, fromFolder: string, toFolder: string, companyId: string) => void;
}

const ImageCacheContext = createContext<ImageCacheContextType | null>(null);

export const useImageCache = () => {
    const context = useContext(ImageCacheContext);
    if (!context) {
        throw new Error('useImageCache must be used within an ImageCacheProvider');
    }
    return context;
};

export const ImageCacheProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const {userId, token} = useAuth();
    // A token refresh preserves the cache; logout or another account starts a new one.
    return <SessionImageCacheProvider key={imageSessionScope(userId, token)}>
        {children}
    </SessionImageCacheProvider>;
};

const SessionImageCacheProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [cache, setCache] = useState<Record<string, ImageCacheItem>>({});
    const [folderCache, setFolderCache] = useState<Record<string, FolderCache>>({});
    const [loading, setLoading] = useState(false);
    const loadingCount = useRef(0);
    const [error, setError] = useState<string | null>(null);
    const loadingImages = useRef(new Map<string, Promise<string | null>>()).current;
    const imageControllers = useRef(new Map<string, AbortController>());
    const mounted = useRef(true);
    const activeRequests = useRef<Map<string, Promise<void>>>(new Map());
    const urlRequests = useRef(new Map<string, object>());
    const folderRevisions = useRef<Map<string, number>>(new Map());
    const { startFolderLoading, stopFolderLoading } = useFolderLoading();

    const [folderStructureCache, setFolderStructureCache] = useState<Record<string, FolderStructureCache>>({});
    const { token } = useAuth();
    const ownedCache = useRef(cache);
    ownedCache.current = cache;
    useEffect(() => {
        mounted.current = true;
        const controllers = imageControllers.current;
        return () => {
        mounted.current = false;
        controllers.forEach(controller => controller.abort());
        controllers.clear();
        Object.values(ownedCache.current).forEach(item => {
            if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
        });
        };
    }, []);

    useEffect(() => {
        const cleanupInterval = setInterval(() => {
            const now = Date.now();
            let cleanedCount = 0;

            setCache(prev => {
                const newCache = { ...prev };

                Object.keys(newCache).forEach(imageId => {
                    const item = newCache[imageId];
                    if (item.blobUrl && item.blobTimestamp &&
                        (now - item.blobTimestamp > BLOB_CACHE_DURATION)) {

                        try {
                            URL.revokeObjectURL(item.blobUrl);
                            cleanedCount++;
                        } catch (e) {
                            console.warn(`Ошибка при очистке blob URL для ${imageId}:`, e);
                        }

                        newCache[imageId] = {
                            ...item,
                            blobUrl: undefined,
                            blob: undefined
                        };
                    }
                });

                return newCache;
            });

            if (cleanedCount > 0) {
                console.log(`🧹 Очищено ${cleanedCount} устаревших blob'ов`);
            }
        }, 5 * 60 * 1000); // Каждые 5 минут

        return () => clearInterval(cleanupInterval);
    }, []);

    const cleanupExpiredBlobs = useCallback(() => {
        const now = Date.now();
        let cleanedCount = 0;

        setCache(prev => {
            const newCache = { ...prev };

            Object.keys(newCache).forEach(imageId => {
                const item = newCache[imageId];
                if (item.blobUrl && item.blobTimestamp &&
                    (now - item.blobTimestamp > BLOB_CACHE_DURATION)) {

                    URL.revokeObjectURL(item.blobUrl);
                    newCache[imageId] = {
                        ...item,
                        blobUrl: undefined,
                        blob: undefined
                    };
                    cleanedCount++;
                }
            });

            return newCache;
        });

        if (cleanedCount > 0) {
            console.log(`🧹 Очищено ${cleanedCount} устаревших blob'ов`);
        }
    }, []);

    useEffect(() => {
        const interval = setInterval(cleanupExpiredBlobs, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [cleanupExpiredBlobs]);

    const getCachedFolderStructure = useCallback((companyId: string): { [key: string]: number } | null => {
        const cacheKey = `structure_${companyId}`;
        const cached = folderStructureCache[cacheKey];

        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > FOLDER_STRUCTURE_CACHE_DURATION) {
            return null;
        }

        return cached.objects;
    }, [folderStructureCache]);

    const invalidateCachedFolderStructure = useCallback((companyId: string) => {
        setFolderStructureCache(prev => {
            const next = {...prev};
            delete next[`structure_${companyId}`];
            return next;
        });
    }, []);

    const setCachedFolderStructure = useCallback((companyId: string, objects: { [key: string]: number }) => {
        const cacheKey = `structure_${companyId}`;
        setFolderStructureCache(prev => ({
            ...prev,
            [cacheKey]: {
                objects,
                timestamp: Date.now()
            }
        }));
    }, []);

    const getCachedFolderData = useCallback((companyId: string, folderPath: string): Image[] | null => {
        const folderKey = `${companyId}_${folderPath}`;
        const cachedFolder = folderCache[folderKey];

        if (!cachedFolder) return null;

        const now = Date.now();
        if (now - cachedFolder.timestamp > FOLDER_CACHE_DURATION) {
            return null;
        }

        return cachedFolder.data || [];
    }, [folderCache]);

    const getFolderImages_ = useCallback((folderPath: string): Image[] => {
        if (!folderPath) return [];

        const folderKey = Object.keys(folderCache).find(key =>
            key.endsWith(`_${folderPath}`)
        );

        if (!folderKey) {
            console.log(`❌ Папка ${folderPath} не найдена в folderCache`);
            return [];
        }

        const folder = folderCache[folderKey];

        // ДОБАВИТЬ ПРОВЕРКУ НА СУЩЕСТВОВАНИЕ data
        if (!folder || !folder.data) {
            console.log(`❌ Данные папки ${folderPath} не найдены`);
            return [];
        }

        const folderImages = folder.data.filter(image =>
            image.file_path === folderPath
        );

        return folderImages;
    }, [folderCache]);

    // Улучшенная функция загрузки и кеширования изображения с дедупликацией
    const loadAndCacheImage = useCallback(async (imageData: Image, url: string): Promise<string | null> => {
        if (!mounted.current) return null;
        const imageId = imageData.image_id;

        // Пропускаем blob URLs
        if (url.startsWith('blob:')) {
            return null;
        }

        // Проверяем кеш СНАЧАЛА
        const cached = cache[imageId];
        const now = Date.now();

        // Если уже есть актуальный blob - возвращаем его
        if (cached?.blobUrl && cached.blobTimestamp &&
            (now - cached.blobTimestamp < BLOB_CACHE_DURATION)) {
            console.log(`✅ ${imageId}: используем существующий BLOB`);
            return cached.blobUrl;
        }

        // Проверяем, не загружается ли уже
        if (loadingImages.has(imageId)) {
            console.log(`⏳ ${imageId}: уже загружается, ожидаем...`);
            const existingPromise = loadingImages.get(imageId);
            if (existingPromise) {
                return await existingPromise;
            }
        }

        console.log(`📥 ${imageId}: начинаем загрузку BLOB`);

        const controller = new AbortController();
        imageControllers.current.set(imageId, controller);
        // Создаем промис загрузки
        const loadPromise = (async () => {
            try {
                const response = await fetch(url, {
                    signal: controller.signal,
                    mode: 'cors',
                    credentials: 'omit',
                    cache: 'no-cache',
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const blob = await response.blob();

                if (blob.size === 0) {
                    throw new Error('Пустой blob');
                }

                if (!blob.type.startsWith('image/')) {
                    console.warn(`Неверный тип файла: ${blob.type}`);
                    return null;
                }

                if (!mounted.current || controller.signal.aborted) return null;
                const blobUrl = URL.createObjectURL(blob);

                // Сохраняем в кеш
                setCache(prev => ({
                    ...prev,
                    [imageId]: {
                        url: url,
                        timestamp: now,
                        imageData: prev[imageId]?.imageData || imageData,
                        blobUrl: blobUrl,
                        blob: blob,
                        blobTimestamp: now
                    }
                }));

                console.log(`✅ ${imageId}: BLOB создан (${formatFileSize(blob.size)})`);
                return blobUrl;

            } catch (error) {
                if (!mounted.current || controller.signal.aborted) return null;
                console.error(`❌ ${imageId}: ошибка загрузки BLOB:`, error);

                // Сохраняем оригинальный URL в кеш при ошибке
                setCache(prev => ({
                    ...prev,
                    [imageId]: {
                        url: url,
                        timestamp: now,
                        imageData: prev[imageId]?.imageData || imageData
                    }
                }));

                return null;
            }
        })();

        // Сохраняем промис для предотвращения дублирования
        loadingImages.set(imageId, loadPromise);

        try {
            return await loadPromise;
        } finally {
            // Убираем из набора загружаемых
            if (imageControllers.current.get(imageId) === controller) imageControllers.current.delete(imageId);
            if (loadingImages.get(imageId) === loadPromise) loadingImages.delete(imageId);
        }
    }, [loadingImages, cache]);

    const getImageFromAnyFolder = useCallback((imageId: string): Image | null => {
        // Ищем изображение во всех папках
        for (const folderData of Object.values(folderCache)) {
            const image = folderData.data?.find(img => img.image_id === imageId);
            if (image) {
                return image;
            }
        }
        return null;
    }, [folderCache]);

    const moveImageBetweenFolders = useCallback((imageId: string, fromFolder: string, toFolder: string, companyId: string) => {
        if (!companyId || fromFolder === toFolder) return;

        const fromKey = `${companyId}_${fromFolder}`;
        const toKey = `${companyId}_${toFolder}`;

        setFolderCache(prev => {
            const newCache = { ...prev };

            // Находим изображение в исходной папке
            const fromFolderData = newCache[fromKey];
            if (!fromFolderData || !fromFolderData.data) return newCache;

            const imageIndex = fromFolderData.data.findIndex(img => img.image_id === imageId);
            if (imageIndex === -1) return newCache;

            // Извлекаем изображение
            const movedImage = {...fromFolderData.data[imageIndex], file_path: toFolder};

            // Обновляем исходную папку (сохраняем все флаги)
            newCache[fromKey] = {
                ...fromFolderData,
                images: fromFolderData.images.filter(id => id !== imageId),
                data: fromFolderData.data.filter(image => image.image_id !== imageId)
            };

            // Добавляем в целевую папку
            const toFolderData = newCache[toKey];
            const now = Date.now();

            if (toFolderData) {
                // Если папка уже есть в кеше - добавляем изображение, НЕ меняем isLoadedFromServer!
                newCache[toKey] = {
                    ...toFolderData,
                    images: [...toFolderData.images.filter(id => id !== imageId), imageId],
                    data: [...toFolderData.data.filter(image => image.image_id !== imageId), movedImage],
                    // ВАЖНО: сохраняем исходный флаг isLoadedFromServer
                    isLoadedFromServer: toFolderData.isLoadedFromServer
                };
                console.log(`🔄 Изображение ${imageId} перемещено в существующую папку ${toFolder}, isLoadedFromServer: ${toFolderData.isLoadedFromServer}`);
            } else {
                // Если папки нет в кеше - создаем новую запись с isLoadedFromServer = false
                newCache[toKey] = {
                    images: [imageId],
                    timestamp: now,
                    data: [movedImage],
                    isLoadedFromServer: false
                };
                console.log(`🔄 Изображение ${imageId} перемещено в новую папку ${toFolder}, isLoadedFromServer: false`);
            }

            return newCache;
        });
    }, []);

    // Упрощенная предзагрузка БЕЗ параллелизма
    const preloadImages = useCallback(async (images: Image[]) => {
        if (!token || images.length === 0) return;

        // Фильтруем только те изображения, которые действительно нужно предзагружать
        const imagesToPreload = images.filter(image => {
            if (!image.url) return false;

            const cached = cache[image.image_id];

            // Предзагружаем только если нет blob или он устарел
            return (!cached?.blobUrl ||
                    (cached.blobTimestamp &&
                        Date.now() - cached.blobTimestamp > BLOB_CACHE_DURATION)) &&
                !loadingImages.has(image.image_id); // Проверяем через has для Map
        });

        if (imagesToPreload.length === 0) {
            console.log('🚫 Нет изображений для предзагрузки');
            return;
        }

        console.log(`🚀 Начинаем предзагрузку ${imagesToPreload.length} изображений`);

        // Используем ограничение параллелизма
        const BATCH_SIZE = 3;
        let successfulLoads = 0;

        for (let i = 0; i < imagesToPreload.length; i += BATCH_SIZE) {
            const batch = imagesToPreload.slice(i, i + BATCH_SIZE);

            const results = await Promise.allSettled(
                batch.map(async (image, index) => {
                    try {
                        console.log(`📥 Предзагрузка ${i + index + 1}/${imagesToPreload.length}: ${image.image_id}`);

                        if (image.url) {
                            const result = await loadAndCacheImage(image, image.url);
                            if (result) {
                                return true;
                            }
                        }
                    } catch (error) {
                        console.error(`❌ Ошибка предзагрузки ${image.image_id}:`, error);
                    }
                })
            );

            successfulLoads += results.filter(result => result.status === 'fulfilled' && result.value === true).length;

            // Пауза между батчами
            if (i + BATCH_SIZE < imagesToPreload.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log(`✅ Предзагрузка завершена: ${successfulLoads}/${imagesToPreload.length} успешно`);
    }, [token, cache, loadingImages, loadAndCacheImage]);

    const refreshExistingBlobs = useCallback(async (images: Image[]) => {
        const imagesToRefresh = images.filter(image => {
            const cached = cache[image.image_id];
            return cached && image.url &&
                (!cached.blobUrl ||
                    (cached.blobTimestamp &&
                        Date.now() - cached.blobTimestamp > BLOB_CACHE_DURATION));
        });

        if (imagesToRefresh.length > 0) {
            console.log(`🔄 Обновляем blob'ы для ${imagesToRefresh.length} изображений`);
            await preloadImages(imagesToRefresh);
        }
    }, [cache, preloadImages]);

    const addImagesToCache = useCallback((companyId: string, folderPath: string, images: Image[]) => {
        if (!companyId || !folderPath) return;

        const folderKey = `${companyId}_${folderPath}`;
        const now = Date.now();

        const safeImages = images || [];

        setFolderCache(prev => {
            const existingFolder = prev[folderKey];

            if (existingFolder) {
                const existingImageIds = new Set(existingFolder.images || []);
                const newImages = safeImages.filter(img => !existingImageIds.has(img.image_id));

                if (newImages.length === 0) {
                    return prev;
                }

                return {
                    ...prev,
                    [folderKey]: {
                        images: [...(existingFolder.images || []), ...newImages.map(img => img.image_id)],
                        timestamp: now,
                        data: [...(existingFolder.data || []), ...newImages],
                        isLoadedFromServer: existingFolder.isLoadedFromServer // ← сохраняем существующий флаг
                    }
                };
            } else {
                return {
                    ...prev,
                    [folderKey]: {
                        images: safeImages.map(img => img.image_id),
                        timestamp: now,
                        data: safeImages,
                        isLoadedFromServer: false // ← по умолчанию false для новых папок
                    }
                };
            }
        });
    }, []);

    const updateFolderCacheDirectly = useCallback((companyId: string, folderPath: string, images: Image[], forceIsLoadedFromServer: boolean | null = null) => {
        const folderKey = `${companyId}_${folderPath}`;
        // Folder records retain server URLs; blob lifetime is managed separately.
        setFolderCache(prev => ({
            ...prev,
            [folderKey]: {
                images: images.map(image => image.image_id),
                timestamp: Date.now(),
                data: images,
                isLoadedFromServer: forceIsLoadedFromServer ?? prev[folderKey]?.isLoadedFromServer ?? false
            }
        }));
    }, []);

    const removeImageFromCache = useCallback((companyId: string, folderPath: string, imageId: string) => {
        imageControllers.current.get(imageId)?.abort();
        imageControllers.current.delete(imageId);
        loadingImages.delete(imageId);
        const prefix = `${companyId}_`;
        // In-flight lists may still contain the deleted image, including uncached folders.
        for (const key of Array.from(new Set([`${prefix}${folderPath}`, ...Array.from(activeRequests.current.keys())]))) {
            if (key.startsWith(prefix))
                folderRevisions.current.set(key, (folderRevisions.current.get(key) || 0) + 1);
        }
        setFolderCache(prev => {
            const next = {...prev};
            for (const [key, folder] of Object.entries(prev)) {
                if (!key.startsWith(prefix)) continue;
                if (!folder.images.includes(imageId) && !folder.data.some(image => image.image_id === imageId)) continue;
                next[key] = {...folder,
                    images: folder.images.filter(id => id !== imageId),
                    data: folder.data.filter(image => image.image_id !== imageId)};
            }
            return next;
        });

        setCache(prev => {
            const newCache = { ...prev };
            const item = newCache[imageId];
            if (item?.blobUrl) {
                URL.revokeObjectURL(item.blobUrl);
            }
            delete newCache[imageId];
            return newCache;
        });
    }, [loadingImages]);

    const updateImageInCache = useCallback((companyId: string, folderPath: string, imageId: string, updatedImage: Image) => {
        // Lists already in flight predate this confirmed edit.
        for (const key of Array.from(activeRequests.current.keys())) {
            if (key.startsWith(`${companyId}_`))
                folderRevisions.current.set(key, (folderRevisions.current.get(key) || 0) + 1);
        }
        const now = Date.now();
        setFolderCache(prev => {
            const next = {...prev};
            for (const [key, folder] of Object.entries(prev)) {
                if (!key.startsWith(`${companyId}_`)) continue;
                if (!folder.data.some(image => image.image_id === imageId)) continue;
                next[key] = {...folder, data: folder.data.map(image =>
                    image.image_id === imageId ? updatedImage : image)};
            }
            return next;
        });
        setCache(prev => ({
            ...prev,
            [imageId]: {
                ...prev[imageId],
                url: updatedImage.url || prev[imageId]?.url || '',
                timestamp: now,
                imageData: updatedImage
            }
        }));
    }, []);

    const invalidateFolderCache = useCallback((companyId: string, folderPath: string, keepImages: boolean = false) => {
        const folderKey = `${companyId}_${folderPath}`;
        folderRevisions.current.set(folderKey, (folderRevisions.current.get(folderKey) || 0) + 1);

        if (keepImages) {
            // Сохраняем данные, но помечаем для перезагрузки при следующем посещении
            setFolderCache(prev => {
                const folder = prev[folderKey];
                if (!folder) return prev;

                return {
                    ...prev,
                    [folderKey]: {
                        ...folder,
                        timestamp: 0 // Помечаем для перезагрузки
                    }
                };
            });
            console.log(`🔄 Папка помечена для перезагрузки: ${folderPath}`);
        } else {
            // Полная очистка
            setFolderCache(prev => {
                const newCache = { ...prev };
                delete newCache[folderKey];
                return newCache;
            });
            console.log(`🗑️ Кеш папки полностью очищен: ${folderPath}`);
        }
    }, []);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const updateFolderCache = useCallback((companyId: string, folderPath: string, updatedImages: Image[], isFromServer: boolean = true) => {
        const folderKey = `${companyId}_${folderPath}`;
        const now = Date.now();

        setFolderCache(prev => {
            const existingFolder = prev[folderKey];

            // Если папка уже существует, сохраняем isLoadedFromServer, если она уже была true
            const shouldKeepLoadedFlag = existingFolder && existingFolder.isLoadedFromServer && !isFromServer;

            return {
                ...prev,
                [folderKey]: {
                    images: updatedImages.map(img => img.image_id),
                    timestamp: now,
                    data: updatedImages,
                    isLoadedFromServer: shouldKeepLoadedFlag ? true : isFromServer
                }
            };
        });

        console.log(`🔄 Кеш папки ${folderPath} обновлен, изображений: ${updatedImages.length}, с сервера: ${isFromServer}`);
    }, []);

    const ensureAllImagesHaveUrls = useCallback(async (images: Image[], token: string): Promise<Image[]> => {
        const imagesWithUrls: Image[] = [];

        for (const image of images) {
            if (image.url) {
                // Если URL уже есть, используем его
                imagesWithUrls.push(image);
            } else {
                try {
                    // Получаем URL с сервера
                    console.log(`🔄 Получаем URL для изображения ${image.image_id}`);
                    const imageWithUrl = await getImageById(token, image.image_id);
                    if (imageWithUrl && imageWithUrl.url) {
                        imagesWithUrls.push({
                            ...image,
                            url: imageWithUrl.url
                        });
                        console.log(`✅ Получен URL для ${image.image_id}`);
                    } else {
                        // Если не удалось получить URL, все равно добавляем изображение
                        console.warn(`❌ Не удалось получить URL для ${image.image_id}`);
                        imagesWithUrls.push(image);
                    }
                } catch (error) {
                    console.error(`💥 Ошибка получения URL для ${image.image_id}:`, error);
                    // В случае ошибки все равно добавляем изображение
                    imagesWithUrls.push(image);
                }

                // Пауза между запросами чтобы не перегружать сервер
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return imagesWithUrls;
    }, []);

    // ОСНОВНОЕ УЛУЧШЕНИЕ: Загрузка изображений папки с дедупликацией
    const loadFolderImages = useCallback(async (companyId: string, folderPath: string, includeSubfolders: boolean = false, forceRefresh: boolean = false): Promise<void> => {
        if (!token || !companyId || !folderPath) return;

        const folderKey = `${companyId}_${folderPath}`;

        // Проверяем, не выполняется ли уже запрос для этой папки
        if (activeRequests.current.has(folderKey)) {
            console.log(`⏳ Запрос для папки ${folderPath} уже выполняется, ожидаем...`);
            try {await activeRequests.current.get(folderKey);} catch (error) {
                if (!forceRefresh) throw error;
            }
            if (!forceRefresh) return;
        }

        // Проверяем кеш
        const cachedFolder = folderCache[folderKey];
        const now = Date.now();
        const FOLDER_CACHE_DURATION = 30 * 60 * 1000;

        // Если папка полностью загружена с сервера и не устарела - НЕ делаем запрос
        if (!forceRefresh && cachedFolder &&
            cachedFolder.isLoadedFromServer === true && // ← ТОЧНО true
            cachedFolder.timestamp > 0 &&
            (now - cachedFolder.timestamp < FOLDER_CACHE_DURATION)) {
            console.log('📁 Используем кешированные данные с сервера для:', folderPath);
            return;
        }

        // Определяем причину загрузки для отладки
        let reason = 'нет в кеше';
        if (cachedFolder) {
            if (cachedFolder.isLoadedFromServer === false) reason = 'никогда не загружалась';
            else if (cachedFolder.timestamp === 0) reason = 'помечена для перезагрузки';
            else if (now - cachedFolder.timestamp > FOLDER_CACHE_DURATION) reason = 'устарел';
        }

        console.log('🖼️ Загрузка изображений для:', folderPath, 'причина:', reason);

        // Если папка создана искусственно (при перемещении) или устарела - ДЕЛАЕМ запрос
        console.log('🖼️ Загрузка изображений для:', folderPath, 'причина:',
            !cachedFolder ? 'нет в кеше' :
                !cachedFolder.isLoadedFromServer ? 'искусственный кеш' : 'устарел');

        // Создаем промис для этого запроса
        const revision = folderRevisions.current.get(folderKey) || 0;
        const requestPromise = (async () => {
            startFolderLoading(folderKey);
            loadingCount.current += 1;
            setLoading(true);

            try {
                const response = await getFolderImages(token, companyId, folderPath, includeSubfolders);
                if ((folderRevisions.current.get(folderKey) || 0) !== revision) return;
                if (!response || !Array.isArray(response.images)) {
                    throw new Error('Некорректный ответ при загрузке изображений');
                }

                if (response?.images) {
                    const folderImages = response.images.filter(img => img.file_path === folderPath);
                    const imagesWithUrls = await ensureAllImagesHaveUrls(folderImages, token);
                    if ((folderRevisions.current.get(folderKey) || 0) !== revision) return;

                    // Сохраняем с флагом isLoadedFromServer = true
                    updateFolderCache(companyId, folderPath, imagesWithUrls, true); // ← true означает "загружено с сервера"
                }

            } catch (error) {
                if ((folderRevisions.current.get(folderKey) || 0) !== revision) return;
                if (error instanceof Error && error.name === 'AbortError') {
                    console.log('📝 Загрузка папки отменена');
                    return;
                }
                console.error('💥 Ошибка загрузки папки:', error);
                setError('Ошибка загрузки изображений');
                throw error;
            } finally {
                loadingCount.current = Math.max(0, loadingCount.current - 1);
                setLoading(loadingCount.current > 0);
                stopFolderLoading(folderKey);
            }
        })();

        // Сохраняем промис в карту активных запросов
        activeRequests.current.set(folderKey, requestPromise);

        try {
            await requestPromise;
        } finally {
            // Удаляем промис из карты после завершения
            if (activeRequests.current.get(folderKey) === requestPromise) activeRequests.current.delete(folderKey);
        }
    }, [token, folderCache, startFolderLoading, stopFolderLoading, updateFolderCache, ensureAllImagesHaveUrls]);


    const getCurrentFolderImages = useCallback((folderPath: string): Image[] => {
        if (!folderPath) return [];

        const folderKey = Object.keys(folderCache).find(key =>
            key.endsWith(`_${folderPath}`)
        );

        if (!folderKey) return [];

        const folder = folderCache[folderKey];
        if (!folder || !folder.data) return [];

        return folder.data;
    }, [folderCache]);

    const refreshFolderUrlsCache = useCallback(async (companyId: string, folderPath: string) => {
        if (!token) {
            setError('Токен не найден');
            return;
        }

        const requestKey = `${companyId}_${folderPath}`;
        const identity = {};
        urlRequests.current.set(requestKey, identity);
        const isCurrent = () => mounted.current && urlRequests.current.get(requestKey) === identity;
        console.log('🔄 Принудительное обновление URL папки:', folderPath);
        loadingCount.current += 1;
            setLoading(true);
        setError(null);

        try {
            const response = await refreshFolderUrls(token, companyId, folderPath);
            if (!isCurrent()) return;
            if (!response || !response.urls || typeof response.urls !== 'object' || Array.isArray(response.urls))
                throw new Error('Invalid image URL response');

            if (response.urls) {
                const urls = response.urls;
                const folderKey = `${companyId}_${folderPath}`;
                // A signed URL refresh does not invalidate an already downloaded preview.
                // Update current entries only: an older response must not recreate deleted cards.
                setCache(prev => {
                    const next = {...prev};
                    for (const [imageId, url] of Object.entries(urls)) {
                        const item = prev[imageId];
                        if (!item || item.imageData.company_id !== companyId || typeof url !== 'string') continue;
                        next[imageId] = {...item, url, imageData: {...item.imageData, url}};
                    }
                    return next;
                });
                setFolderCache(prev => {
                    const folder = prev[folderKey];
                    if (!folder) return prev;
                    return {...prev, [folderKey]: {...folder, data: folder.data.map(image =>
                        typeof urls[image.image_id] === 'string'
                            ? {...image, url: urls[image.image_id]} : image)}};
                });

                console.log('✅ URL и изображения папки обновлены');
            }
        } catch (apiError: any) {
            if (!isCurrent()) return;
            console.error('Ошибка обновления URL папки:', apiError);
            setError('Не удалось обновить ссылки изображений. Повторите попытку.');
        } finally {
            if (isCurrent()) urlRequests.current.delete(requestKey);
            loadingCount.current = Math.max(0, loadingCount.current - 1);
                setLoading(loadingCount.current > 0);
        }
    }, [token]);

    const getCachedImage = useCallback((imageId: string): {
        url: string;
        isBlob: boolean;
        blobTimestamp?: number;
    } | null => {
        const cached = cache[imageId];

        if (!cached) {
            return null;
        }

        const now = Date.now();

        // Используем blob если он есть и не устарел
        if (cached.blobUrl && cached.blobTimestamp) {
            const isBlobExpired = now - cached.blobTimestamp > BLOB_CACHE_DURATION;

            if (!isBlobExpired) {
                return {
                    url: cached.blobUrl,
                    isBlob: true,
                    blobTimestamp: cached.blobTimestamp
                };
            }
        }

        // Используем оригинальный URL если он есть
        if (cached.url && !cached.url.startsWith('blob:')) {
            return {
                url: cached.url,
                isBlob: false,
                blobTimestamp: undefined
            };
        }

        return null;
    }, [cache]);

    const getCachedImageUrl = useCallback((imageId: string): string | null => {
        const cached = getCachedImage(imageId);
        return cached ? cached.url : null;
    }, [getCachedImage]);

    const clearImageCache = useCallback(() => {
        urlRequests.current.clear();
        imageControllers.current.forEach(controller => controller.abort());
        loadingImages.clear();
        for (const key of Array.from(activeRequests.current.keys()))
            folderRevisions.current.set(key, (folderRevisions.current.get(key) || 0) + 1);
        setFolderStructureCache({});
        Object.values(cache).forEach(item => {
            if (item.blobUrl) {
                URL.revokeObjectURL(item.blobUrl);
            }
        });

        setCache({});
        setFolderCache({});
        setError(null);
        console.log('🧹 Кеш полностью очищен');
    }, [cache, loadingImages]);

    const contextValue: ImageCacheContextType = {
        cache,
        folderCache,
        getCurrentFolderImages,
        loadFolderImages,
        refreshFolderUrls: refreshFolderUrlsCache,
        getCachedImageUrl,
        getCachedImage,
        clearImageCache,
        loading,
        error,
        addImagesToCache,
        removeImageFromCache,
        updateImageInCache,
        getCachedFolderData,
        invalidateFolderCache,
        getFolderImages_,
        preloadImages,
        loadAndCacheImage,
        refreshExistingBlobs,
        getCachedFolderStructure,
        setCachedFolderStructure,
        invalidateCachedFolderStructure,
        updateFolderCacheDirectly,
        getImageFromAnyFolder,
        moveImageBetweenFolders
    };

    return (
        <ImageCacheContext.Provider value={contextValue}>
            {children}
        </ImageCacheContext.Provider>
    );
};
