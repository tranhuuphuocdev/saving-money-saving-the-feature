'use client';

import { LoaderCircle, Move, X, ZoomIn } from 'lucide-react';
import { useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { createPortal } from 'react-dom';
import { cropAvatarImage } from '@/features/profile/lib/crop-avatar-image';

interface IAvatarCropModalProps {
    isOpen: boolean;
    imageSrc: string;
    onClose: () => void;
    onConfirm: (file: File) => Promise<void>;
    isSubmitting: boolean;
}

export function AvatarCropModal({ isOpen, imageSrc, onClose, onConfirm, isSubmitting }: IAvatarCropModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1.2);
    const [cropAreaPixels, setCropAreaPixels] = useState<Area | null>(null);
    const [errorMessage, setErrorMessage] = useState('');

    if (!isOpen || typeof document === 'undefined') {
        return null;
    }

    const handleConfirm = async () => {
        if (!cropAreaPixels) {
            setErrorMessage('Hãy căn chỉnh ảnh trước khi lưu.');
            return;
        }

        setErrorMessage('');

        try {
            const croppedFile = await cropAvatarImage(imageSrc, cropAreaPixels);
            await onConfirm(croppedFile);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Không thể xử lý ảnh đã chọn.');
        }
    };

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 8, 23, 0.84)',
                backdropFilter: 'blur(10px)',
                zIndex: 1450,
                display: 'grid',
                placeItems: 'end center',
            }}
        >
            <button type="button" aria-label="Đóng" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none' }} />
            <div
                style={{
                    position: 'relative',
                    width: 'min(100%, 560px)',
                    maxHeight: 'min(100dvh, 760px)',
                    borderTopLeftRadius: 28,
                    borderTopRightRadius: 28,
                    border: '1px solid var(--surface-border)',
                    background: 'var(--card-strong)',
                    boxShadow: 'var(--shadow)',
                    padding: '14px 14px calc(14px + env(safe-area-inset-bottom, 0px))',
                    display: 'grid',
                    gap: 14,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Căn chỉnh ảnh đại diện</div>
                        <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>Kéo và zoom để vừa khung</div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
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
                        position: 'relative',
                        height: 'min(68vw, 420px)',
                        minHeight: 280,
                        borderRadius: 24,
                        overflow: 'hidden',
                        background: 'radial-gradient(circle at top, rgba(56, 189, 248, 0.18), rgba(8, 15, 28, 0.98))',
                    }}
                >
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        zoomSpeed={0.15}
                        objectFit="cover"
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={(_, croppedAreaPixels) => setCropAreaPixels(croppedAreaPixels)}
                    />
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 12.5 }}>
                        <Move size={15} /> Kéo ảnh để chọn vùng hiển thị
                    </div>
                    <label style={{ display: 'grid', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 12.5 }}>
                            <ZoomIn size={15} /> Mức zoom
                        </span>
                        <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
                    </label>
                    {errorMessage ? <div style={{ color: '#fca5a5', fontSize: 12.5 }}>{errorMessage}</div> : null}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        style={{
                            minHeight: 48,
                            borderRadius: 16,
                            border: '1px solid var(--border)',
                            background: 'var(--surface-soft)',
                            color: 'var(--foreground)',
                            fontWeight: 700,
                        }}
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleConfirm()}
                        disabled={isSubmitting}
                        style={{
                            minHeight: 48,
                            borderRadius: 16,
                            border: '1px solid color-mix(in srgb, var(--theme-gradient-start) 62%, var(--border))',
                            background: 'linear-gradient(135deg, var(--theme-gradient-start), var(--theme-gradient-end))',
                            color: '#eff6ff',
                            fontWeight: 900,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        {isSubmitting ? <LoaderCircle size={17} className="spin" /> : null}
                        {isSubmitting ? 'Đang tải ảnh...' : 'Lưu avatar'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}