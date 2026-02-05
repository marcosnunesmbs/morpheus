/**
 * Functions to resolve configuration values with precedence:
 * 1. Provider-specific environment variable (e.g., OPENAI_API_KEY)
 * 2. Generic environment variable (e.g., MORPHEUS_LLM_API_KEY)
 * 3. Configuration file value
 * 4. Default value
 */

import { LLMProvider } from '../types/config.js';

/**
 * Resolve an API key with provider-specific precedence
 * @param provider The current provider
 * @param genericEnvVar The generic environment variable name
 * @param configFileValue The value from the config file
 * @returns The resolved API key value
 */
export function resolveApiKey(provider: LLMProvider, genericEnvVar: string, configFileValue: string | undefined): string | undefined {
  // Map provider to its specific environment variable
  const providerSpecificVars: Record<LLMProvider, string> = {
    'openai': 'OPENAI_API_KEY',
    'anthropic': 'ANTHROPIC_API_KEY',
    'openrouter': 'OPENROUTER_API_KEY',
    'ollama': '', // Ollama typically doesn't need an API key
    'gemini': 'GOOGLE_API_KEY'
  };

  const providerSpecificVar = providerSpecificVars[provider];
  
  // Check provider-specific variable first, then generic, then config file
  if (providerSpecificVar && process.env[providerSpecificVar]) {
    return process.env[providerSpecificVar];
  }
  
  if (process.env[genericEnvVar]) {
    return process.env[genericEnvVar];
  }
  
  return configFileValue;
}

/**
 * Resolve a model name with provider-specific precedence
 * @param provider The current provider
 * @param genericEnvVar The generic environment variable name
 * @param configFileValue The value from the config file
 * @returns The resolved model name value
 */
export function resolveModel(provider: LLMProvider, genericEnvVar: string, configFileValue: string): string {
  // For now, we don't have provider-specific model variables, but we could add them later
  // Check generic variable first, then config file
  if (process.env[genericEnvVar]) {
    return process.env[genericEnvVar]!;
  }
  
  return configFileValue;
}

/**
 * Resolve a numeric configuration value
 * @param genericEnvVar The generic environment variable name
 * @param configFileValue The value from the config file
 * @param defaultValue The default value to use if none is found
 * @returns The resolved numeric value
 */
export function resolveNumeric(genericEnvVar: string, configFileValue: number | undefined, defaultValue: number): number {
  if (process.env[genericEnvVar] !== undefined && process.env[genericEnvVar] !== '') {
    const envValue = Number(process.env[genericEnvVar]);
    if (!isNaN(envValue)) {
      return envValue;
    }
  }
  
  if (configFileValue !== undefined) {
    return configFileValue;
  }
  
  return defaultValue;
}

/**
 * Resolve a string configuration value
 * @param genericEnvVar The generic environment variable name
 * @param configFileValue The value from the config file
 * @param defaultValue The default value to use if none is found
 * @returns The resolved string value
 */
export function resolveString(genericEnvVar: string, configFileValue: string | undefined, defaultValue: string): string {
  if (process.env[genericEnvVar]) {
    return process.env[genericEnvVar]!;
  }
  
  if (configFileValue !== undefined) {
    return configFileValue;
  }
  
  return defaultValue;
}

/**
 * Resolve a boolean configuration value
 * @param genericEnvVar The generic environment variable name
 * @param configFileValue The value from the config file
 * @param defaultValue The default value to use if none is found
 * @returns The resolved boolean value
 */
export function resolveBoolean(genericEnvVar: string, configFileValue: boolean | undefined, defaultValue: boolean): boolean {
  if (process.env[genericEnvVar] !== undefined) {
    const envValue = process.env[genericEnvVar]?.toLowerCase();
    if (envValue === 'true' || envValue === '1') {
      return true;
    } else if (envValue === 'false' || envValue === '0') {
      return false;
    }
  }
  
  if (configFileValue !== undefined) {
    return configFileValue;
  }
  
  return defaultValue;
}

/**
 * Resolve an array of string configuration value
 * @param genericEnvVar The generic environment variable name
 * @param configFileValue The value from the config file
 * @param defaultValue The default value to use if none is found
 * @returns The resolved array of strings value
 */
export function resolveStringArray(genericEnvVar: string, configFileValue: string[] | undefined, defaultValue: string[]): string[] {
  if (process.env[genericEnvVar]) {
    // Split the environment variable by commas and trim whitespace
    return process.env[genericEnvVar]!.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }
  
  if (configFileValue !== undefined) {
    return configFileValue;
  }
  
  return defaultValue;
}

/**
 * Resolve a provider configuration value
 * @param genericEnvVar The generic environment variable name
 * @param configFileValue The value from the config file
 * @param defaultValue The default value to use if none is found
 * @returns The resolved provider value
 */
export function resolveProvider<T extends LLMProvider>(genericEnvVar: string, configFileValue: T | undefined, defaultValue: T): T {
  if (process.env[genericEnvVar]) {
    return process.env[genericEnvVar] as T;
  }
  
  if (configFileValue !== undefined) {
    return configFileValue;
  }
  
  return defaultValue;
}