"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { createBrowserClient } from "@supabase/ssr";
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
  Loader2,
  ArrowRight,
  X,
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
  department?: string;
  job_title?: string;
  manager_email?: string;
  level?: string;
  role?: string;
}

interface ValidatedUser extends MappedUser {
  matchedUserId: string | null;
  matchedManagerId: string | null;
  matchedLevelId: string | null;
  errors: string[];
  warnings: string[];
}

interface ApplyResult {
  updated: number;
  skipped: number;
  errors: string[];
}

// Known column aliases for fuzzy matching
const COLUMN_ALIASES: Record<string, string[]> = {
  email: ["email", "e-mail", "email address", "mail", "slack_email", "work email", "employee email"],
  department: ["department", "dept", "team", "division", "group", "org"],
  job_title: ["job title", "title", "position", "role title", "job_title", "jobtitle"],
  manager_email: ["manager email", "manager_email", "manager", "reports to", "reports_to", "manager mail", "line manager"],
  level: ["level", "grade", "seniority", "job level", "career level", "band"],
  role: ["system role", "app role", "role", "access", "permission"],
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
  { value: "email", label: "Email (required)", required: true },
  { value: "department", label: "Department" },
  { value: "job_title", label: "Job Title" },
  { value: "manager_email", label: "Manager Email" },
  { value: "level", label: "Level / Grade" },
  { value: "role", label: "System Role" },
];

const VALID_ROLES = ["user", "manager", "hr", "admin"];

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
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // DB refs
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [dbLevels, setDbLevels] = useState<any[]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load DB data once
  useEffect(() => {
    async function load() {
      const [{ data: users }, { data: levels }] = await Promise.all([
        supabase.from("users").select("id, slack_email, slack_name"),
        supabase.from("levels").select("id, name, grade, job_family:job_families(name)"),
      ]);
      setDbUsers(users || []);
      setDbLevels(levels || []);
    }
    load();
  }, []);

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
      email: (row[reverseMap["email"]] || "").trim().toLowerCase(),
      department: reverseMap["department"] ? (row[reverseMap["department"]] || "").trim() : undefined,
      job_title: reverseMap["job_title"] ? (row[reverseMap["job_title"]] || "").trim() : undefined,
      manager_email: reverseMap["manager_email"] ? (row[reverseMap["manager_email"]] || "").trim().toLowerCase() : undefined,
      level: reverseMap["level"] ? (row[reverseMap["level"]] || "").trim() : undefined,
      role: reverseMap["role"] ? (row[reverseMap["role"]] || "").trim().toLowerCase() : undefined,
    }));

    // Build email -> user map
    const emailToUser = new Map<string, any>();
    dbUsers.forEach((u) => {
      if (u.slack_email) emailToUser.set(u.slack_email.toLowerCase(), u);
    });

    // Build level lookup
    const levelByName = new Map<string, string>();
    const levelByGrade = new Map<string, string>();
    dbLevels.forEach((l: any) => {
      levelByName.set(l.name.toLowerCase(), l.id);
      if (l.grade) levelByGrade.set(l.grade.toLowerCase(), l.id);
    });

    // Validate
    const validatedRows: ValidatedUser[] = mapped.map((m) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      let matchedUserId: string | null = null;
      let matchedManagerId: string | null = null;
      let matchedLevelId: string | null = null;

      // Email match
      if (!m.email) {
        errors.push("Missing email");
      } else {
        const user = emailToUser.get(m.email);
        if (!user) {
          errors.push(`No user found with email "${m.email}"`);
        } else {
          matchedUserId = user.id;
        }
      }

      // Manager match
      if (m.manager_email) {
        const mgr = emailToUser.get(m.manager_email);
        if (!mgr) {
          warnings.push(`Manager "${m.manager_email}" not found in system`);
        } else {
          matchedManagerId = mgr.id;
        }
      }

      // Level match
      if (m.level) {
        const lv = m.level.toLowerCase();
        const byName = levelByName.get(lv);
        const byGrade = levelByGrade.get(lv);
        if (byName) {
          matchedLevelId = byName;
        } else if (byGrade) {
          matchedLevelId = byGrade;
        } else {
          warnings.push(`Level "${m.level}" not found. Check Job Families.`);
        }
      }

      // Role validation
      if (m.role && !VALID_ROLES.includes(m.role)) {
        warnings.push(`Invalid role "${m.role}", will default to "user"`);
      }

      return { ...m, matchedUserId, matchedManagerId, matchedLevelId, errors, warnings };
    });

    setValidated(validatedRows);
    setStep("validate");
  }

  // ----------------------------------------------------------------
  // Step 4: Apply
  // ----------------------------------------------------------------

  async function applyImport() {
    setApplying(true);
    const applicable = validated.filter((v) => v.matchedUserId && v.errors.length === 0);
    let updated = 0;
    const errors: string[] = [];

    for (const row of applicable) {
      const updateData: any = {};
      if (row.department) updateData.department = row.department;
      if (row.job_title) updateData.job_title = row.job_title;
      if (row.matchedManagerId) updateData.manager_id = row.matchedManagerId;
      if (row.matchedLevelId) updateData.level_id = row.matchedLevelId;
      if (row.role && VALID_ROLES.includes(row.role)) updateData.role = row.role;
      updateData.updated_at = new Date().toISOString();

      if (Object.keys(updateData).length <= 1) continue; // only updated_at

      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", row.matchedUserId!);

      if (error) {
        errors.push(`Row ${row.rowIdx + 1} (${row.email}): ${error.message}`);
      } else {
        updated++;
      }
    }

    const skipped = validated.length - applicable.length;
    setResult({ updated, skipped, errors });
    setStep("done");
    setApplying(false);
  }

  // ----------------------------------------------------------------
  // Stats for validation step
  // ----------------------------------------------------------------

  const validCount = validated.filter((v) => v.matchedUserId && v.errors.length === 0).length;
  const errorCount = validated.filter((v) => v.errors.length > 0).length;
  const warningCount = validated.filter((v) => v.warnings.length > 0 && v.errors.length === 0).length;

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
            Upload a CSV to bulk-update departments, managers, levels, and roles
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
              Your CSV should have an email column that matches your Slack workspace emails.
              Additional columns can include department, job title, manager email, level, and role.
            </CardDescription>
          </CardHeader>
          <CardContent>
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

            <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border/60">
              <p className="text-xs font-medium text-foreground mb-2">Example CSV format:</p>
              <code className="text-[11px] text-muted-foreground block whitespace-pre leading-relaxed">
{`email,department,job_title,manager_email,level,role
jane@company.com,Engineering,Senior Engineer,cto@company.com,IC3,user
bob@company.com,Design,Lead Designer,vp@company.com,IC4,manager`}
              </code>
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
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-400/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {validCount} ready
                </span>
              </div>
              {warningCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-400/10">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    {warningCount} warnings
                  </span>
                </div>
              )}
              {errorCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-400/10">
                  <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">
                    {errorCount} errors (will skip)
                  </span>
                </div>
              )}
            </div>

            {/* Row list */}
            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40">
              {validated.map((row) => {
                const hasError = row.errors.length > 0;
                const hasWarning = row.warnings.length > 0;
                return (
                  <div
                    key={row.rowIdx}
                    className={`flex items-start gap-3 px-3 py-2 text-xs ${
                      hasError ? "bg-red-50/50 dark:bg-red-900/10" : ""
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {hasError ? (
                        <X className="h-3.5 w-3.5 text-red-500" />
                      ) : hasWarning ? (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">{row.email || "(empty)"}</span>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {row.department && (
                          <Badge variant="outline" className="text-[10px]">dept: {row.department}</Badge>
                        )}
                        {row.job_title && (
                          <Badge variant="outline" className="text-[10px]">title: {row.job_title}</Badge>
                        )}
                        {row.matchedManagerId && (
                          <Badge variant="outline" className="text-[10px]">manager matched</Badge>
                        )}
                        {row.matchedLevelId && (
                          <Badge variant="outline" className="text-[10px]">level matched</Badge>
                        )}
                        {row.role && (
                          <Badge variant="outline" className="text-[10px]">role: {row.role}</Badge>
                        )}
                      </div>
                      {(row.errors.length > 0 || row.warnings.length > 0) && (
                        <div className="mt-1 space-y-0.5">
                          {row.errors.map((e, i) => (
                            <p key={i} className="text-red-600 dark:text-red-400">{e}</p>
                          ))}
                          {row.warnings.map((w, i) => (
                            <p key={i} className="text-amber-600 dark:text-amber-400">{w}</p>
                          ))}
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
              <Button onClick={applyImport} disabled={validCount === 0 || applying}>
                {applying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    Apply to {validCount} user{validCount !== 1 ? "s" : ""}
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
              <p className="text-sm text-muted-foreground mt-1">
                {result.updated} user{result.updated !== 1 ? "s" : ""} updated
                {result.skipped > 0 && `, ${result.skipped} skipped`}
              </p>
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
