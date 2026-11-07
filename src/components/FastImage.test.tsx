import React, { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FastImage from './FastImage';
import { getImageById } from '../services/imageService';
jest.mock('../context/AuthContext',()=>({useAuth:()=>({token:'test'})}));
jest.mock('../services/imageService');
const getImage = getImageById as jest.MockedFunction<typeof getImageById>;
beforeEach(()=>jest.resetAllMocks());

test('expired preview renews once and recovers in strict mode', async()=>{
    getImage.mockResolvedValue({url:'https://images.test/fresh'} as never);
    render(<StrictMode><FastImage imageData={{image_id:'a',url:'https://images.test/expired',title:'Photo'}} /></StrictMode>);
    fireEvent.error(screen.getByRole('img',{name:'Photo'}));
    await waitFor(()=>expect(screen.getByRole('img')).toHaveAttribute('src','https://images.test/fresh'));
    fireEvent.load(screen.getByRole('img'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(getImage).toHaveBeenCalledTimes(1);
});
test('failed renewal is bounded and offers retry', async()=>{
    getImage.mockResolvedValue({url:'https://images.test/fresh'} as never);
    render(<FastImage imageData={{image_id:'a',url:'https://images.test/old',title:'Photo'}} />);
    fireEvent.error(screen.getByRole('img'));
    await waitFor(()=>expect(screen.getByRole('img')).toHaveAttribute('src','https://images.test/fresh'));
    fireEvent.error(screen.getByRole('img'));
    expect(await screen.findByRole('button',{name:/Повторить/})).toBeInTheDocument();
    expect(getImage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button',{name:/Повторить/}));
    await screen.findByRole('img');
    expect(getImage).toHaveBeenCalledTimes(2);
});
test('late renewal cannot replace another image', async()=>{
    let resolve!: (value:any)=>void;
    getImage.mockReturnValue(new Promise(r=>{resolve=r;}));
    const {rerender} = render(<FastImage imageData={{image_id:'a',url:'https://images.test/a'}} />);
    fireEvent.error(screen.getByRole('img'));
    rerender(<FastImage imageData={{image_id:'b',url:'https://images.test/b'}} />);
    await act(async()=>resolve({url:'https://images.test/stale'}));
    expect(screen.getByRole('img')).toHaveAttribute('src','https://images.test/b');
});
test('revocable shared blob URL is replaced with a server URL',async()=>{
    getImage.mockResolvedValue({url:'https://images.test/fresh'} as never);
    render(<FastImage imageData={{image_id:'a',url:'blob:already-revoked'}} />);
    await waitFor(()=>expect(screen.getByRole('img')).toHaveAttribute('src','https://images.test/fresh'));
});
