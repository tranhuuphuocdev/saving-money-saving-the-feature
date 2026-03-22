import { TIME_FRAME_FORMAT } from '../util';
import { initEs } from '../util/init-es';

const walletMappings = {
    log: {
        dynamic: 'strict',
        properties: {
            wId: { type: 'keyword' },
            uId: { type: 'keyword' },
            wName: {
                type: 'text',
                fields: { keyword: { type: 'keyword', ignore_above: 256 } },
            },
            wType: { type: 'keyword' },
            amount: { type: 'scaled_float', scaling_factor: 100 },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
        },
    },
};

export default async function runInitWalletES(isUpdateCurrentIndex = true) {
    await initEs(
        'wallet-template',
        'wallet-*',
        'wallet',
        walletMappings,
        '1s',
        isUpdateCurrentIndex,
        TIME_FRAME_FORMAT.MONTH
    );
}