'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import {
  LayoutDashboard, Syringe, Package,
  FileText, LogOut, Menu, X, User, Sun, Moon,
} from 'lucide-react'
import { logoutApi } from '@/lib/authApi'
import { Footer } from '@/components/layout/Footer'
import { useThemeStore } from '@/stores/themeStore'
import { api } from '@/lib/api'
import { meApi } from '@/lib/api/meApi'

const NAV_ITEMS = [
  { href: '/me/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/me/sessions', label: 'Sesi Terapi', icon: Syringe },
  { href: '/me/vouchers', label: 'Paket & Voucher', icon: Package },
  { href: '/me/invoices', label: 'Invoice', icon: FileText },
]

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, refreshToken, clearAuth, updateUserAvatar } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [avatarBlobUrl, setAvatarBlobUrl] = useState<string | null>(null)
  const avatarFetchedRef = useRef(false)

  // Load avatar with authentication
  const loadAvatar = useCallback(async (avatarUrl: string) => {
    try {
      // Extract file path from URL
      let filePath = avatarUrl
      if (avatarUrl.startsWith('http')) {
        const urlObj = new URL(avatarUrl)
        filePath = urlObj.pathname
      }
      // Clean up the path - handle various URL formats
      // Remove leading slash
      filePath = filePath.replace(/^\//, '')
      // Remove api/v1/files/ prefix
      filePath = filePath.replace(/^api\/v1\/files\//, '')
      // Remove files/ prefix
      filePath = filePath.replace(/^files\//, '')
      // If path starts with a bucket name (not 'uploads'), remove it
      // MinIO URLs: /bucket-name/uploads/... -> uploads/...
      if (!filePath.startsWith('uploads/') && !filePath.startsWith('session-photos/')) {
        const parts = filePath.split('/')
        if (parts.length > 1 && (parts[1] === 'uploads' || parts[1] === 'session-photos')) {
          filePath = parts.slice(1).join('/')
        }
      }
      
      const response = await api.get(`/files/${filePath}`, { responseType: 'blob' })
      const blobUrl = URL.createObjectURL(response.data)
      setAvatarBlobUrl(blobUrl)
    } catch (error) {
      console.error('Failed to load avatar:', error)
      setAvatarBlobUrl(null)
    }
  }, [])

  // Fetch avatar from profile if not in auth store
  const fetchAvatarFromProfile = useCallback(async () => {
    if (avatarFetchedRef.current) return
    avatarFetchedRef.current = true
    
    try {
      const profile = await meApi.getProfile()
      if (profile.avatarUrl) {
        // Update auth store so it persists
        updateUserAvatar(profile.avatarUrl)
        loadAvatar(profile.avatarUrl)
      }
    } catch (error) {
      console.error('Failed to fetch profile for avatar:', error)
    }
  }, [loadAvatar, updateUserAvatar])

  useEffect(() => {
    if (!user) {
      router.replace('/login')
    } else if (user.avatarUrl) {
      loadAvatar(user.avatarUrl)
    } else {
      // If no avatarUrl in auth store, fetch from profile API
      fetchAvatarFromProfile()
    }
  }, [user, router, loadAvatar, fetchAvatarFromProfile])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (avatarBlobUrl) {
        URL.revokeObjectURL(avatarBlobUrl)
      }
    }
  }, [avatarBlobUrl])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await logoutApi(refreshToken)
      }
    } catch (error) {
      console.error('Logout API error:', error)
    } finally {
      clearAuth()
      document.cookie = 'raho-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      sessionStorage.setItem('logoutMessage', 'Anda telah berhasil logout.')
      window.location.href = '/login'
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-[#0a0a0a]">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-4">
            {/* Brand */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Image
                src="/asset/logo_tab_RAHO.png"
                alt="RAHO Logo"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <div className="hidden sm:block">
                <div className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">
                  RAHO Premier
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">
                  Portal Member
                </div>
              </div>
            </div>

            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                  <button
                    key={href}
                    onClick={() => router.push(href)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                      transition-all duration-200
                      ${active
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white border border-transparent'
                      }
                    `}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"
                title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* Profile Button - Desktop */}
              <button
                onClick={() => router.push('/me/profile')}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {avatarBlobUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarBlobUrl}
                    alt={user?.fullName || 'Avatar'}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-semibold text-sm">
                    {user?.fullName?.[0]?.toUpperCase() ?? 'M'}
                  </div>
                )}
                <div className="text-left">
                  <div className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight truncate max-w-[120px]">
                    {user?.fullName ?? 'Member'}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">
                    Member
                  </div>
                </div>
              </button>

              {/* Divider - Desktop */}
              <div className="hidden sm:block w-px h-6 bg-neutral-200 dark:bg-neutral-700" />

              {/* Logout Button - Desktop */}
              <button
                onClick={handleLogout}
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors text-sm font-medium"
              >
                <LogOut size={16} />
                <span>Keluar</span>
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="px-4 py-4 space-y-2">
              {/* User Info - Mobile */}
              <button
                onClick={() => router.push('/me/profile')}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {avatarBlobUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarBlobUrl}
                    alt={user?.fullName || 'Avatar'}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-semibold">
                    {user?.fullName?.[0]?.toUpperCase() ?? 'M'}
                  </div>
                )}
                <div className="text-left flex-1">
                  <div className="font-semibold text-neutral-900 dark:text-white">
                    {user?.fullName ?? 'Member'}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    Lihat Profil
                  </div>
                </div>
                <User size={18} className="text-neutral-400" />
              </button>

              {/* Nav Items - Mobile */}
              <div className="pt-2 space-y-1">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href
                  return (
                    <button
                      key={href}
                      onClick={() => router.push(href)}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left
                        transition-all duration-200
                        ${active
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }
                      `}
                    >
                      <Icon size={20} />
                      <span className="font-medium">{label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Logout - Mobile */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={20} />
                  <span className="font-medium">Keluar</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
