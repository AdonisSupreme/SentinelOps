/* src/styles/theme.ts */
import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  :root {
    /* Light Theme Variables (already defined) */
  }

  [data-theme="dark"] {
    /* Dark Theme Variables (already defined) */
  }

  /* Add specific styles for new components */
  .login-form {
    background: var(--color-surface);
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-xl);
    max-width: 450px;
    margin: 0 auto;
    box-shadow: var(--shadow-lg);
    
    .form-header {
      text-align: center;
      margin-bottom: var(--spacing-lg);
      
      h2 {
        color: var(--color-primary);
        margin-bottom: var(--spacing-sm);
      }
    }
    
    .input-group {
      position: relative;
      margin-bottom: var(--spacing-md);
      
      .input-icon {
        position: absolute;
        left: var(--spacing-md);
        top: 50%;
        transform: translateY(-50%);
        color: var(--color-text-secondary);
      }
      
      input {
        width: 100%;
        padding: var(--spacing-md) var(--spacing-md) var(--spacing-md) calc(var(--spacing-md) * 2 + 1em);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        background: var(--color-surface-alt);
        color: var(--color-text);
        transition: border-color var(--transition-fast);
        
        &:focus {
          border-color: var(--color-primary);
          outline: none;
        }
      }
    }
    
    .btn-primary {
      width: 100%;
      padding: var(--spacing-md);
    }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
    
    .stat-card {
      background: var(--color-surface);
      border-radius: var(--border-radius-md);
      padding: var(--spacing-lg);
      display: flex;
      align-items: center;
      box-shadow: var(--shadow-md);
      transition: transform var(--transition-fast);
      
      &:hover {
        transform: translateY(-5px);
      }
      
      .stat-icon {
        font-size: 1.5rem;
        margin-right: var(--spacing-md);
        color: var(--color-primary);
      }
      
      .stat-content {
        flex: 1;
        
        h3 {
          margin: 0;
          font-size: 1.8rem;
        }
        
        p {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 0.9rem;
        }
      }
      
      .stat-change {
        font-weight: bold;
        font-size: 1.2rem;
        
        &.positive {
          color: var(--color-success);
        }
        
        &.negative {
          color: var(--color-error);
        }
      }
    }
  }

  /* Notification styles */
  .notification-container {
    position: fixed;
    top: var(--spacing-md);
    right: var(--spacing-md);
    z-index: 1000;
    max-width: 350px;
  }
  
  .notification {
    display: flex;
    align-items: flex-start;
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-sm);
    border-radius: var(--border-radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-lg);
    cursor: pointer;
    transition: transform 0.3s ease;
    border-left: 4px solid;
    
    &:hover {
      transform: translateX(-5px);
    }
    
    &.info {
      border-left-color: var(--color-primary);
      .notification-icon { color: var(--color-primary); }
    }
    
    &.success {
      border-left-color: var(--color-success);
      .notification-icon { color: var(--color-success); }
    }
    
    &.warning {
      border-left-color: var(--color-warning);
      .notification-icon { color: var(--color-warning); }
    }
    
    &.error {
      border-left-color: var(--color-error);
      .notification-icon { color: var(--color-error); }
    }
    
    .notification-icon {
      font-size: 1.2rem;
      margin-right: var(--spacing-md);
      flex-shrink: 0;
    }
    
    .notification-content {
      flex: 1;
      font-size: 0.9rem;
    }
  }
`;