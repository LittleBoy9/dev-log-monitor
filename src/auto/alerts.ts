/**
 * Alerting System
 * Send alerts via webhooks, desktop notifications, and custom handlers
 */

import { LogEntry, LogLevel } from '../core/log-entry';
import { metrics, MetricsSnapshot } from './metrics';

export type AlertCondition =
  | { type: 'error_count'; threshold: number; windowMs: number }
  | { type: 'error_rate'; threshold: number } // errors per minute
  | { type: 'pattern'; pattern: RegExp; level?: LogLevel }
  | { type: 'context'; context: string; level: LogLevel }
  | { type: 'slow_operation'; threshold: number } // ms
  | { type: 'custom'; check: (entry: LogEntry) => boolean };

export interface Alert {
  id: string;
  timestamp: number;
  condition: AlertCondition;
  entry?: LogEntry;
  metrics?: MetricsSnapshot;
  message: string;
}

export interface WebhookConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  /** Transform alert before sending */
  transform?: (alert: Alert) => any;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  /** Handlers to invoke when condition is met */
  handlers: Array<'webhook' | 'console' | 'desktop' | string>;
  /** Cooldown period between alerts (ms) */
  cooldownMs?: number;
  /** Whether rule is enabled */
  enabled?: boolean;
}

export interface AlertsConfig {
  /** Webhook configurations */
  webhooks?: Record<string, WebhookConfig>;
  /** Alert rules */
  rules?: AlertRule[];
  /** Global cooldown (ms) */
  globalCooldownMs?: number;
  /** Enable desktop notifications */
  desktopNotifications?: boolean;
}

type AlertHandler = (alert: Alert) => void | Promise<void>;

class AlertsManager {
  private config: AlertsConfig = {};
  private rules: Map<string, AlertRule> = new Map();
  private webhooks: Map<string, WebhookConfig> = new Map();
  private customHandlers: Map<string, AlertHandler> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private errorCountWindow: Array<{ timestamp: number }> = [];

  constructor() {
    // Register built-in handlers
    this.customHandlers.set('console', this.consoleHandler.bind(this));
    this.customHandlers.set('desktop', this.desktopHandler.bind(this));
  }

  /**
   * Configure alerts
   */
  configure(config: AlertsConfig): void {
    this.config = { ...this.config, ...config };

    // Register webhooks
    if (config.webhooks) {
      Object.entries(config.webhooks).forEach(([name, webhook]) => {
        this.webhooks.set(name, webhook);
        // Also register as handler
        this.customHandlers.set(`webhook:${name}`, (alert) => this.sendWebhook(name, alert));
      });
    }

    // Register rules
    if (config.rules) {
      config.rules.forEach(rule => {
        this.rules.set(rule.id, { ...rule, enabled: rule.enabled ?? true });
      });
    }
  }

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, { ...rule, enabled: rule.enabled ?? true });
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Add a webhook
   */
  addWebhook(name: string, config: WebhookConfig): void {
    this.webhooks.set(name, config);
    this.customHandlers.set(`webhook:${name}`, (alert) => this.sendWebhook(name, alert));
  }

  /**
   * Register a custom alert handler
   */
  registerHandler(name: string, handler: AlertHandler): void {
    this.customHandlers.set(name, handler);
  }

  /**
   * Check a log entry against all rules
   */
  checkEntry(entry: LogEntry): void {
    // Track error count for rate-based alerts
    if (entry.level === 'error') {
      this.errorCountWindow.push({ timestamp: Date.now() });
      // Clean old entries (keep last 5 minutes)
      const cutoff = Date.now() - 5 * 60 * 1000;
      this.errorCountWindow = this.errorCountWindow.filter(e => e.timestamp > cutoff);
    }

    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      if (this.checkCondition(rule.condition, entry)) {
        this.triggerAlert(rule, entry);
      }
    }
  }

  /**
   * Check metrics against threshold-based rules
   */
  checkMetrics(snapshot: MetricsSnapshot): void {
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      if (rule.condition.type === 'error_rate') {
        if (snapshot.errorRate >= rule.condition.threshold) {
          this.triggerAlert(rule, undefined, snapshot);
        }
      }
    }
  }

  /**
   * Check if a condition is met
   */
  private checkCondition(condition: AlertCondition, entry: LogEntry): boolean {
    switch (condition.type) {
      case 'pattern':
        if (condition.level && entry.level !== condition.level) return false;
        return condition.pattern.test(entry.message);

      case 'context':
        return entry.context === condition.context && entry.level === condition.level;

      case 'error_count': {
        const cutoff = Date.now() - condition.windowMs;
        const recentErrors = this.errorCountWindow.filter(e => e.timestamp > cutoff);
        return recentErrors.length >= condition.threshold;
      }

      case 'slow_operation':
        if (entry.metadata?.duration && typeof entry.metadata.duration === 'number') {
          return entry.metadata.duration >= condition.threshold;
        }
        return false;

      case 'custom':
        return condition.check(entry);

      default:
        return false;
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, entry?: LogEntry, snapshot?: MetricsSnapshot): Promise<void> {
    // Check cooldown
    const lastAlert = this.lastAlertTime.get(rule.id) || 0;
    const cooldown = rule.cooldownMs || this.config.globalCooldownMs || 60000; // Default 1 minute
    if (Date.now() - lastAlert < cooldown) {
      return;
    }

    this.lastAlertTime.set(rule.id, Date.now());

    const alert: Alert = {
      id: `${rule.id}-${Date.now()}`,
      timestamp: Date.now(),
      condition: rule.condition,
      entry,
      metrics: snapshot,
      message: this.formatAlertMessage(rule, entry, snapshot),
    };

    // Execute handlers
    for (const handlerName of rule.handlers) {
      const handler = this.customHandlers.get(handlerName) ||
                      this.customHandlers.get(`webhook:${handlerName}`);
      if (handler) {
        try {
          await handler(alert);
        } catch (error) {
          console.error(`[dev-log] Alert handler '${handlerName}' failed:`, error);
        }
      }
    }
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(rule: AlertRule, entry?: LogEntry, snapshot?: MetricsSnapshot): string {
    const parts = [`[${rule.name}]`];

    if (entry) {
      parts.push(`${entry.level.toUpperCase()}: ${entry.message}`);
      if (entry.context) parts.push(`(${entry.context})`);
    }

    if (snapshot) {
      parts.push(`Error rate: ${snapshot.errorRate.toFixed(2)}/min`);
    }

    return parts.join(' ');
  }

  /**
   * Console handler
   */
  private consoleHandler(alert: Alert): void {
    const prefix = '\x1b[31m[ALERT]\x1b[0m';
    console.log(`${prefix} ${alert.message}`);
  }

  private desktopNotifierWarned = false;

  /**
   * Desktop notification handler (uses node-notifier if available)
   */
  private async desktopHandler(alert: Alert): Promise<void> {
    if (!this.config.desktopNotifications) return;

    try {
      // Try to use node-notifier if available
      const notifier = require('node-notifier');
      notifier.notify({
        title: 'dev-log Alert',
        message: alert.message,
        sound: true,
      });
    } catch {
      // Warn once so users know desktop notifications aren't working
      if (!this.desktopNotifierWarned) {
        this.desktopNotifierWarned = true;
        console.warn(
          '[dev-log] Desktop notifications require "node-notifier" package. ' +
          'Install it with: npm install node-notifier'
        );
      }
    }
  }

  /**
   * Send webhook
   */
  private async sendWebhook(name: string, alert: Alert): Promise<void> {
    const config = this.webhooks.get(name);
    if (!config) return;

    const body = config.transform ? config.transform(alert) : alert;

    try {
      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error(`[dev-log] Webhook '${name}' failed: ${response.status}`);
      }
    } catch (error) {
      console.error(`[dev-log] Webhook '${name}' error:`, error);
    }
  }

  /**
   * Create common alert rules
   */
  static createErrorRateRule(threshold: number, webhookUrl?: string): AlertRule {
    return {
      id: 'error-rate',
      name: 'High Error Rate',
      condition: { type: 'error_rate', threshold },
      handlers: webhookUrl ? ['console', `webhook:default`] : ['console'],
      cooldownMs: 5 * 60 * 1000, // 5 minutes
    };
  }

  static createPatternRule(id: string, name: string, pattern: RegExp, level?: LogLevel): AlertRule {
    return {
      id,
      name,
      condition: { type: 'pattern', pattern, level },
      handlers: ['console'],
      cooldownMs: 60 * 1000,
    };
  }

  static createSlowOperationRule(threshold: number): AlertRule {
    return {
      id: 'slow-operation',
      name: 'Slow Operation',
      condition: { type: 'slow_operation', threshold },
      handlers: ['console'],
      cooldownMs: 30 * 1000,
    };
  }
}

// Singleton instance
export const alerts = new AlertsManager();

// Convenience exports
export const configureAlerts = (config: AlertsConfig) => alerts.configure(config);
export const addAlertRule = (rule: AlertRule) => alerts.addRule(rule);
export const addWebhook = (name: string, config: WebhookConfig) => alerts.addWebhook(name, config);
