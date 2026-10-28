import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SplineHeroBackground } from '../components/spline/SplineHeroBackground';
import { Button } from '../components/ui/Button';
import { Resource } from '../types/resource';
import { resourceService } from '../services/resourceService';
import { ResourceCard } from '../components/resources/ResourceCard';
import { ResourceCardSkeleton } from '../components/ui/Skeleton';

export const HomePage: React.FC = () => {
  const [featuredResources, setFeaturedResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadFeatured = async () => {
      try {
        const all = await resourceService.listResources();
        if (mounted) {
          const featured = all.filter((r) => r.isFeatured).slice(0, 4);
          setFeaturedResources(featured.length > 0 ? featured : all.slice(0, 4));
        }
      } catch (err) {
        console.error('Failed to load featured resources:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadFeatured();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="w-full bg-white">
      {/* HERO SECTION WITH SPLINE 3D ROBOT */}
      <section className="relative w-full overflow-hidden border-b border-neutral-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Headline, Copy, CTA (Staggered Animated Entrance) */}
            <div className="lg:col-span-7 z-10">
              <div className="max-w-2xl">
                {/* Announcement Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold mb-6 shadow-2xs hover:bg-blue-100/60 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <span>Campus resource sharing, simplified</span>
                </motion.div>

                {/* Animated Headline */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
                  className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.08]"
                >
                  Share More.{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700">
                    Build More.
                  </span>
                </motion.h1>

                {/* Animated Supporting Text */}
                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
                  className="mt-5 text-base sm:text-lg text-neutral-600 leading-relaxed max-w-xl"
                >
                  Discover and borrow college equipment without unnecessary coordination. Reserve high-demand lab hardware, dev boards, sensors, and fabrication tools with transparent real-time availability.
                </motion.p>

                {/* Animated CTA Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
                  className="mt-8 flex flex-wrap items-center gap-3"
                >
                  <Link to="/resources">
                    <Button
                      variant="primary"
                      size="lg"
                      rightIcon={<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                      className="shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/25 transition-all"
                    >
                      Explore Resources
                    </Button>
                  </Link>

                  <a href="#how-it-works">
                    <Button variant="outline" size="lg" className="hover:border-neutral-400 transition-colors">
                      How It Works
                    </Button>
                  </a>
                </motion.div>

                {/* Animated Trust Indicators */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.45 }}
                  className="mt-12 pt-8 border-t border-neutral-200/60 flex flex-wrap items-center gap-6 text-xs text-neutral-500"
                >
                  <div className="flex items-center gap-2 group cursor-default">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 transition-transform group-hover:scale-110" />
                    <span>Verified Campus Labs</span>
                  </div>
                  <div className="flex items-center gap-2 group cursor-default">
                    <Clock className="w-4 h-4 text-blue-600 transition-transform group-hover:scale-110" />
                    <span>Transparent Time Windows</span>
                  </div>
                  <div className="flex items-center gap-2 group cursor-default">
                    <CheckCircle className="w-4 h-4 text-indigo-600 transition-transform group-hover:scale-110" />
                    <span>Official Condition Audits</span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Right Column: 3D Spline Robot with Soft Radial Glow */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
              className="lg:col-span-5 h-[420px] sm:h-[480px] lg:h-[560px] w-full relative flex items-center justify-center"
            >
              <SplineHeroBackground />
            </motion.div>
          </div>
        </div>
      </section>

      {/* THREE STEP WORKFLOW */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-neutral-50/60 border-b border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              Streamlined Flow
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              How ShareWise Works
            </h2>
            <p className="mt-3 text-sm sm:text-base text-neutral-500">
              No back-and-forth emails or hunting down lab keys. Reserve equipment directly with institutional accountability.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: 0.1 }}
              whileHover={{ y: -8 }}
              className="group bg-white rounded-2xl border border-neutral-200/80 hover:border-blue-300 p-6 sm:p-8 shadow-2xs hover:shadow-xl hover:shadow-blue-500/8 transition-all duration-300 relative cursor-default"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg mb-6 shadow-2xs group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                01
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2 group-hover:text-blue-600 transition-colors">
                Discover Verified Resources
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Filter across department labs by category, location, and verified availability. Check eligibility and equipment specifications before requesting.
              </p>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: 0.2 }}
              whileHover={{ y: -8 }}
              className="group bg-white rounded-2xl border border-neutral-200/80 hover:border-indigo-300 p-6 sm:p-8 shadow-2xs hover:shadow-xl hover:shadow-indigo-500/8 transition-all duration-300 relative cursor-default"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg mb-6 shadow-2xs group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                02
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2 group-hover:text-indigo-600 transition-colors">
                Select Window & Request
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Choose start and return times that match your project milestones. Lab owners review and confirm reservations via the owner dashboard.
              </p>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: 0.3 }}
              whileHover={{ y: -8 }}
              className="group bg-white rounded-2xl border border-neutral-200/80 hover:border-emerald-300 p-6 sm:p-8 shadow-2xs hover:shadow-xl hover:shadow-emerald-500/8 transition-all duration-300 relative cursor-default"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-lg mb-6 shadow-2xs group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                03
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2 group-hover:text-emerald-600 transition-colors">
                Inspect, Build & Return
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Complete a digital condition log at pickup. Build your prototype, conduct tests, and return equipment on time for the next team.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FEATURED EQUIPMENT SHOWCASE */}
      <section className="py-20 lg:py-28 bg-white border-b border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                Live Inventory
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                Featured Campus Hardware
              </h2>
              <p className="mt-2 text-sm sm:text-base text-neutral-500 max-w-xl">
                Hardware kits, oscilloscopes, GPU edge clusters, and rapid fabrication gear available across engineering departments.
              </p>
            </div>
            <Link to="/resources" className="shrink-0">
              <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                View All Equipment
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <ResourceCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredResources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* DUAL VALUE PROPOSITION: STUDENTS & LAB OWNERS */}
      <section className="py-20 lg:py-28 bg-neutral-50/50 border-b border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Student Persona */}
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ duration: 0.25 }}
              className="group bg-white rounded-3xl border border-neutral-200/90 hover:border-blue-300 p-8 sm:p-10 shadow-xs hover:shadow-xl hover:shadow-blue-500/8 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-neutral-900">
                  Built for Student Builders & Researchers
                </h3>
                <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                  Stop letting expensive equipment sit idle while project deadlines approach. Access industry-grade instruments without personal out-of-pocket costs.
                </p>

                <ul className="mt-6 space-y-3 text-sm text-neutral-700">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Real-time availability prevents wasted trips across campus.</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Simple reservation forms with instant schedule collision checks.</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Transparent booking status with email & dashboard updates.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-neutral-100">
                <Link to="/resources">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Start Browsing Catalog
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Lab Owner / Faculty Persona */}
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ duration: 0.25 }}
              className="group bg-white rounded-3xl border border-neutral-200/90 hover:border-neutral-400 p-8 sm:p-10 shadow-xs hover:shadow-xl transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-neutral-900">
                  Total Governance for Lab Managers
                </h3>
                <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                  Maintain full authority over lab assets. Review borrower academic purpose, confirm prerequisites, and audit hardware condition before and after every checkout.
                </p>

                <ul className="mt-6 space-y-3 text-sm text-neutral-700">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Full control over approvals, rejections, and required reasons.</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Mandatory digital condition logging protects lab accountability.</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Auditable history prevents lost probes and undocumented damage.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-neutral-100">
                <Link to="/owner/requests">
                  <Button variant="secondary" className="w-full sm:w-auto">
                    Open Owner Dashboard
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* RESPONSIBLE SHARING & SAFETY SECTION */}
      <section className="py-16 bg-white border-b border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.25 }}
            className="bg-gradient-to-br from-neutral-50 via-white to-neutral-50 rounded-3xl border border-neutral-200/90 hover:border-blue-200 p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xs hover:shadow-md transition-all"
          >
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Community Standard
              </span>
              <h3 className="mt-2 text-2xl sm:text-3xl font-bold text-neutral-900">
                Responsible Campus Equipment Sharing
              </h3>
              <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                Every reservation on ShareWise is backed by verified student identities and institutional accountability. Return hardware on time, keep equipment clean, and preserve campus resources for future cohorts.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-4">
              <Link to="/resources">
                <Button variant="primary" size="lg" className="shadow-md shadow-blue-500/20">
                  Explore Catalog
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};
