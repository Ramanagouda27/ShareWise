
import type { Resource, ResourceCategory, ResourceFilters } from '../types/resource';
import { mockStore } from './mock/mockStore';
import { getSupabaseClient } from './supabaseClient';
import { AppError } from '../lib/errors';

export const isProductionDataMode = (): boolean => {
  return import.meta.env.VITE_DATA_SOURCE === 'supabase';
};

export const getDataSourceName = (): 'mock' | 'supabase' => {
  return isProductionDataMode() ? 'supabase' : 'mock';
};

type DbRecord = Record<string, unknown>;

function asRecord(value: unknown): DbRecord | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as DbRecord;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

const CATEGORY_ALIASES: Record<string, ResourceCategory> = {
  lab_equipment: 'Lab Equipment',
  development_board: 'Development Boards',
  development_boards: 'Development Boards',
  sensors_hardware: 'Sensors & Hardware',
  sensors_and_hardware: 'Sensors & Hardware',
  prototyping_tools: 'Prototyping & Tools',
  prototyping_and_tools: 'Prototyping & Tools',
  robotics_drone: 'Robotics & Drones',
  robotics_drones: 'Robotics & Drones',
  robotics_and_drones: 'Robotics & Drones',
  computing_ai: 'Computing & AI',
  computing_and_ai: 'Computing & AI',
};

function normalizeCategory(value: string): ResourceCategory | undefined {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return CATEGORY_ALIASES[key];
}

export function mapResourceRow(value: unknown): Resource | undefined {
  const row = asRecord(value);
  if (!row || !asString(row.id)) return undefined;

  const status = asString(row.status, 'inactive');
  const rawCategory = asString(row.category);
  const category = normalizeCategory(rawCategory) ?? 'Lab Equipment';
  const requiredTraining = asString(row.required_training);

  return {
    id: asString(row.id),
    title: asString(row.name, 'Untitled resource'),
    description: asString(row.description),
    category,
    imageUrl: asString(row.image_path) || undefined,
    location: asString(row.location, 'Location not specified'),
    ownerId: asString(row.owner_id),
    availability: {
      totalQuantity: 1,
      availableQuantity: status === 'active' ? 1 : 0,
      isAvailable: status === 'active',
    },
    eligibilityRequirements: requiredTraining ? [requiredTraining] : [],
    createdAt: asString(row.created_at) || undefined,
  };
}

function applyResourceFilters(
  resources: Resource[],
  filters?: ResourceFilters,
): Resource[] {
  const query = filters?.query?.trim().toLowerCase();
  const location = filters?.location?.trim().toLowerCase();
  const selectedCategory = filters?.category?.trim();
  const categoryKey = selectedCategory?.toLowerCase().replace(/\s+/g, '_');
  const allCategories = !selectedCategory
    || ['all', 'any', 'all_categories', 'all_categories'].includes(categoryKey ?? '');

  const wantedCategory = allCategories
    ? undefined
    : normalizeCategory(selectedCategory ?? '');

  return resources.filter((resource) => {
    if (query) {
      const searchableText = [
        resource.title,
        resource.description,
        resource.category,
        resource.location,
        ...(resource.tags ?? []),
      ].join(' ').toLowerCase();

      if (!searchableText.includes(query)) return false;
    }

    if (selectedCategory && !allCategories) {
      if (!wantedCategory || resource.category !== wantedCategory) return false;
    }

    if (location && !resource.location.toLowerCase().includes(location)) {
      return false;
    }

    if (
  location &&
  !['all', 'any', 'all_locations', 'all_campus_locations'].includes(location) &&
  !resource.location.toLowerCase().includes(location)
) {
  return false;
}
    return true;
  });
}

class ResourceService {
  async listResources(filters?: ResourceFilters): Promise<Resource[]> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) {
        throw new AppError(
          'MISSING_CONFIG',
          'Supabase client is not available in Supabase data mode.',
        );
      }

      const { data, error } = await client
        .from('resources')
        .select('*');

      if (error) {
        throw new AppError(
          'NETWORK_FAILURE',
          `Failed to load resources from Supabase: ${error.message}`,
        );
      }

      const rows: unknown[] = Array.isArray(data) ? data : [];
      const resources = rows
        .map(mapResourceRow)
        .filter((resource): resource is Resource => resource !== undefined);

      return applyResourceFilters(resources, filters);
    }

    return mockStore.listResources(filters);
  }

  async getResourceById(id: string): Promise<Resource> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) {
        throw new AppError(
          'MISSING_CONFIG',
          'Supabase client is not available in Supabase data mode.',
        );
      }

      const { data, error } = await client
        .from('resources')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new AppError(
          'NETWORK_FAILURE',
          `Failed to load resource from Supabase: ${error.message}`,
        );
      }

      const resource = mapResourceRow(data);
      if (!resource) {
        throw new AppError('RESOURCE_UNAVAILABLE', 'The requested resource was not found.');
      }

      return resource;
    }

    return mockStore.getResourceById(id);
  }
}

export const resourceService = new ResourceService();
