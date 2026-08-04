import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Inbox,
  Image as ImageIcon,
  Share2,
  CreditCard,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Zap,
  Bot,
  User as UserIcon,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { LogoLight } from '@/components/ui/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import type { LucideIcon } from 'lucide-react';

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: string };

const NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/posts', label: 'Postingan', icon: FileText },
  { to: '/app/inbox', label: 'Inbox', icon: Inbox },
  { to: '/app/auto-replies', label: 'Auto Reply', icon: Bot },
  { to: '/app/media', label: 'Media Library', icon: ImageIcon },
  { to: '/app/accounts', label: 'Akun Sosial', icon: Share2 },
  { to: '/app/billing', label: 'Billing & Paket', icon: CreditCard },
  { to: '/app/notifications', label: 'Notifikasi', icon: Bell },
  { to: '/app/settings', label: 'Pengaturan', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  const isSettings = location.pathname === '/app/settings';

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="flex h-16 items-center justify-between px-5">
        <LogoLight />
        <button className="text-slate-400 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Tutup menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-4 mb-4 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5">
        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Zap className="h-3 w-3 text-amber-400" />
          Ruang Kerja
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-white">
          {user?.fullName || user?.username || user?.email}
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-gradient-to-r from-brand-600/80 to-violet-600/60 text-white shadow-lg shadow-brand-900/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && (
              <span className="rounded-md bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Admin
            </div>
            <NavLink
              to="/app/admin"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-brand-600/80 to-violet-600/60 text-white shadow-lg shadow-brand-900/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <ShieldCheck className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1">Admin Panel</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/5"
          >
            <Avatar name={user?.fullName || user?.username || user?.email} src={user?.avatar} size="sm" />
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-white">{user?.fullName || user?.username}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
          {userMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-cardHover animate-scale-in">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{user?.fullName || user?.username}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
                <div className="mt-1.5">
                  <Badge className={user?.role === 'admin' ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}>
                    {user?.role === 'admin' ? 'Administrator' : 'Member'}
                  </Badge>
                </div>
              </div>
              <div className="my-1 h-px bg-slate-100" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-ink-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-lg sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-sm text-slate-400">Halo,</span>
              <span className="text-sm font-semibold text-slate-900">
                {user?.fullName || user?.username || 'selamat datang'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="relative" ref={headerMenuRef}>
              <button
                onClick={() => setHeaderMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 ring-1 ring-slate-200 transition hover:ring-brand-300"
                aria-label="Menu pengguna"
              >
                <Avatar name={user?.fullName || user?.username || user?.email} src={user?.avatar} size="sm" />
                <span className="hidden text-sm font-medium text-slate-700 sm:block">
                  {user?.fullName || user?.username}
                </span>
                <ChevronRight
                  className={cn('h-4 w-4 text-slate-400 transition-transform', headerMenuOpen && 'rotate-90')}
                />
              </button>
              {headerMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-cardHover animate-scale-in">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {user?.fullName || user?.username || user?.email}
                    </p>
                    <p className="truncate text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <div className="my-1 h-px bg-slate-100" />
                  {!isSettings && (
                    <>
                      <Link
                        to="/app/settings"
                        onClick={() => setHeaderMenuOpen(false)}
                        className="flex items-center gap-2 px-3.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        <UserIcon className="h-4 w-4" />
                        Profil
                      </Link>
                      <Link
                        to="/app/settings"
                        onClick={() => setHeaderMenuOpen(false)}
                        className="flex items-center gap-2 px-3.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        <Settings className="h-4 w-4" />
                        Pengaturan
                      </Link>
                    </>
                  )}
                  <div className="my-1 h-px bg-slate-100" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
