'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

import { useAuthStore } from '@/stores/authStore';
import { loginApi } from '@/lib/authApi';
import { getApiErrorMessage, getApiErrorCode } from '@/lib/api';
import { getDefaultRoute } from '@/types/auth';

// ── Validation Schema ─────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid.'),
  password: z.string().min(6, 'Password minimal 6 karakter.'),
});

type LoginForm = z.infer<typeof loginSchema>;

// ── Component ─────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    try {
      const result = await loginApi(data.email, data.password);

      // Persist auth state
      setAuth(result.user, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      // Store minimal payload in cookie for Next.js middleware
      const cookiePayload = btoa(
        JSON.stringify({ role: result.user.role, userId: result.user.userId }),
      );
      document.cookie = `raho-auth-token=${cookiePayload}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;

      // Redirect based on role
      router.push(getDefaultRoute(result.user.role));
      router.refresh();
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === 'AUTH_RATE_LIMIT_EXCEEDED') {
        setServerError('Terlalu banyak percobaan login. Tunggu 1 menit.');
      } else {
        setServerError(getApiErrorMessage(err));
      }
    }
  };

  return (
    <>
      <div className="login-card">
        {/* Logo & Brand */}
        <div className="login-brand">
          <div className="login-logo">
            <span>R</span>
          </div>
          <div>
            <h1 className="login-title">RAHO Klinik</h1>
            <p className="login-subtitle">Sistem Manajemen Terapi Infus</p>
          </div>
        </div>

        <hr className="divider" style={{ margin: '24px 0' }} />

        <h2 className="login-heading">Masuk ke Akun</h2>
        <p className="login-desc">
          Silakan masukkan email dan password Anda
        </p>

        {/* Server Error Alert */}
        {serverError && (
          <div className="login-error-alert" role="alert">
            <AlertCircle size={16} />
            <span>{serverError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="login-form">
          {/* Email */}
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="dokter@raho.id"
              className={`form-input ${errors.email ? 'error' : ''}`}
              {...register('email')}
            />
            {errors.email && (
              <p className="form-error">
                <AlertCircle size={12} />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`form-input ${errors.password ? 'error' : ''}`}
                style={{ paddingRight: '44px' }}
                {...register('password')}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="form-error">
                <AlertCircle size={12} />
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            id="btn-login"
            className="btn btn-primary btn-full btn-lg"
            disabled={isSubmitting}
            style={{ marginTop: '8px' }}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18 }} />
                Memproses…
              </>
            ) : (
              <>
                <LogIn size={18} />
                Masuk
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="login-footer">
          © {new Date().getFullYear()} RAHO Klinik. All rights reserved.
        </p>
      </div>

      <style>{`
        .login-card {
          position: relative;
          z-index: 1;
          background: var(--surface-card);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-2xl);
          padding: 40px;
          width: 100%;
          max-width: 440px;
          box-shadow: var(--shadow-lg);
          animation: fadeIn 0.4s both;
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .login-logo {
          width: 52px;
          height: 52px;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-800));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
          flex-shrink: 0;
        }

        .login-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .login-subtitle {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .login-heading {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .login-desc {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 24px;
        }

        .login-error-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: var(--radius-md);
          color: #f87171;
          font-size: 13px;
          margin-bottom: 20px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .input-wrapper {
          position: relative;
        }

        .password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast);
        }
        .password-toggle:hover { color: var(--text-secondary); }

        .login-footer {
          text-align: center;
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 28px;
        }
      `}</style>
    </>
  );
}
