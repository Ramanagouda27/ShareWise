import { HeartHandshake, ShieldCheck } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-neutral-50/80 border-t border-neutral-200 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="space-y-4 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img
                src="/logo.png"
                alt="ShareWise Logo"
                className="w-8 h-8 object-contain rounded-lg transition-transform group-hover:scale-105"
              />
              <span className="text-base font-bold tracking-tight text-neutral-900">
                ShareWise
              </span>
            </Link>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Modern college equipment-sharing and lab reservation platform. Connecting student builders with campus resources.
            </p>
            <div className="flex items-center gap-2 pt-1 text-[11px] text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Campus Lab Network Active</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-3">
              Platform
            </h4>
            <ul className="space-y-2 text-xs text-neutral-600">
              <li>
                <Link to="/resources" className="hover:text-neutral-900 transition-colors">
                  Explore Equipment
                </Link>
              </li>
              <li>
                <a href="/#how-it-works" className="hover:text-neutral-900 transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <Link to="/my-bookings" className="hover:text-neutral-900 transition-colors">
                  My Reservations
                </Link>
              </li>
              <li>
                <Link to="/owner/requests" className="hover:text-neutral-900 transition-colors">
                  Lab Owner Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Resource Categories */}
          <div>
            <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-3">
              Categories
            </h4>
            <ul className="space-y-2 text-xs text-neutral-600">
              <li>
                <Link to="/resources?category=Lab+Equipment" className="hover:text-neutral-900 transition-colors">
                  Digital Oscilloscopes & Meters
                </Link>
              </li>
              <li>
                <Link to="/resources?category=Computing+%26+AI" className="hover:text-neutral-900 transition-colors">
                  NVIDIA Edge & AI Dev Kits
                </Link>
              </li>
              <li>
                <Link to="/resources?category=Prototyping+%26+Tools" className="hover:text-neutral-900 transition-colors">
                  3D Printers & Soldering Bays
                </Link>
              </li>
              <li>
                <Link to="/resources?category=Robotics+%26+Drones" className="hover:text-neutral-900 transition-colors">
                  Autonomous Drones & Sensors
                </Link>
              </li>
            </ul>
          </div>

          {/* Governance & Safety */}
          <div>
            <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-3">
              Campus Guidelines
            </h4>
            <div className="space-y-2.5 text-xs text-neutral-500">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>Verified student & faculty checkouts with mandatory condition logs.</span>
              </div>
              <div className="flex items-start gap-2">
                <HeartHandshake className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Respectful peer sharing, punctuality, and fair usage quotas.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-3">
          <p>© {new Date().getFullYear()} ShareWise Platform. Built for Campus Hackathon.</p>
          <div className="flex items-center gap-4 text-neutral-500">
            <span>Terms of Use</span>
            <span>•</span>
            <span>Lab Safety Protocols</span>
            <span>•</span>
            <span>Privacy Policy</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
