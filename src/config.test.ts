export {};
const original=process.env.REACT_APP_API_BASE_URL;
afterEach(()=>{if(original===undefined)delete process.env.REACT_APP_API_BASE_URL;else process.env.REACT_APP_API_BASE_URL=original;jest.resetModules();});
test('production-style default uses same-origin /api without duplicate prefixes',()=>{
    delete process.env.REACT_APP_API_BASE_URL;
    jest.resetModules();
    const config=require('./config').default;
    expect(config.apiBaseUrl).toBe(window.location.origin+'/api');
    expect(new URL(config.apiBaseUrl+'/login/session').pathname).toBe('/api/login/session');
});
test('explicit API override is normalized',()=>{
    process.env.REACT_APP_API_BASE_URL='https://api.example.test/';
    jest.resetModules();
    expect(require('./config').default.apiBaseUrl).toBe('https://api.example.test');
});
