import { randomUUID } from 'node:crypto';
import axios from 'axios';
import config from '../config';
import { TIME_FRAME_FORMAT, buildIndexName } from '../util';

interface ISeedWallet {
    wId: string;
    uId: string;
    wName: string;
    wType: string;
    amount: number;
    createdAt: number;
    updatedAt: number;
}

async function createWallets(): Promise<void> {
    const now = Date.now();
    const userId = process.env.SEED_USER_ID || '6629d893-5736-41d1-ac1d-8b625159d01b';
    const indexName = buildIndexName('wallet-', now, TIME_FRAME_FORMAT.MONTH);

    const wallets: ISeedWallet[] = [
        {
            wId: randomUUID(),
            uId: userId,
            wName: 'Momo',
            wType: 'momo',
            amount: 500000,
            createdAt: now,
            updatedAt: now,
        },
        {
            wId: randomUUID(),
            uId: userId,
            wName: 'Vietcombank',
            wType: 'bank',
            amount: 2000000,
            createdAt: now,
            updatedAt: now,
        },
        {
            wId: randomUUID(),
            uId: userId,
            wName: 'Tiền mặt',
            wType: 'cash',
            amount: 5000000,
            createdAt: now,
            updatedAt: now,
        },
        {
            wId: randomUUID(),
            uId: userId,
            wName: 'ZaloPay',
            wType: 'zalopay',
            amount: 800000,
            createdAt: now,
            updatedAt: now,
        },
    ];

    const operations = wallets.flatMap((wallet) => [
        {
            index: {
                _index: indexName,
                _id: wallet.wId,
            },
        },
        wallet,
    ]);

    const response = await axios({
        url: `${config.ES_URL}/_bulk?refresh=true`,
        method: 'post',
        data: operations.map((item) => JSON.stringify(item)).join('\n') + '\n',
        headers: {
            'Content-Type': 'application/x-ndjson',
        },
    });

    if (response.data?.errors) {
        console.error('Create wallets encountered ES bulk errors:', response.data.items);
        process.exit(1);
    }

    console.log('Create wallets success');
    console.table(
        wallets.map((wallet) => ({
            index: indexName,
            wId: wallet.wId,
            uId: wallet.uId,
            wName: wallet.wName,
            wType: wallet.wType,
            amount: wallet.amount,
        })),
    );
}

createWallets().catch((error) => {
    console.error('Create wallets script error:', error.response?.data || error.message);
    process.exit(1);
});