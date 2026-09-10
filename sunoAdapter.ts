import { SelectionState } from './types';
import { MusicBlueprint } from './musicBlueprint';
import {
  compileSunoPrompt,
  recommendSunoSettings,
  buildSunoExportPack,
  buildSunoPackage,
  formatFullSunoPackageText,
  SunoCompiledPrompt,
  SunoModelId,
  SunoModelProfile,
  SunoSettingsRecommendation,
  SunoPackage
} from './sunoPromptCompiler';
import {
  resolveSunoModelProfile,
  getSunoModelProfile,
  getSunoModelCapabilities,
  getAvailableSunoModels,
  isLegacySunoModel,
  clampModelDuration,
  registerSunoModelProfile,
  CURRENT_RECOMMENDED_SUNO_MODEL
} from './sunoModelRegistry';

export {
  compileSunoPrompt,
  recommendSunoSettings,
  buildSunoExportPack,
  buildSunoPackage,
  formatFullSunoPackageText,
  resolveSunoModelProfile,
  getSunoModelProfile,
  getSunoModelCapabilities,
  getAvailableSunoModels,
  isLegacySunoModel,
  clampModelDuration,
  registerSunoModelProfile,
  CURRENT_RECOMMENDED_SUNO_MODEL
};
export type {
  SunoCompiledPrompt,
  SunoModelId,
  SunoModelProfile,
  SunoSettingsRecommendation,
  SunoPackage
};

/**
 * Legacy bridge: Delegates style prompt generation directly to
 * Suno Prompt Compiler V2 for strict intent authority and semantic deduplication.
 */
export const composeSunoStylePrompt = (
  idea: string,
  optimizedIdea: string,
  selections: SelectionState,
  modelProfile: SunoModelId = 'auto',
  inputBlueprint?: MusicBlueprint
): string => {
  const result = compileSunoPrompt(idea, optimizedIdea, selections, modelProfile, inputBlueprint);
  return result.stylePrompt;
};
