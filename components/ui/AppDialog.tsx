"use client";

type AppDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  open: boolean;
  title: string;
  variant?: "default" | "error";
};

export function AppDialog({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  description,
  onCancel,
  onConfirm,
  open,
  title,
  variant = "default",
}: AppDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/70"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-[360px] rounded-3xl border border-white/8 bg-surface-dialog p-5 shadow-xl">
        <h3 className="text-4xl font-black text-white">{title}</h3>
        <p className="mt-3 text-lg leading-6 text-[#47493F]">{description}</p>
        <div className="mt-5 flex gap-3">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="app-button app-button-secondary flex-1 font-semibold"
            >
              {cancelLabel}
            </button>
          ) : null}
          {onConfirm ? (
            <button
              type="button"
              onClick={onConfirm}
              className={`app-button flex-1 font-black ${
                variant === "error"
                  ? "bg-[#D22B34] text-[#D22B34]"
                  : "bg-primary-action text-text-on-orange"
              }`}
            >
              {confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
