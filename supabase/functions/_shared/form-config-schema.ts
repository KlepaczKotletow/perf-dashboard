// Schema validator for feedback_form_configs.fields rows.
//
// The fields column is jsonb — admins drive its shape via the form-builder
// UI, but a malformed/poisoned row could break the Slack modal render or
// inject unexpected values into Block Kit. This validator coerces a raw
// DB value into a known-safe shape before it hits buildFeedbackModalBlocks.
//
// Output mirrors the existing FormField interface in slack-commands so the
// downstream renderer doesn't need to change.

type FieldType = "user_select" | "single_select" | "text" | "checkbox";
const ALLOWED_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  "user_select",
  "single_select",
  "text",
  "checkbox",
]);

export interface SafeFormField {
  id: string;
  blockId?: string;
  type: FieldType;
  label: string;
  required: boolean;
  multiline?: boolean;
  options?: string[];
  initialOptions?: string[];
  placeholder?: string;
}

const ID_RE = /^[a-z0-9_]{1,64}$/;
const MAX_LABEL_LEN = 200;
const MAX_OPTION_LEN = 100;
const MAX_OPTIONS = 50;
const MAX_FIELDS = 20;

function safeOptions(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: string[] = [];
  for (const o of input) {
    // Accept legacy string[] AND modern { value, label } objects (we keep
    // the label/value distinction for future use, but render as string[]
    // for compatibility with the existing buildFeedbackModalBlocks).
    if (typeof o === "string" && o.length > 0 && o.length <= MAX_OPTION_LEN) {
      out.push(o);
    } else if (
      o && typeof o === "object" &&
      typeof (o as { label?: unknown }).label === "string" &&
      (o as { label: string }).label.length <= MAX_LABEL_LEN &&
      (o as { label: string }).label.length > 0
    ) {
      out.push((o as { label: string }).label);
    }
    if (out.length >= MAX_OPTIONS) break;
  }
  return out.length > 0 ? out : undefined;
}

export function validateFormFields(input: unknown): SafeFormField[] {
  if (!Array.isArray(input)) return [];
  const out: SafeFormField[] = [];
  const seenIds = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    if (typeof f.id !== "string" || !ID_RE.test(f.id)) continue;
    if (seenIds.has(f.id)) continue; // dedupe id collisions
    if (typeof f.type !== "string" || !ALLOWED_TYPES.has(f.type as FieldType)) continue;
    if (typeof f.label !== "string" || f.label.length === 0 || f.label.length > MAX_LABEL_LEN) continue;
    seenIds.add(f.id);
    const options = safeOptions(f.options);
    const initialOptions = safeOptions(f.initialOptions);
    out.push({
      id: f.id,
      blockId: typeof f.blockId === "string" && ID_RE.test(f.blockId) ? f.blockId : undefined,
      type: f.type as FieldType,
      label: f.label,
      required: f.required === true,
      multiline: f.multiline === true,
      options,
      initialOptions,
      placeholder: typeof f.placeholder === "string" && f.placeholder.length <= MAX_LABEL_LEN
        ? f.placeholder
        : undefined,
    });
    if (out.length >= MAX_FIELDS) break;
  }
  return out;
}
