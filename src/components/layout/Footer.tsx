// @ts-ignore
import { FaGithub, FaLinkedin } from 'react-icons/fa';
import { FaTelegramPlane } from 'react-icons/fa'; // Telegram icon
import { HiOutlineMail } from 'react-icons/hi';
import { useState, useEffect } from 'react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [theme, setTheme] = useState('light');
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-social">
          </div>

          <div className="footer-copyright">
            <p>&copy; {currentYear} SentinelOps. All rights reserved.</p>
            <p>Built with React and <span className="heart">❤️</span></p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
