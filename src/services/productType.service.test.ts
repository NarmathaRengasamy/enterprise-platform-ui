import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('./client', () => ({ client }));

import { productTypeService } from './productType.service';

beforeEach(() => client.post.mockReset());

describe('productTypeService.addOptions (Phase 1b)', () => {
  it('posts the options to the shared attribute and returns what was added', async () => {
    client.post.mockResolvedValue({
      data: { product_type: { id: 't1' }, added: ['maroon'], existing: [], warnings: [] },
      message: '1 option(s) added',
    });
    const res = await productTypeService.addOptions('colour', ['Maroon']);
    expect(client.post).toHaveBeenCalledWith('/product-type/fields/colour/options', { options: ['Maroon'] });
    expect(res).toMatchObject({ data: { id: 't1' }, added: ['maroon'], warnings: [] });
  });

  it('passes confirm only when set, and surfaces near-duplicate warnings', async () => {
    client.post.mockResolvedValue({
      data: { product_type: { id: 't1' }, added: [], existing: [], warnings: [{ value: 'rde', label: 'Rde', similar_to: 'Red' }] },
    });
    const res = await productTypeService.addOptions('colour', ['Rde']);
    expect(res.warnings[0].similar_to).toBe('Red');

    await productTypeService.addOptions('colour', ['Rde'], true);
    expect(client.post).toHaveBeenLastCalledWith('/product-type/fields/colour/options', { options: ['Rde'], confirm: true });
  });

  it('encodes the attribute key in the URL', async () => {
    client.post.mockResolvedValue({ data: { product_type: {}, added: [], existing: [], warnings: [] } });
    await productTypeService.addOptions('a b', ['X']);
    expect(client.post.mock.calls[0][0]).toBe('/product-type/fields/a%20b/options');
  });
});
