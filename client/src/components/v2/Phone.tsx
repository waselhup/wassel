import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PhoneProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** show the device chrome (notch + home indicator). Off in production. */
  showChrome?: boolean;
  /** render a synthetic iOS status bar (9:41 + signal/wifi/battery). Only when showChrome. */
  showStatusBar?: boolean;
}

/**
 * Phone — dev/preview wrapper that frames a screen at 390×844.
 * In production (showChrome={false}, the default), it renders as a plain full-bleed
 * column so screens look native on real devices.
 */
function Phone({
  className,
  children,
  showChrome = false,
  showStatusBar = false,
  ...rest
}: PhoneProps) {
  if (!showChrome) {
    return (
      <div
        className={cn(
          'flex min-h-[100dvh] w-full flex-col bg-v2-canvas font-ar text-v2-ink',
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'phone4 mx-auto', // .phone4 from tokens.css supplies the device chrome
        className,
      )}
      {...rest}
    >
      {showStatusBar && <StatusBar />}
      <div className="phone4-screen">{children}</div>
      <div className="phone4-home" />
    </div>
  );
}

function StatusBar() {
  return (
    <div className="phone4-status">
      <span className="font-en tabular-nums">9:41</span>
      <div className="right">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="none" aria-hidden="true">
          <rect x="0"  y="7" width="3" height="4" rx="0.5" fill="currentColor" />
          <rect x="5"  y="5" width="3" height="6" rx="0.5" fill="currentColor" />
          <rect x="10" y="3" width="3" height="8" rx="0.5" fill="currentColor" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
          <path d="M8 10.5a1 1 0 100-2 1 1 0 000 2zM4 6.5a5.5 5.5 0 018 0M1.5 4a9 9 0 0113 0"
            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <svg width="25" height="12" viewBox="0 0 26 12" fill="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="22" height="11" rx="2.5" stroke="currentColor" opacity=".5" />
          <rect x="2"   y="2"   width="19" height="8"  rx="1.2" fill="currentColor" />
          <rect x="23.5" y="4"  width="1.5" height="4" rx="0.5" fill="currentColor" opacity=".5" />
        </svg>
      </div>
    </div>
  );
}

export default Phone;
