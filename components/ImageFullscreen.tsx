"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
  className?: string;
  showCaption?: boolean;
  caption?: string;
};

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "1rem",
};

const innerStyle: React.CSSProperties = {
  position: "relative",
  maxWidth: "100%",
  maxHeight: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const imgStyle: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: "80vh",
  objectFit: "contain",
  borderRadius: 6,
  boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
};

const closeButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 10,
  right: 10,
  background: "rgba(0,0,0,0.4)",
  color: "#fff",
  border: "none",
  width: 36,
  height: 36,
  borderRadius: 18,
  cursor: "pointer",
  fontSize: 20,
  lineHeight: "36px",
};

const captionStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#ddd",
  fontSize: 14,
  textAlign: "center",
  maxWidth: "90%",
};

export default function ImageFullscreen({
  src,
  alt = "",
  open,
  onClose,
  className,
  showCaption = false,
  caption,
}: Props) {
  const prevActive = useRef<HTMLElement | null>(null);
  const container = useState(() => (typeof document !== "undefined" ? document.createElement("div") : null))[0] as HTMLDivElement;
  if (container) {
    // attach a full-viewport fixed container so it sits above any stacking context
    container.style.position = 'fixed'
    container.style.top = '0'
    container.style.left = '0'
    container.style.width = '100%'
    container.style.height = '100%'
    container.style.pointerEvents = 'auto'
    container.style.zIndex = '2147483647'
    container.setAttribute('data-portal', 'image-fullscreen')
  }

  useEffect(() => {
    if (!open) return;
    prevActive.current = document.activeElement as HTMLElement | null;
    if (container) document.body.appendChild(container);
    // prevent clicks/pointer events inside this portal from reaching other
    // listeners (e.g. the drawer's outside-click handler). Use bubble-phase
    // handlers so target element handlers still run first.
    const stop = (e: Event) => {
      e.stopPropagation()
    }
    container.addEventListener('pointerdown', stop)
    container.addEventListener('mousedown', stop)
    container.addEventListener('click', stop)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      if (container) {
        container.removeEventListener('pointerdown', stop)
        container.removeEventListener('mousedown', stop)
        container.removeEventListener('click', stop)
      }
      if (container && container.parentElement) document.body.removeChild(container);
      document.body.style.overflow = prevOverflow;
      // Avoid programmatically focusing input or editable elements when closing
      if (prevActive.current && typeof prevActive.current.focus === "function") {
        try {
          const tag = (prevActive.current.tagName || '').toLowerCase();
          const isEditable = prevActive.current.getAttribute && prevActive.current.getAttribute('contenteditable') === 'true';
          if (tag !== 'input' && tag !== 'textarea' && !isEditable) {
            prevActive.current.focus();
          }
        } catch (err) {
          // If any error occurs, avoid focusing to be safe
        }
      }
    };
  }, [open, onClose, container]);

  if (!open || !container) return null;

  const content = (
    <div
      style={{ ...backdropStyle }}
      onClick={(e) => {
        // backdrop click closes the fullscreen viewer
        e.stopPropagation()
        onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Image fullscreen"
    >
      <div style={innerStyle} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Close image"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          style={{ ...closeButtonStyle, zIndex: 2147483648 }}
        >
          ×
        </button>
        <img src={src} alt={alt} style={imgStyle} className={className} />
        {showCaption && caption ? <div style={captionStyle}>{caption}</div> : null}
      </div>
    </div>
  );

  return createPortal(content, container);
}
