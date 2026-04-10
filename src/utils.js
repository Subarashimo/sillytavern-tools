/** Shared helpers for Subarashimo's Tools. */

import { dataUrlPath } from './config.js';
import { eventSource, event_types, extension_prompts } from '../../../../../script.js';

/**
 * @typedef {{ mes?: string, is_user?: boolean, is_system?: boolean, extra?: { tool_invocations?: unknown } }} ChatLikeMessage
 */

/**
 * Normalizes message text for duplicate comparison (same idea as `buildRecentChatContextLines`).
 * @param {string} [text]
 * @returns {string}
 */
export function normalizeMessageTextForComparison(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Index of the prior assistant content message before `beforeIndex` (skips user, system/tool bubbles).
 * @param {ChatLikeMessage[]} chatHistory
 * @param {number} beforeIndex
 * @returns {number} index or -1
 */
/**
 * Index of the most recent user message, or -1.
 * @param {ChatLikeMessage[]} chatHistory
 * @returns {number}
 */
export function findLastUserMessageIndex(chatHistory) {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
        if (chatHistory[i]?.is_user) {
            return i;
        }
    }
    return -1;
}

export function findPreviousAssistantMessageIndex(chatHistory, beforeIndex) {
    for (let i = beforeIndex - 1; i >= 0; i--) {
        const m = chatHistory[i];
        if (!m || m.is_user) {
            continue;
        }
        if (m.is_system) {
            continue;
        }
        if (m.extra?.tool_invocations) {
            continue;
        }
        return i;
    }
    return -1;
}

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
 * @param {T} [defaultValue] If provided with `chance`, may return this instead of drawing from `arr`.
 * @param {number} [chance] Probability in [0, 1] for returning `defaultValue` (clamped). Ignored unless both optional args are provided.
 * @returns {T|undefined}
 */
export function pickRandomItem(arr, defaultValue, chance) {
    if (defaultValue !== undefined && chance !== undefined && Number.isFinite(chance)) {
        const p = Math.min(1, Math.max(0, chance));
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        const u = buf[0] / 4294967296;
        if (u < p) {
            return defaultValue;
        }
    }
    if (!arr?.length) {
        return undefined;
    }
    return arr[pickRandomIndex(arr.length)];
}

const COLORS = Object.freeze([
    'black',
    'jet black',
    'brown',
    'dark brown',
    'medium brown',
    'light brown',
    'chestnut brown',
    'chocolate brown',
    'caramel brown',
    'coffee brown',
    'mocha brown',
    'honey brown',
    'golden brown',
    'copper',
    'bronze',
    'russet',
    'sienna',
    'umber',
    'tawny',
    'sepia',
    'auburn',
    'blue',
    'deep blue',
    'dark blue',
    'bright blue',
    'sky blue',
    'baby blue',
    'ice blue',
    'powder blue',
    'steel blue',
    'sapphire blue',
    'cobalt blue',
    'navy blue',
    'royal blue',
    'electric blue',
    'ocean blue',
    'teal',
    'turquoise',
    'aquamarine',
    'cerulean',
    'peacock blue',
    'slate blue',
    'indigo',
    'green',
    'emerald green',
    'forest green',
    'jade green',
    'moss green',
    'olive green',
    'sea green',
    'bottle green',
    'mint green',
    'sage green',
    'spring green',
    'lime green',
    'chartreuse',
    'hazel',
    'green-hazel',
    'golden hazel',
    'amber',
    'golden amber',
    'honey amber',
    'yellow amber',
    'topaz',
    'honey gold',
    'sun gold',
    'gray',
    'grey',
    'light gray',
    'dark gray',
    'blue-gray',
    'green-gray',
    'slate gray',
    'charcoal gray',
    'ash gray',
    'smoke gray',
    'storm gray',
    'silver',
    'silvery gray',
    'platinum',
    'pewter',
    'dove gray',
    'steel gray',
    'violet',
    'purple',
    'lavender',
    'lilac',
    'plum',
    'amethyst',
    'magenta',
    'rose',
    'pink',
    'crimson',
    'ruby red',
    'wine red',
    'burgundy',
    'garnet',
    'red-brown',
    'violet-gray',
    'ice gray',
    'glacier blue',
    'moonlit silver',
    'storm-cloud gray',
    'sunset amber',
    'periwinkle',
    'cornflower blue',
    'denim blue',
    'midnight blue',
    'frost blue',
    'mist gray',
    'antique gold',
    'champagne gold',
    'copper penny',
    'tiger-eye brown',
    'cat-eye green',
    'opal gray',
    'pearlescent gray',
]);

/**
 * Returns a random color name from a fixed pool (cryptographic pick).
 * @returns {string}
 */
export function randomColor() {
    return pickRandomItem(COLORS) ?? 'brown';
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

/**
 * Injects an extension prompt for the first API hop only: SillyTavern emits `GENERATE_AFTER_DATA` after the first
 * `generate_data` is built (prompt already includes this inject), then nested `Generate` (e.g. tool continuations)
 * rebuild prompts without it. If generation ends before that event, the key is removed in `finally`.
 *
 * @param {string} key
 * @param {() => void} setup Call `setExtensionPrompt(key, ...)` here.
 * @param {() => Promise<unknown>} runGenerate e.g. `() => Generate('regenerate', {})`
 */
export async function withExtensionPromptFirstApiHopOnly(key, setup, runGenerate) {
    setup();
    let cleared = false;
    const onAfterData = () => {
        if (cleared) {
            return;
        }
        cleared = true;
        delete extension_prompts[key];
        eventSource.removeListener(event_types.GENERATE_AFTER_DATA, onAfterData);
    };
    eventSource.on(event_types.GENERATE_AFTER_DATA, onAfterData);
    try {
        await runGenerate();
    } finally {
        eventSource.removeListener(event_types.GENERATE_AFTER_DATA, onAfterData);
        if (!cleared) {
            delete extension_prompts[key];
        }
    }
}
