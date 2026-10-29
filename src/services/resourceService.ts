
import { Resource, ResourceFilters, ResourceCategory } from '../types/resource';
import { mockStore } from './mock/mockStore';
import { isSupabaseConfigured, getSupabaseClient } from './supabaseClient';
import { AppError } from '../lib/errors';

type ResourceRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  category: string;
  location: string | null;
  image_path: string | null;
  usage_rules: string | null;
  required_training: string | null;
  max_booking_minutes: number | null;
  status: 'active' | 'inactive' | 'maintenance' | string;
  created_at: string;
  updated_at: string;
};

export const isProductionDataMode = (): boolean => {
  return (
    import.meta.env.VITE_DATA_SOURCE === 'supabase' &&
    isSupabaseConfigured()
  );
};

export const getDataSourceName = (): 'mock' | 'supabase' => {
  return isProductionDataMode() ? 'supabase' : 'mock';
};

const mapResourceRow = (row: ResourceRow): Resource => {
  const status = row.status?.toLowerCase();

  return {
    id: row.id,
    title: row.name,
    description: row.description ?? '',
    category: row.category as ResourceCategory,
    location: row.location ?? '',
    ownerId: row.owner_id,
    imageUrl: row.image_path ?? undefined,

    // The database does not store quantity counts.
    // Availability is derived from the resource status only.
    availability: {
      isAvailable: status === 'active',
    },

    eligibilityRequirements: [
      row.required_training,
      row.usage_rules,
    ].filter((value): value is string => Boolean(value?.trim())),

    specifications:
      row.max_booking_minutes == null
        ? undefined
        : {
            maxBookingMinutes: String(row.max_booking_minutes),
          },

    createdAt: row.created_at,
  };
};

const applyResourceFilters = (
  resources: Resource[],
  filters?: ResourceFilters,
): Resource[] => {
  if (!filters) return resources;

  let filtered = resources;

  const query = filters.query?.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter((resource) =>
      [
        resource.title,
        resource.description,
        resource.category,
        resource.location,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }

  if (filters.category && filters.category !== 'all') {
    filtered = filtered.filter(
      (resource) => resource.category === filters.category,
    );
  }

  const location = filters.location?.trim().toLowerCase();
  if (location && location !== 'all') {
    filtered = filtered.filter((resource) =>
      resource.location.toLowerCase().includes(location),
    );
  }

  if (filters.availableOnly) {
    filtered = filtered.filter(
      (resource) => resource.availability.isAvailable,
    );
  }

  return filtered;
};

class ResourceService {
  async listResources(filters?: ResourceFilters): Promise<Resource[]> {
    if (!isProductionDataMode()) {
      return mockStore.listResources(filters);
    }

    const client = getSupabaseClient();

    if (!client) {
      throw new AppError(
        'MISSING_CONFIG',
        'Supabase client is not available in production mode.',
      );
    }

    const { data, error } = await client
      .from('resources')
      .select(
        'id, owner_id, name, description, category, location, image_path, usage_rules, required_training, max_booking_minutes, status, created_at, updated_at',
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError(
        'NETWORK_FAILURE',
        `Failed to load resources from Supabase: ${error.message}`,
      );
    }

    const rows = (data ?? []) as unknown as ResourceRow[];
    const resources = rows.map(mapResourceRow);

    return applyResourceFilters(resources, filters);
  }

  async getResourceById(id: string): Promise<Resource> {
    if (!isProductionDataMode()) {
      return mockStore.getResourceById(id);
    }

    const client = getSupabaseClient();

    if (!client) {
      throw new AppError(
        'MISSING_CONFIG',
        'Supabase client is not available in production mode.',
      );
    }

    const { data, error } = await client
      .from('resources')
      .select(
        'id, owner_id, name, description, category, location, image_path, usage_rules, required_training, max_booking_minutes, status, created_at, updated_at',
      )
      .eq('id', id)
      .single();

    if (error) {
      throw new AppError(
        'RESOURCE_UNAVAILABLE',
        `Could not find resource: ${error.message}`,
      );
    }

    return mapResourceRow(data as unknown as ResourceRow);
  }
}

export const resourceService = new ResourceService();
