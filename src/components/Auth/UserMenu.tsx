import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UserMenuProps {
  className?: string;
}

export const UserMenu = ({ className = '' }: UserMenuProps) => {
  const { session, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const email = session?.user?.email ?? '';
  const initial = email.charAt(0).toUpperCase() || '?';

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      // The auth listener nulls the session and ProtectedRoute redirects to /login
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className={`fixed top-2 right-2 z-30 sm:top-4 ${className}`} ref={menuRef}>
      {isOpen && (
        <div className="absolute top-12 right-0 w-56 overflow-hidden rounded-xl border border-white/30 bg-white/90 shadow-lg backdrop-blur-md">
          <div className="truncate border-gray-200 border-b px-4 py-3 text-gray-700 text-sm" title={email}>
            {email}
          </div>
          <button
            className="flex min-h-[44px] w-full touch-manipulation items-center gap-2 px-4 py-2 text-left text-red-600 text-sm transition-colors hover:bg-red-50 active:bg-red-100 disabled:opacity-50"
            disabled={isSigningOut}
            onClick={handleSignOut}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-7.5A2.25 2.25 0 0 0 3.75 5.25v13.5A2.25 2.25 0 0 0 6 21h7.5a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
      <button
        aria-expanded={isOpen}
        aria-label="User menu"
        className={`flex h-10 w-10 items-center justify-center rounded-xl border font-semibold shadow-lg backdrop-blur-md transition-all hover:scale-105 active:scale-95 ${
          isOpen ? 'border-alpine-teal bg-alpine-teal text-white' : 'border-white/30 bg-white/90 text-gray-700 hover:bg-white'
        }`}
        onClick={() => setIsOpen((prev) => !prev)}
        title={email}
        type="button"
      >
        {initial}
      </button>
    </div>
  );
};
