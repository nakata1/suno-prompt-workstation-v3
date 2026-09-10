import { SelectionState } from './types';
import { MusicBlueprint } from './musicBlueprint';
import {
  compileSunoPrompt,
  recommendSunoSettings,
  buildSunoExportPack,
  buildSunoPackage,
  formatFullSunoPackageText,
  SunoCompiledPrompt,
  SunoModelProfile,
  SunoSettingsRecommendation,
  SunoPackage
} from './sunoPromptCompiler';

export {
  compileSunoPrompt,
  recommendSunoSettings,
  buildSunoExportPack,
  buildSunoPackage,
  formatFullSunoPackageText
};
export type {
  SunoCompiledPrompt,
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
  modelProfile: SunoModelProfile = 'auto',
  inputBlueprint?: MusicBlueprint
): string => {
  const result = compileSunoPrompt(idea, optimizedIdea, selections, modelProfile, inputBlueprint);
  return result.stylePrompt;
};
