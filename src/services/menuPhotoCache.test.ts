import api from './api';
import {getMenuPhotos} from './menuPhotoCache';
jest.mock('./api',()=>({__esModule:true,default:{get:jest.fn()}}));
test('reuses photo requests and URLs within TTL and separates accounts and companies',async()=>{
    (api.get as jest.Mock).mockResolvedValue({data:[{image_id:'p',url:'/photo'}]});
    const now=jest.spyOn(Date,'now').mockReturnValue(1000);
    localStorage.setItem('authToken_v2','one');
    const first=await getMenuPhotos('cache-test');
    expect(await getMenuPhotos('cache-test')).toBe(first);
    expect(api.get).toHaveBeenCalledTimes(1);
    await getMenuPhotos('other-company');
    localStorage.setItem('authToken_v2','two');
    await getMenuPhotos('cache-test');
    expect(api.get).toHaveBeenCalledTimes(3);
    now.mockReturnValue(122000);
    await getMenuPhotos('cache-test');
    expect(api.get).toHaveBeenCalledTimes(4);
    now.mockRestore();
    localStorage.clear();
});
test('explicit refresh bypasses the cached photo list',async()=>{
    const get=api.get as jest.Mock;
    get.mockReset().mockResolvedValueOnce({data:[{image_id:'old'}]}).mockResolvedValueOnce({data:[{image_id:'new'}]});
    await getMenuPhotos('refresh-test');
    expect(await getMenuPhotos('refresh-test',true)).toEqual([{image_id:'new'}]);
    expect(await getMenuPhotos('refresh-test')).toEqual([{image_id:'new'}]);
    expect(get).toHaveBeenCalledTimes(2);
});
test('late failure of an older request does not evict refreshed photos',async()=>{
    const get=api.get as jest.Mock;
    let reject:(reason:unknown)=>void=()=>{};
    get.mockReset().mockReturnValueOnce(new Promise((_done,fail)=>{reject=fail;})).mockResolvedValueOnce({data:[{image_id:'new'}]});
    const old=getMenuPhotos('race-test');
    const failure=old.catch(error=>error);
    await getMenuPhotos('race-test',true);
    reject(new Error('old request failed'));
    await expect(failure).resolves.toMatchObject({message:'old request failed'});
    expect(await getMenuPhotos('race-test')).toEqual([{image_id:'new'}]);
    expect(get).toHaveBeenCalledTimes(2);
});
test('invalid response is not cached and can be retried',async()=>{
    const get=api.get as jest.Mock;
    get.mockReset().mockResolvedValueOnce({data:null}).mockResolvedValueOnce({data:[]});
    await expect(getMenuPhotos('invalid-test')).rejects.toThrow('Invalid photo list');
    expect(await getMenuPhotos('invalid-test')).toEqual([]);
    expect(get).toHaveBeenCalledTimes(2);
});
