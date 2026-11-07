import React from 'react';
import {render,screen} from '@testing-library/react';
import {ItemsPreview,ScreenPreview,containerLayout,SCREEN_WIDTH} from './MenuPreview';
const products=[{id:'p',title:'Чай',price:'100',description:'',image_id:'different-photo',image_icon_id:'photo'}];
const photos=[{image_id:'photo',title:'Чай',url:'/tea.jpg'}];
test('container fills phone symmetrically and grows without shrinking cards',()=>{
    const layout=containerLayout([{title:'A',x:12,y:12,items:[{product_id:'p',x:12,y:12},{product_id:'p',x:12,y:164}]},{title:'B',x:12,y:144,items:[]}]);
    expect(layout[0].width+2*layout[0].x).toBe(SCREEN_WIDTH);
    expect(layout[0].previewHeight).toBeGreaterThan(200);
    expect(layout[1].y).toBeGreaterThanOrEqual(layout[0].y+layout[0].height+12);
});
test('miniature preserves saved positions, square proportions and image',()=>{
    render(<ItemsPreview items={[{id:'i',product_id:'p',x:164,y:320}]} products={products} photos={photos}/>);
    expect(screen.getByTestId('preview-item')).toHaveAttribute('transform','translate(164 320)');
    expect(screen.getByTestId('preview-card')).toHaveAttribute('width','140');
    expect(screen.getByTestId('preview-card')).toHaveAttribute('height','140');
    expect(screen.getByTestId('preview-photo')).toHaveAttribute('href','/tea.jpg');
    expect(screen.getByTestId('items-preview')).toHaveAttribute('preserveAspectRatio','xMidYMin meet');
    expect(screen.getByTestId('items-preview')).toHaveAttribute('viewBox','6 0 304 472');
});
test('screen preview includes every placement and uses container coordinates',()=>{
    render(<ScreenPreview containers={[{id:'c',title:'Чаи',x:40,y:200,items:Array.from({length:8},(_,i)=>({id:String(i),product_id:'p',x:12,y:i*152}))}]} products={products} photos={photos}/>);
    expect(screen.getByTestId('preview-container')).toHaveAttribute('transform','translate(4 12)');
    expect(screen.getAllByTestId('preview-photo')).toHaveLength(8);
});
