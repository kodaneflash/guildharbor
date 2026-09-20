import Link from "next/link";

export default function NotFound() {
  return (
    <div className="site-container grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <p className="text-body-sm font-bold uppercase tracking-[0.14em] text-category">404</p>
        <h1 className="mt-3 text-display-sm font-extrabold text-text">That page has left the harbor.</h1>
        <p className="mx-auto mt-3 max-w-md text-body-sm leading-6 text-text-muted">The link may be outdated, private, or removed.</p>
        <Link href="/forums" className="button-primary mt-6">Browse forums</Link>
      </div>
    </div>
  );
}
