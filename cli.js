#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

function showUsage() {
    console.log(`
Usage: npx @l10nmonster/llm-lab [filename]

Arguments:
  [filename]    Optional path to the config file

Examples:
  npx @l10nmonster/llm-lab
  npx @l10nmonster/llm-lab providers.json
`);
}

function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        showUsage();
        process.exit(0);
    }
    
    const filename = args[0];
    
    // Only validate file existence if a filename was provided
    if (filename && !fs.existsSync(filename)) {
        console.error(`Error: File '${filename}' does not exist`);
        process.exit(1);
    }
    
    if (filename) {
        console.log(`Starting LLM Lab with file: ${filename}`);
    } else {
        console.log('Starting LLM Lab...');
    }
    
    // Start the server with the filename as an environment variable (only if provided)
    const serverPath = path.join(import.meta.dirname, 'server.js');
    const env = { ...process.env };
    
    if (filename) {
        env.LLM_LAB_FILE = path.resolve(filename);
    }
    
    const serverProcess = spawn('node', [serverPath], {
        stdio: 'inherit',
        env
    });
    
    serverProcess.on('close', (code) => {
        console.log(`Server process exited with code ${code}`);
        process.exit(code);
    });
    
    serverProcess.on('error', (error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down...');
        serverProcess.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
        console.log('\nShutting down...');
        serverProcess.kill('SIGTERM');
    });
}

main(); 