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

          <div className="footer-links">
            <a href="/">Home</a>
            <a href="/employees">Employees</a>
            <a href="/performance">Performance</a>
            <a href="/leave">Leave</a>
            <a href="/settings">Settings</a>
          </div>

          <div className="footer-copyright">
            <p>&copy; {currentYear} SmartHR. All rights reserved.</p>
            <p>Built by Adonis Shumba with React and <span className="heart">❤️</span></p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
