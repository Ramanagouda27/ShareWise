import {
  Calendar,
  ChevronDown,
  Database,
  Layers,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getDataSourceName } from '../../services/resourceService';
import { Button } from '../ui/Button';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { user, isAuthenticated, signOut, switchDemoRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const dataSource = getDataSourceName();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Explore Resources', href: '/resources' },
    { label: 'How It Works', href: '/#how-it-works' },
    ...(isAuthenticated ? [{ label: 'My Bookings', href: '/my-bookings' }] : []),
    ...(isAuthenticated && user?.role === 'owner'
      ? [{ label: 'Owner Requests', href: '/owner/requests' }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-neutral-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="ShareWise Logo"
              className="w-9 h-9 object-contain rounded-lg transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-neutral-900 group-hover:text-blue-600 transition-colors">
                ShareWise
              </span>
              <span className="text-[10px] -mt-1 font-medium text-neutral-400 tracking-wider uppercase">
                Campus Equipment
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'text-blue-600 bg-blue-50/70'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Action & Profile Area */}
          <div className="hidden md:flex items-center gap-3">
            {/* Data Source Badge (Demo reassurance) */}
            <div
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200"
              title={`Active Data Adapter: ${dataSource.toUpperCase()}`}
            >
              <Database className="w-3 h-3 text-neutral-500" />
              <span>{dataSource === 'mock' ? 'Demo Mode' : 'Live Supabase'}</span>
            </div>

            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center">
                    {user.fullName.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-neutral-800 leading-tight">
                      {user.fullName}
                    </span>
                    <span className="text-[10px] text-neutral-500 capitalize">
                      {user.role}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-neutral-200 shadow-xl py-2 z-50"
                    onMouseLeave={() => setUserDropdownOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-neutral-100">
                      <p className="text-xs font-semibold text-neutral-900">{user.fullName}</p>
                      <p className="text-[11px] text-neutral-500 truncate">{user.email}</p>
                      {user.studentId && (
                        <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                          ID: {user.studentId}
                        </p>
                      )}
                    </div>

                    <div className="py-1">
                      <Link
                        to="/my-bookings"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
                      >
                        <Calendar className="w-4 h-4 text-neutral-400" />
                        <span>My Bookings</span>
                      </Link>
                      <Link
                        to="/owner/requests"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
                      >
                        <Layers className="w-4 h-4 text-neutral-400" />
                        <span>Owner Review Dashboard</span>
                      </Link>
                    </div>

                    {/* Hackathon Role Quick-Switcher */}
                    <div className="px-4 py-2.5 border-t border-neutral-100 bg-neutral-50/60">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1.5">
                        Demo Persona Switcher
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            switchDemoRole('student');
                            setUserDropdownOpen(false);
                          }}
                          className={`flex-1 text-[11px] py-1 px-2 rounded-lg font-medium border text-center transition-all ${
                            user.role === 'student'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          Student
                        </button>
                        <button
                          onClick={() => {
                            switchDemoRole('owner');
                            setUserDropdownOpen(false);
                          }}
                          className={`flex-1 text-[11px] py-1 px-2 rounded-lg font-medium border text-center transition-all ${
                            user.role === 'owner'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          Lab Owner
                        </button>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-neutral-100">
                      <button
                        onClick={async () => {
                          setUserDropdownOpen(false);
                          await signOut();
                          navigate('/login');
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50/50"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white px-4 pt-3 pb-6 space-y-3">
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive(link.href)
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {isAuthenticated && user ? (
            <div className="pt-3 border-t border-neutral-100 space-y-2">
              <div className="px-3 py-1">
                <p className="text-xs font-semibold text-neutral-900">{user.fullName}</p>
                <p className="text-[11px] text-neutral-500">{user.email}</p>
              </div>
              <div className="flex gap-2 px-3">
                <Button
                  variant={user.role === 'student' ? 'primary' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => switchDemoRole('student')}
                >
                  Student Mode
                </Button>
                <Button
                  variant={user.role === 'owner' ? 'primary' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => switchDemoRole('owner')}
                >
                  Owner Mode
                </Button>
              </div>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-rose-600"
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await signOut();
                    navigate('/login');
                  }}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-3 border-t border-neutral-100 flex flex-col gap-2">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">
                  Sign In
                </Button>
              </Link>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" className="w-full">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
