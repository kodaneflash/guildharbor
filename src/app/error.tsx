"use client";
export default function ErrorPage({ reset }: { reset(): void }) {
  return (
    <div className="site-container py-12">
      <section className="surface mx-auto max-w-xl space-y-4 p-7">
        <h1 className="text-heading-xl font-bold">Unable to complete the request</h1>
        <p className="text-text-muted">
          Please try again. If the problem continues, contact the community
          administrator.
        </p>
        <button className="button-primary" onClick={reset}>
          Try again
        </button>
      </section>
    </div>
  );
}
