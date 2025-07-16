// server.js
import express from 'express';
import path from 'path';
import open from 'open';
import { initializeL10nMonster } from './services/l10nMonster.js';
import apiRoutes from './routes/apiRoutes.js';
// Use named imports and .js extension
import * as googleAuth from './services/googleAuth.js';

const app = express();
const port = 3000;

// Get the filename and initialize L10nMonster
const targetFile = process.env.LLM_LAB_FILE ?? 'llm-lab.config.json';
console.log(`Working with config file: ${targetFile}`);
await initializeL10nMonster(targetFile);

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(import.meta.dirname, 'public')));

// --- API Routes ---
app.use('/api', apiRoutes); // Mount API routes

// --- OAuth Callback Route ---
app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        res.status(400).send('Authorization code missing.');
        return;
    }
    const result = await googleAuth.handleCallback(code);
    if (result.success) {
        res.redirect('/'); // Redirect home on success
    } else {
        res.status(500).send(`OAuth Callback Error: ${result.message}`);
    }
});

// --- Optional Logout Route ---
app.post('/logout', async (req, res) => {
     console.log("POST /logout received");
     try {
         const revoked = await googleAuth.revokeToken();
         if (revoked) {
             res.status(200).json({ status: 'success', message: 'Logout successful, token revoked.' });
         } else {
             res.status(500).json({ status: 'error', message: 'Failed to revoke token.' });
         }
     } catch(err) {
         console.error("Error during /logout:", err);
         res.status(500).json({ status: 'error', message: 'Internal server error during logout.' });
     }
});

// --- Start Server ---
// Using top-level await is fine in ESM modules
try {
    console.log("Attempting initial Google API authorization...");
    await googleAuth.authorize();
    console.log("Authorization check complete (may require user action).");

    const server = app.listen(port, async () => {
        const url = `http://localhost:${port}`;
        console.log(`--------------------------------------------------`);
        console.log(`LLM Lab server listening at ${url}`);
        console.log(`Access the UI at ${url}`);
        console.log(`API endpoints are mounted under /api`);
        console.log('Ensure credentials.json is present and gitignored.');
        console.log('Ensure token.json is gitignored.');
        console.log(`--------------------------------------------------`);
        
        try {
            console.log('Opening browser...');
            await open(url);
        } catch (browserError) {
            console.warn('Could not automatically open browser:', browserError.message);
            console.log(`Please manually open: ${url}`);
        }
    });
} catch (error) {
     console.error("Error during server startup:", error.message);
     console.error("Server startup failed.");
     console.error("Ensure you have logged in to GCP with 'gcloud auth login'");
     process.exit(1);
}
