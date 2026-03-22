import { ButtonHTMLAttributes, ReactNode } from 'react';

interface IIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
}

export function IconButton({ children, style, ...props }: IIconButtonProps) {
    return (
        <button
            {...props}
            className="glass-card"
            style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid var(--theme-icon-border)',
                background: 'var(--theme-icon-surface)',
                color: 'var(--foreground)',
                ...style,
            }}
        >
            {children}
        </button>
    );
}
