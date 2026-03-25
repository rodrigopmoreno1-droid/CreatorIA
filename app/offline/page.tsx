export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Offline</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Você está sem conexão</h1>
        <p className="mt-4 text-muted-foreground">
          O ContentOS mantém uma experiência básica offline. Reconecte para sincronizar o workspace.
        </p>
      </div>
    </main>
  );
}
