export interface UserDto {
  id: number;
  full_name: string;
  username: string;
  role: 'owner' | 'pharmacist';
  is_active: boolean;
  created_at: string;
}

export interface CreateUserDto {
  full_name: string;
  username: string;
  password: string;
  role: 'owner' | 'pharmacist';
}

export interface LoginAttemptDto {
  id: number;
  username: string;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
}
