export default function Loading() {
  return (
    <div className="site-container animate-pulse space-y-3 py-10" aria-label="Loading content">
      <div className="h-20 rounded-md bg-panel" />
      <div className="h-20 rounded-md bg-panel" />
      <div className="mt-8 h-14 rounded-md bg-panel" />
      {Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-20 rounded-md bg-panel" />)}
    </div>
  );
}
