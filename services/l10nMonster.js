import * as path from 'path';
import { readFileSync } from 'fs';
import { config, stores } from '@l10nmonster/core';
import { AnthropicAgent } from '@l10nmonster/helpers-anthropic';
import { GPTAgent } from '@l10nmonster/helpers-openai';
import { GCTProvider, GenAIAgent } from '@l10nmonster/helpers-googlecloud';
import { MMTProvider, LaraProvider } from '@l10nmonster/helpers-translated';
import { DeepLProvider } from '@l10nmonster/helpers-deepl';

let l10nmonsterConfig;

const providerFactories = {
    LaraProvider,
    MMTProvider,
    GPTAgent,
    GCTProvider,
    DeepLProvider,
    GenAIAgent,
    AnthropicAgent,
};

export const providers = [];

export async function initializeL10nMonster(configFile) {
    try {
        const providersConfig = JSON.parse(readFileSync(configFile, 'utf-8'));
        for (const [ id, providerConfig ] of Object.entries(providersConfig)) {
            const { provider, ...config } = providerConfig;
            const instance = new providerFactories[provider]({ ...config, saveIdenticalEntries: true, id });
            const info = await instance.info();
            console.log(`\nLoaded ${info.type} with id ${info.id}`);
            info.description.forEach(line => console.log(`  ${line}`));
            providers.push(instance);
        }
        l10nmonsterConfig = config.l10nMonster('.')
        .provider(providers)
        .operations({
            opsStore: new stores.FsOpsStore('l10nOps'),
        });
    } catch(e) {
        console.log(e);
        process.exit(1);
    }
}

export async function translate(translators, { sourceDataPairs, sourceLang, targetLang }) {
    return await l10nmonsterConfig.verbose(3).run(async mm => {
        const translations = [];
        for (const translator of translators) {

        const assignedJobs = await mm.dispatcher.createJobs({
            sourceLang,
            targetLang, 
            tus: sourceDataPairs.map(({ source, notes }, idx) => ({
                channel: 'LLMLab',
                rid: 'sheet',
                sid: `row-${idx + 1}`,
                guid: `row-${idx + 1}`,
                nsrc: [ source ],
                notes: { desc: notes },
                mf: 'text',
                minQ: 1,
            })),
            providerList: [ translator.provider ],
        });
        if (assignedJobs.length !== 1 || assignedJobs[0].translationProvider !== translator.provider) {
            console.error(`${translator.provider} provider didn't take the job!`);
            return;
        }
        const [jobStatus] = await mm.dispatcher.startJobs(assignedJobs, { instructions: translator.instructions });
        const job = await mm.tmm.getJob(jobStatus.jobGuid);
        console.log(`${job.sourceLang} → ${job.targetLang} job ${job.jobGuid} performed by ${job.translationProvider} with status ${job.status}.`);
        translations.push(job.tus.map(({ ntgt }) => ntgt[0]));
        }
        return translations;
    });
}
