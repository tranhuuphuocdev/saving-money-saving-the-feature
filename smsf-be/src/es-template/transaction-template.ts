import { TIME_FRAME_FORMAT } from '../util';
import { initEs } from '../util/init-es';

const transactionMappings = {
    log: {
        dynamic: 'strict',
        properties: {
            txnId: { type: 'keyword' },
            uId: { type: 'keyword' },
            uName: { enabled: false },
            wId: { type: 'keyword' },
            cateId: { type: 'keyword' },
            cateName: { enabled: false },
            bId: { type: 'keyword' },
            bName: { enabled: false },
            txnType: { type: 'keyword' },
            amount: { type: 'scaled_float', scaling_factor: 100 },
            note: {
                type: 'text',
                fields: { keyword: { type: 'keyword', ignore_above: 256 } },
            },
            txnAt: { type: 'date' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            isDeleted: { type: 'boolean' },
        },
    },
};

export default async function runInitTransactionES(isUpdateCurrentIndex = true) {
    await initEs(
        'transaction-template',
        'transaction',
        'transaction-alias',
        transactionMappings,
        '1s',
        isUpdateCurrentIndex,
        TIME_FRAME_FORMAT.NONE
    );
}