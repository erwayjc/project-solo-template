/**
 * Pre-migration SQL validation utility.
 *
 * Catches destructive SQL operations before they're applied.
 * Called by Claude Code before writing migration files.
 * Uses regex pattern matching — may produce false positives on
 * string literals, which is acceptable (safe > sorry).
 */

const CRITICAL_TABLES = [
  "profiles",
  "site_config",
  "products",
  "purchases",
  "agents",
  "mcp_connections",
] as const;

const CRITICAL_FUNCTIONS = ["handle_new_user", "is_admin"] as const;

const CRITICAL_TRIGGERS = ["on_auth_user_created"] as const;

interface ValidationWarning {
  severity: "critical" | "warning";
  message: string;
  pattern: string;
}

interface ValidationResult {
  safe: boolean;
  warnings: ValidationWarning[];
}

/**
 * Strip SQL comments to reduce false positives/negatives (F6).
 * Removes -- line comments and /* block comments *​/.
 */
function stripComments(sql: string): string {
  // Remove block comments (non-greedy, handles nested poorly but sufficient)
  let stripped = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments
  stripped = stripped.replace(/--.*$/gm, "");
  return stripped;
}

export function validateMigration(sql: string): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const cleaned = stripComments(sql);

  // --- Critical patterns (always flag) ---

  // DROP TABLE on critical tables (F13: handle schema-qualified names)
  for (const table of CRITICAL_TABLES) {
    const pattern = `DROP\\s+TABLE\\s+(IF\\s+EXISTS\\s+)?(public\\.)?("?${table}"?)`;
    if (new RegExp(pattern, "i").test(cleaned)) {
      warnings.push({
        severity: "critical",
        message: `Dropping critical table "${table}" will cause data loss and break core functionality`,
        pattern: `DROP TABLE ${table}`,
      });
    }
  }

  // DROP COLUMN on critical tables
  for (const table of CRITICAL_TABLES) {
    const pattern = `ALTER\\s+TABLE\\s+(public\\.)?("?${table}"?)\\s+DROP\\s+COLUMN`;
    if (new RegExp(pattern, "i").test(cleaned)) {
      warnings.push({
        severity: "critical",
        message: `Dropping columns from critical table "${table}" may break core functionality`,
        pattern: `ALTER TABLE ${table} DROP COLUMN`,
      });
    }
  }

  // DROP FUNCTION for critical functions
  for (const fn of CRITICAL_FUNCTIONS) {
    const pattern = `DROP\\s+FUNCTION\\s+(IF\\s+EXISTS\\s+)?(public\\.)?("?${fn}"?)`;
    if (new RegExp(pattern, "i").test(cleaned)) {
      const reason =
        fn === "handle_new_user"
          ? "required for user registration — removing it breaks all new signups"
          : "prevents RLS recursion — removing it breaks all admin database access";
      warnings.push({
        severity: "critical",
        message: `Dropping function "${fn}" — ${reason}`,
        pattern: `DROP FUNCTION ${fn}`,
      });
    }
  }

  // DROP TRIGGER for critical triggers
  for (const trigger of CRITICAL_TRIGGERS) {
    const pattern = `DROP\\s+TRIGGER\\s+(IF\\s+EXISTS\\s+)?("?${trigger}"?)`;
    if (new RegExp(pattern, "i").test(cleaned)) {
      warnings.push({
        severity: "critical",
        message: `Dropping trigger "${trigger}" will break automatic profile creation on user signup`,
        pattern: `DROP TRIGGER ${trigger}`,
      });
    }
  }

  // DISABLE ROW LEVEL SECURITY
  if (
    /ALTER\s+TABLE\s+\S+\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(cleaned)
  ) {
    warnings.push({
      severity: "critical",
      message:
        "Disabling RLS exposes all table data to all users — this is a security vulnerability",
      pattern: "DISABLE ROW LEVEL SECURITY",
    });
  }

  // --- Warning patterns (flag with context) ---

  // DROP TABLE on non-critical tables
  const dropTableRegex =
    /DROP\s+TABLE\s+(IF\s+EXISTS\s+)?(public\.)?(\S+)/gi;
  let dropTableMatch;
  while ((dropTableMatch = dropTableRegex.exec(cleaned)) !== null) {
    const tableName = (dropTableMatch[3] || "").replace(/"/g, "");
    const isCritical = CRITICAL_TABLES.some(
      (t) => t.toLowerCase() === tableName.toLowerCase()
    );
    if (!isCritical) {
      warnings.push({
        severity: "warning",
        message:
          "Dropping a table will permanently delete all its data — ensure you have a backup",
        pattern: dropTableMatch[0].trim(),
      });
    }
  }

  // DROP TABLE ... CASCADE (F16 — particularly dangerous)
  if (/DROP\s+TABLE\s+.*CASCADE/i.test(cleaned)) {
    warnings.push({
      severity: "warning",
      message:
        "DROP TABLE with CASCADE will also drop all dependent objects (foreign keys, views, policies)",
      pattern: "DROP TABLE ... CASCADE",
    });
  }

  // DROP COLUMN on non-critical tables
  const dropColRegex =
    /ALTER\s+TABLE\s+(public\.)?(\S+)\s+DROP\s+COLUMN\s+(\S+)/gi;
  let dropColMatch;
  while ((dropColMatch = dropColRegex.exec(cleaned)) !== null) {
    const tableName = dropColMatch[2].replace(/"/g, "");
    const isCritical = CRITICAL_TABLES.some(
      (t) => t.toLowerCase() === tableName.toLowerCase()
    );
    if (!isCritical) {
      warnings.push({
        severity: "warning",
        message: `Dropping column from "${tableName}" will permanently delete that column's data`,
        pattern: dropColMatch[0].trim(),
      });
    }
  }

  // DROP POLICY
  if (/DROP\s+POLICY/i.test(cleaned)) {
    warnings.push({
      severity: "warning",
      message:
        "Dropping an RLS policy may expose data — verify the policy is truly unused or being replaced",
      pattern: "DROP POLICY",
    });
  }

  // CASCADE in ALTER TABLE
  if (/ALTER\s+TABLE\s+.*CASCADE/i.test(cleaned)) {
    warnings.push({
      severity: "warning",
      message:
        "CASCADE will propagate changes to dependent objects — verify no unintended side effects",
      pattern: "ALTER TABLE ... CASCADE",
    });
  }

  // DELETE FROM without WHERE
  if (/DELETE\s+FROM\s+\S+\s*;/i.test(cleaned)) {
    warnings.push({
      severity: "warning",
      message:
        "DELETE FROM without a WHERE clause will delete ALL rows in the table",
      pattern: "DELETE FROM ... (no WHERE)",
    });
  }

  // TRUNCATE
  if (/\bTRUNCATE\b/i.test(cleaned)) {
    warnings.push({
      severity: "warning",
      message: "TRUNCATE removes all rows from the table immediately",
      pattern: "TRUNCATE",
    });
  }

  // F9: safe is false only when critical-severity warnings exist
  const hasCritical = warnings.some((w) => w.severity === "critical");

  return {
    safe: !hasCritical,
    warnings,
  };
}
