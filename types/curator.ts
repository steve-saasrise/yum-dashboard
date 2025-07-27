export interface Curator {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface CuratorSession {
  curator: Curator;
  token: string;
  expires_at: string;
}

export interface CuratorLoginCredentials {
  email: string;
  password: string;
}

export interface CuratorSignupCredentials extends CuratorLoginCredentials {
  confirmPassword: string;
}
