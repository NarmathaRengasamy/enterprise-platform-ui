import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/* Vitest runs without globals here, so Testing Library cannot register its own
   cleanup — unmount every render after each test explicitly. */
afterEach(() => cleanup());
