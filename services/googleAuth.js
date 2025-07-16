// services/googleAuth.js
import fs from 'fs/promises'; // Use direct import
import path from 'path';       // Use direct import
import { google } from 'googleapis'; // Use direct import

// --- Configuration ---
const CREDENTIALS_PATH = path.join(import.meta.dirname, '..', 'credentials.json');
const TOKEN_PATH = path.join(import.meta.dirname, '..', 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let oauth2Client = null;

async function loadCredentials() {
    try {
        const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
        const credentials = JSON.parse(content).web;
        if (!credentials || !credentials.client_id || !credentials.client_secret || !credentials.redirect_uris || !credentials.redirect_uris[0]) {
            throw new Error("Credentials file is missing required fields.");
        }
        return credentials;
    } catch (err) {
        console.error('Error loading client secret file:', err.message);
        throw new Error(`Failed to load credentials from ${CREDENTIALS_PATH}. Ensure it exists and is valid.`);
    }
}

/**
 * Create an OAuth2 client.
 */
async function createOAuthClient() {
    const credentials = await loadCredentials();
    return new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        credentials.redirect_uris[0]
    );
}

/**
 * Load existing token or trigger authorization flow.
 */
async function authorize() {
    if (oauth2Client) {
        console.log("Using existing authorized client.");
        return true;
    }

    const tempClient = await createOAuthClient();

    try {
        const tokenContent = await fs.readFile(TOKEN_PATH, 'utf-8');
        const token = JSON.parse(tokenContent);
        if (!token.refresh_token) {
             throw new Error("Stored token is missing refresh_token. Re-authorization required.");
        }
        tempClient.setCredentials(token);

        try {
            await tempClient.getAccessToken();
            console.log("Access token is valid or refreshed.");
            oauth2Client = tempClient;
            console.log('Successfully authorized using stored token.');
            return true;
         } catch(refreshError) {
             console.error("Failed to refresh access token.", refreshError.message);
             await fs.unlink(TOKEN_PATH).catch(e => console.warn("Couldn't delete invalid token file:", e.message));
             oauth2Client = null;
         }

    } catch (err) {
        console.log('Stored token not found or invalid:', err.message);
    }

    const authUrl = tempClient.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
    });
    console.error('--------------------------------------------------');
    console.error('AUTHORIZATION REQUIRED:');
    console.error(`1. Open this URL in your browser:\n   ${authUrl}`);
    console.error(`2. Grant permissions.`);
    console.error(`3. You will be redirected back to the /oauth2callback endpoint.`);
    console.error('--------------------------------------------------');
    oauth2Client = tempClient; // TEMPORARY for callback use
    return false;
}

/**
 * Handles the OAuth 2.0 callback.
 */
async function handleCallback(code) {
     const client = oauth2Client || await createOAuthClient();
     if (!client) {
         return { success: false, message: "OAuth client not available for callback." };
     }

    try {
        console.log(`Received authorization code: ${code.substring(0, 20)}...`);
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);
        oauth2Client = client;

        await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
        console.log('Token stored to', TOKEN_PATH);
        console.log('Authorization successful! Sheets API client ready.');
        return { success: true, message: 'Authorization successful!' };

    } catch (err) {
        console.error('Error retrieving or storing access token:', err.message);
         if (err.response && err.response.data) {
              console.error('Google API Error:', err.response.data);
         }
        oauth2Client = null;
        return { success: false, message: 'Failed to retrieve or store access token. Check server logs.' };
    }
}

/**
 * Returns the authorized OAuth2 client.
 */
function getAuthorizedClient() {
    if (!oauth2Client || !oauth2Client.credentials || !oauth2Client.credentials.access_token) {
        throw new Error("Google API client is not authorized. Complete the OAuth flow.");
    }
    return oauth2Client;
}

/**
 * Revokes the current user's token.
 */
async function revokeToken() {
     if (!oauth2Client || !oauth2Client.credentials.refresh_token) {
        console.log("No valid client or refresh token available to revoke.");
        try { await fs.unlink(TOKEN_PATH); console.log("Deleted potentially invalid token file."); } catch {}
        return true;
    }

    const tokenToRevoke = oauth2Client.credentials.refresh_token;
    const clientForRevoke = await createOAuthClient();

    try {
        console.log(`Attempting to revoke refresh token: ${tokenToRevoke.substring(0, 10)}...`);
        await clientForRevoke.revokeToken(tokenToRevoke);
        console.log('Token revoked successfully via Google.');
    } catch (err) {
        console.error('Error revoking token:', err.message);
        if (err.response && err.response.data && err.response.data.error === 'invalid_token') {
            console.log("Token was already invalid or expired.");
        } else {
            return false; // Don't delete local file if revocation failed otherwise
        }
    } finally {
        try {
            await fs.unlink(TOKEN_PATH);
            console.log(`Local token file '${TOKEN_PATH}' deleted.`);
        } catch (unlinkErr) {
            console.warn("Could not delete token file after revocation attempt:", unlinkErr.message);
        }
        oauth2Client = null;
    }
    return true;
}

// Use named exports
export {
    authorize,
    handleCallback,
    getAuthorizedClient,
    revokeToken,
};
