import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {ProductDialog} from './MenuProductDialog';
test('preserves local edits on conflict and requires explicit reload',()=>{
    const save=jest.fn(),reload=jest.fn();
    const props={product:{id:'p',version:7,title:'Чай',price:'100',description:'',image_id:''},photos:[],onSave:save,onClose:()=>{},busy:false,error:'',refreshPhotos:()=>{},onReload:reload};
    const {rerender}=render(<ProductDialog {...props}/>);
    fireEvent.change(screen.getByLabelText('Название'),{target:{value:'Моя правка'}});
    fireEvent.click(screen.getByLabelText('Сохранить товар'));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({version:7,title:'Моя правка'}));
    rerender(<ProductDialog {...props} conflict/>);
    expect(screen.getByLabelText('Название')).toHaveValue('Моя правка');
    expect(screen.getByLabelText('Сохранить товар')).toBeDisabled();
    fireEvent.click(screen.getByText('Загрузить актуальную карточку'));
    expect(reload).toHaveBeenCalledTimes(1);
});
