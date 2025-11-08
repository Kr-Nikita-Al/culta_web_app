import React, {createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef} from 'react';
import { useAuth } from './AuthContext';
import { useApi } from '../hooks/useApi';
import {getFolderImages, getImageById, refreshFolderUrls} from '../services/imageService';
import {useFolderLoading} from "../hooks/useFolderLoading";

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
    loadFolderImages: (companyId: string, folderPath: string, includeSubfolders?: boolean) => Promise<void>;
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
    const [cache, setCache] = useState<Record<string, ImageCacheItem>>({});
    const [folderCache, setFolderCache] = useState<Record<string, FolderCache>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingImages, setLoadingImages] = useState<Map<string, Promise<string | null>>>(new Map());
    const [activeFolderRequests, setActiveFolderRequests] = useState<Set<string>>(new Set());
    const activeRequests = useRef<Map<string, Promise<void>>>(new Map());
    const { loadingFolders, startFolderLoading, stopFolderLoading, isFolderLoading } = useFolderLoading();
    const [completedPreloads, setCompletedPreloads] = useState<Set<string>>(new Set());

    const [folderStructureCache, setFolderStructureCache] = useState<Record<string, FolderStructureCache>>({});
    const { token } = useAuth();
    const { callApi } = useApi();

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
    }, [BLOB_CACHE_DURATION]);

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
    }, [BLOB_CACHE_DURATION]);

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
    }, [folderStructureCache, FOLDER_STRUCTURE_CACHE_DURATION]);

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
    }, [folderCache, FOLDER_CACHE_DURATION]);

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

        // Создаем промис загрузки
        const loadPromise = (async () => {
            try {
                const response = await fetch(url, {
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

                const blobUrl = URL.createObjectURL(blob);

                // Сохраняем в кеш
                setCache(prev => ({
                    ...prev,
                    [imageId]: {
                        url: url,
                        timestamp: now,
                        imageData: imageData,
                        blobUrl: blobUrl,
                        blob: blob,
                        blobTimestamp: now
                    }
                }));

                console.log(`✅ ${imageId}: BLOB создан (${formatFileSize(blob.size)})`);
                return blobUrl;

            } catch (error) {
                console.error(`❌ ${imageId}: ошибка загрузки BLOB:`, error);

                // Сохраняем оригинальный URL в кеш при ошибке
                setCache(prev => ({
                    ...prev,
                    [imageId]: {
                        url: url,
                        timestamp: now,
                        imageData: imageData
                    }
                }));

                return null;
            }
        })();

        // Сохраняем промис для предотвращения дублирования
        setLoadingImages(prev => new Map(prev).set(imageId, loadPromise));

        try {
            return await loadPromise;
        } finally {
            // Убираем из набора загружаемых
            setLoadingImages(prev => {
                const newMap = new Map(prev);
                newMap.delete(imageId);
                return newMap;
            });
        }
    }, [loadingImages, cache, BLOB_CACHE_DURATION]);

    const getImageFromAnyFolder = useCallback((imageId: string): Image | null => {
        // Ищем изображение во всех папках
        for (const [folderKey, folderData] of Object.entries(folderCache)) {
            const image = folderData.data?.find(img => img.image_id === imageId);
            if (image) {
                return image;
            }
        }
        return null;
    }, [folderCache]);

    const moveImageBetweenFolders = useCallback((imageId: string, fromFolder: string, toFolder: string, companyId: string) => {
        if (!companyId) return;

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
            const [movedImage] = fromFolderData.data.splice(imageIndex, 1);

            // Обновляем исходную папку (сохраняем все флаги)
            newCache[fromKey] = {
                ...fromFolderData,
                images: fromFolderData.images.filter(id => id !== imageId),
                data: fromFolderData.data
            };

            // Добавляем в целевую папку
            const toFolderData = newCache[toKey];
            const now = Date.now();

            if (toFolderData) {
                // Если папка уже есть в кеше - добавляем изображение, НЕ меняем isLoadedFromServer!
                newCache[toKey] = {
                    ...toFolderData,
                    images: [...toFolderData.images, imageId],
                    data: [...toFolderData.data, movedImage],
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

            await Promise.allSettled(
                batch.map(async (image, index) => {
                    try {
                        console.log(`📥 Предзагрузка ${i + index + 1}/${imagesToPreload.length}: ${image.image_id}`);

                        if (image.url) {
                            const result = await loadAndCacheImage(image, image.url);
                            if (result) {
                                successfulLoads++;
                                console.log(`✅ Успешно предзагружено: ${image.image_id}`);
                            }
                        }
                    } catch (error) {
                        console.error(`❌ Ошибка предзагрузки ${image.image_id}:`, error);
                    }
                })
            );

            // Пауза между батчами
            if (i + BATCH_SIZE < imagesToPreload.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log(`✅ Предзагрузка завершена: ${successfulLoads}/${imagesToPreload.length} успешно`);
    }, [token, cache, loadingImages, loadAndCacheImage, BLOB_CACHE_DURATION]);

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
    }, [cache, preloadImages, BLOB_CACHE_DURATION]);

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
        const now = Date.now();

        // Сохраняем существующий флаг isLoadedFromServer если папка уже есть, ИЛИ используем переданный флаг
        const existingFolder = folderCache[folderKey];
        let isLoadedFromServerValue: boolean; // ← ЯВНО УКАЗЫВАЕМ ТИП

        if (forceIsLoadedFromServer !== null) {
            // Если явно указан флаг - используем его
            isLoadedFromServerValue = forceIsLoadedFromServer;
        } else if (existingFolder && existingFolder.isLoadedFromServer !== undefined) {
            // Если папка уже существует - сохраняем ее флаг
            isLoadedFromServerValue = existingFolder.isLoadedFromServer;
        } else {
            // По умолчанию - false для новых папок
            isLoadedFromServerValue = false;
        }

        // Сохраняем blob'ы из существующего кеша
        const imagesWithPreservedBlobs = images.map(image => {
            const cachedImage = cache[image.image_id];
            if (cachedImage && cachedImage.blobUrl) {
                return {
                    ...image,
                    url: cachedImage.blobUrl
                };
            }
            return image;
        });

        setFolderCache(prev => ({
            ...prev,
            [folderKey]: {
                images: imagesWithPreservedBlobs.map(img => img.image_id),
                timestamp: now,
                data: imagesWithPreservedBlobs,
                isLoadedFromServer: isLoadedFromServerValue
            }
        }));

        console.log(`🔄 Прямое обновление кеша папки ${folderPath}, изображений: ${imagesWithPreservedBlobs.length}, isLoadedFromServer: ${isLoadedFromServerValue}`);
    }, [cache, folderCache])

    const removeImageFromCache = useCallback((companyId: string, folderPath: string, imageId: string) => {
        const folderKey = `${companyId}_${folderPath}`;

        setFolderCache(prev => {
            const folder = prev[folderKey];
            if (!folder) return prev;

            const updatedFolder = {
                ...folder,
                images: folder.images.filter(id => id !== imageId),
                data: folder.data.filter(img => img.image_id !== imageId)
            };

            console.log(`🗑️ Удалено изображение ${imageId} из папки ${folderPath}, осталось: ${updatedFolder.data.length}`);
            return {
                ...prev,
                [folderKey]: updatedFolder
            };
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
    }, []);

    const updateImageInCache = useCallback((companyId: string, folderPath: string, imageId: string, updatedImage: Image) => {
        const folderKey = `${companyId}_${folderPath}`;
        const now = Date.now();

        // Сохраняем существующий blob если он есть
        const existingCacheItem = cache[imageId];
        const existingBlobUrl = existingCacheItem?.blobUrl;
        const existingBlobTimestamp = existingCacheItem?.blobTimestamp;
        const existingBlob = existingCacheItem?.blob;

        setFolderCache(prev => {
            const folder = prev[folderKey];
            if (!folder) {
                // Если папки нет в кеше, создаем новую
                return {
                    ...prev,
                    [folderKey]: {
                        images: [imageId],
                        timestamp: now,
                        data: [updatedImage]
                    }
                };
            }

            return {
                ...prev,
                [folderKey]: {
                    ...folder,
                    data: folder.data.map(img =>
                        img.image_id === imageId ? updatedImage : img
                    )
                }
            };
        });

        setCache(prev => ({
            ...prev,
            [imageId]: {
                url: updatedImage.url || prev[imageId]?.url || '',
                timestamp: now,
                imageData: updatedImage,
                // СОХРАНЯЕМ СУЩЕСТВУЮЩИЙ BLOB ЕСЛИ ОН ЕСТЬ
                blobUrl: existingBlobUrl || prev[imageId]?.blobUrl,
                blobTimestamp: existingBlobTimestamp || prev[imageId]?.blobTimestamp,
                blob: existingBlob || prev[imageId]?.blob
            }
        }));

        console.log(`🔄 Обновлено изображение ${imageId} в кеше, blob сохранен: ${!!existingBlobUrl}`);
    }, []);

    const invalidateFolderCache = useCallback((companyId: string, folderPath: string, keepImages: boolean = false) => {
        const folderKey = `${companyId}_${folderPath}`;

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

    const ensureAllImagesHaveUrls = async (images: Image[], token: string): Promise<Image[]> => {
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
    };

    // ОСНОВНОЕ УЛУЧШЕНИЕ: Загрузка изображений папки с дедупликацией
    const loadFolderImages = useCallback(async (companyId: string, folderPath: string, includeSubfolders: boolean = false): Promise<void> => {
        if (!token || !companyId || !folderPath) return;

        const folderKey = `${companyId}_${folderPath}`;

        // Проверяем, не выполняется ли уже запрос для этой папки
        if (activeRequests.current.has(folderKey)) {
            console.log(`⏳ Запрос для папки ${folderPath} уже выполняется, ожидаем...`);
            await activeRequests.current.get(folderKey);
            return;
        }

        // Проверяем кеш
        const cachedFolder = folderCache[folderKey];
        const now = Date.now();
        const FOLDER_CACHE_DURATION = 30 * 60 * 1000;

        // Если папка полностью загружена с сервера и не устарела - НЕ делаем запрос
        if (cachedFolder &&
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
        const requestPromise = (async () => {
            startFolderLoading(folderKey);
            setLoading(true);

            try {
                const response = await callApi(() =>
                    getFolderImages(token, companyId, folderPath, includeSubfolders)
                );

                if (response === null) {
                    console.log('📝 Запрос был отменен, пропускаем обновление кеша');
                    return;
                }

                if (response?.images) {
                    const folderImages = response.images.filter(img => img.file_path === folderPath);
                    const imagesWithUrls = await ensureAllImagesHaveUrls(folderImages, token);

                    // Сохраняем с флагом isLoadedFromServer = true
                    updateFolderCache(companyId, folderPath, imagesWithUrls, true); // ← true означает "загружено с сервера"
                }

            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    console.log('📝 Загрузка папки отменена');
                    return;
                }
                console.error('💥 Ошибка загрузки папки:', error);
                setError('Ошибка загрузки изображений');
            } finally {
                setLoading(false);
                stopFolderLoading(folderKey);
            }
        })();

        // Сохраняем промис в карту активных запросов
        activeRequests.current.set(folderKey, requestPromise);

        try {
            await requestPromise;
        } finally {
            // Удаляем промис из карты после завершения
            activeRequests.current.delete(folderKey);
        }
    }, [token, callApi, folderCache, startFolderLoading, stopFolderLoading, updateFolderCache, ensureAllImagesHaveUrls]);


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

        console.log('🔄 Принудительное обновление URL папки:', folderPath);
        setLoading(true);
        setError(null);

        try {
            const response = await callApi(() =>
                refreshFolderUrls(token, companyId, folderPath)
            );

            if (response && response.urls) {
                const updatedCache: Record<string, ImageCacheItem> = {};
                const now = Date.now();
                const folderKey = `${companyId}_${folderPath}`;
                const currentFolder = folderCache[folderKey];

                if (!currentFolder) {
                    console.log('❌ Папка не найдена в кеше для обновления');
                    return;
                }

                for (const [imageId, newUrl] of Object.entries(response.urls)) {
                    const cachedItem = cache[imageId];
                    if (cachedItem) {
                        if (cachedItem.blobUrl) {
                            URL.revokeObjectURL(cachedItem.blobUrl);
                        }

                        await loadAndCacheImage(cachedItem.imageData, newUrl as string);
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }

                setFolderCache(prev => ({
                    ...prev,
                    [folderKey]: {
                        ...currentFolder,
                        timestamp: now
                    }
                }));

                console.log('✅ URL и изображения папки обновлены');
            }
        } catch (apiError: any) {
            console.error('Ошибка обновления URL папки:', apiError);
            setError(apiError.message || 'Не удалось обновить URL изображений');
        } finally {
            setLoading(false);
        }
    }, [token, callApi, cache, folderCache, loadAndCacheImage]);

    const getCachedImageUrl = useCallback((imageId: string): string | null => {
        const cached = getCachedImage(imageId);
        return cached ? cached.url : null;
    }, []);

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
    }, [cache, BLOB_CACHE_DURATION]);

    const clearImageCache = useCallback(() => {
        Object.values(cache).forEach(item => {
            if (item.blobUrl) {
                URL.revokeObjectURL(item.blobUrl);
            }
        });

        setCache({});
        setFolderCache({});
        setError(null);
        console.log('🧹 Кеш полностью очищен');
    }, [cache]);

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