export default function DemoTestRestaurantPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-6">
      <section className="w-full max-w-3xl rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Prepared demo
            </p>
            <h1 className="text-xl font-semibold text-foreground">
              Targetrestaurant demo placeholder
            </h1>
            <p className="text-sm text-muted-foreground">
              This isolated route proves the targetrestaurant demo can render without the live operator shell,
              socket bootstrap, or action-card rail.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <h2 className="text-base font-semibold text-foreground">Demo-only surface</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Use this route as the safe entry point for future invite, tutorial, and workspace slices.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <h2 className="text-base font-semibold text-foreground">HTTP-first v1</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Slice 0 keeps this page free of live sockets, operator chrome, and Agent Zero dev framing.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
