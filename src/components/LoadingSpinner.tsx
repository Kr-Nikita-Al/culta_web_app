import React from 'react';
import { cn } from '../utils/cn'; // Нам нужно создать эту утилиту

interface LoadingSpinnerProps {
    size?: 'small' | 'medium' | 'large';
    text?: string;
    className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
                                                           size = 'medium',
                                                           text = 'Загрузка...',
                                                           className
                                                       }) => {
    const sizeClasses = {
        small: 'h-4 w-4',
        medium: 'h-8 w-8',
        large: 'h-12 w-12'
    };

    return (
        <div className={cn("flex flex-col items-center justify-center p-4", className)}>
            <div
                className={cn(
                    "animate-spin rounded-full border-b-2 border-amber-700",
                    sizeClasses[size],
                    className
                )}
            ></div>
            {text && <p className="mt-2 text-gray-600">{text}</p>}
        </div>
    );
};

export default LoadingSpinner;