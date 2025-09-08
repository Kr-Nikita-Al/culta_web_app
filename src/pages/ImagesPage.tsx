import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSelectedCompany } from '../context/SelectedCompanyContext';
import { useApi } from '../hooks/useApi';
import { uploadImage, getCompanyImages, getImageById, deleteImage, updateImage } from '../services/imageService';
import {
    createDirectory,
    deleteDirectory,
    FolderStructure,
    getDirectoryObjects, getFolderStructure,
    renameDirectory
} from '../services/directoryService';
import { useNotifications } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import FolderTree from "../components/FolderTree";

interface Folder {
    id: string;
    name: string;
    path: string;
    isDirectory: boolean;
}

export interface Image {
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
}

interface FolderNode {
    path: string;
    name: string;
    children: FolderNode[];
}


const ImagesPage: React.FC = () => {
    const [images, setImages] = useState<Image[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [directoryObjects, setDirectoryObjects] = useState<{ [key: string]: number }>({});
    const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imageWidth, setImageWidth] = useState('');
    const [imageHeight, setImageHeight] = useState('');
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [currentPath, setCurrentPath] = useState<string>('');
    const [pathHistory, setPathHistory] = useState<string[]>([]);
    const [editingItem, setEditingItem] = useState<{ type: 'folder' | 'image', id: string, name: string } | null>(null);
    const [editName, setEditName] = useState('');
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moving, setMoving] = useState(false);
    const [selectedTargetFolder, setSelectedTargetFolder] = useState('');
    const [folderStructure, setFolderStructure] = useState<FolderNode | null>(null);

    const { token } = useAuth();
    const { selectedCompany } = useSelectedCompany();
    const { callApi } = useApi();
    const { addNotification } = useNotifications();

    useEffect(() => {
        if (token && selectedCompany) {
            const basePath = `company_images/company_${selectedCompany}/`;
            setCurrentPath(basePath);
            fetchData();
        }
    }, [token, selectedCompany]);

    useEffect(() => {
        if (directoryObjects && currentPath) {
            processDirectoryObjects();
        }
    }, [directoryObjects, currentPath]);

    useEffect(() => {
        if (images.length > 0) {
            const interval = setInterval(() => {
                loadImageUrls(images);
            }, 2 * 60 * 1000); // Обновляем каждые 2 минут

            return () => clearInterval(interval);
        }
    }, [images]);

    const fetchData = async () => {
        await Promise.all([fetchDirectoryObjects(), fetchCompanyImages()]);
    };

    const fetchDirectoryObjects = async () => {
        if (!token || !selectedCompany) return;

        try {
            const response = await callApi(() => getDirectoryObjects(token, selectedCompany));
            if (response) {
                setDirectoryObjects(response);
            }
        } catch (error) {
            console.error('Ошибка загрузки объектов директории:', error);
            addNotification('Ошибка загрузки объектов директории', 'error');
        }
    };

    const fetchCompanyImages = async () => {
        if (!token || !selectedCompany) return;

        setLoading(true);
        try {
            const response = await callApi(() => getCompanyImages(token, selectedCompany));
            if (response) {
                setImages(response.images);
                loadImageUrls(response.images);
            }
        } catch (error) {
            console.error('Ошибка загрузки изображений:', error);
            addNotification('Ошибка загрузки изображений', 'error');
        } finally {
            setLoading(false);
        }
    };

    const processDirectoryObjects = () => {
        if (!directoryObjects || !currentPath) return;

        const folderList: Folder[] = [];

        Object.entries(directoryObjects).forEach(([path, size]) => {
            if (path.startsWith(currentPath)) {
                const relativePath = path.substring(currentPath.length);

                // Check if it's a directory (ends with / and size is 0)
                if (path.endsWith('/') && size === 0) {
                    // Extract folder name
                    const folderName = relativePath.endsWith('/')
                        ? relativePath.substring(0, relativePath.length - 1)
                        : relativePath;

                    if (folderName && !folderName.includes('/')) {
                        folderList.push({
                            id: path,
                            name: folderName,
                            path: path,
                            isDirectory: true
                        });
                    }
                }
            }
        });

        setFolders(folderList);
    };

    const fetchFolderStructure = async () => {
        if (!token || !selectedCompany) return;

        try {
            const response = await callApi(() => getDirectoryObjects(token, selectedCompany));
            if (response) {
                const folderTree = buildFolderTree(response);
                setFolderStructure(folderTree);
            }
        } catch (error) {
            console.error('Ошибка загрузки структуры папок:', error);
            addNotification('Ошибка загрузки структуры папок', 'error');
        }
    };

    const getFolderName = (path: string): string => {
        if (path === `company_images/company_${selectedCompany}/`) {
            return 'Корневая папка';
        }

        // Убираем базовый путь и закрывающий слэш
        const basePath = `company_images/company_${selectedCompany}/`;
        const relativePath = path.replace(basePath, '');

        // Если есть вложенность, берем последнюю часть
        const parts = relativePath.split('/').filter(part => part !== '');
        return parts[parts.length - 1] || 'Неизвестная папка';
    };

    const handleOpenMoveModal = () => {
        setShowMoveModal(true);
        fetchFolderStructure();
    };

    const loadImageUrls = async (imagesList: Image[]) => {
        if (!token) return;

        const urls: Record<string, string> = {};
        for (const image of imagesList) {
            try {
                const response = await callApi(() => getImageById(token, image.image_id));
                if (response) {
                    urls[image.image_id] = response.url;
                }
            } catch (error) {
                console.error(`Ошибка загрузки URL для изображения ${image.image_id}:`, error);
            }
        }
        setImageUrls(urls);
    };

    const navigateToFolder = (folderPath: string) => {
        setPathHistory([...pathHistory, currentPath]);
        setCurrentPath(folderPath);
    };

    const navigateToParentFolder = () => {
        if (pathHistory.length > 0) {
            const parentPath = pathHistory[pathHistory.length - 1];
            setCurrentPath(parentPath);
            setPathHistory(pathHistory.slice(0, -1));
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);

            // Автоматически определяем размер изображения
            const img = new Image();
            img.onload = () => {
                setImageWidth(img.width.toString());
                setImageHeight(img.height.toString());
            };
            img.src = URL.createObjectURL(file);
        }
    };

    const handleMoveImages = async () => {
        if (!token || selectedImages.length === 0 || !selectedTargetFolder) return;

        setMoving(true);
        try {
            for (const imageId of selectedImages) {
                const image = images.find(img => img.image_id === imageId);
                if (image) {
                    await callApi(() => updateImage(token, imageId, {
                        file_name: image.file_name,
                        file_path: selectedTargetFolder
                    }));
                }
            }
            addNotification('Изображения перенесены', 'success');
            setShowMoveModal(false);
            setSelectedTargetFolder('');
            // Обновляем данные
            fetchData();
            setSelectedImages([]);
            setIsSelectionMode(false);
        } catch (error) {
            console.error('Ошибка переноса изображений:', error);
            addNotification('Ошибка переноса изображений', 'error');
        } finally {
            setMoving(false);
        }
    };

    const handleSelectFolder = (path: string) => {
        setSelectedTargetFolder(path);
    };


    const handleUpload = async () => {
        if (!token || !selectedCompany || !selectedFile) return;

        setUploading(true);
        try {
            const metadata = {
                company_id: selectedCompany,
                file_path: currentPath,
                width: imageWidth || '0',
                height: imageHeight || '0'
            };

            await callApi(() => uploadImage(token, selectedFile, metadata));
            addNotification('Изображение успешно загружено', 'success');
            setShowUploadModal(false);
            setSelectedFile(null);
            setImageWidth('');
            setImageHeight('');
            // Refresh data
            fetchData();
        } catch (error) {
            console.error('Ошибка загрузки изображения:', error);
            addNotification('Ошибка загрузки изображения', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteImage = async (imageId: string) => {
        if (!token) return;

        try {
            await callApi(() => deleteImage(token, imageId));
            addNotification('Изображение удалено', 'success');
            // Refresh data
            fetchData();
        } catch (error) {
            console.error('Ошибка удаления изображения:', error);
            addNotification('Ошибка удаления изображения', 'error');
        }
    };

    const buildFolderTree = (objects: { [key: string]: number }): FolderNode => {
        const root: FolderNode = {
            path: `company_images/company_${selectedCompany}/`,
            name: 'Корневая папка',
            children: []
        };

        // Собираем все папки (объекты с размером 0, оканчивающиеся на /)
        const folders = Object.entries(objects)
            .filter(([path, size]) => size === 0 && path.endsWith('/'))
            .map(([path]) => path);

        // Создаем карту всех узлов
        const nodeMap = new Map<string, FolderNode>();
        nodeMap.set(root.path, root);

        // Сортируем пути для обработки от корня к листьям
        const sortedPaths = folders.sort();

        for (const path of sortedPaths) {
            // Пропускаем корневую папку
            if (path === root.path) continue;

            // Разбиваем путь на части
            const parts = path.replace(root.path, '').split('/').filter(part => part !== '');

            let currentPath = root.path;
            let parentNode = root;

            // Построение пути к текущей папке
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

    const handleDeleteFolder = async (folderPath: string, folderName: string) => {
        if (!token || !selectedCompany) return;

        if (!window.confirm(`Удалить папку "${folderName}"? Все изображения внутри также будут удалены.`)) {
            return;
        }

        try {
            const response = await callApi(() => deleteDirectory(token, {
                company_id: selectedCompany,
                dir_name: folderName + '/',
                dir_path: folderPath.substring(0, folderPath.lastIndexOf('/') + 1)
            }));

            if (response) {
                addNotification(`Папка "${folderName}" удалена. Удалено изображений: ${response["deleted image id"].length}`, 'success');
                // Refresh data
                fetchData();
            }
        } catch (error) {
            console.error('Ошибка удаления папки:', error);
            addNotification('Ошибка удаления папки', 'error');
        }
    };

    const handleDeleteSelected = async () => {
        if (!token || selectedImages.length === 0) return;

        if (!window.confirm(`Удалить ${selectedImages.length} изображений?`)) {
            return;
        }

        try {
            for (const imageId of selectedImages) {
                await callApi(() => deleteImage(token, imageId));
            }
            addNotification(`Удалено ${selectedImages.length} изображений`, 'success');
            // Refresh data
            fetchData();
            setSelectedImages([]);
            setIsSelectionMode(false);
        } catch (error) {
            console.error('Ошибка удаления изображений:', error);
            addNotification('Ошибка удаления изображений', 'error');
        }
    };

    const handleCreateFolder = async () => {
        if (!token || !selectedCompany || !newFolderName) return;

        try {
            await callApi(() => createDirectory(token, {
                company_id: selectedCompany,
                dir_name: newFolderName.endsWith('/') ? newFolderName : newFolderName + '/',
                dir_path: currentPath
            }));

            addNotification('Папка создана', 'success');
            setShowCreateFolderModal(false);
            setNewFolderName('');
            // Refresh data
            fetchDirectoryObjects();
        } catch (error) {
            console.error('Ошибка создания папки:', error);
            addNotification('Ошибка создания папки', 'error');
        }
    };

    const handleDownloadSelected = async () => {
        if (selectedImages.length === 0) return;

        try {
            for (const imageId of selectedImages) {
                const image = images.find(img => img.image_id === imageId);
                if (image && imageUrls[imageId]) {
                    const response = await fetch(imageUrls[imageId]);
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = image.title || image.file_name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            }
            addNotification(`Скачано ${selectedImages.length} изображений`, 'success');
        } catch (error) {
            console.error('Ошибка скачивания изображений:', error);
            addNotification('Ошибка скачивания изображений', 'error');
        }
    };

    const handleRenameFolder = async (folderPath: string, oldName: string, newName: string) => {
        if (!token || !selectedCompany) return;

        if (oldName === newName) {
            setEditingItem(null);
            setEditName('');
            return;
        }

        try {
            const response = await callApi(() => renameDirectory(token, {
                company_id: selectedCompany,
                old_dir_name: oldName + '/',
                new_dir_name: newName + '/',
                dir_path: folderPath.substring(0, folderPath.substring(0, folderPath.lastIndexOf('/')).lastIndexOf('/') + 1)
            }));

            // Проверяем, что ответ успешный (не null и не undefined)
            if (response) {
                addNotification('Папка переименована', 'success');
                setEditingItem(null);
                setEditName('');
                // Refresh data
                fetchData();
            } else {
                // Если response равен null, значит callApi перехватил ошибку
                addNotification('Некорректное название папки', 'error');
            }
        } catch (error: any) {
            console.error('Ошибка переименования папки:', error);
            // Проверяем статус ошибки
            if (error.response?.status === 422) {
                addNotification('Некорректное название папки', 'error');
            } else {
                addNotification('Ошибка переименования папки', 'error');
            }
        }
    };

    const handleRenameImage = async (imageId: string, oldName: string, newName: string) => {
        if (!token || !selectedCompany) return;

        if (oldName === newName) {
            setEditingItem(null);
            setEditName('');
            return;
        }

        const image = images.find(img => img.image_id === imageId);
        if (!image) return;

        try {
            const response = await callApi(() => updateImage(token, imageId, {
                file_name: newName,
                file_path: image.file_path
            }));

            // Проверяем, что ответ успешный
            if (response) {
                addNotification('Изображение переименовано', 'success');
                setEditingItem(null);
                setEditName('');
                // Refresh data
                fetchData();
            } else {
                addNotification('Ошибка переименования изображения', 'error');
            }
        } catch (error) {
            console.error('Ошибка переименования изображения:', error);
            addNotification('Ошибка переименования изображения', 'error');
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
    };

    const handleImageClick = (imageId: string) => {
        if (isSelectionMode) {
            // В режиме выбора добавляем/убираем изображение из выбранных
            if (selectedImages.includes(imageId)) {
                setSelectedImages(selectedImages.filter(id => id !== imageId));
            } else {
                setSelectedImages([...selectedImages, imageId]);
            }
        } else {
            // В обычном режиме открываем/закрываем просмотр
            if (viewImage === imageId) {
                setViewImage(null);
            } else {
                setViewImage(imageId);
            }
        }
    };

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

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Filter images for current path
    const currentImages = images.filter(img => img.file_path === currentPath);

    if (loading) {
        return <LoadingSpinner text="Загрузка изображений..." />;
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Заголовок и кнопки */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center">
                    {pathHistory.length > 0 && (
                        <button
                            onClick={navigateToParentFolder}
                            className="mr-3 p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            title="Назад"
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}
                    <h1 className="text-3xl font-bold text-coffee-dark">Галерея изображений</h1>
                </div>

                <div className="flex items-center space-x-2">
                    {/* Плюсик - добавление изображения */}
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="p-2 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
                        title="Добавить изображение"
                    >
                        <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                    {/* Добавим кнопку для переноса в панель инструментов*/}

                    <button
                        onClick={handleOpenMoveModal}
                        disabled={selectedImages.length === 0}
                        className={`p-2 rounded-lg transition-colors ${
                            selectedImages.length === 0
                                ? 'bg-gray-100 text-gray-400'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                        title="Перенести выбранные"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                        </svg>
                    </button>


                    {/*  Добавим модальное окно для выбора папки назначения*/}
                    {showMoveModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-xl p-6 w-full max-w-md">
                                <h2 className="text-xl font-semibold mb-4">Перенести в папку</h2>
                                <p className="text-sm text-gray-600 mb-4">
                                    Выберите папку для переноса {selectedImages.length} изображений
                                </p>

                                {/* Кнопка для переноса в корневую папку */}
                                <div className="mb-4">
                                    <button
                                        onClick={() => setSelectedTargetFolder(`company_images/company_${selectedCompany}/`)}
                                        className={`w-full p-2 text-left rounded ${
                                            selectedTargetFolder === `company_images/company_${selectedCompany}/`
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'hover:bg-gray-100'
                                        }`}
                                    >
                                        <div className="flex items-center">
                                            <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                            </svg>
                                            <span>Корневая папка</span>
                                        </div>
                                    </button>
                                </div>

                                {/* Дерево папок */}
                                <div className="max-h-60 overflow-y-auto mb-4 border rounded p-2">
                                    {folderStructure ? (
                                        <FolderTree
                                            data={folderStructure}
                                            onSelectFolder={handleSelectFolder}
                                        />
                                    ) : (
                                        <LoadingSpinner size="small" text="Загрузка структуры папок..." />
                                    )}
                                </div>

                                {/* Выбранная папка */}
                                {selectedTargetFolder && (
                                    <div className="mb-4 p-2 bg-blue-50 rounded">
                                        <p className="text-sm text-blue-800">
                                            Выбрана папка: {getFolderName(selectedTargetFolder)}
                                        </p>
                                    </div>
                                )}

                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={() => {
                                            setShowMoveModal(false);
                                            setSelectedTargetFolder('');
                                        }}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        onClick={handleMoveImages}
                                        disabled={!selectedTargetFolder || moving}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded disabled:opacity-50"
                                    >
                                        {moving ? 'Перенос...' : 'Перенести'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

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

            {/* Контейнер с папками и изображениями */}
            <div className="bg-white rounded-xl shadow-lg p-6">
                {folders.length === 0 && currentImages.length === 0 ? (
                    <div className="text-center py-12">
                        <svg className="w-10 h-10 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Нет папок и изображений</h3>
                        <p className="text-gray-500">Создайте папку или загрузите первое изображение</p>
                    </div>
                ) : (
                    <>
                        {/* Папки */}
                        {folders.length > 0 && (
                            <div className="mb-6">
                                <h2 className="text-xl font-semibold text-coffee-dark mb-3">Папки</h2>
                                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                    {folders.map((folder) => (
                                        <motion.div
                                            key={folder.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="relative group cursor-pointer"
                                        >
                                            <div
                                                className="relative"
                                                onClick={() => !editingItem && navigateToFolder(folder.path)}
                                            >
                                                <svg className="w-20 h-20 text-amber-600 mx-auto" fill="currentColor"
                                                     viewBox="0 0 20 20">
                                                    <path
                                                        d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                                                </svg>

                                                {/* Крестик удаления папки */}
                                                <div
                                                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 rounded-full p-1 cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteFolder(folder.path, folder.name);
                                                    }}
                                                >
                                                    <svg className="w-3 h-3 text-white" fill="none"
                                                         stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round"
                                                              strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="mt-1 text-center">
                                            {editingItem?.type === 'folder' && editingItem.id === folder.id ? (
                                                    <div className="flex flex-col items-center">
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="w-full px-1 py-0 text-xs border border-gray-300 rounded"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveEditing();
                                                                if (e.key === 'Escape') cancelEditing();
                                                            }}
                                                            autoFocus
                                                        />
                                                        <div className="flex space-x-1 mt-1">
                                                            <button
                                                                onClick={saveEditing}
                                                                className="text-xs text-green-600 hover:text-green-800"
                                                            >
                                                                ✓
                                                            </button>
                                                            <button
                                                                onClick={cancelEditing}
                                                                className="text-xs text-red-600 hover:text-red-800"
                                                            >
                                                                ✗
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="text-xs font-medium text-coffee-dark truncate cursor-text"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            startEditing('folder', folder.id, folder.name);
                                                        }}
                                                    >
                                                        {folder.name}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Изображения */}
                        {currentImages.length > 0 && (
                            <div>
                                <h2 className="text-xl font-semibold text-coffee-dark mb-3">Изображения</h2>
                                <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                                    {currentImages.map((image) => (
                                        <motion.div
                                            key={image.image_id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="relative group"
                                            onMouseDown={() => handleImageLongPressStart(image.image_id)}
                                            onMouseUp={handleImageLongPressEnd}
                                            onMouseLeave={handleImageLongPressEnd}
                                            onTouchStart={() => handleImageLongPressStart(image.image_id)}
                                            onTouchEnd={handleImageLongPressEnd}
                                        >
                                            <div
                                                className={`bg-gray-100 rounded overflow-hidden cursor-pointer aspect-square ${
                                                    viewImage === image.image_id ? 'ring-2 ring-amber-500' : ''
                                                } ${selectedImages.includes(image.image_id) ? 'ring-2 ring-blue-500' : ''}`}
                                                onClick={() => handleImageClick(image.image_id)}
                                            >
                                                {imageUrls[image.image_id] ? (
                                                    <img
                                                        src={imageUrls[image.image_id]}
                                                        alt={image.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full">
                                                        <LoadingSpinner size="small" text="" />
                                                    </div>
                                                )}

                                                {/* Крестик удаления при наведении */}
                                                <div
                                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 rounded-full p-1 cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteImage(image.image_id);
                                                    }}
                                                >
                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </div>

                                                {/* Кружок выбора в режиме выбора */}
                                                {isSelectionMode && (
                                                    <div
                                                        className="absolute top-1 left-1 bg-white rounded-full p-1 cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (selectedImages.includes(image.image_id)) {
                                                                setSelectedImages(selectedImages.filter(id => id !== image.image_id));
                                                            } else {
                                                                setSelectedImages([...selectedImages, image.image_id]);
                                                            }
                                                        }}
                                                    >
                                                        {selectedImages.includes(image.image_id) ? (
                                                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                                        ) : (
                                                            <div className="w-3 h-3 border border-gray-300 rounded-full"></div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-1 text-center">
                                                {editingItem?.type === 'image' && editingItem.id === image.image_id ? (
                                                    <div className="flex flex-col items-center">
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="w-full px-1 py-0 text-xs border border-gray-300 rounded"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveEditing();
                                                                if (e.key === 'Escape') cancelEditing();
                                                            }}
                                                            autoFocus
                                                        />
                                                        <div className="flex space-x-1 mt-1">
                                                            <button
                                                                onClick={saveEditing}
                                                                className="text-xs text-green-600 hover:text-green-800"
                                                            >
                                                                ✓
                                                            </button>
                                                            <button
                                                                onClick={cancelEditing}
                                                                className="text-xs text-red-600 hover:text-red-800"
                                                            >
                                                                ✗
                                                            </button>
                                                        </div>
                                                    </div>
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
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Модальное окно загрузки */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold mb-4">Загрузить изображение</h2>
                        <p className="text-sm text-gray-600 mb-4">Текущая папка: {currentPath}</p>

                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2">Файл изображения</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="w-full p-2 border border-gray-300 rounded"
                            />
                        </div>

                        {selectedFile && (
                            <>
                                <div className="mb-4">
                                    <label className="block text-gray-700 mb-2">Ширина (px)</label>
                                    <input
                                        type="number"
                                        value={imageWidth}
                                        onChange={(e) => setImageWidth(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded"
                                    />
                                </div>

                                <div className="mb-4">
                                    <label className="block text-gray-700 mb-2">Высота (px)</label>
                                    <input
                                        type="number"
                                        value={imageHeight}
                                        onChange={(e) => setImageHeight(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded"
                                    />
                                </div>

                                <div className="mb-4">
                                    <p className="text-sm text-gray-600">
                                        Размер файла: {formatFileSize(selectedFile.size)}
                                    </p>
                                </div>
                            </>
                        )}

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setSelectedFile(null);
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={!selectedFile || uploading}
                                className="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded disabled:opacity-50"
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
                        <p className="text-sm text-gray-600 mb-4">Текущая папка: {currentPath}</p>

                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2">Название папки</label>
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Введите название папки"
                                className="w-full p-2 border border-gray-300 rounded"
                            />
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowCreateFolderModal(false);
                                    setNewFolderName('');
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleCreateFolder}
                                disabled={!newFolderName}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
                            >
                                Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно просмотра изображения */}
            {viewImage && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 cursor-pointer"
                    onClick={() => setViewImage(null)}
                >
                    <div className="max-w-4xl max-h-full p-4" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={imageUrls[viewImage]}
                            alt="Просмотр"
                            className="max-w-full max-h-full object-contain"
                            onClick={() => setViewImage(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImagesPage;