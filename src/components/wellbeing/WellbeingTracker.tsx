import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { Heart, Utensils, Pill, Footprints, Droplets, ChevronLeft, ChevronRight, Check, AlertCircle, Loader } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Supabase ──────────────────────────────────────────────────────────────────


const sb: any = supabase;

// ── Design tokens (match Kindred/CareConnect exactly) ─────────────────────────
const T = {
  ink:    "#1E3532",
  gold:   "#C99A3E",
  sage:   "#7C9A7E",
  clay:   "#B3573B",
  paper:  "#F7F2E9",
  paper2: "#EFE7D8",
  border: "#E3D9C2",
  muted:  "#8A7F63",
  card:   "#FFFCF6",
};

// ── 3-option scale ────────────────────────────────────────────────────────────
// Each indicator maps "good / usual / needs-attention" to DB values
const INDICATORS = [
  {
    key:    "mood",
    label:  "Mood",
    icon:   Heart,
    prompt: "How did they seem today?",
    opts: [
      { label: "Good",            val: 4, db: { mood_scale: 4 }, color: T.sage },
      { label: "Usual",           val: 3, db: { mood_scale: 3 }, color: T.gold },
      { label: "Needs attention", val: 2, db: { mood_scale: 2 }, color: T.clay },
    ],
  },
  {
    key:    "appetite",
    label:  "Appetite",
    icon:   Utensils,
    prompt: "How did they eat today?",
    opts: [
      { label: "Good",            val: "good", db: { food_appetite: "good" }, color: T.sage },
      { label: "Fair",            val: "fair", db: { food_appetite: "fair" }, color: T.gold },
      { label: "Needs attention", val: "poor", db: { food_appetite: "poor" }, color: T.clay },
    ],
  },
  {
    key:    "medicine",
    label:  "Medicine",
    icon:   Pill,
    prompt: "Did they take their medication?",
    opts: [
      { label: "Taken",           val: "yes",     db: { medicine_taken: "yes" },     color: T.sage },
      { label: "Partial",         val: "partial", db: { medicine_taken: "partial" }, color: T.gold },
      { label: "Not taken",       val: "no",      db: { medicine_taken: "no" },      color: T.clay },
    ],
  },
  {
    key:    "movement",
    label:  "Movement",
    icon:   Footprints,
    prompt: "How did they move today?",
    opts: [
      { label: "Independent",     val: "independent", db: { movement_assisted: false }, color: T.sage },
      { label: "With help",       val: "assisted",    db: { movement_assisted: true  }, color: T.gold },
      { label: "Needs attention", val: "attention",   db: { movement_assisted: true  }, color: T.clay },
    ],
  },
  {
    key:    "hygiene",
    label:  "Hygiene",
    icon:   Droplets,
    prompt: "Bathing and grooming completed?",
    opts: [
      { label: "Both done",       val: "both",    db: { hygiene_bathing_completed: true,  hygiene_grooming_completed: true  }, color: T.sage },
      { label: "Partial",         val: "partial", db: { hygiene_bathing_completed: false, hygiene_grooming_completed: true  }, color: T.gold },
      { label: "Not completed",   val: "none",    db: { hygiene_bathing_completed: false, hygiene_grooming_completed: false }, color: T.clay },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10); }
function fmtDate(s) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function shortDate(s) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function scoreColor(s) {
  if (s == null) return "#C9C2AC";
  if (s >= 3.5) return T.sage;
  if (s >= 2.5) return T.gold;
  return T.clay;
}
function scoreLabel(s) {
  if (s == null) return "No entry";
  if (s >= 3.5) return "Good";
  if (s >= 2.5) return "Usual";
  return "Needs attention";
}

// Convert a wellbeing_entries row → numeric score 1-4 for charting
function entryToScore(e) {
  if (!e) return null;
  const vals = [
    e.mood_scale,
    e.food_appetite === "good" ? 4 : e.food_appetite === "fair" ? 3 : e.food_appetite === "poor" ? 2 : null,
    e.medicine_taken === "yes" ? 4 : e.medicine_taken === "partial" ? 3 : e.medicine_taken === "no" ? 2 : null,
    e.movement_assisted === false ? 4 : e.movement_assisted === true ? 3 : null,
    (e.hygiene_bathing_completed && e.hygiene_grooming_completed) ? 4
      : (!e.hygiene_bathing_completed && !e.hygiene_grooming_completed) ? 2 : 3,
  ].filter(v => v != null);
  if (!vals.length) return null;
  return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function WellbeingTracker() {
  const [session, setSession]   = useState(null);
  const [role, setRole]         = useState(null);   // "caregiver" | "family_member"
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState("caregiver"); // UI tab

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) fetchRole(data.session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) fetchRole(s.user.id);
      else { setRole(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchRole(uid) {
    const { data } = await sb.from("user_roles").select("role").eq("user_id", uid).single();
    setRole(data?.role ?? null);
    setLoading(false);
  }

  if (loading) return <Screen><Spinner /></Screen>;
  if (!session) return <LoginScreen />;

  // Determine which view to show based on role
  const isCaregiver   = role === "caregiver";
  const isFamilyMember = role === "family_member";
  const isAdmin       = role === "admin";

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: "'Work Sans', system-ui, sans-serif", color: T.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Work+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .disp { font-family: 'Fraunces', Georgia, serif; }
        button { font-family: inherit; cursor: pointer; }
        button:focus-visible { outline: 2px solid ${T.ink}; outline-offset: 2px; }
        .opt-btn { transition: transform 0.1s ease; }
        .opt-btn:hover { transform: translateY(-1px); }
      `}</style>

      {/* Header */}
      <header style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.border}`, background: T.card }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Heart size={14} color={T.gold} fill={T.gold} />
          </div>
          <div>
            <div className="disp" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1 }}>Con Cariño</div>
            <div style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted }}>Wellbeing tracker</div>
          </div>
        </div>

        {/* Tab switcher — only show if admin (can see both) */}
        {isAdmin && (
          <div style={{ display: "flex", background: T.paper2, borderRadius: 999, padding: 3 }}>
            {["caregiver", "family"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                border: "none", padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: view === v ? T.ink : "transparent",
                color: view === v ? T.paper : T.ink,
              }}>{v === "caregiver" ? "Caregiver" : "Family"}</button>
            ))}
          </div>
        )}

        <button onClick={() => sb.auth.signOut()} style={{ border: `1px solid ${T.border}`, background: "transparent", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: T.muted }}>
          Sign out
        </button>
      </header>

      {/* Body */}
      {(isCaregiver || (isAdmin && view === "caregiver")) && <CaregiverView userId={session.user.id} />}
      {(isFamilyMember || (isAdmin && view === "family"))  && <FamilyView   userId={session.user.id} isAdmin={isAdmin} />}
    </div>
  );
}

// ── Caregiver view ────────────────────────────────────────────────────────────
function CaregiverView({ userId }) {
  const [recipients, setRecipients] = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [draft,      setDraft]       = useState({});
  const [notes,      setNotes]       = useState("");
  const [saving,     setSaving]      = useState(false);
  const [saved,      setSaved]       = useState(false);
  const [error,      setError]       = useState(null);
  const [existing,   setExisting]    = useState(null); // today's entry if already logged

  // Load care recipients assigned to this caregiver
  useEffect(() => {
    async function load() {
      // Get caregiver record
      const { data: cgData } = await sb.from("caregivers").select("id").eq("profile_id", userId).single();
      if (!cgData) return;
      // Get their scheduled care recipients via care_shifts
      const { data } = await sb
        .from("care_shifts")
        .select("care_recipient_id, care_recipients(id, full_name)")
        .eq("caregiver_id", cgData.id);
      if (!data) return;
      // Deduplicate recipients
      const seen = new Set();
      const unique = [];
      data.forEach(row => {
        const r = row.care_recipients;
        if (r && !seen.has(r.id)) { seen.add(r.id); unique.push(r); }
      });
      setRecipients(unique);
      if (unique.length > 0) setSelected(unique[0]);
    }
    load();
  }, [userId]);

  // Check if today's entry already exists for selected recipient
  useEffect(() => {
    if (!selected) return;
    async function checkToday() {
      setExisting(null);
      const todayStart = today() + "T00:00:00.000Z";
      const todayEnd   = today() + "T23:59:59.999Z";
      const { data } = await sb
        .from("visit_logs")
        .select("id, wellbeing_entries(id, mood_scale, food_appetite, medicine_taken, movement_assisted, hygiene_bathing_completed, hygiene_grooming_completed, mood_notes)")
        .eq("caregiver_id", userId)
        .eq("care_recipient_id", selected.id)
        .gte("clock_in", todayStart)
        .lte("clock_in", todayEnd)
        .maybeSingle();
      if (data?.wellbeing_entries) {
        const e = Array.isArray(data.wellbeing_entries) ? data.wellbeing_entries[0] : data.wellbeing_entries;
        setExisting(e);
        // Pre-fill draft with existing values
        const preFill = {};
        if (e.mood_scale)                preFill.mood     = e.mood_scale >= 4 ? 4 : e.mood_scale <= 2 ? 2 : 3;
        if (e.food_appetite)             preFill.appetite = e.food_appetite;
        if (e.medicine_taken)            preFill.medicine = e.medicine_taken;
        if (e.movement_assisted != null) preFill.movement = e.movement_assisted ? "assisted" : "independent";
        if (e.hygiene_bathing_completed != null)
          preFill.hygiene = (e.hygiene_bathing_completed && e.hygiene_grooming_completed) ? "both"
            : (!e.hygiene_bathing_completed && !e.hygiene_grooming_completed) ? "none" : "partial";
        setDraft(preFill);
        setNotes(e.mood_notes || "");
      } else {
        setDraft({});
        setNotes("");
      }
    }
    checkToday();
  }, [selected, userId]);

  async function save() {
    if (Object.keys(draft).length < INDICATORS.length) {
      setError("Please fill in all indicators before saving.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // Build wellbeing payload from draft
      const wb = { mood_notes: notes };
      INDICATORS.forEach(ind => {
        const opt = ind.opts.find(o => o.val === draft[ind.key]);
        if (opt) Object.assign(wb, opt.db);
      });

      if (existing) {
        // Update existing entry
        await sb.from("wellbeing_entries").update({ ...wb, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        // Create visit_log first
        const { data: vl, error: vlErr } = await sb.from("visit_logs").insert({
          caregiver_id:      userId,
          care_recipient_id: selected.id,
          clock_in:          new Date().toISOString(),
          clock_out:         new Date().toISOString(),
          mood:              draft.mood >= 4 ? "good" : draft.mood <= 2 ? "poor" : "fair",
          notes,
        }).select("id").single();
        if (vlErr) throw vlErr;
        // Create wellbeing entry linked to visit log
        await sb.from("wellbeing_entries").insert({ ...wb, visit_log_id: vl.id });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError("Couldn't save — " + (e.message || "try again."));
    }
    setSaving(false);
  }

  if (recipients.length === 0) {
    return (
      <Empty
        icon={<Footprints size={28} color={T.muted} />}
        title="No care recipients assigned"
        body="You'll appear here once an admin assigns you to a client's care schedule."
      />
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "28px 20px 80px" }}>
      {/* Recipient selector */}
      {recipients.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {recipients.map(r => (
            <button key={r.id} onClick={() => setSelected(r)} style={{
              padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: "none",
              background: selected?.id === r.id ? T.ink : T.paper2,
              color: selected?.id === r.id ? T.paper : T.ink,
            }}>{r.full_name}</button>
          ))}
        </div>
      )}

      {/* Date + recipient header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted, marginBottom: 4 }}>
          Today · {fmtDate(today())}
        </div>
        <div className="disp" style={{ fontSize: 26, fontWeight: 600 }}>
          {selected?.full_name}
        </div>
        {existing && (
          <div style={{ marginTop: 6, fontSize: 12, color: T.muted, background: T.paper2, display: "inline-block", padding: "4px 10px", borderRadius: 6 }}>
            Already logged today — editing will update it
          </div>
        )}
      </div>

      {/* Indicators */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {INDICATORS.map(ind => {
          const Icon = ind.icon;
          return (
            <div key={ind.key} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: T.paper2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={14} color={T.ink} />
                </div>
                <div>
                  <div className="disp" style={{ fontSize: 14, fontWeight: 600 }}>{ind.label}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{ind.prompt}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {ind.opts.map(opt => {
                  const active = draft[ind.key] === opt.val;
                  return (
                    <button key={opt.val} className="opt-btn"
                      onClick={() => setDraft(d => ({ ...d, [ind.key]: opt.val }))}
                      style={{
                        flex: 1, padding: "10px 6px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                        border: active ? `2px solid ${opt.color}` : `1px solid ${T.border}`,
                        background: active ? opt.color : T.card,
                        color: active ? "#fff" : T.ink,
                      }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Notes */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px" }}>
          <div className="disp" style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Notes <span style={{ fontWeight: 400, fontSize: 12, color: T.muted }}>(optional)</span></div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Anything the family should know about today's visit…"
            style={{ width: "100%", minHeight: 72, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, fontSize: 13, resize: "vertical", background: T.paper, color: T.ink, fontFamily: "inherit" }} />
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", background: "#FDF0ED", borderRadius: 10, color: T.clay, fontSize: 13 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Save */}
        <button onClick={save} disabled={saving} style={{
          padding: "14px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 600,
          background: saved ? T.sage : T.ink, color: T.paper,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> Saving…</>
           : saved  ? <><Check size={16} /> Saved</>
           : "Save check-in"}
        </button>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ── Family view ───────────────────────────────────────────────────────────────
function FamilyView({ userId, isAdmin }) {
  const [recipients, setRecipients] = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [entries,    setEntries]     = useState([]);   // last 14 days of wellbeing_entries
  const [loading,    setLoading]     = useState(true);
  const [focusDate,  setFocusDate]   = useState(today());

  // Load care recipients this family can see
  useEffect(() => {
    async function load() {
      let data;
      if (isAdmin) {
        ({ data } = await sb.from("care_recipients").select("id, full_name"));
      } else {
        // family_member sees recipients linked via client_family_members → clients → care_recipients
        ({ data } = await sb
          .from("client_family_members")
          .select("clients(care_recipients(id, full_name))")
          .eq("user_id", userId));
        data = (data || []).flatMap(r => r.clients?.care_recipients || []);
      }
      const unique = [...new Map((data || []).map(r => [r.id, r])).values()];
      setRecipients(unique);
      if (unique.length > 0) setSelected(unique[0]);
    }
    load();
  }, [userId, isAdmin]);

  // Load wellbeing entries for selected recipient (last 14 days)
  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    async function load() {
      const since = new Date();
      since.setDate(since.getDate() - 13);
      since.setHours(0, 0, 0, 0);

      const { data } = await sb
        .from("visit_logs")
        .select("clock_in, wellbeing_entries(mood_scale, food_appetite, medicine_taken, movement_assisted, hygiene_bathing_completed, hygiene_grooming_completed, mood_notes)")
        .eq("care_recipient_id", selected.id)
        .gte("clock_in", since.toISOString())
        .order("clock_in", { ascending: true });

      // Group by date — take the latest entry per day
      const byDate = {};
      (data || []).forEach(vl => {
        const d = vl.clock_in.slice(0, 10);
        const e = Array.isArray(vl.wellbeing_entries) ? vl.wellbeing_entries[0] : vl.wellbeing_entries;
        if (e) byDate[d] = e;
      });
      setEntries(byDate);
      setLoading(false);
    }
    load();
  }, [selected]);

  // Build last 14 days array
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const chartData = days.map(d => ({
    date: d, label: shortDate(d), score: entryToScore(entries[d]),
  }));

  const latest    = [...chartData].reverse().find(c => c.score != null);
  const weekAgo   = chartData.slice(0, 7).reverse().find(c => c.score != null);
  const delta     = latest && weekAgo ? +(latest.score - weekAgo.score).toFixed(1) : null;
  const focusEntry = entries[focusDate];
  const focusScore = entryToScore(focusEntry);

  if (recipients.length === 0) {
    return <Empty icon={<Heart size={28} color={T.muted} />} title="No care recipients linked" body="Once you're linked to a care recipient, you'll see their wellbeing history here." />;
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
      {/* Recipient selector */}
      {recipients.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {recipients.map(r => (
            <button key={r.id} onClick={() => setSelected(r)} style={{
              padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: "none",
              background: selected?.id === r.id ? T.ink : T.paper2,
              color: selected?.id === r.id ? T.paper : T.ink,
            }}>{r.full_name}</button>
          ))}
        </div>
      )}

      <div className="disp" style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>{selected?.full_name}</div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 24, letterSpacing: "0.04em", textTransform: "uppercase" }}>Last 14 days</div>

      {loading ? <Spinner /> : (<>
        {/* Day ribbon */}
        <div style={{ display: "flex", gap: 5, marginBottom: 24 }}>
          {days.map(d => {
            const s = entryToScore(entries[d]);
            const isSel = d === focusDate;
            return (
              <button key={d} onClick={() => setFocusDate(d)} title={fmtDate(d) + " — " + scoreLabel(s)}
                style={{
                  flex: 1, height: 44, borderRadius: 8, border: isSel ? `2px solid ${T.ink}` : "1px solid transparent",
                  background: scoreColor(s), opacity: s == null ? 0.3 : 1, cursor: "pointer",
                }} />
            );
          })}
        </div>

        {/* Summary cards */}
        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <SummaryCard label={fmtDate(focusDate)} value={focusScore ?? "—"} sub={scoreLabel(focusScore)} color={scoreColor(focusScore)} />
          <SummaryCard label="vs. last week" value={delta == null ? "—" : delta > 0 ? `+${delta}` : String(delta)} sub={delta == null ? "No comparison" : delta >= 0 ? "Improving" : "Declining"} color={delta == null ? T.muted : delta >= 0 ? T.sage : T.clay} />
        </div>

        {/* Chart */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 14px 8px", marginBottom: 20 }}>
          <div className="disp" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, paddingLeft: 8 }}>Wellbeing trend</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
              onClick={e => e?.activePayload?.[0] && setFocusDate(e.activePayload[0].payload.date)}>
              <CartesianGrid stroke={T.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.muted }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis domain={[1, 4]} ticks={[1, 2, 3, 4]} tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
              <ReferenceLine y={2.5} stroke={T.border} strokeDasharray="3 3" />
              <Tooltip contentStyle={{ background: T.ink, border: "none", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: T.gold }} itemStyle={{ color: T.paper }} formatter={(v) => [v, "Score"]} />
              <Line type="monotone" dataKey="score" stroke={T.gold} strokeWidth={2.5}
                dot={{ r: 3, fill: T.gold }} activeDot={{ r: 5 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Day detail */}
        {focusEntry ? (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
            <div className="disp" style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
              {focusDate === today() ? "Today" : fmtDate(focusDate)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: focusEntry.mood_notes ? 14 : 0 }}>
              {INDICATORS.map(ind => {
                const Icon = ind.icon;
                const val  = (() => {
                  if (ind.key === "mood")      return focusEntry.mood_scale >= 4 ? "Good" : focusEntry.mood_scale <= 2 ? "Needs attention" : "Usual";
                  if (ind.key === "appetite")  return focusEntry.food_appetite === "good" ? "Good" : focusEntry.food_appetite === "poor" ? "Needs attention" : "Fair";
                  if (ind.key === "medicine")  return focusEntry.medicine_taken === "yes" ? "Taken" : focusEntry.medicine_taken === "no" ? "Not taken" : "Partial";
                  if (ind.key === "movement")  return focusEntry.movement_assisted ? "With help" : "Independent";
                  if (ind.key === "hygiene")   return (focusEntry.hygiene_bathing_completed && focusEntry.hygiene_grooming_completed) ? "Both done"
                    : (!focusEntry.hygiene_bathing_completed && !focusEntry.hygiene_grooming_completed) ? "Not completed" : "Partial";
                })();
                const color = ind.opts.find(o => o.label === val || (val === "Good" && o.label === "Good") || (val === "Needs attention" && o.label?.includes("attention")))?.color ?? T.muted;
                return (
                  <div key={ind.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon size={13} color={T.muted} />
                    <div style={{ fontSize: 12, color: T.ink }}>
                      {ind.label}: <strong style={{ color }}>{val ?? "—"}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
            {focusEntry.mood_notes && (
              <div style={{ fontSize: 13, lineHeight: 1.65, color: "#3F5350", borderTop: `1px solid ${T.border}`, paddingTop: 12, fontStyle: "italic" }}>
                "{focusEntry.mood_notes}"
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "24px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>
            No check-in recorded for {fmtDate(focusDate)}.
          </div>
        )}
      </>)}
    </main>
  );
}

// ── Small shared components ───────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color }) {
  return (
    <div style={{ flex: "1 1 180px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div className="disp" style={{ fontSize: 30, fontWeight: 600, color }}>{value}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color }}>{sub}</div>
      </div>
    </div>
  );
}
function Screen({ children }) {
  return <div style={{ minHeight: "100vh", background: T.paper, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>;
}
function Spinner() {
  return <div style={{ textAlign: "center", padding: 40, color: T.muted, fontSize: 14 }}>Loading…</div>;
}
function Empty({ icon, title, body }) {
  return (
    <div style={{ maxWidth: 400, margin: "60px auto", textAlign: "center", padding: "0 24px" }}>
      <div style={{ marginBottom: 12 }}>{icon}</div>
      <div className="disp" style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [pw,    setPw]    = useState("");
  const [err,   setErr]   = useState(null);
  const [busy,  setBusy]  = useState(false);
  async function login() {
    setBusy(true); setErr(null);
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) setErr(error.message);
    setBusy(false);
  }
  return (
    <Screen>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "36px 32px", width: "100%", maxWidth: 360 }}>
        <div className="disp" style={{ fontSize: 22, fontWeight: 600, marginBottom: 4, color: T.ink }}>Con Cariño</div>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 28 }}>Wellbeing tracker</div>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, marginBottom: 10, fontSize: 14, background: T.paper, color: T.ink, fontFamily: "inherit" }} />
        <input value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" type="password"
          onKeyDown={e => e.key === "Enter" && login()}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, marginBottom: 16, fontSize: 14, background: T.paper, color: T.ink, fontFamily: "inherit" }} />
        {err && <div style={{ fontSize: 12, color: T.clay, marginBottom: 12 }}>{err}</div>}
        <button onClick={login} disabled={busy} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: T.ink, color: T.paper, fontSize: 14, fontWeight: 600 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </Screen>
  );
}
