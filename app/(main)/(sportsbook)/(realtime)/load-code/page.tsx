import { ScanLine } from "lucide-react";
import { BookingCodeBar } from "@/components/layout/BookingCodeBar";

export default function LoadCodePage() {
  return (
    <div className="space-y-4 px-3 py-4 pb-8">
      <section className="overflow-hidden rounded-3xl border border-border-dark bg-surface-input p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-4xl font-black text-white">Load code</h1>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-icon text-text-blue shadow-lg">
            <ScanLine size={20} />
          </span>
        </div>
      </section>

      <BookingCodeBar />
    </div>
  );
}
