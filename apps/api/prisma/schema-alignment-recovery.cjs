const { createHash } = require('node:crypto');

// Preserve migration history. Only these exact, reviewed SQL files may be
// replayed; this is NOT a generic "ignore migration errors" mechanism.
const ALIGNMENT_MIGRATIONS = {
  '20260729084954_rahoapps': 'abdcad2102b24f318de198eedeb7f096d9ac0dc3601ccc6f18b31040369d99bd',
  '20260818042140_teest': '608f663cd85ca26a21f9fb7b31264e1441143563a24833e9744cc9249c622eb7',
};

function buildAlignmentRepair(name, source) {
  const sql = source.replace(/\r\n/g, '\n');
  const expected = ALIGNMENT_MIGRATIONS[name];
  if (!expected || createHash('sha256').update(sql).digest('hex') !== expected) {
    throw new Error(`Unrecognized SQL/checksum for ${name}; refusing schema recovery.`);
  }
  const original = sql.replace(/^--.*$/gm, '').split(';').map((statement) => statement.trim()).filter(Boolean);
  return original.map((statement) => {
    if (/^DROP INDEX "[A-Za-z0-9_]+"$/.test(statement)) {
      return statement.replace('DROP INDEX ', 'DROP INDEX IF EXISTS ');
    }
    if (/^ALTER TABLE "[A-Za-z0-9_]+" DROP CONSTRAINT "[A-Za-z0-9_]+"$/.test(statement)) {
      return statement.replace('DROP CONSTRAINT ', 'DROP CONSTRAINT IF EXISTS ');
    }
    if (/^ALTER TABLE "[A-Za-z0-9_]+" ALTER COLUMN "updatedAt" DROP DEFAULT$/.test(statement)
      || /^ALTER TABLE "[A-Za-z0-9_]+" ADD CONSTRAINT "[A-Za-z0-9_]+" FOREIGN KEY \("[A-Za-z0-9_]+"\) REFERENCES "[A-Za-z0-9_]+"\("id"\) ON DELETE SET NULL ON UPDATE CASCADE$/.test(statement)) {
      return statement;
    }
    const foreignKey = statement.match(/^ALTER TABLE "([A-Za-z0-9_]+)" RENAME CONSTRAINT "([A-Za-z0-9_]+)" TO "([A-Za-z0-9_]+)"$/);
    const index = statement.match(/^ALTER INDEX "([A-Za-z0-9_]+)" RENAME TO "([A-Za-z0-9_]+)"$/);
    let oldExists;
    let newExists;
    let deferredIndex = '';
    if (foreignKey) {
      const [, table, from, to] = foreignKey;
      const exists = (name) => `EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"${table}"'::regclass AND conname = '${name}' AND contype = 'f')`;
      oldExists = exists(from);
      newExists = exists(to);
    } else if (index) {
      const [, from, to] = index;
      const exists = (name) => `EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = current_schema()::regnamespace AND relname = '${name}' AND relkind = 'i')`;
      oldExists = exists(from);
      newExists = exists(to);
      // The July 29 alignment mistakenly references a table created later
      // that day. Only this exact absent table/index may be deferred; a new
      // final reconciliation migration applies the rename after table creation.
      const lateIndexes = {
        supplier_invoice_lines_supplierInvoiceId_purchaseOrderItemId_ke: ['supplier_invoice_lines', '20260729130000_add_supplier_invoice_lines'],
        zoho_reconciliation_results_runId_entityType_localEntityId_zoho: ['zoho_reconciliation_results', '20260729170000_add_zoho_sprint14_controls'],
      };
      if (name === '20260729084954_rahoapps' && Object.prototype.hasOwnProperty.call(lateIndexes, from)) {
        const [table, creationMigration] = lateIndexes[from];
        deferredIndex = `ELSIF to_regclass('"${table}"') IS NULL AND NOT EXISTS (
          SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '${creationMigration}'
          AND finished_at IS NOT NULL AND rolled_back_at IS NULL
        ) THEN NULL;`;
      }
    } else {
      throw new Error(`Unsupported recovery statement for ${name}: ${statement}`);
    }
    // Already renamed is safe on replay. Missing both or duplicate names is
    // unknown drift: abort the entire transaction rather than fake success.
    return `DO $repair$ BEGIN
      IF ${oldExists} THEN
        IF ${newExists} THEN RAISE EXCEPTION 'Conflicting schema objects during ${name} recovery'; END IF;
        ${statement};
      ${deferredIndex}
      ELSIF NOT (${newExists}) THEN
        RAISE EXCEPTION 'Missing source and target during ${name} recovery: ${statement}';
      END IF;
    END $repair$`;
  });
}

function isKnownAlignmentFailure(row, source) {
  if (!Object.prototype.hasOwnProperty.call(ALIGNMENT_MIGRATIONS, row.migration_name)) return false;
  // The only accepted entry points are missing objects touched by that exact
  // migration. Permission, integrity, connection, and syntax failures refuse.
  const logs = String(row.logs || '');
  if (!/(?:Database error code:\s*(?:42704|42P01)|SqlState\(E(?:42704|42P01)\))/.test(logs)) return false;
  const missingIndex = logs.match(/ERROR:\s*index "([A-Za-z0-9_]+)" does not exist/);
  const missingRelation = logs.match(/ERROR:\s*relation "([A-Za-z0-9_]+)" does not exist/);
  const missingConstraint = logs.match(/ERROR:\s*constraint "([A-Za-z0-9_]+)" of relation "([A-Za-z0-9_]+)" does not exist/);
  if (missingIndex) {
    return source.includes(`DROP INDEX "${missingIndex[1]}";`) || source.includes(`ALTER INDEX "${missingIndex[1]}" RENAME TO`);
  }
  if (missingRelation) return source.includes(`ALTER INDEX "${missingRelation[1]}" RENAME TO`);
  if (missingConstraint) {
    return source.includes(`ALTER TABLE "${missingConstraint[2]}" DROP CONSTRAINT "${missingConstraint[1]}";`)
      || source.includes(`ALTER TABLE "${missingConstraint[2]}" RENAME CONSTRAINT "${missingConstraint[1]}" TO`);
  }
  return false;
}

module.exports = { ALIGNMENT_MIGRATIONS, buildAlignmentRepair, isKnownAlignmentFailure };
