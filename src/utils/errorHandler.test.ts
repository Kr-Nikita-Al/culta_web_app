import {handleImageError} from './errorHandler';

test('explains a storage write denial without claiming a temporary outage', () => {
    const notify = jest.fn();
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    handleImageError({response: {status: 503, data: {detail: 'Storage write access denied'}}}, notify);
    expect(notify).toHaveBeenCalledWith('Хранилище запретило загрузку. Обратитесь к администратору для проверки прав записи.', 'error');
    log.mockRestore();
});
