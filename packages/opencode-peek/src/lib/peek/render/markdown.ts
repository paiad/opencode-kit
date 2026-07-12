const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "file:"]);

export function escapeHtml(value: any) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeUrl(value: any) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    const url = new URL(text, "file:///");
    return ALLOWED_URL_PROTOCOLS.has(url.protocol) ? text : "";
  } catch {
    return "";
  }
}

export function renderMarkdown(value: any) {
  const text = String(value ?? "");
  if (!text.trim()) return `<p class="muted">Empty text.</p>`;

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index++;
      continue;
    }

    const fence = line.match(/^\s*```(\S*)\s*$/);
    if (fence) {
      const code = [];
      index++;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        code.push(lines[index]);
      index++;
      }
      if (index < lines.length) index++;
      const codeText = code.join("\n");
      const codeAttr = escapeHtml(codeText).replace(/\r/g, "&#13;").replace(/\n/g, "&#10;");
      blocks.push(`<div class="md-code-shell" data-copy-source="${codeAttr}">
        <button class="md-code-copy" type="button" aria-label="Copy code"></button>
        <pre class="md-code"><code>${escapeHtml(codeText)}</code></pre>
      </div>`);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level + 2} class="md-heading">${renderInline(heading[2])}</h${level + 2}>`);
      index++;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      blocks.push(`<hr class="md-rule">`);
      index++;
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = [lines[index], lines[index + 1]];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        table.push(lines[index]);
        index++;
      }
      blocks.push(renderTable(table));
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index++;
      }
      blocks.push(`<blockquote>${renderParagraphs(quote.join("\n"))}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*[-*]\s+(.+)$/);
        if (!item) break;
        items.push(`<li>${renderInline(item[1])}</li>`);
        index++;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (ordered) {
      const items = [];
      const start = Number(ordered[1]);
      while (index < lines.length) {
        const item = lines[index].match(/^\s*(\d+)[.)]\s+(.+)$/);
        if (!item) break;
        items.push(`<li>${renderInline(item[2])}</li>`);
        index++;
      }
      const startAttr = Number.isInteger(start) && start !== 1 ? ` start="${start}"` : "";
      blocks.push(`<ol${startAttr}>${items.join("")}</ol>`);
      continue;
    }

    const paragraph = [line];
    index++;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index]);
      index++;
    }
    blocks.push(renderParagraphs(paragraph.join("\n")));
  }

  return `<div class="markdown-body">${blocks.join("")}</div>`;
}

function isBlockStart(line: any) {
  return /^\s*```/.test(line)
    || /^(#{1,3})\s+/.test(line)
    || /^---+\s*$/.test(line)
    || line.includes("|")
    || /^>\s?/.test(line)
    || /^\s*[-*]\s+/.test(line)
    || /^\s*\d+[.)]\s+/.test(line);
}

function isTableStart(lines: any, index: any) {
  const header = lines[index] || "";
  const separator = lines[index + 1] || "";
  // Accept shorter alignment markers like :--: that commonly appear in LLM output.
  return header.includes("|") && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(separator);
}

function renderTable(lines: any) {
  const header = splitTableRow(lines[0]);
  const rows = lines.slice(2).map(splitTableRow).filter((row: any) => row.length > 0);
  if (!header.length) return renderParagraphs(lines.join("\n"));
  return `<div class="md-table-wrap"><table>
    <thead><tr>${header.map((cell: any) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row: any) => `<tr>${header.map((_cell: any, index: any) => `<td>${renderInline(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function splitTableRow(line: any) {
  return String(line)
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell: any) => cell.trim());
}

function renderParagraphs(text: any) {
  return `<p>${renderInline(text).replaceAll("\n", "<br>")}</p>`;
}

function renderInline(value: any) {
  let text = escapeHtml(value);
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match: any, label: any, href: any) => {
    const url = safeUrl(unescapeHtmlEntities(href));
    if (!url) return label;
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  return text;
}

function unescapeHtmlEntities(value: any) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}
