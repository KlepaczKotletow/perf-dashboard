import { cn } from "@/lib/utils";

// The founder-loved hero artifact: a faithful, decorative reproduction of the
// real Analytics dashboard (browser chrome → sidebar → KPIs → charts →
// ranking → per-dept bars). Extracted verbatim from the landing hero so it can
// be reused as proof on /compare and /about and as the bento "Analytics" tile.
// Decorative only — aria-hidden; the surrounding copy carries the meaning.
export function DashboardMockup({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-white shadow-2xl shadow-primary/10",
        className,
      )}
    >
      {/* Browser chrome */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-muted/80 px-4 py-2">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
          <div className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <div className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        </div>
        <div className="flex-1 rounded-md bg-background/70 px-3 py-1 font-mono text-[10px] text-muted-foreground">
          namihr.com/dashboard/analytics
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — matches real app */}
        <div className="hidden w-[140px] shrink-0 flex-col gap-0.5 overflow-hidden border-r border-border/60 bg-muted/20 p-2.5 sm:flex">
          <div className="mb-1 px-2 py-1.5">
            <span className="text-[11px] font-bold text-foreground">Nami</span>
            <span
              className="block text-[7px] italic text-muted-foreground/50"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Powered by Nami
            </span>
          </div>
          {[
            { label: "Home" },
            { label: "Performance" },
            { label: "Goals" },
            { label: "Kudos" },
          ].map((item) => (
            <div key={item.label} className="rounded-md px-2 py-1 text-[10px] text-muted-foreground">
              {item.label}
            </div>
          ))}
          <p className="mt-2 mb-0.5 px-2 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Team
          </p>
          {[{ label: "My Team" }, { label: "Reviews" }].map((item) => (
            <div key={item.label} className="rounded-md px-2 py-1 text-[10px] text-muted-foreground">
              {item.label}
            </div>
          ))}
          <p className="mt-2 mb-0.5 px-2 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Admin
          </p>
          {[
            { label: "Cycles", active: false },
            { label: "Directory", active: false },
            { label: "Surveys", active: false },
            { label: "Templates", active: false },
            { label: "Analytics", active: true },
            { label: "Settings", active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-md px-2 py-1 text-[10px]",
                item.active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
              )}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Analytics content — matches real dashboard */}
        <div className="flex-1 overflow-hidden bg-[#fafaf9] p-4">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Analytics</p>
              <p className="text-[9px] text-muted-foreground">Performance insights for Acme Corp</p>
            </div>
            <div className="rounded-md border border-border/40 bg-muted/60 px-2 py-1 text-[9px] text-muted-foreground">
              Export
            </div>
          </div>

          <div className="mb-3 flex gap-3 border-b border-border/40 pb-1.5">
            {["Overview", "Heatmap", "Cycles"].map((tab, i) => (
              <span
                key={tab}
                className={cn(
                  "pb-1 text-[9px] font-medium",
                  i === 0 ? "border-b border-primary text-primary" : "text-muted-foreground",
                )}
              >
                {tab}
              </span>
            ))}
          </div>

          <div className="mb-3 flex gap-1.5">
            {["All Cycles", "All Functions", "All Depts"].map((f) => (
              <div
                key={f}
                className="rounded-md border border-border/50 bg-white px-2 py-0.5 text-[8px] text-muted-foreground"
              >
                {f}
              </div>
            ))}
          </div>

          <div className="mb-3 grid grid-cols-5 gap-1.5">
            {[
              { icon: "★", label: "Overall Rating", value: "4.2/5", color: "text-amber-500", iconBg: "bg-amber-50" },
              { icon: "↗", label: "Completion", value: "91%", color: "text-emerald-600", iconBg: "bg-emerald-50" },
              { icon: "▊", label: "Total Ratings", value: "312", color: "text-primary", iconBg: "bg-primary/10" },
              { icon: "◉", label: "Participants", value: "47", color: "text-purple-600", iconBg: "bg-purple-50" },
              { icon: "⊞", label: "Active Cycles", value: "2", color: "text-orange-500", iconBg: "bg-orange-50" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-border/40 bg-white p-2">
                <div className={cn("mb-1 flex h-4 w-4 items-center justify-center rounded-md text-[8px]", kpi.iconBg)}>
                  {kpi.icon}
                </div>
                <p className={cn("text-sm font-bold", kpi.color)}>{kpi.value}</p>
                <p className="mt-0.5 text-[7px] leading-tight text-muted-foreground">{kpi.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-3 grid grid-cols-2 gap-1.5">
            <div className="rounded-lg border border-border/40 bg-white p-2.5">
              <p className="mb-2 text-[9px] font-semibold text-foreground">Rating Distribution</p>
              <div className="flex h-12 items-end gap-1">
                {[
                  { score: "1", pct: 3, color: "bg-red-400" },
                  { score: "2", pct: 8, color: "bg-orange-400" },
                  { score: "3", pct: 28, color: "bg-yellow-400" },
                  { score: "4", pct: 42, color: "bg-green-400" },
                  { score: "5", pct: 19, color: "bg-emerald-500" },
                ].map((bar) => (
                  <div key={bar.score} className="flex flex-1 flex-col items-center gap-0.5">
                    <div className={cn("w-full rounded-t-sm", bar.color)} style={{ height: `${bar.pct * 1.1}px` }} />
                    <span className="text-[7px] text-muted-foreground">{bar.score}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-white p-2.5">
              <p className="mb-2 text-[9px] font-semibold text-foreground">Competency Ratings</p>
              <div className="space-y-1.5">
                {[
                  { name: "Collaboration", score: 4.4 },
                  { name: "Leadership", score: 4.3 },
                  { name: "Execution", score: 3.9 },
                  { name: "Communication", score: 3.7 },
                ].map((c) => (
                  <div key={c.name} className="flex items-center gap-1.5">
                    <p className="w-[70px] shrink-0 truncate text-[8px] text-muted-foreground">{c.name}</p>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(c.score / 5) * 100}%` }} />
                    </div>
                    <span className="w-4 text-right text-[8px] font-semibold tabular-nums text-foreground">{c.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/40 bg-white p-2.5">
            <div className="mb-2 flex items-center gap-1">
              <span className="text-[9px]">⭐</span>
              <p className="text-[9px] font-semibold text-foreground">Performance Ranking</p>
            </div>
            <div className="space-y-1">
              {[
                { rank: 1, name: "Alex Johnson", fn: "Engineering", rating: 4.7, tier: "Exceptional", tierColor: "text-emerald-700 bg-emerald-50" },
                { rank: 2, name: "Maria Garcia", fn: "Product", rating: 4.2, tier: "Strong", tierColor: "text-green-700 bg-green-50" },
                { rank: 3, name: "Chris Lee", fn: "Design", rating: 3.6, tier: "Solid", tierColor: "text-sky-700 bg-sky-50" },
                { rank: 4, name: "Priya Nair", fn: "Engineering", rating: 2.8, tier: "Needs Dev", tierColor: "text-amber-700 bg-amber-50" },
              ].map((emp) => (
                <div key={emp.name} className="flex items-center gap-2 py-0.5">
                  <span className="w-3 shrink-0 font-mono text-[8px] text-muted-foreground">{emp.rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9px] font-medium text-foreground">{emp.name}</p>
                  </div>
                  <span className="shrink-0 text-[8px] text-muted-foreground">{emp.fn}</span>
                  <div className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-yellow-400" style={{ width: `${(emp.rating / 5) * 100}%` }} />
                  </div>
                  <span className="shrink-0 text-[8px] font-semibold tabular-nums text-foreground">{emp.rating}</span>
                  <span className={cn("shrink-0 rounded px-1 py-0.5 text-[7px] font-semibold", emp.tierColor)}>{emp.tier}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <div className="rounded-lg border border-border/40 bg-white p-2.5">
              <p className="mb-2 text-[9px] font-semibold text-foreground">Completion by Dept</p>
              <div className="space-y-1.5">
                {[
                  { name: "Engineering", pct: 96 },
                  { name: "Product", pct: 88 },
                  { name: "Design", pct: 100 },
                  { name: "Marketing", pct: 75 },
                ].map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <p className="w-[60px] shrink-0 truncate text-[8px] text-muted-foreground">{d.name}</p>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-[8px] font-semibold tabular-nums text-foreground">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-white p-2.5">
              <p className="mb-2 text-[9px] font-semibold text-foreground">Avg Rating by Dept</p>
              <div className="space-y-1.5">
                {[
                  { name: "Engineering", rating: 4.3 },
                  { name: "Product", rating: 4.1 },
                  { name: "Design", rating: 3.8 },
                  { name: "Marketing", rating: 3.5 },
                ].map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <p className="w-[60px] shrink-0 truncate text-[8px] text-muted-foreground">{d.name}</p>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(d.rating / 5) * 100}%` }} />
                    </div>
                    <span className="w-4 text-right text-[8px] font-semibold tabular-nums text-foreground">{d.rating}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
