import React, { useState } from 'react';

export interface FolderNode {
    path: string;
    name: string;
    children: FolderNode[];
}

interface FolderTreeProps {
    data: FolderNode;
    onSelectFolder: (path: string) => void;
    level?: number;
    selectedFolder?: string; // Добавляем пропс для выбранной папки
}

const FolderTree: React.FC<FolderTreeProps> = ({
                                                   data,
                                                   onSelectFolder,
                                                   level = 0,
                                                   selectedFolder
                                               }) => {
    const [isExpanded, setIsExpanded] = useState(level === 0);
    const hasChildren = data.children && data.children.length > 0;
    const paddingLeft = level * 20;

    // Проверяем, выбрана ли текущая папка
    const isSelected = selectedFolder === data.path;

    const handleToggle = () => {
        if (hasChildren) {
            setIsExpanded(!isExpanded);
        }
    };

    return (
        <div>
            <div
                className={`flex items-center py-1 cursor-pointer transition-colors ${
                    isSelected
                        ? 'bg-amber-100 text-amber-800 border-r-2 border-amber-600'
                        : 'hover:bg-gray-100'
                }`}
                style={{ paddingLeft: `${paddingLeft}px` }}
                onClick={() => onSelectFolder(data.path)}
            >
                {hasChildren && (
                    <span
                        className="mr-1 w-4 text-center"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggle();
                        }}
                    >
                        {isExpanded ? '▼' : '►'}
                    </span>
                )}
                {!hasChildren && <span className="mr-1 w-4"></span>}
                <svg className="w-4 h-4 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <span className="text-sm">{data.name}</span>
            </div>
            {isExpanded && hasChildren && (
                <div>
                    {data.children.map((child) => (
                        <FolderTree
                            key={child.path}
                            data={child}
                            onSelectFolder={onSelectFolder}
                            level={level + 1}
                            selectedFolder={selectedFolder} // Передаем selectedFolder в дочерние компоненты
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FolderTree;