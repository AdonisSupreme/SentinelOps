import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
// @ts-ignore
import { FaArrowUp } from 'react-icons/fa';
import './ScrollToTop.css';

interface ScrollToTopProps {
  className?: string;
}

const ScrollToTop = ({ className }: ScrollToTopProps) => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button 
      className={`scroll-to-top ${className || ''}`}
      onClick={scrollToTop}
      aria-label="Scroll to top"
    >
      <FaArrowUp />
    </button>
  );
};

export default ScrollToTop;