interface ConfirmDialogProps {
  confirmLabel: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}

export const ConfirmDialog = ({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) => {
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleBackdropClick}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="font-bold text-gray-900 text-lg">{title}</h2>
        <p className="mt-2 text-gray-600 text-sm">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
