/**
 * Client-side terminal export functions.
 * Pure client-side, no server interaction.
 * Converts terminal buffer to plain text or HTML with ANSI preserved as inline styles.
 */

/**
 * Strip ANSI escape sequences from a string, returning clean plain text.
 */
export function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "")
    .replace(/\x1b[[\];()][0-9;]*/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .trim();
}

/** Map of ANSI color codes to CSS colors, matching the xterm.js default theme. */
const ANSI_COLORS: Record<number, string> = {
  0: "#000000", 1: "#cd0000", 2: "#00cd00", 3: "#cdcd00",
  4: "#0000cd", 5: "#cd00cd", 6: "#00cdcd", 7: "#e5e5e5",
  8: "#7f7f7f", 9: "#ff0000", 10: "#00ff00", 11: "#ffff00",
  12: "#0000ff", 13: "#ff00ff", 14: "#00ffff", 15: "#ffffff",
};

function ansiColor(code: number): string {
  if (code < 16) return ANSI_COLORS[code] ?? "#ffffff";
  if (code < 232) {
    const c = code - 16;
    const r = Math.floor(c / 36) * 51;
    const g = Math.floor((c % 36) / 6) * 51;
    const b = (c % 6) * 51;
    return `rgb(${r},${g},${b})`;
  }
  const gray = 8 + (code - 232) * 10;
  return `rgb(${gray},${gray},${gray})`;
}

interface SpanState { bold: boolean; italic: boolean; underline: boolean; fg: string; bg: string; }

function resetState(): SpanState {
  return { bold: false, italic: false, underline: false, fg: "", bg: "" };
}

function openTag(state: SpanState): string {
  const styles: string[] = [];
  if (state.bold) styles.push("font-weight:bold");
  if (state.italic) styles.push("font-style:italic");
  if (state.underline) styles.push("text-decoration:underline");
  if (state.fg) styles.push(`color:${state.fg}`);
  if (state.bg) styles.push(`background:${state.bg}`);
  return styles.length ? `<span style="${styles.join(";")}">` : "";
}

function closeTag(): string {
  return "</span>";
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Convert ANSI-escaped terminal text to an HTML string.
 * ANSI SGR codes are translated to inline <span> styles.
 * The output is a complete <pre> block suitable for embedding.
 */
export function ansiToHtml(text: string): string {
  const lines: string[] = [];
  let state = resetState();
  let buf = "";
  let tagOpen = false;

  function flush() {
    if (buf) {
      if (!tagOpen) {
        const tag = openTag(state);
        if (tag) { lines.push(tag); tagOpen = true; }
      }
      lines.push(escapeHtml(buf));
      buf = "";
    }
  }

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\x1b" && text[i + 1] === "[") {
      const end = text.indexOf("m", i + 2);
      if (end !== -1) {
        flush();
        if (tagOpen) { lines.push(closeTag()); tagOpen = false; }
        const params = text.slice(i + 2, end).split(";").filter(Boolean).map(Number);
        if (params.length === 0 || params[0] === 0) {
          state = resetState();
        } else {
          let j = 0;
          while (j < params.length) {
            const p = params[j];
            if (p === 0) state = resetState();
            else if (p === 1) state.bold = true;
            else if (p === 3) state.italic = true;
            else if (p === 4) state.underline = true;
            else if (p === 22) state.bold = false;
            else if (p === 23) state.italic = false;
            else if (p === 24) state.underline = false;
            else if (30 <= p && p <= 37) state.fg = ansiColor(p - 30);
            else if (p === 38 && j + 2 < params.length && params[j + 1] === 5) {
              state.fg = ansiColor(params[j + 2]); j += 2;
            } else if (p === 38 && j + 4 < params.length && params[j + 1] === 2) {
              state.fg = `rgb(${params[j+2]},${params[j+3]},${params[j+4]})`; j += 4;
            } else if (p === 39) state.fg = "";
            else if (40 <= p && p <= 47) state.bg = ansiColor(p - 40);
            else if (p === 48 && j + 2 < params.length && params[j + 1] === 5) {
              state.bg = ansiColor(params[j + 2]); j += 2;
            } else if (p === 48 && j + 4 < params.length && params[j + 1] === 2) {
              state.bg = `rgb(${params[j+2]},${params[j+3]},${params[j+4]})`; j += 4;
            } else if (p === 49) state.bg = "";
            else if (90 <= p && p <= 97) state.fg = ansiColor(p - 90 + 8);
            else if (100 <= p && p <= 107) state.bg = ansiColor(p - 100 + 8);
            j++;
          }
        }
        i = end + 1;
        continue;
      }
      // Non-SGR CSI: skip to the terminator
      const anyEnd = text.slice(i + 2).search(/[a-zA-Z]/);
      if (anyEnd !== -1) { i += 2 + anyEnd + 1; continue; }
      buf += ch; i++;
    } else if (ch === "\x1b" && text[i + 1] === "]") {
      const bel = text.indexOf("\x07", i);
      const st = text.indexOf("\x1b\\", i);
      const end = bel !== -1 ? (st !== -1 ? Math.min(bel, st) : bel) : st;
      if (end !== -1) { i = end + (text[end] === "\x07" ? 1 : 2); continue; }
      buf += ch; i++;
    } else if (ch === "\r") {
      flush(); i++;
    } else if (ch === "\x08") {
      flush(); if (buf.length > 0) buf = buf.slice(0, -1); i++;
    } else if (ch === "\x07" || ch === "\x0e" || ch === "\x0f") { i++; }
    else { buf += ch; i++; }
  }
  flush();
  if (tagOpen) lines.push(closeTag());

  return `<pre style="background:#0d1117;color:#e0e0e0;padding:12px;font-family:monospace;line-height:1.45;overflow:auto;white-space:pre-wrap;word-break:break-all">\n${lines.join("")}\n</pre>`;
}

/**
 * Trigger a browser download of the given content as a file.
 */
export function downloadFile(content: string, filename: string, mime: string = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export terminal buffer as plain text and trigger download.
 */
export function exportAsPlainText(buffer: string, sessionName: string = "terminal"): void {
  const text = stripAnsi(buffer);
  downloadFile(text, `${sessionName}-export.txt`, "text/plain");
}

/**
 * Export terminal buffer as HTML (ANSI preserved as inline styles) and trigger download.
 */
export function exportAsHtml(buffer: string, sessionName: string = "terminal"): void {
  const html = ansiToHtml(buffer);
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>sshx Export — ${escapeHtml(sessionName)}</title>
</head>
<body style="margin:0;background:#0d1117">
${html}
</body>
</html>`;
  downloadFile(page, `${sessionName}-export.html`, "text/html");
}
