/**
 * Organization API: Departments and Sections
 */
import api from './api';

export interface Department {
  id: number;
  department_name: string;
  created_at: string | null;
}

export interface Section {
  id: string;
  section_name: string;
  manager_id: string | null;
  created_at: string | null;
}

class OrgApi {
  async listDepartments(): Promise<Department[]> {
    const response = await api.get<Department[]>('/api/v1/org/departments');
    return response.data;
  }

  async listSections(departmentId?: number, debugContext?: string): Promise<Section[]> {
    const params = departmentId ? { department_id: departmentId } : {};
    const config: any = { params };
    if (debugContext) config.headers = { 'X-Debug-Context': debugContext };
    const response = await api.get<Section[]>('/api/v1/org/sections', config);
    return response.data;
  }
}

export const orgApi = new OrgApi();
