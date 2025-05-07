import { config } from '@l10nmonster/core';
import { GPTAgent } from '@l10nmonster/helpers-openai';
import { GCTProvider } from '@l10nmonster/helpers-googlecloud';
import { MMTProvider, LaraProvider } from '@l10nmonster/helpers-translated';

export const providers = [
    new LaraProvider({
        id: 'Lara',
        keyId: process.env.lara_key_id,
        keySecret: process.env.lara_key_secret,
        quality: 40,
        costPerMChar: 17,
        saveIdenticalEntries: true,
    }),
    new MMTProvider({
        id: 'MMT-Vanilla',
        apiKey: process.env.mmt_api_key,
        quality: 40,
        costPerMChar: 15,
        saveIdenticalEntries: true,
    }),
    new GPTAgent({
        id: 'Gemini-25',
        quality: 40,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey: process.env.gemini_api_key,
        model: 'gemini-2.5-pro-exp-05-06',
        saveIdenticalEntries: true,
    }),
    new GCTProvider({
        id: 'GCT-NMT',
        model: 'nmt',
        quality: 40,
        location: 'us-central1',
        saveIdenticalEntries: true,
    })
];

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
