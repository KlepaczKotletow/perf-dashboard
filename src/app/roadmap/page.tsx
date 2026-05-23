"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  ChevronUp, Send, Check, Sparkles, Rocket, Clock,
  Search, MessageSquare, Target, BarChart3, Puzzle,
  Bot, Layers, Flag,
} from "lucide-react";

interface RoadmapItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  votes: number;
  sort_order: number;
}

const CATEGORIES = [
  { value: "all", label: "All", icon: Layers },
  { value: "reviews", label: "Reviews", icon: MessageSquare },
  { value: "goals", label: "Goals", icon: Flag },
  { value: "surveys", label: "Surveys", icon: Target },
  { value: "analytics", label: "Analytics", icon: BarChart3 },
  { value: "integrations", label: "Integrations", icon: Puzzle },
  { value: "ai", label: "AI & Automation", icon: Bot },
  { value: "platform", label: "Platform", icon: Layers },
];

const STATUSES = [
  { value: "all", label: "All" },
  { value: "shipped", label: "Shipped", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "planned", label: "Planned", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "exploring", label: "Exploring", color: "bg-purple-100 text-purple-700 border-purple-200" },
];

function getStatusBadge(status: string) {
  const s = STATUSES.find((st) => st.value === status);
  if (!s) return null;
  return <Badge variant="outline" className={`text-[11px] font-semibold border ${s.color}`}>{s.label}</Badge>;
}

function getFingerprint(): string {
  if (typeof window === "undefined") return "";
  let fp = localStorage.getItem("nami_roadmap_fp");
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem("nami_roadmap_fp", fp);
  }
  return fp;
}

export default function RoadmapPage() {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [votingId, setVotingId] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Suggest form
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestDesc, setSuggestDesc] = useState("");
  const [suggestEmail, setSuggestEmail] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestSuccess, setSuggestSuccess] = useState(false);
  const [justVotedId, setJustVotedId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const fp = getFingerprint();
      const [{ data: itemsData }, { data: votesData }] = await Promise.all([
        supabase.from("roadmap_items").select("*").order("votes", { ascending: false }),
        supabase.from("roadmap_votes").select("item_id").eq("fingerprint", fp),
      ]);
      setItems(itemsData || []);
      setVotedIds(new Set(((votesData || []) as { item_id: string }[]).map((v) => v.item_id)));
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (status !== "all" && item.status !== status) return false;
      if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) && !item.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [items, category, status, searchQuery]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const item of items) {
      c[item.category] = (c[item.category] || 0) + 1;
      c[`status_${item.status}`] = (c[`status_${item.status}`] || 0) + 1;
    }
    return c;
  }, [items]);

  async function handleVote(itemId: string) {
    if (votingId) return;
    setVotingId(itemId);
    const fp = getFingerprint();
    const alreadyVoted = votedIds.has(itemId);
    const item = items.find((i) => i.id === itemId);
    if (!item) { setVotingId(null); return; }

    // Optimistic update + pop animation
    const delta = alreadyVoted ? -1 : 1;
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, votes: Math.max(0, i.votes + delta) } : i));
    setVotedIds((prev) => {
      const n = new Set(prev);
      if (alreadyVoted) n.delete(itemId); else n.add(itemId);
      return n;
    });
    setJustVotedId(itemId);
    setTimeout(() => setJustVotedId(null), 350);

    try {
      if (alreadyVoted) {
        await supabase.from("roadmap_votes").delete().eq("item_id", itemId).eq("fingerprint", fp);
        await supabase.from("roadmap_items").update({ votes: Math.max(0, item.votes - 1) }).eq("id", itemId);
      } else {
        await supabase.from("roadmap_votes").insert({ item_id: itemId, fingerprint: fp });
        await supabase.from("roadmap_items").update({ votes: item.votes + 1 }).eq("id", itemId);
      }
    } catch {
      // Revert on error
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, votes: Math.max(0, i.votes - delta) } : i));
      setVotedIds((prev) => {
        const n = new Set(prev);
        if (alreadyVoted) n.add(itemId); else n.delete(itemId);
        return n;
      });
    }
    setVotingId(null);
  }

  async function handleSuggest(e: React.FormEvent) {
    e.preventDefault();
    if (!suggestTitle.trim()) return;
    setSuggestLoading(true);
    try {
      await supabase.from("roadmap_suggestions").insert({
        title: suggestTitle.trim(),
        description: suggestDesc.trim() || null,
        email: suggestEmail.trim() || null,
      });
      setSuggestSuccess(true);
      setSuggestTitle("");
      setSuggestDesc("");
      setSuggestEmail("");
      setTimeout(() => setSuggestSuccess(false), 4000);
    } catch { /* ignore */ }
    setSuggestLoading(false);
  }

  const signInUrl = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()}/functions/v1/dashboard-auth`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight">Nami</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Button size="sm" variant="outline" asChild>
              <a href={signInUrl}>Sign in</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/[0.04] to-background pt-16 pb-10">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <Rocket className="h-3.5 w-3.5" />
            Product Roadmap
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            What we&apos;re building
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-lg mx-auto">
            See what&apos;s shipped, what&apos;s in progress, and what&apos;s coming next. Upvote the features that matter to you.
          </p>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              <span className="text-muted-foreground"><strong className="text-foreground">{counts.status_shipped || 0}</strong> shipped</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground"><strong className="text-foreground">{counts.status_in_progress || 0}</strong> in progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-muted-foreground"><strong className="text-foreground">{(counts.status_planned || 0) + (counts.status_exploring || 0)}</strong> planned</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex gap-8">

          {/* Left sidebar — categories */}
          <div className="w-52 shrink-0 hidden lg:block">
            <div className="sticky top-20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Categories</p>
              <nav className="space-y-0.5">
                {CATEGORIES.map((cat) => {
                  const count = cat.value === "all" ? items.length : (counts[cat.value] || 0);
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        category === cat.value
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <cat.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{cat.label}</span>
                      <span className="text-xs opacity-60">{count}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Right content */}
          <div className="flex-1 min-w-0">
            {/* Filters bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
              {/* Status tabs */}
              <div className="flex gap-1 flex-wrap">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStatus(s.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      status === s.value
                        ? "bg-foreground text-background"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {s.label}
                    {s.value !== "all" && <span className="ml-1 opacity-60">{counts[`status_${s.value}`] || 0}</span>}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative sm:ml-auto w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search features..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            {/* Mobile category filter */}
            <div className="flex gap-1.5 flex-wrap mb-4 lg:hidden">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    category === cat.value
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Items */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No features match your filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((item) => {
                  const voted = votedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className="group flex gap-4 items-start p-4 rounded-xl border border-border/60 bg-white card-hover"
                    >
                      {/* Upvote button */}
                      <button
                        onClick={() => handleVote(item.id)}
                        disabled={votingId === item.id}
                        className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                          voted
                            ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/5"
                            : "bg-muted/30 border-border hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                        } ${justVotedId === item.id ? "animate-vote-pop" : ""}`}
                      >
                        <ChevronUp className={`h-4 w-4 ${voted ? "text-primary" : ""}`} />
                        <span className="tabular-nums">{item.votes}</span>
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {getStatusBadge(item.status)}
                          <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/60">
                            {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                          </Badge>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                        {item.description && (
                          <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">{item.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Forward-looking statement */}
            <div className="mt-10 rounded-xl border border-border/60 bg-muted/30 px-5 py-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">A note on this roadmap.</strong> Items marked
                &quot;planned&quot; or &quot;exploring&quot; reflect our current thinking and may
                change. They are not commitments, are not part of any subscription agreement, and
                you should not make purchasing decisions based on unreleased features. Estimated
                timelines are intentionally not shown. For our security and compliance posture
                today, see our <Link href="/security" className="text-primary underline">Security page</Link>.
              </p>
            </div>

            {/* Suggest a feature */}
            <div className="mt-8 rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.03] to-background p-6 sm:p-8">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Suggest a feature</h3>
                  <p className="text-sm text-muted-foreground">Have an idea? We&apos;d love to hear it. Popular suggestions get added to the roadmap. By submitting, you grant us a license to use your suggestion under our <Link href="/terms" className="text-primary underline">Terms</Link>.</p>
                </div>
              </div>

              {suggestSuccess ? (
                <div className="flex items-center gap-2 py-4 px-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                  <Check className="h-4 w-4" />
                  Thanks for your suggestion! We review every submission.
                </div>
              ) : (
                <form onSubmit={handleSuggest} className="space-y-3">
                  <Input
                    placeholder="Feature title *"
                    value={suggestTitle}
                    onChange={(e) => setSuggestTitle(e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Describe the feature and why it matters (optional)"
                    value={suggestDesc}
                    onChange={(e) => setSuggestDesc(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none h-20 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      type="email"
                      placeholder="Your email (optional — we'll notify you if we build it)"
                      value={suggestEmail}
                      onChange={(e) => setSuggestEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={suggestLoading || !suggestTitle.trim()}>
                      {suggestLoading ? "Submitting..." : "Submit suggestion"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/40 border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <span className="text-lg font-bold text-foreground">Nami</span>
              <span>&copy; {new Date().getFullYear()}</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/pricing" className="text-muted-foreground/60 hover:text-foreground transition-colors">Pricing</Link>
              <Link href="/privacy" className="text-muted-foreground/60 hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="text-muted-foreground/60 hover:text-foreground transition-colors">Terms</Link>
              <Link href="/security" className="text-muted-foreground/60 hover:text-foreground transition-colors">Security</Link>
              <Link href="/support" className="text-muted-foreground/60 hover:text-foreground transition-colors">Support</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
