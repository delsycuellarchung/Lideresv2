"use client";
import React from "react";

type Props = {
  id: string; // unique id for persistence
  isOpen: boolean;
  onClose: () => void;
  minWidth?: number;
  minHeight?: number;
  overlayClassName?: string;
  modalClassName?: string;
  centerOnOpen?: boolean;
  children: React.ReactNode;
};

export default function DraggableModal({ id, isOpen, onClose, minWidth = 360, minHeight = 220, overlayClassName, modalClassName, centerOnOpen = false, children }: Props) {
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const bodyRef = React.useRef<HTMLDivElement | null>(null);

  const [pos, setPos] = React.useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [size, setSize] = React.useState<{ width: number | string; height: number | string }>({ width: '80%', height: '80vh' });
  const dragging = React.useRef(false);
  const resizing = React.useRef(false);
  const start = React.useRef<{ x: number; y: number; left: number; top: number; w: number; h: number } | null>(null);

  const [mounted, setMounted] = React.useState(false);

  // If requested, center the modal each time it is opened
  React.useEffect(() => {
    if (isOpen && centerOnOpen) {
      // force center and a sensible default size when opening
      // Respect provided minWidth/minHeight while keeping defaults compact
      const defaultW = Math.max(480, typeof minWidth === 'number' ? minWidth : 480);
      const defaultH = Math.max(160, typeof minHeight === 'number' ? minHeight : 160);
      setSize((s) => {
        const curW = typeof s.width === 'number' ? s.width : (typeof s.width === 'string' && s.width.endsWith('px') ? parseInt(s.width) : NaN);
        const curH = typeof s.height === 'number' ? s.height : (typeof s.height === 'string' && s.height.endsWith('px') ? parseInt(s.height) : NaN);
        if (Number.isFinite(curW) && curW < defaultW && Number.isFinite(curH) && curH < defaultH) return s;
        return { width: `${defaultW}px`, height: `${defaultH}px` };
      });

      // compute pixel-centered left/top so dragging works immediately
      setTimeout(() => {
        try {
          const w = defaultW;
          const h = defaultH;
          const OFFSET = 60; // shift modal a bit to the left
          const left = Math.max(8, Math.round((window.innerWidth - w) / 2) - OFFSET);
          const top = Math.max(8, Math.round((window.innerHeight - h) / 2));
          setPos({ left, top });

          // attempt to auto-size the modal to fit its content so we avoid inner scrolling
          setTimeout(() => {
            try {
              const box = boxRef.current;
              const body = bodyRef.current || (box ? box.querySelector('[data-modal-body]') as HTMLDivElement | null : null);
              if (body && box) {
                const headerHeight = box.querySelector('h3') ? (box.querySelector('h3') as HTMLElement).getBoundingClientRect().height + 8 : 0;
                const footerHeight = 22 + 8; // reserve resize/footer area + gap
                const needed = Math.max(defaultH, Math.ceil(body.scrollHeight + headerHeight + footerHeight + 8));
                // allow extremely tall modals but cap at window height*0.95 to avoid completely overflowing
                const cap = Math.max(needed, Math.min(window.innerHeight * 0.95, Math.max(needed, defaultH)));
                setSize((s) => ({ ...s, height: `${Math.max(minHeight, Math.round(cap))}px` }));
              }
            } catch (err) { /* ignore measurement errors */ }
          }, 50);
        } catch (err) { /* ignore */ }
      }, 0);
    }
  }, [isOpen, centerOnOpen]);

  // load persisted
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(`modal_state_${id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        // only restore persisted pos/size when not centering on open
        if (!(centerOnOpen && isOpen)) {
          if (parsed.pos) setPos(parsed.pos);
          if (parsed.size) setSize(parsed.size);
        }
      } else {
        // center by default
        setPos({ left: 0, top: 0 });
      }
    } catch (e) { /* ignore */ }
  }, [id]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // persist
  const persist = React.useCallback(() => {
    try {
      const payload = { pos, size };
      localStorage.setItem(`modal_state_${id}`, JSON.stringify(payload));
    } catch (e) { /* ignore */ }
  }, [id, pos, size]);

  React.useEffect(() => { persist(); }, [persist]);

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current && start.current && boxRef.current) {
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;
        const left = Math.max(8, start.current.left + dx);
        const top = Math.max(8, start.current.top + dy);
        setPos({ left, top });
      } else if (resizing.current && start.current && boxRef.current) {
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;
        const newW = Math.max(minWidth, start.current.w + dx);
        const newH = Math.max(minHeight, start.current.h + dy);
        setSize({ width: newW, height: newH });
      }
    };
    const onUp = () => {
      dragging.current = false;
      resizing.current = false;
      start.current = null;
      persist();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [minWidth, minHeight, persist]);

  // if modalClassName provided, attach drag to first H3 inside child content
  React.useEffect(() => {
    if (!modalClassName || !boxRef.current) return;
    const el = boxRef.current.querySelector('h3');
    if (!el) return;
    const handler = (e: Event) => {
      // synthesize mouse event for startDrag
      // @ts-ignore
      startDrag(e as any);
    };
    el.addEventListener('mousedown', handler as any);
    return () => el.removeEventListener('mousedown', handler as any);
  }, [modalClassName]);

  const startDrag = (e: React.MouseEvent) => {
    if (!boxRef.current) return;
    dragging.current = true;
    const rect = boxRef.current.getBoundingClientRect();
    start.current = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, w: rect.width, h: rect.height };
    e.preventDefault();
  };

  const startResize = (e: React.MouseEvent) => {
    if (!boxRef.current) return;
    resizing.current = true;
    const rect = boxRef.current.getBoundingClientRect();
    start.current = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, w: rect.width, h: rect.height };
    e.preventDefault();
  };

  // avoid rendering on server/first render to prevent hydration mismatches
  if (!mounted) return null;
  if (!isOpen) return null;
  // allow existing CSS to style overlay/modal when class names are provided
  const overlayStyle = overlayClassName ? undefined : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 12 };

  const hasPixelPosition = typeof pos.left === 'number' && pos.left > 0 && typeof pos.top === 'number' && pos.top > 0;

  const boxBaseStyle: React.CSSProperties = {
    position: 'fixed',
    left: hasPixelPosition ? pos.left : '50%',
    top: hasPixelPosition ? pos.top : '50%',
    transform: hasPixelPosition ? 'none' : 'translate(-50%, -50%)',
    zIndex: 9999,
    width: size.width,
    height: size.height,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };

  const boxStyle = modalClassName ? boxBaseStyle : { ...boxBaseStyle, background: 'white', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.12)' };


  return (
    <div ref={overlayRef} className={overlayClassName} style={overlayStyle}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        className={modalClassName}
        style={boxStyle}
        onMouseDown={(e) => {
          // allow dragging by grabbing any non-interactive area of the modal
          try {
            const t = e.target as HTMLElement;
            if (!t) return;
            // ignore clicks on form controls and the resize handle
            if (t.closest && (t.closest('input,button,textarea,select,a,label') || t.closest('.draggable-resize-handle'))) return;
            startDrag(e as React.MouseEvent);
          } catch (err) { /* ignore */ }
        }}
      >
        {!modalClassName && (
          <div onMouseDown={startDrag} style={{ cursor: 'move', padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(90deg, rgba(255,255,255,0.6), rgba(255,255,255,0))' }}>
            <div style={{ fontWeight: 700 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
          </div>
        )}

        <div ref={bodyRef} data-modal-body style={{ flex: 1, overflow: 'visible', padding: modalClassName ? undefined : 6 }}>
          {children}
        </div>

        <div style={{ height: 22, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: 4 }}>
          <div className="draggable-resize-handle" onMouseDown={startResize} title="Redimensionar" style={{ width: 18, height: 18, cursor: 'nwse-resize', background: 'transparent', marginRight: 6 }} />
        </div>
      </div>
    </div>
  );
}
