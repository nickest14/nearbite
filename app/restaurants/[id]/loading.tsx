// 第一次開啟或詳情過期時要等 Google（最多 8 秒），先顯示骨架避免白屏
export default function RestaurantLoading() {
  return (
    <div role="status" aria-label="載入中" className="animate-pulse space-y-5">
      <div className="flex items-start gap-3">
        <span className="size-14 shrink-0 rounded-full bg-border" />
        <div className="flex-1 space-y-2 pt-1">
          <span className="block h-7 w-3/4 rounded bg-border" />
          <span className="block h-4 w-1/2 rounded bg-border" />
        </div>
      </div>
      <span className="block h-11 rounded-card bg-border" />
      <span className="block h-11 rounded-lg bg-border" />
      <span className="block h-4 w-2/3 rounded bg-border" />
      <span className="block h-11 rounded-lg bg-border" />
    </div>
  );
}
