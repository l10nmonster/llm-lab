// services/googleSheets.js
import { google } from 'googleapis';
import { indexToCol } from '../utils/spreadsheetUtils.js'; // Assuming colToIndex is also in here if needed directly

/**
 * Finds the sheet title for a given GID.
 * @param {google.auth.OAuth2} authClient
 * @param {string} spreadsheetId
 * @param {string} gid Sheet GID (can be string or number)
 * @returns {Promise<string|null>} Sheet title or null if not found.
 */
async function getSheetTitleByGid(authClient, spreadsheetId, gid) {
    const sheetsApi = google.sheets({ version: 'v4', auth: authClient });
    try {
        const response = await sheetsApi.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties(sheetId,title)', // Request only necessary fields
        });
        const sheet = response.data.sheets.find(s => s.properties.sheetId == gid); // Loose comparison for string/number GID
        return sheet ? sheet.properties.title : null;
    } catch (error) {
        console.error(`Error fetching sheet title for GID ${gid}:`, error.message);
        throw new Error(`Could not find sheet with GID ${gid} in spreadsheet ${spreadsheetId}.`);
    }
}

/**
 * Reads data from the specified sheet range.
 * @param {google.auth.OAuth2} authClient Authorized OAuth2 client.
 * @param {string} spreadsheetId The spreadsheet ID.
 * @param {string} gid The GID of the sheet to read from.
 * @param {object} columnRangeDef Definition object from getColumnRangeDefinition.
 * @param {number} startRow One-based start row index.
 * @param {number|null} endRow One-based end row index (if null, auto-detect).
 * @param {string} sourceColumnLetter The letter of the source column (e.g., "A") for auto-detection.
 * @returns {Promise<Array<Array<string>>>} A promise resolving to the array of rows data.
 */
export async function readSheetData(authClient, spreadsheetId, gid, columnRangeDef, startRow, endRow, sourceColumnLetter) {
    const sheetsApi = google.sheets({ version: 'v4', auth: authClient });

    const sheetTitle = await getSheetTitleByGid(authClient, spreadsheetId, gid);
    if (!sheetTitle) {
        throw new Error(`Sheet with GID ${gid} not found in spreadsheet ${spreadsheetId}.`);
    }
    console.log(`Reading from sheet: "${sheetTitle}" (GID: ${gid})`);

    let finalEndRow = endRow;

    if (!finalEndRow) { // Auto-detect end row if not provided
        console.log(`End row not specified. Auto-detecting last contiguous row in source column '${sourceColumnLetter}'.`);
        // Read the entire source column from startRow to find the last non-empty cell
        const sourceColumnRange = `'${sheetTitle}'!${sourceColumnLetter}${startRow}:${sourceColumnLetter}`;
        try {
            const colValuesResponse = await sheetsApi.spreadsheets.values.get({
                spreadsheetId,
                range: sourceColumnRange,
                majorDimension: 'COLUMNS', // Get data column-wise
            });
            const sourceColData = colValuesResponse.data.values ? colValuesResponse.data.values[0] : [];
            let lastContiguousRow = startRow -1; // Start from row before startRow for 0-based data array
            for (let i = 0; i < sourceColData.length; i++) {
                if (sourceColData[i] && sourceColData[i].trim() !== '') {
                    lastContiguousRow = startRow + i;
                } else {
                    // Stop at the first empty cell in the contiguous block
                    break;
                }
            }
            finalEndRow = lastContiguousRow;
             if (finalEndRow < startRow) { // No data found in source column after startRow
                console.warn(`No data found in source column ${sourceColumnLetter} from row ${startRow} for auto-detection.`);
                finalEndRow = startRow; // Default to just the startRow if nothing found
            }
            console.log(`Auto-detected end row: ${finalEndRow}`);
        } catch (error) {
            console.error('Error auto-detecting end row:', error.message);
            throw new Error('Failed to auto-detect end row. Please specify it or check sheet data.');
        }
    }

    // Construct the final A1 notation range with sheet title and row numbers
    const readRangeA1 = `'${sheetTitle}'!${columnRangeDef.startColLetter}${startRow}:${columnRangeDef.endColLetter}${finalEndRow}`;
    console.log(`Final read range: ${readRangeA1}`);

    try {
        const readResult = await sheetsApi.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: readRangeA1,
            valueRenderOption: 'FORMATTED_VALUE',
            dateTimeRenderOption: 'SERIAL_NUMBER',
        });

        const fetchedValues = readResult.data.values;
        if (!fetchedValues || fetchedValues.length === 0) {
            // This might happen if startRow is beyond actual data after auto-detection
             console.warn(`No data found in calculated range ${readRangeA1}.`);
             return []; // Return empty array, let calling function handle
        }
        return fetchedValues;
    } catch (error) {
        console.error(`Error reading sheet data from ${readRangeA1}:`, error.message);
        if (error.response && error.response.data) console.error('Google API Error:', error.response.data);
        throw new Error(`Failed to read data from ${readRangeA1}. Check permissions/range. Original: ${error.message}`);
    }
}

// ... writeSheetData and formatSheet remain largely the same (using sheetTitle for creation) ...
// Ensure sheetTitle used in writeSheetData is `testName` from the request
export async function writeSheetData(authClient, spreadsheetId, outputSheetTitle, dataToWrite) {
    // ... (logic for finding/creating sheet by outputSheetTitle, then writing)
     const sheets = google.sheets({ version: 'v4', auth: authClient });
     let sheetId = null;
     const headerLength = dataToWrite.length > 0 ? dataToWrite[0].length : 1;

    console.log(`Checking/Creating output sheet: "${outputSheetTitle}"`);
     try {
         const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId, fields: 'sheets.properties' });
         const existingSheet = spreadsheetInfo.data.sheets.find(s => s.properties.title === outputSheetTitle);

         if (existingSheet) {
             sheetId = existingSheet.properties.sheetId;
             console.log(`Found existing output sheet ID: ${sheetId}. Clearing range.`);
             const clearRange = `'${outputSheetTitle}'!A1:${indexToCol(headerLength - 1)}`;
             await sheets.spreadsheets.values.clear({ spreadsheetId, range: clearRange });
             console.log(`Cleared existing output sheet "${outputSheetTitle}".`);
         } else {
             console.log(`Creating new output sheet "${outputSheetTitle}".`);
             const addSheetRequest = { addSheet: { properties: { title: outputSheetTitle } } };
             const batchUpdateResponse = await sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests: [addSheetRequest] } });
             sheetId = batchUpdateResponse.data.replies[0]?.addSheet?.properties?.sheetId;
             if (!sheetId) throw new Error("Could not get sheetId for the newly created output sheet.");
             console.log(`New output sheet ID: ${sheetId}`);
         }
     } catch (error) {
         console.error(`Error preparing output sheet "${outputSheetTitle}":`, error.message);
         throw new Error(`Failed to prepare output sheet "${outputSheetTitle}": ${error.message}`);
     }

    try {
        const writeRange = `'${outputSheetTitle}'!A1`;
        console.log(`Writing data to output range: ${writeRange}`);
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: writeRange,
            valueInputOption: 'USER_ENTERED',
            resource: { values: dataToWrite },
        });
        console.log('Data written successfully to output sheet.');
        return sheetId;
    } catch (error) {
         console.error(`Error writing data to output sheet "${outputSheetTitle}":`, error.message);
         throw new Error(`Failed to write data to output sheet "${outputSheetTitle}": ${error.message}`);
    }
}

// formatSheet is the same
export async function formatSheet(authClient, spreadsheetId, sheetId, headerWidth) {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    console.log(`Formatting sheet ID: ${sheetId}`);
    const requests = [
        { updateSheetProperties: { properties: { sheetId: sheetId, gridProperties: { frozenRowCount: 2 } }, fields: 'gridProperties.frozenRowCount' } },
        { autoResizeDimensions: { dimensions: { sheetId: sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: headerWidth } } },
        { repeatCell: { range: { sheetId: sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headerWidth }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat(textFormat/bold)' } },
        { repeatCell: { range: { sheetId: sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 1, endColumnIndex: headerWidth }, cell: { userEnteredFormat: { textFormat: { italic: true } } }, fields: 'userEnteredFormat(textFormat/italic)' } }
    ];
     try {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });
        console.log('Sheet formatting applied.');
    } catch (formatError) {
        console.warn("Warning: Failed to apply formatting:", formatError.message);
        if (formatError.response && formatError.response.data) {
            console.warn('Google API Error details:', JSON.stringify(formatError.response.data, null, 2));
        }
    }
}

// Export the functions
export { getSheetTitleByGid };
