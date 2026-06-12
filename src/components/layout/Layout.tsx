import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Activity,
  BarChart3,
  Flame,
  Lightbulb,
  Users,
  QrCode,
  Shield,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/monitor', icon: Activity, label: 'Skeletal Monitor' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/heatmap', icon: Flame, label: 'Heatmap' },
  { to: '/recommendations', icon: Lightbulb, label: 'Action Guides' },
  { to: '/workers', icon: Users, label: 'Workers' },
  { to: '/scan', icon: QrCode, label: 'Scan' },
];

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-[#F0F4F8] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`relative flex flex-col bg-white border-r border-blue-100 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-blue-100">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-200">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col"
            >
              <span className="text-sm font-bold text-slate-800 leading-tight">
                GaitGuard
              </span>
              <span className="text-[10px] text-slate-400 leading-tight">
                PT Kideco
              </span>
            </motion.div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm shadow-blue-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon
                    className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
                      isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-blue-200 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-blue-500" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-blue-500" />
          )}
        </button>

        {/* Bottom Status */}
        {!collapsed && (
          <div className="p-3 mx-2 mb-3 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-slate-600">System Online</span>
            </div>
            <p className="text-[10px] text-slate-400">3 cameras active</p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-blue-100 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search workers, alerts..."
                className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="relative text-slate-500 hover:text-blue-600"
            >
              <Bell className="w-5 h-5" />
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center bg-red-500 text-[9px]">
                3
              </Badge>
            </Button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-200">
              <span className="text-xs font-semibold text-white">AD</span>
            </div>
          </div>
        </header>

        {/* Page Content with Transition */}
        <main className="flex-1 overflow-auto relative">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-blue-200/20 rounded-full blur-3xl pointer-events-none animate-blob" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl pointer-events-none animate-blob-delay" />
          <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-blue-300/40 rounded-full pointer-events-none" />
          <div className="absolute top-20 left-1/3 w-1.5 h-1.5 bg-blue-400/30 rounded-full pointer-events-none" />

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative z-10 p-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
