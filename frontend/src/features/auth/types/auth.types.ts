export type UserRole = 'customer' | 'seller' | 'admin';

export interface User {
  id: number;
  fullName: string | null;
  email: string;
  role: UserRole;
}

export interface UserProfile extends User {
  isBanned: boolean;
  created_at: string;
  updated_at: string | null;
}
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName?: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
