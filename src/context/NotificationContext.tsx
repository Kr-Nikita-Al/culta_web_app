import React, { createContext, useContext, useState, ReactNode } from 'react';
import {AnimatePresence} from "framer-motion";
import Notification from '../components/Notification';

interface Notification {
    id: string;
    message: string;
    type: 'success' | 'error';
}

interface NotificationContextType {
    notifications: Notification[];
    addNotification: (message: string, type: 'success' | 'error') => void;
    removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = (message: string, type: 'success' | 'error') => {
        const id = Date.now().toString();
        setNotifications(prev => [...prev, { id, message, type }]);
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(notification => notification.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const NotificationContainer: React.FC = () => {
    const { notifications, removeNotification } = useNotifications();

    return (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
            <AnimatePresence>
                {notifications.map(notification => (
                    <Notification
                        key={notification.id}
                        message={notification.message}
                        type={notification.type}
                        onClose={() => removeNotification(notification.id)}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};