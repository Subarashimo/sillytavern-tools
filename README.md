# Subarashimo's Tools

A [SillyTavern](https://github.com/SillyTavern/SillyTavern) third-party extension that adds **optional LLM pipelines** (message interception, judge, director) and **character-scoped function tools** for models that support tool calling.

## Presets

Presets bundle extension options (enabled tools, interception, judge, director, and their prompts/depths) so you can switch setups quickly.

- **Bundled presets** live under `data/presets/` and are listed in `data/presets/manifest.json` (for example: Default, Devious Dungeon, The Free Cities, The Puppy Girl Show).
- **User presets:** use **Save** to store the current settings under a custom name; use **Delete** to remove a user preset (built-in files cannot be deleted).

## Character tools (function calling)

When your connection supports SillyTavern’s tool calling, you can expose tools **per session** by listing their ids in **Enabled tools** (comma-separated, applies to **all chats**). Example: `roll_d20, timeskip`.

| Tool id | Purpose |
|--------|---------|
| `roll_d20` | Rolls a single d20 (1–20). |
| `random_slave` | Builds a randomized character from bundled JSON data; optional `setting`: `archology`, `fantasy`, or `puppy`. |
| `random_devious_room` | Picks a random “devious room” and may attach loot, monsters, events, or other details depending on the room type (data-driven). |
| `timeskip` | Lets the model declare how much in-story time passes (`period`); intended so the next reply continues after the skip. |
| `death` | Signals the user’s death; returns a random entry from death/aftermath data for continuing in a new narrative thread. |

Add more tools by extending `TOOL_SPECS` in `src/tools.js` (ids must match what you type in **Enabled tools**).

## Message interception

After **you** send a message, the extension can run the **main model once more** to rewrite your line using your persona and recent chat—similar to an “outgoing message polish” flow.

- **Cost:** one extra API call per user send when enabled.
- Options: toggle, **context depth** (messages before yours), and optional **custom interceptor system prompt** (with restore-default control).

## Judge (rule compliance)

After each **assistant** message, a separate pass checks the reply against this character’s card (description, personality, scenario, instructions) and recent chat. If the model breaks those rules, the reply is **regenerated** with a short explanation of the problem.

- **Cost:** at least one extra API call per assistant message when enabled; more if retries are needed.
- Options: toggle, **context depth**, **max regeneration attempts**, and optional **custom judge system prompt**.

## Director (pre-generation scene hint)

Before the **main** assistant generation, a separate call reads the character card and recent chat and produces a **short scene-direction hint** injected into the prompt for that reply.

- **Cost:** one extra API call per generation when enabled.
- Options: toggle, **context depth**, and optional **custom director system prompt**.

## Notes

- **Tool calling** must be supported and configured for character tools to register; otherwise tools stay inactive.
- Interception, judge, and director each add latency and token usage; use presets to turn whole “modes” on or off for different play styles.
- Bundled JSON under `data/` powers random generators; content may be adult-themed—use accordingly.
