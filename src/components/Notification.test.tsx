import React from 'react';
import {render,act,screen,fireEvent} from '@testing-library/react';
import Notification from './Notification';
test('parent rerenders do not restart the notification lifetime',()=>{
    jest.useFakeTimers();
    try{
        const first=jest.fn(),next=jest.fn();
        const view=render(<Notification message="Готово" type="success" onClose={first}/>);
        act(()=>jest.advanceTimersByTime(4000));
        view.rerender(<Notification message="Готово" type="success" onClose={next}/>);
        act(()=>jest.advanceTimersByTime(1000));
        expect(next).toHaveBeenCalledTimes(1);
        expect(first).not.toHaveBeenCalled();
    }finally{jest.useRealTimers();}
});
test('notification has an accessible close button',()=>{
    const close=jest.fn();
    render(<Notification message="Готово" type="success" onClose={close}/>);
    fireEvent.click(screen.getByRole('button',{name:'Закрыть уведомление'}));
    expect(close).toHaveBeenCalledTimes(1);
});
