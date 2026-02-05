import api from './api';
import { MeResponse } from '../contracts/generated/api.types';

export type User = MeResponse & { is_active?: boolean };

export interface UserListItem extends User {
  created_at: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  department?: string;
  position?: string;
  password: string;
  // Business-level role; backend maps admin/manager/user → admin/supervisor/operator
  role: 'admin' | 'manager' | 'user';
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  department?: string;
  position?: string;
  password?: string;
  role?: 'admin' | 'manager' | 'user';
  is_active?: boolean;
}

class UserApi {
  async listUsers(): Promise<UserListItem[]> {
    const response = await api.get<UserListItem[]>('/api/v1/users');
    return response.data;
  }

  async getUser(id: string): Promise<User> {
    const response = await api.get<User>(`/api/v1/users/${id}`);
    return response.data;
  }

  async createUser(payload: CreateUserRequest): Promise<User> {
    const response = await api.post<User>('/api/v1/users', payload);
    return response.data;
  }

  async updateUser(id: string, payload: UpdateUserRequest): Promise<User> {
    const response = await api.patch<User>(`/api/v1/users/${id}`, payload);
    return response.data;
  }
}

export const userApi = new UserApi();

