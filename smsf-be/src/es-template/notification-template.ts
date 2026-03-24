import { TIME_FRAME_FORMAT } from '../util';
import { initEs } from '../util/init-es';

const notificationMappings = {
    log: {
        dynamic: 'strict',
        properties: {
            notiId: { type: 'keyword' },
            uId: { type: 'keyword' },
            cateId: { type: 'keyword' },
            cateName: {
                type: 'text',
                fields: { keyword: { type: 'keyword', ignore_above: 256 } },
            },
            amount: { type: 'scaled_float', scaling_factor: 100 },
            desc: {
                type: 'text',
                fields: { keyword: { type: 'keyword', ignore_above: 256 } },
            },
            teleChatId: { type: 'keyword' },
            dueDay: { type: 'byte' },
            activeMonths: { type: 'short' },
            nextDueAt: { type: 'date' },
            paymentStatus: { type: 'keyword' },
            paidMonth: { type: 'byte' },
            paidYear: { type: 'short' },
            currentMonth: { type: 'byte' },
            currentYear: { type: 'short' },
            lastPaymentTxnId: { type: 'keyword' },
            lastReminderPeriod: { type: 'integer' },
            lastReminderAt: { type: 'date' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            isDeleted: { type: 'boolean' },
        },
    },
};

export default async function runInitNotificationES(isUpdateCurrentIndex = true) {
    await initEs(
        'notification-template',
        'notification',
        'notification-alias',
        notificationMappings,
        '1s',
        isUpdateCurrentIndex,
        TIME_FRAME_FORMAT.NONE,
    );
}
