/** Preset loading and applying (bundled JSON under data/presets/ + user-defined in settings). */

import { dataUrlPath, defaultSettings } from './config.js';

/** Keys stored in preset JSON / user presets (subset of extension settings). */
export const PRESET_FIELD_KEYS = [
    'enabledTools',
    'enableMessageInterception',
    'messageInterceptionContextDepth',
    'customMessageInterceptionPrompt',
    'enableJudge',
    'judgeMaxRetries',
    'judgeContextDepth',
    'customJudgeSystemPrompt',
    'enableDirector',
    'directorContextDepth',
    'customDirectorSystemPrompt',
];

/**
 * @param {string} relativePath path under data/ (e.g. presets/Default.json)
 */
function dataJsonUrl(relativePath) {
    const segments = String(relativePath || '')
        .split('/')
        .filter(Boolean)
        .map((seg) => encodeURIComponent(seg));
    return `/${dataUrlPath}/${segments.join('/')}`;
}

/**
 * @param {string} relativePath
 * @returns {Promise<unknown>}
 */
export async function fetchDataJson(relativePath) {
    const url = dataJsonUrl(relativePath);
    const res = await fetch(url, { cache: 'default' });
    if (!res.ok) {
        throw new Error(`Failed to load ${relativePath}: HTTP ${res.status}`);
    }
    return res.json();
}

/** @returns {Promise<string[]>} */
export async function fetchBundledPresetFilenames() {
    try {
        const data = await fetchDataJson('presets/manifest.json');
        const list = data?.presets;
        if (Array.isArray(list) && list.every((x) => typeof x === 'string')) {
            return list;
        }
    } catch {
        // ignore
    }
    return ['Default.json', 'Devious Dungeon (ST).json'];
}

function presetBaseFromDefaults() {
    /** @type {Record<string, unknown>} */
    const base = {};
    for (const key of PRESET_FIELD_KEYS) {
        const v = defaultSettings[key];
        base[key] = typeof v === 'object' && v !== null && !Array.isArray(v) ? structuredClone(v) : v;
    }
    return base;
}

/**
 * Full preset payload: defaults merged with file/object (partial files OK).
 * @param {unknown} raw
 */
export function normalizePresetPayload(raw) {
    const base = presetBaseFromDefaults();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return base;
    }
    const o = /** @type {Record<string, unknown>} */ (raw);
    for (const key of PRESET_FIELD_KEYS) {
        if (Object.prototype.hasOwnProperty.call(o, key)) {
            base[key] = o[key];
        }
    }
    return base;
}

/**
 * @param {Record<string, unknown>} settings
 */
export function presetPayloadFromSettings(settings) {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of PRESET_FIELD_KEYS) {
        const v = settings[key];
        out[key] = typeof v === 'object' && v !== null && !Array.isArray(v) ? structuredClone(v) : v;
    }
    return out;
}

/**
 * @param {Record<string, unknown>} settings
 * @param {Record<string, unknown>} payload
 */
export function applyPresetPayloadToSettings(settings, payload) {
    const norm = normalizePresetPayload(payload);
    for (const key of PRESET_FIELD_KEYS) {
        settings[key] = norm[key];
    }
}

/**
 * @param {string} fileName e.g. Default.json
 */
export async function fetchBundledPresetPayload(fileName) {
    const path = `presets/${fileName}`;
    const raw = await fetchDataJson(path);
    return normalizePresetPayload(raw);
}

/** @param {string} ref `file:Default.json` or `custom:<uuid>` */
export function parsePresetRef(ref) {
    const s = String(ref || '');
    if (s.startsWith('file:')) {
        return { kind: 'file', fileName: s.slice(5) };
    }
    if (s.startsWith('custom:')) {
        return { kind: 'custom', id: s.slice('custom:'.length) };
    }
    return null;
}

/** Display label for a bundled filename (strip .json). */
export function bundledPresetLabel(fileName) {
    const base = String(fileName || '').replace(/\.json$/i, '');
    return base || fileName;
}
