import SentinelMark from './SentinelMark';
import './Footer.css';
const Footer = () => (
  <footer className="sentinel-footer">
    <div className="sentinel-footer-inner">
      <div className="sentinel-footer-identity"><SentinelMark /><span>Sentinel<span>Ops</span></span></div>
      <p className="sentinel-footer-motto">Clarity. Continuity. Control.</p>
      <span className="sentinel-footer-copyright">© {new Date().getFullYear()} SentinelOps</span>
      <button type="button" className="sentinel-footer-top" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} aria-label="Back to top">↑</button>
    </div>
  </footer>
);
export default Footer;
