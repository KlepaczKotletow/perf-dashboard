"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { useCallback, useState } from "react";

interface FeedbackFilterProps {
  /** When true, shows advanced filters (from, to, date range) */
  showAdvanced?: boolean;
  /** List of users for from/to dropdowns */
  users?: { id: string; name: string }[];
}

export function FeedbackFilter({ showAdvanced = false, users = [] }: FeedbackFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const type = searchParams.get("type") || "all";
  const from = searchParams.get("from") || "all";
  const to = searchParams.get("to") || "all";
  const period = searchParams.get("period") || "all";

  const updateFilters = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/dashboard/feedback?${params.toString()}`);
  }, [router, searchParams]);

  const handleSearch = () => {
    updateFilters("search", search);
  };

  const clearFilters = () => {
    setSearch("");
    router.push("/dashboard/feedback");
  };

  const hasFilters = searchParams.get("search") || searchParams.get("type")
    || searchParams.get("from") || searchParams.get("to") || searchParams.get("period");

  return (
    <div className="space-y-3 mb-6">
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="flex gap-2 flex-1 min-w-[200px]">
          <Input
            placeholder="Search by name or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-sm"
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Type filter */}
        <Select value={type} onValueChange={(value) => updateFilters("type", value)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="praise">Praise</SelectItem>
            <SelectItem value="constructive">Constructive</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="improvement">Improvement</SelectItem>
            <SelectItem value="question">Question</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Advanced filters for HR/Admin */}
      {showAdvanced && (
        <div className="flex flex-wrap gap-3">
          {/* From user */}
          <Select value={from} onValueChange={(value) => updateFilters("from", value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="From" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Senders</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* To user */}
          <Select value={to} onValueChange={(value) => updateFilters("to", value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="To" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Recipients</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date period */}
          <Select value={period} onValueChange={(value) => updateFilters("period", value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
