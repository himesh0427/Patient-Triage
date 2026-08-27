import { ESI_META } from "../lib/esi";

const DOT_COLORS = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-amber-400",
  4: "bg-blue-500",
  5: "bg-green-500",
};

export default function EsiBadge({ level, variant = "soft", size = "md", showLabel = false, className = "" }) {
  const meta = ESI_META[level] ?? ESI_META[5];
  const sizeCls = size === "lg" ? "px-3 py-1 text-sm" : size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs";
  const cls =
    variant === "solid"
      ? `${meta.bg} text-white shadow-sm`
      : meta.chip;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md font-extrabold tracking-wide ${sizeCls} ${cls} ${className}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT_COLORS[level] ?? "bg-gray-400"}`} />
      ESI {level}
      {showLabel && <span className="font-semibold normal-case tracking-normal">· {meta.label}</span>}
    </span>
  );
}
