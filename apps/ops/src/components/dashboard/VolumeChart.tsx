"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type VolumeChartPoint = {
  day: string;
  usdc: number;
  transactions?: number;
};

function formatValue(value: number) {
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} USDC`;
}

function formatTick(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export function VolumeChart({
  points,
}: {
  points: VolumeChartPoint[];
}) {
  const chartPoints = points.length > 0 ? points : [{ day: "Today", usdc: 0 }];
  const values = chartPoints.map((point) => point.usdc);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const domainPadding = range * 0.08;
  const ticks = minValue === maxValue ? [minValue] : [minValue, maxValue];
  const chartAnimationKey = chartPoints.map((point) => `${point.day}:${point.usdc}`).join("|");

  return (
    <div className="relative min-h-[360px] w-full flex-1">
      <div className="absolute left-3 top-1 z-10 text-[11px] font-bold uppercase tracking-wide text-muted">
        USDC
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          key={chartAnimationKey}
          data={chartPoints}
          margin={{ top: 18, right: 18, bottom: 12, left: 8 }}
        >
          <defs>
            <linearGradient id="volume-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#9945FF" stopOpacity={0.28} />
              <stop offset="85%" stopColor="#9945FF" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E3EBF0" strokeDasharray="4 6" vertical={false} />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            interval={2}
            minTickGap={18}
            tick={{ fill: "#64748B", fontSize: 12, fontWeight: 600 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={58}
            tickFormatter={(value) => formatTick(Number(value))}
            tick={{ fill: "#64748B", fontSize: 12, fontWeight: 600 }}
            domain={[minValue - domainPadding, maxValue + domainPadding]}
            ticks={ticks}
            allowDecimals
          />
          <Tooltip
            cursor={{ stroke: "#9945FF", strokeWidth: 1, strokeDasharray: "4 4" }}
            formatter={(value) => [formatValue(Number(value)), "Volume"]}
            labelStyle={{ color: "#0F172A", fontWeight: 700 }}
            contentStyle={{
              border: "1px solid #E3EBF0",
              borderRadius: 10,
              boxShadow: "0 12px 28px -20px rgba(15, 23, 42, 0.45)",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="usdc"
            stroke="#9945FF"
            strokeWidth={3}
            fill="url(#volume-fill)"
            isAnimationActive
            animationBegin={120}
            animationDuration={900}
            animationEasing="ease-out"
            activeDot={{ r: 6, fill: "#9945FF", stroke: "#FFFFFF", strokeWidth: 2 }}
            dot={{ r: 4, fill: "#9945FF", stroke: "#FFFFFF", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
