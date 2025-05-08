# LLM Lab 🧪

LLM Lab is a simple Express.js web application designed to help you experiment with LLM-based translators by using Google Sheets as a data source. You can configure a test by specifying source and notes columns in a sheet, define instructions for each of the chosen providers, and then kick-off the translation process, after with the results will be written back to a new sheet in the same Google Spreadsheet.

## Features

*   **Web-based UI:** A simple one-page HTML app to configure and run tests.
*   **Google Sheets Integration:**
    *   Reads data from specified columns in a Google Sheet.
    *   Supports auto-detection of the last contiguous row in the source column if no end row is specified.
    *   Writes processed results to a new sheet in the same spreadsheet.
    *   Automatically formats the output sheet (freezes header, resizes columns, bolds header).
*   **Dynamic "Translator" Configuration:**
    *   Add multiple "translator" sections, each representing an LLM provider or a specific set of instructions.
    *   Fetch a list of available (mock) LLM providers from a backend API.
*   **API Endpoints:**
    *   `GET /api/providers`: Lists available LLM provider IDs.
    *   `POST /api/project`: Receives the test configuration, processes data (currently mocked), and interacts with Google Sheets.
*   **Google OAuth 2.0 Authentication:** Securely authenticates with Google APIs to access your spreadsheets.
*   **Modular Codebase:** Backend logic is split into services, routes, and utilities for better organization (using ES Modules).

## Tech Stack

*   **Backend:** Node.js, Express.js
*   **Google API:** `googleapis` Node.js client library
*   **Frontend:** Plain HTML, CSS, and JavaScript (no frameworks/libraries beyond Express serving static files)

## Prerequisites

*   **Node.js and npm:** Download and install from [nodejs.org](https://nodejs.org/). (LTS version recommended)
*   **Google Account:** To access Google Sheets and Google Cloud Platform.
*   **Google Cloud Platform (GCP) Project:** You'll need a GCP project to enable the Google Sheets API and create OAuth 2.0 credentials.

## Installation

1.  **Clone the repositories:**
    ```bash
    git clone https://github.com/l10nmonster/llm-lab.git
    cd llm-lab
    git clone https://github.com/l10nmonster/l10nmonster.git  --branch v3
    ```

2.  **Install dependencies:**
    Navigate to the project root (`llm-lab`) in your terminal and run:
    ```bash
    cd l10nmonster
    npm i
    cd ..
    npm i
    ```
    This will install all dependencies.

3.  **Set up Google Cloud Credentials (OAuth 2.0):**
    This is the most crucial step for the application to interact with your Google Sheets.

    *   **a. Go to Google Cloud Console:**
        Visit [https://console.cloud.google.com/](https://console.cloud.google.com/).

    *   **b. Select or Create a Project:**
        Choose an existing project or create a new one.

    *   **c. Enable the Google Sheets API:**
        1.  In the navigation menu (☰) or search bar, go to "APIs & Services" > "Library".
        2.  Search for "Google Sheets API" and click on it.
        3.  Click the "Enable" button.

    *   **d. Configure the OAuth Consent Screen:** (if needed)
        1.  Go to "APIs & Services" > "OAuth consent screen".
        2.  **User Type:** Choose "External" (unless you have a Google Workspace account and this is for internal use only). Click "CREATE".
        3.  **App information:**
            *   **App name:** Enter a name, e.g., "LLM Lab".
            *   **User support email:** Select your email address.
            *   **Developer contact information:** Enter your email address.
            *   Click "SAVE AND CONTINUE".
        4.  **Scopes:** Click "ADD OR REMOVE SCOPES". Search for "Google Sheets API" and select the scope `.../auth/spreadsheets` (this allows read and write access). Click "UPDATE", then "SAVE AND CONTINUE".
        5.  **Test users:**
            *   **IMPORTANT:** While your app's "Publishing status" is "Testing" (which it is by default), only explicitly added test users can authorize the app.
            *   Click "+ ADD USERS".
            *   Enter the Google email address(es) of the account(s) you will use to authorize this application when you run it locally. This is typically your own Google account.
            *   Click "ADD", then "SAVE AND CONTINUE".
        6.  **Summary:** Review and click "BACK TO DASHBOARD". Your app is now in "Testing" mode.

    *   **e. Create OAuth 2.0 Client ID:**
        1.  Go to "APIs & Services" > "Credentials".
        2.  Click "+ CREATE CREDENTIALS" > "OAuth client ID".
        3.  **Application type:** Select "Web application".
        4.  **Name:** Give it a name, e.g., "LLM Lab Web Client".
        5.  **Authorized redirect URIs:** This is very important.
            *   Click "+ ADD URI".
            *   Enter: `http://localhost:3000/oauth2callback`
            *   *(The port `3000` must match the port your LLM Lab server runs on. The path `/oauth2callback` must match the callback route defined in `server.js`.)*
        6.  Click "CREATE".

    *   **f. Get Client ID and Client Secret:**
        A pop-up will appear showing your "Client ID" and "Client Secret".
        1.  Click the "DOWNLOAD JSON" button. This will download a file (e.g., `client_secret_xxxxxxxx.json`).
        2.  **Rename this downloaded file to `credentials.json`**.
        3.  **Place `credentials.json` in the root directory of your `llm-lab` project** (alongside `server.js`, `package.json`, etc.).
        4.  **VERY IMPORTANT:** Treat `credentials.json` (especially the client secret) like a password. **Do NOT commit it to version control.** Add it to your `.gitignore` file:
            ```gitignore
            # .gitignore
            node_modules/
            credentials.json
            token.json
            ```

4.  **List your providers:**
    *   Create a file called `providers.json` including your api keys following this example:

    ```json
    {
        "Lara": {
            "provider": "LaraProvider",
            "keyId": "x",
            "keySecret": "y",
            "quality": 40,
            "costPerMChar": 17
        },
        "MMT": {
            "provider": "MMTProvider",
            "apiKey": "x",
            "quality": 40,
            "costPerMChar": 15
        },
        "Gemini2.5Pro": {
            "provider": "GPTAgent",
            "quality": 40,
            "baseURL": "https://generativelanguage.googleapis.com/v1beta/openai/",
            "apiKey": "x",
            "model": "gemini-2.5-pro-preview-05-06"
        },
        "GCT-NMT": {
            "provider": "GCTProvider",
            "model": "nmt",
            "quality": 40,
            "location": "us-central1"
        }
    }
    ```

    *   The file is in the `.gitignore` so it will not be checked in in git.

5.  **Prepare your Google Sheet:**
    *   Create a new Google Sheet or use an existing one.
    *   Ensure the Google account you added as a "Test User" (and will use to authorize the app) has at least **Edit** access to this spreadsheet.

## Running the Application

1.  **Start the server:**
    Open your terminal, and make sure you have the necessary api keys exported for the providers you'll use. Then navigate to the `llm-lab` project root, and run:
    ```bash
    node server.js
    ```

2.  **First-time Authorization:**
    *   When the server starts for the first time (or if `token.json` is missing/invalid), it will detect that it's not authorized.
    *   It will print an **AUTHORIZATION REQUIRED** message in the console, followed by a URL.
    *   **Copy this URL** and paste it into your web browser.
    *   Log in with the Google account you added as a "Test User" in the GCP setup.
    *   Google will ask you to grant "LLM Lab" (or whatever you named your app) permission to access your Google Sheets. Click "Allow" (you might see a warning screen because the app is unverified - this is expected for apps in "Testing" mode; click "Advanced" and "Go to LLM Lab (unsafe)" if prompted).
    *   After successful authorization, Google will redirect your browser to `http://localhost:3000/oauth2callback`.
    *   The server will capture the authorization code, exchange it for tokens, and save these tokens in a new file named `token.json` in your project root.
    *   Your browser should show a success message or redirect to the main page. The server console will also log success.

3.  **Access the LLM Lab UI:**
    Open your web browser and go to:
    ```
    http://localhost:3000
    ```

4.  **Subsequent Runs:**
    On subsequent runs, the server will read the stored `token.json` and automatically refresh the access token if needed. You won't need to go through the browser authorization flow again unless `token.json` is deleted or the refresh token is revoked/expires.

## Usage

1.  **Configuration Section:**
    *   **Google Sheet URL:** Paste the full URL of the Google Sheet you want to work with (e.g., `https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit#gid=YOUR_SHEET_GID`). The app will parse the Spreadsheet ID and the Sheet GID (the number after `#gid=`) from this URL.
    *   **Test Name:** This name will be used as the title for the *new sheet* where results are written. Defaults to `Test1`.
    *   **Source Language:** The language of the source text (e.g., "en-US").
    *   **Target Language:** The desired language for translation (e.g., "es-ES").
    *   **Source Column:** The column letter in your source sheet containing the text to process (e.g., `A`). Defaults to `A`.
    *   **Notes Column:** (Optional) The column letter containing any notes associated with the source text (e.g., `B`). Defaults to `B`.
    *   **Start Row:** The row number to start reading data from (1-based index). Defaults to `2`.
    *   **End Row:** (Optional) The row number to stop reading data. If left blank, the server will attempt to auto-detect the last contiguous row with data in the "Source Column" starting from "Start Row".

2.  **Translators Section:**
    *   **Provider Dropdown:** Select an LLM provider from the list (fetched from `/api/providers`).
    *   **Instructions Textbox:** Enter specific instructions for this provider.
    *   **`+` Button:** Adds a new translator section.
    *   **`-` Button:** Removes the current translator section.

3.  **GO! Button:**
    *   Clicking "GO!" submits all the configured data to the `/api/project` backend endpoint.
    *   An animation will show while the backend processes the request.
    *   A status message (success or error) will be displayed. If successful, a link to the newly created results sheet will appear.

## Troubleshooting

*   **Error 403: access_denied / "LLM Lab has not completed the Google verification process..."**:
    This usually means the Google account you're trying to authorize with is not listed as a "Test user" in your GCP project's OAuth Consent Screen settings (while the app is in "Testing" mode). Add the email and try the authorization flow again (delete `token.json` first).
*   **`token.json` issues / "invalid_grant"**:
    If `token.json` becomes invalid (e.g., token revoked, expired due to long inactivity in testing mode), delete `token.json` and restart the server. It will prompt you to re-authorize.
*   **`credentials.json` not found**: Ensure you've downloaded it, renamed it correctly, and placed it in the project root.
*   **Redirect URI Mismatch**: Ensure the "Authorized redirect URI" in your GCP OAuth Client ID settings exactly matches `http://localhost:3000/oauth2callback`.
