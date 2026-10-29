import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight, Clock, Wrench } from 'lucide-react';
import { motion } from 'framer-motion';
import { Resource } from '../../types/resource';

export interface ResourceCardProps {
  resource: Resource;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource }) => {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="group bg-white rounded-2xl border border-neutral-200/90 hover:border-blue-300/80 shadow-2xs hover:shadow-xl hover:shadow-blue-500/8 transition-all duration-300 flex flex-col overflow-hidden relative"
    >
      {/* Image Preview Container */}
      <div className="relative aspect-16/10 w-full overflow-hidden bg-neutral-100 border-b border-neutral-100">
        {resource.imageUrl && !imageFailed ? (
          <img
            src={resource.imageUrl}
            alt={resource.title}
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 bg-neutral-50/80 gap-2">
            <Wrench className="w-8 h-8 stroke-[1.5]" />
            <span className="text-xs font-medium text-neutral-400">Campus Hardware</span>
          </div>
        )}

        {/* Category Pill Over Image */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/95 backdrop-blur-xs text-neutral-800 shadow-xs border border-white/80 group-hover:border-blue-200 transition-colors">
            {resource.category}
          </span>
        </div>

        {/* Real Availability Badge */}
        <div className="absolute top-3 right-3">
          {resource.availability.isAvailable ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/95 backdrop-blur-xs text-white shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {(resource.availability.availableQuantity ?? 0) > 1
                ? `${resource.availability.availableQuantity} Available`
                : 'Available'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-800/85 backdrop-blur-xs text-white shadow-xs">
              <Clock className="w-3 h-3" />
              Reserved
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-base font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors line-clamp-1">
            {resource.title}
          </h3>

          <p className="mt-1.5 text-xs text-neutral-500 line-clamp-2 leading-relaxed">
            {resource.description}
          </p>
        </div>

        <div className="mt-4 pt-3.5 border-t border-neutral-100 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 group-hover:text-blue-500 transition-colors" />
            <span className="truncate">{resource.location}</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-neutral-400">
              {resource.owner?.name ? `Owner: ${resource.owner.name.split(' ')[0]}` : 'Lab Resource'}
            </span>

            <Link
              to={`/resources/${resource.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 group-hover:text-blue-700 hover:underline"
            >
              <span>View Details</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
