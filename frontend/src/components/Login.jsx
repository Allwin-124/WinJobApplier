import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Key, ArrowRight, Settings } from 'lucide-react';
import { supabase, getSupabaseConfig, saveSupabaseConfig } from '../supabase';

export default function Login({ onAuthSuccess }) {
  const config = getSupabaseConfig();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Dynamic credentials fallback state
  const [customUrl, setCustomUrl] = useState(config.url || '');
  const [customAnonKey, setCustomAnonKey] = useState(config.anonKey || '');
  const [showConfig, setShowConfig] = useState(!config.isConfigured);
  
  // Loading & Error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleConfigSubmit = (e) => {
    e.preventDefault();
    if (!customUrl || !customAnonKey) {
      setError('Please provide both Project URL and Anon Key.');
      return;
    }
    saveSupabaseConfig(customUrl, customAnonKey);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (!supabase) {
      setError('Supabase is not initialized. Please verify configuration keys below.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        
        // Supabase behavior check: if confirm_email is off, user is logged in immediately.
        // If it's on, they need to verify email first.
        if (data?.session) {
          onAuthSuccess(data.session);
        } else {
          setSuccessMsg('Registration successful! Please check your inbox for confirmation link if email confirmation is enabled, otherwise you can sign in.');
          setIsSignUp(false);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (data?.session) {
          onAuthSuccess(data.session);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        
        {/* App Title Header */}
        <div className="auth-logo-header">
          <div className="logo-icon">W</div>
          <span className="logo-text">WinJobApplier</span>
        </div>
        
        <div className="auth-card">
          <div className="auth-tabs">
            <button 
              className={`auth-tab ${!isSignUp ? 'active' : ''}`}
              onClick={() => { setIsSignUp(false); setError(''); setSuccessMsg(''); }}
            >
              Sign In
            </button>
            <button 
              className={`auth-tab ${isSignUp ? 'active' : ''}`}
              onClick={() => { setIsSignUp(true); setError(''); setSuccessMsg(''); }}
            >
              Get Started
            </button>
          </div>

          <form onSubmit={handleAuth} className="auth-form">
            <h2>{isSignUp ? 'Create your profile' : 'Welcome back'}</h2>
            <p className="auth-subtitle">
              {isSignUp 
                ? 'Sign up to configure scraper criteria and track pipelines.' 
                : 'Log in with your email to access your job applications.'}
            </p>

            {error && (
              <div className="auth-alert auth-alert-error">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="auth-alert auth-alert-success">
                <AlertCircle size={15} />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                <Mail size={12} />
                <span>Email Address</span>
              </label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Lock size={12} />
                <span>Password</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="form-input" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', paddingRight: '36px' }}
                  required
                />
                <button 
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              <span>{loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}</span>
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>

          {/* Collapsible Supabase setup keys fallback */}
          <div className="auth-config-collapsible">
            <button 
              type="button" 
              className="config-toggle-btn"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings size={13} />
              <span>Database Connection Configuration</span>
              <span className={`config-badge ${config.isConfigured ? 'configured' : 'missing'}`}>
                {config.isConfigured ? 'Connected' : 'Action Required'}
              </span>
            </button>

            {showConfig && (
              <form onSubmit={handleConfigSubmit} className="config-form">
                <p>
                  Paste your public project credentials below. They are saved securely in your local browser's storage.
                </p>
                <div className="form-group">
                  <label className="form-label">
                    <Key size={12} />
                    <span>Supabase Project URL</span>
                  </label>
                  <input 
                    type="url" 
                    className="form-input" 
                    placeholder="https://your-ref.supabase.co"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <Key size={12} />
                    <span>Supabase Anon Public Key</span>
                  </label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="eyJhbGciOi..."
                    value={customAnonKey}
                    onChange={(e) => setCustomAnonKey(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn-secondary" style={{ width: '100%', marginTop: '6px' }}>
                  Apply Credentials
                </button>
              </form>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
