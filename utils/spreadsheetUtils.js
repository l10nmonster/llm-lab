// utils/spreadsheetUtils.js

/**
 * Converts a spreadsheet column letter to its zero-based index.
 */
// No changes needed inside the function
function colToIndex(colStr) {
    if (!colStr || typeof colStr !== 'string') return -1;
    const str = colStr.toUpperCase();
    let index = 0;
    for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        if (charCode < 65 || charCode > 90) return -1;
        index = index * 26 + (charCode - 64);
    }
    return index - 1;
}

/**
 * Converts a zero-based column index to its spreadsheet column letter.
 */
// No changes needed inside the function
function indexToCol(index) {
    if (index < 0) return '';
    let colStr = "";
    let num = index + 1;
    while (num > 0) {
        let remainder = (num - 1) % 26;
        colStr = String.fromCharCode(65 + remainder) + colStr;
        num = Math.floor((num - 1) / 26);
    }
    return colStr;
}

export { colToIndex, indexToCol }; // Export existing

/**
 * Calculates the A1 notation range string for specified columns.
 * @param {string} sourceCol Letter of the source column.
 * @param {string|null} notesCol Letter of the notes column (optional).
 * @param {number} startRow One-based start row index.
 * @param {number|null} endRow One-based end row index (optional). Will be ignored if auto-detecting.
 * @returns {{ baseRange: string, startColLetter: string, endColLetter:string, startColIndex: number, sourceRelIndex: number, notesRelIndex: number }}
 *          baseRange: e.g., A:C or A:A (without sheet name or row numbers, for column fetching)
 *          startColLetter, endColLetter: letters for the full range to fetch
 *          startColIndex: Zero-based index of the starting column of the range.
 *          sourceRelIndex: Zero-based index of the source column *relative* to the start column.
 *          notesRelIndex: Zero-based index of the notes column *relative* to the start column, or -1.
 */
export function getColumnRangeDefinition(sourceCol, notesCol) {
    const sourceIdx = colToIndex(sourceCol);
    const notesIdx = notesCol ? colToIndex(notesCol) : -1;

    if (sourceIdx === -1) {
        throw new Error(`Invalid source column format: ${sourceCol}`);
    }
     if (notesCol && notesIdx === -1) {
         throw new Error(`Invalid notes column format: ${notesCol}`);
     }

    let startColIdx = sourceIdx;
    let endColIdx = sourceIdx;
    let sourceRelativeIdx = 0;
    let notesRelativeIdx = -1;

    if (notesIdx !== -1 && notesIdx !== sourceIdx) { // Ensure notes column is different and valid
        startColIdx = Math.min(sourceIdx, notesIdx);
        endColIdx = Math.max(sourceIdx, notesIdx);
        sourceRelativeIdx = sourceIdx - startColIdx;
        notesRelativeIdx = notesIdx - startColIdx;
    } else if (notesIdx === sourceIdx) { // If notes and source are same, only fetch one
        notesRelativeIdx = 0; // notes points to the same as source
    }


    const startColLetter = indexToCol(startColIdx);
    const endColLetter = indexToCol(endColIdx);

    const baseRange = `${startColLetter}:${endColLetter}`; // e.g., A:C or just A:A if single column

    return {
        baseRangeWithoutSheet: baseRange, // Range of columns to read, e.g., A:C
        startColLetter: startColLetter,
        endColLetter: endColLetter,
        startColIndex: startColIdx,
        sourceRelIndex: sourceRelativeIdx,
        notesRelIndex: notesRelativeIdx
    };
}
