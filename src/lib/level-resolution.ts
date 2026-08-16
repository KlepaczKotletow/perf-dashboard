/**
 * Resolving CSV "Function" + "Level" names to a `users.level_id`.
 *
 * The importer receives human names ("Engineering", "Senior Engineer") but the
 * users table stores a level uuid. The deployed `import-csv-users` edge
 * function already writes `row.level_id` on both create and update — the
 * client simply never supplied one, which is why CSV-imported people always
 * landed with no competency bracket.
 *
 * Kept as a pure function so the matching rules are testable: getting this
 * wrong silently assigns someone the wrong career level, which then drives the
 * expected-proficiency targets their reviewers rate against.
 */

export interface LevelRef {
  id: string;
  name: string | null;
  familyName: string | null;
}

export interface LevelResolution {
  levelId: string | null;
  /** Prefixed `warn:`/`info:` to match the importer's warning convention. */
  warning: string | null;
}

const norm = (v: string | undefined | null) => (v || "").trim().toLowerCase();

export function resolveLevel(
  levels: LevelRef[],
  fn: string | undefined,
  lvl: string | undefined
): LevelResolution {
  if (!norm(fn) && !norm(lvl)) return { levelId: null, warning: null };

  const byFamilyLevel = new Map<string, string>();
  const byLevelName = new Map<string, string[]>();
  for (const l of levels) {
    if (l.familyName && l.name) byFamilyLevel.set(`${norm(l.familyName)}|${norm(l.name)}`, l.id);
    if (l.name) {
      const list = byLevelName.get(norm(l.name)) ?? [];
      list.push(l.id);
      byLevelName.set(norm(l.name), list);
    }
  }

  if (norm(fn) && norm(lvl)) {
    const hit = byFamilyLevel.get(`${norm(fn)}|${norm(lvl)}`);
    if (hit) return { levelId: hit, warning: null };
    return {
      levelId: null,
      warning: `warn:level_missing:No level "${lvl}" under function "${fn}" — create it in Functions first, or the competency bracket stays empty`,
    };
  }

  if (norm(lvl)) {
    const matches = byLevelName.get(norm(lvl)) ?? [];
    if (matches.length === 1) return { levelId: matches[0], warning: null };
    if (matches.length > 1) {
      // Never guess: picking one would silently put someone on the wrong ladder.
      return {
        levelId: null,
        warning: `warn:level_ambiguous:Level "${lvl}" exists in more than one function — add a Function column to disambiguate`,
      };
    }
    return {
      levelId: null,
      warning: `warn:level_missing:Level "${lvl}" not found — create it in Functions first, or the competency bracket stays empty`,
    };
  }

  return {
    levelId: null,
    warning: `info:level_needed:Function "${fn}" given without a Level — both are needed to set a competency bracket`,
  };
}
