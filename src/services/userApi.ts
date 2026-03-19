import api from './api';
import { MeResponse } from '../contracts/generated/api.types';

export type User = MeResponse & {
  is_active?: boolean;
  department_id?: number;
  section_id?: string;
  department_name?: string;
  section_name?: string;
};

export interface UserListItem extends User {
  created_at: string;
  department_name?: string;
  section_name?: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  department_id?: number;
  section_id?: string;
  password: string;
  role: 'admin' | 'manager' | 'user';
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  department_id?: number;
  section_id?: string;
  password?: string;
  role?: 'admin' | 'manager' | 'user';
  is_active?: boolean;
}

class UserApi {
  async listUsers(): Promise<UserListItem[]> {
    const response = await api.get<UserListItem[]>('/api/v1/users');
    return response.data;
  }

  async listUsersBySection(sectionId: string, debugContext?: string): Promise<UserListItem[]> {
    const config: any = { params: { section_id: sectionId } };
    if (debugContext) config.headers = { 'X-Debug-Context': debugContext };
    const response = await api.get<UserListItem[]>('/api/v1/users/by-section', config);
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

