"use client";

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Info, X, Calculator, HelpCircle } from "lucide-react";

export interface InfoGuideProps {
  title: string;
  formula?: string;
  description: string;
  details?: string[];
  size?: number;
  className?: string;
}

const emptySubscribe = () => () => {};

export function InfoButton({
  title,
  formula,
  description,
  details,
  size = 14,
  className = "",
}: InfoGuideProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    placeAbove: false,
  });

  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(380, typeof window !== "undefined" ? window.innerWidth - 32 : 360);
    const popoverHeightEstimate = 260;

    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < popoverHeightEstimate && rect.top > spaceBelow;

    // In RTL, align right edge of popover with right side of button
    let left = rect.right - popoverWidth + 12;
    if (left < 16) {
      left = 16;
    } else if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }

    const top = placeAbove
      ? Math.max(16, rect.top - 8)
      : Math.min(window.innerHeight - 80, rect.bottom + 8);

    setCoords({ top, left, placeAbove });
  }, []);

  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updatePosition();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 180);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updatePosition();
    setIsVisible((prev) => !prev);
  };

  // Close on Escape or click outside
  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsVisible(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsVisible(false);
      }
    };
    const handleScrollOrResize = () => {
      if (isVisible) updatePosition();
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isVisible, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`info-trigger-btn ${isVisible ? "active" : ""} ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        aria-label={`توضیحات و نحوه محاسبه: ${title}`}
      >
        <Info size={size} />
      </button>

      {isMounted &&
        isVisible &&
        createPortal(
          <div
            ref={popoverRef}
            className={`info-popover ${coords.placeAbove ? "place-above" : "place-below"}`}
            style={{
              top: coords.placeAbove ? undefined : `${coords.top}px`,
              bottom: coords.placeAbove ? `${window.innerHeight - coords.top}px` : undefined,
              left: `${coords.left}px`,
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
            role="tooltip"
          >
            <div className="info-popover-header">
              <div className="info-popover-title">
                <span className="info-popover-icon">
                  <Calculator size={15} />
                </span>
                <div>
                  <h4>{title}</h4>
                  <small>راهنمای محاسبات مالی</small>
                </div>
              </div>
              <button
                type="button"
                className="info-popover-close"
                onClick={() => setIsVisible(false)}
                title="بستن"
                aria-label="بستن راهنما"
              >
                <X size={14} />
              </button>
            </div>

            <div className="info-popover-body">
              {formula && (
                <div className="info-popover-formula">
                  <span className="formula-badge">فرمول محاسبه</span>
                  <code className="formula-text">{formula}</code>
                </div>
              )}

              <div className="info-popover-desc">
                <p>{description}</p>
              </div>

              {details && details.length > 0 && (
                <div className="info-popover-details">
                  <div className="details-header">
                    <HelpCircle size={13} />
                    <span>نکات تکمیلی:</span>
                  </div>
                  <ul>
                    {details.map((detail, index) => (
                      <li key={index}>{detail}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
