export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-6 py-12 text-center">
      <div className="max-w-xl rounded-card border border-border bg-surface p-8 panel-shadow">
        <h1 className="text-2xl font-extrabold text-text">Pulse Checkout</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Open a payment session link from the merchant dashboard or NFC sticker
          to launch checkout.
        </p>
        <p className="mt-4 rounded-control border border-border bg-bg-soft px-4 py-3 text-xs text-muted">
          Expected route: <span className="font-semibold text-text">/pay/&lt;sessionPda&gt;</span>
        </p>
      </div>
    </main>
  );
}
