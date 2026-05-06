"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface User {
  id: string;
  slack_name: string | null;
  slack_email: string | null;
}

interface AddEmployeesFormProps {
  cycleId: string;
  allUsers: User[];
  existingEmployeeIds: string[];
}

export function AddEmployeesForm({ cycleId, allUsers, existingEmployeeIds }: AddEmployeesFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Filter out already added employees and apply search
  const availableUsers = allUsers.filter((user) => {
    if (existingEmployeeIds.includes(user.id)) return false;
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      user.slack_name?.toLowerCase().includes(searchLower) ||
      user.slack_email?.toLowerCase().includes(searchLower)
    );
  });

  function toggleUser(userId: string) {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  function selectAll() {
    if (selectedIds.length === availableUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(availableUsers.map((u) => u.id));
    }
  }

  async function handleSubmit() {
    if (selectedIds.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const records = selectedIds.map((employeeId) => ({
        performance_cycle_id: cycleId,
        employee_id: employeeId,
        status: "pending",
      }));

      const { error: insertError } = await supabase
        .from("performance_cycle_employees")
        .insert(records);

      if (insertError) throw insertError;

      setSelectedIds([]);
      router.refresh();
    } catch (err: unknown) {
      console.error("Error adding employees:", err);
      setError((err instanceof Error ? err.message : "") || "Failed to add employees. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Add Employees
        </CardTitle>
        <CardDescription>
          Select employees to include in this performance cycle
        </CardDescription>
      </CardHeader>
      <CardContent>
        {availableUsers.length === 0 && existingEmployeeIds.length === allUsers.length ? (
          <p className="text-muted-foreground text-center py-4">
            All employees have been added to this cycle.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedIds.length === availableUsers.length && availableUsers.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>

            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {availableUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No employees found matching your search.
                </p>
              ) : (
                availableUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleUser(user.id)}
                  >
                    <Checkbox
                      checked={selectedIds.includes(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{user.slack_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{user.slack_email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-between items-center pt-2">
              <p className="text-sm text-muted-foreground">
                {selectedIds.length} employee{selectedIds.length !== 1 ? "s" : ""} selected
              </p>
              <Button onClick={handleSubmit} disabled={loading || selectedIds.length === 0}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Selected
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
