import { TIME_FRAME_FORMAT } from '../util';
import { initEs } from '../util/init-es';

const budgetMappings = {
    log: {
        dynamic: 'strict',
        properties: {
            bId: { type: 'keyword' },
            uId: { type: 'keyword' },
            cateId: { type: 'keyword' },
            budName: {
                type: 'text',
                fields: { keyword: { type: 'keyword', ignore_above: 256 } },
            },
            budAmount: { type: 'scaled_float', scaling_factor: 100 },
            desc: {
                type: 'text',
                fields: { keyword: { type: 'keyword', ignore_above: 256 } },
            },
            budType: { type: 'keyword' },
            periodMonth: { type: 'byte' },
            periodYear: { type: 'short' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
        },
    },
};

export default async function runInitBudgetES(isUpdateCurrentIndex = true) {
    await initEs(
        'budget-template',
        'budget',
        'budget-alias',
        budgetMappings,
        '1s',
        isUpdateCurrentIndex,
        TIME_FRAME_FORMAT.NONE
    );
}