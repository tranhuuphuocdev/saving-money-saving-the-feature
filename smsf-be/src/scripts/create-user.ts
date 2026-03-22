import { createHash, randomUUID } from 'node:crypto';
import axios from 'axios';
import config from '../config';
import { ICreateUserPayload } from '../interfaces/create-user.interface';
import { TIME_FRAME_FORMAT, buildIndexName } from '../util';

type IWalletType = 'momo' | 'bank' | 'cash';

interface ICreateWalletPayload {
    wId: string;
    uId: string;
    wName: string;
    wType: IWalletType;
    amount: number;
    createdAt: number;
    updatedAt: number;
}

const DEFAULT_WALLETS: Array<{ type: IWalletType; name: string }> = [
    { type: 'momo', name: 'Ví Momo' },
    { type: 'bank', name: 'Ngân hàng' },
    { type: 'cash', name: 'Tiền mặt' },
];

function hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
}

async function createDefaultWalletsForUser(userId: string, timestamp: number): Promise<void> {
    const walletIndexName = buildIndexName('wallet-', timestamp, TIME_FRAME_FORMAT.MONTH);

    for (const wallet of DEFAULT_WALLETS) {
        const walletPayload: ICreateWalletPayload = {
            wId: randomUUID(),
            uId: userId,
            wName: wallet.name,
            wType: wallet.type,
            amount: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
        };

        await axios({
            url: `${config.ES_URL}/${walletIndexName}/_doc/${walletPayload.wId}`,
            method: 'put',
            data: walletPayload,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        console.log('Create wallet success', {
            index: walletIndexName,
            walletId: walletPayload.wId,
            walletType: walletPayload.wType,
            userId,
        });
    }
}

async function createUser(): Promise<void> {
    const now = Date.now();
    const rawPassword = process.env.USER_PASSWORD || '123456';

    const payload: ICreateUserPayload = {
        uId: process.env.USER_ID || randomUUID(),
        dn: process.env.USER_DN || 'dunglamtraitimanhdau',
        username: process.env.USER_USERNAME || 'rampo',
        password: hashPassword(rawPassword),
        role: process.env.USER_ROLE || 'admin',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
    };

    const indexName = buildIndexName('user-', Date.now(), TIME_FRAME_FORMAT.MONTH);
    const url = `${config.ES_URL}/${indexName}/_doc/${payload.uId}`;

    const response = await axios({
        url,
        method: 'put',
        data: payload,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const result = response.data;

    console.log('Create user success');
    console.log({
        index: indexName,
        id: payload.uId,
        username: payload.username,
        role: payload.role,
        result: result.result,
    });

    await createDefaultWalletsForUser(payload.uId, now);
}

createUser().catch((error) => {
    console.error('Create user script error:', error.message);
    process.exit(1);
});
