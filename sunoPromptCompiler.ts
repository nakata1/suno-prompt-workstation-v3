/**
 * Suno Prompt Compiler V2 (V4.6 Engine)
 * 
 * Deterministic compilation layer that translates resolved MusicIntentProfile
 * and MusicBlueprint into an optimized, coherent Suno-ready package.
 * 
 * Pipeline:
 * USER EXPLICIT INTENT > NEGATIVE/EXCLUDE CONSTRAINTS > RESOLVED MUSIC INTENT PROFILE
 * > MUSIC BLUEPRINT > AI INFERENCE/ENRICHMENT > DEDUPLICATION > FINAL CONFLICT GUARD
 */

import { SelectionState, CategoryKey } from './types';
import { MusicBlueprint, buildMusicBlueprint } from './musicBlueprint';
import { UserIntentProfile, buildUserIntentProfile, extractExclusions } from './musicQualityEngine';
import { MusicIntentProfile, buildMusicIntentProfile } from './musicIntentProfile';
import {
  determineVocalAuthority,
  VocalAuthorityAnalysis,
  sanitizeSelectionsByVocalAuthority
} from './vocalAuthority';
import {
  SunoModelId,
  SunoModelProfile,
  resolveSunoModelProfile,
  clampModelDuration
} from './sunoModelRegistry';
import {
  adaptPromptForSunoModel,
  SunoPromptAdapterContext,
  SunoAdaptedPrompt,
  SunoAdapterDiagnostics
} from './sunoPromptAdapter';

export type { SunoModelId, SunoModelProfile, SunoPromptAdapterContext, SunoAdaptedPrompt, SunoAdapterDiagnostics };
export { resolveSunoModelProfile, clampModelDuration, adaptPromptForSunoModel };

export interface SunoSettingsRecommendation {
  model: string;
  weirdness: number;
  styleInfluence: number;
  durationMinutes: number;
  exclude: string;
  note: string;
}

export interface SunoCompiledPrompt {
  stylePrompt: string;
  excludePrompt: string;
  arrangementGuide: string;
  vocalGuide: string;
  productionGuide: string;
  settings: SunoSettingsRecommendation;
  diagnostics: {
    removedDuplicates: string[];
    blockedConflicts: string[];
    preservedAuthorities: string[];
    warnings: string[];
  };
}

// ============================================================================
// 1. SEMANTIC DEDUPLICATION & CANONICAL NORMALIZATION
// ============================================================================

interface CanonicalFamily {
  canonical: string;
  aliases: RegExp[];
}

const CANONICAL_FAMILIES: CanonicalFamily[] = [
  {
    canonical: 'deep sub-bass',
    aliases: [
      /\bdeep\s+sub[- ]?bass\b/i,
      /\bsub[- ]?bass\b/i,
      /\b808\s+bass\b/i,
      /\breese\s+bass\b/i
    ]
  },
  {
    canonical: 'acoustic guitar',
    aliases: [/\bacoustic\s+guitars?\b/i, /\bguitar\s+mộc\b/i, /\bclassical\s+guitar\b/i]
  },
  {
    canonical: 'electric guitar',
    aliases: [/\belectric\s+guitars?\b/i, /\bdistorted\s+guitars?\b/i, /\bguitar\s+điện\b/i]
  },
  {
    canonical: 'piano',
    aliases: [/\bpianos?\b/i, /\bacoustic\s+piano\b/i, /\bgrand\s+piano\b/i, /\bfelt\s+piano\b/i]
  },
  {
    canonical: 'synthesizer',
    aliases: [/\bsynthesizers?\b/i, /\bsynths?\b/i, /\belectronic\s+synths?\b/i, /\banalog\s+synth\b/i]
  },
  {
    canonical: 'supersaw',
    aliases: [/\bsupersaws?\b/i, /\bwide\s+supersaws?\b/i, /\bsawtooth(?:\s+waves?)?\b/i, /\bsaw\s+wave\b/i]
  },
  {
    canonical: 'strings',
    aliases: [/\bstrings?\b/i, /\bstring\s+section\b/i, /\borchestral\s+strings?\b/i, /\bdàn\s+dây\b/i]
  },
  {
    canonical: 'drums',
    aliases: [/\bdrums?\b/i, /\bdrum\s+kit\b/i, /\bdrum\s+set\b/i, /\bbộ\s+trống\b/i]
  },
  {
    canonical: 'female vocal',
    aliases: [
      /\bfemale\s+vocal\s+hooks?\b/i,
      /\bfemale\s+vocals?\b/i,
      /\bfemale\s+singers?\b/i,
      /\bfemale\s+voice\b/i,
      /\bgiọng\s+nữ\b/i
    ]
  },
  {
    canonical: 'male vocal',
    aliases: [
      /\b(?<!fe)male\s+vocals?\b/i,
      /\b(?<!fe)male\s+singers?\b/i,
      /\b(?<!fe)male\s+voice\b/i,
      /\bgiọng\s+nam\b/i
    ]
  }
];

/**
 * Deduplicates and normalizes list of items using semantic canonical families.
 * Preserves meaningful distinctions (e.g. Rhodes Piano vs Piano, Acoustic vs Electric Guitar).
 */
export const deduplicateSemanticList = (
  rawItems: string[],
  diagnostics?: { removedDuplicates: string[] }
): string[] => {
  const result: string[] = [];
  const claimedFamilies = new Set<string>();
  const seenLower = new Set<string>();

  rawItems.forEach(item => {
    const trimmed = (item || '').trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();

    // Check direct duplicates
    if (seenLower.has(lower)) {
      diagnostics?.removedDuplicates.push(`Duplicate item omitted: "${trimmed}"`);
      return;
    }

    // Check against canonical families
    let matchedFamily: CanonicalFamily | null = null;
    for (const fam of CANONICAL_FAMILIES) {
      if (fam.aliases.some(re => re.test(trimmed))) {
        matchedFamily = fam;
        break;
      }
    }

    if (matchedFamily) {
      if (claimedFamilies.has(matchedFamily.canonical)) {
        diagnostics?.removedDuplicates.push(
          `Semantic duplicate consolidated: "${trimmed}" -> "${matchedFamily.canonical}"`
        );
        return;
      }
      claimedFamilies.add(matchedFamily.canonical);
      // Keep capitalized specific name if available
      const bestName = trimmed.length >= matchedFamily.canonical.length ? trimmed : matchedFamily.canonical;
      result.push(bestName);
      seenLower.add(lower);
      return;
    }

    seenLower.add(lower);
    result.push(trimmed);
  });

  return result;
};

// ============================================================================
// 2. FINAL CONFLICT GUARD
// ============================================================================

/**
 * Deterministic Final Conflict Guard.
 * Inspects all compiled strings immediately prior to returning Suno output.
 * If any forbidden concept entered through AI inference, enrichment, or formatting,
 * it is stripped and logged into blockedConflicts. Negative constraints MUST win.
 */
export const applyFinalConflictGuard = (
  text: string,
  vocalAuth: VocalAuthorityAnalysis,
  profile: UserIntentProfile,
  blueprint: MusicBlueprint,
  diagnostics: { blockedConflicts: string[]; preservedAuthorities: string[] }
): string => {
  if (!text) return '';
  let sanitized = text;

  // 1. Vocal Constraint Guard
  if (vocalAuth.authority === 'instrumental') {
    // Strip negative vocal wording like "without lead vocals", "no lead vocals", "no vocals", "without vocals"
    sanitized = sanitized.replace(/\b(?:without|no|zero)\s+(?:lead\s+)?(?:vocals?|singing)\b/gi, '');

    // Strip unauthorized vocal references (compound phrases first)
    const vocalRegex = /\b(?:featuring|with|led by)?\s*(?:ethereal|expressive|emotive|warm|airy|clear|deep)?\s*(?:female|(?<!fe)male|lead|backing)?\s*(?:vocal\s+textures?|vocal\s+hooks?|vocal\s+chops?|vocals?|singers?|singing|choirs?)\b/gi;
    if (vocalRegex.test(sanitized)) {
      diagnostics.blockedConflicts.push('Blocked unauthorized vocal text in instrumental mode');
      sanitized = sanitized.replace(vocalRegex, '');
    }
    // Remove "Vocal character:" sentence if present
    if (/Vocal character:[^.]+\./i.test(sanitized)) {
      diagnostics.blockedConflicts.push('Blocked Vocal character directive in instrumental mode');
      sanitized = sanitized.replace(/Vocal character:[^.]+\.\s*/gi, '');
    }

    diagnostics.preservedAuthorities.push('Instrumental Authority: Strictly no vocals');
  } else if (vocalAuth.authority === 'female') {
    // Block male vocal leakage (make sure not matching 'female')
    const maleVocalRegex = /\b(?<!fe)male\s*(?:vocals?|voice|lead|singer|hooks?)\b/gi;
    if (maleVocalRegex.test(sanitized)) {
      diagnostics.blockedConflicts.push('Blocked male vocal leakage under Female Vocal Authority');
      sanitized = sanitized.replace(maleVocalRegex, 'female vocal');
    }
    diagnostics.preservedAuthorities.push('Female Vocal Authority');
  } else if (vocalAuth.authority === 'male') {
    // Block female vocal leakage
    const femaleVocalRegex = /\bfemale\s*(?:vocals?|voice|lead|singer|hooks?)\b/gi;
    if (femaleVocalRegex.test(sanitized)) {
      diagnostics.blockedConflicts.push('Blocked female vocal leakage under Male Vocal Authority');
      sanitized = sanitized.replace(femaleVocalRegex, 'male vocal');
    }
    diagnostics.preservedAuthorities.push('Male Vocal Authority');
  } else if (vocalAuth.authority === 'mixed') {
    diagnostics.preservedAuthorities.push('Duet / Mixed Vocal Authority: Both male & female preserved');
  }

  // 2. Synthesizer Negative Constraint Guard
  if (profile.exclusions.excludeSynthesizer) {
    const synthRegex = /\b(?:electronic\s+synths?|synthesizers?|synths?|synth\s+pads?|sawtooth(?:\s+waves?)?|saw\s+wave)\b/gi;
    if (synthRegex.test(sanitized)) {
      diagnostics.blockedConflicts.push('Blocked synthesizer references per negative exclusion constraint');
      sanitized = sanitized.replace(synthRegex, '');
    }
    diagnostics.preservedAuthorities.push('Negative Constraint: No Electronic Synths');
  }

  // 3. Drums / Heavy Drums Negative Constraint Guard
  if (profile.exclusions.excludeHeavyDrums || profile.exclusions.excludeDrums) {
    const heavyDrumRegex = /\b(?:heavy\s+drums?|aggressive\s+(?:drums?|percussion)|war\s+drums?|808\s+kick|power\s+drums?|taiko)\b/gi;
    if (heavyDrumRegex.test(sanitized)) {
      diagnostics.blockedConflicts.push('Blocked heavy drums references per negative exclusion constraint');
      sanitized = sanitized.replace(heavyDrumRegex, '');
    }
    diagnostics.preservedAuthorities.push('Negative Constraint: No Heavy Drums');
  }

  // 4. Electric / Distorted Guitar Negative Constraint Guard
  if (profile.exclusions.excludeElectricGuitar) {
    const electricRegex = /\b(?:electric\s+guitars?|distorted\s+guitars?|overdriven\s+guitar)\b/gi;
    if (electricRegex.test(sanitized)) {
      diagnostics.blockedConflicts.push('Blocked electric guitar references per negative exclusion constraint');
      sanitized = sanitized.replace(electricRegex, '');
    }
    diagnostics.preservedAuthorities.push('Negative Constraint: No Electric Guitar');
  }

  // 5. Acoustic Guitar Negative Constraint Guard
  if (profile.exclusions.excludeAcousticGuitar) {
    const acousticRegex = /\bacoustic\s+guitars?\b/gi;
    if (acousticRegex.test(sanitized)) {
      diagnostics.blockedConflicts.push('Blocked acoustic guitar references per negative exclusion constraint');
      sanitized = sanitized.replace(acousticRegex, '');
    }
    diagnostics.preservedAuthorities.push('Negative Constraint: No Acoustic Guitar');
  }

  // 6. Rock / Metal Negative Constraint Guard
  if (profile.exclusions.excludeRock || profile.exclusions.excludeMetal) {
    const rockMetalRegex = /\b(?:heavy\s+metal|metal|rock|hard\s+rock)\b/gi;
    if (rockMetalRegex.test(sanitized)) {
      diagnostics.blockedConflicts.push('Blocked rock/metal references per negative exclusion constraint');
      sanitized = sanitized.replace(rockMetalRegex, '');
    }
    diagnostics.preservedAuthorities.push('Negative Constraint: No Rock / Metal');
  }

  // 7. Generic excluded keywords from profile
  if (profile.exclusions.excludedKeywords && profile.exclusions.excludedKeywords.length > 0) {
    profile.exclusions.excludedKeywords.forEach(kw => {
      if (kw.length >= 3) {
        const kwRegex = new RegExp(`\\b${kw}\\b`, 'gi');
        // Only strip if not preceded by "no ", "without ", or "without lead "
        const isNegativePhrase = new RegExp(`(?:no|without|zero)\\s+(?:lead\\s+)?${kw}`, 'i').test(sanitized);
        if (kwRegex.test(sanitized) && !isNegativePhrase) {
          diagnostics.blockedConflicts.push(`Blocked excluded keyword "${kw}"`);
          sanitized = sanitized.replace(kwRegex, '');
        }
      }
    });
  }

  // Clean double punctuation, double spaces, and dangling commas
  sanitized = sanitized
    .replace(/\s*,\s*,+/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/:\s*,+/g, ':')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([.,])/g, '$1')
    .trim();

  return sanitized;
};

// ============================================================================
// 3. EXCLUDE COMPILER
// ============================================================================

export const compileSunoExclude = (
  rawInput: string,
  blueprint: MusicBlueprint,
  profile: UserIntentProfile,
  vocalAuth: VocalAuthorityAnalysis,
  selections: SelectionState
): string => {
  const excludeList: string[] = [];

  // Direct transfer of Blueprint explicit exclusions
  if (blueprint.exclusions && blueprint.exclusions.length > 0) {
    excludeList.push(...blueprint.exclusions);
  }

  // Direct transfer of User negative keywords
  if (profile.exclusions.excludedKeywords && profile.exclusions.excludedKeywords.length > 0) {
    excludeList.push(...profile.exclusions.excludedKeywords);
  }

  // Vocal Authority negative constraints
  if (vocalAuth.authority === 'instrumental') {
    excludeList.push('vocals', 'singing', 'choir', 'lead vocal', 'lead vocals');
  } else if (vocalAuth.authority === 'female') {
    excludeList.push('male vocal');
  } else if (vocalAuth.authority === 'male') {
    excludeList.push('female vocal');
  }

  // Synthesizer exclusions
  if (profile.exclusions.excludeSynthesizer) {
    excludeList.push('electronic synths', 'synthesizer', 'synths');
  }

  // Drums exclusions
  if (profile.exclusions.excludeHeavyDrums || profile.exclusions.excludeDrums) {
    excludeList.push('heavy drums', 'aggressive drums');
  }

  // Guitar exclusions
  if (profile.exclusions.excludeElectricGuitar) {
    excludeList.push('electric guitar', 'distorted guitar');
  }
  if (profile.exclusions.excludeAcousticGuitar) {
    excludeList.push('acoustic guitar');
  }

  // Genre exclusions
  if (profile.exclusions.excludeRock) excludeList.push('rock');
  if (profile.exclusions.excludeMetal) excludeList.push('metal', 'heavy metal');

  // Domain-smart defaults for pristine acoustic styles
  const positiveHay = `${profile.exclusions.positiveText} ${Object.values(selections).flat().join(' ')}`.toLowerCase();
  if (/acoustic|folk|ballad|piano/.test(positiveHay) || blueprint.primaryStyle.includes('ballad')) {
    excludeList.push('harsh distortion', 'overly busy drums');
  }
  if (/cinematic|orchestral|classical/.test(positiveHay) || blueprint.primaryStyle.includes('orchestral')) {
    excludeList.push('cheap synth presets');
  }
  if ((/lo-fi|lofi/.test(positiveHay) || blueprint.primaryStyle.includes('Lo-Fi')) && !profile.exclusions.excludeLofi) {
    excludeList.push('over-polished mastering');
  }

  // Normalize & deduplicate
  const seen = new Set<string>();
  const normalized: string[] = [];

  excludeList.forEach(item => {
    const cleaned = item.trim();
    if (!cleaned) return;
    const lower = cleaned.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      // Capitalize first letter of each word cleanly
      const titleCased = cleaned.replace(/\b[a-z]/g, c => c.toUpperCase());
      normalized.push(titleCased);
    }
  });

  return normalized.join(', ');
};

// ============================================================================
// 4. ARRANGEMENT GUIDE COMPILER
// ============================================================================

export const compileArrangementGuide = (
  rawInput: string,
  blueprint: MusicBlueprint,
  selections: SelectionState
): string => {
  // If user explicitly selected structural tags in selectionState
  if (selections.structure && selections.structure.length > 0) {
    const explicitOrder = selections.structure.filter(s => s.startsWith('[') && s.endsWith(']'));
    if (explicitOrder.length >= 2) {
      return explicitOrder.join(' → ');
    }
  }

  // If blueprint has structural cues
  if (blueprint.arrangement.structuralCues && blueprint.arrangement.structuralCues.length > 0) {
    const cues = blueprint.arrangement.structuralCues;
    if (cues.length >= 2) {
      return cues.join(' → ');
    }
  }

  const lowerInput = rawInput.toLowerCase();
  if (/edm|festival|future bass|dance|dubstep|club/i.test(lowerInput) || blueprint.primaryStyle.includes('EDM')) {
    return '[Intro] → [Verse] → [Build-up] → [Drop] → [Verse] → [Build-up] → [Climax Drop] → [Outro]';
  }

  if (/ballad|acoustic|indie folk|duet|singer-songwriter/i.test(lowerInput) || blueprint.primaryStyle.includes('ballad')) {
    return '[Intro] → [Verse 1] → [Chorus] → [Verse 2] → [Chorus] → [Emotional Climax] → [Outro]';
  }

  if (/lo-fi|lofi|chillhop|relaxing/i.test(lowerInput) || blueprint.primaryStyle.includes('Lo-Fi')) {
    return '[Intro] → [Main Theme A] → [Subtle Variation] → [Bridge] → [Theme Recapitulation] → [Fade Outro]';
  }

  return '[Intro] → [Verse 1] → [Chorus] → [Verse 2] → [Chorus] → [Bridge / Climax] → [Outro]';
};

// ============================================================================
// 5. VOCAL GUIDE COMPILER
// ============================================================================

export const compileVocalGuide = (
  vocalAuth: VocalAuthorityAnalysis,
  blueprint: MusicBlueprint,
  profile?: UserIntentProfile
): string => {
  if (vocalAuth.authority === 'instrumental' || blueprint.vocals.presence === 'instrumental') {
    return '';
  }

  if (vocalAuth.authority === 'mixed') {
    return 'Male and female duet with interwoven harmonies and emotional depth.';
  }

  if (vocalAuth.authority === 'female') {
    const textures = vocalAuth.textures.length > 0
      ? vocalAuth.textures.join(', ') + ', '
      : '';
    return `Female lead vocal, ${textures}clear phrasing, emotionally expressive delivery.`;
  }

  if (vocalAuth.authority === 'male') {
    const textures = vocalAuth.textures.length > 0
      ? vocalAuth.textures.join(', ') + ', '
      : 'warm mature tone, ';
    return `Male lead vocal, ${textures}natural phrasing with heartfelt delivery.`;
  }

  if (profile?.vocalGender === 'choir') {
    return 'Soaring choir with harmonic grandeur and commanding resonance.';
  }

  return 'Natural vocal phrasing with emotionally believable delivery.';
};

// ============================================================================
// 6. PRODUCTION GUIDE COMPILER
// ============================================================================

export const compileProductionGuide = (
  blueprint: MusicBlueprint,
  profile: UserIntentProfile,
  selections: SelectionState,
  diagnostics: { blockedConflicts: string[]; preservedAuthorities: string[] }
): string => {
  const parts: string[] = [];

  // Core production traits from Blueprint
  if (blueprint.production.texture && blueprint.production.texture.length > 0) {
    parts.push(...blueprint.production.texture);
  }
  if (blueprint.production.orientation && blueprint.production.orientation.length > 0) {
    parts.push(...blueprint.production.orientation);
  }
  if (selections.production && selections.production.length > 0) {
    parts.push(...selections.production);
  }
  if (selections.mixingPresets && selections.mixingPresets.length > 0) {
    parts.push(...selections.mixingPresets);
  }

  // Filter out buzzwords and excluded terms
  const cleanParts = parts.filter(p => {
    if (/studio quality|masterpiece|high-fidelity/i.test(p)) return false;
    if (profile.exclusions.excludeSynthesizer && /synth/i.test(p)) {
      diagnostics.blockedConflicts.push(`Production guide: blocked "${p}" due to synth exclusion`);
      return false;
    }
    if (profile.exclusions.excludeHeavyDrums && /heavy drum|808/i.test(p)) {
      diagnostics.blockedConflicts.push(`Production guide: blocked "${p}" due to drums exclusion`);
      return false;
    }
    if (profile.exclusions.excludeElectricGuitar && /electric|distorted/i.test(p)) {
      diagnostics.blockedConflicts.push(`Production guide: blocked "${p}" due to electric guitar exclusion`);
      return false;
    }
    return true;
  });

  const deduplicated = Array.from(new Set(cleanParts));
  if (deduplicated.length === 0) {
    return 'Dynamic balance, natural frequency response, and spatial clarity';
  }

  const prodSentence = `${deduplicated.slice(0, 4).join(', ')}, wide stereo imaging, and natural frequency response`;
  return prodSentence;
};

// ============================================================================
// 7. RECOMMENDED SUNO SETTINGS
// ============================================================================

export const recommendSunoSettings = (
  idea: string,
  selections: SelectionState,
  modelProfile: SunoModelId = 'auto',
  inputBlueprint?: MusicBlueprint
): SunoSettingsRecommendation => {
  const rawInput = (idea || '').trim();
  const profile = buildUserIntentProfile(rawInput);
  const blueprint = inputBlueprint || buildMusicBlueprint(rawInput);
  const vocalAuth = determineVocalAuthority(rawInput, blueprint, profile);
  const positiveHay = `${profile.exclusions.positiveText} ${selections.structure.join(' ')} ${selections.moods.join(' ')} ${selections.genres.join(' ')}`.toLowerCase();

  let weirdness = 42;
  let styleInfluence = 78;
  let durationMinutes = 3.5;

  if (/avant-garde|experimental|fusion|progressive|glitch|hyperpop/.test(positiveHay)) {
    weirdness = 65;
    styleInfluence = 68;
    durationMinutes = 4.2;
  } else if (/ballad|pop|acoustic|lo-fi|lofi|bolero|r&b|singer-songwriter/.test(positiveHay) || blueprint.primaryStyle.includes('ballad')) {
    weirdness = 36;
    styleInfluence = 84;
    durationMinutes = 3.8;
  } else if (/edm|techno|dance|synthwave|drum and bass|trance/.test(positiveHay) || blueprint.primaryStyle.includes('EDM')) {
    weirdness = 48;
    styleInfluence = 76;
    durationMinutes = 4.0;
  } else if (/cinematic|orchestral|epic|trailer|battle score/.test(positiveHay) || blueprint.primaryStyle.includes('orchestral')) {
    weirdness = 40;
    styleInfluence = 82;
    durationMinutes = 4.5;
  } else if (/metal|rock|punk/.test(positiveHay) || blueprint.primaryStyle.includes('metal')) {
    weirdness = 44;
    styleInfluence = 80;
    durationMinutes = 3.6;
  }

  // Defensive duration capability guard (V4.8)
  const safeDuration = clampModelDuration(modelProfile, durationMinutes);
  const resolvedModel = resolveSunoModelProfile(modelProfile);

  const excludePrompt = compileSunoExclude(
    rawInput,
    blueprint,
    profile,
    vocalAuth,
    selections
  );

  return {
    model: resolvedModel.label,
    weirdness,
    styleInfluence,
    durationMinutes: safeDuration,
    exclude: excludePrompt,
    note: 'Các giá trị là điểm khởi đầu đề xuất. Sau khi nghe bản đầu tiên, tăng Style Influence nếu Suno đi lệch phong cách; tăng Weirdness nếu kết quả quá an toàn hoặc lặp lại.'
  };
};

// ============================================================================
// 8. MAIN SUNO PROMPT COMPILER V2
// ============================================================================

export const compileSunoPrompt = (
  idea: string,
  optimizedIdea: string,
  selections: SelectionState,
  modelProfile: SunoModelId = 'auto',
  inputBlueprint?: MusicBlueprint,
  inputIntentProfile?: MusicIntentProfile
): SunoCompiledPrompt => {
  const diagnostics: SunoCompiledPrompt['diagnostics'] = {
    removedDuplicates: [],
    blockedConflicts: [],
    preservedAuthorities: [],
    warnings: []
  };

  const rawInput = (idea || '').trim();
  const profile = buildUserIntentProfile(rawInput);
  const blueprint = inputBlueprint || buildMusicBlueprint(rawInput);
  const intentProfile = inputIntentProfile || buildMusicIntentProfile(rawInput, blueprint, selections);
  const vocalAuth = determineVocalAuthority(rawInput, blueprint, profile);
  const cleanSelections = sanitizeSelectionsByVocalAuthority(selections, vocalAuth);

  // 1. Compile Exclude
  const excludePrompt = compileSunoExclude(rawInput, blueprint, profile, vocalAuth, cleanSelections);

  // 2. Compile Arrangement Guide
  const arrangementGuide = compileArrangementGuide(rawInput, blueprint, cleanSelections);

  // 3. Compile Vocal Guide
  const vocalGuide = compileVocalGuide(vocalAuth, blueprint, profile);

  // 4. Compile Production Guide
  const productionGuide = compileProductionGuide(blueprint, profile, cleanSelections, diagnostics);

  // 5. Compile Settings
  const settingsRec: SunoSettingsRecommendation = recommendSunoSettings(
    rawInput,
    cleanSelections,
    modelProfile,
    blueprint
  );

  // 6. Assemble Optimized Style Prompt
  // Priority:
  // 1. Core genre / style identity
  // 2. Primary emotional character
  // 3. Essential instrumentation
  // 4. Vocal identity if applicable
  // 5. Rhythm / energy
  // 6. Arrangement or climax
  // 7. Important production character

  const sentences: string[] = [];

  // 6.1. Core Genre / Primary Style
  const primaryStyle = blueprint.primaryStyle || 'Modern composition';
  const article = /^[aeiou]/i.test(primaryStyle) ? 'an' : 'a';
  let opening = `Create ${article} ${primaryStyle}`;

  // Add progression / climax to opening if specified
  if (blueprint.arrangement.intro || blueprint.arrangement.climax || blueprint.arrangement.ending) {
    const progressionParts = [
      blueprint.arrangement.intro,
      blueprint.arrangement.development,
      blueprint.arrangement.climax,
      blueprint.arrangement.ending
    ].filter(Boolean);
    const instEmphasis = blueprint.instruments.required.length > 0
      ? ` driven by ${blueprint.instruments.required.slice(0, 3).join(', ').toLowerCase()}`
      : '';
    opening += ` featuring ${progressionParts.join(', ')}${instEmphasis}`;
  }
  sentences.push(opening.trim());

  // 6.2. Emotional Atmosphere
  const openingLower = sentences[0].toLowerCase();
  const rawMoods = [...blueprint.moods, ...cleanSelections.moods];
  const deduplicatedMoods = deduplicateSemanticList(rawMoods, diagnostics).filter(m => {
    return !openingLower.includes(m.toLowerCase()) &&
      !blueprint.exclusions.some(ex => ex.toLowerCase() === m.toLowerCase());
  });
  if (deduplicatedMoods.length > 0) {
    sentences.push(`Emotional tone: ${deduplicatedMoods.slice(0, 3).join(', ')}`);
  }

  // 6.3. Essential Instrumentation (Deduplicated)
  // Combine instruments from IntentProfile, Blueprint, and Selections
  const intentInstruments = (intentProfile?.mustInclude || []).filter(item => {
    const itemLower = item.toLowerCase();
    return [
      'piano', 'acoustic guitar', 'electric guitar', 'heavy electric guitar',
      'war drums', 'taiko', 'timpani', 'drum kit', 'supersaw', 'sub bass',
      'synthesizer', 'strings', 'violin', 'cello', 'brass', 'flute', 'vinyl texture'
    ].includes(itemLower);
  });

  const rawInstruments = [
    ...intentInstruments,
    ...blueprint.instruments.required,
    ...cleanSelections.instruments
  ].filter(inst => !blueprint.instruments.excluded.some(ex => ex.toLowerCase() === inst.toLowerCase()));

  const dedupedInstruments = deduplicateSemanticList(rawInstruments, diagnostics);
  if (dedupedInstruments.length > 0) {
    sentences.push(`Instrumentation: ${dedupedInstruments.join(', ')}, arranged with dynamic balance and spatial clarity`);
  }

  // 6.4. Vocal Character
  if (vocalAuth.authority === 'instrumental' || cleanSelections.structure.includes('Instrumental')) {
    sentences.push('Instrumental composition emphasizing expressive melodic phrasing');
  } else if (vocalAuth.authority === 'female') {
    const rawChars = blueprint.vocals.character.length
      ? blueprint.vocals.character
      : (vocalAuth.textures.length ? vocalAuth.textures : []);
    const safeChars = rawChars.filter(c => !/(?<!fe)male|\bdeep\b|\bnam\b/i.test(c));
    const textures = safeChars.length ? safeChars.join(' ') + ' ' : '';
    sentences.push(`Vocal character: ${textures}female vocal hooks, clear phrasing with emotional nuance`);
  } else if (vocalAuth.authority === 'male') {
    const rawChars = blueprint.vocals.character.length
      ? blueprint.vocals.character
      : (vocalAuth.textures.length ? vocalAuth.textures : ['warm', 'mature']);
    const safeChars = rawChars.filter(c => !/female|\bnữ\b|\bnu\b/i.test(c));
    const textures = safeChars.length ? safeChars.join(' ') + ' ' : '';
    sentences.push(`Vocal character: ${textures}male vocal, natural phrasing with heartfelt delivery`);
  } else if (vocalAuth.authority === 'mixed') {
    sentences.push('Vocal character: romantic duet with male and female vocals, interwoven harmonies and emotional depth');
  } else if (blueprint.vocals.gender === 'mixed' || profile.vocalGender === 'choir') {
    sentences.push('Vocal character: soaring choir with harmonic grandeur and commanding resonance');
  } else if (cleanSelections.vocals.length > 0) {
    const safeVocals = deduplicateSemanticList(cleanSelections.vocals, diagnostics);
    sentences.push(`Vocal character: ${safeVocals.join(', ')}, natural phrasing with emotionally believable delivery`);
  }

  // 6.5. Rhythm and Pacing
  const positiveHay = `${profile.exclusions.positiveText} ${cleanSelections.structure.join(' ')} ${cleanSelections.moods.join(' ')}`.toLowerCase();
  let tempoStr = 'moderate tempo with natural, organic rhythmic movement';
  if (/fast|upbeat|energetic|dance|edm|drum and bass|rock|nhanh|sôi động/.test(positiveHay)) {
    tempoStr = 'up-tempo, driving rhythmic pulse';
  } else if (/slow|sad|melanch|ballad|romantic|buồn|chậm|trữ tình/.test(positiveHay)) {
    tempoStr = 'slow to mid-tempo, spacious emotional pulse';
  }
  sentences.push(`Rhythm and pacing: ${tempoStr}`);

  // 6.6. Arrangement Arc
  if (blueprint.arrangement.structuralCues.length > 0) {
    sentences.push(`Arrangement arc: clear song form with ${blueprint.arrangement.structuralCues.join(', ').toLowerCase()}`);
  } else if (cleanSelections.structure.length > 0) {
    sentences.push(`Arrangement arc: clear song form with ${cleanSelections.structure.join(', ').toLowerCase()}`);
  }

  // 6.7. Production Aesthetic
  sentences.push(`Production aesthetic: ${productionGuide}`);

  // 6.8. Directional Priority for Suno
  if (vocalAuth.authority === 'instrumental') {
    sentences.push('Prioritize expressive instrumental performance, rich arrangement detail, strong prompt adherence, and natural musical transitions');
  } else {
    sentences.push('Prioritize strong prompt adherence, expressive performance, rich arrangement detail, and natural musical transitions');
  }

  // Join and run Final Conflict Guard
  const rawStylePrompt = sentences.map(s => s.replace(/[.]+$/, '').trim()).filter(Boolean).join('. ') + '.';
  const sanitizedStylePrompt = applyFinalConflictGuard(
    rawStylePrompt,
    vocalAuth,
    profile,
    blueprint,
    diagnostics
  );

  return {
    stylePrompt: sanitizedStylePrompt,
    excludePrompt,
    arrangementGuide,
    vocalGuide,
    productionGuide,
    settings: settingsRec,
    diagnostics
  };
};

/**
 * Builds a clean, complete structured text package ready to copy directly into Suno.
 */
export const buildSunoPackageText = (compiled: SunoCompiledPrompt, lyrics: string = ''): string => {
  const sections: string[] = [
    '=== STYLE PROMPT (SUNO V2) ===',
    compiled.stylePrompt,
    '',
    '=== EXCLUDE (ADVANCED OPTIONS) ===',
    compiled.excludePrompt || '(none)',
    '',
    '=== ARRANGEMENT GUIDE ===',
    compiled.arrangementGuide,
    '',
    '=== VOCAL GUIDE ===',
    compiled.vocalGuide,
    '',
    '=== PRODUCTION GUIDE ===',
    compiled.productionGuide,
    '',
    '=== RECOMMENDED SUNO SETTINGS ===',
    `Model: ${compiled.settings.model || 'Latest / Auto'}`,
    `Weirdness: ${compiled.settings.weirdness}%`,
    `Style Influence: ${compiled.settings.styleInfluence}%`,
    `Duration: ~${compiled.settings.durationMinutes} min`
  ];

  if (lyrics && lyrics.trim()) {
    sections.push('', '=== LYRICS & STRUCTURE ===', lyrics.trim());
  }

  return sections.join('\n');
};

export interface SunoPackage {
  stylePrompt: string;
  exclude: string;
  arrangement: string;
  vocalGuide: string;
  productionGuide: string;
  settings: {
    weirdness?: number;
    styleInfluence?: number;
    duration?: string;
    model?: string;
  };
  diagnostics?: {
    source: 'gemini' | 'local';
    promptHealth: number;
    confidence?: number;
    preservedAuthorities: string[];
    blockedConflicts: string[];
    removedDuplicates: string[];
    adapter?: SunoAdapterDiagnostics;
  };
}

export const buildSunoExportPack = (
  stylePrompt: string,
  lyrics: string,
  settings: SunoSettingsRecommendation
): string => {
  return [
    '=== SUNO STYLE ===', stylePrompt || '(empty)', '',
    '=== LYRICS ===', lyrics || '(empty)', '',
    '=== ADVANCED OPTIONS (RECOMMENDED) ===',
    `Model: ${settings.model}`,
    `Weirdness: ${settings.weirdness}%`,
    `Style Influence: ${settings.styleInfluence}%`,
    `Duration: ~${settings.durationMinutes} min`,
    `Exclude: ${settings.exclude || '(none)'}`,
    '', settings.note
  ].join('\n');
};

/**
 * Builds the authoritative, downstream SunoPackage structure for inspector & export.
 * Seamlessly integrates the Model-Aware Prompt Adapter (V4.9).
 */
export const buildSunoPackage = (
  compiled: SunoCompiledPrompt,
  source: 'gemini' | 'local' = 'local',
  promptHealth: number = 95,
  confidence?: number,
  modelProfileInput?: SunoModelId
): SunoPackage => {
  const modelId = modelProfileInput || compiled.settings?.model || 'auto';
  const resolvedModel = resolveSunoModelProfile(modelId);

  const isInstrumental =
    !compiled.vocalGuide ||
    /instrumental/i.test(compiled.diagnostics.preservedAuthorities?.join(' ') || '') ||
    compiled.stylePrompt.includes('Instrumental composition');

  // Authoritative inputs to the Model-Aware Prompt Adapter (V4.9)
  const adapterContext: SunoPromptAdapterContext = {
    modelProfile: resolvedModel,
    stylePrompt: compiled.stylePrompt,
    exclude: compiled.excludePrompt,
    arrangement: compiled.arrangementGuide,
    vocalGuide: isInstrumental ? '' : compiled.vocalGuide,
    productionGuide: compiled.productionGuide,
    isInstrumental
  };

  // Run model adaptation with semantic equivalence guard
  const adapted = adaptPromptForSunoModel(adapterContext);

  return {
    stylePrompt: adapted.stylePrompt,
    exclude: adapted.exclude,
    arrangement: adapted.arrangement,
    vocalGuide: adapted.vocalGuide,
    productionGuide: adapted.productionGuide,
    settings: {
      weirdness: compiled.settings.weirdness,
      styleInfluence: compiled.settings.styleInfluence,
      duration: `~${compiled.settings.durationMinutes} min`,
      model: resolvedModel.label,
    },
    diagnostics: {
      source,
      promptHealth,
      confidence,
      preservedAuthorities: Array.from(new Set(compiled.diagnostics.preservedAuthorities || [])),
      blockedConflicts: Array.from(new Set(compiled.diagnostics.blockedConflicts || [])),
      removedDuplicates: Array.from(new Set(compiled.diagnostics.removedDuplicates || [])),
      adapter: adapted.diagnostics
    }
  };
};

/**
 * Produces clean text export for "Copy Full Suno Package" without leaking internal diagnostics.
 */
export const formatFullSunoPackageText = (pkg: SunoPackage): string => {
  const sections: string[] = [];

  if (pkg.stylePrompt && pkg.stylePrompt.trim()) {
    sections.push(`STYLE PROMPT:\n${pkg.stylePrompt.trim()}`);
  }

  if (pkg.exclude && pkg.exclude.trim()) {
    sections.push(`EXCLUDE:\n${pkg.exclude.trim()}`);
  }

  if (pkg.arrangement && pkg.arrangement.trim()) {
    sections.push(`ARRANGEMENT:\n${pkg.arrangement.trim()}`);
  }

  if (pkg.vocalGuide && pkg.vocalGuide.trim()) {
    sections.push(`VOCAL:\n${pkg.vocalGuide.trim()}`);
  }

  if (pkg.productionGuide && pkg.productionGuide.trim()) {
    sections.push(`PRODUCTION:\n${pkg.productionGuide.trim()}`);
  }

  const settingsLines: string[] = ['SETTINGS:'];
  if (pkg.settings.weirdness !== undefined) {
    settingsLines.push(`Weirdness: ${pkg.settings.weirdness}%`);
  }
  if (pkg.settings.styleInfluence !== undefined) {
    settingsLines.push(`Style Influence: ${pkg.settings.styleInfluence}%`);
  }
  if (pkg.settings.duration) {
    settingsLines.push(`Duration: ${pkg.settings.duration}`);
  }
  if (pkg.settings.model) {
    settingsLines.push(`Model: ${pkg.settings.model}`);
  }

  if (settingsLines.length > 1) {
    sections.push(settingsLines.join('\n'));
  }

  return sections.join('\n\n');
};

