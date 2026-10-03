import { createOperationUuid } from './operationId';

describe('createOperationUuid', () => {
  it('uses native randomUUID when the browser provides it', () => {
    expect(createOperationUuid({ randomUUID: () => 'native-operation-id' })).toBe('native-operation-id');
  });

  it('creates an RFC 4122 version 4 UUID when randomUUID is unavailable', () => {
    const result = createOperationUuid({
      getRandomValues: (array) => {
        array.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
        return array;
      },
    });

    expect(result).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('falls back without throwing when no Web Crypto methods are available', () => {
    expect(createOperationUuid({})).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
