import { Activity, Building2, ChevronDown, ShieldCheck, Wifi, Radio, Menu, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "../store";
import { formatClock, formatDate } from "../lib/format";

export default function Header() {
  const { now, hospitalId, setHospital, hospitals, apiStatus, retryConnect } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const status = {
    checking: {
      dot: "bg-clinical-400",
      ping: false,
      title: "Connecting to decision engine…",
      sub: "Handshaking with FastAPI backend",
      cls: "text-clinical-300",
      onClick: null,
    },
    online: {
      dot: "bg-emerald-400",
      ping: true,
      title: "API connected — decision engine live",
      sub: "Triage, queue & audit served by FastAPI",
      cls: "text-emerald-300",
      onClick: null,
    },
    offline: {
      dot: "bg-amber-400",
      ping: false,
      title: "Offline — local mock engine",
      sub: "FastAPI not running · click to retry",
      cls: "text-amber-300",
      onClick: retryConnect,
    },
  }[apiStatus] ?? { dot: "bg-clinical-400", ping: false, title: "Connecting…", sub: "", cls: "text-clinical-300", onClick: null };

  return (
    <header className="sticky top-0 z-40 border-b border-clinical-800 bg-gradient-to-r from-clinical-950 via-clinical-950 to-clinical-900 text-white shadow-lg">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 lg:gap-6 lg:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-clinical-600 shadow-md ring-2 ring-clinical-500/20">
            <Activity size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight lg:text-lg">PatientTriage.ai</span>
              <span className="badge bg-clinical-800/80 text-[10px] text-clinical-300 backdrop-blur-sm">HACKATHON DEMO</span>
            </div>
            <div className="hidden text-[11px] font-medium text-clinical-400 sm:block">
              AI-Assisted Clinical Decision Support
            </div>
          </div>
        </div>

        {/* Hospital selector */}
        <div className="ml-1 hidden items-center gap-2 md:flex">
          <Building2 size={15} className="text-clinical-500" />
          <div className="relative">
            <select
              value={hospitalId}
              onChange={(e) => setHospital(e.target.value)}
              aria-label="Select hospital"
              className="appearance-none rounded-lg border border-clinical-700/60 bg-clinical-900/80 py-1.5 pl-3 pr-8 text-sm font-medium text-clinical-200 outline-none transition-all focus:border-clinical-500 focus:ring-2 focus:ring-clinical-500/30"
            >
              {Object.values(hospitals).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} — {h.type}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-clinical-500" />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4 lg:gap-5">
          {/* System status */}
          <button
            type="button"
            onClick={status.onClick}
            disabled={!status.onClick}
            className="hidden items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-clinical-800/40 lg:flex"
            title={status.title}
          >
            <span className="relative flex h-2.5 w-2.5">
              {status.ping && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${status.dot}`} />
            </span>
            <div className="leading-tight">
              <div className={`text-xs font-semibold ${status.cls}`}>{status.title}</div>
              <div className="flex items-center gap-1 text-[10px] text-clinical-500">
                <Wifi size={10} /> {status.sub}
              </div>
            </div>
          </button>

          {/* Clock */}
          <div className="text-right leading-tight">
            <div className="font-mono text-lg font-bold tabular-nums tracking-tight">
              {formatClock(now)}
            </div>
            <div className="text-[10px] font-medium text-clinical-500">{formatDate(now)}</div>
          </div>

          {/* Safety banner */}
          <div className="hidden items-center gap-2.5 rounded-lg border border-clinical-700/50 bg-clinical-900/60 px-3 py-2 xl:flex">
            <ShieldCheck size={16} className="text-emerald-400" />
            <div className="text-[11px] leading-tight text-clinical-400">
              <div className="font-semibold text-emerald-300">Clinician in the loop</div>
              <div>Every recommendation is reviewable &amp; overridable</div>
            </div>
          </div>

          {/* Live monitoring pill */}
          <div className="hidden items-center gap-2 rounded-lg border border-clinical-700/50 bg-clinical-900/60 px-3 py-2 sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulseDot rounded-full bg-emerald-400" />
            </span>
            <div className="text-[11px] font-semibold text-clinical-400">Live monitoring</div>
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-1.5 text-clinical-400 hover:bg-clinical-800 hover:text-white md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="animate-fadeIn border-t border-clinical-800 bg-clinical-950 px-4 pb-4 pt-3 md:hidden">
          <div className="space-y-3">
            {/* Hospital selector */}
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-clinical-500">Hospital</div>
              <select
                value={hospitalId}
                onChange={(e) => { setHospital(e.target.value); setMobileOpen(false); }}
                className="w-full appearance-none rounded-lg border border-clinical-700 bg-clinical-900 px-3 py-2 text-sm text-clinical-200"
              >
                {Object.values(hospitals).map((h) => (
                  <option key={h.id} value={h.id}>{h.name} — {h.type}</option>
                ))}
              </select>
            </div>
            {/* Status */}
            <button
              onClick={status.onClick}
              disabled={!status.onClick}
              className="flex w-full items-center gap-2 rounded-lg bg-clinical-900/60 px-3 py-2 text-left"
            >
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${status.dot}`} />
              <div className="leading-tight">
                <div className={`text-xs font-semibold ${status.cls}`}>{status.title}</div>
                <div className="text-[10px] text-clinical-500">{status.sub}</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
