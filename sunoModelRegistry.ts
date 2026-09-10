/**
 * SUNO MODEL CAPABILITY REGISTRY (V4.8)
 * 
 * Central authoritative registry describing supported Suno model profiles,
 * operational capabilities, and prompt strategies.
 * 
 * IMPORTANT ARCHITECTURAL BOUNDARY:
 * Profiles describe MODEL CAPABILITIES ONLY.
 * They MUST NEVER make MusicIntent authority decisions or override:
 * - Negative Constraints
 * - Explicit Positive Intent
 * - Resolved Music Intent Profile
 * - Music Blueprint
 * - Conflict Guards & Sanitizers
 */

export type SunoModelId =
  | 'auto'
  | 'v6'
  | 'v6-wild'
  | 'v6-mini'
  | 'v5.5'
  | string;

export interface SunoModelCapabilities {
  maxDurationMinutes?: number;

  supportsExclude: boolean;
  supportsWeirdness: boolean;
  supportsStyleInfluence: boolean;

  supportsSectionEditing?: boolean;
  supportsMashup?: boolean;
  supportsSampling?: boolean;
  supportsMultimodalInput?: boolean;
  supportsLyricEditing?: boolean;
}

export interface SunoPromptStrategy {
  verbosity:
    | 'compact'
    | 'balanced'
    | 'detailed';

  naturalLanguageStrength:
    | 'low'
    | 'medium'
    | 'high';

  structureTagStrength:
    | 'low'
    | 'medium'
    | 'high';
}

export interface SunoModelProfile {
  id: SunoModelId;
  label: string;
  generation: string;

  description?: string;

  capabilities: SunoModelCapabilities;

  promptStrategy: SunoPromptStrategy;

  status:
    | 'recommended'
    | 'supported'
    | 'legacy'
    | 'experimental';

  aliases?: string[];
}

/**
 * Single authoritative pointer for the currently recommended Suno generation target.
 * Updating this single value propagates through the entire application without
 * requiring changes to authority engines, Blueprints, or prompt compilers.
 */
export const CURRENT_RECOMMENDED_SUNO_MODEL: string = 'v6';

/**
 * Centralized Model Registry
 */
export const SUNO_MODEL_PROFILES: Record<string, SunoModelProfile> = {
  v6: {
    id: 'v6',
    label: 'v6',
    generation: 'v6',
    description: 'Balanced precision and high prompt adherence.',
    capabilities: {
      maxDurationMinutes: undefined,
      supportsExclude: true,
      supportsWeirdness: true,
      supportsStyleInfluence: true,
      supportsSectionEditing: false,
      supportsMashup: false,
      supportsSampling: false,
      supportsMultimodalInput: false,
      supportsLyricEditing: true
    },
    promptStrategy: {
      verbosity: 'balanced',
      naturalLanguageStrength: 'high',
      structureTagStrength: 'medium'
    },
    status: 'recommended',
    aliases: ['v6.0', 'suno-v6']
  },
  'v6-wild': {
    id: 'v6-wild',
    label: 'v6-wild',
    generation: 'v6',
    description: 'More exploratory and creatively variable.',
    capabilities: {
      maxDurationMinutes: undefined,
      supportsExclude: true,
      supportsWeirdness: true,
      supportsStyleInfluence: true,
      supportsSectionEditing: false,
      supportsMashup: false,
      supportsSampling: false,
      supportsMultimodalInput: false,
      supportsLyricEditing: true
    },
    promptStrategy: {
      verbosity: 'detailed',
      naturalLanguageStrength: 'high',
      structureTagStrength: 'medium'
    },
    status: 'experimental',
    aliases: ['v6-experimental', 'v6-wild-mode', 'v6-creative']
  },
  'v6-mini': {
    id: 'v6-mini',
    label: 'v6-mini',
    generation: 'v6',
    description: 'Fast and efficient generation profile.',
    capabilities: {
      maxDurationMinutes: undefined,
      supportsExclude: true,
      supportsWeirdness: true,
      supportsStyleInfluence: true,
      supportsSectionEditing: false,
      supportsMashup: false,
      supportsSampling: false,
      supportsMultimodalInput: false,
      supportsLyricEditing: true
    },
    promptStrategy: {
      verbosity: 'compact',
      naturalLanguageStrength: 'medium',
      structureTagStrength: 'high'
    },
    status: 'supported',
    aliases: ['v6-fast', 'v6-lite']
  },
  'v5.5': {
    id: 'v5.5',
    label: 'v5.5',
    generation: 'v5',
    description: 'Legacy compatibility.',
    capabilities: {
      maxDurationMinutes: undefined,
      supportsExclude: true,
      supportsWeirdness: true,
      supportsStyleInfluence: true,
      supportsSectionEditing: false,
      supportsMashup: false,
      supportsSampling: false,
      supportsMultimodalInput: false,
      supportsLyricEditing: false
    },
    promptStrategy: {
      verbosity: 'balanced',
      naturalLanguageStrength: 'medium',
      structureTagStrength: 'high'
    },
    status: 'legacy',
    aliases: ['legacy-v5.5', 'v5']
  }
};

/**
 * Resolves a model identifier or alias to its authoritative SunoModelProfile.
 * 'auto' dynamically resolves its capabilities from CURRENT_RECOMMENDED_SUNO_MODEL
 * while strictly maintaining its distinct 'Latest / Auto' user-facing identity.
 */
export const resolveSunoModelProfile = (value?: string): SunoModelProfile => {
  const raw = (value || 'auto').trim();
  const lower = raw.toLowerCase();

  // Special handling for 'auto'
  if (lower === 'auto' || lower === 'latest / auto' || lower === 'latest' || lower === 'default') {
    const recommendedTarget = SUNO_MODEL_PROFILES[CURRENT_RECOMMENDED_SUNO_MODEL] || SUNO_MODEL_PROFILES['v6'];
    return {
      id: 'auto',
      label: 'Latest / Auto',
      generation: recommendedTarget.generation,
      description: 'Uses the currently recommended Suno model profile.',
      capabilities: { ...recommendedTarget.capabilities },
      promptStrategy: { ...recommendedTarget.promptStrategy },
      status: 'recommended',
      aliases: ['latest', 'default', 'auto']
    };
  }

  // Direct key lookup
  if (SUNO_MODEL_PROFILES[raw]) {
    return SUNO_MODEL_PROFILES[raw];
  }
  if (SUNO_MODEL_PROFILES[lower]) {
    return SUNO_MODEL_PROFILES[lower];
  }

  // Lookup by label or aliases
  for (const profile of Object.values(SUNO_MODEL_PROFILES)) {
    if (profile.label.toLowerCase() === lower) {
      return profile;
    }
    if (profile.aliases?.some(a => a.toLowerCase() === lower)) {
      return profile;
    }
  }

  // Safe fallback to auto
  return resolveSunoModelProfile('auto');
};

/**
 * Returns the profile for a given model ID.
 */
export const getSunoModelProfile = (modelId: string): SunoModelProfile => {
  return resolveSunoModelProfile(modelId);
};

/**
 * Returns capability flags for a given model ID.
 */
export const getSunoModelCapabilities = (modelId: string): SunoModelCapabilities => {
  return resolveSunoModelProfile(modelId).capabilities;
};

/**
 * Returns the list of standard production models for UI selectors.
 */
export const getAvailableSunoModels = (): SunoModelProfile[] => {
  const autoProfile = resolveSunoModelProfile('auto');
  const orderedIds = ['v6', 'v6-wild', 'v6-mini', 'v5.5'];
  const others = orderedIds
    .map(id => SUNO_MODEL_PROFILES[id])
    .filter(Boolean);

  return [autoProfile, ...others];
};

/**
 * Checks if a model profile is marked as legacy.
 */
export const isLegacySunoModel = (modelId: string): boolean => {
  const profile = resolveSunoModelProfile(modelId);
  return profile.status === 'legacy' || profile.id === 'v5.5';
};

/**
 * Defensive Duration Capability Guard.
 * Clamps requested track duration against model maxDurationMinutes if defined.
 * Preserves current duration if undefined.
 */
export const clampModelDuration = (modelId: string, requestedDuration: number): number => {
  const capabilities = getSunoModelCapabilities(modelId);
  if (capabilities.maxDurationMinutes !== undefined && capabilities.maxDurationMinutes > 0) {
    return Math.min(requestedDuration, capabilities.maxDurationMinutes);
  }
  return requestedDuration;
};

/**
 * Registers a new or future Suno model profile dynamically.
 * Enables zero-touch extensibility for future models (e.g. v6.5, v7, test profiles)
 * without modifying the core Music Intent Authority Engine.
 */
export const registerSunoModelProfile = (profile: SunoModelProfile): void => {
  SUNO_MODEL_PROFILES[profile.id] = profile;
};
