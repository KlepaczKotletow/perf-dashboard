"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase";
import { getClientIdentity } from "@/lib/client-auth";
import { resolveLevel } from "@/lib/level-resolution";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  ArrowRight,
  X,
  Download,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

type Step = "upload" | "map" | "validate" | "apply" | "done";

interface CsvRow {
  [key: string]: string;
}

interface MappedUser {
  rowIdx: number;
  email: string;
  name?: string;
  department?: string;
  job_title?: string;
  manager_email?: string;
  role?: string;
  start_date?: string;
  job_function?: string;
  level?: string;
  avatar_url?: string;
}

interface ValidatedUser extends MappedUser {
  matchedUserId: string | null;
  matchedManagerId: string | null;
  /** Resolved from the Function + Level columns; null when unmatched. */
  resolvedLevelId: string | null;
  action: "create" | "update";
  errors: string[];
  warnings: string[];
}

interface ApplyResult {
  created: number;
  updated: number;
  managersSet: number;
  skipped: number;
  errors: string[];
}

// Known column aliases for fuzzy matching
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "employee name", "display name", "slack_name", "fullname", "full_name"],
  email: ["email", "e-mail", "email address", "mail", "slack_email", "work email", "employee email"],
  department: ["department", "dept", "team", "division", "group", "org"],
  job_title: ["job title", "title", "position", "role title", "job_title", "jobtitle"],
  manager_email: ["manager email", "manager_email", "manager", "reports to", "reports_to", "manager mail", "line manager", "direct manager", "direct manager email"],
  role: ["system role", "app role", "role", "access", "permission"],
  start_date: ["start date", "start_date", "starting date", "started"],
  job_function: ["function", "job function", "job_function", "family", "job family", "job_family", "career track", "track", "discipline"],
  level: ["level", "job level", "job_level", "grade", "seniority", "competency bracket", "band"],
  avatar_url: ["avatar", "avatar_url", "profile picture", "profile_picture", "photo", "photo_url", "picture", "image", "image_url"],
};

function matchColumn(header: string): string | null {
  const h = header.toLowerCase().trim();
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((a) => a === h)) return field;
  }
  // Partial match
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((a) => h.includes(a) || a.includes(h))) return field;
  }
  return null;
}

const TARGET_FIELDS = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email (required)", required: true },
  { value: "department", label: "Department" },
  { value: "job_title", label: "Job Title" },
  { value: "manager_email", label: "Manager Email" },
  { value: "role", label: "System Role" },
  { value: "start_date", label: "Start Date" },
  { value: "job_function", label: "Function" },
  { value: "level", label: "Level" },
  { value: "avatar_url", label: "Profile Picture URL" },
];

const VALID_ROLES = ["user", "hr", "admin"];

// Pragmatic email regex — matches HTML5 input[type=email] semantics (RFC 5322
// full compliance is impractical and not useful here). Catches obvious junk
// like "notanemail", "foo@", "@bar", "a@b" while tolerating +addressing and
// dotted locals like "first.last+work@company.co.uk".
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [rawRows, setRawRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validated, setValidated] = useState<ValidatedUser[]>([]);
  const [applying, setApplying] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // DB refs
  type DbUserRef = {
    id: string;
    slack_email: string | null;
    slack_name: string | null;
  };
  const [dbUsers, setDbUsers] = useState<DbUserRef[]>([]);
  // Resolved client-side: the CSV carries human names ("Engineering",
  // "Senior Engineer"), the users table stores a level_id.
  const [dbLevels, setDbLevels] = useState<
    { id: string; name: string | null; familyName: string | null }[]
  >([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const supabase = createClient();

  // Load DB data once
  useEffect(() => {
    async function load() {
      // Securely resolve workspace_id from DB
      const identity = await getClientIdentity(supabase);
      if (!identity) return;
      const wsId = identity.workspaceId;
      setWorkspaceId(wsId);

      const { data: users } = await supabase
        .from("users")
        .select("id, slack_email, slack_name")
        .eq("workspace_id", wsId);
      setDbUsers((users || []) as DbUserRef[]);

      const { data: levels } = await supabase
        .from("levels")
        .select("id, name, job_family:job_families(name)")
        .eq("workspace_id", wsId)
        .is("archived_at", null);
      setDbLevels(
        ((levels || []) as unknown as {
          id: string;
          name: string | null;
          job_family: { name: string } | { name: string }[] | null;
        }[]).map((l) => {
          const jf = Array.isArray(l.job_family) ? l.job_family[0] : l.job_family;
          return { id: l.id, name: l.name, familyName: jf?.name ?? null };
        })
      );
    }
    load();
  }, []);

  // ----------------------------------------------------------------
  // Download Template
  // ----------------------------------------------------------------

  function downloadTemplate() {
    const csv = [
      "name,email,department,job_title,manager_email,role,start_date,function,level,avatar_url",
      "Jane Smith,jane@company.com,Engineering,VP Engineering,,admin,2023-06-15,Engineering,Principal Engineer,",
      "Bob Jones,bob@company.com,Design,Lead Designer,jane@company.com,user,2022-01-10,Design,Lead Designer,",
      "Alice Chen,alice@company.com,Engineering,Staff Engineer,jane@company.com,user,2024-03-01,Engineering,Staff Engineer,",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "team-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ----------------------------------------------------------------
  // Step 1: Upload
  // ----------------------------------------------------------------

  const handleFile = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as CsvRow[];
        const hdrs = results.meta.fields || [];
        setRawRows(rows);
        setHeaders(hdrs);

        // Auto-map columns
        const autoMap: Record<string, string> = {};
        hdrs.forEach((h) => {
          const match = matchColumn(h);
          if (match && !Object.values(autoMap).includes(match)) {
            autoMap[h] = match;
          }
        });
        setMapping(autoMap);
        setStep("map");
      },
      error: () => {
        alert("Failed to parse CSV file. Please check the format.");
      },
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ----------------------------------------------------------------
  // Step 2: Map columns
  // ----------------------------------------------------------------

  function setColumnMapping(csvHeader: string, targetField: string) {
    setMapping((prev) => {
      const next = { ...prev };
      // Remove any existing mapping to the same target
      if (targetField !== "skip") {
        Object.keys(next).forEach((k) => {
          if (next[k] === targetField) delete next[k];
        });
      }
      if (targetField === "skip") {
        delete next[csvHeader];
      } else {
        next[csvHeader] = targetField;
      }
      return next;
    });
  }

  const emailMapped = Object.values(mapping).includes("email");

  function proceedToValidate() {
    // Build reverse mapping: target -> csv header
    const reverseMap: Record<string, string> = {};
    Object.entries(mapping).forEach(([csv, target]) => {
      reverseMap[target] = csv;
    });

    // Map raw rows to structured data
    const mapped: MappedUser[] = rawRows.map((row, idx) => ({
      rowIdx: idx,
      name: reverseMap["name"] ? (row[reverseMap["name"]] || "").trim() : undefined,
      email: (row[reverseMap["email"]] || "").trim().toLowerCase(),
      department: reverseMap["department"] ? (row[reverseMap["department"]] || "").trim() : undefined,
      job_title: reverseMap["job_title"] ? (row[reverseMap["job_title"]] || "").trim() : undefined,
      manager_email: reverseMap["manager_email"] ? (row[reverseMap["manager_email"]] || "").trim().toLowerCase() : undefined,
      role: reverseMap["role"] ? (row[reverseMap["role"]] || "").trim().toLowerCase() : undefined,
      start_date: reverseMap["start_date"] ? (row[reverseMap["start_date"]] || "").trim() : undefined,
      job_function: reverseMap["job_function"] ? (row[reverseMap["job_function"]] || "").trim() : undefined,
      level: reverseMap["level"] ? (row[reverseMap["level"]] || "").trim() : undefined,
      avatar_url: reverseMap["avatar_url"] ? (row[reverseMap["avatar_url"]] || "").trim() : undefined,
    }));

    // Build email -> user map from DB
    const emailToUser = new Map<string, DbUserRef>();
    dbUsers.forEach((u) => {
      if (u.slack_email) emailToUser.set(u.slack_email.toLowerCase(), u);
    });

    // Build set of emails in this CSV (for same-batch manager resolution)
    const csvEmails = new Set(mapped.map((r) => r.email).filter(Boolean));

    // Validate
    const validatedRows: ValidatedUser[] = mapped.map((m) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      let matchedUserId: string | null = null;
      let matchedManagerId: string | null = null;
      let action: "create" | "update" = "create";

      // Email match — classify as create or update
      if (!m.email) {
        errors.push("Missing email");
      } else if (!EMAIL_RE.test(m.email)) {
        errors.push("Invalid email format");
      } else {
        const user = emailToUser.get(m.email);
        if (user) {
          matchedUserId = user.id;
          action = "update";
        } else {
          action = "create";
        }
      }

      // Function / Level match
      const resolved = resolveLevel(dbLevels, m.job_function, m.level);
      if (resolved.warning) warnings.push(resolved.warning);

      // Manager match
      if (m.manager_email) {
        if (!EMAIL_RE.test(m.manager_email)) {
          warnings.push(`warn:manager_invalid:Manager email "${m.manager_email}" is not a valid email address — manager won't be linked`);
        } else {
          const mgr = emailToUser.get(m.manager_email);
          if (mgr) {
            matchedManagerId = mgr.id;
          } else if (csvEmails.has(m.manager_email)) {
            // Manager is in the same CSV — will be resolved in the edge function
            warnings.push(`info:manager_in_csv:Manager "${m.manager_email}" will be created in this import`);
          } else {
            warnings.push(`warn:manager_missing:Manager "${m.manager_email}" not found — import the manager first or link manually in Team Settings`);
          }
        }
      }

      // Role validation
      if (m.role && !VALID_ROLES.includes(m.role)) {
        warnings.push(`info:role_default:Invalid role "${m.role}", will default to "user"`);
      }

      return { ...m, matchedUserId, matchedManagerId, resolvedLevelId: resolved.levelId, action, errors, warnings };
    });

    setValidated(validatedRows);
    setStep("validate");
  }

  // ----------------------------------------------------------------
  // Step 4: Apply
  // ----------------------------------------------------------------

  async function applyImport() {
    setApplying(true);
    const errors: string[] = [];
    let created = 0;
    let updated = 0;
    let managersSet = 0;

    const applicable = validated.filter((v) => v.errors.length === 0);

    if (!workspaceId) {
      errors.push("Could not determine workspace. Please refresh and try again.");
      setResult({ created, updated, managersSet, skipped: validated.length - applicable.length, errors });
      setStep("done");
      setApplying(false);
      return;
    }

    if (applicable.length > 0) {
      // Chunk the import so the edge function never sees more than CHUNK_SIZE
      // rows per invocation. Each invocation creates/updates within its chunk;
      // cross-chunk manager references are resolved via link_user_managers
      // RPC once all chunks have finished. This lifts the ~500-row ceiling
      // imposed by Supabase edge function timeouts.
      const CHUNK_SIZE = 100;
      const rows = applicable.map((row) => ({
        email: row.email,
        name: row.name || undefined,
        department: row.department || undefined,
        job_title: row.job_title || undefined,
        manager_email: row.manager_email || undefined,
        role: row.role && VALID_ROLES.includes(row.role) ? row.role : undefined,
        start_date: row.start_date || undefined,
        level_id: row.resolvedLevelId || undefined,
        avatar_url: row.avatar_url || undefined,
      }));

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        setImportProgress({ done: i, total: rows.length });
        try {
          const { data, error } = await supabase.functions.invoke("import-csv-users", {
            body: { workspace_id: workspaceId, rows: chunk },
          });
          if (error) {
            errors.push(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1} failed: ${error.message}`);
          } else if (data) {
            created += data.created || 0;
            updated += data.updated || 0;
            managersSet += data.managersSet || 0;
            if (data.errors?.length) errors.push(...data.errors);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1} error: ${msg}`);
        }
      }
      setImportProgress({ done: rows.length, total: rows.length });

      // Second pass: resolve cross-chunk manager references. Within-chunk
      // references were already set by the edge function; this RPC only
      // finds and fills the ones it couldn't see.
      const managerPairs = rows
        .filter((r) => r.manager_email && r.email)
        .map((r) => ({ email: r.email, manager_email: r.manager_email }));
      if (managerPairs.length > 0) {
        try {
          const { data: linkData, error: linkErr } = await supabase.rpc(
            "link_user_managers",
            { p_pairs: managerPairs },
          );
          if (linkErr) {
            errors.push(`Manager linking failed: ${linkErr.message}`);
          } else if (linkData) {
            const rpcResult = linkData as { linked?: number };
            managersSet = Math.max(managersSet, rpcResult.linked ?? 0);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`Manager linking error: ${msg}`);
        }
      }
    }

    const skipped = validated.filter((v) => v.errors.length > 0).length;
    setResult({ created, updated, managersSet, skipped, errors });
    setStep("done");
    setApplying(false);
  }

  // ----------------------------------------------------------------
  // Stats for validation step
  // ----------------------------------------------------------------

  const createCount = validated.filter((v) => v.action === "create" && v.errors.length === 0).length;
  const updateCount = validated.filter((v) => v.action === "update" && v.errors.length === 0).length;
  const errorCount = validated.filter((v) => v.errors.length > 0).length;
  const realWarnings = validated.flatMap((v) => v.warnings.filter((w) => w.startsWith("warn:")));
  const infoNotes = validated.flatMap((v) => v.warnings.filter((w) => w.startsWith("info:")));
  const warningCount = realWarnings.length;
  const infoCount = infoNotes.length;
  const totalValid = createCount + updateCount;

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/team">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Import Team Data</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload a CSV to add new team members or update existing ones — departments, managers, levels, and roles
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {(["upload", "map", "validate", "done"] as Step[]).map((s, i) => {
          const labels = ["Upload", "Map Columns", "Validate", "Done"];
          const active = s === step || (s === "done" && step === "apply");
          const passed =
            (s === "upload" && step !== "upload") ||
            (s === "map" && ["validate", "apply", "done"].includes(step)) ||
            (s === "validate" && ["apply", "done"].includes(step));
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-border" />}
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : passed
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {passed && <CheckCircle2 className="h-3 w-3" />}
                {labels[i]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Upload CSV File</CardTitle>
            <CardDescription>
              Your CSV should have an email column. New emails will create team members;
              existing emails will update their data. Include a manager email column to build your org structure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById("csv-input")?.click()}
            >
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                Drop your CSV file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">Supports .csv files</p>
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={onFileSelect}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="text-xs gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Download Template
              </Button>
              <span className="text-xs text-muted-foreground">
                Pre-filled CSV with the right column headers
              </span>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border border-border/60">
              <p className="text-xs font-medium text-foreground mb-2">Supported columns:</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
                <span><strong>name</strong> — Full name</span>
                <span><strong>email</strong> — Work email (required)</span>
                <span><strong>department</strong> — e.g. Engineering</span>
                <span><strong>job_title</strong> — e.g. Senior Engineer</span>
                <span><strong>manager_email</strong> — Direct manager&apos;s email</span>
                <span><strong>level</strong> — Level name or grade</span>
                <span><strong>role</strong> — user, hr, or admin (manager status is determined by having direct reports)</span>
                <span><strong>start_date</strong> — Starting date (YYYY-MM-DD)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Map Columns */}
      {step === "map" && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Map Columns</CardTitle>
            <CardDescription>
              We auto-detected some columns. Verify the mapping below.
              {rawRows.length} rows found.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-4 p-2 rounded-lg border border-border/60">
                  <span className="text-sm font-medium text-foreground w-40 truncate">{h}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Select
                    value={mapping[h] || "skip"}
                    onValueChange={(val) => setColumnMapping(h, val)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">-- Skip --</SelectItem>
                      {TARGET_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapping[h] && (
                    <span className="text-xs text-muted-foreground">
                      e.g. &quot;{rawRows[0]?.[h] || ""}&quot;
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Preview */}
            {rawRows.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Preview (first 3 rows):
                </p>
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        {headers.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">
                            {mapping[h] ? (
                              <Badge variant="outline" className="text-[10px]">{mapping[h]}</Badge>
                            ) : (
                              <span className="text-muted-foreground/40">{h}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-border/40">
                          {headers.map((h) => (
                            <td key={h} className="px-3 py-1.5 text-foreground truncate max-w-[200px]">
                              {row[h] || ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={proceedToValidate} disabled={!emailMapped}>
                {!emailMapped ? "Map the Email column to continue" : "Validate"}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Validate */}
      {step === "validate" && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Validation Results</CardTitle>
            <CardDescription>
              Review the matches below before applying.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap gap-3">
              {createCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-400/10">
                  <UserPlus className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs font-medium text-sky-700 dark:text-sky-400">
                    {createCount} new user{createCount !== 1 ? "s" : ""} to create
                  </span>
                </div>
              )}
              {updateCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-400/10">
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {updateCount} existing user{updateCount !== 1 ? "s" : ""} to update
                  </span>
                </div>
              )}
              {infoCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-400/10">
                  <Info className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs font-medium text-sky-700 dark:text-sky-400">
                    {infoCount} note{infoCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {warningCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-400/10">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    {warningCount} warning{warningCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {errorCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-400/10">
                  <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">
                    {errorCount} error{errorCount !== 1 ? "s" : ""} (will skip)
                  </span>
                </div>
              )}
            </div>

            {/* Row list */}
            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40">
              {validated.map((row) => {
                const hasError = row.errors.length > 0;
                const hasWarning = row.warnings.length > 0;
                const isCreate = row.action === "create" && !hasError;
                return (
                  <div
                    key={row.rowIdx}
                    className={`flex items-start gap-3 px-3 py-2 text-xs ${
                      hasError ? "bg-red-50/50 dark:bg-red-900/10" : isCreate ? "bg-sky-50/50 dark:bg-sky-900/10" : ""
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {hasError ? (
                        <X className="h-3.5 w-3.5 text-red-500" />
                      ) : isCreate ? (
                        <UserPlus className="h-3.5 w-3.5 text-sky-500" />
                      ) : hasWarning ? (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{row.email || "(empty)"}</span>
                        {isCreate && (
                          <Badge variant="outline" className="text-[10px] text-sky-600 border-sky-300 dark:text-sky-400 dark:border-sky-600">new</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {row.name && (
                          <Badge variant="outline" className="text-[10px]">name: {row.name}</Badge>
                        )}
                        {row.department && (
                          <Badge variant="outline" className="text-[10px]">dept: {row.department}</Badge>
                        )}
                        {row.job_title && (
                          <Badge variant="outline" className="text-[10px]">title: {row.job_title}</Badge>
                        )}
                        {row.manager_email && (
                          <Badge variant="outline" className="text-[10px]">
                            manager: {row.matchedManagerId ? "matched" : "in CSV"}
                          </Badge>
                        )}
                        {row.role && (
                          <Badge variant="outline" className="text-[10px]">role: {row.role}</Badge>
                        )}
                        {row.start_date && (
                          <Badge variant="outline" className="text-[10px]">start: {row.start_date}</Badge>
                        )}
                      </div>
                      {(row.errors.length > 0 || row.warnings.length > 0) && (
                        <div className="mt-1.5 space-y-1">
                          {row.errors.map((e, i) => (
                            <div key={`e${i}`} className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                              <span className="shrink-0 mt-0.5">✕</span>
                              <span>{e}</span>
                            </div>
                          ))}
                          {row.warnings.map((w, i) => {
                            const [severity, type, ...msgParts] = w.split(":");
                            const msg = msgParts.join(":");
                            const isInfo = severity === "info";

                            const resolutionTips: Record<string, string> = {
                              manager_in_csv: "No action needed — manager will be created first, then linked automatically.",
                              manager_missing: "Options: Add the manager to this CSV, create them manually first, or import without — assign manager later in Directory.",
                              role_default: "Will be imported as regular user. You can change their role later in Directory.",
                            };

                            const tip = resolutionTips[type] || "";

                            return (
                              <div key={`w${i}`} className="group relative">
                                <div className={`flex items-start gap-1.5 text-xs cursor-help ${
                                  isInfo
                                    ? "text-sky-600 dark:text-sky-400"
                                    : "text-amber-600 dark:text-amber-400"
                                }`}>
                                  <span className="shrink-0 mt-0.5">{isInfo ? "ℹ" : "⚠"}</span>
                                  <span>{msg}</span>
                                </div>
                                {tip && (
                                  <div className="hidden group-hover:block absolute left-4 top-full z-50 mt-1 w-72 p-2.5 rounded-lg bg-popover border shadow-lg text-xs text-popover-foreground">
                                    <p className="font-medium mb-1">{isInfo ? "ℹ️ Info" : "💡 How to resolve"}</p>
                                    <p className="text-muted-foreground leading-relaxed">{tip}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button onClick={applyImport} disabled={totalValid === 0 || applying}>
                {applying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    {importProgress
                      ? `Importing ${importProgress.done}/${importProgress.total}…`
                      : "Importing…"}
                  </>
                ) : (
                  <>
                    {createCount > 0 && `Create ${createCount}`}
                    {createCount > 0 && updateCount > 0 && " + "}
                    {updateCount > 0 && `Update ${updateCount}`}
                    {createCount === 0 && updateCount === 0 && "No valid rows"}
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Done */}
      {step === "done" && result && (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-foreground">Import Complete</p>
              <div className="text-sm text-muted-foreground mt-2 space-y-1">
                {result.created > 0 && (
                  <p>{result.created} new user{result.created !== 1 ? "s" : ""} created</p>
                )}
                {result.updated > 0 && (
                  <p>{result.updated} existing user{result.updated !== 1 ? "s" : ""} updated</p>
                )}
                {result.managersSet > 0 && (
                  <p>{result.managersSet} manager relationship{result.managersSet !== 1 ? "s" : ""} set</p>
                )}
                {result.skipped > 0 && (
                  <p className="text-muted-foreground/70">{result.skipped} row{result.skipped !== 1 ? "s" : ""} skipped</p>
                )}
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="text-left max-w-md mx-auto p-3 rounded-lg bg-red-50 dark:bg-red-900/10 text-xs text-red-600 dark:text-red-400 space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
            <Button asChild className="mt-4">
              <Link href="/dashboard/team">Back to Team Directory</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
