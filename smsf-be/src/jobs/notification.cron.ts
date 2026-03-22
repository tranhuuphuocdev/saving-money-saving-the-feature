import { syncNotificationStatusesAndSendReminders } from "../services/notification.service";

const HOUR_TO_RUN = 7;
const MINUTE_TO_RUN = 0;
const TEST_INTERVAL_IN_MS = 30_000;
let notificationCronTimeout: NodeJS.Timeout | null = null;
let notificationTestInterval: NodeJS.Timeout | null = null;

const getDelayUntilNextRun = (): number => {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(HOUR_TO_RUN, MINUTE_TO_RUN, 0, 0);

    if (nextRun.getTime() <= now.getTime()) {
        nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun.getTime() - now.getTime();
};

const scheduleNextNotificationRun = (): void => {
    const delay = getDelayUntilNextRun();

    notificationCronTimeout = setTimeout(async () => {
        try {
            const result = await syncNotificationStatusesAndSendReminders();
            console.log(
                `[notification-cron] synced=${result.synced} reminded=${result.reminded}`,
            );
        } catch (error) {
            console.error("[notification-cron] execution failed:", (error as Error).message);
        } finally {
            scheduleNextNotificationRun();
        }
    }, delay);
};

const startNotificationCron = async (): Promise<void> => {
    try {
        const result = await syncNotificationStatusesAndSendReminders();
        console.log(`[notification-cron] initial synced=${result.synced} reminded=${result.reminded}`);
    } catch (error) {
        console.error("[notification-cron] initial sync failed:", (error as Error).message);
    }

    if (!notificationCronTimeout) {
        scheduleNextNotificationRun();
    }
};

const startNotificationTestCron = (): void => {
    if (notificationTestInterval) {
        return;
    }

    notificationTestInterval = setInterval(async () => {
        try {
            const result = await syncNotificationStatusesAndSendReminders();
            console.log(
                `[notification-cron-test] synced=${result.synced} reminded=${result.reminded}`,
            );
        } catch (error) {
            console.error("[notification-cron-test] execution failed:", (error as Error).message);
        }
    }, TEST_INTERVAL_IN_MS);
};

export { startNotificationCron, startNotificationTestCron };
