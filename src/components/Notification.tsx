import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationProps {
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
    duration?: number;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose, duration = 5000 }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
                type === 'success' ? 'bg-green-500' : 'bg-red-500'
            } text-white`}
        >
            <div className="flex justify-between items-center">
                <p>{message}</p>
                <button
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