import { Resource, ResourceFilters } from '../types/resource';
import { mockStore } from './mock/mockStore';
import { isSupabaseConfigured, getSupabaseClient } from './supabaseClient';
import { AppError } from '../lib/errors';

export const isProductionDataMode = (): boolean => {
  return import.meta.env.VITE_DATA_SOURCE === 'supabase' && isSupabaseConfigured();
};

export const getDataSourceName = (): 'mock' | 'supabase' => {
  return isProductionDataMode() ? 'supabase' : 'mock';
};

class ResourceService {
  async listResources(filters?: ResourceFilters): Promise<Resource[]> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) {
        throw new AppError('MISSING_CONFIG', 'Supabase client is not available in production mode.');
      }
      // Production query contract to be verified with backend developer
      const { data, error } = await client
        .from('resources')
        .select('*');

      if (error) {
        throw new AppError('NETWORK_FAILURE', `Failed to load resources from Supabase: ${error.message}`);
      }

      return (data as Resource[]) || [];
    }

    // Explicit Mock Adapter
    return mockStore.listResources(filters);
  }

  async getResourceById(id: string): Promise<Resource> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) {
        throw new AppError('MISSING_CONFIG', 'Supabase client is not available in production mode.');
      }

      const { data, error } = await client
        .from('resources')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new AppError('RESOURCE_UNAVAILABLE', `Could not find resource: ${error.message}`);
      }

      return data as Resource;
    }

    // Explicit Mock Adapter
    return mockStore.getResourceById(id);
  }
}

export const resourceService = new ResourceService();
