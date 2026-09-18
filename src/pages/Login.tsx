import { useState, memo, type ReactNode } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets, Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle,
  ArrowLeft, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

type Mode = 'login' | 'register' | 'forgot';

function LoginScene() {
  const { user, loading, error, signInWithGoogle, signInWithMicrosoft, signInWithEmail, signUpWithEmail, resetPassword, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to={from} replace />;

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleEmailSubmit = async () => {
    setLocalError(null);
    clearError();

    if (!validateEmail(email)) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    if (mode === 'forgot') {
      setBusy('reset');
      try {
        await resetPassword(email);
        setForgotSent(true);
      } catch { /* error set by context */ } finally {
        setBusy(null);
      }
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
      if (!displayName.trim()) {
        setLocalError('Please enter your name.');
        return;
      }
      setBusy('email');
      try {
        await signUpWithEmail(email, password, displayName.trim());
        navigate(from);
      } catch { /* error set by context */ } finally {
        setBusy(null);
      }
      return;
    }

    setBusy('email');
    try {
      await signInWithEmail(email, password);
      navigate(from);
    } catch { /* error set by context */ } finally {
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    clearError();
    setBusy('google');
    try {
      await signInWithGoogle();
      navigate(from);
    } catch { /* error set by context */ } finally {
      setBusy(null);
    }
  };

  const handleMicrosoft = async () => {
    setLocalError(null);
    clearError();
    setBusy('microsoft');
    try {
      await signInWithMicrosoft();
      navigate(from);
    } catch { /* error set by context */ } finally {
      setBusy(null);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setLocalError(null);
    clearError();
    setForgotSent(false);
  };

  const displayError = localError || error;

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-900 to-primary-950">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary-600/20 blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-accent-600/20 blur-3xl"
          animate={{ x: [0, -100, 0], y: [0, -50, 0] }}
          transition={{ duration: 25, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-1/3 left-1/2 w-72 h-72 rounded-full bg-success-600/10 blur-3xl"
          animate={{ x: [0, -60, 0], y: [0, 80, 0] }}
          transition={{ duration: 18, repeat: Infinity }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Glassmorphism card */}
        <div className="bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/30 mb-4"
            >
              <Droplets className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white">TankSync</h1>
            <p className="text-sm text-white/60 mt-1">Smart Water Management System</p>
          </div>

          <AnimatePresence mode="wait">
            {forgotSent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8"
              >
                <CheckCircle2 className="w-12 h-12 text-success-400 mx-auto mb-4" />
                <p className="text-white font-medium">Password reset email sent!</p>
                <p className="text-white/60 text-sm mt-2">Check your inbox for instructions.</p>
                <button onClick={() => switchMode('login')} className="mt-6 text-primary-400 hover:text-primary-300 text-sm font-medium">
                  Back to sign in
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === 'register' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'register' ? -20 : 20 }}
                transition={{ duration: 0.2 }}
              >
                {mode !== 'forgot' && (
                  <>
                    {/* Social auth buttons */}
                    <div className="space-y-3 mb-6">
                      <SocialButton
                        onClick={handleGoogle}
                        disabled={busy !== null}
                        loading={busy === 'google'}
                        icon={<GoogleIcon />}
                        label="Continue with Google"
                      />
                      <SocialButton
                        onClick={handleMicrosoft}
                        disabled={busy !== null}
                        loading={busy === 'microsoft'}
                        icon={<MicrosoftIcon />}
                        label="Continue with Microsoft"
                      />
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                      <div className="flex-1 h-px bg-white/20" />
                      <span className="text-xs text-white/40 font-medium">OR</span>
                      <div className="flex-1 h-px bg-white/20" />
                    </div>
                  </>
                )}

                {mode === 'register' && (
                  <Field
                    icon={<User className="w-4 h-4" />}
                    placeholder="Full name"
                    value={displayName}
                    onChange={setDisplayName}
                    type="text"
                  />
                )}

                <Field
                  icon={<Mail className="w-4 h-4" />}
                  placeholder="Email address"
                  value={email}
                  onChange={setEmail}
                  type="email"
                />

                {mode !== 'forgot' && (
                  <div className="relative mt-3">
                    <Field
                      icon={<Lock className="w-4 h-4" />}
                      placeholder="Password"
                      value={password}
                      onChange={setPassword}
                      type={showPassword ? 'text' : 'password'}
                    />
                    <button
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {mode === 'register' && (
                  <div className="mt-3">
                    <Field
                      icon={<Lock className="w-4 h-4" />}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      type={showPassword ? 'text' : 'password'}
                    />
                  </div>
                )}

                {mode === 'login' && (
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-primary-400 hover:text-primary-300 font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {displayError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 flex items-start gap-2 bg-error-500/20 border border-error-500/30 rounded-xl px-4 py-3"
                  >
                    <AlertCircle className="w-4 h-4 text-error-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-error-300">{displayError}</p>
                  </motion.div>
                )}

                <button
                  onClick={handleEmailSubmit}
                  disabled={busy !== null}
                  className="btn-primary w-full mt-5 bg-gradient-to-r from-primary-500 to-accent-500 border-0"
                >
                  {busy === 'email' || busy === 'reset' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : mode === 'register' ? (
                    'Create Account'
                  ) : mode === 'forgot' ? (
                    'Send Reset Link'
                  ) : (
                    'Sign In'
                  )}
                </button>

                <div className="text-center mt-5">
                  {mode === 'login' && (
                    <p className="text-sm text-white/50">
                      Don't have an account?{' '}
                      <button onClick={() => switchMode('register')} className="text-primary-400 hover:text-primary-300 font-medium">
                        Sign up
                      </button>
                    </p>
                  )}
                  {mode === 'register' && (
                    <p className="text-sm text-white/50">
                      Already have an account?{' '}
                      <button onClick={() => switchMode('login')} className="text-primary-400 hover:text-primary-300 font-medium">
                        Sign in
                      </button>
                    </p>
                  )}
                  {mode === 'forgot' && (
                    <button onClick={() => switchMode('login')} className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 font-medium">
                      <ArrowLeft className="w-3 h-3" /> Back to sign in
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="text-center text-xs text-white/30 mt-6">
          &copy; {new Date().getFullYear()} TankSync. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}

const LoginSceneMemo = memo(LoginScene);
export default LoginSceneMemo;

function Field({ icon, placeholder, value, onChange, type }: {
  icon: ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
}) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">{icon}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all text-sm"
      />
    </div>
  );
}

function SocialButton({ onClick, disabled, loading, icon, label }: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-medium hover:bg-white/15 transition-all disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}
