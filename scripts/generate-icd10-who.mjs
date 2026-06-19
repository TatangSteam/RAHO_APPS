import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://icd.who.int/browse10/2019/en';
const OUT_FILE = path.resolve('apps/web/public/data/icd10-who-2019.json');
const CONCURRENCY = 16;
const REQUEST_TIMEOUT_MS = 20000;

const CODE_PATTERN = /^[A-Z]\d{2}(?:\.[A-Z0-9]+)?$/;
const BLOCK_PATTERN = /^[A-Z]\d{2}-[A-Z]\d{2}$/;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stripHtml(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function getName(node) {
  const text = stripHtml(node.html || '');
  if (!text) return '';

  const code = node.ID || '';
  return text.startsWith(code) ? text.slice(code.length).trim() : text;
}

async function getJson(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(300 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function getRootConcepts() {
  const json = await getJson(`${BASE_URL}/JsonGetRootConcepts`);
  return Array.isArray(json) ? json : json.value || [];
}

async function getChildren(conceptId) {
  const url = `${BASE_URL}/JsonGetChildrenConcepts?ConceptId=${encodeURIComponent(conceptId)}&useHtml=true&showAdoptedChildren=true`;
  const json = await getJson(url);
  return Array.isArray(json) ? json : json.value || [];
}

async function crawl() {
  const roots = await getRootConcepts();
  const queue = roots.map((node) => node.ID);
  const queued = new Set(queue);
  const visited = new Set();
  const codes = new Map();
  let active = 0;
  let completed = 0;
  let resolved = false;

  return new Promise((resolve, reject) => {
    const finish = () => {
      resolved = true;
      resolve(Array.from(codes.values()).sort((a, b) => a.code.localeCompare(b.code, 'en')));
    };

    const runNext = () => {
      if (resolved) return;

      while (active < CONCURRENCY && queue.length > 0) {
        const id = queue.shift();
        queued.delete(id);

        if (!id || visited.has(id)) {
          continue;
        }

        visited.add(id);
        active += 1;

        getChildren(id)
          .then((children) => {
            for (const child of children) {
              const childId = child.ID;
              if (!childId) continue;

              if (CODE_PATTERN.test(childId)) {
                codes.set(childId, {
                  code: childId,
                  namaIndonesia: '',
                  englishName: getName(child),
                });
              }

              if (!child.isLeaf && !visited.has(childId) && !queued.has(childId)) {
                queue.push(childId);
                queued.add(childId);
              }
            }
          })
          .catch((error) => {
            console.warn(`Skipping ${id}: ${error.message}`);
          })
          .finally(() => {
            active -= 1;
            completed += 1;

            if (completed % 250 === 0) {
              console.log(`Visited ${completed} concepts, queued ${queue.length}, collected ${codes.size} ICD codes...`);
            }

            if (queue.length === 0 && active === 0) {
              finish();
            } else {
              runNext();
            }
          });
      }

      if (queue.length === 0 && active === 0) {
        finish();
      }
    };

    try {
      runNext();
    } catch (error) {
      reject(error);
    }
  });
}

const data = await crawl();
await mkdir(path.dirname(OUT_FILE), { recursive: true });
await writeFile(
  OUT_FILE,
  `${JSON.stringify(
    {
      source: 'WHO ICD-10 Browser 2019',
      sourceUrl: 'https://icd.who.int/browse10/2019/en',
      generatedAt: new Date().toISOString(),
      total: data.length,
      codes: data,
    },
    null,
    2,
  )}\n`,
);

console.log(`Wrote ${data.length} ICD codes to ${OUT_FILE}`);
