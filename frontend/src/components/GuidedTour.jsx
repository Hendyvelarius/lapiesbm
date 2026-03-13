import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/GuidedTour.css';

const EDGE_MARGIN = 16;
const BUBBLE_WIDTH = 360;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function GuidedTour({
  isOpen,
  steps = [],
  currentStepIndex = 0,
  onNext,
  onPrev,
  onClose
}) {
  const highlightedElementRef = useRef(null);
  const bubbleRef = useRef(null);
  const hasInitialScrollRef = useRef(false);
  const rafUpdateRef = useRef(null);
  const [targetRect, setTargetRect] = useState(null);
  const [bubbleHeight, setBubbleHeight] = useState(260);

  const currentStep = steps[currentStepIndex] || null;
  const paragraphs = currentStep?.paragraphs || (currentStep?.content ? [currentStep.content] : []);
  const bullets = currentStep?.bullets || [];

  const overlaySegments = useMemo(() => {
    if (!targetRect) return [];

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const top = Math.max(0, targetRect.top - 10);
    const left = Math.max(0, targetRect.left - 10);
    const right = Math.min(viewportWidth, targetRect.left + targetRect.width + 10);
    const bottom = Math.min(viewportHeight, targetRect.top + targetRect.height + 10);

    return [
      {
        top: 0,
        left: 0,
        width: viewportWidth,
        height: top
      },
      {
        top,
        left: 0,
        width: left,
        height: Math.max(0, bottom - top)
      },
      {
        top,
        left: right,
        width: Math.max(0, viewportWidth - right),
        height: Math.max(0, bottom - top)
      },
      {
        top: bottom,
        left: 0,
        width: viewportWidth,
        height: Math.max(0, viewportHeight - bottom)
      }
    ];
  }, [targetRect]);

  useEffect(() => {
    hasInitialScrollRef.current = false;
  }, [currentStepIndex, isOpen]);

  useEffect(() => {
    if (!isOpen || !bubbleRef.current) return undefined;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const rect = entries[0].contentRect;
      const nextHeight = Math.round(rect.height || 260);
      setBubbleHeight((prev) => (Math.abs(prev - nextHeight) >= 1 ? nextHeight : prev));
    });

    observer.observe(bubbleRef.current);
    return () => observer.disconnect();
  }, [isOpen, currentStepIndex]);

  useEffect(() => {
    if (!isOpen || !currentStep) return undefined;

    let rafId = null;
    let mutationObserver = null;
    let isDisposed = false;

    const setRectIfChanged = (nextRect) => {
      setTargetRect((prev) => {
        if (
          prev &&
          Math.abs(prev.top - nextRect.top) < 1 &&
          Math.abs(prev.left - nextRect.left) < 1 &&
          Math.abs(prev.width - nextRect.width) < 1 &&
          Math.abs(prev.height - nextRect.height) < 1
        ) {
          return prev;
        }
        return nextRect;
      });
    };

    const updateTarget = () => {
      if (isDisposed) return;
      const selector = currentStep.selector;
      const element = selector ? document.querySelector(selector) : null;

      if (highlightedElementRef.current && highlightedElementRef.current !== element) {
        highlightedElementRef.current.classList.remove('guided-tour-active-target');
      }

      if (!element) {
        highlightedElementRef.current = null;
        setTargetRect((prev) => (prev ? null : prev));
        return;
      }

      if (highlightedElementRef.current !== element) {
        highlightedElementRef.current = element;
        highlightedElementRef.current.classList.add('guided-tour-active-target');
      }

      if (!hasInitialScrollRef.current) {
        hasInitialScrollRef.current = true;
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }

      const rect = element.getBoundingClientRect();
      setRectIfChanged({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    };

    const scheduleUpdate = () => {
      if (isDisposed) return;
      if (rafUpdateRef.current) cancelAnimationFrame(rafUpdateRef.current);
      rafUpdateRef.current = requestAnimationFrame(updateTarget);
    };

    rafId = requestAnimationFrame(updateTarget);

    mutationObserver = new MutationObserver(() => {
      scheduleUpdate();
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);

    return () => {
      isDisposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (rafUpdateRef.current) cancelAnimationFrame(rafUpdateRef.current);
      if (mutationObserver) mutationObserver.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
      if (highlightedElementRef.current) {
        highlightedElementRef.current.classList.remove('guided-tour-active-target');
      }
    };
  }, [isOpen, currentStep]);

  const bubbleStyle = useMemo(() => {
    if (!targetRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const desiredLeft = targetRect.left + targetRect.width / 2 - BUBBLE_WIDTH / 2;
    const left = clamp(desiredLeft, EDGE_MARGIN, viewportWidth - BUBBLE_WIDTH - EDGE_MARGIN);

    const belowTop = targetRect.top + targetRect.height + 18;
    const desiredTop = belowTop + bubbleHeight > viewportHeight
      ? targetRect.top - bubbleHeight - 18
      : belowTop;
    const top = clamp(desiredTop, EDGE_MARGIN, viewportHeight - bubbleHeight - EDGE_MARGIN);

    return {
      top,
      left,
      transform: 'none'
    };
  }, [targetRect, bubbleHeight]);

  if (!isOpen || !currentStep) return null;

  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === steps.length - 1;

  return (
    <div className="guided-tour-root" role="dialog" aria-modal="true" aria-label="Page help tour">
      {targetRect ? (
        overlaySegments.map((segment, index) => (
          <div
            key={index}
            className="guided-tour-overlay-segment"
            style={{
              top: `${segment.top}px`,
              left: `${segment.left}px`,
              width: `${segment.width}px`,
              height: `${segment.height}px`
            }}
            onClick={onClose}
          />
        ))
      ) : (
        <div className="guided-tour-overlay" onClick={onClose} />
      )}

      {targetRect && (
        <div
          className="guided-tour-highlight"
          style={{
            top: `${targetRect.top - 8}px`,
            left: `${targetRect.left - 8}px`,
            width: `${targetRect.width + 16}px`,
            height: `${targetRect.height + 16}px`
          }}
        />
      )}

      <div ref={bubbleRef} className="guided-tour-bubble" style={bubbleStyle}>
        <div className="guided-tour-badge">
          Help Guide {currentStepIndex + 1}/{steps.length}
        </div>
        <h4>{currentStep.title}</h4>
        <div className="guided-tour-content">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          {bullets.length > 0 && (
            <ul>
              {bullets.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
        </div>
        {currentStep.watchOut && <p className="guided-tour-watchout">Perhatian: {currentStep.watchOut}</p>}

        <div className="guided-tour-actions">
          <button type="button" className="guided-tour-btn ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="guided-tour-btn ghost" onClick={onPrev} disabled={isFirst}>
            Back
          </button>
          <button type="button" className="guided-tour-btn primary" onClick={onNext}>
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
