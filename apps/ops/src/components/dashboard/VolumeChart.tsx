import { type DisplayCurrency, volumeChart } from "@/lib/mock-data";

export function VolumeChart({ currency = "USD" }: { currency?: DisplayCurrency }) {
  const points = volumeChart.points;
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const polygon = `40,90 ${polyline} 460,90`;

  return (
    <svg
      viewBox="0 0 460 110"
      preserveAspectRatio="none"
      className="block h-[160px] w-full sm:h-[200px]"
      role="img"
      aria-label="Daily volume for the last 7 days"
    >
      <defs>
        <linearGradient id="grad-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#9945FF" stopOpacity="0.25" />
          <stop offset="1" stopColor="#9945FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="40" y1="20" x2="460" y2="20" stroke="#E3EBF0" strokeDasharray="3 3" />
      <line x1="40" y1="55" x2="460" y2="55" stroke="#E3EBF0" strokeDasharray="3 3" />
      <line x1="40" y1="90" x2="460" y2="90" stroke="#E3EBF0" strokeDasharray="3 3" />
      {volumeChart.yTicks[currency].map((t, i) => (
        <text key={t} x="6" y={24 + i * 35} fontSize="9" fill="#64748B">
          {t}
        </text>
      ))}
      <polygon points={polygon} fill="url(#grad-area)" />
      <polyline
        points={polyline}
        fill="none"
        stroke="#9945FF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p) => (
        <circle key={p.day} cx={p.x} cy={p.y} r="3" fill="#9945FF" />
      ))}
      {points.map((p) => (
        <text
          key={`l-${p.day}`}
          x={p.x - 4}
          y="106"
          fontSize="9"
          fill="#64748B"
          fontFamily="Plus Jakarta Sans"
        >
          {p.day}
        </text>
      ))}
    </svg>
  );
}
