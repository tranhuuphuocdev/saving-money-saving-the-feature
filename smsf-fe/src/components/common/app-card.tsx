import { CSSProperties, ReactNode } from 'react';

interface IAppCardProps {
    children: ReactNode;
    style?: CSSProperties;
    strong?: boolean;
}

export function AppCard({ children, style, strong = false }: IAppCardProps) {
    return (
        <div className={`glass-card${strong ? ' card-strong' : ''}`} style={{ borderRadius: 24, ...style }}>
            {children}
        </div>
    );
}
