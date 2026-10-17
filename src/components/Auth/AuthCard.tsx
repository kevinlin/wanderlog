import type { ReactNode } from 'react';

export const AUTH_INPUT_CLASS =
  'min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-alpine-teal focus:outline-hidden focus:ring-2 focus:ring-alpine-teal/30';
export const AUTH_LABEL_CLASS = 'mb-1 block font-medium text-gray-700 text-sm';
export const FOCUS_RING_CLASS = 'focus-visible:outline-2 focus-visible:outline-alpine-teal focus-visible:outline-offset-2';
// Vertical padding on an inline link grows the tap target to 44px without moving the layout.
export const AUTH_LINK_CLASS = `rounded-sm py-3 font-medium text-alpine-teal-deep text-sm hover:underline ${FOCUS_RING_CLASS}`;

export const AuthCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex min-h-dvh items-center justify-center bg-linear-to-br from-sandy-beige via-white to-lake-blue/30 p-4">
    <div className="w-full max-w-md rounded-xl bg-white/80 p-6 shadow-2xl backdrop-blur sm:p-8">
      <h1 className="mb-1 font-bold text-3xl text-gray-900">{title}</h1>
      {children}
    </div>
  </div>
);

export const Spinner = ({ className = 'border-white' }: { className?: string }) => (
  <span aria-hidden="true" className={`h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${className}`} />
);

export const SubmitButton = ({ isPending, pendingLabel, children }: { isPending: boolean; pendingLabel: string; children: ReactNode }) => (
  <button
    className={`flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-lg bg-alpine-teal-deep px-4 py-2 font-medium text-white transition-colors hover:bg-alpine-teal-deep/90 active:bg-alpine-teal-deep disabled:opacity-50 ${FOCUS_RING_CLASS}`}
    disabled={isPending}
    type="submit"
  >
    {isPending && <Spinner />}
    {isPending ? pendingLabel : children}
  </button>
);

export const FormError = ({ message }: { message: string | null }) =>
  message ? (
    <p className="text-red-600 text-sm" role="alert">
      {message}
    </p>
  ) : null;
