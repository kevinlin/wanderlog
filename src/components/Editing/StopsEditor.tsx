import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bars3Icon, ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import { StopFormModal } from '@/components/Editing/StopFormModal';
import { ConfirmDialog } from '@/components/Layout/ConfirmDialog';
import { useApplyStopStructure, useCreateStop, useDeleteStop, useUpdateStop } from '@/hooks/useTripMutations';
import type { StopInput } from '@/services/supabaseService';
import type { TripBase, TripData } from '@/types/trip';
import { recalculateStopDates } from '@/utils/stopDateUtils';

interface StopsEditorProps {
  onClose: () => void;
  tripData: TripData;
}

const formatRange = (from: string, to: string): string => `${format(parseISO(from), 'd MMM')} – ${format(parseISO(to), 'd MMM yyyy')}`;

interface StopRowProps {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
  stop: TripBase;
}

const StopRow = ({ stop, index, isFirst, isLast, onEdit, onDelete, onMove }: StopRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.stop_id });

  return (
    <li
      className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 ${isDragging ? 'opacity-60 shadow-lg' : ''}`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span
        aria-label={`Drag to reorder ${stop.name}`}
        className="cursor-grab touch-none p-1 text-gray-400 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <Bars3Icon className="h-4 w-4" />
      </span>
      <span className="w-5 shrink-0 text-center font-semibold text-gray-400 text-sm">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900 text-sm">{stop.name}</p>
        <p className="text-gray-500 text-xs">{formatRange(stop.date.from, stop.date.to)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          aria-label={`Move ${stop.name} up`}
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
          disabled={isFirst}
          onClick={() => onMove(-1)}
          type="button"
        >
          <ChevronUpIcon className="h-4 w-4" />
        </button>
        <button
          aria-label={`Move ${stop.name} down`}
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
          disabled={isLast}
          onClick={() => onMove(1)}
          type="button"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
        <button
          aria-label={`Edit ${stop.name}`}
          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-alpine-teal/10 hover:text-alpine-teal"
          onClick={onEdit}
          type="button"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        <button
          aria-label={`Delete ${stop.name}`}
          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-600"
          onClick={onDelete}
          type="button"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
};

export const StopsEditor = ({ tripData, onClose }: StopsEditorProps) => {
  const tripId = tripData.trip_id ?? '';
  const createMutation = useCreateStop(tripId);
  const updateMutation = useUpdateStop(tripId);
  const deleteMutation = useDeleteStop(tripId);
  const applyMutation = useApplyStopStructure(tripId);

  // Staged order of stop ids; content always mirrors the live cache so
  // immediate mutations (add/edit/delete) show through while the order and
  // the cascaded dates stay local until Save.
  const [order, setOrder] = useState<string[]>(() => tripData.stops.map((stop) => stop.stop_id));
  const [isDirty, setIsDirty] = useState(false);
  const [stopModal, setStopModal] = useState<{ mode: 'create' } | { mode: 'edit'; stop: TripBase } | null>(null);
  const [stopPendingDelete, setStopPendingDelete] = useState<TripBase | null>(null);

  // Cache changes (creates/deletes settled elsewhere) are merged into the
  // staged order: unknown ids append, removed ids drop out.
  const cacheIds = tripData.stops.map((stop) => stop.stop_id);
  const effectiveOrder = [...order.filter((id) => cacheIds.includes(id)), ...cacheIds.filter((id) => !order.includes(id))];

  // Anchor is fixed at the trip's start when the editor opens, so deleting or
  // reordering the first stop keeps the whole chain starting on the same day.
  const [anchorDate] = useState(() => tripData.stops[0]?.date.from ?? '');

  // The preview chain: staged order, dates cascaded from the anchor.
  const previewStops = useMemo(() => {
    const byId = new Map(tripData.stops.map((stop) => [stop.stop_id, stop]));
    const ordered = effectiveOrder.map((id) => byId.get(id)).filter((stop): stop is TripBase => stop !== undefined);
    if (!isDirty) {
      return ordered;
    }
    return recalculateStopDates(ordered, anchorDate || (ordered[0]?.date.from ?? ''));
  }, [tripData.stops, effectiveOrder, isDirty, anchorDate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const moveStop = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= effectiveOrder.length) {
      return;
    }
    setOrder(arrayMove(effectiveOrder, fromIndex, toIndex));
    setIsDirty(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      moveStop(effectiveOrder.indexOf(String(active.id)), effectiveOrder.indexOf(String(over.id)));
    }
  };

  const handleFormSubmit = (input: StopInput) => {
    if (stopModal?.mode === 'edit') {
      updateMutation.mutate(
        { stopId: stopModal.stop.stop_id, patch: input },
        {
          onSuccess: () => {
            setIsDirty(true); // date edits re-cascade the chain
            setStopModal(null);
          },
        }
      );
    } else {
      createMutation.mutate(
        { sortOrder: effectiveOrder.length, tempId: crypto.randomUUID(), input },
        { onSuccess: () => setStopModal(null) }
      );
    }
  };

  const handleSave = () => {
    if (previewStops.length === 0) {
      return;
    }
    applyMutation.mutate(
      {
        stops: previewStops,
        tripStartDate: previewStops[0].date.from,
        tripEndDate: previewStops.at(-1)?.date.to ?? previewStops[0].date.to,
      },
      { onSuccess: onClose }
    );
  };

  const searchLocation = tripData.stops[0]?.location ?? { lat: 0, lng: 0 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-gray-200 border-b px-6 py-4">
          <h2 className="font-bold text-gray-900 text-xl">Edit stops</h2>
          <button
            aria-label="Close"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
            type="button"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isDirty && (
            <p className="mb-3 rounded-lg bg-alpine-teal/10 px-3 py-2 text-alpine-teal text-xs">
              Dates below preview the cascade: each stop keeps its nights and the chain re-anchors at {anchorDate}. Saving updates the
              trip's date span.
            </p>
          )}
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
            <SortableContext items={effectiveOrder} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {previewStops.map((stop, index) => (
                  <StopRow
                    index={index}
                    isFirst={index === 0}
                    isLast={index === previewStops.length - 1}
                    key={stop.stop_id}
                    onDelete={() => setStopPendingDelete(stop)}
                    onEdit={() => setStopModal({ mode: 'edit', stop })}
                    onMove={(direction) => moveStop(index, index + direction)}
                    stop={stop}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <button
            className="mt-3 flex min-h-[36px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-alpine-teal/40 border-dashed bg-alpine-teal/5 px-4 py-2 font-medium text-alpine-teal text-sm transition-all duration-200 hover:bg-alpine-teal/10"
            onClick={() => setStopModal({ mode: 'create' })}
            type="button"
          >
            <PlusIcon className="h-4 w-4" />
            Add stop
          </button>
        </div>

        <div className="border-gray-200 border-t px-6 py-4">
          {applyMutation.error && <p className="mb-3 text-red-600 text-sm">{applyMutation.error.message}</p>}
          <div className="flex justify-end gap-3">
            <button
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-alpine-teal px-4 py-2 font-medium text-white transition-colors hover:bg-alpine-teal/90 disabled:opacity-50"
              disabled={!isDirty || applyMutation.isPending || previewStops.length === 0}
              onClick={handleSave}
              type="button"
            >
              {applyMutation.isPending ? 'Saving…' : 'Save order & dates'}
            </button>
          </div>
        </div>
      </div>

      {stopModal && (
        <StopFormModal
          error={stopModal.mode === 'edit' ? updateMutation.error?.message : createMutation.error?.message}
          isPending={stopModal.mode === 'edit' ? updateMutation.isPending : createMutation.isPending}
          key={stopModal.mode === 'edit' ? stopModal.stop.stop_id : 'create'}
          onClose={() => setStopModal(null)}
          onSubmit={handleFormSubmit}
          searchLocation={searchLocation}
          stop={stopModal.mode === 'edit' ? stopModal.stop : undefined}
        />
      )}

      {stopPendingDelete && (
        <ConfirmDialog
          confirmLabel="Delete"
          message={`Delete '${stopPendingDelete.name}'? Its accommodation, activities and waypoints go with it. This cannot be undone.`}
          onCancel={() => setStopPendingDelete(null)}
          onConfirm={() => {
            deleteMutation.mutate({ stopId: stopPendingDelete.stop_id });
            setStopPendingDelete(null);
            setIsDirty(true); // the remaining chain re-cascades
          }}
          title="Delete stop"
        />
      )}
    </div>
  );
};
