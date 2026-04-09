import { extension_settings } from '../../../../extensions.js';

/**
 * Stable key in `extension_settings` (not tied to install folder name so saves survive renames / different release zips).
 */
export const extensionName = 'Subarashimos-Tools';

/**
 * Resolves `scripts/extensions/third-party/<folder>/...` from this file's URL (`<folder>/src/config.js`).
 * Works when the repo folder is `Subarashimos-Tools`, `sillytavern-tools`, or any other name.
 */
function extensionFolderPathFromImportMeta() {
    const pathname = decodeURIComponent(new URL(import.meta.url).pathname).replace(/\\/g, '/');
    const suffix = '/src/config.js';
    const i = pathname.toLowerCase().endsWith(suffix.toLowerCase()) ? pathname.length - suffix.length : -1;
    const dir = i >= 0 ? pathname.slice(0, i).replace(/\/+$/, '') : '';
    const folder = dir ? dir.split('/').pop() || '' : '';
    if (!folder) {
        return `scripts/extensions/third-party/${extensionName}`;
    }
    return `scripts/extensions/third-party/${folder}`;
}

/** URL path prefix for this extension (no leading slash). */
export const extensionFolderPath = extensionFolderPathFromImportMeta();

/** JSON data files live under `data/` — URL path is `/${dataUrlPath}/filename.json`. */
export const dataUrlPath = `${extensionFolderPath}/data`;

/**
 * Comma-separated tool ids from TOOL_SPECS (e.g. "roll_d20, timeskip"). Applies to all chats.
 */
export const defaultSettings = {
    enabledTools: '',
    /** Last loaded preset: `file:Default.json` or `custom:<uuid>`. */
    activePresetRef: 'file:Default.json',
    /** User-created presets (not files); each `data` matches preset JSON shape. */
    userPresets: [],
    /** LLM rewrites the outgoing user message using persona + recent chat (RPG Companion–style flow). */
    enableMessageInterception: false,
    /** When false, interception stays enabled in settings but skips the extra API call until toggled back on. */
    messageInterceptionActive: true,
    messageInterceptionContextDepth: 4,
    customMessageInterceptionPrompt: '',
    /** After each assistant reply, an extra model call checks compliance with character rules; failed replies trigger Regenerate with feedback. */
    enableJudge: false,
    /** When false, judge stays enabled in settings but skips checks until toggled back on (chat bar button). */
    judgeActive: true,
    judgeMaxRetries: 3,
    /** Messages before the assistant line the judge evaluates (same idea as message interception depth). */
    judgeContextDepth: 4,
    customJudgeSystemPrompt: '',
    /** Before each main generation, an extra model call proposes a short scene-direction hint injected into the prompt. */
    enableDirector: false,
    /** When false, director stays enabled in settings but skips the extra API call until toggled back on (chat bar button). */
    directorActive: true,
    directorContextDepth: 4,
    customDirectorSystemPrompt: '',
};

export function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    const s = extension_settings[extensionName];
    if (Object.keys(s).length === 0) {
        Object.assign(s, structuredClone(defaultSettings));
    }
    for (const [key, val] of Object.entries(defaultSettings)) {
        if (s[key] === undefined) {
            s[key] = typeof val === 'object' && val !== null && !Array.isArray(val) ? structuredClone(val) : val;
        }
    }
    for (const key of [
        'enableLoopDetector',
        'loopDetectorActive',
        'loopDetectorMaxRetries',
        'enableLoopDetectorDuplicateToolCalls',
    ]) {
        delete s[key];
    }
}
