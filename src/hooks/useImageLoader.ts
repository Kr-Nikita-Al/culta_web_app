// hooks/useImageLoader.ts
import { useCallback, useRef } from 'react';
import { useImageCache } from '../context/ImageCacheContext';

export const useImageLoader = () => {
    const { loadAndCacheImage, cache } = useImageCache();
    const loadingPromises = useRef<Map<string, Promise<string | null>>>(new Map());

    const loadImage = useCallback(async (imageData: any): Promise<string | null> => {
        const imageId = imageData.image_id;

        // Если изображение уже загружается, возвращаем существующий промис
        if (loadingPromises.current.has(imageId)) {
            console.log(`⏳ Изображение ${imageId} уже загружается, возвращаем существующий промис`);
            return loadingPromises.current.get(imageId)!;
        }

        // Если blob уже есть в кеше и он актуален, возвращаем его сразу
        const cached = cache[imageId];
        const now = Date.now();
        if (cached?.blobUrl && cached.blobTimestamp &&
            (now - cached.blobTimestamp < 24 * 60 * 60 * 1000)) {
            console.log(`✅ Используем существующий blob для ${imageId}`);
            return cached.blobUrl;
        }

        // Если нет URL, не можем загрузить
        if (!imageData.url) {
            console.log(`❌ Нет URL для изображения ${imageId}`);
            return null;
        }

        console.log(`📥 Начинаем загрузку blob для ${imageId}`);

        // Создаем новый промис загрузки
        const loadPromise = loadAndCacheImage(imageData, imageData.url);
        loadingPromises.current.set(imageId, loadPromise);

        try {
            const result = await loadPromise;
            console.log(`✅ Загрузка blob для ${imageId} завершена:`, result ? 'успешно' : 'не удалось');
            return result;
        } catch (error) {
            console.error(`❌ Ошибка загрузки blob для ${imageId}:`, error);
            return null;
        } finally {
            // Удаляем промис после завершения
            loadingPromises.current.delete(imageId);
        }
    }, [loadAndCacheImage, cache]);

    return { loadImage };
};