'use client';

import { ArrowRight, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppCard } from '@/components/common/app-card';
import { PrimaryButton } from '@/components/common/primary-button';
import { useAuth } from '@/providers/auth-provider';

type IGoogleCredentialResponse = { credential?: string };

type IGoogleAccounts = {
    id: {
        initialize: (options: {
            client_id: string;
            callback: (response: IGoogleCredentialResponse) => void;
            ux_mode?: 'popup' | 'redirect';
        }) => void;
        renderButton: (
            parent: HTMLElement,
            options: {
                type?: 'standard' | 'icon';
                theme?: 'outline' | 'filled_blue' | 'filled_black';
                size?: 'large' | 'medium' | 'small';
                text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
                shape?: 'rectangular' | 'pill' | 'circle' | 'square';
                width?: number;
            },
        ) => void;
    };
};

type IGoogleWindow = Window & {
    google?: {
        accounts?: IGoogleAccounts;
    };
};

export function LoginForm() {
    const router = useRouter();
    const { login, loginWithGoogle, isAuthenticated, isLoading } = useAuth();
    const googleButtonRef = useRef<HTMLDivElement | null>(null);
    const [username, setUsername] = useState('rampo');
    const [password, setPassword] = useState('123123');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [googleSubmitting, setGoogleSubmitting] = useState(false);

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
            await login(username, password);
            router.replace('/dashboard');
        } catch {
            setError('Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu.');
        } finally {
            setSubmitting(false);
        }
    }

    useEffect(() => {
        const clientId = String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
        if (!clientId || !googleButtonRef.current) {
            return;
        }

        let isCancelled = false;
        let retryTimeout: number | null = null;
        let hasRendered = false;
        let scriptLoadHandler: (() => void) | undefined;

        const initGoogleButton = (): boolean => {
            if (isCancelled || !googleButtonRef.current || hasRendered) {
                return false;
            }

            const googleApi = (window as IGoogleWindow).google?.accounts?.id;
            if (!googleApi) {
                return false;
            }

            googleButtonRef.current.innerHTML = '';
            googleApi.initialize({
                client_id: clientId,
                callback: async (response: IGoogleCredentialResponse) => {
                    const credential = String(response?.credential || '').trim();
                    if (!credential) {
                        setError('Không nhận được token Google. Vui lòng thử lại.');
                        return;
                    }

                    setError('');
                    setGoogleSubmitting(true);
                    try {
                        await loginWithGoogle(credential);
                        router.replace('/dashboard');
                    } catch {
                        setError('Đăng nhập Google thất bại. Vui lòng thử lại.');
                    } finally {
                        setGoogleSubmitting(false);
                    }
                },
                ux_mode: 'popup',
            });
            googleApi.renderButton(googleButtonRef.current, {
                type: 'standard',
                shape: 'pill',
                theme: 'outline',
                text: 'signin_with',
                size: 'large',
                width: 320,
            });

            hasRendered = true;
            return true;
        };

        const scheduleInit = (attempt = 0) => {
            if (isCancelled || hasRendered) {
                return;
            }

            const initialized = initGoogleButton();
            if (initialized) {
                return;
            }

            if (attempt >= 50) {
                return;
            }

            retryTimeout = window.setTimeout(() => scheduleInit(attempt + 1), 100);
        };

        const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
        if (existingScript) {
            scriptLoadHandler = () => scheduleInit(0);
            existingScript.addEventListener('load', scriptLoadHandler);
            scheduleInit(0);
        } else {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.dataset.googleIdentity = 'true';
            script.onload = () => scheduleInit(0);
            document.head.appendChild(script);

            scheduleInit(0);
        }

        return () => {
            isCancelled = true;

            if (retryTimeout) {
                window.clearTimeout(retryTimeout);
            }

            const currentScript = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
            if (currentScript && scriptLoadHandler) {
                currentScript.removeEventListener('load', scriptLoadHandler);
            }
        };
    }, [loginWithGoogle, router]);

    return (
        <div
            className="tech-grid"
            style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '20px 14px', position: 'relative', overflow: 'hidden' }}
        >
            <AppCard strong style={{ position: 'relative', width: '100%', maxWidth: 430, padding: 22, overflow: 'hidden' }}>
                <div
                    style={{
                        position: 'absolute',
                        top: -48,
                        right: -48,
                        width: 160,
                        height: 160,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, var(--chip-border), transparent 70%)',
                    }}
                />
                <div style={{ position: 'relative', zIndex: 1 }}>
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
                            marginBottom: 16,
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                    >
                        SMSF | Hãy đưa tôi tiền của bạn
                    </div>
                    <h1 style={{ margin: '0 0 8px', fontSize: 26, lineHeight: 1.15 }}>Đăng nhập hệ thống</h1>
                    {/* <p style={{ margin: '0 0 20px', color: 'var(--muted)', lineHeight: 1.6, fontSize: 14 }}>
                        Giao diện tối ưu smartphone, font gọn hơn, rõ nét hơn và tập trung vào thao tác nhanh.
                    </p> */}

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
                                    placeholder="Nhập mật khẩu"
                                    style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--foreground)', fontSize: 14 }}
                                />
                            </div>
                        </label>

                        {error ? (
                            <div style={{ borderRadius: 14, padding: '11px 13px', background: 'rgba(239, 68, 68, 0.12)', color: '#fecaca', border: '1px solid rgba(248,113,113,0.2)', fontSize: 13 }}>
                                {error}
                            </div>
                        ) : null}

                        <PrimaryButton type="submit" disabled={submitting || googleSubmitting} style={{ marginTop: 4, opacity: submitting || googleSubmitting ? 0.82 : 1, transform: submitting || googleSubmitting ? 'scale(0.99)' : 'scale(1)' }}>
                            {submitting ? <LoaderCircle size={18} className="spin" /> : <ArrowRight size={18} />}
                            {submitting ? 'Đang xác thực...' : 'Đăng nhập'}
                        </PrimaryButton>

                        <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>hoặc</div>
                            <div
                                ref={googleButtonRef}
                                style={{
                                    minHeight: 40,
                                    opacity: googleSubmitting ? 0.7 : 1,
                                    pointerEvents: googleSubmitting ? 'none' : 'auto',
                                }}
                            />
                            {googleSubmitting ? (
                                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                    Đang xác thực Google...
                                </div>
                            ) : null}
                        </div>

                        <Link
                            href="/register"
                            style={{
                                marginTop: 6,
                                textAlign: 'center',
                                color: 'var(--accent-text)',
                                fontSize: 13,
                                textDecoration: 'none',
                                fontWeight: 700,
                            }}
                        >
                            Chưa có tài khoản? Đăng ký ngay
                        </Link>
                    </form>
                </div>
            </AppCard>
        </div>
    );
}
