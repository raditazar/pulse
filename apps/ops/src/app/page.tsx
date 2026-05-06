import { Button } from "@pulse/ui";

const cards = [
  { label: "Active merchants", value: "12" },
  { label: "Today's settlements", value: "84" },
  { label: "Average split", value: "90 / 10" },
];

export default function OpsHomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-16">
      <section className="flex items-end justify-between gap-6">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Pulse Ops</p>
          <h1 className="text-5xl font-semibold tracking-tight">Merchant dashboard starter.</h1>
          <p className="max-w-2xl text-lg text-slate-600">
            This app will manage merchant settings, NFC tags, and settlement history.
          </p>
        </div>
        <Button>New Merchant</Button>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <article key={card.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold">{card.value}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

