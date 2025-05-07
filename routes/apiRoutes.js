// routes/apiRoutes.js
import express from 'express';
import * as googleAuth from '../services/googleAuth.js'; // Import all named exports
import * as googleSheets from '../services/googleSheets.js';
import { providers, translate } from '../services/l10nMonster.js';
import { getColumnRangeDefinition } from '../utils/spreadsheetUtils.js';

const router = express.Router();

// GET /providers
router.get('/providers', (req, res) => {
    console.log('GET /providers requested');
    return res.json(providers.map(p => p.id));
});

router.post('/project', async (req, res) => {
    console.log('POST /api/project received');
    let authClient;
    try {
        authClient = googleAuth.getAuthorizedClient();
    } catch (authError) {
        return res.status(401).json({ status: 'error', message: 'Server requires Google authorization.' });
    }

    const {
        spreadsheetId, gid, // Use GID
        testName, sourceLanguage, targetLanguage,
        sourceColumn, notesColumn,
        startRow, endRow, translators
    } = req.body;

    console.log("Processing data:", JSON.stringify(req.body, null, 2));

    // --- Validation ---
    if (!spreadsheetId || !gid || !testName || !sourceColumn || !startRow || !translators || translators.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Missing required project data.' });
    }
    // ... (other validations remain the same) ...
    if (isNaN(startRow) || startRow < 1) { return res.status(400).json({ status: 'error', message: 'Invalid start row.' }); }
    if (endRow && (isNaN(endRow) || endRow < startRow)) { return res.status(400).json({ status: 'error', message: 'End row must be >= start row.' }); }
    if (!/^[A-Za-z]+$/.test(sourceColumn.toUpperCase())) { return res.status(400).json({ status: 'error', message: 'Invalid source column format.' }); }
    if (notesColumn && !/^[A-Za-z]+$/.test(notesColumn.toUpperCase())) { return res.status(400).json({ status: 'error', message: 'Invalid notes column format.' }); }


    let columnDef;
    let fetchedValues;
    let sourceDataPairs;
    let headerRow;
    let dataToWrite;
    let outputSheetId = null; // ID of the sheet where results are written

    try {
        // 1. Get Column Range Definition
        columnDef = getColumnRangeDefinition(sourceColumn, notesColumn || null);

        // 2. Read Data (passes gid, columnDef, startRow, endRow (can be null), and sourceColumn for auto-detect)
        fetchedValues = await googleSheets.readSheetData(
            authClient,
            spreadsheetId,
            gid,
            columnDef,
            startRow,
            endRow, // Pass endRow; if null, readSheetData will auto-detect
            sourceColumn // Pass sourceColumn for auto-detection logic
        );

        if (!fetchedValues || fetchedValues.length === 0) {
            // Handle case where readSheetData returns empty (e.g., no data found after auto-detect)
            return res.status(404).json({ status: 'error', message: `No data found in the specified source sheet (GID: ${gid}) or range.` });
        }

        // 3. Process Fetched Data
        sourceDataPairs = fetchedValues.map((row) => ({
            source: row[columnDef.sourceRelIndex] || '',
            notes: columnDef.notesRelIndex !== -1 ? (row[columnDef.notesRelIndex] || '') : null,
            // You can add sourceLanguage and targetLanguage to each pair if LLM service needs it per item
            // sourceLang: sourceLanguage,
            // targetLang: targetLanguage
        }));
        console.log(`Processed ${sourceDataPairs.length} source/notes pairs.`);

        // 4. Process with L10nMonster
        const translations = await translate(translators, { sourceLang: sourceLanguage, targetLang: targetLanguage, sourceDataPairs });

        // 5. Prepare Write Data
        headerRow = ["Source Text"];
        if (columnDef.notesRelIndex !== -1) headerRow.push("Notes");
        const instructionsRow = [...headerRow.map(x => ''), ...translators.map(t => t.instructions)];
        headerRow.push(...translators.map((t, idx) => `${t.provider}-${idx + 1}`));
        dataToWrite = [headerRow, instructionsRow];

        for (let i = 0; i < sourceDataPairs.length; i++) {
            const outputRow = [];
            outputRow.push(sourceDataPairs[i].source);
            if (columnDef.notesRelIndex !== -1) outputRow.push(sourceDataPairs[i].notes || '');
            translations.forEach(translation => {
                 const result = translation ? (translation[i] || '[ERROR: Missing]') : '[ERROR: Provider failed]';
                 outputRow.push(result);
             });
            dataToWrite.push(outputRow);
        }

        // 6. Write Data to a new sheet named after `testName`
        outputSheetId = await googleSheets.writeSheetData(authClient, spreadsheetId, testName, dataToWrite);

        // 7. Format Output Sheet
        if (outputSheetId) {
            await googleSheets.formatSheet(authClient, spreadsheetId, outputSheetId, headerRow.length);
        } else {
             console.warn("Skipping formatting as output sheet ID was not obtained.");
        }

        res.status(200).json({
            status: 'success',
            message: `Project processed! Results in sheet: "${testName}".`,
            sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${outputSheetId || ''}`
        });

    } catch (error) {
        console.error('Error processing /api/project request:', error.message, error.stack);
        let statusCode = 500;
        let responseMessage = 'An error occurred during project processing.';
        // ... (same detailed error handling as before) ...
        if (error.message.includes("No data found") || error.message.includes("not found in spreadsheet")) { statusCode = 404; responseMessage = error.message; }
        else if (error.message.includes("invalid grant")) { statusCode = 401; responseMessage = 'Authorization error. Token may be expired.'; }
        else if (error.message.includes("Failed to read") || error.message.includes("Failed to write") || error.message.includes("Failed to prepare sheet")) { statusCode = 502; responseMessage = error.message; }

        res.status(statusCode).json({ status: 'error', message: responseMessage });
    }
});

export default router;