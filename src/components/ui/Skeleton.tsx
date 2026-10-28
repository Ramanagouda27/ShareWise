import React from 'react';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-neutral-100 rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
};

export const ResourceCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 space-y-4 shadow-2xs">
      <Skeleton className="w-full h-48 rounded-xl" />
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Skeleton className="w-24 h-5 rounded-md" />
          <Skeleton className="w-16 h-5 rounded-full" />
        </div>
        <Skeleton className="w-3/4 h-6 rounded-md" />
        <Skeleton className="w-full h-10 rounded-md" />
      </div>
      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
        <Skeleton className="w-32 h-4 rounded-md" />
        <Skeleton className="w-20 h-8 rounded-lg" />
      </div>
    </div>
  );
};
