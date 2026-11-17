export function EventTabSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="h-[360px] animate-pulse rounded-2xl border border-[#e8e6de] bg-white xl:col-span-2" />
      <div className="h-[240px] animate-pulse rounded-2xl border border-[#e8e6de] bg-white" />
    </div>
  );
}