import axios from 'axios';
import config from '../config';
const myArgs = process.argv.slice(2);

const indexTemplateFilterList = myArgs && myArgs.length > 0 ? myArgs[0].split(',') : ['all'];

export async function initEs(
    templateName,
    indexTemplatePattern,
    searchAlias,
    mappings: any = { properties: {} },
    refreshInterval = '1s',
    updateMappingCurrentIndex = false,
    timeFormat,
) {
    if (indexTemplateFilterList && !indexTemplateFilterList.includes(templateName) && indexTemplateFilterList[0] !== 'all') {
        return;
    }
    templateName = config.ES_NAME_PREFIX + templateName;
    indexTemplatePattern = config.ES_NAME_PREFIX + indexTemplatePattern;
    searchAlias = config.ES_NAME_PREFIX + searchAlias;

    const normalizedMappings = mappings?.log ? mappings.log : mappings;

    try {
        console.log('=========================');
        console.log('Update template:', templateName);
        const createTemplateResponse = await axios({
            url: `${config.ES_URL}/_template/${templateName}`,
            method: 'put',
            data: {
                index_patterns: indexTemplatePattern,
                settings: {
                    number_of_shards: 5,
                    number_of_replicas: 0,
                    refresh_interval: refreshInterval,
                },
                aliases: {
                    [searchAlias]: {},
                },
                mappings: normalizedMappings,
            },
        });

        console.log('Update template:', templateName, '=>', createTemplateResponse.data.acknowledged);
        if (!createTemplateResponse?.data?.acknowledged) {
            console.log(`Create template ${templateName} >>>>>>> FAIL <<<<<<<<<<`);
        }

        if (updateMappingCurrentIndex) {
            let currentIndexName = indexTemplatePattern.replace('*', '');
            try {
                currentIndexName = currentIndexName.endsWith('-')
                    ? currentIndexName.slice(0, -1)
                    : currentIndexName;

                console.log('Update current index:', currentIndexName);
                const updateCurrentIndexResponse = await axios({
                    url: `${config.ES_URL}/${currentIndexName}/_mapping`,
                    method: 'put',
                    data: normalizedMappings,
                });

                console.log('Update current index:', currentIndexName, '=>', updateCurrentIndexResponse.data.acknowledged);
            } catch (err) {
                if (err.response?.data?.error?.type === 'index_not_found_exception') {
                    // error acceptable.
                    console.log('Update current index:', currentIndexName, ' not found.');
                } else {
                    throw err;
                }
            }
        }
    } catch (err) {
        console.error('initEs -> error: %s %s', err, JSON.stringify(err?.response?.data));
    }
}
