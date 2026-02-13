// src/components/auth/LoginForm.tsx
import React, { useState } from 'react';
import { FaLock, FaEnvelope, FaSignInAlt } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import '../styles/LoginPage.css';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    console.log('🔐 [LOGIN_PAGE] Form submission started');
    console.log('📧 [LOGIN_PAGE] Email:', email);
    console.log('🔑 [LOGIN_PAGE] Password length:', password.length);
    console.log('🌐 [LOGIN_PAGE] Current URL:', window.location.href);

    try {
      console.log('🚀 [LOGIN_PAGE] Calling login function...');
      await login(email, password);
      console.log('✅ [LOGIN_PAGE] Login successful!');
    } catch (err: any) {
      console.error('❌ [LOGIN_PAGE] Login error:', {
        message: err.message,
        stack: err.stack,
        response: err.response,
        status: err.response?.status,
        data: err.response?.data
      });
      
      // More specific error handling
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.status === 401) {
        setError('Invalid email or password');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else if (err.code === 'NETWORK_ERROR' || err.message?.includes('Network Error')) {
        setError('Cannot connect to server. Please check your connection.');
      } else {
        setError(`Login failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsLoading(false);
      console.log('🏁 [LOGIN_PAGE] Form submission completed');
    }
  };

  return (
    <div className="login-form">
      <div className="form-header">
        <h2>SentinelOps</h2>
        <p className='oap'>Operational Access Portal</p>
      </div>

      {error && <div className="alert error">{typeof error === 'string' ? error : JSON.stringify(error)}</div>}

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <FaEnvelope className="input-icon" />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <FaLock className="input-icon" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : (
            <>
              <FaSignInAlt /> Sign In
            </>
          )}
        </button>
      </form>

      <p style={{ marginTop: '1rem' }}>
        Forgot password? <Link to="/signup">reset</Link>
      </p>
    </div>
  );
};

export default LoginForm;
