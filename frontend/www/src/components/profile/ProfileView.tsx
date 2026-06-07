'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  MapPin,
  LogOut,
  Camera,
  Briefcase,
  Settings,
  CheckCircle,
  ArrowRight,
  Plus,
  Star,
} from 'lucide-react';
import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { profileAvatarSrc } from '@/lib/profile/avatar';

export default function ProfileView() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'listings' | 'reviews'
  >('overview');

  const handleLogout = async () => {
    await logout();
    router.push('/home');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-3">
        <div className="text-center">
          <User className="w-12 h-12 mx-auto text-[color:var(--app-text-soft)] mb-3" />
          <p className="text-[color:var(--app-text)] text-sm mb-4">
            Please login to view your profile
          </p>
          <Link
            href="/login"
            className="inline-block h-10 px-5 bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] rounded-xl text-sm font-semibold active:scale-95 transition-transform"
          >
            Login
          </Link>
        </div>
      </div>
    );
  }

  // Check if user is freelancer (will come from API metadata)
  const isFreelancer = false; // TODO: Check user.metadata?.roles?.includes('freelancer')

  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] main-with-bottom-nav">
      {/* Hero/Cover Section */}
      <div className="relative h-24 sm:h-28 bg-gradient-to-r from-[color:var(--app-accent)] to-[color:var(--app-accent-strong)] dark:from-[color:var(--app-accent-strong)] dark:to-[color:var(--app-accent-strong)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,255,255,0.15),transparent)]" />
      </div>

      {/* Profile Header */}
      <div className="relative max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 -mt-12 sm:-mt-14">
        <div className="bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] rounded-2xl shadow-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24">
                <Image
                  src={profileAvatarSrc(user.avatarUrl)}
                  alt={user.username || 'User'}
                  width={96}
                  height={96}
                  className="w-full h-full rounded-xl object-cover border-2 border-[color:var(--app-text-inverse)] dark:border-[color:var(--app-border-strong)] shadow-lg"
                />
                <button className="absolute bottom-0 right-0 p-1.5 bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] rounded-lg shadow-lg active:scale-95 transition-transform">
                  <Camera className="w-3 h-3" />
                </button>
              </div>
              {user.emailVerified && (
                <div className="absolute -top-1 -right-1 p-1 bg-[color:var(--app-info)] rounded-full shadow-lg">
                  <CheckCircle className="w-3 h-3 text-[color:var(--app-text-inverse)]" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] truncate">
                    {user.username || user.email?.split('@')[0] || 'User'}
                  </h1>
                  <p className="text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] mt-0.5 text-sm">
                    {user.email}
                  </p>
                </div>
                <Link
                  href="/profile"
                  className="shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center hover:bg-[color:var(--app-surface-muted)] dark:hover:bg-[color:var(--app-surface-strong)] rounded-lg transition-colors"
                  aria-label="Profile settings"
                >
                  <Settings className="w-4 h-4 text-[color:var(--app-text)]" />
                </Link>
              </div>

              {/* Quick Stats */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="text-center">
                  <div className="text-base sm:text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    0
                  </div>
                  <div className="text-[10px] text-[color:var(--app-text)] mt-0.5">
                    Jobs Posted
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-base sm:text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    0
                  </div>
                  <div className="text-[10px] text-[color:var(--app-text)] mt-0.5">
                    Applications
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-base sm:text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {user.emailVerified ? (
                      <CheckCircle className="w-5 h-5 text-[color:var(--app-accent)] mx-auto" />
                    ) : (
                      '0'
                    )}
                  </div>
                  <div className="text-[10px] text-[color:var(--app-text)] mt-0.5">
                    Verified
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA: Become Freelancer */}
          {!isFreelancer && (
            <div className="mt-4 p-3 bg-gradient-to-r from-[color:var(--app-accent-soft)] to-[color:var(--app-info-soft)] dark:from-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)] dark:to-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] rounded-xl border-2 border-dashed border-[color:var(--app-accent-border)] dark:border-[color:var(--app-accent-border)]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[color:var(--app-accent-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_40%,_transparent)] rounded-lg">
                  <Briefcase className="w-4 h-4 text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    Offer Your Services
                  </h3>
                  <p className="text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] mt-0">
                    Get hired as a freelancer and earn money
                  </p>
                </div>
                <Link
                  href="/profile/edit?focus=talent"
                  className="shrink-0 h-9 px-4 bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] rounded-lg text-xs font-semibold flex items-center gap-1.5 active:scale-95 lg:hover:bg-[color:var(--app-accent-strong)] transition-all shadow-md shadow-[var(--app-shadow)]"
                >
                  <span className="hidden sm:inline">Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-4 bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] rounded-xl shadow-lg overflow-hidden">
          <div className="flex border-b border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)]">
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'listings', label: 'My Listings' },
                { id: 'reviews', label: 'Reviews' },
              ] as Array<{ id: typeof activeTab; label: string }>
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${activeTab === tab.id
                  ? 'text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]'
                  : 'text-[color:var(--app-text)] hover:text-[color:var(--app-text)] dark:hover:text-[color:var(--app-text-soft)]'
                  }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[color:var(--app-accent)] dark:bg-[color:var(--app-accent)]"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Quick Actions */}
                <div>
                  <h3 className="text-xs font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] mb-3">
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/home"
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[color:var(--app-accent-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)] border-2 border-[color:var(--app-accent-border)] dark:border-[color:var(--app-accent-border)] active:scale-95 transition-transform"
                    >
                      <div className="p-2 bg-[color:var(--app-accent)] rounded-lg shadow">
                        <Briefcase className="w-4 h-4 text-[color:var(--app-text-inverse)]" />
                      </div>
                      <span className="text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] text-center">
                        Explore
                      </span>
                    </Link>
                    <Link
                      href="/home"
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[color:var(--app-info-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] border-2 border-[color:var(--app-info-border)] dark:border-[color:var(--app-info-border)] active:scale-95 transition-transform"
                    >
                      <div className="p-2 bg-[color:var(--app-info)] rounded-lg shadow">
                        <MapPin className="w-4 h-4 text-[color:var(--app-text-inverse)]" />
                      </div>
                      <span className="text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] text-center">
                        Home
                      </span>
                    </Link>
                    {/* <Link
                      href="/my-listings"
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[color:var(--app-accent-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)] border-2 border-[color:var(--app-accent-border)] dark:border-[color:var(--app-accent-border)] active:scale-95 transition-transform"
                    >
                      <div className="p-2 bg-[color:var(--app-accent)] rounded-lg shadow">
                        <Eye className="w-4 h-4 text-[color:var(--app-text-inverse)]" />
                      </div>
                      <span className="text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] text-center">
                        My Listings
                      </span>
                    </Link>
                    <Link
                      href="/dashboard"
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[color:var(--app-warning-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_20%,_transparent)] border-2 border-[color:var(--app-warning-border)] dark:border-[color:var(--app-warning-border)] active:scale-95 transition-transform"
                    >
                      <div className="p-2 bg-[color:var(--app-warning)] rounded-lg shadow">
                        <Star className="w-4 h-4 text-[color:var(--app-text-inverse)]" />
                      </div>
                      <span className="text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] text-center">
                        Applications
                      </span>
                    </Link> */}
                  </div>
                </div>

                {/* Contact Info */}
                <div>
                  <h3 className="text-xs font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] mb-3">
                    Contact Information
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] rounded-lg">
                        <Mail className="w-4 h-4 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-[color:var(--app-text)]">
                          Email
                        </div>
                        <div className="text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {user.email}
                        </div>
                      </div>
                      {user.emailVerified && (
                        <CheckCircle className="w-5 h-5 text-[color:var(--app-accent)]" />
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] rounded-lg">
                        <Phone className="w-4 h-4 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-[color:var(--app-text)]">
                          Phone
                        </div>
                        <div className="text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {user.phone || 'Not added'}
                        </div>
                      </div>
                      {!user.phone && (
                        <button className="text-sm text-[color:var(--app-accent)] font-semibold active:scale-95 transition-transform">
                          Add
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] rounded-lg">
                        <MapPin className="w-4 h-4 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-[color:var(--app-text)]">
                          Location
                        </div>
                        <div className="text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {user.location || 'Not set'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'listings' && (
              <div className="text-center py-8">
                <Briefcase className="w-12 h-12 mx-auto text-[color:var(--app-text-soft)] mb-3" />
                <h3 className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] mb-1.5">
                  No Listings Yet
                </h3>
                <p className="text-[color:var(--app-text)] text-sm mb-4">
                  Start posting jobs or listing properties
                </p>
                <Link
                  href="/home"
                  className="inline-flex items-center gap-1.5 h-9 px-4 bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] rounded-lg text-xs font-semibold active:scale-95 transition-transform"
                >
                  <Plus className="w-4 h-4" />
                  Home
                </Link>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="text-center py-8">
                <Star className="w-12 h-12 mx-auto text-[color:var(--app-text-soft)] mb-3" />
                <h3 className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] mb-1.5">
                  No Reviews Yet
                </h3>
                <p className="text-[color:var(--app-text)] text-sm">
                  Complete jobs to receive reviews
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Bottom Actions */}
        <div className="lg:hidden fixed bottom-16 left-0 right-0 p-3 bg-gradient-to-t from-[color:var(--app-surface-muted)] dark:from-[color:var(--app-surface-strong)] to-transparent pointer-events-none">
          <button
            onClick={handleLogout}
            className="w-full pointer-events-auto flex items-center justify-center gap-1.5 h-11 bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] border-2 border-[color:var(--app-danger-border)] dark:border-[color:var(--app-danger-border)] text-[color:var(--app-danger)] dark:text-[color:var(--app-danger)] rounded-xl text-sm font-semibold active:scale-95 transition-transform shadow-lg"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Desktop: Logout button */}
        <div className="hidden lg:block mt-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2 bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] border border-[color:var(--app-danger-border)] dark:border-[color:var(--app-danger-border)] text-[color:var(--app-danger)] dark:text-[color:var(--app-danger)] rounded-lg text-sm font-semibold hover:bg-[color:var(--app-danger-soft)] dark:hover:bg-[color:color-mix(in_srgb,_var(--app-danger)_20%,_transparent)] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
