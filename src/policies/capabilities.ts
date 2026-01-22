// src/policies/capabilities.ts
// Role-agnostic capability-based authorization

import { AuthorizationPolicy } from '../contracts/generated/api.types';

class CapabilityManager {
  private policy: AuthorizationPolicy | null = null;
  private userCapabilities: Set<string> = new Set();
  private initialized = false;

  /**
   * Initialize capabilities for a user
   */
  async initialize(userRole: string): Promise<void> {
    try {
      // TODO: Replace with actual API call when endpoint exists
      // const response = await api.get<AuthorizationPolicy>('/api/v1/checklists/authorization-policy');
      // this.policy = response.data;
      // For now, use a minimal inline fallback
      this.policy = this.fallbackPolicy();
      this.loadUserCapabilities(userRole);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to load authorization policy:', error);
      this.policy = this.fallbackPolicy();
      this.loadUserCapabilities(userRole);
      this.initialized = true;
    }
  }

  /**
   * Check if the current user has a specific capability
   */
  hasCapability(capability: string): boolean {
    return this.userCapabilities.has(capability);
  }

  /**
   * Check if the user has ANY of the given capabilities
   */
  hasAnyCapability(capabilities: string[]): boolean {
    return capabilities.some(cap => this.userCapabilities.has(cap));
  }

  /**
   * Check if the user has ALL of the given capabilities
   */
  hasAllCapabilities(capabilities: string[]): boolean {
    return capabilities.every(cap => this.userCapabilities.has(cap));
  }

  /**
   * Get all user capabilities
   */
  getUserCapabilities(): string[] {
    return Array.from(this.userCapabilities);
  }

  /**
   * Get capability description
   */
  getCapabilityDescription(capability: string): string {
    if (!this.policy) return '';
    const capDef = this.policy.capabilities[capability];
    return capDef?.description || '';
  }

  /**
   * Load capabilities for a given role
   */
  private loadUserCapabilities(role: string): void {
    if (!this.policy) return;
    const caps = this.policy.role_capabilities[role] || [];
    this.userCapabilities = new Set(caps);
  }

  /**
   * Minimal fallback policy for safety
   */
  private fallbackPolicy(): AuthorizationPolicy {
    return {
      capabilities: {
        START_CHECKLIST: {
          description: 'Start a new checklist instance',
          applies_to: ['checklist_instance'],
        },
        COMPLETE_CHECKLIST: {
          description: 'Complete a checklist',
          applies_to: ['checklist_instance'],
        },
        CLOSE_CHECKLIST_EXCEPTION: {
          description: 'Close checklist with exceptions',
          applies_to: ['checklist_instance'],
        },
        EDIT_CHECKLIST_ITEM: {
          description: 'Edit checklist items',
          applies_to: ['checklist_item'],
        },
        VIEW_DASHBOARD: {
          description: 'View operational dashboard',
          applies_to: ['dashboard'],
        },
        MANAGE_USERS: {
          description: 'Manage user accounts',
          applies_to: ['user_management'],
        },
        SUPERVISOR_COMPLETE_CHECKLIST: {
          description: 'Complete checklist on behalf of team',
          applies_to: ['checklist_instance'],
        },
      },
      role_capabilities: {
        OPERATOR: [
          'START_CHECKLIST',
          'EDIT_CHECKLIST_ITEM',
          'VIEW_DASHBOARD',
        ],
        SUPERVISOR: [
          'START_CHECKLIST',
          'EDIT_CHECKLIST_ITEM',
          'COMPLETE_CHECKLIST',
          'CLOSE_CHECKLIST_EXCEPTION',
          'VIEW_DASHBOARD',
          'SUPERVISOR_COMPLETE_CHECKLIST',
        ],
        ADMIN: [
          'START_CHECKLIST',
          'EDIT_CHECKLIST_ITEM',
          'COMPLETE_CHECKLIST',
          'CLOSE_CHECKLIST_EXCEPTION',
          'VIEW_DASHBOARD',
          'MANAGE_USERS',
          'SUPERVISOR_COMPLETE_CHECKLIST',
        ],
      },
    };
  }

  /**
   * Reset capabilities (for testing or re-initialization)
   */
  reset(): void {
    this.policy = null;
    this.userCapabilities.clear();
    this.initialized = false;
  }

  /**
   * Force set capabilities (for testing)
   */
  _setCapabilities(capabilities: string[]): void {
    this.userCapabilities = new Set(capabilities);
  }
}

export const capabilityManager = new CapabilityManager();

// Helper hook for React components
export const useCapability = () => {
  const hasCapability = (capability: string) => capabilityManager.hasCapability(capability);
  const hasAnyCapability = (capabilities: string[]) => capabilityManager.hasAnyCapability(capabilities);
  const hasAllCapabilities = (capabilities: string[]) => capabilityManager.hasAllCapabilities(capabilities);
  const getUserCapabilities = () => capabilityManager.getUserCapabilities();

  return {
    hasCapability,
    hasAnyCapability,
    hasAllCapabilities,
    getUserCapabilities,
  };
};
