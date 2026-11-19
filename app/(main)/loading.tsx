export default function Loading() {
  return (
    <div className="flex min-h-[70dvh] flex-col gap-3 p-3" aria-busy="true">
      <div className="h-14 animate-pulse rounded-2xl bg-white/5" />
      <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
      <div className="h-44 animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}
