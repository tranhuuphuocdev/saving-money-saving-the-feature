'use client';

import { CSSProperties, useEffect, useState } from 'react';

const DEFAULT_USER_AVATAR = 'https://pub-cdc512521bc74741a949c81a9a10a378.r2.dev/avatars/bot/worm-default.svg';

interface IUserAvatarProps {
    src?: string;
    alt: string;
    size: number;
    radius?: number | string;
    style?: CSSProperties;
    imageStyle?: CSSProperties;
    onClick?: () => void;
}

export function UserAvatar({ src, alt, size, radius = '50%', style, imageStyle, onClick }: IUserAvatarProps) {
    const [currentSrc, setCurrentSrc] = useState(src || DEFAULT_USER_AVATAR);

    useEffect(() => {
        setCurrentSrc(src || DEFAULT_USER_AVATAR);
    }, [src]);

    const avatarStyle: CSSProperties = {
        width: size,
        height: size,
        padding: 0,
        borderRadius: radius,
        overflow: 'hidden',
        border: '1px solid var(--chip-border)',
        background: 'linear-gradient(135deg, var(--chip-bg), color-mix(in srgb, var(--theme-gradient-end) 16%, transparent))',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
    };

    const avatarImage = (
        <img
            src={currentSrc}
            alt={alt}
            onError={() => setCurrentSrc(DEFAULT_USER_AVATAR)}
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                ...imageStyle,
            }}
        />
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                style={avatarStyle}
            >
                {avatarImage}
            </button>
        );
    }

    return (
        <div style={avatarStyle}>
            {avatarImage}
        </div>
    );
}

export { DEFAULT_USER_AVATAR };