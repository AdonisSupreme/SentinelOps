/* styles/GlobalStyles.ts */
import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  /* =============== */
  /* Font Imports */
  /* =============== */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

  /* =============== */
  /* Global Variables */
  /* =============== */
  :root {
    /* Color Palette - Light Theme */
    --primary-color: linear-gradient(to right, #0717ff, #ff00aa, #00ccff);
    --secondary-color: #4d44db;
    --text-color: #0e0d0d;
    --text-light: #300622;
    --bg-color: whitesmoke;
    --card-bg: #ffffff;
    --shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    --transition: all 0.3s ease;
    --app: rgb(4, 94, 129);
    --adonis: whitesmoke;
    --border: #ff00aa;
    
    /* New Futuristic Variables */
    --neon-blue: #012a34ff;
    --neon-pink: #828282d0;
    --neon-purple: #8a2be2;
    --cyber-green: #00ff9d;
    --matrix-green: #00ff41;
    --hologram-blue: rgba(255, 255, 255, 0.3);
    --hologram-pink: rgba(0, 0, 0, 0.3);
    
    /* Spacing */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;
    --spacing-xxl: 48px;
    
    /* Typography */
    --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-family-heading: 'Space Mono', monospace;
    --font-size-base: 16px;
    --font-size-sm: 14px;
    --font-size-md: 18px;
    --font-size-lg: 24px;
    --font-size-xl: 32px;
    --font-size-xxl: 48px;
    
    /* Shadows */
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
    --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
    --shadow-neon: 0 0 10px var(--neon-blue), 0 0 20px var(--neon-pink);
    --shadow-inset: inset 0 2px 4px rgba(0,0,0,0.05);
    
    /* Borders */
    --border-radius-sm: 4px;
    --border-radius-md: 8px;
    --border-radius-lg: 16px;
    --border-radius-full: 999px;
    --border-glow: 1px solid rgba(0, 204, 255, 0.5);
    
    /* Transitions */
    --transition-fast: 0.15s ease;
    --transition-medium: 0.3s ease;
    --transition-slow: 0.5s ease;
    --transition-neon: 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    
    /* Z-index */
    --z-index-modal: 1000;
    --z-index-dropdown: 500;
    --z-index-tooltip: 300;
    --z-index-header: 100;
  }

  /* Dark Theme Overrides */
  [data-theme="dark"] {
    --primary-color: #0051ff;
    --secondary-color: #021131;
    --text-color: #f0f0f0;
    --text-light: #bbb;
    --bg-color: #121212;
    --card-bg: #1e1e1e;
    --shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    --app: rgb(6, 1, 22);
    
    /* Adjust shadows for dark mode */
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.3);
    --shadow-lg: 0 10px 15px rgba(0,0,0,0.3);
    --shadow-neon: 0 0 15px var(--neon-blue), 0 0 30px var(--neon-pink);
  }

  /* ============= */
  /* Base Styles */
  /* ============= */
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: var(--font-family);
    color: var(--text-color);
    background-color: var(--bg-color);
    transition: background-color var(--transition-medium), 
                color var(--transition-medium);
    line-height: 1.6;
    overflow-x: hidden;
    position: relative;
    
    &::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: 
        radial-gradient(circle at 10% 20%, var(--hologram-blue) 0%, transparent 20%),
        radial-gradient(circle at 90% 80%, var(--hologram-pink) 0%, transparent 20%);
      pointer-events: none;
      z-index: -1;
      opacity: 0.1;
    }
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-family-heading);
    font-weight: 700;
    letter-spacing: -0.03em;
    background: var(--primary-color);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    position: relative;
    display: inline-block;
    
    &::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 0;
      width: 50%;
      height: 3px;
      background: var(--primary-color);
      border-radius: 2px;
    }
  }

  a {
    color: var(--neon-blue);
    text-decoration: none;
    transition: var(--transition);
    position: relative;
    
    &:hover {
      color: var(--neon-pink);
      text-shadow: 0 0 8px rgba(255, 0, 170, 0.5);
      
      &::after {
        width: 100%;
        left: 0;
      }
    }
    
    &::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 50%;
      width: 0;
      height: 2px;
      background: var(--neon-pink);
      transition: var(--transition-fast);
    }
  }

  /* ============= */
  /* Layout Components */
  /* ============= */
  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 var(--spacing-lg);
    position: sticky;
    top: 0;
    z-index: var(--z-index-header);
    background-color: rgba(242, 244, 248, 0.65);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    border-bottom: 1px solid var(--neon-blue);
    box-shadow: var(--shadow-neon);
    height: 56px;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, var(--neon-blue), var(--neon-pink));
      background-size: 200% auto;
      animation: gradientFlow 6s linear infinite;
    }

    
    .header-left, .header-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-lg);
    }
    
    .user-menu {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      position: relative;
      cursor: pointer;
      
      .user-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--neon-blue), var(--neon-pink));
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        box-shadow: var(--shadow-neon);
        
        .avatar-initials {
          font-size: 1.2rem;
          color: white;
        }
      }
      
      .user-info {
        display: flex;
        flex-direction: column;
        
        .user-name {
          font-weight: 600;
          color: white;
        }
        
        .user-role {
          font-size: 0.8rem;
          color: var(--neon-blue);
        }
      }
      
      .dropdown-menu {
        position: absolute;
        top: 100%;
        right: 0;
        background: var(--card-bg);
        box-shadow: var(--shadow-lg);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-sm);
        min-width: 200px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px);
        transition: all var(--transition-fast);
        border: var(--border-glow);
        z-index: var(--z-index-dropdown);
        
        button, a {
          width: 100%;
          text-align: left;
          padding: var(--spacing-sm);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-color);
          display: block;
          border-radius: var(--border-radius-sm);
          transition: var(--transition-fast);
          
          &:hover {
            background: rgba(0, 204, 255, 0.1);
            color: var(--neon-blue);
            transform: translateX(5px);
          }
        }
      }
      
      &:hover .dropdown-menu {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
        color: whitesmoke;
      }
    }
  }
  
  /* Add the animation for gradient flow */
  @keyframes gradientFlow {
    0% { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
  }

  /* Dark theme specific header styles */
  [data-theme="dark"] .app-header {
    background-color: rgba(6, 1, 22, 0.85);
    border-bottom-color: var(--neon-purple);
    box-shadow: 0 0 15px rgba(88, 43, 226, 0.5);
  }

  .container {
    width: 100%;
    padding: 0 var(--spacing-md);
  }

  .section {
    padding: var(--spacing-xxl) 0;
    position: relative;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: 
        linear-gradient(45deg, 
          transparent 0%, 
          rgba(0, 204, 255, 0.05) 30%, 
          rgba(255, 0, 170, 0.05) 70%, 
          transparent 100%);
      pointer-events: none;
      z-index: -1;
    }
  }

  .section-title {
    font-size: var(--font-size-xxl);
    margin-bottom: var(--spacing-xl);
    position: relative;
    display: inline-block;
    
    &::after {
      content: '';
      position: absolute;
      bottom: -12px;
      left: 0;
      width: 70%;
      height: 4px;
      background: var(--primary-color);
      border-radius: 2px;
      animation: pulse 2s infinite;
    }
  }

  /* ============= */
  /* Animations */
  /* ============= */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(0, 204, 255, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(0, 204, 255, 0); }
    100% { box-shadow: 0 0 0 0 rgba(0, 204, 255, 0); }
  }

  @keyframes hologram {
    0% { opacity: 0.1; }
    50% { opacity: 0.3; }
    100% { opacity: 0.1; }
  }

  .fade-in {
    animation: fadeIn 0.5s ease forwards;
  }

  /* ============= */
  /* UI Components */
  /* ============= */

  /* Notification System */
  .notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: var(--z-index-modal);
    max-width: 350px;
  }

  .notification {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    margin-bottom: 10px;
    border-radius: 4px;
    box-shadow: var(--shadow-lg);
    color: white;
    animation: slideIn 0.3s ease-out;
    background: rgba(30, 30, 46, 0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 204, 255, 0.3);
    position: relative;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: var(--neon-blue);
    }
  }

  .notification-icon {
    margin-right: 10px;
    font-size: 1.2rem;
  }

  .notification-content {
    flex: 1;
  }

  .notification-close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    margin-left: 10px;
    transition: var(--transition);
    
    &:hover {
      transform: scale(1.2);
      color: var(--neon-pink);
    }
  }

  .notification.info {
    background: rgba(4, 94, 129, 0.9);
    &::before { background: var(--neon-blue); }
  }

  .notification.success {
    background: rgba(0, 128, 0, 0.9);
    &::before { background: var(--matrix-green); }
  }

  .notification.warning {
    background: rgba(204, 153, 0, 0.9);
    &::before { background: var(--cyber-green); }
  }

  .notification.error {
    background: rgba(178, 34, 34, 0.9);
    &::before { background: var(--neon-pink); }
  }

  .theme-toggle button.active {
    transform: scale(1.1);
    box-shadow: 0 0 0 2px var(--neon-blue);
    animation: pulse 1.5s infinite;
  }

  /* Buttons */
  .btn {
    display: inline-block;
    padding: 12px 32px;
    background: var(--primary-color);
    color: white;
    border-radius: var(--border-radius-md);
    font-weight: 600;
    transition: var(--transition);
    border: none;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    font-family: var(--font-family-heading);
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: var(--font-size-sm);
    box-shadow: var(--shadow-md);
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: var(--transition-slow);
    }
    
    &:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-neon);
      
      &::before {
        left: 100%;
      }
    }

    &-outline {
      background: transparent;
      border: 2px solid;
      border-image: var(--primary-color);
      border-image-slice: 1;
      color: var(--neon-blue);
      background: rgba(0, 0, 0, 0.2);
      
      &:hover {
        background: rgba(0, 204, 255, 0.1);
        color: white;
      }
    }
  }

  /* Forms */
  .form-group {
    margin-bottom: var(--spacing-lg);
    
    label {
      display: block;
      margin-bottom: var(--spacing-sm);
      font-weight: 500;
      color: var(--neon-blue);
      text-transform: uppercase;
      letter-spacing: 1px;
      font-size: var(--font-size-sm);
    }
    
    input, select, textarea {
      width: 100%;
      padding: var(--spacing-md);
      border: 1px solid rgba(0, 204, 255, 0.3);
      border-radius: var(--border-radius-md);
      background: rgba(30, 30, 46, 0.2);
      color: var(--text-color);
      font-family: var(--font-family);
      transition: var(--transition);
      backdrop-filter: blur(5px);
      
      &:focus {
        outline: none;
        border-color: var(--neon-blue);
        box-shadow: 0 0 0 2px rgba(0, 204, 255, 0.3);
      }
    }
  }

  /* Cards */
  .card {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-md);
    transition: var(--transition);
    border: var(--border-glow);
    backdrop-filter: blur(5px);
    background: rgba(30, 30, 46, 0.5);
    
    &:hover {
      transform: translateY(-5px);
      box-shadow: var(--shadow-neon);
    }
  }

  /* Tabs */
  .tabs-container {
    margin-top: var(--spacing-lg);
    
    .tabs-header {
      display: flex;
      border-bottom: 1px solid rgba(0, 204, 255, 0.3);
      
      .tab {
        padding: var(--spacing-md) var(--spacing-lg);
        background: none;
        border: none;
        cursor: pointer;
        position: relative;
        color: var(--text-light);
        font-weight: 500;
        transition: var(--transition);
        letter-spacing: 1px;
        
        &:hover {
          color: var(--neon-blue);
        }
        
        &.active {
          color: var(--neon-blue);
          font-weight: 600;
          
          &::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--primary-color);
            border-radius: 2px 2px 0 0;
            animation: pulse 2s infinite;
          }
        }
      }
    }
    
    .tabs-content {
      padding: var(--spacing-lg) 0;
    }
  }

  /* ============= */
  /* Footer */
  /* ============= */
  .footer {
    padding: var(--spacing-xl) 0;
    backdrop-filter: blur(8px);
    box-shadow: var(--shadow-neon);
    position: relative;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 1px;
      background: linear-gradient(90deg, var(--neon-blue), var(--neon-pink));
      background-size: 200% auto;
      animation: gradientFlow 6s linear infinite;
    }
  }

  .footer-links {
    display: flex;
    justify-content: center;
    gap: var(--spacing-xl);
    margin-bottom: var(--spacing-lg);
    
    a {
      color: var(--text-light);
      font-weight: 500;
      font-size: 1.1rem;
      text-decoration: none;
      transition: var(--transition);
      position: relative;
      padding: 5px 0;
      
      &:hover {
        color: var(--neon-blue);
        
        &::after {
          width: 100%;
        }
      }
      
      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 0;
        height: 2px;
        background: var(--neon-blue);
        transition: var(--transition);
      }
    }
  }

  .social-icons {
    display: flex;
    justify-content: center;
    gap: var(--spacing-lg);
    margin-top: var(--spacing-md);
    
    .social-icon {
      font-size: 1.8rem;
      color: var(--text-light);
      transition: var(--transition);
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      border: 1px solid rgba(0, 204, 255, 0.3);
      
      &:hover {
        color: var(--neon-blue);
        transform: translateY(-5px);
        box-shadow: var(--shadow-neon);
        border-color: var(--neon-blue);
      }
    }
  }

  /* ============= */
  /* Page Styles */
  /* ============= */

  /* Dashboard */
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-lg);
    margin-top: var(--spacing-md);
  }

  /* Login Page */
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: 
      radial-gradient(circle at top left, var(--neon-purple), transparent 30%),
      radial-gradient(circle at bottom right, var(--neon-pink), transparent 30%),
      var(--bg-color);
  }

  .login-card {
    width: 100%;
    max-width: 400px;
    padding: var(--spacing-xl);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-lg);
    background: rgba(30, 30, 46, 0.8);
    backdrop-filter: blur(10px);
    border: var(--border-glow);
  }

  /* Not Found Page */
  .not-found-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
    background: 
      radial-gradient(circle at center, var(--neon-blue), transparent 70%),
      var(--bg-color);
    
    h1 {
      font-size: 6rem;
      margin-bottom: var(--spacing-md);
    }
  }

   /* Buttons */
  button {
    font-family: inherit;
    font-size: inherit;
    background: none;
    border: none;
    cursor: pointer;
  }

  /* Scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: var(--bg-secondary);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--primary);
  }

  /* Animations */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* Utility Classes */
  .glass-effect {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .gradient-text {
    background: var(--primary-gradient);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .pulse {
    animation: pulse 2s infinite;
  }

  .glow {
    box-shadow: 0 0 20px rgba(0, 217, 255, 0.3);
  }

  /* Loading States */
  .skeleton {
    background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-hover) 50%, var(--bg-secondary) 75%);
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
  }

  @keyframes loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }


  /* ============= */
  /* Responsive Adjustments */
  /* ============= */
  @media (max-width: 768px) {
    .app-header {
      flex-direction: column;
      padding: 0 var(--spacing-md);
      gap: var(--spacing-md);
      
      .header-center {
        order: -1;
      }
    }
    
    .section {
      padding: var(--spacing-xl) 0;
    }
    
    .section-title {
      font-size: var(--font-size-xl);
    }
    
    .footer-links {
      flex-wrap: wrap;
      gap: var(--spacing-md);
    }
  }
`;