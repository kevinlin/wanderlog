import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};

  return {
    getItem: (key: string) => {
      return store[key] || null;
    },
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    length: Object.keys(store).length,
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock URL.createObjectURL for export testing
Object.defineProperty(URL, 'createObjectURL', {
  value: () => 'mocked-url',
});

Object.defineProperty(URL, 'revokeObjectURL', {
  value: () => {},
});

// Mock console.warn to avoid clutter in test output
global.console = {
  ...console,
  warn: vi.fn(),
};

// Mock fetch for testing
global.fetch = vi.fn();
