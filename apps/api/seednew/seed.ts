import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote: string | null = null;
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

    if (!inSingleQuote && !inDoubleQuote && !inDollarQuote) {
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
      if (char === '$') {
        const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
        if (match) {
          inDollarQuote = match[0];
          current += match[0];
          i += match[0].length - 1;
          continue;
        }
      }
    }

    if (inDollarQuote) {
      if (sql.slice(i, i + inDollarQuote.length) === inDollarQuote) {
        current += inDollarQuote;
        i += inDollarQuote.length - 1;
        inDollarQuote = null;
      } else {
        current += char;
      }
      continue;
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
      if (statement) statements.push(statement + ';');
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function main() {
  const sqlPath = path.join(process.cwd(), 'prisma', 'seed.sql');

  if (!fs.existsSync(sqlPath)) {
    throw new Error(`File tidak ditemukan: ${sqlPath}. Generate dulu seed.sql dari postgres.dump.`);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8')
    .replace(/^\s*SET\s+[^;]+;\s*/gim, '')
    .replace(/^\s*SELECT\s+pg_catalog\.set_config\([^;]+;\s*/gim, '');

  const statements = splitSqlStatements(sql)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => !statement.startsWith('--'));

  console.log(`Running ${statements.length} SQL seed statements...`);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  console.log('Seed selesai.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
