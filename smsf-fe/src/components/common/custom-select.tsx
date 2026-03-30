'use client';

import { ChevronDown, Check } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ICustomSelectOption {
    value: string;
    label: string;
}

interface ICustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: ICustomSelectOption[];
    placeholder?: string;
    disabled?: boolean;
    dropdownZIndex?: number;
}

export function CustomSelect({
    value,
    onChange,
    options,
    placeholder = 'Chọn...',
    disabled = false,
    dropdownZIndex = 1200,
}: ICustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(null);

    const selectedOption = useMemo(
        () => options.find((option) => option.value === value),
        [options, value],
    );

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        function updatePanelPosition() {
            if (!isOpen || !triggerRef.current) {
                return;
            }

            const rect = triggerRef.current.getBoundingClientRect();
            setPanelRect({
                top: rect.bottom + 6,
                left: rect.left,
                width: rect.width,
            });
        }

        updatePanelPosition();

        window.addEventListener('resize', updatePanelPosition);
        window.addEventListener('scroll', updatePanelPosition, true);

        return () => {
            window.removeEventListener('resize', updatePanelPosition);
            window.removeEventListener('scroll', updatePanelPosition, true);
        };
    }, [isOpen]);

    useEffect(() => {
        function handlePointerDown(event: MouseEvent | TouchEvent) {
            if (!rootRef.current) {
                return;
            }

            const targetNode = event.target as Node;

            if (rootRef.current.contains(targetNode)) {
                return;
            }

            if (panelRef.current?.contains(targetNode)) {
                return;
            }

            setIsOpen(false);
        }

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, []);

    return (
        <div ref={rootRef} style={{ position: 'relative' }}>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen((previous) => !previous)}
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-soft)',
                    color: 'var(--foreground)',
                    fontSize: 13,
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    alignItems: 'center',
                    gap: 8,
                    opacity: disabled ? 0.6 : 1,
                }}
            >
                <span
                    style={{
                        textAlign: 'left',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: selectedOption ? 'var(--foreground)' : 'var(--muted)',
                    }}
                >
                    {selectedOption?.label || placeholder}
                </span>
                <ChevronDown
                    size={16}
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.18s ease',
                    }}
                />
            </button>

            {isMounted && isOpen && panelRect
                ? createPortal(
                      <div
                          ref={panelRef}
                          style={{
                              position: 'fixed',
                              top: panelRect.top,
                              left: panelRect.left,
                              width: panelRect.width,
                              borderRadius: 10,
                              border: '1px solid var(--surface-border)',
                              background: 'var(--surface-strong)',
                              boxShadow: '0 14px 40px rgba(0,0,0,0.32)',
                              overflow: 'hidden',
                              zIndex: dropdownZIndex,
                              maxHeight: 220,
                              overflowY: 'auto',
                          }}
                      >
                          {options.length === 0 ? (
                              <div style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12.5 }}>
                                  Không có lựa chọn.
                              </div>
                          ) : (
                              options.map((option) => {
                                  const isSelected = option.value === value;

                                  return (
                                      <button
                                          key={option.value}
                                          type="button"
                                          onClick={() => {
                                              onChange(option.value);
                                              setIsOpen(false);
                                          }}
                                          style={{
                                              width: '100%',
                                              border: 'none',
                                              borderTop: '1px solid var(--surface-border)',
                                              background: isSelected ? 'var(--chip-bg)' : 'transparent',
                                              color: 'var(--foreground)',
                                              padding: '10px 12px',
                                              display: 'grid',
                                              gridTemplateColumns: '1fr auto',
                                              alignItems: 'center',
                                              gap: 8,
                                              fontSize: 13,
                                          }}
                                      >
                                          <span style={{ textAlign: 'left' }}>{option.label}</span>
                                          {isSelected ? <Check size={14} color="var(--accent)" /> : null}
                                      </button>
                                  );
                              })
                          )}
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    );
}