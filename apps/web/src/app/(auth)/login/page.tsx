'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, AlertCircle, Loader2, Sparkles } from 'lucide-react';

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
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  // Check for logout message from sessionStorage
  useEffect(() => {
    const message = sessionStorage.getItem('logoutMessage');
    if (message) {
      setLogoutMessage(message);
      sessionStorage.removeItem('logoutMessage');
      
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setLogoutMessage(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, []);

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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#0a0a0a] overflow-hidden">
      {/* Left Side - Image with Premium Overlay */}
      <div className="hidden lg:block lg:w-[60%] xl:w-[65%] relative bg-[#0a0a0a] overflow-hidden">
        {/* Background Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/asset/login-bg.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Animated Gold Particles Overlay */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-amber-400/30 rounded-full animate-pulse" />
          <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-amber-300/40 rounded-full animate-pulse delay-300" />
          <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-amber-500/30 rounded-full animate-pulse delay-500" />
          <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-amber-400/20 rounded-full animate-pulse delay-700" />
        </div>
        
        {/* Premium Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0a0a0a]/20 to-[#0a0a0a]" />
      </div>

      {/* Right Side - Premium Login Form */}
      <div className="flex-1 lg:w-[40%] xl:w-[35%] min-h-screen flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-[#0a0a0a] relative">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #d4a853 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
        
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-600/5 rounded-full blur-3xl" />

        <div className="w-full max-w-md relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/asset/login-bg.png"
              alt="Raho Premier Club"
              className="w-48 h-auto object-contain"
            />
          </div>

          {/* Premium Header with Icon */}
          <div className="mb-10 text-center lg:text-left">

            <h1 className="text-4xl font-bold mb-3">
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent">
                Selamat Datang
              </span>
            </h1>
            <p className="text-neutral-400 text-lg">
              Masuk ke <span className="text-amber-500/80 font-medium">Raho Premier Club</span>
            </p>
          </div>

          {/* Logout Message Alert */}
          {logoutMessage && (
            <div className="flex items-center gap-3 p-4 mb-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 text-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{logoutMessage}</span>
            </div>
          )}

          {/* Server Error Alert */}
          {serverError && (
            <div className="flex items-center gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Premium Glassmorphism Form Card */}
          <div className="p-8 rounded-3xl bg-neutral-900/50 backdrop-blur-xl border border-neutral-800/50 shadow-2xl shadow-black/20">
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-neutral-300">
                  Email
                </label>
                <div className="relative group">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nama@raho.id"
                    className={`
                      w-full px-5 py-4 rounded-xl
                      bg-neutral-800/50 border
                      text-white placeholder-neutral-500
                      transition-all duration-300
                      focus:outline-none focus:ring-2 focus:ring-amber-500/50
                      ${errors.email 
                        ? 'border-red-500/50 focus:border-red-500' 
                        : 'border-neutral-700/50 hover:border-neutral-600 focus:border-amber-500'
                      }
                    `}
                    {...register('email')}
                  />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/0 via-amber-500/0 to-amber-500/0 group-focus-within:from-amber-500/5 group-focus-within:via-amber-500/10 group-focus-within:to-amber-500/5 transition-all duration-500 pointer-events-none" />
                </div>
                {errors.email && (
                  <p className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
                    <AlertCircle size={12} />
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-neutral-300">
                  Password
                </label>
                <div className="relative group">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={`
                      w-full px-5 py-4 pr-14 rounded-xl
                      bg-neutral-800/50 border
                      text-white placeholder-neutral-500
                      transition-all duration-300
                      focus:outline-none focus:ring-2 focus:ring-amber-500/50
                      ${errors.password 
                        ? 'border-red-500/50 focus:border-red-500' 
                        : 'border-neutral-700/50 hover:border-neutral-600 focus:border-amber-500'
                      }
                    `}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all duration-200"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/0 via-amber-500/0 to-amber-500/0 group-focus-within:from-amber-500/5 group-focus-within:via-amber-500/10 group-focus-within:to-amber-500/5 transition-all duration-500 pointer-events-none" />
                </div>
                {errors.password && (
                  <p className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
                    <AlertCircle size={12} />
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Premium Submit Button */}
              <button
                type="submit"
                id="btn-login"
                disabled={isSubmitting}
                className={`
                  relative w-full flex items-center justify-center gap-3 
                  px-8 py-4 mt-8 rounded-xl
                  font-semibold text-base uppercase tracking-wider
                  transition-all duration-300 overflow-hidden
                  ${isSubmitting 
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-black hover:from-amber-400 hover:via-amber-500 hover:to-amber-500 hover:shadow-xl hover:shadow-amber-500/25 hover:-translate-y-0.5 active:translate-y-0 active:shadow-lg'
                  }
                `}
              >
                {/* Button Shine Effect */}
                {!isSubmitting && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                )}
                
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={20} />
                    <span>Masuk</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Help Text */}
          <div className="text-center mt-8">
            <p className="text-sm text-neutral-500">
              Butuh bantuan? <span className="text-amber-500/70 hover:text-amber-400 cursor-pointer transition-colors">Hubungi administrator</span>
            </p>
          </div>

          {/* Premium Footer */}
          <div className="mt-12 pt-8 border-t border-neutral-800/50">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-amber-500/60">

              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-neutral-600">
                <span>© {new Date().getFullYear()} Raho Premier Club</span>
                <span className="w-1 h-1 rounded-full bg-amber-500/30" />
                <span className="text-amber-600/50">Reverse Aging & Homeostasis</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
