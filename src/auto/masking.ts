/**
 * Sensitive Data Masking
 * Automatically redact sensitive information from logs
 */

export interface MaskingOptions {
  /** Enable/disable masking (default: true) */
  enabled?: boolean;
  /** Custom patterns to mask */
  customPatterns?: Array<{
    pattern: RegExp;
    replacement?: string;
    name?: string;
  }>;
  /** Keys that should have their values masked */
  sensitiveKeys?: string[];
  /** Mask full value or partial (default: false for partial) */
  fullMask?: boolean;
  /** Character to use for masking (default: '*') */
  maskChar?: string;
}

// Default sensitive key patterns (case-insensitive matching)
const DEFAULT_SENSITIVE_KEYS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'api-key',
  'apiSecret',
  'api_secret',
  'api-secret',
  'authorization',
  'auth',
  'bearer',
  'credential',
  'private',
  'privateKey',
  'private_key',
  'private-key',
  'accessToken',
  'access_token',
  'access-token',
  'refreshToken',
  'refresh_token',
  'refresh-token',
  'sessionId',
  'session_id',
  'session-id',
  'cookie',
  'jwt',
  'ssn',
  'creditCard',
  'credit_card',
  'credit-card',
  'cardNumber',
  'card_number',
  'card-number',
  'cvv',
  'cvc',
  'pin',
  'accountNumber',
  'account_number',
  'account-number',
  'bankAccount',
  'bank_account',
  'routing',
  'routingNumber',
];

// Built-in patterns for common sensitive data
const BUILT_IN_PATTERNS: Array<{ pattern: RegExp; replacement: string; name: string }> = [
  // Credit card numbers (Visa, MasterCard, Amex, etc.)
  {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '****-****-****-$last4',
    name: 'credit_card',
  },
  // Social Security Numbers (US)
  {
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: '***-**-$last4',
    name: 'ssn',
  },
  // Email addresses (partial mask)
  {
    pattern: /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    replacement: '$first3***@$domain',
    name: 'email',
  },
  // Phone numbers (various formats)
  {
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '***-***-$last4',
    name: 'phone',
  },
  // IPv4 addresses
  {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '***.***.***.***',
    name: 'ip_address',
  },
  // JWT tokens
  {
    pattern: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    replacement: 'eyJ***.[REDACTED]',
    name: 'jwt',
  },
  // Bearer tokens in strings
  {
    pattern: /Bearer\s+[A-Za-z0-9_-]+/gi,
    replacement: 'Bearer [REDACTED]',
    name: 'bearer_token',
  },
  // API keys (common formats)
  {
    pattern: /\b(?:sk|pk|api|key)[-_]?(?:live|test|prod)?[-_]?[A-Za-z0-9]{20,}/gi,
    replacement: '[API_KEY_REDACTED]',
    name: 'api_key',
  },
  // AWS access keys
  {
    pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: '[AWS_KEY_REDACTED]',
    name: 'aws_key',
  },
  // Base64 encoded data that looks like secrets (long strings)
  {
    pattern: /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
    replacement: '[BASE64_REDACTED]',
    name: 'base64_secret',
  },
];

class DataMasker {
  private options: Required<MaskingOptions>;
  private sensitiveKeysSet: Set<string>;
  private allPatterns: Array<{ pattern: RegExp; replacement: string; name: string }>;

  constructor(options: MaskingOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      customPatterns: options.customPatterns || [],
      sensitiveKeys: options.sensitiveKeys || DEFAULT_SENSITIVE_KEYS,
      fullMask: options.fullMask ?? false,
      maskChar: options.maskChar ?? '*',
    };

    // Create lowercase set for case-insensitive key matching
    this.sensitiveKeysSet = new Set(
      [...DEFAULT_SENSITIVE_KEYS, ...this.options.sensitiveKeys].map(k => k.toLowerCase())
    );

    // Combine built-in and custom patterns
    this.allPatterns = [
      ...BUILT_IN_PATTERNS,
      ...this.options.customPatterns.map(p => ({
        pattern: p.pattern,
        replacement: p.replacement || '[REDACTED]',
        name: p.name || 'custom',
      })),
    ];
  }

  /**
   * Update masking options
   */
  configure(options: Partial<MaskingOptions>): void {
    if (options.enabled !== undefined) this.options.enabled = options.enabled;
    if (options.fullMask !== undefined) this.options.fullMask = options.fullMask;
    if (options.maskChar) this.options.maskChar = options.maskChar;

    if (options.sensitiveKeys) {
      options.sensitiveKeys.forEach(k => this.sensitiveKeysSet.add(k.toLowerCase()));
    }

    if (options.customPatterns) {
      options.customPatterns.forEach(p => {
        this.allPatterns.push({
          pattern: p.pattern,
          replacement: p.replacement || '[REDACTED]',
          name: p.name || 'custom',
        });
      });
    }
  }

  /**
   * Check if a key name is sensitive
   */
  isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return this.sensitiveKeysSet.has(lowerKey) ||
      Array.from(this.sensitiveKeysSet).some(sensitive =>
        lowerKey.includes(sensitive) || sensitive.includes(lowerKey)
      );
  }

  /**
   * Mask a string value
   */
  maskString(value: string): string {
    if (!this.options.enabled || !value) return value;

    let masked = value;

    // Apply pattern-based masking
    for (const { pattern, replacement } of this.allPatterns) {
      // Reset pattern's lastIndex for global patterns
      pattern.lastIndex = 0;

      masked = masked.replace(pattern, (match) => {
        // Handle special replacement tokens
        let result = replacement;

        // $last4 - keep last 4 characters
        if (result.includes('$last4')) {
          result = result.replace('$last4', match.slice(-4));
        }

        // $first3 - keep first 3 characters
        if (result.includes('$first3')) {
          result = result.replace('$first3', match.slice(0, 3));
        }

        // $domain - for email, keep domain part
        if (result.includes('$domain')) {
          const atIndex = match.indexOf('@');
          if (atIndex !== -1) {
            result = result.replace('$domain', match.slice(atIndex + 1));
          }
        }

        return result;
      });
    }

    return masked;
  }

  /**
   * Mask a value based on its key name
   */
  maskValue(key: string, value: unknown): unknown {
    if (!this.options.enabled) return value;

    // If key is sensitive, mask the entire value
    if (this.isSensitiveKey(key)) {
      if (typeof value === 'string') {
        if (this.options.fullMask) {
          return this.options.maskChar.repeat(Math.min(value.length, 16));
        }
        // Partial mask: show first 2 and last 2 characters
        if (value.length <= 4) {
          return this.options.maskChar.repeat(value.length);
        }
        return value.slice(0, 2) + this.options.maskChar.repeat(Math.min(value.length - 4, 12)) + value.slice(-2);
      }
      return '[REDACTED]';
    }

    // For non-sensitive keys, only apply pattern matching to strings
    if (typeof value === 'string') {
      return this.maskString(value);
    }

    return value;
  }

  /**
   * Recursively mask an object
   */
  maskObject(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
    if (!this.options.enabled || depth > 10) return obj;

    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        masked[key] = value;
      } else if (Array.isArray(value)) {
        masked[key] = value.map((item, index) => {
          if (typeof item === 'object' && item !== null) {
            return this.maskObject(item as Record<string, unknown>, depth + 1);
          }
          return this.maskValue(`${key}[${index}]`, item);
        });
      } else if (typeof value === 'object') {
        masked[key] = this.maskObject(value as Record<string, unknown>, depth + 1);
      } else {
        masked[key] = this.maskValue(key, value);
      }
    }

    return masked;
  }

  /**
   * Mask any data (string, object, or array)
   */
  mask(data: unknown): unknown {
    if (!this.options.enabled) return data;

    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.maskString(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.mask(item));
    }

    if (typeof data === 'object') {
      return this.maskObject(data as Record<string, unknown>);
    }

    return data;
  }

  /**
   * Enable masking
   */
  enable(): void {
    this.options.enabled = true;
  }

  /**
   * Disable masking
   */
  disable(): void {
    this.options.enabled = false;
  }

  /**
   * Check if masking is enabled
   */
  isEnabled(): boolean {
    return this.options.enabled;
  }
}

// Singleton instance
export const masker = new DataMasker();

// Convenience exports
export const maskData = (data: unknown) => masker.mask(data);
export const configureMasking = (options: Partial<MaskingOptions>) => masker.configure(options);
