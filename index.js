import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';
import { extensionFolderPath, extensionName, loadSettings } from './src/config.js';
import { dedent } from './src/dedent.js';
import { initMessageInterception } from './src/messages.js';
import { registerCharacterTools } from './src/tools.js';

const EXTENSION_SETTINGS_HTML = dedent(`
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Subarashimo's Tools</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <h4 class="margin0 marginTop5">Tool bindings</h4>
            <p class="margin0 subarashimos-bindings-instructions marginTop5">
                Each key is a character card name, <code>*</code> (any name), or <code>__group__</code> (group chat).
                Each value is a list of tool ids.
            </p>
            <textarea
                id="subarashimos-bindings-json"
                class="text_pole wide marginTop5 subarashimos-bindings-json"
                rows="8"
                placeholder='{"*":["roll_d20","random_devious_room","timeskip"]}'
            ></textarea>

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
                <label for="subarashimos-message-interception-depth">Context depth (messages before your line)</label>
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
                <label for="subarashimos-custom-interception-prompt">Custom system prompt</label>
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

    const $json = $('#subarashimos-bindings-json');

    function syncUiFromSettings() {
        const s = extension_settings[extensionName];
        try {
            $json.val(JSON.stringify(s.bindings || {}, null, 2));
        } catch {
            $json.val('{}');
        }
    }

    syncUiFromSettings();
    initMessageInterception();

    function applyJson() {
        const raw = String($json.val() || '').trim();
        if (!raw) {
            extension_settings[extensionName].bindings = {};
            saveSettingsDebounced();
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                throw new Error('Must be a JSON object.');
            }
            extension_settings[extensionName].bindings = parsed;
            saveSettingsDebounced();
            $json.css('border-color', '');
        } catch (e) {
            $json.css('border-color', 'var(--SmartThemeQuoteColor)');
            toastr.error(`Invalid JSON: ${e.message}`, "Subarashimo's Tools");
        }
    }

    $json.on('blur', applyJson);

    console.log(`[Subarashimo's Tools] loaded; tools registered (filtered by character). Path: ${extensionFolderPath}`);
});
