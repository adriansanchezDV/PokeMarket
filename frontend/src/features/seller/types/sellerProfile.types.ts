import type { User } from '@/features/auth/types/auth.types';

export interface SellerProfile {
  id: number;
  userId: number;
  storeName: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSellerProfileRequest {
  storeName: string;
  description?: string;
}

export interface CreateSellerProfileResponse {
  token: string;
  user: User;
  store: SellerProfile;
}

export interface UpdateSellerProfileRequest {
  storeName?: string;
  description?: string | null;
}
