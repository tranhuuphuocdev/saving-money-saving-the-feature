import { ButtonHTMLAttributes, ReactNode } from 'react';

interface IPrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
}

export function PrimaryButton({ children, style, ...props }: IPrimaryButtonProps) {
    return (
        <button
            {...props}
            style={{
                border: 'none',
                borderRadius: 18,
                padding: '14px 18px',
                background: 'linear-gradient(135deg, var(--theme-gradient-start) 0%, var(--theme-gradient-end) 100%)',
                color: 'var(--theme-nav-active)',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'transform 0.18s ease, opacity 0.18s ease',
                ...style,
            }}
        >
            {children}
        </button>
    );
}
