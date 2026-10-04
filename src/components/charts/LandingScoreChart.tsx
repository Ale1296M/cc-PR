import { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const scoreData = [
  { day: 6, score: 2.5 },
  { day: 7, score: 3.2 },
  { day: 8, score: 4.1 },
  { day: 9, score: 4.8 },
  { day: 10, score: 4.5 },
  { day: 11, score: 3.7 },
];

export default function ScoreChart() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={inView ? scoreData : []}
          margin={{ top: 4, right: 8, bottom: 0, left: -24 }}
        >
          <XAxis
            dataKey="day"
            type="number"
            domain={[6, 11]}
            ticks={[6, 7, 8, 9, 10, 11]}
            tick={{ fontSize: 10, fill: "rgba(249,246,240,0.35)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[1, 5]}
            tick={{ fontSize: 10, fill: "rgba(249,246,240,0.35)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(20,56,36,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              fontSize: "12px",
              color: "#F9F6F0",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
            cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#DDA735"
            strokeWidth={2.5}
            dot={{ fill: "#DDA735", r: 4, strokeWidth: 0 }}
            activeDot={{ fill: "#DDA735", r: 6, stroke: "#F9F6F0", strokeWidth: 2 }}
            isAnimationActive={inView}
            animationBegin={0}
            animationDuration={1500}
            animationEasing="linear"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
