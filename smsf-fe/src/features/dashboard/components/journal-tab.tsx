'use client';

import { ImagePlus, NotebookText, Save, Trash2, Type } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { AppCard } from '@/components/common/app-card';
import { PrimaryButton } from '@/components/common/primary-button';

interface IImageDraftItem {
    id: string;
    file: File;
    previewUrl: string;
}

export function JournalTab() {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const [entryTitle, setEntryTitle] = useState('');
    const [entryTag, setEntryTag] = useState('');
    const [tags, setTags] = useState<string[]>(['Cá nhân', 'Cảm xúc']);
    const [images, setImages] = useState<IImageDraftItem[]>([]);
    const [saveMessage, setSaveMessage] = useState('');

    const imageCountLabel = useMemo(() => {
        if (images.length === 0) return 'Chưa có ảnh nào được chọn';
        if (images.length === 1) return '1 ảnh đã được gán';
        return `${images.length} ảnh đã được gán`;
    }, [images.length]);

    function formatEditor(command: 'bold' | 'italic' | 'insertUnorderedList') {
        editorRef.current?.focus();
        document.execCommand(command);
    }

    function handleAddTag() {
        const normalized = entryTag.trim();
        if (!normalized) return;
        if (tags.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
            setEntryTag('');
            return;
        }
        setTags((previous) => [...previous, normalized]);
        setEntryTag('');
    }

    function handleUploadImages(event: React.ChangeEvent<HTMLInputElement>) {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;

        const draftItems = Array.from(fileList).map((file) => ({
            id: `${file.name}-${file.size}-${file.lastModified}`,
            file,
            previewUrl: URL.createObjectURL(file),
        }));

        setImages((previous) => {
            const existingIds = new Set(previous.map((item) => item.id));
            const dedup = draftItems.filter((item) => !existingIds.has(item.id));
            return [...previous, ...dedup];
        });

        event.target.value = '';
    }

    function removeImage(id: string) {
        setImages((previous) => {
            const found = previous.find((item) => item.id === id);
            if (found) {
                URL.revokeObjectURL(found.previewUrl);
            }
            return previous.filter((item) => item.id !== id);
        });
    }

    function removeTag(tag: string) {
        setTags((previous) => previous.filter((item) => item !== tag));
    }

    function handleSaveDraft() {
        setSaveMessage('Đã lưu nháp giao diện nhật ký. Có thể nối API lưu thực tế ở bước tiếp theo.');
        window.setTimeout(() => setSaveMessage(''), 2400);
    }

    return (
        <AppCard strong style={{ padding: 16, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'linear-gradient(135deg, var(--theme-gradient-start), var(--theme-gradient-end))',
                        color: '#fff',
                    }}
                >
                    <NotebookText size={18} />
                </div>
                <div>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>Nhật ký tài chính</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                        Ghi lại suy nghĩ, sự kiện và cảm xúc về tiền bạc mỗi ngày.
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Tiêu đề</div>
                <input
                    type="text"
                    value={entryTitle}
                    onChange={(event) => setEntryTitle(event.target.value)}
                    placeholder="Hôm nay mình đã chi tiêu thế nào?"
                    style={{
                        width: '100%',
                        borderRadius: 10,
                        border: '1px solid var(--surface-border)',
                        background: 'var(--surface-soft)',
                        color: 'var(--foreground)',
                        padding: '10px 12px',
                        fontSize: 13,
                        boxSizing: 'border-box',
                    }}
                />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Thẻ</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        type="text"
                        value={entryTag}
                        onChange={(event) => setEntryTag(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                handleAddTag();
                            }
                        }}
                        placeholder="Thêm thẻ (VD: Mục tiêu, Kỷ luật...)"
                        style={{
                            flex: 1,
                            borderRadius: 10,
                            border: '1px solid var(--surface-border)',
                            background: 'var(--surface-soft)',
                            color: 'var(--foreground)',
                            padding: '9px 12px',
                            fontSize: 12.5,
                            boxSizing: 'border-box',
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleAddTag}
                        style={{
                            borderRadius: 10,
                            border: '1px solid var(--surface-border)',
                            background: 'var(--surface-soft)',
                            color: 'var(--foreground)',
                            fontWeight: 700,
                            fontSize: 12,
                            padding: '0 12px',
                        }}
                    >
                        Thêm
                    </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tags.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => removeTag(tag)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                borderRadius: 999,
                                border: '1px solid var(--chip-border)',
                                background: 'var(--chip-bg)',
                                color: 'var(--foreground)',
                                padding: '6px 10px',
                                fontSize: 11,
                                fontWeight: 700,
                            }}
                        >
                            #{tag}
                            <Trash2 size={12} />
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Noi dung</div>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                            type="button"
                            onClick={() => formatEditor('bold')}
                            style={{
                                border: '1px solid var(--surface-border)',
                                background: 'var(--surface-soft)',
                                color: 'var(--foreground)',
                                borderRadius: 8,
                                height: 30,
                                width: 30,
                                display: 'grid',
                                placeItems: 'center',
                            }}
                            aria-label="Bold"
                        >
                            <Type size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => formatEditor('italic')}
                            style={{
                                border: '1px solid var(--surface-border)',
                                background: 'var(--surface-soft)',
                                color: 'var(--foreground)',
                                borderRadius: 8,
                                height: 30,
                                width: 30,
                                display: 'grid',
                                placeItems: 'center',
                                fontStyle: 'italic',
                                fontWeight: 800,
                            }}
                            aria-label="Italic"
                        >
                            I
                        </button>
                        <button
                            type="button"
                            onClick={() => formatEditor('insertUnorderedList')}
                            style={{
                                border: '1px solid var(--surface-border)',
                                background: 'var(--surface-soft)',
                                color: 'var(--foreground)',
                                borderRadius: 8,
                                height: 30,
                                width: 30,
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 900,
                            }}
                            aria-label="Bullet list"
                        >
                            •
                        </button>
                    </div>
                </div>
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    style={{
                        minHeight: 160,
                        borderRadius: 12,
                        border: '1px solid var(--surface-border)',
                        background: 'var(--surface-soft)',
                        color: 'var(--foreground)',
                        padding: '12px 14px',
                        lineHeight: 1.6,
                        fontSize: 13,
                        outline: 'none',
                    }}
                />
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Gợi ý: ghi lý do chi tiêu, cảm xúc hôm nay và điều muốn cải thiện cho ngày mai.
                </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Ảnh đính kèm</div>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{imageCountLabel}</span>
                </div>
                <label
                    style={{
                        borderRadius: 10,
                        border: '1px dashed var(--surface-border)',
                        background: 'var(--surface-soft)',
                        color: 'var(--foreground)',
                        padding: '10px 12px',
                        fontSize: 12.5,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        width: 'fit-content',
                        cursor: 'pointer',
                    }}
                >
                    <ImagePlus size={15} />
                    Chọn ảnh
                    <input type="file" accept="image/*" multiple hidden onChange={handleUploadImages} />
                </label>

                {images.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                        {images.map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-strong)',
                                    overflow: 'hidden',
                                    position: 'relative',
                                }}
                            >
                                <img
                                    src={item.previewUrl}
                                    alt={item.file.name}
                                    style={{ width: '100%', height: 92, objectFit: 'cover', display: 'block' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeImage(item.id)}
                                    style={{
                                        position: 'absolute',
                                        top: 6,
                                        right: 6,
                                        border: 'none',
                                        width: 22,
                                        height: 22,
                                        borderRadius: 999,
                                        background: 'rgba(15, 23, 42, 0.82)',
                                        color: '#fff',
                                        display: 'grid',
                                        placeItems: 'center',
                                    }}
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 11.5, color: saveMessage ? 'var(--accent-text)' : 'var(--muted)', fontWeight: 600 }}>
                    {saveMessage || 'Bạn đang ở chế độ thử nghiệm UI, chưa lưu backend.'}
                </div>
                <PrimaryButton onClick={handleSaveDraft}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Save size={14} />
                        Lưu nháp
                    </span>
                </PrimaryButton>
            </div>
        </AppCard>
    );
}
