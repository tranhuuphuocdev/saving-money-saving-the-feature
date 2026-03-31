'use client';

import { Camera, ImageIcon, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { UserAvatar } from '@/components/common/user-avatar';

interface IAvatarPreviewModalProps {
    isOpen: boolean;
    imageSrc?: string;
    displayName: string;
    onClose: () => void;
    onPickNewImage: () => void;
}

export function AvatarPreviewModal({ isOpen, imageSrc, displayName, onClose, onPickNewImage }: IAvatarPreviewModalProps) {
    if (!isOpen || typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 8, 23, 0.72)',
                backdropFilter: 'blur(12px)',
                zIndex: 1400,
                padding: 12,
                display: 'grid',
                placeItems: 'center',
            }}
        >
            <button type="button" aria-label="Đóng" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none' }} />
            <div
                style={{
                    position: 'relative',
                    width: 'min(100%, 480px)',
                    borderRadius: 28,
                    border: '1px solid var(--surface-border)',
                    background: 'var(--card-strong)',
                    boxShadow: 'var(--shadow)',
                    padding: 16,
                    display: 'grid',
                    gap: 14,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ảnh đại diện</div>
                        <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{displayName}</div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 14,
                            border: '1px solid var(--border)',
                            background: 'var(--surface-soft)',
                            color: 'var(--foreground)',
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div
                    style={{
                        borderRadius: 24,
                        overflow: 'hidden',
                        background: 'linear-gradient(180deg, var(--surface-soft), var(--surface-strong))',
                        border: '1px solid var(--surface-border)',
                        minHeight: 'min(72vw, 320px)',
                        display: 'grid',
                        placeItems: 'center',
                        padding: 16,
                    }}
                >
                    {imageSrc ? (
                        <img src={imageSrc} alt={displayName} style={{ width: '100%', maxHeight: 'min(72vw, 320px)', objectFit: 'contain', borderRadius: 20 }} />
                    ) : (
                        <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
                            <UserAvatar src={imageSrc} alt={displayName} size={180} radius={36} />
                            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ảnh mặc định con sâu đang được sử dụng.</div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                        type="button"
                        onClick={onPickNewImage}
                        style={{
                            minHeight: 46,
                            borderRadius: 16,
                            border: '1px solid var(--chip-border)',
                            background: 'var(--chip-bg)',
                            color: 'var(--foreground)',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        <Camera size={17} />
                        Tải ảnh khác
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            minHeight: 46,
                            borderRadius: 16,
                            border: '1px solid var(--border)',
                            background: 'var(--surface-soft)',
                            color: 'var(--foreground)',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        <ImageIcon size={17} />
                        Đóng xem ảnh
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}