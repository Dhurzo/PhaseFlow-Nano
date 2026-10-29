/**
 * jsonc-edit.js — surgical, comment-preserving edits for JSONC config files.
 *
 * A full rewrite of a JSONC file would drop its comments, so the OpenCode V2
 * migration only rewrites strict-JSON files. For JSONC files we apply targeted
 * edits that keep every comment and the original formatting intact.
 */

/**
 * Skip whitespace and comments starting at `index`.
 *
 * @param {string} text
 * @param {number} index
 * @returns {number} index of the next meaningful character
 */
export function skipTrivia(text, index) {
  let i = index;
  while (i < text.length) {
    const ch = text[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === ",") {
      i++;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }
    break;
  }
  return i;
}

/**
 * Find a top-level object key in a JSON document.
 *
 * @param {string} text
 * @param {string} key
 * @returns {{ keyStart: number, keyEnd: number, valueStart: number, valueEnd: number } | null}
 */
export function findTopLevelKey(text, key) {
  let i = 0;

  // Skip the opening brace of the root object.
  while (i < text.length && text[i] !== "{") i++;
  if (i >= text.length) return null;
  i++;

  while (i < text.length) {
    i = skipTrivia(text, i);
    if (text[i] === "}") return null;
    if (text[i] !== '"') {
      i++;
      continue;
    }

    const keyStart = i;
    let j = i + 1;
    let name = "";
    while (j < text.length) {
      if (text[j] === "\\") {
        name += text[j + 1] ?? "";
        j += 2;
        continue;
      }
      if (text[j] === '"') break;
      name += text[j];
      j++;
    }
    const keyEnd = j + 1;

    if (name === key) {
      let k = skipTrivia(text, keyEnd);
      if (text[k] !== ":") return null;
      k = skipTrivia(text, k + 1);
      const valueStart = k;
      const valueEnd = findValueEnd(text, valueStart);
      return { keyStart, keyEnd, valueStart, valueEnd };
    }

    // Skip this member's value and continue with the next one.
    const valueStart = skipTrivia(text, keyEnd);
    if (text[valueStart] !== ":") return null;
    const valueEnd = findValueEnd(text, skipTrivia(text, valueStart + 1));
    i = valueEnd;
  }

  return null;
}

/**
 * Find the end index (exclusive) of the JSON value that starts at `index`.
 *
 * @param {string} text
 * @param {number} index
 * @returns {number}
 */
export function findValueEnd(text, index) {
  const ch = text[index];
  if (ch === '"') {
    let i = index + 1;
    while (i < text.length) {
      if (text[i] === "\\") {
        i += 2;
        continue;
      }
      if (text[i] === '"') return i + 1;
      i++;
    }
    return text.length;
  }
  if (ch === "{" || ch === "[") {
    const open = ch;
    const close = ch === "{" ? "}" : "]";
    let depth = 0;
    let i = index;
    while (i < text.length) {
      const c = text[i];
      if (c === '"') {
        i = findValueEnd(text, i);
        continue;
      }
      if (c === "/" && (text[i + 1] === "/" || text[i + 1] === "*")) {
        i = skipTrivia(text, i);
        continue;
      }
      if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return i + 1;
      }
      i++;
    }
    return text.length;
  }
  // Primitive value: up to the next comma or closing brace at this level.
  let i = index;
  while (i < text.length && !",}]\n".includes(text[i])) i++;
  return i;
}

/**
 * List the string elements of a JSON array.
 *
 * @param {string} text
 * @param {number} arrayStart index of the opening bracket
 * @returns {Array<{ value: string, start: number, end: number }>}
 */
export function listArrayStrings(text, arrayStart) {
  const elements = [];
  let i = arrayStart + 1;
  while (i < text.length) {
    i = skipTrivia(text, i);
    if (text[i] === "]") break;
    if (text[i] === ",") {
      i++;
      continue;
    }
    if (text[i] !== '"') {
      i = findValueEnd(text, i);
      continue;
    }
    const start = i;
    const end = findValueEnd(text, i);
    let value = "";
    for (let k = start + 1; k < end - 1; k++) {
      if (text[k] === "\\") {
        value += text[k + 1] ?? "";
        k++;
        continue;
      }
      value += text[k];
    }
    elements.push({ value, start, end });
    i = end;
  }
  return elements;
}

/**
 * Rename a top-level object key, preserving everything else.
 *
 * @param {string} text
 * @param {string} from
 * @param {string} to
 * @returns {{ text: string, renamed: boolean }}
 */
export function renameTopLevelKey(text, from, to) {
  const found = findTopLevelKey(text, from);
  if (!found) return { text, renamed: false };
  const quoted = JSON.stringify(to);
  return {
    text: text.slice(0, found.keyStart) + quoted + text.slice(found.keyEnd),
    renamed: true,
  };
}

/**
 * Remove named entries from the top-level `plugin` / `plugins` array of a
 * JSONC document, preserving comments and formatting.
 *
 * @param {string} text
 * @param {string[]} names
 * @returns {{ text: string, removed: string[] }}
 */
export function removePluginEntries(text, names) {
  const removed = [];

  for (const key of ["plugin", "plugins"]) {
    const found = findTopLevelKey(text, key);
    if (!found) continue;
    if (text[found.valueStart] !== "[") continue;

    const elements = listArrayStrings(text, found.valueStart);
    const targets = elements.filter((el) => names.includes(el.value));
    if (!targets.length) continue;

    // Remove from the last element backwards so earlier spans stay valid.
    for (const target of targets.reverse()) {
      let start = target.start;
      let end = target.end;

      // Swallow a following comma (and whitespace) when present.
      let after = skipTrivia(text, end);
      if (text[after] === ",") {
        end = after + 1;
      } else {
        // Otherwise swallow a preceding comma.
        let before = start - 1;
        while (before >= 0 && /\s/.test(text[before])) before--;
        if (text[before] === ",") start = before;
      }
      text = text.slice(0, start) + text.slice(end);
      removed.push(target.value);
    }

    // Drop the whole key when the array is now empty.
    const after = findTopLevelKey(text, key);
    if (after && text[after.valueStart] === "[") {
      const remaining = listArrayStrings(text, after.valueStart);
      if (!remaining.length) {
        let start = after.keyStart;
        let end = after.valueEnd;
        let trailing = skipTrivia(text, end);
        if (text[trailing] === ",") end = trailing + 1;
        else {
          let before = start - 1;
          while (before >= 0 && /\s/.test(text[before])) before--;
          if (text[before] === ",") start = before;
        }
        text = text.slice(0, start) + text.slice(end);
      }
    }
    break;
  }

  return { text, removed };
}
