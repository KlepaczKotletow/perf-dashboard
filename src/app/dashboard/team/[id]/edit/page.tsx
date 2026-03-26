"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
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
  hire_date: string | null;
  role: string;
  is_department_head: boolean;
}

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
  const [isDeptHead, setIsDeptHead] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
          .select("workspace_id")
          .eq("slack_email", authUser.email)
          .single();
        const wsId = callerUser?.workspace_id;
        if (!wsId) {
          setError("Workspace not found");
          return;
        }

        // Load the user
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, slack_name, slack_email, job_title, department, manager_id, level_id, hire_date, role, is_department_head")
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
        setManagerId(userData.manager_id || "");
        setLevelId(userData.level_id || "");
        setHireDate(userData.hire_date || "");
        setRole(userData.role || "user");
        setIsDeptHead(userData.is_department_head || false);

        const [{ data: usersData }, { data: levelsData }, { data: familiesData }] = await Promise.all([
          supabase.from("users").select("id, slack_name").eq("workspace_id", wsId).neq("id", id).order("slack_name"),
          supabase.from("levels").select("id, name, grade, job_family_id, job_family:job_families(name)").eq("workspace_id", wsId).order("sort_order"),
          supabase.from("job_families").select("id, name").eq("workspace_id", wsId).order("name"),
        ]);

        setAllUsers(usersData || []);
        setJobFamilies(familiesData || []);

        const mappedLevels = (levelsData || []).map((l: any) => ({
          id: l.id,
          name: l.name,
          grade: l.grade,
          job_family_id: l.job_family_id,
          job_family_name: l.job_family?.name || "",
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
      const wsId = authUser?.user_metadata?.workspace_id;

      const { error: updateError } = await supabase
        .from("users")
        .update({
          job_title: jobTitle || null,
          department: department || null,
          manager_id: managerId || null,
          level_id: levelId || null,
          hire_date: hireDate || null,
          role,
          is_department_head: isDeptHead,
        })
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
        <h1 className="text-2xl font-bold text-foreground mb-2">User Not Found</h1>
        <Button asChild>
          <Link href="/dashboard/team">Back to Team</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/team/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Profile</h1>
          <p className="text-muted-foreground">{user.slack_name} ({user.slack_email})</p>
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
          <div className="space-y-2">
            <Label htmlFor="role">System Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager">Manager</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger id="manager">
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Manager</SelectItem>
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
              value={jobFamilyId}
              onValueChange={(val) => {
                setJobFamilyId(val);
                setLevelId(""); // reset level when family changes
              }}
            >
              <SelectTrigger id="jobFamily">
                <SelectValue placeholder="Select function" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No function</SelectItem>
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

          {/* Level — filtered to selected family */}
          <div className="space-y-2">
            <Label htmlFor="level">Job Level</Label>
            <Select value={levelId} onValueChange={setLevelId} disabled={!jobFamilyId}>
              <SelectTrigger id="level">
                <SelectValue placeholder={jobFamilyId ? "Select level" : "Select a function first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No level</SelectItem>
                {levels
                  .filter((l) => l.job_family_id === jobFamilyId)
                  .map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}{l.grade ? ` (${l.grade})` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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
