import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface NotificationProps {
    message: string;
    type: 'success' | 'error' | 'info';
    onClose: () => void;
    duration?: number;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose, duration = 5000 }) => {
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const timer = setTimeout(() => close.current(), duration);
        return () => clearTimeout(timer);
    }, [duration]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            className={`p-4 rounded-lg shadow-lg z-50 max-w-sm ${
                type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
            } text-white`}
        >
            <div className="flex justify-between items-center">
                <p>{message}</p>
                <button
                    type="button" aria-label="Закрыть уведомление"
                    onClick={onClose}
                    className="ml-4 text-white hover:text-gray-200"
                >
                    ×
                </button>
            </div>
        </motion.div>
    );
};

export default Notification;