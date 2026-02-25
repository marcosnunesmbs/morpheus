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

/**
 * Check if a configuration value is being overridden by an environment variable.
 * Returns true if the value comes from an environment variable (either provider-specific or generic).
 */
export function isOverriddenByEnv(
  provider: LLMProvider,
  genericEnvVar: string,
  configFileValue: string | undefined
): boolean {
  const providerSpecificVars: Record<LLMProvider, string> = {
    'openai': 'OPENAI_API_KEY',
    'anthropic': 'ANTHROPIC_API_KEY',
    'openrouter': 'OPENROUTER_API_KEY',
    'ollama': '',
    'gemini': 'GOOGLE_API_KEY'
  };

  const providerSpecificVar = providerSpecificVars[provider];

  // Check if provider-specific variable is set
  if (providerSpecificVar && process.env[providerSpecificVar]) {
    return true;
  }

  // Check if generic variable is set
  if (process.env[genericEnvVar]) {
    return true;
  }

  return false;
}

/**
 * Check if a generic configuration value is being overridden by an environment variable.
 */
export function isEnvVarSet(envVarName: string): boolean {
  return process.env[envVarName] !== undefined && process.env[envVarName] !== '';
}

/**
 * Get list of all active environment variable overrides for agent configurations.
 */
export function getActiveEnvOverrides(): Record<string, boolean> {
  const overrides: Record<string, boolean> = {};
  
  // LLM/Oracle
  if (isEnvVarSet('MORPHEUS_LLM_PROVIDER')) overrides['llm.provider'] = true;
  if (isEnvVarSet('MORPHEUS_LLM_MODEL')) overrides['llm.model'] = true;
  if (isEnvVarSet('MORPHEUS_LLM_TEMPERATURE')) overrides['llm.temperature'] = true;
  if (isEnvVarSet('MORPHEUS_LLM_MAX_TOKENS')) overrides['llm.max_tokens'] = true;
  if (isEnvVarSet('MORPHEUS_LLM_API_KEY')) overrides['llm.api_key'] = true;
  if (isEnvVarSet('MORPHEUS_LLM_CONTEXT_WINDOW')) overrides['llm.context_window'] = true;
  
  // Provider-specific API keys
  if (isEnvVarSet('OPENAI_API_KEY')) overrides['llm.api_key_openai'] = true;
  if (isEnvVarSet('ANTHROPIC_API_KEY')) overrides['llm.api_key_anthropic'] = true;
  if (isEnvVarSet('GOOGLE_API_KEY')) overrides['llm.api_key_gemini'] = true;
  if (isEnvVarSet('OPENROUTER_API_KEY')) overrides['llm.api_key_openrouter'] = true;
  
  // Sati
  if (isEnvVarSet('MORPHEUS_SATI_PROVIDER')) overrides['sati.provider'] = true;
  if (isEnvVarSet('MORPHEUS_SATI_MODEL')) overrides['sati.model'] = true;
  if (isEnvVarSet('MORPHEUS_SATI_TEMPERATURE')) overrides['sati.temperature'] = true;
  if (isEnvVarSet('MORPHEUS_SATI_API_KEY')) overrides['sati.api_key'] = true;
  
  // Neo
  if (isEnvVarSet('MORPHEUS_NEO_PROVIDER')) overrides['neo.provider'] = true;
  if (isEnvVarSet('MORPHEUS_NEO_MODEL')) overrides['neo.model'] = true;
  if (isEnvVarSet('MORPHEUS_NEO_TEMPERATURE')) overrides['neo.temperature'] = true;
  if (isEnvVarSet('MORPHEUS_NEO_API_KEY')) overrides['neo.api_key'] = true;
  if (isEnvVarSet('MORPHEUS_NEO_PERSONALITY')) overrides['neo.personality'] = true;
  
  // Apoc
  if (isEnvVarSet('MORPHEUS_APOC_PROVIDER')) overrides['apoc.provider'] = true;
  if (isEnvVarSet('MORPHEUS_APOC_MODEL')) overrides['apoc.model'] = true;
  if (isEnvVarSet('MORPHEUS_APOC_TEMPERATURE')) overrides['apoc.temperature'] = true;
  if (isEnvVarSet('MORPHEUS_APOC_API_KEY')) overrides['apoc.api_key'] = true;
  if (isEnvVarSet('MORPHEUS_APOC_WORKING_DIR')) overrides['apoc.working_dir'] = true;
  if (isEnvVarSet('MORPHEUS_APOC_TIMEOUT_MS')) overrides['apoc.timeout_ms'] = true;
  if (isEnvVarSet('MORPHEUS_APOC_PERSONALITY')) overrides['apoc.personality'] = true;
  
  // Trinity
  if (isEnvVarSet('MORPHEUS_TRINITY_PROVIDER')) overrides['trinity.provider'] = true;
  if (isEnvVarSet('MORPHEUS_TRINITY_MODEL')) overrides['trinity.model'] = true;
  if (isEnvVarSet('MORPHEUS_TRINITY_TEMPERATURE')) overrides['trinity.temperature'] = true;
  if (isEnvVarSet('MORPHEUS_TRINITY_API_KEY')) overrides['trinity.api_key'] = true;
  if (isEnvVarSet('MORPHEUS_TRINITY_PERSONALITY')) overrides['trinity.personality'] = true;
  
  // Audio
  if (isEnvVarSet('MORPHEUS_AUDIO_PROVIDER')) overrides['audio.provider'] = true;
  if (isEnvVarSet('MORPHEUS_AUDIO_MODEL')) overrides['audio.model'] = true;
  if (isEnvVarSet('MORPHEUS_AUDIO_API_KEY')) overrides['audio.apiKey'] = true;
  if (isEnvVarSet('MORPHEUS_AUDIO_MAX_DURATION')) overrides['audio.maxDurationSeconds'] = true;
  
  return overrides;
}