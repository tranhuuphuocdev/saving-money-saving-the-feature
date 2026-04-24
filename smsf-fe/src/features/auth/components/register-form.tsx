'use client';

import Link from 'next/link';
import { ArrowRight, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppCard } from '@/components/common/app-card';
import { PrimaryButton } from '@/components/common/primary-button';
import { useAuth } from '@/providers/auth-provider';

export function RegisterForm() {
    const router = useRouter();
    const { register, isAuthenticated, isLoading } = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    // Removed telegramChatId state
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            router.replace('/dashboard');
        }
    }, [isAuthenticated, isLoading, router]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        setSubmitting(true);

        try {
                if (password !== confirmPassword) {
                    setError('Mật khẩu xác nhận không khớp.');
                    setSubmitting(false);
                    return;
                }
            await register(username.trim(), password);
            router.replace('/dashboard');
        } catch (submitError) {
            const message =
                (submitError as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Đăng ký thất bại. Vui lòng thử lại.';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            className="tech-grid"
            style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '20px 14px', position: 'relative', overflow: 'hidden' }}
        >
            <AppCard strong style={{ position: 'relative', width: '100%', maxWidth: 460, padding: 22, overflow: 'hidden' }}>
                <div style={{ marginBottom: 16 }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '7px 13px',
                            borderRadius: 999,
                            background: 'var(--chip-bg)',
                            border: '1px solid var(--chip-border)',
                            color: 'var(--accent-text)',
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                    >
                        SMSF / Register
                    </div>
                    <h1 style={{ margin: '12px 0 8px', fontSize: 26, lineHeight: 1.15 }}>Tạo tài khoản mới</h1>
                    {/* <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6, fontSize: 14 }}>
                        Sau khi đăng ký, bạn sẽ cần nhập số tiền khởi tạo cho 3 ví mặc định: Tiền mặt, Ngân hàng, Momo.
                    </p> */}
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
                    <label style={{ display: 'grid', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--foreground)' }}>Tên đăng nhập</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 16, padding: '13px 14px', background: 'var(--surface-soft)', border: '1px solid var(--theme-icon-border)' }}>
                            <UserRound size={17} color="var(--accent)" />
                            <input
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                placeholder="Nhập username"
                                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--foreground)', fontSize: 14 }}
                            />
                        </div>
                    </label>

                    <label style={{ display: 'grid', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--foreground)' }}>Mật khẩu</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 16, padding: '13px 14px', background: 'var(--surface-soft)', border: '1px solid var(--theme-icon-border)' }}>
                            <LockKeyhole size={17} color="var(--accent)" />
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Tối thiểu 6 ký tự"
                                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--foreground)', fontSize: 14 }}
                            />
                        </div>
                    </label>

                    <label style={{ display: 'grid', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--foreground)' }}>Xác nhận mật khẩu</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 16, padding: '13px 14px', background: 'var(--surface-soft)', border: '1px solid var(--theme-icon-border)' }}>
                            <LockKeyhole size={17} color="var(--accent)" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                placeholder="Nhập lại mật khẩu"
                                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--foreground)', fontSize: 14 }}
                            />
                        </div>
                    </label>


                    {error ? (
                        <div style={{ borderRadius: 14, padding: '11px 13px', background: 'rgba(239, 68, 68, 0.12)', color: '#fecaca', border: '1px solid rgba(248,113,113,0.2)', fontSize: 13 }}>
                            {error}
                        </div>
                    ) : null}

                    <PrimaryButton type="submit" disabled={submitting} style={{ marginTop: 4, opacity: submitting ? 0.82 : 1, transform: submitting ? 'scale(0.99)' : 'scale(1)' }}>
                        {submitting ? <LoaderCircle size={18} className="spin" /> : <ArrowRight size={18} />}
                        {submitting ? 'Đang tạo tài khoản...' : 'Đăng ký'}
                    </PrimaryButton>

                    <Link
                        href="/login"
                        style={{
                            marginTop: 6,
                            textAlign: 'center',
                            color: 'var(--accent-text)',
                            fontSize: 13,
                            textDecoration: 'none',
                            fontWeight: 700,
                        }}
                    >
                        Đã có tài khoản? Quay lại đăng nhập
                    </Link>
                </form>
            </AppCard>
        </div>
    );
}
