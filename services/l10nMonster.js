import * as path from 'path';
import { readFileSync } from 'fs';
import { config } from '@l10nmonster/core';
import { GPTAgent } from '@l10nmonster/helpers-openai';
import { GCTProvider } from '@l10nmonster/helpers-googlecloud';
import { MMTProvider, LaraProvider } from '@l10nmonster/helpers-translated';

const providerFactories = {
    LaraProvider,
    MMTProvider,
    GPTAgent,
    GCTProvider,
};

export const providers = [];
try {
    const providersConfigPath = path.join(import.meta.dirname, '..', 'providers.json');
    const providersConfig = JSON.parse(readFileSync(providersConfigPath, 'utf-8'));
    for (const [ id, providerConfig ] of Object.entries(providersConfig)) {
        const { provider, ...config } = providerConfig;
        providers.push(new providerFactories[provider]({ ...config, saveIdenticalEntries: true, id }));
    }
} catch(e) {
    console.log(e);
    process.exit(1);
}

const l10nmonsterConfig = config.l10nMonster(import.meta.dirname).provider(providers);

export async function translate(translators, { sourceDataPairs, sourceLang, targetLang }) {
    return await l10nmonsterConfig.run({ verbose: 3 }, async (l10n, mm) => {
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
