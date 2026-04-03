import { extension_settings, getContext } from '../../../../extensions.js';
import { ToolManager } from '../../../../tool-calling.js';
import { dataUrlPath, extensionName } from './config.js';

/**
 * @returns {string|null} Character card name for binding, or "__group__" in group chat, or null.
 */
function getBindingKey() {
    const ctx = getContext();
    if (ctx.groupId) {
        return '__group__';
    }
    const id = ctx.characterId;
    if (id === undefined || id === null) {
        return null;
    }
    const ch = ctx.characters[Number(id)];
    const name = ch?.name?.trim();
    return name || null;
}

/**
 * @param {Record<string, string[]>} bindings
 * @param {string|null} key
 * @returns {string[]}
 */
function resolveToolIdsForCharacter(bindings, key) {
    if (!bindings || typeof bindings !== 'object') {
        return [];
    }
    if (key && Array.isArray(bindings[key])) {
        return bindings[key];
    }
    if (key) {
        const lower = key.toLowerCase();
        const found = Object.keys(bindings).find((k) => k !== '*' && k !== '__group__' && k.toLowerCase() === lower);
        if (found && Array.isArray(bindings[found])) {
            return bindings[found];
        }
    }
    if (Array.isArray(bindings['*'])) {
        return bindings['*'];
    }
    return [];
}

/**
 * Uniform random integer in [min, max] (inclusive). Uses crypto.getRandomValues.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomIntInclusive(min, max) {
    const lo = Math.floor(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    const span = hi - lo + 1;
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return lo + (buf[0] % span);
}

function pickRandomIndex(length) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % length;
}

/**
 * @template T
 * @param {readonly T[]} arr
 * @returns {T|undefined}
 */
function pickRandomItem(arr) {
    if (!arr?.length) {
        return undefined;
    }
    return arr[pickRandomIndex(arr.length)];
}

const MONSTER_FILES = [
    'monster-aberration.json',
    'monster-beast.json',
    'monster-celestial.json',
    'monster-construct.json',
    'monster-dragon.json',
    'monster-elemental.json',
    'monster-faerie.json',
    'monster-fiend.json',
    'monster-humanoid.json',
    'monster-undead.json',
];

/** @type {Map<string, unknown>} */
const jsonFileCache = new Map();

/**
 * Fetches and caches parsed JSON from `data/` under this extension.
 * @param {string} fileName
 * @param {{ force?: boolean }} [options]
 */
async function fetchJsonFile(fileName, options = {}) {
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
function jsonRootArray(data) {
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
async function rowsFromJsonFile(fileName, options = {}) {
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
 * Add your own tools here: same id as in `bindings`, OpenAI-safe function `name`, and handler.
 * Function names must match /^[a-zA-Z0-9_-]+$/.
 */
const TOOL_SPECS = [
    {
        id: 'roll_d20',
        name: 'roll_d20',
        displayName: 'Roll d20',
        description:
            'Rolls one twenty-sided die (1–20). Use for tabletop-style checks, attack rolls, saving throws, or any situation that needs a random d20 result.',
        parameters: {
            $schema: 'http://json-schema.org/draft-04/schema#',
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        handler: async () => randomIntInclusive(1, 20),
    },
    {
        id: 'random_devious_room',
        name: 'random_devious_room',
        displayName: 'Random Devious Room',
        description:
            'Picks one random room from devious-room.json. Treasure chests add treasure from fantasy-loot or cursed-loot. Monster Den picks a random monster type file (monster-*.json), then a random entry from that file.',
        parameters: {
            $schema: 'http://json-schema.org/draft-04/schema#',
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        handler: async () => {
            const list = await rowsFromJsonFile('devious-room.json');
            const pick = list[pickRandomIndex(list.length)];
            const result = { name: pick.name, description: pick.description };

            if (pick.name === 'Treasure Chest') {
                const treasureList = await rowsFromJsonFile('fantasy-loot.json');
                result.treasure = treasureList[pickRandomIndex(treasureList.length)];
            } else if (pick.name === 'Cursed Treasure Chest') {
                const treasureList = await rowsFromJsonFile('cursed-loot.json');
                result.treasure = treasureList[pickRandomIndex(treasureList.length)];
            } else if (pick.name === 'Monster Den') {
                const monsterTypeFile = MONSTER_FILES[pickRandomIndex(MONSTER_FILES.length)];
                const monsterList = await rowsFromJsonFile(monsterTypeFile);
                const bondageList = await rowsFromJsonFile('bondage.json');
                result.monster = monsterList[pickRandomIndex(monsterList.length)];
                result.monsterNumber = randomIntInclusive(1, 3);
                result.slaveNumber = randomIntInclusive(0, 10);
                result.slaveStatus = pickRandomItem(['domesticated', 'trained', 'untrained']);
                result.slaveBondage = bondageList[pickRandomIndex(bondageList.length)];
            } else if (pick.name === 'Monster Encounter') {
                const monsterTypeFile = MONSTER_FILES[pickRandomIndex(MONSTER_FILES.length)];
                const monsterList = await rowsFromJsonFile(monsterTypeFile);
                const bondageList = await rowsFromJsonFile('bondage.json');
                result.monster = monsterList[pickRandomIndex(monsterList.length)];
                result.monsterNumber = randomIntInclusive(1, 3);
                result.slaveNumber = randomIntInclusive(0, 3);
                result.slaveStatus = pickRandomItem(['domesticated', 'trained', 'untrained']);
                result.slaveBondage = bondageList[pickRandomIndex(bondageList.length)];
            } else if (pick.name === 'Monster Girl Encounter') {
                const monsterList = await rowsFromJsonFile('monster-girl.json');
                const bondageList = await rowsFromJsonFile('bondage.json');
                result.monster = monsterList[pickRandomIndex(monsterList.length)];
                result.slaveNumber = randomIntInclusive(0, 3);
                result.slaveStatus = pickRandomItem(['domesticated', 'trained', 'untrained']);
                result.slaveBondage = bondageList[pickRandomIndex(bondageList.length)];
            } else if (pick.name === 'Special Encounter') {
                const eventList = await rowsFromJsonFile('lewd-event.json');
                result.event = eventList[pickRandomIndex(eventList.length)];
            } else if (pick.name === 'Parasite Encounter') {
                const parasiteList = await rowsFromJsonFile('lewd-parasite.json');
                result.parasite = parasiteList[pickRandomIndex(parasiteList.length)];
            } else if (pick.name === 'Succubus Merchant') {
                const brandList = await rowsFromJsonFile('lewd-brand.json');
                result.brand = brandList[pickRandomIndex(brandList.length)];
            } else if (pick.name === 'Faeries Encounter') {
                const bondageList = await rowsFromJsonFile('bondage.json');
                result.bondage = bondageList[pickRandomIndex(bondageList.length)];
            }
            return result;
        },
    },
    {
        id: 'timeskip',
        name: 'timeskip',
        displayName: 'Time skip',
        description:
            'No-op hook for a time skip: Choose how much time passes and send it in the required period argument. Continue in your next reply with the story after the skip.',
        parameters: {
            $schema: 'http://json-schema.org/draft-04/schema#',
            type: 'object',
            properties: {
                period: {
                    type: 'string',
                    description:
                        'How much time passes (e.g. "a few minutes", "three days", "several years"). You decide this when calling the tool.',
                },
            },
            required: ['period'],
            additionalProperties: false,
        },
        handler: async (params) => {
            void params.period;
            return '';
        },
    },
];

export function registerCharacterTools() {
    for (const spec of TOOL_SPECS) {
        ToolManager.registerFunctionTool({
            name: spec.name,
            displayName: spec.displayName,
            description: spec.description,
            parameters: spec.parameters,
            action: spec.handler,
            shouldRegister: async () => {
                if (!ToolManager.isToolCallingSupported()) {
                    return false;
                }
                const settings = extension_settings[extensionName];
                const key = getBindingKey();
                const ids = resolveToolIdsForCharacter(settings?.bindings || {}, key);
                return ids.includes(spec.id);
            },
        });
    }
}
