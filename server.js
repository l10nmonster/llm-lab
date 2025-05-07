// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
// Use default import for the router and .js extension
import apiRoutes from './routes/apiRoutes.js';
// Use named imports and .js extension
import * as googleAuth from './services/googleAuth.js';

// --- Replicate __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// --- Middleware ---
app.use(express.json());
// Use the ESM-compatible __dirname
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---
app.use('/api', apiRoutes); // Mount API routes

// --- OAuth Callback Route ---
app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('Authorization code missing.');
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

    app.listen(port, () => {
        console.log(`--------------------------------------------------`);
        console.log(`LLM Lab server listening at http://localhost:${port}`);
        console.log(`Access the UI at http://localhost:${port}`);
        console.log(`API endpoints are mounted under /api`);
        console.log('Ensure credentials.json is present and gitignored.');
        console.log('Ensure token.json is gitignored.');
        console.log(`--------------------------------------------------`);
    });
} catch (error) {
     console.error("Error during server startup:", error.message);
     console.error("Server startup failed.");
     process.exit(1);
}
