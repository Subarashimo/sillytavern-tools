import { extension_settings } from '../../../extensions.js';
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extensionFolderPath, extensionName, loadSettings } from './src/config.js';
import { dedent } from './src/dedent.js';
import { initMessageInterception, syncMessageInterceptionSettingsUi } from './src/interceptor.js';
import { handleJudge, initJudge, syncJudgeSettingsUi } from './src/judge.js';
import { initDirector, syncDirectorSettingsUi } from './src/director.js';
import {
    applyPresetPayloadToSettings,
    bundledPresetLabel,
    fetchBundledPresetFilenames,
    fetchBundledPresetPayload,
    parsePresetRef,
    presetPayloadFromSettings,
} from './src/presets.js';
import { registerCharacterTools } from './src/tools.js';

// TODO: Make lorebook entries into callable tools.

const EXTENSION_SETTINGS_HTML = dedent(`
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Subarashimo's Tools</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <h4 class="margin0 marginTop5">Presets</h4>
            <div class="flex-container flexFlowColumn marginTop5">
                <div class="flex-container flexFlowRow marginTop5" style="flex-wrap: wrap; align-items: center; gap: 8px;">
                    <select id="subarashimos-preset-select" class="text_pole" style="flex: 1; min-width: 12rem;"></select>
                    <div id="subarashimos-save-user-preset" class="menu_button">Save</div>
                    <div id="subarashimos-delete-preset" class="menu_button" title="Built-in presets cannot be deleted">Delete</div>
                </div>
            </div>

            <hr class="marginTop10" />
            <h4 class="margin0 marginTop5">Enabled tools</h4>
            <p class="margin0 marginTop5">
                Comma-separated tool ids for this session (all chats). Example: <code>roll_d20, timeskip</code>
            </p>
            <input
                id="subarashimos-enabled-tools"
                class="text_pole wide marginTop5"
                type="text"
                autocomplete="off"
                placeholder="(none)"
            />

            <hr class="marginTop10" />
            <h4 class="margin0 marginTop5">Message interception</h4>
            <p class="margin0 subarashimos-interception-help marginTop5">
                After you send a message, the main model runs once more to rewrite your line from your persona and recent chat.
                Uses one extra API call per send when enabled.
            </p>
            <label class="checkbox flex-container">
                <input id="subarashimos-toggle-message-interception" type="checkbox" />
                <span>Enable message interception</span>
            </label>
            <div class="flex-container flexFlowColumn marginTop5">
                <label for="subarashimos-message-interception-depth">Context depth (messages before your message)</label>
                <input
                    id="subarashimos-message-interception-depth"
                    class="text_pole"
                    type="number"
                    min="0"
                    max="99"
                    step="1"
                />
            </div>
            <div class="flex-container flexFlowColumn marginTop5">
                <label for="subarashimos-custom-interception-prompt">Interceptor system prompt</label>
                <textarea
                    id="subarashimos-custom-interception-prompt"
                    class="text_pole wide"
                    rows="8"
                    placeholder="Edit to override the built-in default shown above."
                ></textarea>
            </div>
            <div class="flex-container marginTop5">
                <div id="subarashimos-restore-interception-prompt" class="menu_button">Restore default interception prompt</div>
            </div>

            <hr class="marginTop10" />
            <h4 class="margin0 marginTop5">Judge (rule compliance)</h4>
            <p class="margin0 subarashimos-judge-help marginTop5">
                After each assistant message, runs a separate check against this character's card (description, personality, scenario, instructions) and recent chat.
                If the reply breaks those rules, it is regenerated with a short explanation of what went wrong. Uses one extra API call per assistant message when enabled (more if it retries).
            </p>
            <label class="checkbox flex-container">
                <input id="subarashimos-toggle-judge" type="checkbox" />
                <span>Enable judge</span>
            </label>
            <div class="flex-container flexFlowColumn marginTop5">
                <label for="subarashimos-judge-context-depth">Context depth (messages before the reply being judged)</label>
                <input
                    id="subarashimos-judge-context-depth"
                    class="text_pole"
                    type="number"
                    min="0"
                    max="99"
                    step="1"
                />
            </div>
            <div class="flex-container flexFlowColumn marginTop5">
                <label for="subarashimos-judge-max-retries">Max regeneration attempts per reply</label>
                <input
                    id="subarashimos-judge-max-retries"
                    class="text_pole"
                    type="number"
                    min="0"
                    max="20"
                    step="1"
                />
            </div>
            <div class="flex-container flexFlowColumn marginTop5">
                <label for="subarashimos-custom-judge-prompt">Judge system prompt</label>
                <textarea
                    id="subarashimos-custom-judge-prompt"
                    class="text_pole wide"
                    rows="10"
                    placeholder="Edit to override the built-in default."
                ></textarea>
            </div>
            <div class="flex-container marginTop5">
                <div id="subarashimos-restore-judge-prompt" class="menu_button">Restore default judge prompt</div>
            </div>

            <hr class="marginTop10" />
            <h4 class="margin0 marginTop5">Director (pre-generation scene hint)</h4>
            <p class="margin0 subarashimos-director-help marginTop5">
                Before the main assistant reply, runs a separate call with this character&apos;s card and recent chat,
                to generate a short scene-direction hint injected into the prompt. Uses one extra API call per generation when enabled.
            </p>
            <label class="checkbox flex-container">
                <input id="subarashimos-toggle-director" type="checkbox" />
                <span>Enable director</span>
            </label>
            <div class="flex-container flexFlowColumn marginTop5">
                <label for="subarashimos-director-context-depth">Context depth (messages included for the director)</label>
                <input
                    id="subarashimos-director-context-depth"
                    class="text_pole"
                    type="number"
                    min="0"
                    max="99"
                    step="1"
                />
            </div>
            <div class="flex-container flexFlowColumn marginTop5">
                <label for="subarashimos-custom-director-prompt">Director system prompt</label>
                <textarea
                    id="subarashimos-custom-director-prompt"
                    class="text_pole wide"
                    rows="8"
                    placeholder="Edit to override the built-in default."
                ></textarea>
            </div>
            <div class="flex-container marginTop5">
                <div id="subarashimos-restore-director-prompt" class="menu_button">Restore default director prompt</div>
            </div>
        </div>
    </div>
`);

jQuery(async () => {
    loadSettings();
    registerCharacterTools();

    const settingsHtml = `
        <div id="subarashimo-tools-settings" class="extension_container">
            ${EXTENSION_SETTINGS_HTML}
        </div>
    `;

    $('#extensions_settings2').append(settingsHtml);

    const $presetSelect = $('#subarashimos-preset-select');
    const $enabledTools = $('#subarashimos-enabled-tools');
    let presetSelectBusy = false;

    function syncEnabledToolsFromSettings() {
        $enabledTools.val(extension_settings[extensionName].enabledTools || '');
    }

    function updateDeletePresetButton() {
        const ref = parsePresetRef(String($presetSelect.val() || ''));
        const $btn = $('#subarashimos-delete-preset');
        const canDelete = ref?.kind === 'custom';
        $btn.prop('disabled', !canDelete);
        $btn.attr('title', canDelete ? 'Delete this preset permanently' : 'Built-in presets cannot be deleted');
    }

    async function rebuildPresetDropdown() {
        presetSelectBusy = true;
        const s = extension_settings[extensionName];
        let bundled = [];
        try {
            bundled = await fetchBundledPresetFilenames();
        } catch {
            bundled = ['Default.json', 'Devious Dungeon (ST).json'];
        }
        $presetSelect.empty();
        for (const f of bundled) {
            $presetSelect.append(
                $('<option></option>').attr('value', `file:${f}`).text(bundledPresetLabel(f)),
            );
        }
        for (const p of s.userPresets || []) {
            $presetSelect.append($('<option></option>').attr('value', `custom:${p.id}`).text(p.name));
        }

        const ref = s.activePresetRef;
        const hasRef = $presetSelect.find('option').filter(function () {
            return this.value === ref;
        }).length > 0;
        if (hasRef) {
            $presetSelect.val(ref);
        } else if (bundled.length > 0) {
            const fallback = `file:${bundled[0]}`;
            s.activePresetRef = fallback;
            saveSettingsDebounced();
            $presetSelect.val(fallback);
        }
        presetSelectBusy = false;
        updateDeletePresetButton();
    }

    async function loadPresetByRef(ref) {
        const parsed = parsePresetRef(ref);
        if (!parsed) {
            throw new Error('Invalid preset selection.');
        }
        let payload;
        if (parsed.kind === 'file') {
            payload = await fetchBundledPresetPayload(parsed.fileName);
        } else {
            const p = (extension_settings[extensionName].userPresets || []).find((x) => x.id === parsed.id);
            if (!p) {
                await rebuildPresetDropdown();
                throw new Error('That preset no longer exists.');
            }
            payload = p.data;
        }
        applyPresetPayloadToSettings(extension_settings[extensionName], payload);
        extension_settings[extensionName].activePresetRef = ref;
        saveSettingsDebounced();
        syncEnabledToolsFromSettings();
        syncMessageInterceptionSettingsUi();
        syncJudgeSettingsUi();
        syncDirectorSettingsUi();
        updateDeletePresetButton();
    }

    initMessageInterception();
    initJudge();
    initDirector();

    eventSource.on(event_types.MESSAGE_RECEIVED, (messageId, type) => {
        void handleJudge(Number(messageId), String(type));
    });

    $enabledTools.on('blur', function () {
        extension_settings[extensionName].enabledTools = String($(this).val() || '').trim();
        saveSettingsDebounced();
    });

    await rebuildPresetDropdown();
    syncEnabledToolsFromSettings();

    $presetSelect.on('change', async function () {
        if (presetSelectBusy) {
            return;
        }
        const ref = String($(this).val() || '');
        try {
            await loadPresetByRef(ref);
            toastr.success('Preset loaded.', "Subarashimo's Tools");
        } catch (e) {
            console.error("[Subarashimo's Tools] Preset load failed:", e);
            toastr.error(String(e?.message || e), "Subarashimo's Tools");
        }
    });

    $('#subarashimos-save-user-preset').on('click', () => {
        const name = prompt('Name for this preset?', '');
        if (name === null) {
            return;
        }
        const trimmed = name.trim();
        if (!trimmed) {
            toastr.warning('Enter a name for the preset.', "Subarashimo's Tools");
            return;
        }
        const s = extension_settings[extensionName];
        const data = presetPayloadFromSettings(s);
        const id = crypto.randomUUID();
        s.userPresets.push({ id, name: trimmed, data });
        s.activePresetRef = `custom:${id}`;
        saveSettingsDebounced();
        void rebuildPresetDropdown().then(() => {
            $presetSelect.val(s.activePresetRef);
            updateDeletePresetButton();
        });
        toastr.success('Preset saved.', "Subarashimo's Tools");
    });

    $('#subarashimos-delete-preset').on('click', async () => {
        const ref = parsePresetRef(String($presetSelect.val() || ''));
        if (!ref || ref.kind !== 'custom') {
            toastr.info('Only presets you created can be deleted. Built-in presets are part of the extension.', "Subarashimo's Tools");
            return;
        }
        const presetLabel = String($presetSelect.find('option:selected').text() || '').trim() || 'this preset';
        if (
            !confirm(
                `Delete preset "${presetLabel}"?\n\nThis cannot be undone. Your other settings will switch to the default preset.`,
            )
        ) {
            return;
        }
        const s = extension_settings[extensionName];
        s.userPresets = (s.userPresets || []).filter((p) => p.id !== ref.id);
        s.activePresetRef = 'file:Default.json';
        saveSettingsDebounced();
        try {
            const payload = await fetchBundledPresetPayload('Default.json');
            applyPresetPayloadToSettings(s, payload);
            saveSettingsDebounced();
        } catch (e) {
            console.error("[Subarashimo's Tools] Failed to load Default.json:", e);
        }
        syncEnabledToolsFromSettings();
        syncMessageInterceptionSettingsUi();
        syncJudgeSettingsUi();
        syncDirectorSettingsUi();
        await rebuildPresetDropdown();
        $presetSelect.val(s.activePresetRef);
        updateDeletePresetButton();
        toastr.success('Preset removed; defaults applied.', "Subarashimo's Tools");
    });

    console.log(`[Subarashimo's Tools] loaded; tools registered. Path: ${extensionFolderPath}`);
});
