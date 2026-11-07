import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import {AnimatePresence} from "framer-motion";
import Notification from '../components/Notification';

interface NotificationEntry {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface NotificationContextType {
    notifications: NotificationEntry[];
    addNotification: (message: string, type: 'success' | 'error' | 'info') => void;
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
    const [notifications, setNotifications] = useState<NotificationEntry[]>([]);

    const sequence = useRef(0);
    const addNotification = useCallback((message: string, type: 'success' | 'error' | 'info') => {
        const id = `notification-${++sequence.current}`;
        setNotifications(prev => [...prev, { id, message, type }]);
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(notification => notification.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const NotificationContainer: React.FC = () => {
    const { notifications, removeNotification } = useNotifications();

    return (
        <div className="fixed bottom-4 right-4 z-[200] space-y-2" aria-live="polite">
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
