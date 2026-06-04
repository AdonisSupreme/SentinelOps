import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
// @ts-ignore
import { FaArrowDown, FaArrowUp } from 'react-icons/fa';
import './ScrollToTop.css';

interface ScrollToTopProps {
  className?: string;
}

const SCROLL_TOP_THRESHOLD = 260;
const SCROLL_BOTTOM_THRESHOLD = 180;

const ScrollToTop = ({ className }: ScrollToTopProps) => {
  const { pathname } = useLocation();
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const updateScrollState = useCallback(() => {
    const scrollTop = window.scrollY || window.pageYOffset || 0;
    const scrollHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const remaining = scrollHeight - viewportHeight - scrollTop;
    const hasScrollablePage = scrollHeight > viewportHeight + 320;

    setShowTop(scrollTop > SCROLL_TOP_THRESHOLD);
    setShowBottom(hasScrollablePage && scrollTop < SCROLL_BOTTOM_THRESHOLD && remaining > 320);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.requestAnimationFrame(updateScrollState);
  }, [pathname, updateScrollState]);

  useEffect(() => {
    let frameId = 0;

    const handleViewportChange = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(updateScrollState);
    };

    handleViewportChange();
    window.addEventListener('scroll', handleViewportChange, { passive: true });
    window.addEventListener('resize', handleViewportChange);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [updateScrollState]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  if (!showTop && !showBottom) {
    return null;
  }

  return (
    <div className={`scroll-navigator ${className || ''}`.trim()} aria-hidden="true">
      {showBottom ? (
        <button
          type="button"
          className="scroll-nav-btn scroll-nav-btn-bottom"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <FaArrowDown />
        </button>
      ) : null}

      {showTop ? (
        <button
          type="button"
          className="scroll-nav-btn scroll-nav-btn-top"
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <FaArrowUp />
        </button>
      ) : null}
    </div>
  );
};

export default ScrollToTop;
