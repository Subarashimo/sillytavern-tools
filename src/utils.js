/** Shared helpers for Subarashimo's Tools. */

import { dataUrlPath } from './config.js';

/**
 * Ensures the shared row above the chat input exists (RPG Companion–style; used by interception / judge toggles).
 */
export function ensureExtensionButtonsWrapper() {
    if ($('#extension-buttons-wrapper').length === 0) {
        $('#send_form').prepend(
            '<div id="extension-buttons-wrapper" style="text-align: center; margin: 5px auto;"></div>',
        );
    }
}

/**
 * Prior chat lines for prompts (same labels as message interception). Excludes index `endExclusive` onward.
 * @param {Array<{ mes?: string, is_user?: boolean, is_system?: boolean }>} chatHistory
 * @param {number} endExclusive First index not included (e.g. the message being rewritten or judged).
 * @param {number} depth How many prior messages to include at most
 * @returns {string} Bullet lines, newest last
 */
export function buildRecentChatContextLines(chatHistory, endExclusive, depth) {
    const d = Math.max(0, Number(depth) || 0);
    const startIndex = Math.max(0, endExclusive - d);
    const recentMessages = chatHistory.slice(startIndex, endExclusive);
    return recentMessages
        .map((m) => {
            const role = m.is_system ? 'system' : m.is_user ? '{{user}}' : '{{char}}';
            const content = (m.mes || '').replace(/\s+/g, ' ').trim();
            return `- ${role}: ${content}`;
        })
        .join('\n');
}

/**
 * Parses JSON from model output: full string first, then first `{`…`}` span.
 * @param {string} text
 * @returns {Record<string, unknown>|null}
 */
export function tryParseJsonLenient(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
        return null;
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(trimmed.slice(start, end + 1));
            } catch {
                return null;
            }
        }
    }
    return null;
}

/**
 * Uniform random integer in [min, max] (inclusive). Uses crypto.getRandomValues.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomIntInclusive(min, max) {
    const lo = Math.floor(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    const span = hi - lo + 1;
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return lo + (buf[0] % span);
}

/**
 * @param {number} length
 * @returns {number}
 */
export function pickRandomIndex(length) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % length;
}

/**
 * @template T
 * @param {readonly T[]} arr
 * @returns {T|undefined}
 */
export function pickRandomItem(arr) {
    if (!arr?.length) {
        return undefined;
    }
    return arr[pickRandomIndex(arr.length)];
}

/**
 * Parses comma-separated tool ids (whitespace trimmed; empty entries ignored).
 * @param {string} csv
 * @returns {string[]}
 */
export function parseEnabledToolIds(csv) {
    return String(csv || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
}

/** @type {Map<string, unknown>} */
const jsonFileCache = new Map();

/**
 * Fetches and caches parsed JSON from `data/` under this extension.
 * @param {string} fileName
 * @param {{ force?: boolean }} [options]
 */
export async function fetchJsonFile(fileName, options = {}) {
    const force = options.force === true;
    if (!force && jsonFileCache.has(fileName)) {
        return jsonFileCache.get(fileName);
    }
    const url = `/${dataUrlPath}/${encodeURIComponent(fileName)}${force ? `?t=${Date.now()}` : ''}`;
    const res = await fetch(url, { cache: force ? 'no-store' : 'default' });
    if (!res.ok) {
        throw new Error(`Failed to load ${fileName}: HTTP ${res.status} (${url})`);
    }
    const data = await res.json();
    jsonFileCache.set(fileName, data);
    return data;
}

/**
 * Array from JSON root or from items / rooms / entries / values / list.
 * @param {unknown} data
 * @returns {unknown[]|null}
 */
export function jsonRootArray(data) {
    const arr = Array.isArray(data)
        ? data
        : (data?.items ?? data?.rooms ?? data?.entries ?? data?.values ?? data?.list);
    return Array.isArray(arr) ? arr : null;
}

/**
 * Loads a JSON file and returns rows as `{ name, description }`.
 * @param {string} fileName
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<{ name: string, description: string }[]>}
 */
export async function rowsFromJsonFile(fileName, options = {}) {
    const data = await fetchJsonFile(fileName, options);
    const arr = jsonRootArray(data);
    if (!arr) {
        return [];
    }
    const out = [];
    for (const x of arr) {
        if (!x || typeof x !== 'object') {
            continue;
        }
        const n = /** @type {Record<string, unknown>} */ (x).name;
        const d = /** @type {Record<string, unknown>} */ (x).description;
        const nameStr = typeof n === 'string' ? n.trim() : '';
        const descStr = typeof d === 'string' ? d.trim() : '';
        if (!nameStr && !descStr) {
            continue;
        }
        out.push({ name: nameStr, description: descStr });
    }
    return out;
}
