"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Cycle {
  id: string;
  name: string;
  status: string;
}

interface JobFamily {
  id: string;
  name: string;
}

interface AnalyticsFilterBarProps {
  cycles: Cycle[];
  functions: JobFamily[];
  departments: string[];
  selectedCycleId: string;
  selectedFunctionId: string;
  selectedDepartment: string;
}

export function AnalyticsFilterBar({
  cycles,
  functions,
  departments,
  selectedCycleId,
  selectedFunctionId,
  selectedDepartment,
}: AnalyticsFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/dashboard/analytics?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Cycle selector */}
      <Select
        value={selectedCycleId || "all"}
        onValueChange={(v) => updateFilter("cycleId", v)}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="All cycles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All cycles</SelectItem>
          {cycles.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Function selector */}
      <Select
        value={selectedFunctionId || "all"}
        onValueChange={(v) => updateFilter("functionId", v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All functions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All functions</SelectItem>
          {functions.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Department selector */}
      <Select
        value={selectedDepartment || "all"}
        onValueChange={(v) => updateFilter("department", v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All departments" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All departments</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
