import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'docs', 'moex');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url, retries = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          Accept: 'text/html,application/pdf,application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(500 * attempt);
      }
    }
  }

  throw lastError;
};

const decodeHtmlEntities = (input) => {
  const named = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
  };

  let output = input.replace(
    /(&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;)/g,
    (m) => named[m] ?? m
  );
  output = output.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16))
  );
  output = output.replace(/&#(\d+);/g, (_, num) =>
    String.fromCodePoint(parseInt(num, 10))
  );
  return output;
};

const extractBody = (html) => {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
};

const htmlToMarkdown = (html) => {
  let md = extractBody(html);

  md = md.replace(/<script[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '');
  md = md.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
    const decoded = decodeHtmlEntities(code.trim());
    return `\n\n\`\`\`\n${decoded}\n\`\`\`\n\n`;
  });

  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code) => {
    const decoded = decodeHtmlEntities(code.trim());
    return `\`${decoded}\``;
  });

  for (let level = 6; level >= 1; level -= 1) {
    const regex = new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi');
    md = md.replace(regex, (_, text) => {
      const clean = decodeHtmlEntities(text.replace(/<[^>]+>/g, '').trim());
      return `\n\n${'#'.repeat(level)} ${clean}\n\n`;
    });
  }

  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>/gi, '\n\n');
  md = md.replace(/<\/p>/gi, '\n\n');

  md = md.replace(/<ul[^>]*>/gi, '\n');
  md = md.replace(/<\/ul>/gi, '\n');
  md = md.replace(/<ol[^>]*>/gi, '\n');
  md = md.replace(/<\/ol>/gi, '\n');
  md = md.replace(/<li[^>]*>/gi, '\n- ');
  md = md.replace(/<\/li>/gi, '\n');

  md = md.replace(/<strong[^>]*>/gi, '**');
  md = md.replace(/<\/strong>/gi, '**');
  md = md.replace(/<b[^>]*>/gi, '**');
  md = md.replace(/<\/b>/gi, '**');
  md = md.replace(/<em[^>]*>/gi, '_');
  md = md.replace(/<\/em>/gi, '_');
  md = md.replace(/<i[^>]*>/gi, '_');
  md = md.replace(/<\/i>/gi, '_');

  md = md.replace(
    /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => {
      const cleanText = decodeHtmlEntities(text.replace(/<[^>]+>/g, '').trim());
      return `[${cleanText}](${href})`;
    }
  );

  md = md.replace(/<\/?[^>]+>/g, '');
  md = decodeHtmlEntities(md);

  md = md.replace(/\r\n/g, '\n');
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.replace(/[ \t]+\n/g, '\n');

  return md.trim() + '\n';
};

const writeDocsReadme = async () => {
  const content = `# MOEX ISS Docs Cache

This folder stores a cached copy of the official MOEX ISS reference pages so
developers can browse the API docs offline.

To refresh the cache:

\`\`\`bash
task moex:docs
\`\`\`

Primary source: https://iss.moex.com/iss/reference/
`;

  await writeFile(path.join(outDir, 'README.md'), content, 'utf8');
};

const main = async () => {
  await mkdir(outDir, { recursive: true });

  console.log('Fetching https://iss.moex.com/iss/reference/');
  const html = await fetchWithRetry('https://iss.moex.com/iss/reference/');
  await writeFile(path.join(outDir, 'iss-reference.html'), html, 'utf8');
  const markdown = htmlToMarkdown(html);
  await writeFile(path.join(outDir, 'iss-reference.md'), markdown, 'utf8');

  await writeDocsReadme();

  console.log(`MOEX docs saved to ${outDir}`);
};

main().catch((error) => {
  console.error('Failed to fetch MOEX docs:', error);
  process.exit(1);
});
