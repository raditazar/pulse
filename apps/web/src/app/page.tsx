import { Button } from "@pulse/ui";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-6 px-6 py-16">
      <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70">
        Pulse Consumer PWA
      </div>
      <section className="space-y-4">
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight">
          Solana checkout opened from a single NFC tap.
        </h1>
        <p className="max-w-2xl text-lg text-white/70">
          This app will become the consumer-facing checkout flow for merchant sessions,
          wallet connection, and split-payment approval.
        </p>
      </section>
      <div className="flex gap-3">
        <Button>Connect Wallet</Button>
        <Button variant="ghost">Load Session</Button>
      </div>
    </main>
  );
}

