const CONF_STYLE = {
  High: { text: "text-emerald-700", bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800" },
  Medium: { text: "text-amber-700", bar: "bg-amber-400", chip: "bg-amber-100 text-amber-800" },
  Low: { text: "text-red-700", bar: "bg-red-500", chip: "bg-red-100 text-red-800" },
};

export default function ConfidenceIndicator({ level, score, className = "" }) {
  const s = CONF_STYLE[level] ?? CONF_STYLE.Medium;
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-clinical-500">Decision Confidence</span>
        <span className={`badge ${s.chip}`}>
          {level} · {score}%
        </span>
      </div>
      <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-clinical-100">
        {/* Tick marks */}
        <div className="absolute inset-0 flex items-center justify-between px-[25%]">
          <span className="h-full w-px bg-clinical-200" />
          <span className="h-full w-px bg-clinical-200" />
        </div>
        {/* Fill bar */}
        <div
          className={`h-full rounded-full ${s.bar} animate-barFill`}
          style={{ "--bar-width": `${score}%`, width: `${score}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] text-clinical-400">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
