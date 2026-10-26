import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// The demo calendar follows the real date; tests pin it to the base day (Thu 05/15/2025, 10:00)
// so every expected number stays the same. Only Date is faked; timers run normally.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date(2025, 4, 15, 10, 0));
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = '';
});

// jsdom has no matchMedia; default to a light OS preference
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  });
}
