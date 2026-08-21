"use client";

interface ComplianceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingItems: string[];
}

export function ComplianceAlertModal({
  isOpen,
  onClose,
  missingItems,
}: ComplianceAlertModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-primary/50" onClick={onClose} />
      <div className="relative w-full max-w-[425px] rounded-xl border bg-white shadow-lg">
        <div className="flex items-center justify-between bg-primary px-5 py-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            Compliance Requirements Unmet
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="text-white hover:text-white/70"
            onClick={onClose}
          >
            X
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-500 mb-4">
            The candidate cannot be moved to the <strong>Hired</strong> stage because the following compliance items are missing or expired:
          </p>
          <ul className="list-disc pl-5 text-sm font-medium text-slate-800 space-y-1">
            {missingItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button
            type="button"
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            onClick={onClose}
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}