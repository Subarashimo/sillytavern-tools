import { extension_settings, getContext } from '../../../../extensions.js';
import {
    saveSettingsDebounced,
    eventSource,
    event_types,
    generateRaw,
    Generate,
    chat,
    getCharacterCardFields,
    substituteParams,
    main_api,
    setSendButtonState,
    isGenerating,
    extension_prompt_types,
    extension_prompt_roles,
    setExtensionPrompt,
} from '../../../../../script.js';
import { extensionName } from './config.js';
import {
    buildRecentChatContextLines,
    ensureExtensionButtonsWrapper,
    tryParseJsonLenient,
    withExtensionPromptFirstApiHopOnly,
} from './utils.js';

/** Default judge system prompt (macros like {{char}} are expanded). Character rules are sent in a following system message. */
export const DEFAULT_JUDGE_SYSTEM_PROMPT = `You are an impartial compliance judge for {{char}}'s latest assistant reply in this chat. Use "{{char}}'s rules", the recent conversation, and the message under review. Decide whether that reply follows the rules. Respond with a JSON object only (no markdown fences), using this exact shape: {"compliant":true} if the reply is acceptable, or {"compliant":false,"violations":"short explanation of what broke the rules and how to fix it"} if it is not. Be very strict about function calls and tool usage. If {{char}} did not call a tool when it should have, the message is not compliant. Do note that function calls may be called "tool calls" instead, and may be performed by the system rather than {{char}}, these are still compliant.`;

const JUDGE_JSON_SCHEMA = {
    type: 'object',
    properties: {
        compliant: { type: 'boolean' },
        violations: {
            type: 'string',
            description:
                'If compliant is false, a concise explanation for the model to fix; empty or omitted if compliant.',
        },
    },
    required: ['compliant'],
    additionalProperties: false,
};

/** Injected for judge-triggered regen only; cleared after the first `GENERATE_AFTER_DATA` so tool continuations do not repeat it. */
const JUDGE_REGEN_PROMPT_KEY = 'SubarashimosTools_JudgeRegen';

let judgeBusy = false;
let judgeRetryChain = 0;
/** Set when the user stops main generation; next assistant MESSAGE_RECEIVED should not be judged (partial / aborted line). */
let skipJudgeAfterGenerationStopped = false;

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

/**
 * @param {string} assistantText
 * @param {string} rulesBlock
 * @param {string} recentContext
 * @returns {Promise<{ compliant: boolean, violations: string }>}
 */
async function evaluateCompliance(assistantText, rulesBlock, recentContext) {
    const settings = extension_settings[extensionName];
    const basePrompt = (settings.customJudgeSystemPrompt || '').trim() || DEFAULT_JUDGE_SYSTEM_PROMPT;

    const promptMessages = [
        { role: 'system', content: basePrompt },
        { role: 'system', content: `{{char}}'s rules:\n${rulesBlock || '(none provided)'}` },
        {
            role: 'system',
            content: `Recent messages (newest last):\n${recentContext || 'None'}`,
        },
        {
            role: 'user',
            content: `{{char}}'s message to evaluate:\n---\n${assistantText}\n---`,
        },
    ];

    const useSchema = main_api === 'openai';

    const raw = await generateRaw({
        prompt: promptMessages,
        quietToLoud: false,
        responseLength: 1200,
        trimNames: false,
        ...(useSchema ? { jsonSchema: JUDGE_JSON_SCHEMA } : {}),
    });

    const parsed = tryParseJsonLenient(typeof raw === 'string' ? raw : JSON.stringify(raw));

    if (!parsed || typeof parsed.compliant !== 'boolean') {
        return { compliant: true, violations: '' };
    }

    const violations = typeof parsed.violations === 'string' ? parsed.violations.trim() : '';
    return { compliant: parsed.compliant, violations };
}

/** MESSAGE_RECEIVED passes the generation kind; only judge normal assistant sends, not regen/swipe (avoids loops with manual Regenerate). */
function shouldSkipGenerationType(type) {
    return (
        type === 'impersonate' ||
        type === 'quiet' ||
        type === 'append' ||
        type === 'continue' ||
        type === 'swipe' ||
        type === 'regenerate'
    );
}

/**
 * @param {number} messageId
 * @param {string} type
 */
export async function handleJudge(messageId, type) {
    const settings = extension_settings[extensionName];
    if (!settings.enableJudge || settings.judgeActive === false) {
        return;
    }

    const ctx = getContext();
    if (ctx.groupId) {
        return;
    }

    if (shouldSkipGenerationType(type)) {
        return;
    }

    if (judgeBusy) {
        return;
    }

    // Tool calling: MESSAGE_RECEIVED fires for the interim assistant line before tools run, then again after
    // continuation. Judging the interim step triggers Regenerate while the pipeline is still active → loops.
    // Yield one macrotask so unblock / tool follow-up can run, then only judge when no generation is in progress.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (skipJudgeAfterGenerationStopped) {
        skipJudgeAfterGenerationStopped = false;
        return;
    }
    if (isGenerating()) {
        return;
    }

    const lastInChat = chat[chat.length - 1];
    if (!lastInChat || lastInChat.is_user) {
        return;
    }

    if (messageId !== chat.length - 1) {
        return;
    }

    // Skip the opening line (first message in the chat, e.g. greeting / first message)—nothing to ground it on yet.
    if (messageId === 0) {
        return;
    }

    const msg = chat[messageId];
    if (!msg || msg.is_user) {
        return;
    }

    const text = String(msg.mes || '').trim();
    if (!text) {
        return;
    }

    const maxRetries = Math.max(0, Number(settings.judgeMaxRetries) || 3);

    judgeBusy = true;
    setSendButtonState(true);
    try {
        const chatHistory = ctx.chat || chat;
        const depth = Number(settings.judgeContextDepth) || 4;
        const recentContext = buildRecentChatContextLines(chatHistory, messageId, depth);
        const rulesBlock = buildCharacterRulesBlock();
        const { compliant, violations } = await evaluateCompliance(text, rulesBlock, recentContext);

        if (compliant) {
            judgeRetryChain = 0;
            return;
        }

        if (judgeRetryChain >= maxRetries) {
            toastr.warning(
                `Judge: max retries (${maxRetries}) reached. Last issues: ${violations || 'unknown'}`,
                "Subarashimo's Tools",
            );
            judgeRetryChain = 0;
            return;
        }

        judgeRetryChain++;

        const retryInstruction = substituteParams(
            `The previous reply was rejected by the judge for not following {{char}}'s rules.\n\nWhat was wrong:\n${violations || 'Unspecified rule violations.'}\n\nWrite a new reply that fully complies with the character rules and fixes these problems. Stay consistent with the chat so far. Do not acknowledge this message, simply do as you're told and continue the story.`,
        );

        /**
         * Do not use `quiet_prompt`: ST threads it into nested `Generate('normal', { quiet_prompt, ... })`. Use an extension
         * prompt and remove it on the first `GENERATE_AFTER_DATA` (first `generate_data` already includes the text; tool
         * follow-ups rebuild without it).
         */
        await withExtensionPromptFirstApiHopOnly(
            JUDGE_REGEN_PROMPT_KEY,
            () =>
                setExtensionPrompt(
                    JUDGE_REGEN_PROMPT_KEY,
                    retryInstruction,
                    extension_prompt_types.IN_PROMPT,
                    0,
                    false,
                    extension_prompt_roles.SYSTEM,
                ),
            () => Generate('regenerate', {}),
        );
    } catch (error) {
        console.error("[Subarashimo's Tools] Judge failed:", error);
        toastr.error(String(error?.message || error), "Subarashimo's Tools");
    } finally {
        judgeBusy = false;
        setSendButtonState(false);
    }
}

function resetRetryChainOnUserSend() {
    judgeRetryChain = 0;
    skipJudgeAfterGenerationStopped = false;
}

function updateJudgeToggleState() {
    const $toggle = $('#subarashimos-judge-toggle');
    if (!$toggle.length) {
        return;
    }
    const settings = extension_settings[extensionName];
    const active = settings.judgeActive !== false;
    const prefix = 'Judge:';
    const label = active ? 'On' : 'Off';
    const icon = active ? 'fa-scale-balanced' : 'fa-ban';
    const background = active ? '#4a90e2' : '#666';

    $toggle
        .css({
            'background-color': background,
            color: '#fff',
        })
        .html(`<i class="fa-solid ${icon}"></i> ${prefix} ${label}`);
    $toggle.attr(
        'title',
        active
            ? 'Rule judge on (click to skip compliance check for this session)'
            : 'Rule judge off (click to enforce rules again)',
    );
}

function updateJudgeToggleVisibility() {
    const $toggle = $('#subarashimos-judge-toggle');
    if (!$toggle.length) {
        return;
    }
    const settings = extension_settings[extensionName];
    const show = settings.enableJudge === true;
    $toggle.toggle(show);
    if (show) {
        updateJudgeToggleState();
    }
}

function mountJudgeToggle() {
    if ($('#subarashimos-judge-toggle').length) {
        updateJudgeToggleVisibility();
        return;
    }
    if (!$('#send_form').length) {
        return;
    }

    ensureExtensionButtonsWrapper();

    const buttonHtml = `
        <button type="button" id="subarashimos-judge-toggle" class="menu_button interactable subarashimos-judge-toggle" style="
            background-color: #8e44ad;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            margin: 0 4px;
            display: inline-block;
        " tabindex="0" role="button">
            <i class="fa-solid fa-scale-balanced"></i> Judge: On
        </button>
    `;
    $('#extension-buttons-wrapper').append(buttonHtml);

    $('#subarashimos-judge-toggle').on('click', () => {
        const settings = extension_settings[extensionName];
        settings.judgeActive = !(settings.judgeActive !== false);
        saveSettingsDebounced();
        updateJudgeToggleState();
    });
    updateJudgeToggleVisibility();
}

/** Syncs judge settings panel + chat-bar toggle visibility from `extension_settings`. */
export function syncJudgeSettingsUi() {
    const s = extension_settings[extensionName];
    $('#subarashimos-toggle-judge').prop('checked', s.enableJudge === true);
    $('#subarashimos-judge-max-retries').val(
        Number.isFinite(Number(s.judgeMaxRetries)) ? Number(s.judgeMaxRetries) : 3,
    );
    $('#subarashimos-judge-context-depth').val(
        Number.isFinite(Number(s.judgeContextDepth)) ? Number(s.judgeContextDepth) : 4,
    );
    $('#subarashimos-custom-judge-prompt').val(
        (s.customJudgeSystemPrompt || '').trim() ? s.customJudgeSystemPrompt : DEFAULT_JUDGE_SYSTEM_PROMPT,
    );
    updateJudgeToggleVisibility();
}

/**
 * Settings UI + MESSAGE_RECEIVED hook for the judge.
 */
export function initJudge() {
    syncJudgeSettingsUi();
    mountJudgeToggle();

    eventSource.on(event_types.GENERATION_STOPPED, () => {
        if (!judgeBusy) {
            skipJudgeAfterGenerationStopped = true;
        }
    });

    eventSource.on(event_types.MESSAGE_SENT, resetRetryChainOnUserSend);

    $('#subarashimos-toggle-judge').on('change', function () {
        extension_settings[extensionName].enableJudge = $(this).prop('checked');
        saveSettingsDebounced();
        updateJudgeToggleVisibility();
    });

    $('#subarashimos-judge-max-retries').on('change', function () {
        const v = parseInt(String($(this).val()), 10);
        extension_settings[extensionName].judgeMaxRetries = Number.isFinite(v) ? Math.max(0, Math.min(20, v)) : 3;
        saveSettingsDebounced();
    });

    $('#subarashimos-judge-context-depth').on('change', function () {
        const v = parseInt(String($(this).val()), 10);
        extension_settings[extensionName].judgeContextDepth = Number.isFinite(v) ? Math.max(0, Math.min(99, v)) : 4;
        saveSettingsDebounced();
    });

    $('#subarashimos-custom-judge-prompt').on('blur', function () {
        const trimmed = String($(this).val() || '').trim();
        extension_settings[extensionName].customJudgeSystemPrompt =
            trimmed === DEFAULT_JUDGE_SYSTEM_PROMPT.trim() ? '' : trimmed;
        saveSettingsDebounced();
    });

    $('#subarashimos-restore-judge-prompt').on('click', function () {
        extension_settings[extensionName].customJudgeSystemPrompt = '';
        saveSettingsDebounced();
        $('#subarashimos-custom-judge-prompt').val(DEFAULT_JUDGE_SYSTEM_PROMPT);
        toastr.success('Judge system prompt restored to default', "Subarashimo's Tools");
    });
}
