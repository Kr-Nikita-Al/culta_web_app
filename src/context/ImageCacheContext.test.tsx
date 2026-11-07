import React from 'react';
import {act, render} from '@testing-library/react';
import {ImageCacheProvider, useImageCache} from './ImageCacheContext';
import {getFolderImages, refreshFolderUrls} from '../services/imageService';
let mockAuth = {token: 'test', userId: 'first'};
jest.mock('./AuthContext', () => ({useAuth: () => mockAuth}));
jest.mock('../services/imageService');
const get = getFolderImages as jest.Mock;
let cache: ReturnType<typeof useImageCache>;
function Probe() {cache = useImageCache(); return null;}
beforeEach(() => {jest.clearAllMocks(); mockAuth = {token: 'test', userId: 'first'};});

test('response started before invalidation cannot repopulate folder cache', async () => {
    let resolve: (value: any) => void = () => {};
    get.mockReturnValueOnce(new Promise(done => {resolve = done;}));
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    let pending: Promise<void> = Promise.resolve();
    act(() => {pending = cache.loadFolderImages('a', 'photos/');});
    act(() => cache.invalidateFolderCache('a', 'photos/', false));
    await act(async () => {resolve({images: []}); await pending;});
    expect(cache.folderCache['a_photos/']).toBeUndefined();
});

test('forced refresh bypasses a fresh cached folder', async () => {
    get.mockResolvedValue({images: []});
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    await act(async () => {await cache.loadFolderImages('a', 'photos/');});
    await act(async () => {await cache.loadFolderImages('a', 'photos/');});
    expect(get).toHaveBeenCalledTimes(1);
    await act(async () => {await cache.loadFolderImages('a', 'photos/', false, true);});
    expect(get).toHaveBeenCalledTimes(2);
});

test.each([false, true])('loading reports network failure to caller, force=%s', async force => {
    get.mockRejectedValue(new Error('offline'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    try {
        await act(async () => {
            await expect(cache.loadFolderImages('a', 'photos/', false, force)).rejects.toThrow();
        });
        expect(cache.folderCache['a_photos/']).toBeUndefined();
    } finally {log.mockRestore();}
});

test('malformed response is not treated as an empty gallery', async () => {
    get.mockResolvedValue({});
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    try {
        await act(async () => {
            await expect(cache.loadFolderImages('a', 'photos/')).rejects.toThrow('Некорректный ответ');
        });
        expect(cache.folderCache['a_photos/']).toBeUndefined();
    } finally {log.mockRestore();}
});


test('account switch clears cache while token refresh preserves it', async () => {
    get.mockResolvedValue({images: []});
    const view = render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    await act(async () => {await cache.loadFolderImages('a', 'photos/');});
    act(() => cache.setCachedFolderStructure('a', {'private/': 1}));
    mockAuth = {token: 'refreshed', userId: 'first'};
    view.rerender(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    expect(cache.folderCache['a_photos/']).toBeDefined();
    mockAuth = {token: 'other', userId: 'second'};
    view.rerender(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    expect(cache.folderCache).toEqual({});
    expect(cache.getCachedFolderStructure('a')).toBeNull();
});

test('request from old account cannot populate new account cache', async () => {
    let resolve: (value: any) => void = () => {};
    get.mockReturnValueOnce(new Promise(done => {resolve = done;}));
    const view = render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    let pending: Promise<void> = Promise.resolve();
    act(() => {pending = cache.loadFolderImages('a', 'photos/');});
    mockAuth = {token: 'other', userId: 'second'};
    view.rerender(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    await act(async () => {resolve({images: []}); await pending;});
    expect(cache.folderCache).toEqual({});
});

test('same-tick image requests share one download and logout aborts it', async () => {
    const previousFetch = global.fetch;
    const previousCreate = URL.createObjectURL;
    let resolve: (value: any) => void = () => {};
    const fetchMock = jest.fn(() => new Promise<any>(done => {resolve = done;}));
    global.fetch = fetchMock as any;
    URL.createObjectURL = jest.fn(() => 'blob:test');
    try {
        const view = render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
        let first: Promise<string | null> = Promise.resolve(null);
        let second: Promise<string | null> = Promise.resolve(null);
        act(() => {
            first = cache.loadAndCacheImage({image_id: 'photo'} as any, 'https://example.test/photo');
            second = cache.loadAndCacheImage({image_id: 'photo'} as any, 'https://example.test/photo');
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const signal = (fetchMock.mock.calls as any)[0][1].signal as AbortSignal;
        view.unmount();
        expect(signal.aborted).toBe(true);
        await act(async () => {
            resolve({ok: true, blob: async () => new Blob(['photo'], {type: 'image/png'})});
            expect(await first).toBeNull();
            expect(await second).toBeNull();
        });
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    } finally {global.fetch = previousFetch; URL.createObjectURL = previousCreate;}
});


test('move preserves old state and prevents duplicate target cards in StrictMode', () => {
    render(<React.StrictMode><ImageCacheProvider><Probe/></ImageCacheProvider></React.StrictMode>);
    const image = {image_id: 'one', company_id: 'a', file_path: 'old/', title: 'Tea'} as any;
    act(() => {
        cache.updateFolderCacheDirectly('a', 'old/', [image], true);
        cache.updateFolderCacheDirectly('a', 'new/', [image], true);
    });
    const previous = cache.folderCache;
    Object.freeze(previous['a_old/'].data);
    act(() => cache.moveImageBetweenFolders('one', 'old/', 'new/', 'a'));
    expect(previous['a_old/'].data).toHaveLength(1);
    expect(previous['a_old/'].data[0].file_path).toBe('old/');
    expect(cache.folderCache['a_old/'].data).toEqual([]);
    expect(cache.folderCache['a_new/'].images).toEqual(['one']);
    expect(cache.folderCache['a_new/'].data).toHaveLength(1);
    expect(cache.folderCache['a_new/'].data[0].file_path).toBe('new/');
    expect(cache.folderCache['a_new/'].isLoadedFromServer).toBe(true);
    act(() => cache.moveImageBetweenFolders('one', 'old/', 'new/', 'a'));
    expect(cache.folderCache['a_new/'].data).toHaveLength(1);
    const current = cache.folderCache;
    act(() => cache.moveImageBetweenFolders('one', 'new/', 'new/', 'a'));
    expect(cache.folderCache).toBe(current);
});


test('invalidating structure removes only the selected company and distinguishes a confirmed empty list', () => {
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    act(() => {
        cache.setCachedFolderStructure('a', {'photos/': 1});
        cache.setCachedFolderStructure('b', {'other/': 2});
    });
    act(() => cache.invalidateCachedFolderStructure('a'));
    expect(cache.getCachedFolderStructure('a')).toBeNull();
    expect(cache.getCachedFolderStructure('b')).toEqual({'other/': 2});
    act(() => cache.setCachedFolderStructure('a', {}));
    expect(cache.getCachedFolderStructure('a')).toEqual({});
});


test('image edits update every cached company view without inventing a complete folder', () => {
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    const image = {image_id: 'one', company_id: 'a', title: 'Old', file_path: 'photos/'} as any;
    act(() => {
        cache.updateFolderCacheDirectly('a', 'photos/', [image], true);
        cache.updateFolderCacheDirectly('a', 'all/', [image], true);
        cache.updateFolderCacheDirectly('b', 'photos/', [image], true);
    });
    const previous = cache.folderCache;
    act(() => cache.updateImageInCache('a', 'uncached/', 'one', {...image, title: 'New'}));
    expect(cache.folderCache['a_photos/'].data[0].title).toBe('New');
    expect(cache.folderCache['a_all/'].data[0].title).toBe('New');
    expect(cache.folderCache['b_photos/']).toBe(previous['b_photos/']);
    expect(previous['a_photos/'].data[0].title).toBe('Old');
    expect(cache.folderCache['a_uncached/']).toBeUndefined();
    expect(cache.cache.one.imageData.title).toBe('New');
});


test('deletion removes every company view and rejects lists started before deletion', async () => {
    let resolve: (value: any) => void = () => {};
    get.mockReturnValueOnce(new Promise(done => {resolve = done;}));
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    const image = {image_id: 'one', company_id: 'a', file_path: 'photos/'} as any;
    act(() => {
        cache.updateFolderCacheDirectly('a', 'photos/', [image], true);
        cache.updateFolderCacheDirectly('a', 'all/', [image], true);
        cache.updateFolderCacheDirectly('b', 'photos/', [image], true);
    });
    const previous = cache.folderCache;
    let pending: Promise<void> = Promise.resolve();
    act(() => {pending = cache.loadFolderImages('a', 'uncached/');});
    act(() => cache.removeImageFromCache('a', 'photos/', 'one'));
    expect(cache.folderCache['a_photos/'].data).toEqual([]);
    expect(cache.folderCache['a_all/'].images).toEqual([]);
    expect(cache.folderCache['b_photos/']).toBe(previous['b_photos/']);
    expect(previous['a_photos/'].data).toHaveLength(1);
    await act(async () => {resolve({images: []}); await pending;});
    expect(cache.folderCache['a_uncached/']).toBeUndefined();
});


test('list response started before a confirmed edit cannot replace the updated folder', async () => {
    let resolve: (value: any) => void = () => {};
    get.mockReturnValueOnce(new Promise(done => {resolve = done;}));
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    const image = {image_id: 'one', company_id: 'a', title: 'Old', file_path: 'photos/'} as any;
    act(() => cache.updateFolderCacheDirectly('a', 'photos/', [image], true));
    let pending: Promise<void> = Promise.resolve();
    act(() => {pending = cache.loadFolderImages('a', 'photos/', false, true);});
    act(() => cache.updateImageInCache('a', 'photos/', 'one', {...image, title: 'New'}));
    await act(async () => {resolve({images: []}); await pending;});
    expect(cache.folderCache['a_photos/'].data[0].title).toBe('New');
    expect(cache.cache.one.imageData.title).toBe('New');
});


test.each([false, true])('clear cache drops structure and ignores previous request, failure=%s', async failure => {
    let resolve: (value: any) => void = () => {};
    let reject: (value: any) => void = () => {};
    get.mockReturnValueOnce(new Promise((done, fail) => {resolve = done; reject = fail;}));
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    act(() => cache.setCachedFolderStructure('a', {'photos/': 1}));
    let pending: Promise<void> = Promise.resolve();
    act(() => {pending = cache.loadFolderImages('a', 'photos/');});
    act(() => cache.clearImageCache());
    await act(async () => {
        if (failure) reject(new Error('offline')); else resolve({images: []});
        await pending;
    });
    expect(cache.getCachedFolderStructure('a')).toBeNull();
    expect(cache.folderCache).toEqual({});
    expect(cache.error).toBeNull();
});


test('preview completion preserves metadata saved while the image was loading', async () => {
    const previousFetch = global.fetch, previousCreate = URL.createObjectURL, previousRevoke = URL.revokeObjectURL;
    let resolve: (value: any) => void = () => {};
    global.fetch = jest.fn(() => new Promise(done => {resolve = done;})) as any;
    URL.createObjectURL = jest.fn(() => 'blob:preview');
    URL.revokeObjectURL = jest.fn();
    const view = render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    try {
        const image = {image_id: 'one', company_id: 'a', title: 'Old', file_path: 'photos/'} as any;
        let pending: Promise<string | null> = Promise.resolve(null);
        act(() => {pending = cache.loadAndCacheImage(image, 'https://example.test/photo');});
        act(() => cache.updateImageInCache('a', 'photos/', 'one', {...image, title: 'New'}));
        await act(async () => {
            resolve({ok: true, blob: async () => new Blob(['photo'], {type: 'image/png'})});
            await pending;
        });
        expect(cache.cache.one.imageData.title).toBe('New');
        expect(cache.cache.one.blobUrl).toBe('blob:preview');
    } finally {
        view.unmount();
        global.fetch = previousFetch; URL.createObjectURL = previousCreate; URL.revokeObjectURL = previousRevoke;
    }
});


test('deletion aborts its preview and late completion cannot recreate the image', async () => {
    const previousFetch = global.fetch, previousCreate = URL.createObjectURL;
    let resolve: (value: any) => void = () => {};
    const fetchMock = jest.fn(() => new Promise(done => {resolve = done;}));
    global.fetch = fetchMock as any;
    URL.createObjectURL = jest.fn(() => 'blob:deleted');
    const view = render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    try {
        const image = {image_id: 'one', company_id: 'a', file_path: 'photos/'} as any;
        let pending: Promise<string | null> = Promise.resolve(null);
        act(() => {pending = cache.loadAndCacheImage(image, 'https://example.test/photo');});
        const signal = (fetchMock.mock.calls as any)[0][1].signal as AbortSignal;
        act(() => cache.removeImageFromCache('a', 'photos/', 'one'));
        expect(signal.aborted).toBe(true);
        await act(async () => {
            resolve({ok: true, blob: async () => new Blob(['photo'], {type: 'image/png'})});
            expect(await pending).toBeNull();
        });
        expect(cache.cache.one).toBeUndefined();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    } finally {view.unmount(); global.fetch = previousFetch; URL.createObjectURL = previousCreate;}
});


test.each([false, true])('loading stays active until both folder requests settle, failure=%s', async failure => {
    let resolveFirst: (value: any) => void = () => {};
    let rejectFirst: (value: any) => void = () => {};
    let resolveSecond: (value: any) => void = () => {};
    get.mockReturnValueOnce(new Promise((done, fail) => {resolveFirst = done; rejectFirst = fail;}))
        .mockReturnValueOnce(new Promise(done => {resolveSecond = done;}));
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        let first: Promise<void> = Promise.resolve(), second: Promise<void> = Promise.resolve();
        act(() => {
            first = cache.loadFolderImages('a', 'first/').catch(() => {});
            second = cache.loadFolderImages('a', 'second/');
        });
        expect(cache.loading).toBe(true);
        await act(async () => {
            if (failure) rejectFirst(new Error('offline')); else resolveFirst({images: []});
            await first;
        });
        expect(cache.loading).toBe(true);
        await act(async () => {resolveSecond({images: []}); await second;});
        expect(cache.loading).toBe(false);
    } finally {log.mockRestore();}
});


test('URL refresh preserves the loaded preview and latest title', async () => {
    const previousFetch = global.fetch, previousCreate = URL.createObjectURL, previousRevoke = URL.revokeObjectURL;
    global.fetch = jest.fn().mockResolvedValue({ok: true, blob: async () => new Blob(['photo'], {type: 'image/png'})});
    URL.createObjectURL = jest.fn(() => 'blob:preview');
    URL.revokeObjectURL = jest.fn();
    (refreshFolderUrls as jest.Mock).mockResolvedValue({urls: {one: 'https://example.test/new'}});
    const view = render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    try {
        const image = {image_id: 'one', company_id: 'a', title: 'Tea', file_path: 'photos/'} as any;
        act(() => cache.updateFolderCacheDirectly('a', 'photos/', [image], true));
        await act(async () => {await cache.loadAndCacheImage(image, 'https://example.test/old');});
        await act(async () => {await cache.refreshFolderUrls('a', 'photos/');});
        expect(cache.cache.one.blobUrl).toBe('blob:preview');
        expect(cache.cache.one.url).toBe('https://example.test/new');
        expect(cache.folderCache['a_photos/'].data[0].url).toBe('https://example.test/new');
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
        view.unmount(); global.fetch = previousFetch; URL.createObjectURL = previousCreate; URL.revokeObjectURL = previousRevoke;
    }
});


test('URL getter follows additions, updates and deletion instead of initial cache', () => {
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    expect(cache.getCachedImageUrl('one')).toBeNull();
    const image = {image_id: 'one', company_id: 'a', file_path: 'photos/', url: 'https://example.test/first'} as any;
    act(() => cache.updateImageInCache('a', 'photos/', 'one', image));
    expect(cache.getCachedImageUrl('one')).toBe('https://example.test/first');
    act(() => cache.updateImageInCache('a', 'photos/', 'one', {...image, url: 'https://example.test/second'}));
    expect(cache.getCachedImageUrl('one')).toBe('https://example.test/second');
    act(() => cache.removeImageFromCache('a', 'photos/', 'one'));
    expect(cache.getCachedImageUrl('one')).toBeNull();
});


test.each(['offline', 'malformed'])('URL refresh failure retains cached images and can recover: %s', async mode => {
    const refresh = refreshFolderUrls as jest.Mock;
    if (mode === 'offline') refresh.mockRejectedValueOnce(new Error('offline'));
    else refresh.mockResolvedValueOnce({urls: []});
    refresh.mockResolvedValueOnce({urls: {one: 'https://example.test/new'}});
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    try {
        const image = {image_id: 'one', company_id: 'a', file_path: 'photos/', url: 'https://example.test/old'} as any;
        act(() => {
            cache.updateFolderCacheDirectly('a', 'photos/', [image], true);
            cache.updateImageInCache('a', 'photos/', 'one', image);
        });
        await act(async () => {await cache.refreshFolderUrls('a', 'photos/');});
        expect(cache.error).toBe('Не удалось обновить ссылки изображений. Повторите попытку.');
        expect(cache.loading).toBe(false);
        expect(cache.getCachedImageUrl('one')).toBe('https://example.test/old');
        expect(cache.folderCache['a_photos/'].data).toHaveLength(1);
        await act(async () => {await cache.refreshFolderUrls('a', 'photos/');});
        expect(cache.error).toBeNull();
        expect(cache.getCachedImageUrl('one')).toBe('https://example.test/new');
    } finally {log.mockRestore();}
});


test.each([false, true])('older URL refresh cannot overwrite newer success, failure=%s', async failure => {
    let resolveOld: (value: any) => void = () => {};
    let rejectOld: (value: any) => void = () => {};
    (refreshFolderUrls as jest.Mock).mockReturnValueOnce(new Promise((done, fail) => {resolveOld = done; rejectOld = fail;}))
        .mockResolvedValueOnce({urls: {one: 'https://example.test/new'}});
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    const image = {image_id: 'one', company_id: 'a', file_path: 'photos/', url: 'https://example.test/original'} as any;
    act(() => cache.updateImageInCache('a', 'photos/', 'one', image));
    let old: Promise<void> = Promise.resolve();
    act(() => {old = cache.refreshFolderUrls('a', 'photos/');});
    await act(async () => {await cache.refreshFolderUrls('a', 'photos/');});
    await act(async () => {
        if (failure) rejectOld(new Error('offline')); else resolveOld({urls: {one: 'https://example.test/old'}});
        await old;
    });
    expect(cache.getCachedImageUrl('one')).toBe('https://example.test/new');
    expect(cache.error).toBeNull();
    expect(cache.loading).toBe(false);
});


test('direct folder updates retain HTTP URLs and latest completeness flag', () => {
    render(<ImageCacheProvider><Probe/></ImageCacheProvider>);
    const image = {image_id: 'one', company_id: 'a', url: 'https://example.test/photo'} as any;
    act(() => {
        cache.updateFolderCacheDirectly('a', 'photos/', [image], true);
        cache.updateFolderCacheDirectly('a', 'photos/', [image], undefined);
    });
    expect(cache.folderCache['a_photos/'].data[0].url).toBe(image.url);
    expect(cache.folderCache['a_photos/'].isLoadedFromServer).toBe(true);
});
