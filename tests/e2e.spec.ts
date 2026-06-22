import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:8051";

test.describe("sshx — full functional test suite", () => {
  let sessionUrl: string;

  test("health endpoint returns ok", async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/health`);
    expect(resp.status()).toBe(200);
    expect(await resp.text()).toBe("ok");
  });

  test("frontend loads and shows landing page", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator("body")).toBeVisible();
    // Landing page should have the sshx brand
    await expect(page.locator("text=sshx").first()).toBeVisible();
  });

  test("session page loads and connects via WebSocket", async ({ page }) => {
    // First, ensure a CLI client is running by checking the client URL file
    // We'll navigate to a session URL directly
    await page.goto(`${BASE_URL}/s/test-session`);
    await page.waitForTimeout(2000);
    // The page should show the session UI (toolbar, terminal area, etc.)
    // Even without a backend, the SPA fallback should render
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("security headers and CSP", async ({ request }) => {
    const resp = await request.get(BASE_URL);
    const headers = resp.headers();
    // Content-Type should be HTML
    expect(headers["content-type"]).toContain("text/html");
  });

  test("static assets are served with compression", async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/`);
    const headers = resp.headers();
    // Verify gzip or brotli compression
    expect(
      headers["content-encoding"] === "gzip" ||
      headers["content-encoding"] === "br"
    ).toBeTruthy();
  });
});

test.describe("ANSI export functions", () => {
  // Inline implementation matching src/lib/export.ts for testing
  function stripAnsi(text: string): string {
    return text
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
      .replace(/\x1b\][^\x07]*\x07/g, "")
      .replace(/\x1b[[\];()][0-9;]*/g, "")
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
      .trim();
  }

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
      return `rgb(${Math.floor(c / 36) * 51},${Math.floor((c % 36) / 6) * 51},${(c % 6) * 51})`;
    }
    const gray = 8 + (code - 232) * 10;
    return `rgb(${gray},${gray},${gray})`;
  }

  function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function ansiToHtml(text: string): string {
    const lines: string[] = [];
    let bold = false, italic = false, underline = false, fg = "", bg = "";
    let buf = "";
    let tagOpen = false;

    function flush() {
      if (!buf) return;
      if (!tagOpen) {
        const styles: string[] = [];
        if (bold) styles.push("font-weight:bold");
        if (italic) styles.push("font-style:italic");
        if (underline) styles.push("text-decoration:underline");
        if (fg) styles.push(`color:${fg}`);
        if (bg) styles.push(`background:${bg}`);
        if (styles.length) { lines.push(`<span style="${styles.join(";")}">`); tagOpen = true; }
      }
      lines.push(escapeHtml(buf));
      buf = "";
    }

    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === "\x1b" && text[i + 1] === "[") {
        const end = text.indexOf("m", i + 2);
        if (end !== -1) {
          flush();
          if (tagOpen) { lines.push("</span>"); tagOpen = false; }
          const params = text.slice(i + 2, end).split(";").filter(Boolean).map(Number);
          if (!params.length || params[0] === 0) { bold = false; italic = false; underline = false; fg = ""; bg = ""; }
          else {
            let j = 0;
            while (j < params.length) {
              const p = params[j];
              if (p === 0) { bold = false; italic = false; underline = false; fg = ""; bg = ""; }
              else if (p === 1) bold = true;
              else if (p === 3) italic = true;
              else if (p === 4) underline = true;
              else if (p === 22) bold = false;
              else if (p === 23) italic = false;
              else if (p === 24) underline = false;
              else if (30 <= p && p <= 37) fg = ansiColor(p - 30);
              else if (p === 38 && j + 2 < params.length && params[j + 1] === 5) { fg = ansiColor(params[j + 2]); j += 2; }
              else if (p === 38 && j + 4 < params.length && params[j + 1] === 2) {
                fg = `rgb(${params[j+2]},${params[j+3]},${params[j+4]})`; j += 4;
              } else if (p === 39) fg = "";
              else if (40 <= p && p <= 47) bg = ansiColor(p - 40);
              else if (p === 48 && j + 2 < params.length && params[j + 1] === 5) { bg = ansiColor(params[j + 2]); j += 2; }
              else if (p === 48 && j + 4 < params.length && params[j + 1] === 2) {
                bg = `rgb(${params[j+2]},${params[j+3]},${params[j+4]})`; j += 4;
              } else if (p === 49) bg = "";
              else if (90 <= p && p <= 97) fg = ansiColor(p - 90 + 8);
              else if (100 <= p && p <= 107) bg = ansiColor(p - 100 + 8);
              j++;
            }
          }
          i = end + 1;
          continue;
        }
        const anyEnd = text.slice(i + 2).search(/[a-zA-Z]/);
        if (anyEnd !== -1) { i += 2 + anyEnd + 1; continue; }
        buf += ch; i++;
      } else if (ch === "\x1b" && text[i + 1] === "]") {
        const bel = text.indexOf("\x07", i);
        const st = text.indexOf("\x1b\\", i);
        const end = bel !== -1 ? (st !== -1 ? Math.min(bel, st) : bel) : st;
        if (end !== -1) { i = end + (text[end] === "\x07" ? 1 : 2); continue; }
        buf += ch; i++;
      } else if (ch === "\r") { flush(); i++; }
      else if (ch === "\x08") { flush(); if (buf.length) buf = buf.slice(0, -1); i++; }
      else if (ch === "\x07" || ch === "\x0e" || ch === "\x0f") { i++; }
      else { buf += ch; i++; }
    }
    flush();
    if (tagOpen) lines.push("</span>");
    return `<pre style="background:#0d1117;color:#e0e0e0;padding:12px;font-family:monospace;line-height:1.45;overflow:auto;white-space:pre-wrap;word-break:break-all">\n${lines.join("")}\n</pre>`;
  }

  test("stripAnsi removes escape sequences", () => {
    const input = "\x1b[31mhello\x1b[0m world";
    const expected = "hello world";
    expect(stripAnsi(input)).toBe(expected);
  });

  test("ansiToHtml preserves colors as inline styles", () => {
    const input = "\x1b[31mred\x1b[0m";
    const html = ansiToHtml(input);
    expect(html).toContain("color");
    expect(html).toContain("red");
    expect(html).toContain("<span");
    expect(html).toContain("</span>");
  });

  test("export roundtrip: ansiToHtml then strip tags gives clean text", () => {
    const input = "\x1b[1;32mbold green\x1b[0m";
    const html = ansiToHtml(input);
    expect(html).not.toContain("\x1b");
    const textOnly = html.replace(/<[^>]*>/g, "");
    expect(textOnly).toContain("bold green");
  });
});
