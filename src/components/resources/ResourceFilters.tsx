import React from 'react';
import { Search, X, SlidersHorizontal, Check } from 'lucide-react';
import { ResourceFilters as FilterType } from '../../types/resource';

export interface ResourceFiltersProps {
  filters: FilterType;
  onChange: (filters: FilterType) => void;
  categories: string[];
  locations: string[];
  totalResults: number;
}

export const ResourceFilters: React.FC<ResourceFiltersProps> = ({
  filters,
  onChange,
  categories,
  locations,
  totalResults,
}) => {
  const hasActiveFilters = Boolean(
    filters.query ||
      (filters.category && filters.category !== 'All') ||
      (filters.location && filters.location !== 'All') ||
      filters.availableOnly
  );

  const resetFilters = () => {
    onChange({
      query: '',
      category: 'All',
      location: 'All',
      availableOnly: false,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/90 p-4 sm:p-5 shadow-2xs space-y-4 mb-8">
      {/* Search Bar & Quick Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.query || ''}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Search by hardware name, keyword, or lab (e.g. Oscilloscope, Jetson, ECE 304)..."
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 pl-10 pr-10 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 outline-none transition-all"
          />
          {filters.query && (
            <button
              onClick={() => onChange({ ...filters, query: '' })}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Location Dropdown */}
        <div className="sm:w-56">
          <select
            value={filters.location || 'All'}
            onChange={(e) => onChange({ ...filters, location: e.target.value })}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3.5 py-2.5 text-sm text-neutral-700 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 outline-none transition-all cursor-pointer"
          >
            <option value="All">All Campus Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Availability Toggle Button */}
        <button
          onClick={() => onChange({ ...filters, availableOnly: !filters.availableOnly })}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
            filters.availableOnly
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
              : 'bg-neutral-50/60 text-neutral-600 border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-md border flex items-center justify-center ${
              filters.availableOnly
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-neutral-300 bg-white'
            }`}
          >
            {filters.availableOnly && <Check className="w-3 h-3 stroke-[3]" />}
          </div>
          <span>Available Now</span>
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider shrink-0 mr-1">
          Categories:
        </span>
        {categories.map((cat) => {
          const isSelected = (filters.category || 'All') === cat;
          return (
            <button
              key={cat}
              onClick={() => onChange({ ...filters, category: cat })}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-600'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Active filter counter and reset button */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs text-neutral-500">
        <div>
          Showing <span className="font-semibold text-neutral-800">{totalResults}</span> verified campus equipment
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-blue-600 hover:text-blue-700 font-medium hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            <span>Reset filters</span>
          </button>
        )}
      </div>
    </div>
  );
};
