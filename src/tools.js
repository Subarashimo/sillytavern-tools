import { extension_settings } from '../../../../extensions.js';
import { ToolManager } from '../../../../tool-calling.js';
import { extensionName } from './config.js';
import {
    pickRandomIndex,
    pickRandomItem,
    parseEnabledToolIds,
    randomIntInclusive,
    randomColor,
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
 * Add your own tools here: same id as in the enabled-tools list / presets, OpenAI-safe function `name`, and handler.
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
        id: 'random_slave',
        name: 'random_slave',
        displayName: 'Random Slave',
        description: 'Generate a randomized female slave. Returns JSON with all fields. Optional setting chooses pool: real (default), fantasy, or puppy.',
        parameters: {
            $schema: 'http://json-schema.org/draft-04/schema#',
            type: 'object',
            properties: {
                setting: {
                    type: 'string',
                    enum: ['fantasy', 'real', 'puppy'],
                    description: 'Which pool to use: real, fantasy, or puppy.',
                },
            },
            additionalProperties: false,
        },
        handler: async (params) => {
            const setting = params?.setting ?? 'real';
            const nameList = await rowsFromJsonFile(
                setting === 'fantasy'
                ? 'fantasy-name.json'
                : setting === 'real'
                ? 'real-name.json'
                : 'puppy-name.json',
            );
            const surnameList = setting === 'real'
                ? await rowsFromJsonFile('real-surname.json') : [];

            const careerList = await rowsFromJsonFile('real-career.json');
            const sexualFlawList = await rowsFromJsonFile('sexual-flaw.json');
            const sexualParaphiliaList = await rowsFromJsonFile('sexual-paraphilia.json');
            const sexualQuirkList = await rowsFromJsonFile('sexual-quirk.json');
            const behaviouralFlawList = await rowsFromJsonFile('behavioural-flaw.json');
            const behaviouralQuirkList = await rowsFromJsonFile('behavioural-quirk.json');
            const pregnancyList = await rowsFromJsonFile('lewd-pregnancy.json');
            const tattooList = await rowsFromJsonFile('lewd-tattoo.json');
            const bondageList = await rowsFromJsonFile('bondage.json');

            const name = pickRandomItem(nameList);
            const surname = pickRandomItem(surnameList);
            const career = pickRandomItem(careerList);

            const noItem = {name: "", description: ""}
            const sexualFlaw = pickRandomItem(sexualFlawList, noItem, 0.5);
            const sexualParaphilia = pickRandomItem(sexualParaphiliaList, noItem, 0.5);
            const sexualQuirk = pickRandomItem(sexualQuirkList, noItem, 0.5);
            const behaviouralFlaw = pickRandomItem(behaviouralFlawList, noItem, 0.5);
            const behaviouralQuirk = pickRandomItem(behaviouralQuirkList, noItem, 0.5);
            const pregnancy = pickRandomItem(pregnancyList, noItem, 0.5);
            const tattoo = pickRandomItem(tattooList, noItem, 0.5);
            const bondage = pickRandomItem(bondageList, noItem, 0.5);

            const race = pickRandomItem(['Caucasian', 'South African', 'East Asian', 'South Asian', 'Southeast Asian', 'Native American', 'Middle Eastern', 'North African', 'Aboriginal Australian', 'Polynesian', 'Melanesian'], 'Mixed', 0.5)
            const frame = pickRandomItem(['Lithe', 'Chubby', 'Overweight', 'Muscular'], 'Normal', 0.5)
            const height = pickRandomItem(['Petite', 'Short', 'Tall', 'Very tall'], 'Average', 0.5)

            const breastShape = pickRandomItem(['Perky', 'Saggy', 'Torpedo-shaped', 'Downward-facing', 'Wide-set', 'Spherical'], 'Normal', 0.5)
            const breastSize = pickRandomItem(['Flat (AA-cup)', 'Small (A-cup)', 'Healthy (C-cup)', 'Large (DD-cup)', 'Very Large (G-cup)', 'Huge (K-cup)', 'Massive (Q-cup)'], 'Medium (B-cup)', 0.5)
            const nippleSize = pickRandomItem(['Huge', 'Puffy', 'Inverted', 'Partially Inverted', 'Tiny', 'Cute'], 'Normal', 0.5)

            const lips = pickRandomItem(['Thin', 'Pretty', 'Large', 'Enormous'], 'Normal', 0.5)
            const vagina = pickRandomItem(['Virgin', 'Veteran', 'Gaping', 'Ruined'], 'Normal', 0.5)
            const anus = pickRandomItem(['Virgin', 'Veteran', 'Gaping', 'Ruined'], 'Normal', 0.5)

            const prestige = pickRandomItem(['Some', 'Recognized', 'Famous', 'World Renowned'], 'Unknown', 0.5)
            const intellect = pickRandomItem(['Retarded', 'Very Slow', 'Slow', 'Intelligent', 'Highly Intelligent', 'Brilliant'], 'Average', 0.5)
            const devotion = pickRandomItem(['Hate Filled', 'Hateful', 'Reluctant', 'Careful', 'Accepting', 'Devoted', 'Worshipful'], 'Reluctant', 0.5)
            const trust = pickRandomItem(['Abjectly Terrified', 'Terrified', 'Frightened', 'Fearful', 'Careful', 'Trusting', 'Profoundly Trusting'], 'Frightened', 0.5)

            return {
                name: name?.name ?? '',
                surname: surname?.name ?? '',
                age: randomIntInclusive(18, 45),
                eyeColor: randomColor(),
                hairColor: randomColor(),
                career: career,
                sexualFlaw: sexualFlaw,
                sexualParaphilia: sexualParaphilia,
                sexualQuirk: sexualQuirk,
                behaviouralFlaw: behaviouralFlaw,
                behaviouralQuirk: behaviouralQuirk,
                belly: pregnancy,
                tattoo: tattoo,
                bondage: bondage,
                race: race,
                frame: frame,
                height: height,
                breastSize: breastSize,
                breastShape: breastShape,
                nippleSize: nippleSize,
                lips: lips,
                vagina: vagina,
                anus: anus,
                prestige: prestige,
                intellect: intellect,
                devotion: devotion,
                trust: trust,
            };
        },
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
                result.monsterGirl = monsterList[pickRandomIndex(monsterList.length)];
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
            } else if (pick.name === 'Altar of the Divine') {
                const deityList = await rowsFromJsonFile('lewd-god.json');
                result.deity = deityList[pickRandomIndex(deityList.length)];
                if (result.deity.name === 'Vex\'ara, the Sultress of Chains') {
                    const bondageList = await rowsFromJsonFile('bondage.json');
                    result.bondage = bondageList[pickRandomIndex(bondageList.length)];
                }
            } else if (pick.name === 'Summoning Circle') {
                const summonedList = await rowsFromJsonFile('lewd-summon.json');
                result.summoned = summonedList[pickRandomIndex(summonedList.length)];
            } else if (pick.name === 'Pool of Metamorphosis') {
                const monsterList = await rowsFromJsonFile('monster-girl.json');
                result.monsterGirl = monsterList[pickRandomIndex(monsterList.length)];
            } else if (pick.name === 'The Murmuring Hall') {
                const hypnosisList = await rowsFromJsonFile('lewd-hypnosis.json');
                result.hypnosis = hypnosisList[pickRandomIndex(hypnosisList.length)];
            }
            return result;
        },
    },
    {
        id: 'timeskip',
        name: 'timeskip',
        displayName: 'Time skip',
        description:
            'Choose how much time passes and send it in the required period argument. Continue in your next reply with the story after the skip.',
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
                const ids = parseEnabledToolIds(settings?.enabledTools);
                return ids.includes(spec.id);
            },
        });
    }
}
