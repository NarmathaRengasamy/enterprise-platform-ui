import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MediaItem, MediaUploader } from '../src/components/common/MediaUploader';

/**
 * Test-only harness for MediaUploader.
 *
 * Keeps the uploaded items in localStorage to stand in for "saved on a record",
 * so the E2E test can reload and prove the stored URL still serves the file.
 */
const KEY = 'e2e-media-items';

const Harness: React.FC = () => {
  const [items, setItems] = useState<MediaItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  return (
    <main style={{ padding: 24 }}>
      <MediaUploader value={items} onChange={setItems} accept={['image', 'video']} label="Product media" />
      <pre data-testid="stored">{JSON.stringify(items)}</pre>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<Harness />);
