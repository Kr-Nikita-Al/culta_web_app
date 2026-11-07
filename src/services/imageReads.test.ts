import api from './api';
import {getImageById} from './imageService';
import {getDirectoryObjects} from './directoryService';
jest.mock('./api',()=>({__esModule:true,default:{get:jest.fn()}}));
test.each([getImageById,getDirectoryObjects])('forwards read cancellation to the HTTP client',async read=>{
    (api.get as jest.Mock).mockReset().mockResolvedValue({data:{}});
    const controller=new AbortController();
    await read('token','id',controller.signal);
    expect((api.get as jest.Mock).mock.calls[0][1]).toMatchObject({signal:controller.signal});
});
