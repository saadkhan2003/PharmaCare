export interface SessionDto {
  token: string;
  user_id: number;
  username: string;
  role: 'owner' | 'pharmacist';
  full_name: string;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface SetupStatus {
  needs_setup: boolean;
}
