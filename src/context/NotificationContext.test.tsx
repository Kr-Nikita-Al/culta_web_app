import React from 'react';
import {render,act} from '@testing-library/react';
import {NotificationProvider,useNotifications} from './NotificationContext';
let notifications:ReturnType<typeof useNotifications>;
function Probe(){notifications=useNotifications();return null;}
test('notifications created together have distinct ids and close independently',()=>{
    render(<NotificationProvider><Probe/></NotificationProvider>);
    act(()=>{
        notifications.addNotification('Первое','success');
        notifications.addNotification('Второе','error');
    });
    const [first,second]=notifications.notifications;
    expect(first.id).not.toBe(second.id);
    act(()=>notifications.removeNotification(first.id));
    expect(notifications.notifications).toEqual([second]);
});
