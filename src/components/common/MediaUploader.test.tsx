import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaItem, MediaUploader } from './MediaUploader';
import { resolveAssetUrl } from '../../utils/assetUrl';

const png = (name = 'a.png', size = 100) => new File([new Uint8Array(size)], name, { type: 'image/png' });

const Harness: React.FC<{ upload: any; max?: number; initial?: MediaItem[] }> = ({ upload, max, initial = [] }) => {
  const [value, setValue] = useState<MediaItem[]>(initial);
  return (
    <>
      <MediaUploader value={value} onChange={setValue} upload={upload} max={max} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
};

const valueOf = () => JSON.parse(screen.getByTestId('value').textContent || '[]');

describe('MediaUploader', () => {
  it('stores the server URL, never a blob URL', async () => {
    const upload = vi.fn().mockResolvedValue({ url: '/uploads/media/2026/09/x.png', kind: 'image', size_bytes: 100, mime_type: 'image/png' });
    render(<Harness upload={upload} />);
    await userEvent.upload(screen.getByTestId('media-uploader-input'), png());
    await waitFor(() => expect(valueOf()).toEqual([{ url: '/uploads/media/2026/09/x.png', kind: 'image' }]));
    expect(screen.getByRole('img')).toHaveAttribute('src', 'http://api.test/uploads/media/2026/09/x.png');
    expect(JSON.stringify(valueOf())).not.toContain('blob:');
  });

  it('rejects a disallowed type before uploading', async () => {
    const upload = vi.fn();
    render(<Harness upload={upload} />);
    const exe = new File(['MZ'], 'tool.exe', { type: 'application/x-msdownload' });
    await userEvent.upload(screen.getByTestId('media-uploader-input'), exe, { applyAccept: false });
    expect(upload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Unsupported file type/);
  });

  it('rejects an image over 10 MB before uploading', async () => {
    const upload = vi.fn();
    render(<Harness upload={upload} />);
    await userEvent.upload(screen.getByTestId('media-uploader-input'), png('big.png', 10 * 1024 * 1024 + 1));
    expect(upload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/at most 10 MB/);
  });

  it('shows the server error and adds nothing when the upload fails', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('You do not have permission to perform this action'));
    render(<Harness upload={upload} />);
    await userEvent.upload(screen.getByTestId('media-uploader-input'), png());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/permission/));
    expect(valueOf()).toEqual([]);
  });

  it('removes an item', async () => {
    render(<Harness upload={vi.fn()} initial={[{ url: '/uploads/a.png', kind: 'image' }]} />);
    await userEvent.click(screen.getByRole('button', { name: /Remove media 1/ }));
    expect(valueOf()).toEqual([]);
  });

  it('respects max and hides the add button at the limit', async () => {
    const upload = vi.fn().mockResolvedValue({ url: '/uploads/b.png', kind: 'image', size_bytes: 1, mime_type: 'image/png' });
    render(<Harness upload={upload} max={1} />);
    await userEvent.upload(screen.getByTestId('media-uploader-input'), png());
    await waitFor(() => expect(valueOf()).toHaveLength(1));
    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument();
  });
});

describe('resolveAssetUrl', () => {
  it('resolves server-relative URLs against the API origin', () =>
    expect(resolveAssetUrl('/uploads/a.png')).toBe('http://api.test/uploads/a.png'));
  it('passes absolute and data URLs through', () => {
    expect(resolveAssetUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(resolveAssetUrl('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
  });
  it('refuses blob URLs', () => expect(resolveAssetUrl('blob:http://localhost/abc')).toBeUndefined());
  it('handles empty values', () => expect(resolveAssetUrl(undefined)).toBeUndefined());
});
