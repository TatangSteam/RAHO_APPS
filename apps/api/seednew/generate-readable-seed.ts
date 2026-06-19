import * as fs from 'fs';
import * as path from 'path';

type SqlValue = string | number | boolean | null;

type ParsedInsert = {
  table: string;
  columns: string[];
  values: SqlValue[];
};

const DEFAULT_SKIP_TABLES = new Set(['public._prisma_migrations']);

function readArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function stripIdentifierQuotes(value: string): string {
  return value.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      current += char;
      if (char === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        i++;
        blockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '-' && next === '-') {
        current += char + next;
        i++;
        lineComment = true;
        continue;
      }

      if (char === '/' && next === '*') {
        current += char + next;
        i++;
        blockComment = true;
        continue;
      }
    }

    if (char === "'" && !inDoubleQuote) {
      current += char;
      if (inSingleQuote && next === "'") {
        current += next;
        i++;
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      current += char;
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const statement = current.trim();
      if (statement) statements.push(`${statement};`);
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

function splitTopLevelComma(value: string): string[] {
  const items: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let parenDepth = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const next = value[i + 1];

    if (char === "'" && !inDoubleQuote) {
      current += char;
      if (inSingleQuote && next === "'") {
        current += next;
        i++;
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      current += char;
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '(') parenDepth++;
      if (char === ')') parenDepth--;

      if (char === ',' && parenDepth === 0) {
        items.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) items.push(current.trim());
  return items;
}

function parseSqlString(token: string): string {
  const isEscaped = token.startsWith("E'");
  const start = isEscaped ? 2 : 1;
  let body = token.slice(start, -1).replace(/''/g, "'");

  if (isEscaped) {
    body = body
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }

  return body;
}

function parseValue(token: string): SqlValue {
  const trimmed = token.trim();

  if (/^NULL$/i.test(trimmed)) return null;
  if (/^true$/i.test(trimmed)) return true;
  if (/^false$/i.test(trimmed)) return false;

  if (/^E?'(?:''|[^'])*'$/.test(trimmed)) {
    return parseSqlString(trimmed);
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const numericValue = Number(trimmed);
    if (Number.isSafeInteger(numericValue) || trimmed.includes('.')) {
      return numericValue;
    }
  }

  return trimmed;
}

function parseInsert(statement: string): ParsedInsert | null {
  const match = statement.match(/^INSERT INTO\s+(.+?)\s+\(([\s\S]+?)\)\s+VALUES\s+\(([\s\S]+)\);?$/i);
  if (!match) return null;

  const [, table, columnsPart, valuesPart] = match;
  const columns = splitTopLevelComma(columnsPart).map(stripIdentifierQuotes);
  const values = splitTopLevelComma(valuesPart).map(parseValue);

  if (columns.length !== values.length) {
    throw new Error(`Jumlah kolom dan value tidak sama untuk ${table}: ${columns.length} vs ${values.length}`);
  }

  return {
    table: table.trim(),
    columns,
    values,
  };
}

function toRecord(insert: ParsedInsert): Record<string, SqlValue> {
  return insert.columns.reduce<Record<string, SqlValue>>((row, column, index) => {
    row[column] = insert.values[index];
    return row;
  }, {});
}

function renderReadableSeed(seedTables: Array<{ table: string; rows: Record<string, SqlValue>[] }>): string {
  return `import { PrismaClient } from '@prisma/client';

type SeedValue = string | number | boolean | null;
type SeedRow = Record<string, SeedValue>;
type SeedTable = {
  table: string;
  rows: SeedRow[];
};

const seedTables: SeedTable[] = ${JSON.stringify(seedTables, null, 2)};

const deferredColumnsByTable: Record<string, string[]> = {
  'public.member_packages': ['upgradedFromId'],
  'public.therapy_plans': ['supersededById'],
};

const prisma = new PrismaClient();

function quoteIdentifier(identifier: string): string {
  return '"' + identifier.replace(/"/g, '""') + '"';
}

function quoteTableName(tableName: string): string {
  return tableName
    .split('.')
    .map((part) => quoteIdentifier(part.replace(/^"|"$/g, '')))
    .join('.');
}

function sqlLiteral(value: SeedValue): string {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return "'" + value.replace(/'/g, "''") + "'";
}

function buildInsert(table: string, row: SeedRow): string {
  const columns = Object.keys(row);
  const columnSql = columns.map(quoteIdentifier).join(', ');
  const valueSql = columns.map((column) => sqlLiteral(row[column])).join(', ');

  return \`INSERT INTO \${quoteTableName(table)} (\${columnSql}) VALUES (\${valueSql}) ON CONFLICT DO NOTHING;\`;
}

function buildUpdate(table: string, id: SeedValue, column: string, value: SeedValue): string {
  return \`UPDATE \${quoteTableName(table)} SET \${quoteIdentifier(column)} = \${sqlLiteral(value)} WHERE "id" = \${sqlLiteral(id)};\`;
}

async function main(): Promise<void> {
  console.log(\`Running readable seed for \${seedTables.length} tables...\`);

  for (const seedTable of seedTables) {
    const deferredColumns = deferredColumnsByTable[seedTable.table] ?? [];
    console.log(\`Seeding \${seedTable.table}: \${seedTable.rows.length} rows\`);

    for (const row of seedTable.rows) {
      const insertRow = { ...row };
      for (const column of deferredColumns) {
        if (insertRow[column] !== null && insertRow[column] !== undefined) {
          insertRow[column] = null;
        }
      }

      await prisma.$executeRawUnsafe(buildInsert(seedTable.table, insertRow));
    }
  }

  for (const seedTable of seedTables) {
    const deferredColumns = deferredColumnsByTable[seedTable.table] ?? [];
    if (deferredColumns.length === 0) continue;

    console.log(\`Restoring deferred references for \${seedTable.table}\`);
    for (const row of seedTable.rows) {
      if (!('id' in row)) continue;

      for (const column of deferredColumns) {
        const value = row[column];
        if (value === null || value === undefined) continue;
        await prisma.$executeRawUnsafe(buildUpdate(seedTable.table, row.id, column, value));
      }
    }
  }

  console.log('Readable seed selesai.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
`;
}

function main(): void {
  const cwd = process.cwd();
  const inputPath = path.resolve(cwd, readArg('input', 'seed.sql'));
  const outputPath = path.resolve(cwd, readArg('output', 'seed-readable.ts'));
  const includeMigrations = process.argv.includes('--include-migrations');

  if (!fs.existsSync(inputPath)) {
    throw new Error(`File SQL tidak ditemukan: ${inputPath}`);
  }

  const sql = fs.readFileSync(inputPath, 'utf8');
  const tables = new Map<string, Record<string, SqlValue>[]>();

  for (const statement of splitSqlStatements(sql)) {
    const insert = parseInsert(statement);
    if (!insert) continue;
    if (!includeMigrations && DEFAULT_SKIP_TABLES.has(insert.table)) continue;

    const rows = tables.get(insert.table) ?? [];
    rows.push(toRecord(insert));
    tables.set(insert.table, rows);
  }

  const seedTables = [...tables.entries()].map(([table, rows]) => ({ table, rows }));
  fs.writeFileSync(outputPath, renderReadableSeed(seedTables), 'utf8');

  const rowCount = seedTables.reduce((total, table) => total + table.rows.length, 0);
  console.log(`Generated ${outputPath}`);
  console.log(`Tables: ${seedTables.length}`);
  console.log(`Rows: ${rowCount}`);
  if (!includeMigrations) {
    console.log('Skipped table: public._prisma_migrations');
  }
}

main();
