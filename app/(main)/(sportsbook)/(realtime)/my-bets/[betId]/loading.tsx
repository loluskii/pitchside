export default function BetHistoryDetailLoading() {
  return (
    <div className="space-y-4 pb-8">
      <div className="h-10 w-24 animate-pulse rounded-full bg-white/5" />
      <div className="h-[260px] animate-pulse rounded-3xl bg-white/5" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`bet-history-detail-loading-${index}`} className="h-[124px] animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
