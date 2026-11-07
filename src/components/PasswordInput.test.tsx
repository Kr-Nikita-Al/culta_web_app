import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import PasswordInput from './PasswordInput';
test('toggles visibility without changing the password',()=>{
    render(<PasswordInput aria-label="Пароль" defaultValue="test-only"/>);
    const input=screen.getByLabelText('Пароль');
    expect(input).toHaveAttribute('type','password');
    fireEvent.click(screen.getByRole('button',{name:'Показать пароль'}));
    expect(input).toHaveAttribute('type','text');expect(input).toHaveValue('test-only');
    fireEvent.click(screen.getByRole('button',{name:'Скрыть пароль'}));
    expect(input).toHaveAttribute('type','password');expect(input).toHaveValue('test-only');
});
