export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-muted/60" />
        <div className="h-6 w-64 rounded bg-muted/60" />
        <div className="h-4 w-48 rounded bg-muted/50" />
      </div>
      <div className="h-10 w-full rounded-full bg-muted/40" />
      <div className="h-[60vh] w-full rounded-3xl bg-muted/30" />
    </div>
  );
}
