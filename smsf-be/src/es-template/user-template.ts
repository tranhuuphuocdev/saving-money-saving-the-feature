import { TIME_FRAME_FORMAT } from '../util';
import { initEs } from '../util/init-es';

const userMappings = {
    log: {
        dynamic: 'strict',
        properties: {
            uId: { type: 'keyword' },
            dn: {
                type: 'text',
                fields: { keyword: { type: 'keyword', ignore_above: 256 } },
            },
            username: { type: 'keyword' },
            teleChatId: { type: 'keyword' },
            password: { type: 'keyword', index: false },
            role: { type: 'keyword' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            isDeleted: { type: 'boolean' },
        },
    },
};

export default async function runInitUserES(isUpdateCurrentIndex = true) {
    await initEs(
        'user-template',
        'user-*',
        'user',
        userMappings,
        '1s',
        isUpdateCurrentIndex,
        TIME_FRAME_FORMAT.MONTH
    );
}