import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), downloadBlob: vi.fn() }));
vi.mock('./client', () => ({ client }));

import { catalogCategoryService } from './catalogCategory.service';

beforeEach(() => Object.values(client).forEach((f) => f.mockReset()));

describe('catalogCategoryService (Phase 2)', () => {
  it('lists live categories, or deleted ones too on request', async () => {
    client.get.mockResolvedValue({ data: { mode: 'flat', categories: [] } });
    expect(await catalogCategoryService.list()).toEqual({ mode: 'flat', categories: [] });
    expect(client.get).toHaveBeenLastCalledWith('/catalog-categories');
    await catalogCategoryService.list(true);
    expect(client.get).toHaveBeenLastCalledWith('/catalog-categories?include_deleted=true');
  });

  it('creates, updates and restores at the expected URLs', async () => {
    client.post.mockResolvedValue({ data: { id: 'c1' } });
    client.patch.mockResolvedValue({ data: { id: 'c1' } });
    await catalogCategoryService.create({ code: 'cars', name: { en: 'Cars' } });
    expect(client.post).toHaveBeenLastCalledWith('/catalog-categories', { code: 'cars', name: { en: 'Cars' } });
    await catalogCategoryService.update('c 1', { parent_id: null });
    expect(client.patch).toHaveBeenLastCalledWith('/catalog-categories/c%201', { parent_id: null });
    await catalogCategoryService.restore('c1');
    expect(client.post).toHaveBeenLastCalledWith('/catalog-categories/c1/restore');
  });

  it('reorders one parent’s children, null meaning the top level', async () => {
    client.post.mockResolvedValue({ data: { mode: 'tree', categories: [] } });
    await catalogCategoryService.reorder(null, ['b', 'a']);
    expect(client.post).toHaveBeenCalledWith('/catalog-categories/reorder', { parent_id: null, ids: ['b', 'a'] });
  });

  it('sends no fulfilment or tracking — categories no longer set them (R13)', async () => {
    client.post.mockResolvedValue({ data: { id: 'c1' } });
    client.patch.mockResolvedValue({ data: { id: 'c1' } });
    await catalogCategoryService.create({ code: 'service', name: { en: 'Service' }, visible_field_keys: [] });
    await catalogCategoryService.update('c1', { name: { en: 'Service' } });
    for (const body of [client.post.mock.calls[0][1], client.patch.mock.calls[0][1]]) {
      expect(body).not.toHaveProperty('fulfilment');
      expect(body).not.toHaveProperty('tracking');
    }
  });

  it('downloads the CSV with only the filters that are set (2b.4a)', async () => {
    client.downloadBlob.mockResolvedValue(undefined);
    await catalogCategoryService.exportCsv({ search: 'jea', status: 'hidden', include_deleted: true });
    expect(client.downloadBlob).toHaveBeenLastCalledWith(
      '/catalog-categories/export',
      { search: 'jea', status: 'hidden', include_deleted: 'true' },
      'categories.csv'
    );
    await catalogCategoryService.exportCsv({ search: '', status: 'all', include_deleted: false });
    expect(client.downloadBlob).toHaveBeenLastCalledWith(
      '/catalog-categories/export',
      { search: undefined, status: undefined, include_deleted: undefined },
      'categories.csv'
    );
  });

  it('soft-deletes with DELETE', async () => {
    client.delete.mockResolvedValue({ data: { id: 'c1' } });
    await catalogCategoryService.remove('c1');
    expect(client.delete).toHaveBeenCalledWith('/catalog-categories/c1');
  });

  it('fails loudly when the server returns no data', async () => {
    client.get.mockResolvedValue({});
    await expect(catalogCategoryService.get('c1')).rejects.toThrow('The server did not return the category');
  });
});
