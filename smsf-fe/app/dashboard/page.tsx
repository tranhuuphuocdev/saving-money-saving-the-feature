import { Suspense } from 'react';
import { DashboardShell } from '@/features/dashboard/components/dashboard-shell';

export default function DashboardPage() {
    return (
        <Suspense fallback={null}>
            <DashboardShell />
        </Suspense>
    );
}
