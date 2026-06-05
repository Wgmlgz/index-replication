import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'docs', 'moex');
const htmlDir = path.join(outDir, 'html');
const mdDir = path.join(outDir, 'md');
const referenceBaseUrl = 'https://iss.moex.com/iss/reference/';
const referenceLang = 'en';

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

const normalizeMarkdown = (md) => {
  let output = md;
  output = output.replace(/\*\*Default:\s*\*\*/g, '**Default:**');
  output = output.replace(/\*\*Type:\s*\*\*/g, '**Type:**');
  return output;
};

const isHeaderLine = (line) => /^#{1,6}\s+/.test(line.trim());
const isSectionLine = (line) => /\([A-Z]+\)$/.test(line.trim());

const parseArgument = (lines, startIndex) => {
  const name = lines[startIndex]?.trim();
  if (!name) {
    return { rendered: null, nextIndex: startIndex + 1 };
  }

  let i = startIndex + 1;
  const descParts = [];
  let defValue = '';
  let typeValue = '';

  for (; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    if (!defValue && !typeValue && (isHeaderLine(trimmed) || isSectionLine(trimmed))) {
      return { rendered: null, nextIndex: startIndex + 1 };
    }

    if (defValue || typeValue) {
      if (isHeaderLine(trimmed) || isSectionLine(trimmed)) {
        break;
      }
    }

    if (trimmed.startsWith('**Default:**')) {
      defValue = trimmed.replace('**Default:**', '').trim() || '—';
      continue;
    }

    if (trimmed.startsWith('**Type:**')) {
      typeValue = trimmed.replace('**Type:**', '').trim() || '—';
      continue;
    }

    if (defValue || typeValue) {
      break;
    }

    descParts.push(trimmed);
  }

  const description = descParts.join(' ').trim();
  const defaultText = defValue || '—';
  const typeText = typeValue || '—';

  const details = [
    description ? description : null,
    `default: ${defaultText}`,
    `type: ${typeText}`,
  ].filter(Boolean);

  const rendered = `- \`${name}\` — ${details.join(', ')}`;
  return { rendered, nextIndex: i };
};

const formatArguments = (md) => {
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    out.push(line);

    if (line.trim() !== '## Arguments') {
      i += 1;
      continue;
    }

    i += 1;
    if (out[out.length - 1]?.trim() !== '') {
      out.push('');
    }

    while (i < lines.length && !isHeaderLine(lines[i])) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        i += 1;
        continue;
      }

      if (isSectionLine(trimmed)) {
        if (out[out.length - 1]?.trim() !== '') {
          out.push('');
        }
        out.push(trimmed);
        out.push('');
        i += 1;
        continue;
      }

      const { rendered, nextIndex } = parseArgument(lines, i);
      if (rendered) {
        out.push(rendered);
        i = nextIndex;
        continue;
      }

      out.push(lines[i]);
      i += 1;
    }
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
};

const writeDocsReadme = async () => {
  const content = `# MOEX ISS Docs Cache

This folder stores a cached copy of the official MOEX ISS reference pages so
developers can browse the API docs offline.

Artifacts:

- \`html/index.html\` (reference index page)
- \`md/index.md\` (reference index page)
- \`html/<id>.html\` (endpoint pages)
- \`md/<id>.md\` (endpoint pages)

To refresh the cache:

\`\`\`bash
task moex:docs
\`\`\`

Primary source: https://iss.moex.com/iss/reference/
`;

  await writeFile(path.join(outDir, 'README.md'), content, 'utf8');
};

const rewriteReferenceLinks = (input, extension) => {
  return input
    .replace(
      /href=["'](?:https?:\/\/iss\.moex\.com)?\/iss\/reference\/(\d+)(?:\?lang=[^"']*)?["']/gi,
      (_, id) => `href="./${id}.${extension}"`
    )
    .replace(
      /href=["']\.\/(\d+)(?:\?lang=[^"']*)?["']/gi,
      (_, id) => `href="./${id}.${extension}"`
    );
};

const rewriteMarkdownLinks = (input) => {
  return input
    .replace(
      /\((?:https?:\/\/iss\.moex\.com)?\/iss\/reference\/(\d+)(?:\?lang=[^)]+)?\)/gi,
      (_, id) => `(./${id}.md)`
    )
    .replace(/\(\.\/(\d+)(?:\?lang=[^)]+)?\)/gi, (_, id) => `(./${id}.md)`);
};

const extractReferenceIds = (html) => {
  const ids = new Set();
  const regex =
    /href=["'](?:https?:\/\/iss\.moex\.com)?\/iss\/reference\/(\d+)(?:\?lang=[^"']*)?["']|href=["']\.\/(\d+)(?:\?lang=[^"']*)?["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const id = match[1] ?? match[2];
    if (id) {
      ids.add(id);
    }
  }
  return Array.from(ids).sort((a, b) => Number(a) - Number(b));
};

const main = async () => {
  await mkdir(htmlDir, { recursive: true });
  await mkdir(mdDir, { recursive: true });

  const indexUrl = `${referenceBaseUrl}?lang=${referenceLang}`;
  console.log(`Fetching ${indexUrl}`);
  const indexHtmlRaw = await fetchWithRetry(indexUrl);
  const indexHtml = rewriteReferenceLinks(indexHtmlRaw, 'html');
  await writeFile(path.join(htmlDir, 'index.html'), indexHtml, 'utf8');
  const indexMarkdown = formatArguments(
    normalizeMarkdown(rewriteMarkdownLinks(htmlToMarkdown(indexHtmlRaw)))
  );
  await writeFile(path.join(mdDir, 'index.md'), indexMarkdown, 'utf8');

  const ids = extractReferenceIds(indexHtmlRaw);
  console.log(`Found ${ids.length} reference pages.`);

  for (const [idx, id] of ids.entries()) {
    const pageUrl = `${referenceBaseUrl}${id}?lang=${referenceLang}`;
    console.log(`(${idx + 1}/${ids.length}) Fetching ${pageUrl}`);
    const pageHtmlRaw = await fetchWithRetry(pageUrl);
    const pageHtml = rewriteReferenceLinks(pageHtmlRaw, 'html');
    await writeFile(path.join(htmlDir, `${id}.html`), pageHtml, 'utf8');
    const pageMarkdown = formatArguments(
      normalizeMarkdown(rewriteMarkdownLinks(htmlToMarkdown(pageHtmlRaw)))
    );
    await writeFile(path.join(mdDir, `${id}.md`), pageMarkdown, 'utf8');
    await sleep(150);
  }

  await writeDocsReadme();

  console.log(`MOEX docs saved to ${outDir}`);
};

main().catch((error) => {
  console.error('Failed to fetch MOEX docs:', error);
  process.exit(1);
});
