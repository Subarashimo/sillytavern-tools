import { extension_settings, getContext } from '../../../../extensions.js';
import {
    saveSettingsDebounced,
    eventSource,
    event_types,
    generateRaw,
    chat,
    getCharacterCardFields,
    substituteParams,
    extension_prompts,
    extension_prompt_types,
    extension_prompt_roles,
    setExtensionPrompt,
    is_send_press,
} from '../../../../../script.js';
import { extensionName } from './config.js';
import { buildRecentChatContextLines, ensureExtensionButtonsWrapper } from './utils.js';

/** Stable key in `extension_prompts` (must not collide with core inject_ids). */
const DIRECTOR_PROMPT_KEY = 'SubarashimosTools_Director';

/** Default director system prompt (macros like {{char}} are expanded). */
export const DEFAULT_DIRECTOR_SYSTEM_PROMPT = `You are a narrative director for roleplay in this chat. Your job is to read {{char}}'s definition and the recent conversation, then suggest plausible directions for what might happen next (mood, tension, beats, consequences). Do not write in-character dialogue for {{char}} or {{user}}. Do not dictate a full script. Output plain prose only, concise.`;

function buildCharacterRulesBlock() {
    const { description, personality, scenario, system, jailbreak } = getCharacterCardFields();
    const parts = [
        description && `Description:\n${description}`,
        personality && `Personality:\n${personality}`,
        scenario && `Scenario:\n${scenario}`,
        system && `Post-history / instructions:\n${system}`,
        jailbreak && `Jailbreak / extra:\n${jailbreak}`,
    ].filter(Boolean);
    const raw = parts.join('\n\n');
    return substituteParams(raw);
}

function clearDirectorInjection() {
    delete extension_prompts[DIRECTOR_PROMPT_KEY];
}

/**
 * Impersonate / quiet / append / swipe are not main assistant scene turns for this feature.
 */
function shouldSkipDirectorGenerationType(type) {
    return (
        type === 'impersonate' ||
        type === 'quiet' ||
        type === 'append' ||
        type === 'swipe'
    );
}

/**
 * @param {string} text
 */
function formatDirectorInjection(text) {
    const t = String(text || '').trim();
    if (!t) {
        return '';
    }
    return `[Director hint — optional, only if it fits the story]\n${t}`;
}

/**
 * @param {Record<string, unknown>} settings
 * @returns {Promise<string>}
 */
async function fetchDirectorSuggestion(settings) {
    const rulesBlock = buildCharacterRulesBlock();
    const depth = Number(settings.directorContextDepth) || 4;
    const recentContext = buildRecentChatContextLines(chat, chat.length, depth);
    const basePrompt = (settings.customDirectorSystemPrompt || '').trim() || DEFAULT_DIRECTOR_SYSTEM_PROMPT;

    const promptMessages = [
        { role: 'system', content: substituteParams(basePrompt) },
        { role: 'system', content: `{{char}}'s card (reference):\n${rulesBlock || '(none provided)'}` },
        {
            role: 'system',
            content: `Recent messages (newest last):\n${recentContext || 'None'}`,
        },
        {
            role: 'user',
            content: substituteParams(
                `Suggest what might happen next in the scene. Keep it concise.`,
            ),
        },
    ];

    const raw = await generateRaw({
        prompt: promptMessages,
        quietToLoud: false,
        responseLength: 2000,
        trimNames: false,
    });

    return typeof raw === 'string' ? raw.trim() : String(raw || '').trim();
}

/**
 * @param {Record<string, unknown>} settings
 */
async function injectDirectorSuggestion(settings) {
    const suggestion = await fetchDirectorSuggestion(settings);
    const formatted = formatDirectorInjection(suggestion);
    if (!formatted) {
        return;
    }
    setExtensionPrompt(
        DIRECTOR_PROMPT_KEY,
        formatted,
        extension_prompt_types.IN_CHAT,
        0,
        false,
        extension_prompt_roles.SYSTEM,
    );
}

/**
 * `GENERATION_STARTED` runs before `sendMessageAsUser` in SillyTavern, so the new user line is not in chat yet and
 * `MESSAGE_SENT` (message interception) has not run. For a normal send we defer to `USER_MESSAGE_RENDERED`, which fires
 * after interception has finished updating the last user message.
 * @param {string} type
 * @param {{ automatic_trigger?: boolean }} [options]
 * @param {boolean} dryRun
 */
async function handleDirectorGenerationStarted(type, options, dryRun) {
    clearDirectorInjection();

    const settings = extension_settings[extensionName];
    if (!settings.enableDirector || settings.directorActive === false) {
        return;
    }

    if (dryRun) {
        return;
    }

    const ctx = getContext();
    if (ctx.groupId) {
        return;
    }

    if (shouldSkipDirectorGenerationType(type)) {
        return;
    }

    if (options?.automatic_trigger) {
        return;
    }

    /**
     * Normal send: director runs in `handleDirectorUserMessageRendered` after interception (MESSAGE_SENT) completes.
     */
    if (type === 'normal') {
        return;
    }

    if (!chat?.length) {
        return;
    }

    try {
        await injectDirectorSuggestion(settings);
    } catch (error) {
        console.error("[Subarashimo's Tools] Director failed:", error);
        toastr.error(String(error?.message || error), "Subarashimo's Tools");
    }
}

/**
 * After the user bubble is rendered; `MESSAGE_SENT` (and thus message interception) has already completed.
 * @param {number} messageId
 */
async function handleDirectorUserMessageRendered(messageId) {
    clearDirectorInjection();

    const settings = extension_settings[extensionName];
    if (!settings.enableDirector || settings.directorActive === false) {
        return;
    }

    if (!is_send_press) {
        return;
    }

    const ctx = getContext();
    if (ctx.groupId) {
        return;
    }

    if (messageId !== chat.length - 1) {
        return;
    }

    const last = chat[messageId];
    if (!last?.is_user) {
        return;
    }

    try {
        await injectDirectorSuggestion(settings);
    } catch (error) {
        console.error("[Subarashimo's Tools] Director failed:", error);
        toastr.error(String(error?.message || error), "Subarashimo's Tools");
    }
}

function updateDirectorToggleState() {
    const $toggle = $('#subarashimos-director-toggle');
    if (!$toggle.length) {
        return;
    }
    const settings = extension_settings[extensionName];
    const active = settings.directorActive !== false;
    const prefix = 'Director:';
    const label = active ? 'On' : 'Off';
    const icon = active ? 'fa-clapperboard' : 'fa-ban';
    const background = active ? '#2980b9' : '#666';

    $toggle
        .css({
            'background-color': background,
            color: '#fff',
        })
        .html(`<i class="fa-solid ${icon}"></i> ${prefix} ${label}`);
    $toggle.attr(
        'title',
        active
            ? 'Director on (click to skip the pre-generation prompt for this session)'
            : 'Director off (click to run scene hints before each generation again)',
    );
}

function updateDirectorToggleVisibility() {
    const $toggle = $('#subarashimos-director-toggle');
    if (!$toggle.length) {
        return;
    }
    const settings = extension_settings[extensionName];
    const show = settings.enableDirector === true;
    $toggle.toggle(show);
    if (show) {
        updateDirectorToggleState();
    }
}

function mountDirectorToggle() {
    if ($('#subarashimos-director-toggle').length) {
        updateDirectorToggleVisibility();
        return;
    }
    if (!$('#send_form').length) {
        return;
    }

    ensureExtensionButtonsWrapper();

    const buttonHtml = `
        <button type="button" id="subarashimos-director-toggle" class="menu_button interactable subarashimos-director-toggle" style="
            background-color: #2980b9;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            margin: 0 4px;
            display: inline-block;
        " tabindex="0" role="button">
            <i class="fa-solid fa-clapperboard"></i> Director: On
        </button>
    `;
    $('#extension-buttons-wrapper').append(buttonHtml);

    $('#subarashimos-director-toggle').on('click', () => {
        const settings = extension_settings[extensionName];
        settings.directorActive = !(settings.directorActive !== false);
        saveSettingsDebounced();
        updateDirectorToggleState();
    });
    updateDirectorToggleVisibility();
}

/** Syncs director settings panel + chat-bar toggle visibility from `extension_settings`. */
export function syncDirectorSettingsUi() {
    const s = extension_settings[extensionName];
    $('#subarashimos-toggle-director').prop('checked', s.enableDirector === true);
    $('#subarashimos-director-context-depth').val(
        Number.isFinite(Number(s.directorContextDepth)) ? Number(s.directorContextDepth) : 4,
    );
    $('#subarashimos-custom-director-prompt').val(
        (s.customDirectorSystemPrompt || '').trim() ? s.customDirectorSystemPrompt : DEFAULT_DIRECTOR_SYSTEM_PROMPT,
    );
    updateDirectorToggleVisibility();
}

/**
 * Settings UI + GENERATION_STARTED (non-normal) + USER_MESSAGE_RENDERED (normal send, after interception) + GENERATION_ENDED.
 */
export function initDirector() {
    syncDirectorSettingsUi();
    mountDirectorToggle();

    eventSource.makeFirst(event_types.GENERATION_STARTED, async (type, options, dryRun) => {
        await handleDirectorGenerationStarted(String(type), options || {}, dryRun === true);
    });

    eventSource.makeFirst(event_types.USER_MESSAGE_RENDERED, async (messageId) => {
        await handleDirectorUserMessageRendered(Number(messageId));
    });

    eventSource.on(event_types.GENERATION_ENDED, () => {
        clearDirectorInjection();
    });

    $('#subarashimos-toggle-director').on('change', function () {
        extension_settings[extensionName].enableDirector = $(this).prop('checked');
        saveSettingsDebounced();
        updateDirectorToggleVisibility();
    });

    $('#subarashimos-director-context-depth').on('change', function () {
        const v = parseInt(String($(this).val()), 10);
        extension_settings[extensionName].directorContextDepth = Number.isFinite(v) ? Math.max(0, Math.min(99, v)) : 4;
        saveSettingsDebounced();
    });

    $('#subarashimos-custom-director-prompt').on('blur', function () {
        const trimmed = String($(this).val() || '').trim();
        extension_settings[extensionName].customDirectorSystemPrompt =
            trimmed === DEFAULT_DIRECTOR_SYSTEM_PROMPT.trim() ? '' : trimmed;
        saveSettingsDebounced();
    });

    $('#subarashimos-restore-director-prompt').on('click', function () {
        extension_settings[extensionName].customDirectorSystemPrompt = '';
        saveSettingsDebounced();
        $('#subarashimos-custom-director-prompt').val(DEFAULT_DIRECTOR_SYSTEM_PROMPT);
        toastr.success('Director system prompt restored to default', "Subarashimo's Tools");
    });
}
