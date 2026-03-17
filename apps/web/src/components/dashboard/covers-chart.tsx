"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartData = [
  { day: "Mon", riverNorth: 186, westLoop: 142, fultonMarket: 98 },
  { day: "Tue", riverNorth: 205, westLoop: 158, fultonMarket: 112 },
  { day: "Wed", riverNorth: 237, westLoop: 169, fultonMarket: 125 },
  { day: "Thu", riverNorth: 273, westLoop: 194, fultonMarket: 138 },
  { day: "Fri", riverNorth: 309, westLoop: 234, fultonMarket: 167 },
  { day: "Sat", riverNorth: 340, westLoop: 258, fultonMarket: 189 },
  { day: "Sun", riverNorth: 278, westLoop: 210, fultonMarket: 154 },
];

const chartConfig = {
  riverNorth: {
    label: "River North",
    color: "var(--color-chart-1)",
  },
  westLoop: {
    label: "West Loop",
    color: "var(--color-chart-2)",
  },
  fultonMarket: {
    label: "Fulton Market",
    color: "var(--color-chart-3)",
  },
} satisfies ChartConfig;

export function CoversChart() {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
      <BarChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="riverNorth"
          fill="var(--color-riverNorth)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="westLoop"
          fill="var(--color-westLoop)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="fultonMarket"
          fill="var(--color-fultonMarket)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
