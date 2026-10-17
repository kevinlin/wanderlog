import { type ReactElement, type ReactNode, useCallback, useRef, useState } from 'react';
import { useTripToday } from '@/hooks/useTripToday';
import type { TripData } from '@/types/trip';
import { countActiveTodos } from '@/utils/todoUtils';
import { TodoButton } from './TodoButton';
import { TodoPanel } from './TodoPanel';

interface TodoControlsProps {
  // Whatever shares the corner with the button (the agent button).
  children?: ReactNode;
  tripData: TripData;
  // Passed in rather than read off tripData: that field is optional, and an
  // empty one would aim every write at the wrong query key.
  tripId: string;
}

// The button, the badge and the panel it opens, for both TripPage views. One
// hook call supplies "today" to the count and the list, so they cannot disagree.
export function TodoControls({ children, tripData, tripId }: TodoControlsProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const today = useTripToday(tripData.timezone);
  const count = countActiveTodos(tripData.todos, today, tripData.end_date);

  const close = useCallback(() => {
    setIsOpen(false);
    buttonRef.current?.focus();
  }, []);

  return (
    <>
      {/* One fixed container for the button and its neighbour, left of the user
          menu, so they never overlap at narrow widths. Centred on the 40px user
          menu: the 44px button sits 2px higher than the menu's top edge.
          Named so it keeps floating above the timeline snapshot during the stop page-turn. */}
      <div className="fixed top-1.5 right-14 z-30 flex items-center gap-2 sm:top-3.5" style={{ viewTransitionName: 'top-actions' }}>
        <TodoButton count={count} isOpen={isOpen} onClick={() => (isOpen ? close() : setIsOpen(true))} ref={buttonRef} />
        {children}
      </div>
      {isOpen && <TodoPanel onClose={close} today={today} tripData={tripData} tripId={tripId} />}
    </>
  );
}
