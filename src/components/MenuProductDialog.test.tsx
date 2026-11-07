import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {ProductDialog} from './MenuProductDialog';
test.each([true,false])('shows read-only usage status %s without saving it',isUsed=>{
    const save=jest.fn();
    render(<ProductDialog product={{id:'p',title:'Чай',price:'100',description:'',image_id:'',is_used:isUsed}} photos={[]} busy={false} error="" refreshPhotos={()=>{}} onClose={()=>{}} onSave={save}/>);
    expect(screen.getByRole('status')).toHaveTextContent(isUsed?'Используется в меню':'Не размещён в меню');
    fireEvent.click(screen.getByLabelText('Сохранить товар'));
    expect(save.mock.calls[0][0]).not.toHaveProperty('is_used');
});
test('checkbox copies product image to icon and saves with icon-only button',()=>{
    const save=jest.fn();
    render(<ProductDialog product={{id:'p',title:'Чай',price:'100',description:'',image_id:'photo',image_product_id:'photo',image_icon_id:'icon'}} photos={[]} busy={false} error="" refreshPhotos={()=>{}} onClose={()=>{}} onSave={save}/>);
    expect(screen.queryByLabelText('Редактировать товар')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Название')).not.toHaveAttribute('readonly');
    fireEvent.click(screen.getByLabelText('Изображение фото товара совпадает с иконкой'));
    fireEvent.click(screen.getByLabelText('Сохранить товар'));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({image_product_id:'photo',image_icon_id:'photo'}));
});
