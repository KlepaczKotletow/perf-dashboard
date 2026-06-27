"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  ChevronUp, Send, Check, Sparkles, Clock,
  Search, MessageSquare, Target, BarChart3, Puzzle,
  Bot, Layers, Flag,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Spotlight } from "@/components/marketing/spotlight";
import { Kicker } from "@/components/marketing/kicker";
import { GlowCard } from "@/components/marketing/glow-card";

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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader ctaPurpose="roadmap" />

      {/* Hero — dark moment */}
      <section className="bg-gradient-to-br from-[#fafaf5] via-[#f8f6f0] to-[#fefcf5]">
        <div className="mx-auto max-w-6xl px-6 pt-8 pb-2 sm:pt-10 lg:px-10">
          <div className="relative overflow-hidden rounded-3xl bg-ink-panel px-7 py-14 text-center sm:px-12 sm:py-16">
            <Spotlight />
            <div className="relative">
              <div className="mb-6 flex justify-center">
                <Kicker onDark>Product roadmap</Kicker>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                What we&apos;re{" "}
                <span className="font-serif-accent text-[hsl(var(--spotlight))]">building next.</span>
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-white/60">
                See what&apos;s shipped, what&apos;s in progress, and what&apos;s coming next. Upvote the features that matter to you.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-white/70">
                  <Check className="h-4 w-4 text-emerald-400" />
                  <strong className="text-white">{counts.status_shipped || 0}</strong> shipped
                </span>
                <span className="inline-flex items-center gap-1.5 text-white/70">
                  <Sparkles className="h-4 w-4 text-[hsl(var(--spotlight))]" />
                  <strong className="text-white">{counts.status_in_progress || 0}</strong> in progress
                </span>
                <span className="inline-flex items-center gap-1.5 text-white/70">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <strong className="text-white">{(counts.status_planned || 0) + (counts.status_exploring || 0)}</strong> planned
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 lg:px-10">
        <div className="flex gap-8">

          {/* Left sidebar — categories */}
          <div className="hidden w-52 shrink-0 lg:block">
            <div className="sticky top-24">
              <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Categories</p>
              <nav className="space-y-0.5">
                {CATEGORIES.map((cat) => {
                  const count = cat.value === "all" ? items.length : (counts[cat.value] || 0);
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                        category === cat.value
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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
          <div className="min-w-0 flex-1">
            {/* Filters bar */}
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              {/* Status tabs */}
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStatus(s.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
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
              <div className="relative w-full sm:ml-auto sm:w-56">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search features..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>

            {/* Mobile category filter */}
            <div className="mb-4 flex flex-wrap gap-1.5 lg:hidden">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
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
              <div className="py-16 text-center text-muted-foreground">
                <Search className="mx-auto mb-3 h-8 w-8 opacity-40" />
                <p className="text-sm">No features match your filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((item) => {
                  const voted = votedIds.has(item.id);
                  return (
                    <GlowCard key={item.id} className="flex items-start gap-4 p-4">
                      {/* Upvote button */}
                      <button
                        onClick={() => handleVote(item.id)}
                        disabled={votingId === item.id}
                        className={`flex shrink-0 cursor-pointer flex-col items-center gap-0.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors ${
                          voted
                            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/5"
                            : "border-border bg-muted/30 hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                        } ${justVotedId === item.id ? "animate-vote-pop" : ""}`}
                      >
                        <ChevronUp className={`h-4 w-4 ${voted ? "text-primary" : ""}`} />
                        <span className="tabular-nums">{item.votes}</span>
                      </button>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          {getStatusBadge(item.status)}
                          <Badge variant="outline" className="border-border/60 text-[10px] text-muted-foreground">
                            {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                          </Badge>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                        {item.description && (
                          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                    </GlowCard>
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
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Suggest a feature</h3>
                  <p className="text-sm text-muted-foreground">Have an idea? We&apos;d love to hear it. Popular suggestions get added to the roadmap. By submitting, you grant us a license to use your suggestion under our <Link href="/terms" className="text-primary underline">Terms</Link>.</p>
                </div>
              </div>

              {suggestSuccess ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
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
                    className="h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row">
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

      <SiteFooter />
    </div>
  );
}
