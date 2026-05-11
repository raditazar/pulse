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
import { type DisplayCurrency, volumeChart } from "@/lib/mock-data";

const valueKey: Record<DisplayCurrency, "usd" | "sol"> = {
  USD: "usd",
  SOL: "sol",
};

function formatValue(value: number, currency: DisplayCurrency) {
  if (currency === "USD") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} SOL`;
}

export function VolumeChart({ currency = "USD" }: { currency?: DisplayCurrency }) {
  const key = valueKey[currency];
  const values = volumeChart.points.map((point) => point[key]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const domainPadding = range * 0.08;
  const ticks = [minValue, maxValue];

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={volumeChart.points}
          margin={{ top: 18, right: 18, bottom: 12, left: 12 }}
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
            width={72}
            tickFormatter={(value) => formatValue(Number(value), currency)}
            tick={{ fill: "#64748B", fontSize: 12, fontWeight: 600 }}
            domain={[minValue - domainPadding, maxValue + domainPadding]}
            ticks={ticks}
            allowDecimals
          />
          <Tooltip
            cursor={{ stroke: "#9945FF", strokeWidth: 1, strokeDasharray: "4 4" }}
            formatter={(value) => [formatValue(Number(value), currency), "Volume"]}
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
            dataKey={key}
            stroke="#9945FF"
            strokeWidth={3}
            fill="url(#volume-fill)"
            activeDot={{ r: 6, fill: "#9945FF", stroke: "#FFFFFF", strokeWidth: 2 }}
            dot={{ r: 4, fill: "#9945FF", stroke: "#FFFFFF", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
