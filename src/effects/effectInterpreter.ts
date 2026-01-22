// src/effects/effectInterpreter.ts
// Centralized backend effects interpreter

import React from 'react';
import { BackendEffects } from '../contracts/generated/api.types';

type EffectHandler = (metadata?: Record<string, any>) => void;

class EffectInterpreter {
  private handlers = new Map<string, EffectHandler>();
  private debug = false;

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Enable debug logging
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  /**
   * Register a handler for a specific effect
   */
  registerHandler(effect: string, handler: EffectHandler): void {
    this.handlers.set(effect, handler);
  }

  /**
   * Unregister a handler
   */
  unregisterHandler(effect: string): void {
    this.handlers.delete(effect);
  }

  /**
   * Interpret and dispatch backend effects
   */
  interpret(effects: BackendEffects): void {
    if (!effects.effects || !Array.isArray(effects.effects)) {
      if (this.debug) console.warn('Invalid effects payload:', effects);
      return;
    }

    for (const effect of effects.effects) {
      const handler = this.handlers.get(effect);
      if (handler) {
        try {
          if (this.debug) console.log('Dispatching effect:', effect, effects.metadata);
          handler(effects.metadata);
        } catch (err) {
          console.error(`Error in effect handler for ${effect}:`, err);
        }
      } else {
        if (this.debug) console.warn('No handler for effect:', effect);
      }
    }
  }

  /**
   * Register default effect handlers
   */
  private registerDefaultHandlers(): void {
    // Notification-related effects
    this.registerHandler('NOTIFICATION_CREATED', () => {
      // Trigger notification refresh
      this.dispatchCustomEvent('effect:notification_created');
    });

    this.registerHandler('NOTIFICATION_UPDATED', () => {
      this.dispatchCustomEvent('effect:notification_updated');
    });

    // Checklist effects
    this.registerHandler('CHECKLIST_STARTED', (meta) => {
      this.dispatchCustomEvent('effect:checklist_started', meta);
    });

    this.registerHandler('CHECKLIST_COMPLETED', (meta) => {
      this.dispatchCustomEvent('effect:checklist_completed', meta);
    });

    this.registerHandler('CHECKLIST_EXCEPTION', (meta) => {
      this.dispatchCustomEvent('effect:checklist_exception', meta);
    });

    // Gamification effects
    this.registerHandler('POINTS_AWARDED', (meta) => {
      // Non-authoritative: just trigger a refresh
      this.dispatchCustomEvent('effect:points_awarded', meta);
    });

    this.registerHandler('BADGE_EARNED', (meta) => {
      this.dispatchCustomEvent('effect:badge_earned', meta);
    });

    // Background task effects
    this.registerHandler('BACKGROUND_TASK', (meta) => {
      // Could show a non-blocking toast or update a task queue UI
      this.dispatchCustomEvent('effect:background_task', meta);
    });

    // Dashboard effects
    this.registerHandler('DASHBOARD_REFRESH', () => {
      this.dispatchCustomEvent('effect:dashboard_refresh');
    });

    // Handover effects
    this.registerHandler('HANDOVER_NOTE_CREATED', (meta) => {
      this.dispatchCustomEvent('effect:handover_note_created', meta);
    });
  }

  /**
   * Dispatch custom event for React components to listen to
   */
  private dispatchCustomEvent(type: string, detail?: any): void {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent(type, { detail });
      window.dispatchEvent(event);
    }
  }
}

export const effectInterpreter = new EffectInterpreter();

// Helper hook for React components
export const useEffectListener = (
  effectType: string,
  handler: (event: CustomEvent) => void,
  deps?: React.DependencyList
) => {
  React.useEffect(() => {
    const handleEvent = (e: Event) => handler(e as CustomEvent);
    window.addEventListener(`effect:${effectType}`, handleEvent);
    return () => window.removeEventListener(`effect:${effectType}`, handleEvent);
  }, deps || [effectType, handler]);
};
