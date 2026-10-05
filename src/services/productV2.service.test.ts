import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('./client', () => ({ client, API_V2_BASE_URL: 'http://api.test/api/v2' }));

import { productV2Service } from './productV2.service';

const v2 = { base: 'http://api.test/api/v2' };

beforeEach(() => Object.values(client).forEach((f) => f.mockReset()));

describe('productV2Service — /api/v2/products', () => {
  it('searches with the filters as sent, on the v2 API', async () => {
    client.post.mockResolvedValue({ data: { items: [], total: 0 } });
    await productV2Service.search({ search: 'creta', price_min_minor: 100000, attributes: { colour: ['red'] }, page: 2 });
    expect(client.post).toHaveBeenCalledWith('/products/search', { search: 'creta', price_min_minor: 100000, attributes: { colour: ['red'] }, page: 2 }, v2);
  });

  it('reads, creates, updates and runs the lifecycle at the expected URLs', async () => {
    client.get.mockResolvedValue({ data: { id: 'p 1' } });
    client.post.mockResolvedValue({ data: { id: 'p1' } });
    client.patch.mockResolvedValue({ data: { id: 'p1' } });
    await productV2Service.get('p 1', true);
    expect(client.get).toHaveBeenLastCalledWith('/products/p%201?include_deleted=true', v2);
    await productV2Service.create({ name: { en: 'Creta' } });
    expect(client.post).toHaveBeenLastCalledWith('/products', { name: { en: 'Creta' } }, v2);
    await productV2Service.update('p1', { brand: 'Hyundai' });
    expect(client.patch).toHaveBeenLastCalledWith('/products/p1', { brand: 'Hyundai' }, v2);
    for (const [fn, path] of [
      [productV2Service.publish, '/products/p1/publish'],
      [productV2Service.archive, '/products/p1/archive'],
      [productV2Service.restore, '/products/p1/restore'],
    ] as const) {
      await fn('p1');
      expect(client.post).toHaveBeenLastCalledWith(path, undefined, v2);
    }
    client.delete.mockResolvedValue({ data: { id: 'p1' } });
    await productV2Service.remove('p1');
    expect(client.delete).toHaveBeenLastCalledWith('/products/p1', v2);
  });

  it('changes items by id and never regenerates them', async () => {
    client.post.mockResolvedValue({ data: { id: 'p1' } });
    client.patch.mockResolvedValue({ data: { id: 'p1' } });
    client.delete.mockResolvedValue({ data: { id: 'p1' } });
    await productV2Service.addItem('p1', { sku: 'A', price: { amount_minor: 100 } });
    expect(client.post).toHaveBeenLastCalledWith('/products/p1/items', { sku: 'A', price: { amount_minor: 100 } }, v2);
    await productV2Service.updateItem('p1', 'i1', { sku: 'B' });
    expect(client.patch).toHaveBeenLastCalledWith('/products/p1/items/i1', { sku: 'B' }, v2);
    await productV2Service.deleteItem('p1', 'i1');
    expect(client.delete).toHaveBeenLastCalledWith('/products/p1/items/i1', v2);
    await productV2Service.restoreItem('p1', 'i1');
    expect(client.post).toHaveBeenLastCalledWith('/products/p1/items/i1/restore', undefined, v2);
  });

  it('previews variants and fails loudly without data', async () => {
    client.post.mockResolvedValue({ data: { total: 4, new: 4, combinations: [] } });
    expect((await productV2Service.variantPreview({ variant_axes: [{ key: 'fuel', values: ['petrol'] }] })).total).toBe(4);
    expect(client.post).toHaveBeenLastCalledWith('/products/variant-preview', { variant_axes: [{ key: 'fuel', values: ['petrol'] }] }, v2);
    client.get.mockResolvedValue({});
    await expect(productV2Service.get('x')).rejects.toThrow('The server did not return the product');
  });
});
