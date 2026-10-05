import { client } from './client';

/** What `POST /media` returns. `url` is server-relative (`/uploads/media/...`). */
export interface UploadedMedia {
  url: string;
  kind: 'image' | 'video';
  size_bytes: number;
  mime_type: string;
}

export const MEDIA_LIMITS = {
  image: { types: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 10 * 1024 * 1024 },
  video: { types: ['video/mp4', 'video/quicktime'], maxBytes: 60 * 1024 * 1024 },
} as const;

/**
 * Checks a file against the same rules the server enforces, so the user hears
 * about a 15 MB photo before waiting for the upload. The server still decides.
 */
export const checkMediaFile = (file: File, accept: Array<'image' | 'video'>): string | null => {
  for (const kind of accept) {
    const rule = MEDIA_LIMITS[kind];
    if ((rule.types as readonly string[]).includes(file.type)) {
      return file.size > rule.maxBytes
        ? `${kind === 'image' ? 'Images' : 'Videos'} can be at most ${rule.maxBytes / (1024 * 1024)} MB`
        : null;
    }
  }
  const allowed = accept.map((k) => (k === 'image' ? 'PNG, JPEG, WEBP' : 'MP4, MOV')).join(' or ');
  return `Unsupported file type — use ${allowed}`;
};

export const mediaService = {
  async upload(file: File): Promise<UploadedMedia> {
    const form = new FormData();
    form.append('file', file);
    const res = await client.post<UploadedMedia>('/media', form);
    if (!res.data) throw new Error(res.message || 'Upload failed');
    return res.data;
  },
};
