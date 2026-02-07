"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Badge } from "@/components/ui/badge";

const proficiencyColors: Record<number, string> = {
  1: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  2: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  3: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  4: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  5: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

interface EditableCellProps {
  levelId: string;
  competencyId: string;
  workspaceId: string;
  initialValue: number | null;
  existingId: string | null;
  canEdit: boolean;
}

export function EditableCell({
  levelId,
  competencyId,
  workspaceId,
  initialValue,
  existingId,
  canEdit,
}: EditableCellProps) {
  const [value, setValue] = useState<number | null>(initialValue);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSelect(newValue: number | null) {
    if (!canEdit) return;
    setSaving(true);
    setShowPicker(false);

    try {
      if (newValue === null) {
        // Remove the entry
        if (existingId) {
          await supabase.from("level_competencies").delete().eq("id", existingId);
        }
        setValue(null);
      } else if (existingId && value !== null) {
        // Update existing
        await supabase
          .from("level_competencies")
          .update({ expected_level: newValue })
          .eq("id", existingId);
        setValue(newValue);
      } else {
        // Insert new
        await supabase.from("level_competencies").insert({
          level_id: levelId,
          competency_id: competencyId,
          workspace_id: workspaceId,
          expected_level: newValue,
        });
        setValue(newValue);
      }
    } catch (err) {
      console.error("Error saving level competency:", err);
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return value ? (
      <Badge className={proficiencyColors[value]}>{value}</Badge>
    ) : (
      <span className="text-muted-foreground">-</span>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowPicker(!showPicker)}
        disabled={saving}
        className={`cursor-pointer transition-all rounded px-2 py-1 hover:ring-2 hover:ring-primary/40 ${
          saving ? "opacity-50" : ""
        }`}
      >
        {value ? (
          <Badge className={proficiencyColors[value]}>{value}</Badge>
        ) : (
          <span className="text-muted-foreground hover:text-foreground">-</span>
        )}
      </button>

      {showPicker && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
          {/* Picker */}
          <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-popover border rounded-lg shadow-lg p-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => handleSelect(n)}
                className={`w-8 h-8 rounded-md text-xs font-bold transition-all hover:scale-110 ${
                  proficiencyColors[n]
                } ${value === n ? "ring-2 ring-primary" : ""}`}
              >
                {n}
              </button>
            ))}
            {value && (
              <button
                onClick={() => handleSelect(null)}
                className="w-8 h-8 rounded-md text-xs font-bold bg-muted text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all"
                title="Clear"
              >
                ×
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
