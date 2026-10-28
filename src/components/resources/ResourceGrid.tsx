import React from 'react';
import { Resource } from '../../types/resource';
import { ResourceCard } from './ResourceCard';
import { ResourceCardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';

export interface ResourceGridProps {
  resources: Resource[];
  isLoading: boolean;
  onResetFilters?: () => void;
}

export const ResourceGrid: React.FC<ResourceGridProps> = ({
  resources,
  isLoading,
  onResetFilters,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <ResourceCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <EmptyState
        title="No equipment matched your filters"
        description="Try searching for another keyword, clearing the availability filter, or resetting category restrictions."
        actionLabel={onResetFilters ? 'Clear All Filters' : undefined}
        onAction={onResetFilters}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {resources.map((resource) => (
        <ResourceCard key={resource.id} resource={resource} />
      ))}
    </div>
  );
};
