const { createHash } = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const container = process.env.POSTGRES_CONTAINER || 'raho-postgres';
const user = process.env.POSTGRES_USER || 'raho_user';
const sourceDatabase = process.env.SOURCE_DATABASE || 'raho-db';
const restoreDatabase = process.env.RESTORE_DATABASE || 'raho_restore_rehearsal';
const outputDirectory = path.resolve(process.argv[2] || path.join(process.cwd(), 'backups', 'database-rehearsal'));
const safeIdentifier = /^[A-Za-z][A-Za-z0-9_-]{0,62}$/;
const criticalTables = [
  '_prisma_migrations',
  'accounts',
  'members',
  'member_packages',
  'invoices',
  'invoice_items',
  'invoice_payments',
  'cash_bank_transactions',
  'opening_balances',
  'opening_balance_lines',
  'expenses',
  'suppliers',
  'purchase_requests',
  'purchase_request_items',
  'purchase_orders',
  'purchase_order_items',
  'goods_receipts',
  'goods_receipt_items',
  'supplier_invoices',
  'supplier_invoice_lines',
  'supplier_payments',
  'inventory_items',
  'inventory_balances',
  'inventory_cost_layers',
  'inventory_postings',
  'stock_mutations',
  'stock_requests',
  'stock_request_items',
  'stock_reservations',
  'journal_entries',
  'journal_lines',
  'shipments',
  'shipment_items',
  'treatment_sessions',
  'material_usages',
  'package_revenue_contracts',
  'deferred_revenue_movements',
  'revenue_recognitions',
];

const businessTotalQueries = {
  'packages.final_price': 'SELECT COALESCE(SUM("finalPrice"), 0)::text FROM "member_packages"',
  'packages.verified_paid': 'SELECT COALESCE(SUM("totalVerifiedPaid"), 0)::text FROM "member_packages"',
  'packages.total_sessions': 'SELECT COALESCE(SUM("totalSessions"), 0)::text FROM "member_packages"',
  'packages.used_sessions': 'SELECT COALESCE(SUM("usedSessions"), 0)::text FROM "member_packages"',
  'invoices.total_amount': 'SELECT COALESCE(SUM("totalAmount"), 0)::text FROM "invoices"',
  'payments.verified_amount': 'SELECT COALESCE(SUM("amount"), 0)::text FROM "invoice_payments" WHERE "verificationStatus" = \'VERIFIED\'',
  'cash_bank.posted_amount': 'SELECT COALESCE(SUM("amount"), 0)::text FROM "cash_bank_transactions" WHERE "status" = \'POSTED\'',
  'expenses.paid_amount': 'SELECT COALESCE(SUM("amount"), 0)::text FROM "expenses" WHERE "status" = \'PAID\'',
  'purchase_orders.total_amount': 'SELECT COALESCE(SUM("totalAmount"), 0)::text FROM "purchase_orders"',
  'goods_receipts.total_quantity': 'SELECT COALESCE(SUM("totalQuantity"), 0)::text FROM "goods_receipts"',
  'goods_receipts.total_value': 'SELECT COALESCE(SUM("totalValue"), 0)::text FROM "goods_receipts"',
  'supplier_invoices.amount': 'SELECT COALESCE(SUM("amount"), 0)::text FROM "supplier_invoices"',
  'supplier_invoices.paid_amount': 'SELECT COALESCE(SUM("paidAmount"), 0)::text FROM "supplier_invoices"',
  'supplier_invoices.balance_amount': 'SELECT COALESCE(SUM("balanceAmount"), 0)::text FROM "supplier_invoices"',
  'supplier_payments.amount': 'SELECT COALESCE(SUM("amount"), 0)::text FROM "supplier_payments"',
  'inventory.compatibility_stock': 'SELECT COALESCE(SUM("stock"), 0)::text FROM "inventory_items"',
  'inventory.on_hand': 'SELECT COALESCE(SUM("onHandQty"), 0)::text FROM "inventory_balances"',
  'inventory.reserved': 'SELECT COALESCE(SUM("reservedQty"), 0)::text FROM "inventory_balances"',
  'inventory.quarantine': 'SELECT COALESCE(SUM("quarantineQty"), 0)::text FROM "inventory_balances"',
  'inventory.in_transit': 'SELECT COALESCE(SUM("inTransitQty"), 0)::text FROM "inventory_balances"',
  'inventory.cost_layer_quantity': 'SELECT COALESCE(SUM("remainingQty"), 0)::text FROM "inventory_cost_layers" WHERE "isVoided" = false',
  'inventory.cost_layer_value': 'SELECT COALESCE(SUM("remainingQty" * COALESCE("unitCost", 0)), 0)::text FROM "inventory_cost_layers" WHERE "isVoided" = false',
  'journals.posted_debit': 'SELECT COALESCE(SUM("totalDebit"), 0)::text FROM "journal_entries" WHERE "status" = \'POSTED\'',
  'journals.posted_credit': 'SELECT COALESCE(SUM("totalCredit"), 0)::text FROM "journal_entries" WHERE "status" = \'POSTED\'',
  'deferred.total_consideration': 'SELECT COALESCE(SUM("totalConsideration"), 0)::text FROM "package_revenue_contracts"',
  'deferred.funded': 'SELECT COALESCE(SUM("fundedDeferredAmount"), 0)::text FROM "package_revenue_contracts"',
  'deferred.recognized': 'SELECT COALESCE(SUM("recognizedAmount"), 0)::text FROM "package_revenue_contracts"',
  'deferred.remaining': 'SELECT COALESCE(SUM("remainingDeferredAmount"), 0)::text FROM "package_revenue_contracts"',
};

function assertSafeConfiguration() {
  for (const [name, value] of Object.entries({ container, user, sourceDatabase, restoreDatabase })) {
    if (!safeIdentifier.test(value)) throw new Error(`${name} tidak valid: ${value}`);
  }
  if (sourceDatabase === restoreDatabase) throw new Error('Database sumber dan restore wajib berbeda.');
  if (!/(restore|rehearsal|test)/i.test(restoreDatabase)) {
    throw new Error('Nama RESTORE_DATABASE wajib mengandung restore, rehearsal, atau test.');
  }
  const workspace = path.resolve(process.cwd());
  if (outputDirectory === workspace || outputDirectory === path.parse(outputDirectory).root) {
    throw new Error('Direktori output backup terlalu luas.');
  }
}

function run(command, args, options = {}) {
  const output = execFileSync(command, args, { encoding: 'utf8', stdio: options.capture ? 'pipe' : 'inherit' });
  return typeof output === 'string' ? output.trim() : '';
}

function docker(args, options) {
  return run('docker', args, options);
}

function tableSnapshots(database) {
  const sql = criticalTables
    .map((table) => `SELECT '${table}', COUNT(*)::text, COALESCE(SUM(hashtextextended(row_to_json(snapshot_row)::text, 0)::numeric), 0)::text, COALESCE(SUM(hashtextextended(row_to_json(snapshot_row)::text, 104729)::numeric), 0)::text FROM "${table}" AS snapshot_row`)
    .join(' UNION ALL ');
  const output = docker(['exec', container, 'psql', '-U', user, '-d', database, '-At', '-F', '|', '-c', sql], { capture: true });
  return Object.fromEntries(output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [table, rowCount, hashSeed0, hashSeed104729] = line.split('|');
    return [table, { rowCount: Number(rowCount), hashSeed0, hashSeed104729 }];
  }));
}

function businessTotals(database) {
  const sql = Object.entries(businessTotalQueries)
    .map(([key, query]) => `SELECT '${key}', (${query})`)
    .join(' UNION ALL ');
  const output = docker(['exec', container, 'psql', '-U', user, '-d', database, '-At', '-F', '|', '-c', sql], { capture: true });
  return Object.fromEntries(output.split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf('|');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

function assertSnapshotsMatch(source, restored) {
  const mismatches = criticalTables.flatMap((table) => JSON.stringify(source[table]) === JSON.stringify(restored[table])
    ? []
    : [{ table, source: source[table], restored: restored[table] }]);
  if (mismatches.length) throw new Error(`Restore table snapshot mismatch: ${JSON.stringify(mismatches)}`);
}

function assertBusinessTotalsMatch(source, restored) {
  const mismatches = Object.keys(businessTotalQueries).flatMap((key) => source[key] === restored[key]
    ? []
    : [{ key, source: source[key], restored: restored[key] }]);
  if (mismatches.length) throw new Error(`Restore business-total mismatch: ${JSON.stringify(mismatches)}`);
}

function main() {
  assertSafeConfiguration();
  fs.mkdirSync(outputDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const dumpName = `raho-${sourceDatabase}-${timestamp}.dump`;
  const localDump = path.join(outputDirectory, dumpName);
  const evidenceFile = `${localDump}.restore-evidence.json`;
  const containerDump = `/tmp/${dumpName}`;
  const restoreDump = `/tmp/restore-${dumpName}`;
  const startedAt = Date.now();

  try {
    const sourceSnapshots = tableSnapshots(sourceDatabase);
    const sourceBusinessTotals = businessTotals(sourceDatabase);
    docker(['exec', container, 'pg_dump', '-U', user, '-d', sourceDatabase, '--format=custom', '--compress=9', '--no-owner', '--no-acl', '--file', containerDump]);
    docker(['exec', container, 'pg_restore', '--list', containerDump], { capture: true });
    docker(['cp', `${container}:${containerDump}`, localDump]);

    const checksum = createHash('sha256').update(fs.readFileSync(localDump)).digest('hex');
    fs.writeFileSync(`${localDump}.sha256`, `${checksum}  ${dumpName}\n`, { mode: 0o600 });

    docker(['exec', container, 'dropdb', '-U', user, '--if-exists', '--force', restoreDatabase]);
    docker(['exec', container, 'createdb', '-U', user, restoreDatabase]);
    docker(['cp', localDump, `${container}:${restoreDump}`]);
    docker(['exec', container, 'pg_restore', '-U', user, '-d', restoreDatabase, '--no-owner', '--no-acl', '--exit-on-error', restoreDump]);

    const restoredSnapshots = tableSnapshots(restoreDatabase);
    const restoredBusinessTotals = businessTotals(restoreDatabase);
    assertSnapshotsMatch(sourceSnapshots, restoredSnapshots);
    assertBusinessTotalsMatch(sourceBusinessTotals, restoredBusinessTotals);
    const unresolvedMigrations = Number(docker([
      'exec', container, 'psql', '-U', user, '-d', restoreDatabase, '-At', '-c',
      'SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL',
    ], { capture: true }));
    if (unresolvedMigrations !== 0) throw new Error(`${unresolvedMigrations} migration belum selesai pada hasil restore.`);

    const evidence = {
      status: 'PASS',
      generatedAt: new Date().toISOString(),
      sourceDatabase,
      restoreDatabase,
      dumpFile: localDump,
      dumpBytes: fs.statSync(localDump).size,
      sha256: checksum,
      durationMs: Date.now() - startedAt,
      unresolvedMigrations,
      verifiedTableCount: criticalTables.length,
      verifiedBusinessTotalCount: Object.keys(businessTotalQueries).length,
      sourceSnapshots,
      restoredSnapshots,
      sourceBusinessTotals,
      restoredBusinessTotals,
    };
    fs.writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } finally {
    try { docker(['exec', container, 'rm', '-f', containerDump, restoreDump], { capture: true }); } catch (_) { /* best-effort temporary-file cleanup */ }
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Database backup/restore rehearsal gagal: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  criticalTables,
  businessTotalQueries,
  assertSnapshotsMatch,
  assertBusinessTotalsMatch,
};
