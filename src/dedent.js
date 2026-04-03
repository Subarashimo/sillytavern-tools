/**
 * Strip a common leading indent from each line so multiline template literals can match surrounding code style.
 * Empty lines are preserved; indentation is taken from non-empty lines only.
 * @param {string} str
 * @returns {string}
 */
export function dedent(str) {
    const trimmed = str.replace(/^\r?\n/, '').replace(/\r?\n\s*$/, '');
    const lines = trimmed.split('\n');
    let minIndent = Infinity;
    for (const line of lines) {
        if (line.trim() === '') {
            continue;
        }
        const m = /^\s*/.exec(line)[0].length;
        minIndent = Math.min(minIndent, m);
    }
    if (!Number.isFinite(minIndent)) {
        return trimmed.trim();
    }
    return lines
        .map((line) => (line.trim() === '' ? '' : line.slice(minIndent)))
        .join('\n')
        .trimEnd();
}
