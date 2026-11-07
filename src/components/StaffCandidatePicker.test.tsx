import React from 'react';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import StaffCandidatePicker from './StaffCandidatePicker';
import {searchStaffCandidates} from '../services/roleService';
jest.mock('../services/roleService', () => ({searchStaffCandidates: jest.fn()}));
const search = searchStaffCandidates as jest.Mock;
beforeEach(() => search.mockReset());

test('requires explicit selection and clears selection when editing', async () => {
    const onChange = jest.fn();
    search.mockResolvedValue({users: [{user_id:'one', name:'Иван', surname:'Иванов', email_hint:'i***@test.ru'}], has_more:false});
    render(<StaffCandidatePicker companyId="company" role="role" action="grant" value="" onChange={onChange}/>);
    fireEvent.change(screen.getByLabelText('Поиск по ФИО:'), {target:{value:'Иван'}});
    fireEvent.click(await screen.findByText('Иванов Иван'));
    expect(search).toHaveBeenCalledWith('company','role','grant','Иван');
    expect(onChange).toHaveBeenLastCalledWith('one');
    fireEvent.change(screen.getByLabelText('Поиск по ФИО:'), {target:{value:'Петр'}});
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.queryByText('Иванов Иван')).not.toBeInTheDocument();
});

test('ignores results for an edited query', async () => {
    let resolve: any;
    search.mockReturnValue(new Promise(r => {resolve=r;}));
    render(<StaffCandidatePicker companyId="company" role="role" action="grant" value="" onChange={jest.fn()}/>);
    fireEvent.change(screen.getByLabelText('Поиск по ФИО:'), {target:{value:'Иван'}});
    await waitFor(()=>expect(search).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Поиск по ФИО:'), {target:{value:'Петр'}});
    resolve({users:[{user_id:'old',name:'Старый',surname:'Ответ',email_hint:'x***@test.ru'}],has_more:false});
    await waitFor(() => expect(screen.getByLabelText('Поиск по ФИО:')).toHaveValue('Петр'));
    expect(screen.queryByText('Ответ Старый')).not.toBeInTheDocument();
});


test('Enter cancels the scheduled search', async () => {
    jest.useFakeTimers();
    search.mockResolvedValue({users:[],has_more:false});
    const view = render(<StaffCandidatePicker companyId="a" role="admin" action="grant" value="" onChange={jest.fn()}/>);
    try {
        fireEvent.change(screen.getByLabelText('Поиск по ФИО:'), {target:{value:'Иван'}});
        fireEvent.keyDown(screen.getByLabelText('Поиск по ФИО:'), {key:'Enter'});
        await act(async () => {await Promise.resolve();});
        await act(async () => {jest.advanceTimersByTime(400);});
        expect(search).toHaveBeenCalledTimes(1);
    } finally {view.unmount(); jest.useRealTimers();}
});

test('role change immediately removes previous candidates and selection', async () => {
    search.mockResolvedValue({users:[{user_id:'one',name:'Иван',surname:'Иванов',email_hint:'i***@test.ru'}],has_more:false});
    const onChange = jest.fn();
    const view = render(<StaffCandidatePicker companyId="a" role="admin" action="grant" value="one" onChange={onChange}/>);
    fireEvent.change(screen.getByLabelText('Поиск по ФИО:'), {target:{value:'Иван'}});
    await screen.findByText('Иванов Иван');
    view.rerender(<StaffCandidatePicker companyId="a" role="waiter" action="grant" value="one" onChange={onChange}/>);
    expect(screen.queryByText('Иванов Иван')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith('');
});
