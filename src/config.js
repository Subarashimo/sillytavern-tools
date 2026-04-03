import { extension_settings } from '../../../../extensions.js';

/** Must match the extension folder name under `third-party/` (used in URLs for `/scripts/extensions/third-party/.../data/*.json`). */
export const extensionName = 'Subarashimos-Tools';

/** Static path segment for this extension (no leading slash). */
export const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

/** JSON data files live under `data/` — URL path is `/${dataUrlPath}/filename.json`. */
export const dataUrlPath = `${extensionFolderPath}/data`;

/**
 * Per-character tool bindings: keys are character card names (as shown in the UI),
 * or "*" / "__group__" — Values are arrays of tool ids from TOOL_SPECS (e.g. "roll_d20").
 */
export const defaultSettings = {
    bindings: {
        'Devious Dungeon (ST)': ['random_devious_room', 'roll_d20', 'timeskip', 'death'],
    },
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
};

export function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    const s = extension_settings[extensionName];
    if (Object.keys(s).length === 0) {
        Object.assign(s, structuredClone(defaultSettings));
    }
    if (!s.bindings || typeof s.bindings !== 'object') {
        s.bindings = {};
    }
    for (const [key, val] of Object.entries(defaultSettings)) {
        if (s[key] === undefined) {
            s[key] = typeof val === 'object' && val !== null && !Array.isArray(val) ? structuredClone(val) : val;
        }
    }
}
