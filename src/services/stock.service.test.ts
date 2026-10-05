import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('./client', () => ({ client, API_V2_BASE_URL: 'http://api.test/api/v2' }));

import { bundleService, stockService, unitService } from './stock.service';

const v2 = { base: 'http://api.test/api/v2' };

beforeEach(() => Object.values(client).forEach((f) => f.mockReset()));

describe('stockService — /api/v2/items/:id/stock (Phase 4)', () => {
  it('reads, adjusts, sets the reorder point and pages the history at the expected URLs', async () => {
    client.get.mockResolvedValue({ data: { item_id: 'i 1' } });
    client.post.mockResolvedValue({ data: { item_id: 'i1' } });
    client.patch.mockResolvedValue({ data: { item_id: 'i1' } });
    await stockService.get('i 1');
    expect(client.get).toHaveBeenLastCalledWith('/items/i%201/stock', v2);
    await stockService.adjust('i1', { delta: -2, reason: 'Sold' });
    expect(client.post).toHaveBeenLastCalledWith('/items/i1/stock/adjust', { delta: -2, reason: 'Sold' }, v2);
    await stockService.setReorderPoint('i1', 5);
    expect(client.patch).toHaveBeenLastCalledWith('/items/i1/stock/reorder-point', { reorder_point: 5 }, v2);
    await stockService.setReorderPoint('i1', 5, 'chennai');
    expect(client.patch).toHaveBeenLastCalledWith('/items/i1/stock/reorder-point', { reorder_point: 5, location_id: 'chennai' }, v2);
    client.get.mockResolvedValue({ data: { items: [], total: 0 } });
    await stockService.movements('i1', 2, 50);
    expect(client.get).toHaveBeenLastCalledWith('/items/i1/stock/movements?page=2&limit=50', v2);
  });

  it('says so when the server returns nothing', async () => {
    client.get.mockResolvedValue({ data: undefined });
    await expect(stockService.get('i1')).rejects.toThrow('The server did not return the stock');
  });
});

describe('unitService and bundleService (Phase 4)', () => {
  it('lists with search / status, adds many at once, changes and removes units', async () => {
    client.get.mockResolvedValue({ data: { units: [] } });
    client.post.mockResolvedValue({ data: { units: [] } });
    client.patch.mockResolvedValue({ data: { id: 'u1' } });
    client.delete.mockResolvedValue({ data: { id: 'u1' } });
    await unitService.list('i1');
    expect(client.get).toHaveBeenLastCalledWith('/items/i1/units', v2);
    await unitService.list('i1', { search: ' VIN ', status: 'in_stock' });
    expect(client.get).toHaveBeenLastCalledWith('/items/i1/units?search=VIN&status=in_stock', v2);
    await unitService.add('i1', [{ serial_no: 'VIN-1' }, { serial_no: 'VIN-2' }]);
    expect(client.post).toHaveBeenLastCalledWith('/items/i1/units', { units: [{ serial_no: 'VIN-1' }, { serial_no: 'VIN-2' }] }, v2);
    await unitService.update('u1', { status: 'sold' });
    expect(client.patch).toHaveBeenLastCalledWith('/units/u1', { status: 'sold' }, v2);
    await unitService.remove('u1');
    expect(client.delete).toHaveBeenLastCalledWith('/units/u1', v2);
  });

  it('reads and replaces a bundle', async () => {
    client.get.mockResolvedValue({ data: { components: [] } });
    client.put.mockResolvedValue({ data: { components: [] } });
    await bundleService.get('k1');
    expect(client.get).toHaveBeenLastCalledWith('/items/k1/bundle-components', v2);
    await bundleService.replace('k1', [{ component_item_id: 'a', quantity: 2 }]);
    expect(client.put).toHaveBeenLastCalledWith('/items/k1/bundle-components', { components: [{ component_item_id: 'a', quantity: 2 }] }, v2);
  });
});
