import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { resourceService } from '../services/resourceService';
import { Resource, ResourceFilters as FilterType } from '../types/resource';
import { ResourceGrid } from '../components/resources/ResourceGrid';
import { ResourceFilters } from '../components/resources/ResourceFilters';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorState } from '../components/ui/ErrorState';
import { formatErrorMessage } from '../lib/errors';

export const ResourcesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize filters from URL parameters or defaults
  const [filters, setFilters] = useState<FilterType>({
    query: searchParams.get('q') || '',
    category: searchParams.get('category') || 'All',
    location: searchParams.get('location') || 'All',
    availableOnly: searchParams.get('available') === 'true',
  });

  const loadResources = useCallback(async () => {
  setIsLoading(true);
  setError(null);

  try {
    const data = await resourceService.listResources(filters);
    setResources(data);
  } catch (err) {
    setError(formatErrorMessage(err));
  } finally {
    setIsLoading(false);
  }
}, [filters]);

useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadResources();
  }, 200);

  return () => window.clearTimeout(timer);
}, [loadResources]);

  // Handle search query with slight debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      loadResources();
    }, 200);
    return () => clearTimeout(handler);
  }, [loadResources]);

  // Derive unique categories and locations from current datasets
  const categories = useMemo(() => {
    return [
      'All',
      'Lab Equipment',
      'Development Boards',
      'Sensors & Hardware',
      'Prototyping & Tools',
      'Robotics & Drones',
      'Computing & AI',
    ];
  }, []);

  const locations = useMemo(() => {
    return [
      'ECE Building — Room 304 (Signal Lab)',
      'Computer Science Building — AI Research Annex (Room 112)',
      'Campus Makerspace — Bay 2 (Additive Fabrication)',
      'Robotics Club Workshop — Mezzanine Floor',
      'ECE Hardware Prototyping Room — Workbench 4',
      'Interactive Media & HCI Lab — Room 220',
      'Embedded Systems Lab — Storage Bay B',
      'Aeronautics & Drone Cage — East Campus Field',
    ];
  }, []);

  const handleFilterChange = (newFilters: FilterType) => {
    setFilters(newFilters);
    const params: Record<string, string> = {};
    if (newFilters.query) params.q = newFilters.query;
    if (newFilters.category && newFilters.category !== 'All') params.category = newFilters.category;
    if (newFilters.location && newFilters.location !== 'All') params.location = newFilters.location;
    if (newFilters.availableOnly) params.available = 'true';
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <PageHeader
        title="Campus Equipment Catalog"
        description="Search, inspect specifications, and reserve department hardware for academic projects, lab research, and competition prototypes."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Explore Resources' }]}
      />

      <ResourceFilters
        filters={filters}
        onChange={handleFilterChange}
        categories={categories}
        locations={locations}
        totalResults={resources.length}
      />

      {error ? (
        <ErrorState
          title="Could not load equipment catalog"
          message={error}
          onRetry={loadResources}
        />
      ) : (
        <ResourceGrid
          resources={resources}
          isLoading={isLoading}
          onResetFilters={() =>
            handleFilterChange({
              query: '',
              category: 'All',
              location: 'All',
              availableOnly: false,
            })
          }
        />
      )}
    </div>
  );
};
