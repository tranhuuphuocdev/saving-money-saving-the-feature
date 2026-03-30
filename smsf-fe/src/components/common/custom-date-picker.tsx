'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ICustomDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    zIndex?: number;
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function parseDateValue(value: string): Date | null {
    if (!value) {
        return null;
    }

    const date = new Date(`${value}T12:00:00`);
    return Number.isFinite(date.getTime()) ? date : null;
}

function toDateValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toDateLabel(value: string): string {
    const date = parseDateValue(value);
    if (!date) {
        return '';
    }

    return date.toLocaleDateString('vi-VN');
}

function buildCalendarGrid(viewMonth: Date): Date[] {
    const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - startOffset);

    return Array.from({ length: 42 }).map((_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return day;
    });
}

export function CustomDatePicker({ value, onChange, placeholder = 'Chọn ngày', zIndex = 190 }: ICustomDatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    const selectedDate = useMemo(() => parseDateValue(value), [value]);
    const [viewMonth, setViewMonth] = useState<Date>(() => selectedDate || new Date());

    useEffect(() => {
        if (selectedDate) {
            setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
        }
    }, [selectedDate]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        function handlePointerDown(event: MouseEvent | TouchEvent) {
            if (!isOpen) {
                return;
            }

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
    }, [isOpen]);

    const calendarDays = useMemo(() => buildCalendarGrid(viewMonth), [viewMonth]);

    return (
        <div ref={rootRef} style={{ position: 'relative' }}>
            <button
                type="button"
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
                }}
            >
                <span style={{ textAlign: 'left', color: selectedDate ? 'var(--foreground)' : 'var(--muted)' }}>
                    {selectedDate ? toDateLabel(value) : placeholder}
                </span>
                <CalendarDays size={16} />
            </button>

            {isMounted && isOpen
                ? createPortal(
                      <div
                          style={{
                              position: 'fixed',
                              inset: 0,
                              zIndex: zIndex,
                              display: 'grid',
                              placeItems: 'center',
                              padding: 12,
                          }}
                      >
                          <button
                              type="button"
                              onClick={() => setIsOpen(false)}
                              style={{
                                  position: 'absolute',
                                  inset: 0,
                                  border: 'none',
                                  background: 'rgba(2, 8, 23, 0.5)',
                                  backdropFilter: 'blur(2px)',
                                  padding: 0,
                              }}
                          />

                          <div
                              ref={panelRef}
                              style={{
                                  width: 'min(92vw, 360px)',
                                  maxHeight: 'calc(100dvh - 24px)',
                                  borderRadius: 12,
                                  border: '1px solid var(--surface-border)',
                                  background: 'var(--surface-strong)',
                                  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                                  padding: 10,
                                  display: 'grid',
                                  gap: 8,
                                  overflowY: 'auto',
                                  position: 'relative',
                                  zIndex: zIndex + 1,
                              }}
                          >
                              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 8 }}>
                                  <button
                                      type="button"
                                      onClick={() => {
                                          const previous = new Date(viewMonth);
                                          previous.setMonth(previous.getMonth() - 1);
                                          setViewMonth(previous);
                                      }}
                                      style={{
                                          width: 30,
                                          height: 30,
                                          borderRadius: 8,
                                          border: '1px solid var(--surface-border)',
                                          background: 'transparent',
                                          color: 'var(--foreground)',
                                          display: 'grid',
                                          placeItems: 'center',
                                      }}
                                  >
                                      <ChevronLeft size={15} />
                                  </button>
                                  <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
                                      Tháng {viewMonth.getMonth() + 1}/{viewMonth.getFullYear()}
                                  </div>
                                  <button
                                      type="button"
                                      onClick={() => {
                                          const next = new Date(viewMonth);
                                          next.setMonth(next.getMonth() + 1);
                                          setViewMonth(next);
                                      }}
                                      style={{
                                          width: 30,
                                          height: 30,
                                          borderRadius: 8,
                                          border: '1px solid var(--surface-border)',
                                          background: 'transparent',
                                          color: 'var(--foreground)',
                                          display: 'grid',
                                          placeItems: 'center',
                                      }}
                                  >
                                      <ChevronRight size={15} />
                                  </button>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                                  {WEEKDAY_LABELS.map((label) => (
                                      <div key={label} style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>
                                          {label}
                                      </div>
                                  ))}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                                  {calendarDays.map((day) => {
                                      const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
                                      const isSelected = value === toDateValue(day);

                                      return (
                                          <button
                                              key={day.toISOString()}
                                              type="button"
                                              onClick={() => {
                                                  onChange(toDateValue(day));
                                                  setIsOpen(false);
                                              }}
                                              style={{
                                                  height: 32,
                                                  borderRadius: 8,
                                                  border: isSelected ? '1px solid var(--theme-gradient-start)' : '1px solid transparent',
                                                  background: isSelected ? 'var(--chip-bg)' : 'transparent',
                                                  color: isCurrentMonth ? 'var(--foreground)' : 'var(--muted)',
                                                  fontSize: 11.5,
                                                  fontWeight: isSelected ? 800 : 600,
                                              }}
                                          >
                                              {day.getDate()}
                                          </button>
                                      );
                                  })}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                  <button
                                      type="button"
                                      onClick={() => {
                                          onChange('');
                                          setIsOpen(false);
                                      }}
                                      style={{
                                          borderRadius: 8,
                                          border: '1px solid var(--surface-border)',
                                          background: 'transparent',
                                          color: 'var(--foreground)',
                                          fontSize: 12,
                                          fontWeight: 700,
                                          padding: '9px 10px',
                                      }}
                                  >
                                      Xóa
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => {
                                          const today = new Date();
                                          onChange(toDateValue(today));
                                          setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                                          setIsOpen(false);
                                      }}
                                      style={{
                                          borderRadius: 8,
                                          border: '1px solid var(--theme-gradient-start)',
                                          background: 'var(--chip-bg)',
                                          color: 'var(--foreground)',
                                          fontSize: 12,
                                          fontWeight: 700,
                                          padding: '9px 10px',
                                      }}
                                  >
                                      Hôm nay
                                  </button>
                              </div>
                          </div>
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    );
}