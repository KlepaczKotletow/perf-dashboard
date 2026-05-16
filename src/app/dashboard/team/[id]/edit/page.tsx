"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { use } from "react";

interface UserData {
  id: string;
  slack_name: string;
  slack_email: string;
  job_title: string | null;
  department: string | null;
  manager_id: string | null;
  level_id: string | null;
  start_date: string | null;
  role: string;
  is_department_head: boolean;
  employee_status: string;
}

const EMPLOYEE_STATUSES = [
  { value: "active", label: "Active", color: "text-emerald-600" },
  { value: "onboarding", label: "Onboarding", color: "text-sky-600" },
  { value: "inactive", label: "Inactive", color: "text-amber-600" },
  { value: "deactivated", label: "Deactivated", color: "text-red-600" },
];

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [allUsers, setAllUsers] = useState<{ id: string; slack_name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string; grade: string | null; job_family_id: string; job_family_name: string }[]>([]);
  const [jobFamilies, setJobFamilies] = useState<{ id: string; name: string }[]>([]);
  const [jobFamilyId, setJobFamilyId] = useState<string>("");

  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [managerId, setManagerId] = useState<string>("");
  const [levelId, setLevelId] = useState<string>("");
  const [hireDate, setHireDate] = useState("");
  const [role, setRole] = useState("user");
  const [employeeStatus, setEmployeeStatus] = useState("active");
  const [isDeptHead, setIsDeptHead] = useState(false);
  const [callerRole, setCallerRole] = useState<string>("user");

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Get workspace_id for tenant scoping — look up via email, not user_metadata
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser?.email) {
          setError("Not authenticated");
          return;
        }
        const { data: callerUser } = await supabase
          .from("users")
          .select("workspace_id, role")
          .eq("slack_email", authUser.email)
          .single();
        const wsId = callerUser?.workspace_id;
        if (!wsId) {
          setError("Workspace not found");
          return;
        }
        setCallerRole(callerUser.role || "user");

        // Load the user
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, slack_name, slack_email, job_title, department, manager_id, level_id, start_date, role, is_department_head, employee_status")
          .eq("id", id)
          .eq("workspace_id", wsId)
          .single();

        if (userError || !userData) {
          setError("User not found");
          return;
        }

        setUser(userData);
        setJobTitle(userData.job_title || "");
        setDepartment(userData.department || "");
        setManagerId(userData.manager_id || "__none__");
        setLevelId(userData.level_id || "__none__");
        setHireDate(userData.start_date || "");
        setRole(userData.role || "user");
        setEmployeeStatus(userData.employee_status || "active");
        setIsDeptHead(userData.is_department_head || false);

        const [{ data: usersData }, { data: levelsData }, { data: familiesData }] = await Promise.all([
          supabase.from("users").select("id, slack_name").eq("workspace_id", wsId).neq("id", id).order("slack_name"),
          supabase.from("levels").select("id, name, grade, job_family_id, job_family:job_families(name)").eq("workspace_id", wsId).order("sort_order"),
          supabase.from("job_families").select("id, name").eq("workspace_id", wsId).order("name"),
        ]);

        setAllUsers(usersData || []);
        setJobFamilies(familiesData || []);

        type LevelRowFromDb = { id: string; name: string; grade: string | null; job_family_id: string | null; job_family?: { name: string } | { name: string }[] | null };
        const mappedLevels = ((levelsData || []) as unknown as LevelRowFromDb[]).map((l) => ({
          id: l.id,
          name: l.name,
          grade: l.grade,
          job_family_id: l.job_family_id ?? "",
          job_family_name: (Array.isArray(l.job_family) ? l.job_family[0]?.name : l.job_family?.name) || "",
        }));
        setLevels(mappedLevels);

        // Derive current function from the user's current level
        if (userData.level_id) {
          const currentLevel = mappedLevels.find(l => l.id === userData.level_id);
          setJobFamilyId(currentLevel?.job_family_id || "");
        }
      } catch (err) {
        setError("Failed to load user data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.email) { setError("Not authenticated"); return; }
      const { data: callerUser } = await supabase
        .from("users")
        .select("workspace_id, role")
        .eq("slack_email", authUser.email)
        .single();
      const wsId = callerUser?.workspace_id;
      if (!wsId) { setError("Workspace not found"); return; }

      // Only admins can change roles — HR can edit other fields but not role
      const callerIsAdmin = callerUser?.role === "admin";
      const updatePayload: Record<string, unknown> = {
        job_title: jobTitle || null,
        department: department || null,
        manager_id: managerId === "__none__" ? null : managerId || null,
        level_id: levelId === "__none__" ? null : levelId || null,
        start_date: hireDate || null,
        employee_status: employeeStatus,
        is_department_head: isDeptHead,
      };
      if (callerIsAdmin) {
        updatePayload.role = role;
      }

      const { error: updateError } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", id)
        .eq("workspace_id", wsId);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.push(`/dashboard/team/${id}`);
      router.refresh();
    } catch (err) {
      setError("Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-lg font-semibold text-foreground mb-1">User not found</h1>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">This person may have been removed from the workspace.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/team">Back to Directory</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/team/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">Edit profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user.slack_name} · {user.slack_email}</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Role & Organizational Info</CardTitle>
          <CardDescription>Update the employee&apos;s role, position, and reporting line</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">System Role</Label>
              {callerRole === "admin" ? (
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Employee</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center h-10 px-3 text-sm text-muted-foreground border border-input rounded-md bg-muted/50">
                  {role === "admin" ? "Admin" : role === "hr" ? "HR" : "Employee"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Employment Status</Label>
              <Select value={employeeStatus} onValueChange={setEmployeeStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className={s.color}>{s.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="deptHead">Department Head</Label>
              <p className="text-xs text-muted-foreground">
                Can calibrate performance reviews for their department
              </p>
            </div>
            <Switch
              id="deptHead"
              checked={isDeptHead}
              onCheckedChange={setIsDeptHead}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job Title</Label>
            <Input
              id="jobTitle"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager">Manager</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger id="manager">
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No Manager</SelectItem>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.slack_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Function */}
          <div className="space-y-2">
            <Label htmlFor="jobFamily">Function</Label>
            <Select
              value={jobFamilyId || "__none__"}
              onValueChange={(val) => {
                setJobFamilyId(val === "__none__" ? "" : val);
                setLevelId("__none__"); // reset level when family changes
              }}
            >
              <SelectTrigger id="jobFamily">
                <SelectValue placeholder="Select function" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No function</SelectItem>
                {jobFamilies.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {jobFamilies.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No functions yet.{" "}
                <Link href="/dashboard/admin/functions" target="_blank" className="text-primary underline underline-offset-2">
                  Create one →
                </Link>
              </p>
            )}
          </div>

          {/* Level — filtered to selected family, or grouped by function if no family picked */}
          <div className="space-y-2">
            <Label htmlFor="level">Job Level</Label>
            <Select
              value={levelId || "__none__"}
              onValueChange={(val) => {
                setLevelId(val);
                // Auto-set function from the selected level
                if (val && val !== "__none__") {
                  const picked = levels.find((l) => l.id === val);
                  if (picked) setJobFamilyId(picked.job_family_id);
                }
              }}
            >
              <SelectTrigger id="level">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No level</SelectItem>
                {jobFamilyId
                  ? levels
                      .filter((l) => l.job_family_id === jobFamilyId)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}{l.grade ? ` (${l.grade})` : ""}
                        </SelectItem>
                      ))
                  : /* No function selected: show all levels grouped by function name */
                    [...new Set(levels.map((l) => l.job_family_name))].sort().map((fname) => (
                      <div key={fname || "ungrouped"}>
                        {fname && (
                          <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {fname}
                          </div>
                        )}
                        {levels
                          .filter((l) => l.job_family_name === fname)
                          .map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {fname ? `${l.name}` : l.name}{l.grade ? ` (${l.grade})` : ""}
                            </SelectItem>
                          ))}
                      </div>
                    ))
                }
              </SelectContent>
            </Select>
            {levels.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No levels defined yet.{" "}
                <Link href="/dashboard/admin/functions" target="_blank" className="text-primary underline underline-offset-2">
                  Create functions & levels →
                </Link>
              </p>
            )}
          </div>

          {/* Informal team label */}
          <div className="space-y-2">
            <Label htmlFor="department">
              Team / Squad name <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Squad Falcon or Platform Team"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">Informal name — not linked to functions</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hireDate">Start Date</Label>
            <Input
              id="hireDate"
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href={`/dashboard/team/${id}`}>Cancel</Link>
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
