import { Suspense } from 'react';
import { ProfileShell } from '@/features/profile/components/profile-shell';

export default function ProfilePage() {
    return (
        <Suspense fallback={null}>
            <ProfileShell />
        </Suspense>
    );
}
