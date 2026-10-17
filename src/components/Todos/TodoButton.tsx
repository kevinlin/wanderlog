import { ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import type { ReactElement, Ref } from 'react';

interface TodoButtonProps {
  count: number;
  isOpen: boolean;
  onClick: () => void;
  // The panel hands focus back here when it closes.
  ref?: Ref<HTMLButtonElement>;
}

// Reading is allowed offline, so unlike the agent button this is never disabled.
export function TodoButton({ count, isOpen, onClick, ref }: TodoButtonProps): ReactElement {
  return (
    <button
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      aria-label={count > 0 ? `To do, ${count} ready` : 'To do'}
      className={`relative flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border px-3 font-medium shadow-lg backdrop-blur-md transition-all focus-visible:outline-2 focus-visible:outline-alpine-teal focus-visible:outline-offset-2 motion-safe:active:scale-95 motion-safe:hover:scale-105 sm:px-4 ${
        isOpen ? 'border-alpine-teal-deep bg-alpine-teal-deep text-white' : 'border-white/30 bg-white/90 text-gray-700 hover:bg-white'
      }`}
      onClick={onClick}
      ref={ref}
      type="button"
    >
      <ClipboardDocumentCheckIcon aria-hidden="true" className="h-5 w-5" />
      <span className="hidden sm:inline">To do</span>
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 font-bold text-gray-900 text-xs shadow-xs"
        >
          {count}
        </span>
      )}
    </button>
  );
}
