/**
 * Tiny HTML helpers tuned for the kind of markup Weebly produces.
 *
 * We deliberately avoid pulling in a full DOM library — every parser in this
 * project either works on a known substring or uses the streaming tokenizer
 * in `tokenizeBlock` below.
 */

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
  "&copy;": "©",
  "&reg;": "®",
  "&trade;": "™",
  "&hellip;": "…",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&lsquo;": "‘",
  "&rsquo;": "’",
  "&mdash;": "—",
  "&ndash;": "–",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      if (code === 8203) return "";
      return String.fromCodePoint(code);
    })
    .replace(/&[a-z]+;/g, (m) => NAMED_ENTITIES[m] ?? m);
}

export function stripTags(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, "");
}

export function normalizeWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Token from the schedule tokenizer: a piece of text and the foreground color
 * it was rendered with (used to identify rink).
 */
export interface ColoredToken {
  text: string;
  color: string | null;
}

/**
 * Stream-tokenize a chunk of HTML into colored text fragments split by:
 *  - `<br>` (the most common separator in CSHL schedule paragraphs)
 *  - close of any color-bearing tag (`</font>`, `</span>`, `</u>`)
 *  - open of a color-bearing tag that changes the current color
 *
 * Inside CSHL schedule HTML, dates are wrapped in `<u>` and matchups follow as
 * plain text inside `<font color="...">`. Both flushes give us each game on a
 * separate line with its rink color preserved.
 */
export function tokenizeBlock(html: string): ColoredToken[] {
  const out: ColoredToken[] = [];
  const stack: (string | null)[] = [];
  let buffer = "";
  const colorOf = () => stack[stack.length - 1] ?? null;
  const flush = () => {
    const t = normalizeWs(decodeEntities(buffer));
    if (t) out.push({ text: t, color: colorOf() });
    buffer = "";
  };

  let i = 0;
  while (i < html.length) {
    if (html[i] !== "<") {
      buffer += html[i++];
      continue;
    }
    const end = html.indexOf(">", i);
    if (end < 0) break;
    const tag = html.slice(i + 1, end);
    i = end + 1;

    if (/^br\s*\/?\s*$/i.test(tag)) {
      flush();
      continue;
    }

    const closing = tag.startsWith("/");
    const nameMatch = (closing ? tag.slice(1) : tag).match(/^([a-zA-Z]+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1].toLowerCase();

    if (closing) {
      if (name === "font" || name === "span" || name === "u") {
        flush();
        stack.pop();
      } else if (name === "p" || name === "div") {
        flush();
      }
      continue;
    }

    let cm: RegExpMatchArray | null;
    if (name === "font") {
      cm = tag.match(/color\s*=\s*"([^"]+)"/i);
    } else if (name === "span" || name === "u") {
      cm = tag.match(/style\s*=\s*"[^"]*color\s*:\s*([^;"]+)/i);
    } else {
      continue;
    }
    const color = cm ? cm[1].trim() : colorOf();
    // A colour change mid-line (e.g. `1 v 2 1010 <font color=red>(F)</font>`)
    // starts a new token so a tag can't recolour or merge into the matchup.
    if (color !== colorOf()) flush();
    stack.push(color);
  }
  flush();
  return out;
}
