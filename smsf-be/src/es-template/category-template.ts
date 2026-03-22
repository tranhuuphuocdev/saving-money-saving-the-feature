import { TIME_FRAME_FORMAT } from '../util';
import { initEs } from '../util/init-es';

const categoryMappings = {
    log: {
        dynamic: 'strict',
        properties: {
            cateId: { type: 'keyword' },
            uId: { type: 'keyword' },
            cateName: {
                type: 'text',
                fields: { keyword: { type: 'keyword', ignore_above: 256 } },
            },
            cateType: { type: 'keyword' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            isDefault: { type: 'boolean' },
            isDeleted: { type: 'boolean' },
        },
    },
};

export default async function runInitCategoryES(isUpdateCurrentIndex = true) {
    await initEs(
        'category-template',
        'category-*',
        'category',
        categoryMappings,
        '1s',
        isUpdateCurrentIndex,
        TIME_FRAME_FORMAT.MONTH
    );
}