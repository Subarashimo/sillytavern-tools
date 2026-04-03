import { extension_settings } from '../../../../extensions.js';
import { ToolManager } from '../../../../tool-calling.js';
import { extensionName } from './config.js';
import {
    getBindingKey,
    pickRandomIndex,
    pickRandomItem,
    randomIntInclusive,
    resolveToolIdsForCharacter,
    rowsFromJsonFile,
} from './utils.js';

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

/**
 * Add your own tools here: same id as in `bindings`, OpenAI-safe function `name`, and handler.
 * Function names must match /^[a-zA-Z0-9_-]+$/.
 */
const TOOL_SPECS = [
    {
        id: 'roll_d20',
        name: 'roll_d20',
        displayName: 'Roll d20',
        description: 'Rolls one twenty-sided die (1–20).',
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
        description: 'Picks one random devious room for the user to explore.',
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
        description: 'Choose how much time passes and send it in the required period argument. Continue in your next reply with the story after the skip.',
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
    {
        id: 'death',
        name: 'death',
        displayName: 'Death',
        description: 'Signal the user has died. The tool will return a new thread for the story after their death.',
        parameters: {
            $schema: 'http://json-schema.org/draft-04/schema#',
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        handler: async (params) => {
            const deathList = await rowsFromJsonFile('lewd-death.json');
            return deathList[pickRandomIndex(deathList.length)];
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
