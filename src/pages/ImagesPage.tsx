import React, {useState, useEffect, useRef, useCallback, useMemo, cache} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSelectedCompany } from '../context/SelectedCompanyContext';
import { useApi } from '../hooks/useApi';
import {
    uploadImage,
    getImageById,
    deleteImage,
    updateImage,
    getStorageInfo,
    StorageInfo
} from '../services/imageService';
import {
    createDirectory,
    deleteDirectory,
    getDirectoryObjects,
    renameDirectory
} from '../services/directoryService';
import { useNotifications } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import FolderTree from "../components/FolderTree";
import config from "../config";
import {useImageCache} from "../context/ImageCacheContext";
import { handleImageError, withErrorHandling, ApiError } from '../utils/errorHandler';

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

interface Folder {
    id: string;
    name: string;
    path: string;
    isDirectory: boolean;
}

interface FolderNode {
    path: string;
    name: string;
    children: FolderNode[];
}

const loaderStyles = `
@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
}
.animate-bounce {
    animation: bounce 1s infinite;
}
.animation-delay-100 {
    animation-delay: 0.1s;
}
.animation-delay-200 {
    animation-delay: 0.2s;
}
`;

const imageOptimizationStyles = `
/* Оптимизация загрузки изображений */
.image-optimized {
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
    transform: translateZ(0);
    backface-visibility: hidden;
}

/* Приоритетная загрузка видимых изображений */
.image-priority {
    fetchpriority: high;
}

/* Плавное появление */
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.image-fade-in {
    animation: fadeIn 0.3s ease-in-out;
}
`;

const BeautifulLoader = ({ text = "Загрузка изображений..." }) => {
    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 border-4 border-amber-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-transparent border-t-amber-600 rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-4 border-amber-100 rounded-full"></div>
                <div className="absolute inset-2 border-4 border-transparent border-b-amber-500 rounded-full animate-spin animation-delay-200"></div>
            </div>
            <p className="text-coffee-dark font-medium">{text}</p>
            <div className="flex space-x-1 mt-2">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce animation-delay-100"></div>
                <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce animation-delay-200"></div>
            </div>
        </div>
    );
};

const FastImage: React.FC<{
    imageData: Image;
    className?: string;
    onLoad?: () => void;
    onError?: () => void;
}> = ({ imageData, className, onLoad, onError }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [currentUrl, setCurrentUrl] = useState<string | null>(null);
    const { getCachedImage, loadAndCacheImage } = useImageCache();
    const mountedRef = useRef(true);
    const loadingRef = useRef(false);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const initializeImage = async () => {
            if (!imageData.url || loadingRef.current) return;

            loadingRef.current = true;
            const imageId = imageData.image_id;

            try {
                // 1. СНАЧАЛА проверяем кеш - может blob уже есть
                const cached = getCachedImage(imageId);

                if (cached) {
                    // 2. Если есть в кеше (blob или оригинальный) - используем сразу
                    console.log(`📷 ${imageId}: используем кешированный URL (${cached.isBlob ? 'BLOB' : 'ORIGINAL'})`);
                    if (mountedRef.current) {
                        setCurrentUrl(cached.url);
                    }

                    // 3. Если это оригинальный URL (не blob) - запускаем фоновую конвертацию в blob
                    if (!cached.isBlob && imageData.url) {
                        console.log(`🔄 ${imageId}: запускаем фоновую конвертацию в BLOB`);
                        loadAndCacheImage(imageData, imageData.url)
                            .then(blobUrl => {
                                if (blobUrl && mountedRef.current) {
                                    console.log(`✅ ${imageId}: BLOB создан в фоне, обновляем`);
                                    setCurrentUrl(blobUrl);
                                }
                            })
                            .catch(err => {
                                console.warn(`⚠️ ${imageId}: фоновая конвертация не удалась:`, err);
                            });
                    }
                } else {
                    // 4. Если нет в кеше - СРАЗУ загружаем blob
                    console.log(`📥 ${imageId}: нет в кеше, загружаем BLOB`);
                    const blobUrl = await loadAndCacheImage(imageData, imageData.url);

                    if (blobUrl && mountedRef.current) {
                        console.log(`✅ ${imageId}: BLOB загружен`);
                        setCurrentUrl(blobUrl);
                    } else if (mountedRef.current && imageData.url) {
                        // Fallback: если blob не загрузился, используем оригинальный URL
                        console.log(`🔄 ${imageId}: используем оригинальный URL как fallback`);
                        setCurrentUrl(imageData.url);
                    }
                }
            } catch (error) {
                console.error(`❌ ${imageId}: ошибка инициализации:`, error);
                // Fallback на оригинальный URL при любой ошибке
                if (mountedRef.current && imageData.url) {
                    setCurrentUrl(imageData.url);
                }
            } finally {
                loadingRef.current = false;
            }
        };

        initializeImage();
    }, [imageData, getCachedImage, loadAndCacheImage]);

    const handleLoad = () => {
        if (mountedRef.current) {
            setIsLoaded(true);
            onLoad?.();
        }
    };

    const handleError = () => {
        if (mountedRef.current) {
            console.warn(`Ошибка загрузки изображения ${imageData.image_id}`);
            setError(true);
            onError?.();
        }
    };

    if (error || !currentUrl) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            {currentUrl && (
                <img
                    src={currentUrl}
                    alt={imageData.title || imageData.file_name}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${
                        isLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    onLoad={handleLoad}
                    onError={handleError}
                    loading="lazy"
                />
            )}
        </div>
    );
};

const ImagesPage: React.FC = () => {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [viewImage, setViewImage] = useState<{url: string, title: string, isLoaded?: boolean} | null>(null);
    const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [editingItem, setEditingItem] = useState<{ type: 'folder' | 'image', id: string, name: string } | null>(null);
    const [editName, setEditName] = useState('');
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moving, setMoving] = useState(false);
    const [selectedTargetFolder, setSelectedTargetFolder] = useState('');
    const [folderStructure, setFolderStructure] = useState<FolderNode | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
    const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
    const [fullFolderStructure, setFullFolderStructure] = useState<{ [key: string]: number }>({});
    const [contentLoading, setContentLoading] = useState(false);
    const [cacheUpdateTrigger, setCacheUpdateTrigger] = useState(0);
    const [renamingFolders, setRenamingFolders] = useState<Set<string>>(new Set());

    const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
    const { selectedCompany } = useSelectedCompany();
    const basePath = `company_images/company_${selectedCompany}/`;
    const [currentPath, setCurrentPath] = useState(basePath);
    const [pathHistory, setPathHistory] = useState<string[]>([]);
    const [imagesLoadError, setImagesLoadError] = useState<string | null>(null);
    const [foldersLoadError, setFoldersLoadError] = useState<string | null>(null);
    const { token } = useAuth();
    const { callApi } = useApi();
    const { addNotification } = useNotifications();

    const {
        folderCache,
        addImagesToCache,
        removeImageFromCache,
        updateImageInCache,
        loadFolderImages,
        getCurrentFolderImages,
        refreshExistingBlobs,
        getCachedImage,
        getCachedFolderStructure,
        setCachedFolderStructure,
        getImageFromAnyFolder,
        moveImageBetweenFolders,
        invalidateFolderCache,
        updateFolderCacheDirectly
    } = useImageCache();

    const loadStorageLimits = useCallback(async () => {
        if (!token || !selectedCompany) return;

        try {
            const response = await callApi(() => getStorageInfo(token, selectedCompany));
            if (response) {
                setStorageInfo(response);
            }
        } catch (error) {
            console.error('Ошибка загрузки лимитов хранилища:', error);
        }
    }, [token, selectedCompany, callApi]);

    // Загружаем лимиты при изменении компании
    useEffect(() => {
        if (selectedCompany) {
            loadStorageLimits();
        }
    }, [selectedCompany, loadStorageLimits]);

    // Обновите useMemo для images с зависимостью от cacheUpdateTrigger:
    const images = useMemo(() => {
        const folderImages = getCurrentFolderImages(currentPath);
        return folderImages || []; // ГАРАНТИРУЕМ ЧТО ВСЕГДА ВОЗВРАЩАЕМ МАССИВ
    }, [currentPath, getCurrentFolderImages, cacheUpdateTrigger]);

    // Загрузка полной структуры папок при инициализации
    const loadFullFolderStructure = async (forceRefresh = false) => {
        if (!token || !selectedCompany) return;

        // Сохраняем текущее состояние перед обновлением
        const currentFolders = [...folders];

        try {
            if (forceRefresh && selectedCompany) {
                setCachedFolderStructure(selectedCompany, {});
            }

            setFoldersLoadError(null); // Сбрасываем ошибку перед загрузкой

            const response = await callApi(() => getDirectoryObjects(token, selectedCompany));

            // ПРОВЕРЯЕМ ЧТО ЗАПРОС НЕ БЫЛ ОТМЕНЕН И ЕСТЬ ДАННЫЕ
            if (response === null) {
                console.log('📝 Запрос структуры папок был отменен');
                return false;
            }

            if (!response || Object.keys(response).length === 0) {
                console.log('📝 Структура папок пустая');
                setFolders([]);
                return true;
            }

            setFullFolderStructure(response);
            setCachedFolderStructure(selectedCompany, response);

            // Используем preserveExisting: true чтобы минимизировать мерцание
            processDirectoryObjects(response, currentPath, true);

            return true;

        } catch (error) {
            console.error('Ошибка загрузки структуры папок:', error);
            setFoldersLoadError('Не удалось загрузить структуру папок. Проверьте подключение к интернету.');
            // Восстанавливаем предыдущее состояние при ошибке
            setFolders(currentFolders);
            throw error;
        }
    };

    const formatSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Обработка объектов директории из полной структуры
    const processDirectoryObjects = useCallback((objects: { [key: string]: number }, targetPath: string, preserveExisting: boolean = false) => {
        if (!objects || !targetPath) {
            if (!preserveExisting) {
                setFolders([]);
            }
            return;
        }

        const folderList: Folder[] = preserveExisting ? [...folders] : [];
        const processedPaths = new Set<string>(preserveExisting ? folders.map(f => f.path) : []);

        console.log(`🔍 Обработка объектов для пути: ${targetPath}`, objects);

        Object.entries(objects).forEach(([path, size]) => {
            if (!path.endsWith('/')) return;
            if (!path.startsWith(targetPath)) return;

            const relativePath = path.substring(targetPath.length);
            const parts = relativePath.split('/').filter(part => part !== '');

            if (parts.length === 1) {
                const folderName = parts[0];
                const fullFolderPath = targetPath + folderName + '/';

                if (!processedPaths.has(fullFolderPath)) {
                    folderList.push({
                        id: fullFolderPath,
                        name: folderName,
                        path: fullFolderPath,
                        isDirectory: true
                    });
                    processedPaths.add(fullFolderPath);
                }
            }
        });

        console.log(`📁 Найдено папок для ${targetPath}:`, folderList.length);
        setFolders(folderList.sort((a, b) => a.name.localeCompare(b.name)));
    }, [folders]); // Добавляем folders в зависимости

    const getExpectedImageCountFromStructure = useCallback((folderPath: string): number => {
        if (!fullFolderStructure) return -1; // -1 означает "неизвестно"

        let count = 0;
        Object.entries(fullFolderStructure).forEach(([path]) => {
            // Считаем только файлы (не папки) в указанной папке
            if (!path.endsWith('/') && path.startsWith(folderPath)) {
                count++;
            }
        });

        console.log(`📈 Ожидаемое количество изображений в ${folderPath}: ${count}`);
        return count;
    }, [fullFolderStructure]);

    const areFolderImagesCached = useCallback((folderPath: string): boolean => {
        if (!selectedCompany) return false;

        const folderKey = `${selectedCompany}_${folderPath}`;
        const folderData = folderCache[folderKey];

        // Если папки нет в кеше
        if (!folderData || !folderData.data) {
            console.log(`❌ Папка ${folderPath} не найдена в кеше`);
            return false;
        }

        // Если timestamp = 0, это значит папка требует перезагрузки
        if (folderData.timestamp === 0) {
            console.log(`🔄 Папка ${folderPath} помечена для перезагрузки (timestamp = 0)`);
            return false;
        }

        // Если папка НИКОГДА не загружалась с сервера - требуется загрузка
        if (folderData.isLoadedFromServer === false) {
            console.log(`🔄 Папка ${folderPath} никогда не загружалась с сервера, требуется загрузка`);
            return false;
        }

        // Проверяем, что кеш папки не устарел (30 минут)
        const now = Date.now();
        const FOLDER_CACHE_DURATION = 30 * 60 * 1000;

        if (now - folderData.timestamp > FOLDER_CACHE_DURATION) {
            console.log(`⏰ Кеш папки ${folderPath} устарел`);
            return false;
        }

        console.log(`✅ Папка ${folderPath} полностью закеширована с сервера, изображений: ${folderData.data.length}`);
        return true;
    }, [selectedCompany, folderCache]);

    // Загрузка данных папки (только изображения)
    const loadFolderData = useCallback(async () => {
        if (!token || !selectedCompany || !currentPath) return;

        const folderKey = `${selectedCompany}_${currentPath}`;

        // Проверяем, закеширована ли папка и не требует перезагрузки
        const isCached = areFolderImagesCached(currentPath);

        if (isCached) {
            console.log(`✅ Папка ${currentPath} закеширована, пропускаем запрос к серверу`);
            setContentLoading(false);
            setLoading(false);
            setImagesLoadError(null);

            // Обновляем blob'ы в фоне если нужно, но не блокируем интерфейс
            const folderImages = getCurrentFolderImages(currentPath);
            if (folderImages.length > 0) {
                setTimeout(() => {
                    refreshExistingBlobs(folderImages);
                }, 1000);
            }
            return;
        }

        console.log(`🔄 Загружаем данные для папки ${currentPath} с сервера`);
        setContentLoading(true);
        setImagesLoadError(null);

        try {
            await loadFolderImages(selectedCompany, currentPath, false);
        } catch (error) {
            console.error('Ошибка загрузки данных папки:', error);
            setImagesLoadError('Не удалось загрузить изображения. Проверьте подключение к интернету.');
            addNotification('Ошибка загрузки изображений', 'error');
        } finally {
            setContentLoading(false);
            setLoading(false);
        }
    }, [token, selectedCompany, currentPath, areFolderImagesCached, getCurrentFolderImages, refreshExistingBlobs, loadFolderImages]);

    // Загружаем данные ТОЛЬКО при изменении пути
    useEffect(() => {
        loadFolderData();
    }, [currentPath, selectedCompany]);

    useEffect(() => {
        if (fullFolderStructure && currentPath) {
            console.log(`🔄 Обновление папок для пути: ${currentPath}`);

            // Выносим логику прямо в useEffect чтобы избежать рекурсии
            if (!fullFolderStructure || !currentPath) {
                setFolders([]);
                return;
            }

            const folderList: Folder[] = [];
            const processedPaths = new Set<string>();

            Object.entries(fullFolderStructure).forEach(([path, size]) => {
                if (!path.endsWith('/')) return;
                if (!path.startsWith(currentPath)) return;

                const relativePath = path.substring(currentPath.length);
                const parts = relativePath.split('/').filter(part => part !== '');

                if (parts.length === 1) {
                    const folderName = parts[0];
                    const fullFolderPath = currentPath + folderName + '/';

                    if (!processedPaths.has(fullFolderPath)) {
                        folderList.push({
                            id: fullFolderPath,
                            name: folderName,
                            path: fullFolderPath,
                            isDirectory: true
                        });
                        processedPaths.add(fullFolderPath);
                    }
                }
            });

            console.log(`📁 Найдено папок для ${currentPath}:`, folderList.length);
            setFolders(folderList.sort((a, b) => a.name.localeCompare(b.name)));
        }
    }, [currentPath, fullFolderStructure]);

    useEffect(() => {
        const loadFolderStructure = async () => {
            if (!token || !selectedCompany) return;

            const cachedStructure = getCachedFolderStructure(selectedCompany);

            if (cachedStructure && Object.keys(cachedStructure).length > 0) {
                console.log('📂 Используем кешированную структуру папок');
                setFullFolderStructure(cachedStructure);
                processDirectoryObjects(cachedStructure, currentPath, true);
                setFoldersLoadError(null);
            } else {
                console.log('🔄 Загружаем структуру папок с сервера');
                try {
                    const response = await callApi(() => getDirectoryObjects(token, selectedCompany));

                    if (response === null) {
                        // Запрос был отменен - это нормально
                        return;
                    }

                    if (response) {
                        setFullFolderStructure(response);
                        setCachedFolderStructure(selectedCompany, response);
                        processDirectoryObjects(response, currentPath, false);
                        setFoldersLoadError(null);
                    } else {
                        // Если response === null или undefined - это ошибка
                        setFoldersLoadError('Не удалось загрузить структуру папок');
                    }
                } catch (error) {
                    console.error('Ошибка загрузки структуры папок:', error);
                    setFoldersLoadError('Не удалось загрузить структуру папок. Проверьте подключение к интернету.');
                }
            }
        };

        loadFolderStructure();
    }, [token, selectedCompany, currentPath]);

    useEffect(() => {
        // Даем время на предзагрузку перед показом изображений
        const timer = setTimeout(() => {}, 500); // 500ms задержка для предзагрузки

        return () => clearTimeout(timer);
    }, [currentPath]); // Сбрасываем при смене папки

    // Навигация по папкам
    const navigateToFolder = (folderPath: string) => {
        console.log(`📂 Навигация в папку: ${folderPath}`);

        // Проверяем, есть ли данные в кеше и они полные
        const isCached = areFolderImagesCached(folderPath);

        setPathHistory(prev => [...prev, currentPath]);
        setCurrentPath(folderPath);
        setSelectedImages([]);
        setIsSelectionMode(false);

        if (isCached) {
            console.log(`✅ Используем кешированные данные для папки ${folderPath}`);
            setContentLoading(false);
            // Триггерим обновление отображения
            setCacheUpdateTrigger(prev => prev + 1);
        } else {
            console.log(`🔄 Загружаем данные для папки ${folderPath}`);
            setContentLoading(true);
            // Вызываем loadFolderData только для незакешированных или неполных папок
            loadFolderData();
        }

        if (fullFolderStructure) {
            processDirectoryObjects(fullFolderStructure, folderPath, false);
        }
    };


    // Хлебные крошки
    const handleBreadcrumbClick = (path: string) => {
        const pathIndex = pathHistory.indexOf(path);
        if (pathIndex !== -1) {
            setPathHistory(pathHistory.slice(0, pathIndex));
        }
        setCurrentPath(path);
        setSelectedImages([]);
        setIsSelectionMode(false);
        setContentLoading(true);

        // Сразу обновляем отображение папок для нового пути
        if (fullFolderStructure) {
            processDirectoryObjects(fullFolderStructure, path);
        }

        // Загружаем данные папки
        loadFolderData();
    };

    // Drag & Drop handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files) {
            setIsDragging(true);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            setSelectedFiles(prev => [...prev, ...files]);
            setShowUploadModal(true);
        }
    };

    const removeSelectedFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Функция для проверки, есть ли изображения папки в кеше

    const isFolderNameDuplicate = (newName: string, excludePath?: string): boolean => {
        if (!newName.trim()) return false;

        const normalizedNewName = newName.toLowerCase().trim();

        return folders.some(folder =>
            folder.name.toLowerCase() === normalizedNewName &&
            folder.path !== excludePath // Исключаем текущую папку при переименовании
        );
    };

// Проверка существования изображения с таким именем
    const isImageNameDuplicate = (newName: string, excludeImageId?: string): boolean => {
        return images.some(image =>
            (image.file_name.toLowerCase() === newName.toLowerCase().trim() ||
                image.title?.toLowerCase() === newName.toLowerCase().trim()) &&
            image.image_id !== excludeImageId
        );
    };

    // Загрузка изображений
    const handleUpload = async () => {
        if (!token || !selectedCompany || selectedFiles.length === 0) return;

        setUploading(true);
        setUploadingFiles(selectedFiles);
        const uploadResults = [];
        const newImages: Image[] = [];

        // 1. Сначала получаем текущие изображения из кеша
        const currentImages = getCurrentFolderImages(currentPath);

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            try {
                setUploadProgress(prev => ({ ...prev, [file.name]: 10 }));

                // Проверяем дубликаты
                const existingImage = currentImages.find(img =>
                    img.file_path === currentPath && img.file_name === file.name
                );

                if (existingImage) {
                    addNotification(`Файл "${file.name}" уже существует, пропускаем`, 'info');
                    setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
                    continue;
                }

                const dimensions = await getImageDimensions(file);
                const metadata = {
                    company_id: selectedCompany,
                    file_path: currentPath,
                    width: dimensions.width.toString(),
                    height: dimensions.height.toString()
                };

                setUploadProgress(prev => ({ ...prev, [file.name]: 50 }));
                const result = await withErrorHandling(
                    () => uploadImage(token, file, metadata),
                    addNotification,
                    undefined // Не показываем успех для каждого файла отдельно
                );
                setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

                if (result) {
                    // НЕ создаем временный blob URL - это вызывает проблемы
                    const newImage: Image = {
                        ...result,
                        // НЕ добавляем url здесь - он будет получен позже
                        file_name: file.name,
                        title: file.name.replace(/\.[^/.]+$/, ""),
                        size: file.size,
                        width: dimensions.width,
                        height: dimensions.height
                    };
                    newImages.push(newImage);

                    // Получаем реальный URL с сервера сразу после загрузки
                    try {
                        const imageWithUrl = await callApi(() => getImageById(token, result.image_id));
                        if (imageWithUrl && imageWithUrl.url) {
                            newImage.url = imageWithUrl.url;
                            console.log(`✅ Получен URL для ${result.image_id}: ${imageWithUrl.url}`);
                            uploadResults.push({ file: file.name, success: true });
                        }
                    } catch (error) {
                        console.error('Ошибка получения URL с сервера:', error);
                    }
                }

            } catch (error: any) {
                console.error(`Ошибка загрузки изображения ${file.name}:`, error);
                setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

                handleImageError(error, addNotification);
                uploadResults.push({ file: file.name, success: false, error: error.message });
            }
        }
        console.log('New', uploadResults)
        const successfulUploads = uploadResults.filter(r => r.success).length;

        if (successfulUploads > 0) {
            addNotification(`Успешно загружено ${successfulUploads} из ${selectedFiles.length} файлов`, 'success');
            loadStorageLimits();
            // 2. ОБНОВЛЯЕМ КЕШ: добавляем только новые изображения к существующим
            // Фильтруем изображения у которых есть URL
            const imagesWithUrls = newImages.filter(img => img.url);
            if (imagesWithUrls.length > 0) {
                addImagesToCache(selectedCompany, currentPath, imagesWithUrls);
                console.log(`✅ Добавлено ${imagesWithUrls.length} новых изображений в кеш папки ${currentPath}`);
            }
        }

        setUploading(false);
        setShowUploadModal(false);

        setTimeout(() => {
            setUploadingFiles([]);
            setUploadProgress({});
            setSelectedFiles([]);
        }, 100);
    };

    // Удаление изображения
    const handleDeleteImage = async (imageId: string) => {
        if (!token || !selectedCompany) return;

        // Удаляем из кеша
        removeImageFromCache(selectedCompany, currentPath, imageId);
        setSelectedImages(prev => prev.filter(id => id !== imageId));

        // В фоне удаляем на сервере
        setTimeout(async () => {
            try {
                const result = await withErrorHandling(
                    () => deleteImage(token, imageId),
                    addNotification,
                    'Изображение удалено'
                );

                if (result) {
                    removeImageFromCache(selectedCompany, currentPath, imageId);
                    loadStorageLimits();
                    setSelectedImages(prev => prev.filter(id => id !== imageId));
                }
            } catch (error: any) {
                console.error('Ошибка удаления изображения:', error);
                handleImageError(error, addNotification);
                // В случае ошибки перезагружаем данные
                loadFolderData(); // УБРАТЬ true
            }
        }, 100);
    };


    // Удаление выбранных изображений
    const handleDeleteSelected = async () => {
        if (!token || selectedImages.length === 0 || !selectedCompany) return; // Добавлена проверка

        if (!window.confirm(`Удалить ${selectedImages.length} изображений?`)) {
            return;
        }

        let successCount = 0;
        try {
            // Удаляем на сервере
            for (const imageId of selectedImages) {
                const result = await withErrorHandling(
                    () => deleteImage(token, imageId),
                    addNotification,
                    undefined // Не показываем успех для каждого файла
                );

                if (result) {
                    removeImageFromCache(selectedCompany, currentPath, imageId);
                    successCount++;
                }
            }
            if (successCount > 0) {
                addNotification(`Удалено ${successCount} изображений`, 'success');
                setSelectedImages([]);
                setIsSelectionMode(false);
            }

        } catch (error: any) {
            console.error('Ошибка удаления изображений:', error);
            handleImageError(error, addNotification);
            // Перезагружаем данные при ошибке
            loadFolderData();
        }
    };


    // Скачивание изображения
    const downloadImage = async (imageId: string, image: Image): Promise<boolean> => {
        try {
            const imageUrl = image.url;
            if (!imageUrl || !selectedCompany) {
                console.error('URL изображения не найден или компания не выбрана');
                return false;
            }

            const filename = image.file_name || `image_${image.image_id}.${getFileExtension(image)}`;

            // Правильный endpoint согласно документации
            const downloadEndpoint = `${config.apiBaseUrl}/image/download?image_url=${encodeURIComponent(imageUrl)}&company_id=${selectedCompany}&filename=${encodeURIComponent(filename)}`;

            console.log('📥 Скачивание изображения:', downloadEndpoint);

            // Создаем временную ссылку для скачивания
            const response = await fetch(downloadEndpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            // Создаем ссылку для скачивания
            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = filename;
            downloadLink.style.display = 'none';

            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // Освобождаем blob URL
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

            console.log('✅ Изображение успешно скачано');
            return true;

        } catch (error) {
            console.error('❌ Ошибка скачивания изображения:', error);

            // Fallback: пробуем открыть в новой вкладке
            if (image.url) {
                window.open(image.url, '_blank');
                addNotification('Изображение открыто в новой вкладке', 'info');
            } else {
                addNotification('Ошибка скачивания изображения', 'error');
            }
            return false;
        }
    };

    const handleDownloadImage = async (imageId: string) => {
        const image = images.find(img => img.image_id === imageId);
        if (!image || !token) return;

        try {
            const success = await downloadImage(imageId, image);
            if (success) {
                addNotification('Изображение скачано', 'success');
            } else {
                addNotification('Изображение открыто в новой вкладке', 'info');
            }
        } catch (error) {
            console.error('Ошибка скачивания изображения:', error);
            addNotification('Ошибка скачивания изображения', 'error');
        }
    };

    const handleDownloadSelected = async () => {
        if (selectedImages.length === 0 || !token) return;

        try {
            for (const imageId of selectedImages) {
                const image = images.find(img => img.image_id === imageId);
                if (image) {
                    await downloadImage(imageId, image);
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            addNotification(`Скачано ${selectedImages.length} изображений`, 'success');
        } catch (error) {
            console.error('Ошибка скачивания изображений:', error);
            addNotification('Ошибка скачивания изображений', 'error');
        }
    };

    // Перенос изображений
    const handleMoveImages = async () => {
        if (!token || selectedImages.length === 0 || !selectedTargetFolder || !selectedCompany) return;

        setMoving(true);
        try {
            // 1. Сначала обновляем кеш
            for (const imageId of selectedImages) {
                const imageToMove = getImageFromAnyFolder(imageId);

                if (imageToMove) {
                    // Сохраняем blob из кеша перед перемещением
                    const cachedImageBeforeMove = getCachedImage(imageId);

                    // Обновляем кеш папок
                    moveImageBetweenFolders(imageId, currentPath, selectedTargetFolder, selectedCompany);

                    // Обновляем изображение в основном кеше с новым путем
                    const updatedImage = {
                        ...imageToMove,
                        file_path: selectedTargetFolder,
                        // Сохраняем blob URL если он был
                        url: cachedImageBeforeMove?.isBlob ? cachedImageBeforeMove.url : imageToMove.url
                    };

                    updateImageInCache(selectedCompany, selectedTargetFolder, imageId, updatedImage);
                    console.log(`✅ Изображение ${imageId} перемещено в кеше в ${selectedTargetFolder}`);
                }
            }

            // 2. В фоне обновляем на сервере
            let successCount = 0;
            for (const imageId of selectedImages) {
                const result = await withErrorHandling(
                    () => updateImage(token, imageId, { file_path: selectedTargetFolder }),
                    addNotification,
                    undefined
                );

                if (result) {
                    successCount++;
                }
            }

            // 3. ПОМЕЧАЕМ ЦЕЛЕВУЮ ПАПКУ КАК НЕПОЛНУЮ
            // После перемещения кеш целевой папки становится неполным
            if (successCount > 0) {
                const targetFolderKey = `${selectedCompany}_${selectedTargetFolder}`;
                const targetFolderData = folderCache[targetFolderKey];

                if (targetFolderData) {
                    // Получаем ожидаемое количество изображений
                    const expectedCount = getExpectedImageCountFromStructure(selectedTargetFolder);
                    const currentCount = targetFolderData.data?.length || 0;

                    if (expectedCount > 0 && currentCount < expectedCount) {
                        console.log(`⚠️ Целевая папка ${selectedTargetFolder} неполная после перемещения: ${currentCount}/${expectedCount}`);
                        // Можно пометить для перезагрузки при следующем посещении
                        invalidateFolderCache(selectedCompany, selectedTargetFolder, true);
                    }
                }

                addNotification(`Перенесено ${successCount} изображений`, 'success');
                setShowMoveModal(false);
                setSelectedTargetFolder('');
                setSelectedImages([]);
                setIsSelectionMode(false);
            }

        } catch (error: any) {
            console.error('Ошибка переноса изображений:', error);
            handleImageError(error, addNotification);
            // В случае ошибки перезагружаем полные данные
            await loadFullFolderStructure(true);
            await loadFolderData();
        } finally {
            setMoving(false);
        }
    };

    const updateFolderStructureCache = async () => {
        if (!token || !selectedCompany) return;

        try {
            const response = await callApi(() => getDirectoryObjects(token, selectedCompany));
            if (response) {
                // Обновляем кеш, но НЕ трогаем текущее состояние folders
                setFullFolderStructure(response);
                setCachedFolderStructure(selectedCompany, response);

                // Логируем для отладки
                console.log('✅ Структура папок обновлена в кеше');
            }
        } catch (error) {
            console.error('Ошибка обновления кеша структуры папок:', error);
        }
    };

    // Создание папки
    const handleCreateFolder = async () => {
        if (!token || !selectedCompany || !newFolderName.trim()) return;

        const trimmedName = newFolderName.trim();

        // Проверяем на клиенте ДО отправки
        if (isFolderNameDuplicate(trimmedName)) {
            addNotification('Папка с таким названием уже существует', 'error');
            return;
        }

        // Сохраняем текущее состояние папок для отката
        const previousFolders = [...folders];

        // Сразу добавляем новую папку в UI (оптимистичное обновление)
        const newFolderPath = currentPath + trimmedName + '/';
        const newFolder: Folder = {
            id: newFolderPath,
            name: trimmedName,
            path: newFolderPath,
            isDirectory: true
        };

        setFolders(prev => [...prev, newFolder].sort((a, b) => a.name.localeCompare(b.name)));
        setShowCreateFolderModal(false);
        setNewFolderName('');

        try {
            const response = await callApi(() => createDirectory(token, {
                company_id: selectedCompany,
                dir_name: trimmedName.endsWith('/') ? trimmedName : trimmedName + '/',
                dir_path: currentPath
            }));

            if (response) {
                addNotification('Папка создана', 'success');

                // ОБНОВЛЯЕМ СТРУКТУРУ ПАПОК ПОСЛЕ УСПЕШНОГО СОЗДАНИЯ
                await updateFolderStructureCache();

                // Принудительно обновляем полную структуру
                await loadFullFolderStructure(true);
            } else {
                // Если response === null (ошибка в callApi), откатываем UI
                throw new Error('Ошибка создания папки');
            }

        } catch (error: any) {
            console.error('Ошибка создания папки:', error);

            // ОТКАТЫВАЕМ UI ИЗМЕНЕНИЯ ПРИ ОШИБКЕ
            setFolders(previousFolders);

            // Показываем соответствующее сообщение об ошибке
            if (error.response?.status === 422 || error.response?.status === 400) {
                addNotification('Папка с таким названием уже существует или некорректное имя', 'error');
            } else if (error.response?.status === 409) {
                addNotification('Папка с таким названием уже существует', 'error');
            } else {
                addNotification('Ошибка создания папки', 'error');
            }

            // Открываем модальное окно снова чтобы пользователь мог попробовать другое имя
            setShowCreateFolderModal(true);
            setNewFolderName(trimmedName);
        }
    };

// Добавьте функцию для инвалидации кеша структуры папок
    const invalidateFolderStructureCache = useCallback(() => {
        if (selectedCompany) {
            setCachedFolderStructure(selectedCompany, {}); // Очищаем кеш
        }
    }, [selectedCompany, setCachedFolderStructure]);

    // Переименование папки
    const handleRenameFolder = async (folderPath: string, oldName: string, newName: string) => {
        if (!token || !selectedCompany) return;

        if (oldName === newName) {
            setEditingItem(null);
            setEditName('');
            return;
        }

        // Проверка на дубликат
        if (isFolderNameDuplicate(newName, folderPath)) {
            addNotification('Папка с таким названием уже существует', 'error');
            return;
        }

        // БЛОКИРУЕМ ПАПКУ
        setRenamingFolders(prev => new Set(prev).add(folderPath));

        // Сохраняем старые данные для отката
        const oldFolderData = folders.find(f => f.path === folderPath);
        const oldFolderKey = `${selectedCompany}_${folderPath}`;
        const oldCacheData = folderCache[oldFolderKey];

        console.log(`🔄 Начало переименования папки: ${oldName} -> ${newName}, текущий isLoadedFromServer: ${oldCacheData?.isLoadedFromServer}`);

        try {
            // 1. СРАЗУ обновляем UI
            setFolders(prev => prev.map(folder =>
                folder.path === folderPath
                    ? {
                        ...folder,
                        name: newName,
                        path: currentPath + newName + '/'
                    }
                    : folder
            ));

            setEditingItem(null);
            setEditName('');

            // 2. ОБНОВЛЯЕМ КЕШ: сохраняем данные из старой папки в новую С СОХРАНЕНИЕМ isLoadedFromServer
            const newFolderPath = currentPath + newName + '/';

            if (oldCacheData && oldCacheData.data) {
                // КРИТИЧЕСКИ ВАЖНО: сохраняем оригинальный флаг isLoadedFromServer
                // Если папка была загружена с сервера - она остается загруженной и после переименования
                const shouldKeepLoadedFlag = oldCacheData.isLoadedFromServer === true;

                // Используем updateFolderCacheDirectly с сохранением флага
                updateFolderCacheDirectly(selectedCompany, newFolderPath, oldCacheData.data, shouldKeepLoadedFlag);

                // Удаляем старую запись из кеша через инвалидацию
                invalidateFolderCache(selectedCompany, folderPath, false);

                console.log(`🔄 Папка переименована: ${oldName} -> ${newName}, isLoadedFromServer сохранен: ${shouldKeepLoadedFlag}`);
            }

            // 3. Отправляем запрос на сервер
            const response = await callApi(() => renameDirectory(token, {
                company_id: selectedCompany,
                old_dir_name: oldName + '/',
                new_dir_name: newName + '/',
                dir_path: currentPath
            }));

            if (response) {
                addNotification('Папка переименована', 'success');
                // Обновляем полную структуру в фоне
                invalidateFolderStructureCache();
                await loadFullFolderStructure(true);
            } else {
                // Откатываем UI изменения при ошибке
                if (oldFolderData) {
                    setFolders(prev => prev.map(folder =>
                        folder.path === currentPath + newName + '/'
                            ? oldFolderData
                            : folder
                    ));
                }
                // Откатываем кеш при ошибке - инвалидируем новую папку и восстанавливаем старую
                if (oldCacheData && oldCacheData.data) {
                    invalidateFolderCache(selectedCompany, newFolderPath, false);
                    updateFolderCacheDirectly(selectedCompany, folderPath, oldCacheData.data, oldCacheData.isLoadedFromServer);
                }
                addNotification('Ошибка переименования папки', 'error');
            }
        } catch (error: any) {
            console.error('Ошибка переименования папки:', error);
            // Откатываем UI изменения при ошибке
            if (oldFolderData) {
                setFolders(prev => prev.map(folder =>
                    folder.path === currentPath + newName + '/'
                        ? oldFolderData
                        : folder
                ));
            }
            // Откатываем кеш при ошибке
            if (oldCacheData && oldCacheData.data) {
                invalidateFolderCache(selectedCompany, currentPath + newName + '/', false);
                updateFolderCacheDirectly(selectedCompany, folderPath, oldCacheData.data, oldCacheData.isLoadedFromServer);
            }

            if (error.response?.status === 422) {
                addNotification('Некорректное название папки', 'error');
            } else {
                addNotification('Ошибка переименования папки', 'error');
            }
        } finally {
            // РАЗБЛОКИРУЕМ ПАПКУ
            setRenamingFolders(prev => {
                const newSet = new Set(prev);
                newSet.delete(folderPath);
                return newSet;
            });
        }
    };

    // Переименование изображения
    const handleRenameImage = async (imageId: string, oldName: string, newName: string) => {
        if (!token || !selectedCompany) return;

        if (oldName === newName) return;

        const image = images.find(img => img.image_id === imageId);
        if (!image) return;

        // Проверка на дубликат
        if (isImageNameDuplicate(newName, imageId)) {
            addNotification('Изображение с таким названием уже существует', 'error');
            return;
        }

        try {
            // Сохраняем текущий blob URL если есть
            const currentCached = getCachedImage(imageId);
            const currentBlobUrl = currentCached?.isBlob ? currentCached.url : null;

            const updatedImage = {
                ...image,
                title: newName,
                // Сохраняем URL если он есть, иначе оставляем оригинальный
                url: currentBlobUrl || image.url
            };

            // СРАЗУ обновляем кеш - UI обновится автоматически через useMemo
            updateImageInCache(selectedCompany, currentPath, imageId, updatedImage);

            // Отправляем запрос на сервер в фоне
            const response = await withErrorHandling(
                () => updateImage(token, imageId, { title: newName }),
                addNotification,
                'Изображение переименовано'
            );

            if (!response) {
                // Откатываем при ошибке
                updateImageInCache(selectedCompany, currentPath, imageId, image);
                addNotification('Ошибка переименования изображения', 'error');
            } else {
                // Если был blob, убедимся что он остается в кеше
                if (currentBlobUrl) {
                    // Обновляем timestamp blob'а чтобы он не считался устаревшим
                    setTimeout(() => {
                        const refreshedCached = getCachedImage(imageId);
                        if (refreshedCached && refreshedCached.isBlob) {
                            console.log(`🔄 Обновляем timestamp blob'а для переименованного изображения ${imageId}`);
                            // Можно вызвать refreshExistingBlobs для этого изображения
                            refreshExistingBlobs([updatedImage]);
                        }
                    }, 100);
                }
            }
        } catch (error: any) {
            // Откатываем при ошибке
            const originalImage = images.find(img => img.image_id === imageId);
            if (originalImage) {
                updateImageInCache(selectedCompany, currentPath, imageId, originalImage);
            }
            console.error('Ошибка переименования изображения:', error);
            handleImageError(error, addNotification);
        }
    };

    // Удаление папки
    const handleDeleteFolder = async (folderPath: string, folderName: string) => {
        if (!token || !selectedCompany) return;

        if (!window.confirm(`Удалить папку "${folderName}"? Все изображения внутри также будут удалены.`)) {
            return;
        }

        try {
            // Мгновенно удаляем папку из UI
            setFolders(prev => prev.filter(folder => folder.path !== folderPath));

            addNotification(`Папка "${folderName}" удалена`, 'success');

            // ОБНОВЛЯЕМ СТРУКТУРУ ПАПОК
            invalidateFolderStructureCache();

            // В фоне удаляем на сервере и обновляем структуру
            setTimeout(async () => {
                try {
                    const response = await callApi(() => deleteDirectory(token, {
                        company_id: selectedCompany,
                        dir_name: folderName + '/',
                        dir_path: currentPath
                    }));

                    if (response) {
                        // Обновляем структуру папок
                        await loadFullFolderStructure(true);
                        addNotification(`Удалено изображений: ${response["deleted image id"].length}`, 'info');
                    }
                } catch (error) {
                    console.error('Ошибка удаления папки:', error);
                    addNotification('Ошибка удаления папки', 'error');
                    // В случае ошибки перезагружаем данные
                    await loadFullFolderStructure(true);
                }
            }, 100);

        } catch (error) {
            console.error('Ошибка удаления папки:', error);
            addNotification('Ошибка удаления папки', 'error');
        }
    };

    // Long press handlers для выбора
    const handleImageLongPressStart = (imageId: string) => {
        const timer = setTimeout(() => {
            setIsSelectionMode(true);
            setSelectedImages([imageId]);
        }, 500);
        setLongPressTimer(timer);
    };

    const handleImageLongPressEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    // Вспомогательные функции
    const getImageDimensions = (file: File): Promise<{width: number, height: number}> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
                URL.revokeObjectURL(img.src);
            };
            img.onerror = () => {
                reject(new Error('Не удалось загрузить изображение'));
                URL.revokeObjectURL(img.src);
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const getFileExtension = (image: Image): string => {
        if (image.file_name && image.file_name.includes('.')) {
            return image.file_name.split('.').pop() || 'png';
        }

        if (image.image_type) {
            return image.image_type.split('/').pop() || 'png';
        }

        return 'png';
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const buildFolderTree = (objects: { [key: string]: number }): FolderNode => {
        const root: FolderNode = {
            path: `company_images/company_${selectedCompany}/`,
            name: 'Корневая папка',
            children: []
        };

        const folders = Object.entries(objects)
            .filter(([path, size]) => size === 0 && path.endsWith('/'))
            .map(([path]) => path);

        const nodeMap = new Map<string, FolderNode>();
        nodeMap.set(root.path, root);

        const sortedPaths = folders.sort();

        for (const path of sortedPaths) {
            if (path === root.path) continue;

            const parts = path.replace(root.path, '').split('/').filter(part => part !== '');

            let currentPath = root.path;
            let parentNode = root;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                currentPath += part + '/';

                if (!nodeMap.has(currentPath)) {
                    const newNode: FolderNode = {
                        path: currentPath,
                        name: part,
                        children: []
                    };
                    nodeMap.set(currentPath, newNode);
                    parentNode.children.push(newNode);
                }

                parentNode = nodeMap.get(currentPath)!;
            }
        }

        return root;
    };

    const handleOpenMoveModal = () => {
        setShowMoveModal(true);
        // НЕ загружаем структуру заново, используем кешированную
        if (fullFolderStructure && folderStructure) {
            return; // Уже есть данные
        }

        // Если данных нет, строим из кешированной структуры
        if (fullFolderStructure && selectedCompany) {
            const folderTree = buildFolderTree(fullFolderStructure);
            setFolderStructure(folderTree);
        }
    };

    const getFolderName = (path: string): string => {
        if (path === `company_images/company_${selectedCompany}/`) {
            return 'Корневая папка';
        }

        const basePath = `company_images/company_${selectedCompany}/`;
        const relativePath = path.replace(basePath, '');
        const parts = relativePath.split('/').filter(part => part !== '');
        return parts[parts.length - 1] || 'Неизвестная папка';
    };

    const handleSelectFolder = (path: string) => {
        setSelectedTargetFolder(path);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setSelectedFiles(files);

            const existingNames = images.map(img => img.file_name);
            const duplicateNames = files.filter(file => existingNames.includes(file.name));

            if (duplicateNames.length > 0) {
                addNotification(
                    `Некоторые файлы уже существуют: ${duplicateNames.map(f => f.name).join(', ')}`,
                    'error'
                );
            }
        }
    };

    const startEditing = (type: 'folder' | 'image', id: string, name: string) => {
        setEditingItem({ type, id, name });
        setEditName(name);
    };

    const cancelEditing = () => {
        setEditingItem(null);
        setEditName('');
    };

    const saveEditing = () => {
        if (!editingItem) return;

        if (editingItem.type === 'folder') {
            handleRenameFolder(editingItem.id, editingItem.name, editName);
        } else {
            handleRenameImage(editingItem.id, editingItem.name, editName);
        }
        setEditingItem(null);
        setEditName('');
    };

    const handleImageClick = (imageId: string) => {
        if (isSelectionMode) {
            if (selectedImages.includes(imageId)) {
                setSelectedImages(selectedImages.filter(id => id !== imageId));
            } else {
                setSelectedImages([...selectedImages, imageId]);
            }
        } else {
            const image = images.find(img => img.image_id === imageId);
            if (image) {
                // Используем кешированное изображение
                const cached = getCachedImage(imageId);
                const url = cached?.url || image.url;

                if (url) {
                    setViewImage({
                        url: url,
                        title: image.title || image.file_name,
                        isLoaded: false
                    });
                }
            }
        }
    };

    const isFolderNameExists = folders.some(folder =>
        folder.name.toLowerCase() === newFolderName.toLowerCase().trim()
    );

    if (loading) {
        return <BeautifulLoader text="Загрузка изображений..."/>;
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <style>{loaderStyles}</style>
            <style>{imageOptimizationStyles}</style>
            <motion.h1
                initial={{opacity: 0, y: -10}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.4}}
                className="text-3xl font-bold text-coffee-dark mb-6"
            >
                Галерея изображений
            </motion.h1>

            <motion.div
                initial={{opacity: 0, y: 10, scale: 0.98}}
                animate={{opacity: 1, y: 0, scale: 1}}
                transition={{duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94]}}
                className="bg-white rounded-xl shadow-lg p-6 min-h-[600px]"
            >
                {/* Панель инструментов */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center">
                        {/* Хлебные крошки */}
                        <div className="flex items-center">
                            <button
                                onClick={() => handleBreadcrumbClick(basePath)}
                                className="text-amber-700 hover:text-amber-800"
                            >
                                Диск
                            </button>
                            {currentPath !== basePath && (
                                <div className="flex items-center">
                                    {currentPath
                                        .replace(basePath, '')
                                        .split('/')
                                        .filter(part => part)
                                        .map((part, index, parts) => {
                                            const path = basePath + parts.slice(0, index + 1).join('/') + '/';
                                            const isLast = index === parts.length - 1;

                                            return (
                                                <span key={path}>
                                                    <span className="mx-2">/</span>
                                                    {isLast ? (
                                                        <span className="text-coffee-dark">{part}</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleBreadcrumbClick(path)}
                                                            className="text-amber-700 hover:text-amber-800"
                                                        >
                                                            {part}
                                                        </button>
                                                    )}
                                                </span>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Кнопки действий */}
                    <div className="flex items-center space-x-2">
                        {/* Плюсик - добавление изображения */}
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="p-2 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
                            title="Добавить изображение"
                        >
                            <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor"
                                 viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                            </svg>
                        </button>

                        {/* Папка с плюсиком */}
                        <button
                            onClick={() => setShowCreateFolderModal(true)}
                            className="p-2 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                            title="Создать папку"
                        >
                            <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor"
                                 viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                            </svg>
                        </button>

                        {/* Стрелочка сохранения */}
                        <button
                            onClick={handleDownloadSelected}
                            disabled={selectedImages.length === 0}
                            className={`p-2 rounded-lg transition-colors ${selectedImages.length === 0 ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                            title="Скачать выбранные"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                            </svg>
                        </button>

                        {/* Корзина */}
                        <button
                            onClick={handleDeleteSelected}
                            disabled={selectedImages.length === 0}
                            className={`p-2 rounded-lg transition-colors ${selectedImages.length === 0 ? 'bg-gray-100 text-gray-400' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                            title="Удалить выбранные"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>

                        {/* Перемещение */}
                        <button
                            onClick={handleOpenMoveModal}
                            disabled={selectedImages.length === 0}
                            className={`p-2 rounded-lg transition-colors ${selectedImages.length === 0 ? 'bg-gray-100 text-gray-400' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                            title="Переместить выбранные"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                            </svg>
                        </button>

                        {/* Выделение */}
                        <button
                            onClick={() => {
                                setIsSelectionMode(!isSelectionMode);
                                setSelectedImages([]);
                            }}
                            className={`p-2 rounded-lg transition-colors ${isSelectionMode ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            title={isSelectionMode ? 'Отменить выделение' : 'Выделить несколько'}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Индикатор выбора */}
                {isSelectionMode && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg flex justify-between items-center">
                        <span>Выбрано: {selectedImages.length}</span>
                        <button
                            onClick={() => {
                                setIsSelectionMode(false);
                                setSelectedImages([]);
                            }}
                            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                            Отменить выбор
                        </button>
                    </div>
                )}

                {/* Контент - папки и изображения */}
                <div className="opacity-100 transition-opacity duration-300">
                    {/* Папки */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-coffee-dark mb-4">Папки</h2>
                        {folders.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">Нет папок</p>
                        ) : (
                            <div className="scroll-container">
                                <div className="flex space-x-4 pb-4">
                                    {folders.map((folder) => {
                                        const isRenaming = renamingFolders.has(folder.id);

                                        return (
                                            <motion.div
                                                key={folder.id}
                                                initial={{opacity: 0, scale: 0.9}}
                                                animate={{opacity: 1, scale: 1}}
                                                className={`relative group ${isRenaming ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                            >
                                                <div
                                                    className="relative"
                                                    onClick={() => !editingItem && !isRenaming && navigateToFolder(folder.path)}
                                                >
                                                    <svg
                                                        className={`w-16 h-16 mx-auto ${isRenaming ? 'text-gray-400' : 'text-[#f6b263]'}`}
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                                                    </svg>

                                                    {/* Индикатор переименования */}
                                                    {isRenaming && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                                        </div>
                                                    )}

                                                    {/* Кнопка удаления папки (скрываем при переименовании) */}
                                                    {!isRenaming && (
                                                        <button
                                                            type="button"
                                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 rounded-full p-1 cursor-pointer z-10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteFolder(folder.path, folder.name);
                                                            }}
                                                        >
                                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="h-4 flex items-center justify-center w-full px-1 min-h-[12px]">
                                                    {editingItem?.type === 'folder' && editingItem.id === folder.id ? (
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="px-1 py-1 text-xs border border-gray-300 rounded text-center h-6"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveEditing();
                                                                if (e.key === 'Escape') cancelEditing();
                                                            }}
                                                            onBlur={saveEditing}
                                                            autoFocus
                                                            maxLength={50}
                                                            style={{
                                                                lineHeight: '1rem',
                                                                width: folder.name.length > 20 ? '7rem' : `3rem`, // Динамическая ширина
                                                                minWidth: folder.name.length > 20 ? '7rem' : '3rem',
                                                                maxWidth: '7rem'
                                                            }}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="text-xs font-medium w-full text-coffee-dark cursor-text h-6 flex items-center justify-center"
                                                            onClick={(e) => {
                                                                if (isRenaming) return;
                                                                e.stopPropagation();
                                                                startEditing('folder', folder.id, folder.name);
                                                            }}
                                                            title={folder.name}
                                                        >
                                                            <span
                                                                className="block truncate max-w-[7rem]"> {/* Примерно 20 символов */}
                                                                {folder.name.length > 20 ? `${folder.name.substring(0, 20)}...` : folder.name}
      </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {foldersLoadError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    <span className="text-red-700">{foldersLoadError}</span>
                                </div>
                                <button
                                    onClick={() => {
                                        setFoldersLoadError(null);
                                        loadFullFolderStructure(true);
                                    }}
                                    className="text-red-700 hover:text-red-900 underline text-sm"
                                >
                                    Повторить
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Индикатор ошибки загрузки изображений */}
                    {imagesLoadError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    <span className="text-red-700">{imagesLoadError}</span>
                                </div>
                                <button
                                    onClick={() => {
                                        setImagesLoadError(null);
                                        loadFolderData();
                                    }}
                                    className="text-red-700 hover:text-red-900 underline text-sm"
                                >
                                    Повторить
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Изображения */}
                    <div>
                        <h2 className="text-xl font-semibold text-coffee-dark mb-4">Изображения</h2>
                        {contentLoading ? (
                            <div className="flex justify-center py-8">
                                <LoadingSpinner size="small" text="Загрузка изображений..."/>
                            </div>
                        ) : images.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">Нет изображений</p>
                        ) : (
                            <div
                                className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3"
                                style={{
                                    maxHeight: 'calc(3 * (8rem + 1rem))', // 3 ряда * (высота изображения + gap)
                                    overflowY: 'auto'
                                }}
                            >
                                {images.map(image => (
                                    <motion.div
                                        key={image.image_id}
                                        initial={{opacity: 0, scale: 0.9}}
                                        animate={{opacity: 1, scale: 1}}
                                        className="relative group"
                                        onMouseDown={() => handleImageLongPressStart(image.image_id)}
                                        onMouseUp={handleImageLongPressEnd}
                                        onMouseLeave={handleImageLongPressEnd}
                                        onTouchStart={() => handleImageLongPressStart(image.image_id)}
                                        onTouchEnd={handleImageLongPressEnd}
                                    >
                                        <div
                                            className={`bg-gray-100 rounded overflow-hidden cursor-pointer aspect-square w-32 h-32 relative`}
                                            onClick={() => handleImageClick(image.image_id)}
                                        >
                                            {image.url ? (
                                                <FastImage
                                                    key={image.image_id}
                                                    imageData={image}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full">
                                                    <LoadingSpinner size="small" text=""/>
                                                </div>
                                            )}
                                            <div
                                                className={`bg-gray-100 rounded overflow-hidden cursor-pointer aspect-square w-32 h-32`}>

                                                {/* Кнопка скачивания */}
                                                {!isSelectionMode && (
                                                    <button
                                                        type="button"
                                                        className="absolute top-0 left-0 opacity-0 group-hover:opacity-100 transition-opacity bg-green-500 rounded-full p-1 cursor-pointer z-10 m-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownloadImage(image.image_id);
                                                        }}
                                                    >
                                                        <svg className="w-3 h-3 text-white" fill="none"
                                                             stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                                  strokeWidth={2}
                                                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                                        </svg>
                                                    </button>
                                                )}

                                                {/* Кнопка удаления */}
                                                {!isSelectionMode && (
                                                    <button
                                                        type="button"
                                                        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 rounded-full p-1 cursor-pointer z-10 m-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteImage(image.image_id);
                                                        }}
                                                    >
                                                        <svg className="w-3 h-3 text-white" fill="none"
                                                             stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                                  strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Чекбокс выделения */}
                                            {isSelectionMode && (
                                                <div className="absolute top-1 left-1 z-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedImages.includes(image.image_id)}
                                                        onChange={() => {
                                                        }}
                                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-2 text-center max-w-32">
                                            {editingItem?.type === 'image' && editingItem.id === image.image_id ? (
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => {
                                                        const newName = e.target.value;
                                                        const currentExtension = image.file_name.split('.').pop();
                                                        const newExtension = newName.split('.').pop();

                                                        if (currentExtension !== newExtension) {
                                                            addNotification('Нельзя изменять расширение файла', 'error');
                                                            return;
                                                        }

                                                        setEditName(newName);
                                                    }}
                                                    className="w-full px-1 py-0 text-xs border border-gray-300 rounded text-center"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') saveEditing();
                                                        if (e.key === 'Escape') cancelEditing();
                                                    }}
                                                    onBlur={saveEditing}
                                                    autoFocus
                                                />
                                            ) : (
                                                <div
                                                    className="text-xs font-medium text-coffee-dark truncate cursor-text"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        startEditing('image', image.image_id, image.title || image.file_name);
                                                    }}
                                                >
                                                    {image.title || image.file_name}
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-600">
                                                {formatFileSize(image.size)}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                {/* Блок информации о лимитах - улучшенный современный вариант */}
                {storageInfo && (
                    <motion.div
                        initial={{opacity: 0, y: 10}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.5}}
                        className="mt-5 pt-3 border-t border-gray-200"
                    >
                        {/* Заголовок с пояснением */}
                        {/*<div className="mb-2 p-2 bg-gray-50 rounded-lg">*/}
                        <div className="text-xs text-gray-600 text-center">
                            <span className="font-medium">Лимиты компании:</span>
                            <span> до {storageInfo.quota_count_images} изображений • {formatSize(storageInfo.quota_storage_size)} всего</span>
                        </div>
                        {/*</div>*/}

                        <div className="flex items-center justify-between space-x-4">
                            {/* Левая часть - количество изображений */}
                            <div className="flex items-center space-x-3 flex-1">
                                <div className="flex items-center space-x-2 min-w-[85px]">
          <span className="text-amber-600" title="Количество файлов">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"/>
            </svg>
          </span>
                                    <span className="text-sm font-medium">
            {storageInfo.used_count || 0}/{storageInfo.quota_count_images}
          </span>
                                </div>
                                <div
                                    className="flex-1 bg-gray-200 rounded-full h-2 max-w-[140px]"> {/* Добавил max-w-[140px] */}
                                    <div
                                        className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                                        style={{
                                            width: `${Math.min(((storageInfo.used_count || 0) / storageInfo.quota_count_images) * 100, 100)}%`,
                                            backgroundColor: ((storageInfo.used_count || 0) / storageInfo.quota_count_images) > 0.9 ? '#ef4444' : '#f59e0b'
                                        }}
                                    ></div>
                                </div>
                            </div>

                            {/* Правая часть - объем памяти */}
                            <div className="flex items-center space-x-3 flex-1 justify-end">
                                <div className="flex items-center space-x-2 min-w-[90px]">
          <span className="text-blue-600" title="Объем памяти">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
              <path fillRule="evenodd"
                    d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
                    clipRule="evenodd"/>
            </svg>
          </span>
                                    <span className="text-sm font-medium">
            {formatSize(storageInfo.used_size || 0)}/{formatSize(storageInfo.quota_storage_size || 0)}
          </span>
                                </div>
                                <div
                                    className="flex-1 bg-gray-200 rounded-full h-2 max-w-[140px]"> {/* Такое же max-w-[140px] */}
                                    <div
                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                        style={{
                                            width: `${Math.min(((storageInfo.used_size || 0) / storageInfo.quota_storage_size) * 100, 100)}%`,
                                            backgroundColor: ((storageInfo.used_size || 0) / storageInfo.quota_storage_size) > 0.9 ? '#ef4444' : '#3b82f6'
                                        }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </motion.div>

            {/* Модальное окно загрузки */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold mb-4">Загрузить изображения</h2>

                        {/* Drag & Drop зона */}
                        <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center mb-4 transition-colors ${
                                isDragging ? 'border-amber-500 bg-amber-50' : 'border-gray-300'
                            }`}
                            onDragEnter={handleDragEnter}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor"
                                 viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                            </svg>
                            <p className="text-gray-600 mb-2">Перетащите файлы сюда или</p>
                            <label
                                className="inline-block bg-amber-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-amber-700 transition-colors">
                                Выберите файлы
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        {/* Список выбранных файлов */}
                        {selectedFiles.length > 0 && (
                            <div className="mb-4">
                                <h3 className="font-medium mb-2">Выбранные файлы:</h3>
                                <div className="max-h-32 overflow-y-auto">
                                    {selectedFiles.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between py-1">
                                            <span className="text-sm truncate flex-1">{file.name}</span>
                                            <button
                                                onClick={() => removeSelectedFile(index)}
                                                className="text-red-500 hover:text-red-700 ml-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor"
                                                     viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                          d="M6 18L18 6M6 6l12 12"/>
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Прогресс загрузки */}
                        {uploading && (
                            <div className="mb-4">
                                <h3 className="font-medium mb-2">Загрузка:</h3>
                                {uploadingFiles.map((file, index) => (
                                    <div key={index} className="mb-2">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="truncate">{file.name}</span>
                                            <span>{uploadProgress[file.name] || 0}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                                                style={{width: `${uploadProgress[file.name] || 0}%`}}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Кнопки */}
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setSelectedFiles([]);
                                    setUploadingFiles([]);
                                    setUploadProgress({});
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                disabled={uploading}
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={selectedFiles.length === 0 || uploading}
                                className={`px-4 py-2 rounded-lg transition-colors ${
                                    selectedFiles.length === 0 || uploading
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-amber-600 text-white hover:bg-amber-700'
                                }`}
                            >
                                {uploading ? 'Загрузка...' : 'Загрузить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно создания папки */}
            {showCreateFolderModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold mb-4">Создать папку</h2>
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newFolderName && !isFolderNameExists) {
                                    handleCreateFolder();
                                }
                                if (e.key === 'Escape') {
                                    setShowCreateFolderModal(false);
                                    setNewFolderName('');
                                }
                            }}
                            placeholder="Введите название папки"
                            className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            autoFocus // Автофокус на инпуте
                        />
                        {isFolderNameExists && (
                            <p className="text-red-500 text-sm mb-4">
                                Папка с таким названием уже существует
                            </p>
                        )}
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowCreateFolderModal(false);
                                    setNewFolderName('');
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleCreateFolder}
                                disabled={!newFolderName || isFolderNameExists}
                                className={`px-4 py-2 rounded-lg transition-colors ${
                                    !newFolderName || isFolderNameExists
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                            >
                                Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно перемещения */}
            {showMoveModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold mb-4">
                            Переместить {selectedImages.length} изображений
                        </h2>

                        {folderStructure && (
                            <div className="max-h-60 overflow-y-auto mb-4 border border-gray-200 rounded-lg p-3">
                                <FolderTree
                                    data={folderStructure}
                                    onSelectFolder={handleSelectFolder}
                                    selectedFolder={selectedTargetFolder} // Передаем выбранную папку
                                />
                            </div>
                        )}

                        {selectedTargetFolder && (
                            <p className="text-sm text-gray-600 mb-4">
                                Выбрана папка: {getFolderName(selectedTargetFolder)}
                            </p>
                        )}

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowMoveModal(false);
                                    setSelectedTargetFolder('');
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                disabled={moving}
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleMoveImages}
                                disabled={!selectedTargetFolder || moving}
                                className={`px-4 py-2 rounded-lg transition-colors ${
                                    !selectedTargetFolder || moving
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-purple-600 text-white hover:bg-purple-700'
                                }`}
                            >
                                {moving ? 'Перемещение...' : 'Переместить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно просмотра изображения */}
            {viewImage && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 cursor-pointer"
                    onClick={() => setViewImage(null)} // Закрытие по клику на фон
                >
                    <div className="relative max-w-4xl max-h-full w-full h-full flex items-center justify-center p-4">
                        <div className="absolute top-4 left-4 text-white text-lg z-10 bg-black bg-opacity-50 rounded px-2 py-1">
                            {viewImage.title}
                        </div>

                        {/* Кнопка закрытия */}
                        <button
                            className="absolute top-4 right-4 text-white text-2xl z-10 bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-70 transition-colors"
                            onClick={() => setViewImage(null)}
                        >
                            ×
                        </button>

                        {/* Изображение - клик на него тоже закрывает модалку */}
                        <div
                            className="relative w-full h-full flex items-center justify-center"
                            onClick={(e) => {
                                e.stopPropagation(); // Останавливаем всплытие, чтобы не конфликтовать с фоном
                                setViewImage(null); // Закрываем по клику на изображение
                            }}
                        >
                            {!viewImage.isLoaded && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                            <img
                                src={viewImage.url}
                                alt={viewImage.title}
                                className={`max-w-full max-h-full object-contain transition-opacity duration-300 cursor-pointer ${
                                    viewImage.isLoaded ? 'opacity-100' : 'opacity-0'
                                }`}
                                onLoad={() => setViewImage(prev => prev ? {...prev, isLoaded: true} : null)}
                                // Убираем stopPropagation здесь, так как обработчик теперь на родительском div
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImagesPage;