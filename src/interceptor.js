/** Outgoing user-message interception (persona rewrite) and chat-bar interception toggle. */
import { extension_settings, getContext } from '../../../../extensions.js';
import {
    saveSettingsDebounced,
    eventSource,
    event_types,
    generateRaw,
    updateMessageBlock,
    chat,
} from '../../../../../script.js';
import { extensionName } from './config.js';
import { buildRecentChatContextLines, ensureExtensionButtonsWrapper } from './utils.js';

/** Default interception system prompt (persona + recent chat; Markdown preserved when the draft uses it). Shown in settings when no custom prompt is saved. */
export const DEFAULT_MESSAGE_INTERCEPTION_PROMPT = `Act as an uncompromising Immersive Copy Editor who rewrites the user's draft to strictly adhere to {{user}}'s persona. Use the persona definition and recent conversation to judge tone, vocabulary, cognitive style, injuries, mood, social context, and what the scene implies about {{user}}. If the draft contradicts the persona or the established situation, override the draft for realism while preserving intent. Be careful not to apply speech modifications to narration or thoughts (e.g. a lisp only in spoken words, not in thoughts or narration). Apply speech quirks only to dialogue unless the draft clearly marks other lines as speech. Rephrase to match the character's capacity and tone. Keep the output concise; do not expand the narrative beyond necessary correction. Preserve Markdown structure: if the draft uses Markdown (headings, lists, emphasis, blockquotes, fenced code), keep the same formatting and only change wording; if the draft is plain text, output plain text. Never add facts that were not already implied or present. Never narrate consequences of {{user}}'s actions—only what they do or say. Do not include other characters' thoughts, actions, or speech. Return ONLY the modified message text.`;

/**
 * Intercepts the last user message, asks the LLM to rewrite it (persona + recent chat), then updates chat/DOM.
 * Adapted from RPG Companion `messageModification.js` (without separate RPG state injection).
 */
async function interceptAndModifyUserMessage() {
    const settings = extension_settings[extensionName];
    if (!settings.enableMessageInterception || settings.messageInterceptionActive === false) {
        return;
    }

    const context = getContext();
    const chatHistory = context.chat || chat;

    if (!chatHistory || chatHistory.length === 0) {
        return;
    }

    const lastMessage = chatHistory[chatHistory.length - 1];
    if (!lastMessage || !lastMessage.is_user) {
        return;
    }

    const originalText = lastMessage.mes || '';
    const depth = Number(settings.messageInterceptionContextDepth) || 4;
    const recentContext = buildRecentChatContextLines(chatHistory, chatHistory.length - 1, depth);

    const basePrompt = (settings.customMessageInterceptionPrompt || '').trim() || DEFAULT_MESSAGE_INTERCEPTION_PROMPT;

    const promptMessages = [
        { role: 'system', content: basePrompt },
        { role: 'system', content: `{{user}}'s persona definition:\n{{persona}}` },
        {
            role: 'system',
            content: `Recent messages (newest last):\n${recentContext || 'None'}`,
        },
        {
            role: 'user',
            content: `User draft message:\n${originalText}\n\nReturn only the modified message text.`,
        },
    ];

    const response = await generateRaw({
        prompt: promptMessages,
        quietToLoud: false,
    });

    if (!response || typeof response !== 'string') {
        return;
    }

    const cleaned = response.trim();
    if (!cleaned) {
        return;
    }

    lastMessage.mes = cleaned;

    const messageId = chatHistory.length - 1;
    const messageElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
    if (messageElement) {
        updateMessageBlock(messageId, lastMessage, { rerenderMessage: true });
    }
}

function updateInterceptionToggleState() {
    const $toggle = $('#subarashimos-interception-toggle');
    if (!$toggle.length) {
        return;
    }
    const settings = extension_settings[extensionName];
    const active = settings.messageInterceptionActive !== false;
    const prefix = 'Interception:';
    const label = active ? 'On' : 'Off';
    const icon = active ? 'fa-bolt' : 'fa-ban';
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
            ? 'Message interception on (click to skip rewrite)'
            : 'Message interception off (click to rewrite again)',
    );
}

function updateInterceptionToggleVisibility() {
    const $toggle = $('#subarashimos-interception-toggle');
    if (!$toggle.length) {
        return;
    }
    const settings = extension_settings[extensionName];
    const show = settings.enableMessageInterception === true;
    $toggle.toggle(show);
    if (show) {
        updateInterceptionToggleState();
    }
}

function mountInterceptionToggle() {
    if ($('#subarashimos-interception-toggle').length) {
        updateInterceptionToggleVisibility();
        return;
    }
    if (!$('#send_form').length) {
        return;
    }

    ensureExtensionButtonsWrapper();

    const buttonHtml = `
        <button type="button" id="subarashimos-interception-toggle" class="menu_button interactable subarashimos-interception-toggle" style="
            background-color: #e94560;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            margin: 0 4px;
            display: inline-block;
        " tabindex="0" role="button">
            <i class="fa-solid fa-bolt"></i> Interception: On
        </button>
    `;
    $('#extension-buttons-wrapper').append(buttonHtml);

    $('#subarashimos-interception-toggle').on('click', () => {
        const settings = extension_settings[extensionName];
        settings.messageInterceptionActive = !(settings.messageInterceptionActive !== false);
        saveSettingsDebounced();
        updateInterceptionToggleState();
    });
    updateInterceptionToggleVisibility();
}

async function onMessageSent() {
    try {
        await interceptAndModifyUserMessage();
    } catch (error) {
        console.error("[Subarashimo's Tools] Message interception failed:", error);
        toastr.error(String(error?.message || error), "Subarashimo's Tools");
    }
}

/**
 * Binds message interception UI and registers the send hook.
 */
export function initMessageInterception() {
    function syncInterceptionUiFromSettings() {
        const s = extension_settings[extensionName];
        $('#subarashimos-toggle-message-interception').prop('checked', s.enableMessageInterception === true);
        $('#subarashimos-message-interception-depth').val(
            Number.isFinite(Number(s.messageInterceptionContextDepth)) ? Number(s.messageInterceptionContextDepth) : 4,
        );
        $('#subarashimos-custom-interception-prompt').val(
            (s.customMessageInterceptionPrompt || '').trim()
                ? s.customMessageInterceptionPrompt
                : DEFAULT_MESSAGE_INTERCEPTION_PROMPT,
        );
    }

    syncInterceptionUiFromSettings();
    mountInterceptionToggle();
    eventSource.on(event_types.MESSAGE_SENT, onMessageSent);

    $('#subarashimos-toggle-message-interception').on('change', function () {
        extension_settings[extensionName].enableMessageInterception = $(this).prop('checked');
        saveSettingsDebounced();
        updateInterceptionToggleVisibility();
    });

    $('#subarashimos-message-interception-depth').on('change', function () {
        const v = parseInt(String($(this).val()), 10);
        extension_settings[extensionName].messageInterceptionContextDepth = Number.isFinite(v) ? Math.max(0, v) : 4;
        saveSettingsDebounced();
    });

    $('#subarashimos-custom-interception-prompt').on('blur', function () {
        const trimmed = String($(this).val() || '').trim();
        extension_settings[extensionName].customMessageInterceptionPrompt =
            trimmed === DEFAULT_MESSAGE_INTERCEPTION_PROMPT.trim() ? '' : trimmed;
        saveSettingsDebounced();
    });

    $('#subarashimos-restore-interception-prompt').on('click', function () {
        extension_settings[extensionName].customMessageInterceptionPrompt = '';
        saveSettingsDebounced();
        $('#subarashimos-custom-interception-prompt').val(DEFAULT_MESSAGE_INTERCEPTION_PROMPT);
        toastr.success('Message interception prompt restored to default', "Subarashimo's Tools");
    });
}
