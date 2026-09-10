/**
 * Authoritative Vocal Constraint Enforcement System
 * 
 * Hierarchy of Authority:
 * EXPLICIT USER VOCAL CONSTRAINT > MUSIC INTENT BLUEPRINT > AI INFERENCE > GENRE DEFAULTS > GENERIC DEFAULTS
 * 
 * Ensures strict vocal constraint propagation across Gemini AI path and Local Fallback path.
 */

import { MusicBlueprint } from './musicBlueprint';
import { UserIntentProfile, extractExclusions } from './musicQualityEngine';
import { SelectionState, CategoryKey } from './types';

export type VocalAuthorityType = 'instrumental' | 'female' | 'male' | 'mixed' | 'unspecified';

export interface VocalAuthorityAnalysis {
  authority: VocalAuthorityType;
  explicitSource: 'user_prompt' | 'blueprint' | 'intent_profile' | 'unspecified';
  allowFemale: boolean;
  allowMale: boolean;
  allowVocals: boolean;
  isInstrumental: boolean;
  textures: string[];
}

/**
 * Deterministically determines vocal authority following the strict hierarchy:
 * EXPLICIT USER VOCAL CONSTRAINT > MUSIC INTENT BLUEPRINT > AI INFERENCE > GENRE DEFAULTS > GENERIC DEFAULTS
 */
export const determineVocalAuthority = (
  rawInput: string,
  blueprint?: MusicBlueprint,
  profile?: UserIntentProfile
): VocalAuthorityAnalysis => {
  const inputLower = (rawInput || '').toLowerCase();
  const exclusions = extractExclusions(rawInput || '');
  const positiveText = exclusions.positiveText.toLowerCase();

  // 1. EXPLICIT USER VOCAL CONSTRAINT (Raw Input & Exclusions)
  const isExplicitInstrumental =
    exclusions.excludeVocals ||
    /\b(?:không\s+(?:lời|vocal|hát)|khong\s+(?:loi|vocal|hat)|nhạc\s+không\s+lời|nhac\s+khong\s+loi|instrumental|no\s+vocals?|without\s+vocals?|zero\s+vocals?)\b/i.test(inputLower);

  const isExplicitDuet =
    /\b(?:song\s*ca|duet|nam\s*nữ|nam\s*nu|both\s*male\s*and\s*female|male\s*(?:and|&)\s*female|female\s*(?:and|&)\s*male|mixed\s*vocals?)\b/i.test(positiveText);

  const isExplicitFemale =
    !exclusions.excludeFemaleVocal &&
    /\b(?:giọng\s*nữ|giong\s*nu|vocal\s*nữ|vocal\s*nu|nữ\s*hát|nu\s*hat|female\s*vocals?|female\s*voice|female\s*hooks?|female\s*lead|female\s*singer|\bfemale\b)\b/i.test(positiveText);

  const isExplicitMale =
    !exclusions.excludeMaleVocal &&
    /\b(?:giọng\s*nam|giong\s*nam|vocal\s*nam|nam\s*hát|nam\s*hat|(?<!fe)male\s*vocals?|(?<!fe)male\s*voice|(?<!fe)male\s*lead|(?<!fe)male\s*singer|\b(?<!fe)male\b)\b/i.test(positiveText);

  // Extract explicit vocal textures (only when associated with voice, avoiding instruments like deep sub-bass)
  const textures: string[] = [];
  if (/\b(?:ấm\s*áp|am\s*ap|warm)\b/i.test(positiveText)) textures.push('warm');
  if (/\b(?:mature|trưởng\s*thành|chững\s*chạc)\b/i.test(positiveText)) textures.push('mature');
  if (/\b(?:airy|thoáng\s*nhẹ|breathy)\b/i.test(positiveText)) textures.push('airy');
  if (/\b(?:raspy|khàn|gritty)\b/i.test(positiveText)) textures.push('raspy');
  if (/\b(?:deep|trầm)\s+(?:voice|vocal|tone|giọng)|giọng\s+trầm\b/i.test(positiveText)) textures.push('deep');
  if (/\b(?:operatic|opera)\b/i.test(positiveText)) textures.push('operatic');

  if (isExplicitInstrumental) {
    return {
      authority: 'instrumental',
      explicitSource: 'user_prompt',
      allowFemale: false,
      allowMale: false,
      allowVocals: false,
      isInstrumental: true,
      textures: [],
    };
  }

  if (isExplicitDuet || (isExplicitFemale && isExplicitMale)) {
    return {
      authority: 'mixed',
      explicitSource: 'user_prompt',
      allowFemale: true,
      allowMale: true,
      allowVocals: true,
      isInstrumental: false,
      textures,
    };
  }

  if (isExplicitFemale && !isExplicitMale) {
    return {
      authority: 'female',
      explicitSource: 'user_prompt',
      allowFemale: true,
      allowMale: false,
      allowVocals: true,
      isInstrumental: false,
      textures,
    };
  }

  if (isExplicitMale && !isExplicitFemale) {
    return {
      authority: 'male',
      explicitSource: 'user_prompt',
      allowFemale: false,
      allowMale: true,
      allowVocals: true,
      isInstrumental: false,
      textures,
    };
  }

  // 2. MUSIC INTENT BLUEPRINT
  if (blueprint) {
    if (blueprint.vocals.presence === 'instrumental') {
      return {
        authority: 'instrumental',
        explicitSource: 'blueprint',
        allowFemale: false,
        allowMale: false,
        allowVocals: false,
        isInstrumental: true,
        textures: [],
      };
    }
    if (blueprint.vocals.gender === 'mixed') {
      return {
        authority: 'mixed',
        explicitSource: 'blueprint',
        allowFemale: true,
        allowMale: true,
        allowVocals: true,
        isInstrumental: false,
        textures: blueprint.vocals.character || textures,
      };
    }
    if (blueprint.vocals.gender === 'female') {
      return {
        authority: 'female',
        explicitSource: 'blueprint',
        allowFemale: true,
        allowMale: false,
        allowVocals: true,
        isInstrumental: false,
        textures: blueprint.vocals.character || textures,
      };
    }
    if (blueprint.vocals.gender === 'male') {
      return {
        authority: 'male',
        explicitSource: 'blueprint',
        allowFemale: false,
        allowMale: true,
        allowVocals: true,
        isInstrumental: false,
        textures: blueprint.vocals.character || textures,
      };
    }
  }

  // 3. AI INFERENCE / INTENT PROFILE
  if (profile) {
    if (profile.isInstrumental) {
      return {
        authority: 'instrumental',
        explicitSource: 'intent_profile',
        allowFemale: false,
        allowMale: false,
        allowVocals: false,
        isInstrumental: true,
        textures: [],
      };
    }
    if (profile.vocalGender === 'duet' || profile.vocalGender === 'choir') {
      return {
        authority: 'mixed',
        explicitSource: 'intent_profile',
        allowFemale: true,
        allowMale: true,
        allowVocals: true,
        isInstrumental: false,
        textures: profile.vocalTexture || textures,
      };
    }
    if (profile.vocalGender === 'female') {
      return {
        authority: 'female',
        explicitSource: 'intent_profile',
        allowFemale: true,
        allowMale: false,
        allowVocals: true,
        isInstrumental: false,
        textures: profile.vocalTexture || textures,
      };
    }
    if (profile.vocalGender === 'male') {
      return {
        authority: 'male',
        explicitSource: 'intent_profile',
        allowFemale: false,
        allowMale: true,
        allowVocals: true,
        isInstrumental: false,
        textures: profile.vocalTexture || textures,
      };
    }
  }

  return {
    authority: 'unspecified',
    explicitSource: 'unspecified',
    allowFemale: true,
    allowMale: true,
    allowVocals: true,
    isInstrumental: false,
    textures,
  };
};

/**
 * Sanitizes selected and inferred vocal tags based on authoritative vocal state.
 */
export const sanitizeSelectionsByVocalAuthority = <T extends Partial<Record<CategoryKey, string[]>>>(
  selections: T,
  vocalAuth: VocalAuthorityAnalysis
): T => {
  const result: any = { ...selections };

  if (vocalAuth.authority === 'instrumental') {
    // 1. Purge all vocal tags
    result.vocals = [];
    // Ensure structure includes Instrumental
    if (Array.isArray(result.structure) && !result.structure.includes('Instrumental')) {
      result.structure = [...result.structure, 'Instrumental'];
    }
    // Clean vocal leakage from other categories
    (['production', 'mixingPresets', 'animeDrama', 'v5Performance', 'effects'] as CategoryKey[]).forEach(cat => {
      if (Array.isArray(result[cat])) {
        result[cat] = result[cat].filter((t: string) => !/vocal|choir|voice|vocoder/i.test(t));
      }
    });
    return result;
  }

  if (vocalAuth.authority === 'female') {
    // Female Vocal is authoritative -> strictly purge male vocal descriptors
    if (Array.isArray(result.vocals)) {
      result.vocals = result.vocals.filter((t: string) => !/(?<!fe)male|\bnam\b|deep voice/i.test(t));
      if (!result.vocals.some((t: string) => /female/i.test(t))) {
        result.vocals.unshift('Female Vocal');
      }
    } else {
      result.vocals = ['Female Vocal'];
    }
    return result;
  }

  if (vocalAuth.authority === 'male') {
    // Male Vocal is authoritative -> strictly purge female vocal descriptors
    if (Array.isArray(result.vocals)) {
      result.vocals = result.vocals.filter((t: string) => !/\bfemale\b|\bnữ\b|\bnu\b|idol group/i.test(t));
      if (!result.vocals.some((t: string) => /(?<!fe)male/i.test(t))) {
        result.vocals.unshift('Male Vocal');
      }
    } else {
      result.vocals = ['Male Vocal'];
    }
    return result;
  }

  if (vocalAuth.authority === 'mixed') {
    // Both are allowed and preserved
    return result;
  }

  return result;
};

/**
 * Sanitizes creative direction string according to authoritative vocal state.
 */
export const sanitizeCreativeDirectionByVocalAuthority = (
  cd: string,
  vocalAuth: VocalAuthorityAnalysis
): string => {
  if (!cd) return '';
  let text = cd;

  if (vocalAuth.authority === 'instrumental') {
    // Strip vocal descriptions
    text = text
      .replace(/\b(?:with|featuring|led by)\s+(?:a\s+)?(?:expressive|emotive|warm|airy|clear|deep)?\s*(?:male|female|lead)?\s*vocals?(?:\s*hooks?)?/gi, '')
      .replace(/\bvocal character:[^.]+/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  } else if (vocalAuth.authority === 'female') {
    // Replace conflicting male vocal references
    text = text
      .replace(/\bdeep\s+male\s+vocals?\b/gi, 'female vocal hooks')
      .replace(/\bwarm\s+male\s+vocals?\b/gi, 'expressive female vocal')
      .replace(/\b(?<!fe)male\s+vocals?\b/gi, 'female vocal')
      .replace(/\b(?<!fe)male\s+voice\b/gi, 'female voice')
      .replace(/\bgiọng\s+nam\b/gi, 'giọng nữ');
  } else if (vocalAuth.authority === 'male') {
    // Replace conflicting female vocal references
    text = text
      .replace(/\bfemale\s+vocal\s+hooks?\b/gi, 'male vocal hooks')
      .replace(/\bairy\s+female\s+vocals?\b/gi, 'warm mature male vocal')
      .replace(/\bfemale\s+vocals?\b/gi, 'male vocal')
      .replace(/\bfemale\s+voice\b/gi, 'male voice')
      .replace(/\bgiọng\s+nữ\b/gi, 'giọng nam');
  }

  return text;
};

/**
 * Sanitizes the final prompt string ensuring zero contradiction with vocal authority.
 */
export const sanitizePromptOutputByVocalAuthority = (
  prompt: string,
  vocalAuth: VocalAuthorityAnalysis
): string => {
  if (!prompt) return '';
  let result = prompt;

  if (vocalAuth.authority === 'instrumental') {
    // 1. Remove all Vocal character sentences completely (vocal character is for singing)
    result = result.replace(/Vocal character:[^.]+\.\s*/gi, '');
    // 2. Remove stray vocal references (do not touch "without lead vocals")
    result = result.replace(/\b(?:female|(?<!fe)male)\s*vocals?\b/gi, '');
    result = result.replace(/\bexpressive vocals\b/gi, 'expressive instrumental performance');
    result = result.replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
    return result;
  }

  if (vocalAuth.authority === 'female') {
    // Strictly purge male vocal phrases from prompt
    result = result.replace(/\bdeep\s+male\s+vocals?\b/gi, 'female vocal hooks');
    result = result.replace(/\bwarm\s+mature\s+male\s+vocals?\b/gi, 'clear emotive female vocal');
    result = result.replace(/\b(?<!fe)male\s+vocals?\b/gi, 'female vocal');
    result = result.replace(/\b(?<!fe)male\s+voice\b/gi, 'female voice');
    result = result.replace(/\bgiọng\s+nam\b/gi, 'giọng nữ');

    // Ensure the Vocal character sentence describes a female vocal
    if (result.includes('Vocal character:')) {
      result = result.replace(
        /Vocal character:[^.]+\./i,
        (match) => {
          if (/(?<!fe)male/i.test(match)) {
            return 'Vocal character: female vocal hooks, clear phrasing with emotional nuance.';
          }
          return match;
        }
      );
    }
  } else if (vocalAuth.authority === 'male') {
    // Strictly purge female vocal phrases from prompt
    result = result.replace(/\bfemale\s+vocal\s+hooks?\b/gi, 'male vocal hooks');
    result = result.replace(/\bairy\s+female\s+vocals?\b/gi, 'warm mature male vocal');
    result = result.replace(/\bfemale\s+vocals?\b/gi, 'male vocal');
    result = result.replace(/\bfemale\s+voice\b/gi, 'male voice');
    result = result.replace(/\bgiọng\s+nữ\b/gi, 'giọng nam');

    // Ensure the Vocal character sentence describes a male vocal
    if (result.includes('Vocal character:')) {
      result = result.replace(
        /Vocal character:[^.]+\./i,
        (match) => {
          if (/female/i.test(match)) {
            return 'Vocal character: warm mature male vocal, natural phrasing with heartfelt delivery.';
          }
          return match;
        }
      );
    }
  }

  return result.replace(/\s{2,}/g, ' ').trim();
};
