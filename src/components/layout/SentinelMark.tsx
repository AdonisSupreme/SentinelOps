import React from 'react';
/** A shield, an S, and a forward signal in one compact vector mark. */
const SentinelMark = ({ className = '' }: { className?: string }) => (
  <svg className={`sentinel-mark ${className}`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M24 3 42 11v14c0 9-10 16-18 20C16 41 6 34 6 25V11L24 3Z" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeWidth="1.5" />
    <path d="M33 14H20l-7 10h16l-7 10H15" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    <path d="m31 29 5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="24" cy="7" r="1.5" fill="currentColor" />
  </svg>
);
export default SentinelMark;
