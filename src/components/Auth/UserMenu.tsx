import { PencilIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';

interface UserMenuProps {
  className?: string;
  onEditTrip?: () => void;
}

export const UserMenu = ({ className = '', onEditTrip }: UserMenuProps) => {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
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
            className="flex min-h-[44px] w-full touch-manipulation items-center gap-2 border-gray-200 border-b px-4 py-2 text-left text-gray-700 text-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
            onClick={() => {
              setIsOpen(false);
              navigate('/trips');
            }}
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
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Trips
          </button>
          {onEditTrip && (
            <button
              className="flex min-h-[44px] w-full touch-manipulation items-center gap-2 border-gray-200 border-b px-4 py-2 text-left text-gray-700 text-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
              onClick={() => {
                setIsOpen(false);
                onEditTrip();
              }}
              type="button"
            >
              <PencilIcon aria-hidden="true" className="h-4 w-4" />
              Edit trip
            </button>
          )}
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
