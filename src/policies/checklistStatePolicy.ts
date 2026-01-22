// src/policies/checklistStatePolicy.ts
// Centralized, policy-driven checklist state machine

import { ChecklistStatePolicy } from '../contracts/generated/api.types';

type State = string;
type Transition = string;

class ChecklistStatePolicyManager {
  private policy: ChecklistStatePolicy | null = null;
  private initialized = false;

  /**
   * Initialize policy from backend
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      // TODO: Replace with actual API call when endpoint exists
      // const response = await api.get<ChecklistStatePolicy>('/api/v1/checklists/state-policy');
      // this.policy = response.data;
      // For now, use a minimal inline fallback
      this.policy = this.fallbackPolicy();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to load checklist state policy:', error);
      // Fallback to minimal policy
      this.policy = this.fallbackPolicy();
      this.initialized = true;
    }
  }

  /**
   * Get all allowed transitions from a state
   */
  getAllowedTransitions(fromState: State): Transition[] {
    if (!this.policy) return [];
    const stateDef = this.policy.states[fromState];
    return stateDef?.allowed_transitions || [];
  }

  /**
   * Check if a transition is allowed
   */
  canTransition(fromState: State, toState: State): boolean {
    return this.getAllowedTransitions(fromState).includes(toState);
  }

  /**
   * Get transition definition
   */
  getTransition(fromState: State, toState: State): ChecklistStatePolicy['transitions'][Transition] | null {
    if (!this.policy) return null;
    const key = `${fromState}->${toState}`;
    return this.policy.transitions[key] || null;
  }

  /**
   * Determine if comment is required for a transition
   */
  requiresComment(fromState: State, toState: State): boolean {
    const transition = this.getTransition(fromState, toState);
    return Boolean(transition?.requires_comment);
  }

  /**
   * Determine if reason is required for a transition
   */
  requiresReason(fromState: State, toState: State): boolean {
    const transition = this.getTransition(fromState, toState);
    return Boolean(transition?.requires_reason);
  }

  /**
   * Get required fields for a state
   */
  getRequiredFields(state: State): string[] {
    if (!this.policy) return [];
    const stateDef = this.policy.states[state];
    return stateDef?.required_fields || [];
  }

  /**
   * Get allowed capabilities for a transition
   */
  getAllowedCapabilities(fromState: State, toState: State): string[] {
    const transition = this.getTransition(fromState, toState);
    return transition?.allowed_capabilities || [];
  }

  /**
   * Get state label for UI
   */
  getStateLabel(state: State): string {
    if (!this.policy) return state;
    const stateDef = this.policy.states[state];
    return stateDef?.label || state;
  }

  /**
   * Get state description for UI
   */
  getStateDescription(state: State): string {
    if (!this.policy) return '';
    const stateDef = this.policy.states[state];
    return stateDef?.description || '';
  }

  /**
   * Get transition label for UI
   */
  getTransitionLabel(fromState: State, toState: State): string {
    const transition = this.getTransition(fromState, toState);
    return transition?.label || `Move to ${toState}`;
  }

  /**
   * Minimal fallback policy for safety
   */
  private fallbackPolicy(): ChecklistStatePolicy {
    return {
      states: {
        OPEN: {
          label: 'Open',
          description: 'Checklist is open and ready to start',
          allowed_transitions: ['IN_PROGRESS'],
          required_fields: [],
          allowed_roles: [],
        },
        IN_PROGRESS: {
          label: 'In Progress',
          description: 'Checklist is being worked on',
          allowed_transitions: ['COMPLETED', 'CLOSED_BY_EXCEPTION'],
          required_fields: [],
          allowed_roles: [],
        },
        COMPLETED: {
          label: 'Completed',
          description: 'Checklist completed successfully',
          allowed_transitions: [],
          required_fields: [],
          allowed_roles: [],
        },
        CLOSED_BY_EXCEPTION: {
          label: 'Closed by Exception',
          description: 'Checklist closed due to exceptions',
          allowed_transitions: [],
          required_fields: [],
          allowed_roles: [],
        },
      },
      transitions: {
        'OPEN->IN_PROGRESS': {
          from: 'OPEN',
          to: 'IN_PROGRESS',
          label: 'Start Checklist',
          requires_comment: false,
          requires_reason: false,
          allowed_capabilities: ['START_CHECKLIST'],
        },
        'IN_PROGRESS->COMPLETED': {
          from: 'IN_PROGRESS',
          to: 'COMPLETED',
          label: 'Complete Checklist',
          requires_comment: false,
          requires_reason: false,
          allowed_capabilities: ['COMPLETE_CHECKLIST'],
        },
        'IN_PROGRESS->CLOSED_BY_EXCEPTION': {
          from: 'IN_PROGRESS',
          to: 'CLOSED_BY_EXCEPTION',
          label: 'Close with Exceptions',
          requires_comment: true,
          requires_reason: true,
          allowed_capabilities: ['CLOSE_CHECKLIST_EXCEPTION'],
        },
      },
    };
  }

  /**
   * Reset policy (for testing or re-initialization)
   */
  reset(): void {
    this.policy = null;
    this.initialized = false;
  }
}

export const checklistStatePolicy = new ChecklistStatePolicyManager();
