import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/dashboard/DashboardShell";
import { CreateShiftDialog } from "@/components/dashboard/CreateShiftDialog";
import { Button } from "@/components/ui/button";
import {
  auditRows,
  caregivers,
  clients,
  liveVisits,
  matrixShifts,
  scheduleAlerts,
  weekDays,
  type Caregiver,
} from "@/lib/mock/dashboard-data";

const controlClass =
  "min-h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AgencyOverview() {
  const [shiftOpen, setShiftOpen] = useState(false);

  return (
    <div className="grid gap-4 md:gap-6">
      <section className="rounded-xl border border-attention/40 bg-attention-soft p-6 shadow-sm">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-attention-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="type-subhead text-attention-foreground">
              {scheduleAlerts.length} scheduling issues need attention
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-attention-foreground">
              {scheduleAlerts.map((a) => (
                <li key={a.id}>
                  <a href="#shift-matrix" className="underline underline-offset-4">
                    {a.kind === "gap" ? "Gap" : "Conflict"} — {a.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Panel
        title="Shift assignment matrix"
        className="scroll-mt-24"
        action={
          <Button className="min-h-12 sm:min-h-11" onClick={() => setShiftOpen(true)}>
            <Plus /> New shift
          </Button>
        }
      >
        <div id="shift-matrix" className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <caption className="sr-only">Caregivers by day of week</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-border p-2 text-left font-semibold">Caregiver</th>
                {weekDays.map((d) => (
                  <th key={d} scope="col" className="border-b border-border p-2 text-left font-semibold">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {caregivers.slice(0, 8).map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="border-b border-border/70 p-2 text-left font-medium">{c.name}</th>
                  {weekDays.map((d) => {
                    const s = matrixShifts.find((m) => m.caregiverId === c.id && m.day === d);
                    return (
                      <td key={d} className="border-b border-border/70 p-2">
                        {s ? (
                          <span
                            className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${
                              s.conflict
                                ? "bg-destructive/10 text-destructive"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {s.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <RosterTable />

      <Panel title="Live visit tracking">
        <ul className="divide-y divide-border/70">
          {liveVisits.map((v) => (
            <li key={v.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{v.caregiver}</p>
                <p className="truncate text-sm text-muted-foreground">
                  with {v.client} · since {v.since}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  v.verified ? "bg-primary/15 text-primary" : "bg-attention-soft text-attention-foreground"
                }`}
              >
                {v.verified ? "Verified" : "Pending"}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <AuditTable />

      <CreateShiftDialog open={shiftOpen} onOpenChange={setShiftOpen} />
    </div>
  );
}

type SortKey = keyof Pick<Caregiver, "name" | "status" | "clients" | "check">;

function RosterTable() {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const rows = useMemo(() => {
    const filtered = caregivers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [query, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const current = rows.slice((page - 1) * perPage, page * perPage);
  const allSelected = current.length > 0 && current.every((c) => selected.includes(c.id));

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  return (
    <Panel title="Caregiver roster">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="roster-search" className="mb-1.5 block text-sm font-medium">Search caregiver</label>
          <input
            id="roster-search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className={controlClass}
            placeholder="Name"
          />
        </div>
        <div>
          <label htmlFor="roster-client" className="mb-1.5 block text-sm font-medium">Client</label>
          <select id="roster-client" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={controlClass}>
            <option value="all">All clients</option>
            {clients.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="roster-per" className="mb-1.5 block text-sm font-medium">Rows per page</label>
          <select
            id="roster-per"
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className={controlClass}
          >
            {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => { toast.success(`Deactivated ${selected.length} caregivers`); setSelected([]); }}
          >
            Deactivate
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => { toast.success(`Message sent to ${selected.length} caregivers`); setSelected([]); }}
          >
            Message
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={() => setSelected([])}>Clear</Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="border-b border-border p-2 text-left">
                <input
                  type="checkbox"
                  aria-label="Select all caregivers on this page"
                  checked={allSelected}
                  onChange={(e) =>
                    setSelected(e.target.checked
                      ? Array.from(new Set([...selected, ...current.map((c) => c.id)]))
                      : selected.filter((id) => !current.some((c) => c.id === id)))
                  }
                  className="h-5 w-5 accent-[var(--color-primary)]"
                />
              </th>
              {([["name", "Name"], ["status", "Status"], ["clients", "Clients"], ["check", "Background check"]] as [SortKey, string][]).map(
                ([key, label]) => (
                  <th key={key} scope="col" className="border-b border-border p-0 text-left">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="flex min-h-11 w-full items-center gap-1 px-2 font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Sort by ${label}`}
                    >
                      {label}
                      {sort.key === key && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {current.map((c) => (
              <tr key={c.id} className="hover:bg-muted/50">
                <td className="border-b border-border/70 p-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${c.name}`}
                    checked={selected.includes(c.id)}
                    onChange={(e) =>
                      setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((id) => id !== c.id)))
                    }
                    className="h-5 w-5 accent-[var(--color-primary)]"
                  />
                </td>
                <td className="border-b border-border/70 p-2 font-medium">{c.name}</td>
                <td className="border-b border-border/70 p-2 capitalize">{c.status}</td>
                <td className="border-b border-border/70 p-2 tabular-nums">{c.clients}</td>
                <td className="border-b border-border/70 p-2">
                  <span className={c.check === "cleared" ? "text-primary" : "text-attention-foreground"}>
                    {c.check === "cleared" ? "Cleared" : "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager page={page} pageCount={pageCount} total={rows.length} onPage={setPage} />
    </Panel>
  );
}

function AuditTable() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actor, setActor] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const rows = auditRows.filter((r) => {
    const day = r.at.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (actor !== "all" && r.actor !== actor) return false;
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const current = rows.slice((page - 1) * perPage, page * perPage);
  const actors = Array.from(new Set(auditRows.map((r) => r.actor)));

  return (
    <Panel title="Audit log history">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="audit-from" className="mb-1.5 block text-sm font-medium">From</label>
          <input id="audit-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={controlClass} />
        </div>
        <div>
          <label htmlFor="audit-to" className="mb-1.5 block text-sm font-medium">To</label>
          <input id="audit-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={controlClass} />
        </div>
        <div>
          <label htmlFor="audit-actor" className="mb-1.5 block text-sm font-medium">Actor</label>
          <select id="audit-actor" value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} className={controlClass}>
            <option value="all">Everyone</option>
            {actors.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] border-collapse text-sm">
          <thead>
            <tr>
              {["When", "Who", "Action", "Record"].map((h) => (
                <th key={h} scope="col" className="border-b border-border p-2 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.map((r) => (
              <tr key={r.id} className="hover:bg-muted/50">
                <td className="border-b border-border/70 p-2 tabular-nums text-foreground/80">{r.at}</td>
                <td className="border-b border-border/70 p-2">{r.actor}</td>
                <td className="border-b border-border/70 p-2 font-medium">{r.action}</td>
                <td className="border-b border-border/70 p-2 text-muted-foreground">{r.entity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager page={page} pageCount={pageCount} total={rows.length} onPage={setPage} />
    </Panel>
  );
}

function Pager({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">{total} records · page {page} of {pageCount}</p>
      <div className="flex gap-2">
        <Button variant="outline" className="min-h-11" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" className="min-h-11" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
