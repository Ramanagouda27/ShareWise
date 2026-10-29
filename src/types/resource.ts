export type ResourceCategory =
  | 'Lab Equipment'
  | 'Development Boards'
  | 'Sensors & Hardware'
  | 'Prototyping & Tools'
  | 'Robotics & Drones'
  | 'Computing & AI';


export interface ResourceAvailability {
  isAvailable: boolean;
  nextAvailableDate?: string;
  totalQuantity?: number;
  availableQuantity?: number;
}

export interface ResourceOwner {
  id: string;
  name: string;
  department: string;
  labLocation?: string;
  email?: string;
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  imageUrl?: string;
  location: string;
  ownerId: string;
  owner?: ResourceOwner;
  availability: ResourceAvailability;
  eligibilityRequirements?: string[];
  specifications?: Record<string, string>;
  serialNumber?: string;
  isFeatured?: boolean;
  createdAt?: string;
  tags?: string[];
}

export interface ResourceFilters {
  query?: string;
  category?: string;
  location?: string;
  availableOnly?: boolean;
}
