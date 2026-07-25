import { useJsApiLoader } from '@react-google-maps/api';
import { useEffect, useState } from 'react';
import { MAPS_LOADER_OPTIONS } from '@/config/mapsLoader';
import { useImportTrip } from '@/hooks/useTripLibraryMutations';
import { geocodeAddress } from '@/services/geocodingService';
import { detectFormat, type ImportIssue, type ImportPreview, parseTripFile } from '@/services/tripImportService';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type PanelState =
  | { phase: 'idle' }
  | { phase: 'processing' }
  | { phase: 'awaiting-maps'; text: string } // TripIt file, Maps JS not yet loaded
  | { phase: 'preview'; preview: ImportPreview }
  | { phase: 'invalid'; errors: ImportIssue[] };

// Mounted only in the awaiting-maps phase; mounting triggers the Maps JS load.
const MapsGate = ({ onReady }: { onReady: () => void }) => {
  const { isLoaded } = useJsApiLoader(MAPS_LOADER_OPTIONS);
  useEffect(() => {
    if (isLoaded) {
      onReady();
    }
  }, [isLoaded, onReady]);
  return <p className="text-gray-500 text-sm">Loading Google Maps for geocoding…</p>;
};

const isJsonFile = (file: File): boolean => file.name.endsWith('.json') || file.type === 'application/json';

const safeParse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const dateRange = (preview: ImportPreview): string => {
  const froms = preview.tripData.stops.map((stop) => stop.date.from).sort();
  const tos = preview.tripData.stops.map((stop) => stop.date.to).sort();
  return `${froms[0]} – ${tos.at(-1)}`;
};

const FORMAT_LABELS = { wanderlog: 'Wanderlog', tripit: 'TripIt' } as const;

const PreviewPanel = ({ preview }: { preview: ImportPreview }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
    <div className="mb-2 flex items-center gap-2">
      <h3 className="font-semibold text-gray-900">{preview.tripData.trip_name}</h3>
      <span className="rounded-full bg-alpine-teal/10 px-2 py-0.5 font-medium text-alpine-teal text-xs">
        {FORMAT_LABELS[preview.format]}
      </span>
    </div>
    <p className="text-gray-600 text-sm">{dateRange(preview)}</p>
    <p className="text-gray-600 text-sm">Timezone: {preview.tripData.timezone}</p>
    <p className="text-gray-600 text-sm">
      {preview.stopCount} stops · {preview.activityCount} activities
    </p>
    {preview.warnings.length > 0 && (
      <ul className="mt-3 flex flex-col gap-1 rounded-md bg-amber-50 p-3 text-amber-800 text-sm">
        {preview.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    )}
  </div>
);

const ErrorPanel = ({ errors }: { errors: ImportIssue[] }) => (
  <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-4">
    <ul className="flex flex-col gap-1 text-red-700 text-sm">
      {errors.map((issue) => (
        <li key={`${issue.path}:${issue.message}`}>
          <code className="font-mono text-xs">{issue.path}</code>: {issue.message}
        </li>
      ))}
    </ul>
  </div>
);

export const ImportTripPanel = () => {
  const { mutate, isPending, error } = useImportTrip();
  const [state, setState] = useState<PanelState>({ phase: 'idle' });

  const parse = async (text: string) => {
    setState({ phase: 'processing' });
    const result = await parseTripFile(text, geocodeAddress);
    setState(result.ok ? { phase: 'preview', preview: result.preview } : { phase: 'invalid', errors: result.errors });
  };

  const handleFile = async (file: File) => {
    if (!isJsonFile(file)) {
      setState({ phase: 'invalid', errors: [{ path: 'file', message: 'Only JSON files are supported' }] });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setState({ phase: 'invalid', errors: [{ path: 'file', message: 'File is larger than 5 MB' }] });
      return;
    }
    const text = await file.text();
    if (detectFormat(safeParse(text)) === 'tripit' && !window.google?.maps) {
      setState({ phase: 'awaiting-maps', text });
      return;
    }
    await parse(text);
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border-2 border-gray-300 border-dashed bg-white/40 px-4 py-5 text-center transition-colors focus-within:border-alpine-teal hover:border-alpine-teal hover:bg-alpine-teal/5"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) {
            handleFile(file);
          }
        }}
      >
        <label className="block cursor-pointer text-gray-600 text-sm" htmlFor="trip-file-input">
          Drop a Wanderlog or TripIt export (JSON) here, or <span className="font-medium text-gray-700 underline">browse</span>.
        </label>
        <input
          accept=".json,application/json"
          className="sr-only"
          data-testid="trip-file-input"
          id="trip-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              handleFile(file);
            }
            event.target.value = '';
          }}
          type="file"
        />
      </div>

      {state.phase === 'processing' && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-alpine-teal border-t-transparent" />
          Resolving locations…
        </div>
      )}
      {state.phase === 'awaiting-maps' && (
        <MapsGate
          onReady={() => {
            parse(state.text);
          }}
        />
      )}
      {state.phase === 'preview' && <PreviewPanel preview={state.preview} />}
      {state.phase === 'invalid' && <ErrorPanel errors={state.errors} />}

      {error && <p className="text-red-600 text-sm">{error.message}</p>}

      {state.phase === 'preview' && (
        <button
          className="min-h-[44px] rounded-lg bg-alpine-teal px-4 py-2 font-medium text-white transition-colors hover:bg-alpine-teal/90 active:bg-alpine-teal/80 disabled:opacity-50"
          disabled={isPending}
          onClick={() => mutate(state.preview.tripData)}
          type="button"
        >
          {isPending ? 'Importing…' : 'Import trip'}
        </button>
      )}
    </div>
  );
};
