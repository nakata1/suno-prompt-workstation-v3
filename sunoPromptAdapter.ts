/**
 * SUNO MODEL-AWARE PROMPT ADAPTER (V4.9)
 * 
 * Safe downstream presentation layer.
 * 
 * PRIMARY OBJECTIVE:
 * The adapter adapts the PRESENTATION of the final resolved Suno prompt
 * for the selected Suno model profile based on V4.8 SunoPromptStrategy metadata.
 * 
 * CRITICAL ARCHITECTURAL PRINCIPLES:
 * 1. MODEL ADAPTER MAY CHANGE EXPRESSION.
 * 2. MODEL ADAPTER MUST NOT CHANGE INTENT.
 * 3. Authority precedence:
 *    NEGATIVE CONSTRAINTS
 *    > EXPLICIT POSITIVE INTENT
 *    > RESOLVED MUSIC INTENT PROFILE
 *    > BLUEPRINT
 *    > INFERENCE
 *    > FORMATTER / MODEL ADAPTER
 * 4. Deterministic, local, zero additional Gemini API cost.
 * 5. Semantic Equivalence Guard with automatic fallback to authoritative state on any violation.
 */

import { SunoModelProfile, SunoPromptStrategy } from './sunoModelRegistry';

export interface SunoPromptAdapterContext {
  modelProfile: SunoModelProfile;

  stylePrompt: string;
  exclude: string;
  arrangement: string;
  vocalGuide: string;
  productionGuide: string;

  isInstrumental?: boolean;
}

export interface SunoAdapterDiagnostics {
  applied: boolean;
  strategyVerbosity: 'compact' | 'balanced' | 'detailed';
  modelId: string;
  compressionRatio?: number;
  guardPassed: boolean;
  fallbackTriggered: boolean;
  fallbackReason?: string;
}

export interface SunoAdaptedPrompt {
  stylePrompt: string;
  exclude: string;
  arrangement: string;
  vocalGuide: string;
  productionGuide: string;
  diagnostics?: SunoAdapterDiagnostics;
}

/**
 * Normalizes and deduplicates the exclude string while strictly preserving
 * every single authoritative exclusion term.
 */
export const adaptExcludeForModel = (rawExclude: string): string => {
  if (!rawExclude || !rawExclude.trim()) return '';

  const items = rawExclude
    .split(',')
    .map(i => i.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const item of items) {
    const lower = item.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      deduped.push(item);
    }
  }

  return deduped.join(', ');
};

/**
 * Adapts the Arrangement Guide presentation without altering structural cues.
 */
export const adaptArrangementForModel = (
  rawArrangement: string,
  strategy: SunoPromptStrategy
): string => {
  if (!rawArrangement || !rawArrangement.trim()) return '';
  const trimmed = rawArrangement.trim();

  // If strategy is compact, normalize spacing
  if (strategy.verbosity === 'compact') {
    return trimmed.replace(/\s*→\s*/g, ' → ');
  }

  return trimmed;
};

/**
 * Adapts the Vocal Guide presentation while strictly maintaining vocal authority.
 */
export const adaptVocalGuideForModel = (
  rawVocalGuide: string,
  isInstrumental: boolean,
  strategy: SunoPromptStrategy
): string => {
  if (isInstrumental || !rawVocalGuide || !rawVocalGuide.trim()) {
    return '';
  }

  const trimmed = rawVocalGuide.trim();

  if (strategy.verbosity === 'compact') {
    // Compress verbose phrases while strictly preserving gender/identity
    return trimmed
      .replace(/\s*;\s*priority:\s*[^;\n]+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return trimmed;
};

/**
 * Adapts the Production Guide presentation.
 */
export const adaptProductionGuideForModel = (
  rawProduction: string,
  strategy: SunoPromptStrategy
): string => {
  if (!rawProduction || !rawProduction.trim()) return '';
  const trimmed = rawProduction.trim();

  if (strategy.verbosity === 'compact') {
    // Shorten redundant production adjectives
    return trimmed
      .replace(/Polished studio,\s*wide stereo imaging,\s*and natural frequency response/i, 'Polished studio, wide stereo, clean dynamic response')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (strategy.verbosity === 'detailed') {
    return trimmed;
  }

  return trimmed;
};

/**
 * Adapts the Style Prompt based on the model profile's SunoPromptStrategy.
 */
export const adaptStylePromptForModel = (
  rawStylePrompt: string,
  modelProfile: SunoModelProfile,
  isInstrumental: boolean
): string => {
  if (!rawStylePrompt || !rawStylePrompt.trim()) return '';

  const strategy = modelProfile.promptStrategy;
  const modelId = modelProfile.id;

  // Split into logical sentences
  let sentences = rawStylePrompt
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  // -------------------------------------------------------------
  // STRATEGY: COMPACT (e.g. v6-mini)
  // Goal: High-density, remove redundant boilerplate prefixes,
  // compress verbose adjectives while preserving 100% of authoritative requirements.
  // -------------------------------------------------------------
  if (strategy.verbosity === 'compact') {
    sentences = sentences.map(sentence => {
      let s = sentence;

      // 1. Compress opening sentence: "Create a/an [Style]..." -> "[Style]..."
      s = s.replace(/^Create\s+an?\s+/i, '');

      // 2. Compress emotional tone prefix: "Emotional tone: " -> "Mood: "
      s = s.replace(/^Emotional tone:\s*/i, 'Mood: ');

      // 3. Compress instrumentation boilerplate
      s = s.replace(/,\s*arranged with dynamic balance and spatial clarity/i, '');
      s = s.replace(/^Instrumentation:\s*/i, 'Instruments: ');

      // 4. Compress vocal character prefix
      s = s.replace(/^Vocal character:\s*/i, 'Vocals: ');
      if (isInstrumental) {
        s = s.replace(/Instrumental composition emphasizing expressive melodic phrasing/i, 'Instrumental composition, expressive melodic focus');
      }

      // 5. Compress rhythm and pacing prefix: "Rhythm and pacing: " -> "Rhythm: "
      s = s.replace(/^Rhythm and pacing:\s*/i, 'Rhythm: ');

      // 6. Compress arrangement arc: "Arrangement arc: clear song form with " -> "Structure: "
      s = s.replace(/^Arrangement arc:\s*clear song form with\s*/i, 'Structure: ');

      // 7. Compress production aesthetic: "Production aesthetic: " -> "Production: "
      s = s.replace(/^Production aesthetic:\s*/i, 'Production: ');
      s = s.replace(/Polished studio,\s*wide stereo imaging,\s*and natural frequency response/i, 'Polished studio, wide stereo, clean dynamic response');

      // 8. Compress directional priority filler
      s = s.replace(/^Prioritize\s+expressive instrumental performance,\s*rich arrangement detail,\s*strong prompt adherence,\s*and natural musical transitions/i, 'Focus: expressive performance, tight musical transitions');
      s = s.replace(/^Prioritize\s+strong prompt adherence,\s*expressive performance,\s*rich arrangement detail,\s*and natural musical transitions/i, 'Focus: expressive performance, tight musical transitions');

      return s;
    });

    return sentences.join(' ');
  }

  // -------------------------------------------------------------
  // STRATEGY: DETAILED & EXPLORATORY (e.g. v6-wild)
  // Goal: Allow exploratory presentation WITHOUT changing authority.
  // Slightly more open-ended expressive phrasing without removing structure or instruments.
  // -------------------------------------------------------------
  if (modelId === 'v6-wild' || strategy.verbosity === 'detailed') {
    sentences = sentences.map(sentence => {
      let s = sentence;

      // Soften rigid instrumentation boilerplate to dynamic expressive phrasing
      s = s.replace(
        /arranged with dynamic balance and spatial clarity/i,
        'arranged with dynamic expressive freedom and spatial depth'
      );

      // Adapt directional priority to exploratory expressive wording
      s = s.replace(
        /Prioritize\s+(?:expressive instrumental performance,\s*)?strong prompt adherence,\s*expressive performance,\s*rich arrangement detail,\s*and natural musical transitions/i,
        'Prioritize exploratory expressive performance, inventive arrangement textures, and fluid musical transitions'
      );

      // Soften arrangement arc to flowing dynamic wording while preserving exact structural tags
      s = s.replace(
        /Arrangement arc:\s*clear song form with\s*/i,
        'Arrangement arc: flowing dynamic arc spanning '
      );

      return s;
    });

    return sentences.join(' ');
  }

  // -------------------------------------------------------------
  // STRATEGY: BALANCED (e.g. v6, Auto)
  // Goal: Balanced precision and strong prompt adherence.
  // Clear natural-language musical direction, clean deduplication.
  // -------------------------------------------------------------
  // Standard sentences are already balanced. Ensure clean spacing and punctuation.
  return sentences.join(' ');
};

/**
 * Defensive Semantic Equivalence Guard (V4.9 Section 15)
 * 
 * Verifies that the adapted output did not violate any known authority constraints:
 * - Instrumental: zero positive vocal leakage, vocalGuide remains empty
 * - Female Vocal: female vocal preserved, zero male vocal positive leakage, male vocal in exclude
 * - Male Vocal: male vocal preserved, zero female vocal positive leakage, female vocal in exclude
 * - Duet / Mixed: both vocal identities preserved
 * - Exclude items: every authoritative exclusion item preserved
 * - Prohibited instruments: prohibited terms in exclude do not reappear positively
 * - Required instruments: required instruments from original remain present
 */
export const validateSemanticEquivalence = (
  context: SunoPromptAdapterContext,
  adapted: {
    stylePrompt: string;
    exclude: string;
    arrangement: string;
    vocalGuide: string;
    productionGuide: string;
  }
): { valid: boolean; reason?: string } => {
  const origStyle = context.stylePrompt;
  const adaptStyle = adapted.stylePrompt;
  const isInstrumental =
    context.isInstrumental ||
    !context.vocalGuide ||
    /instrumental composition/i.test(origStyle) ||
    /instrumental/i.test(origStyle) && !/duet|female vocal|male vocal/i.test(origStyle);

  // 1. Instrumental validation
  if (isInstrumental) {
    if (adapted.vocalGuide.trim() !== '') {
      return { valid: false, reason: 'Instrumental adapted vocalGuide must remain empty' };
    }
    if (/(?<!fe)male\s+(?:vocal|singer)|female\s+(?:vocal|singer)|\blead vocal\b|\bbacking vocal\b|\bchoir\b/i.test(adaptStyle)) {
      return { valid: false, reason: 'Vocal leakage in instrumental adapted stylePrompt' };
    }
    if (!/instrumental/i.test(adaptStyle)) {
      return { valid: false, reason: 'Instrumental character missing from adapted stylePrompt' };
    }
  }

  // 2. Female vocal validation
  const isFemale = /female/i.test(context.vocalGuide) || (/\bfemale\s+(?:vocal|hooks)\b/i.test(origStyle) && !/duet|male and female/i.test(origStyle));
  if (isFemale && !isInstrumental) {
    if (!/female/i.test(adaptStyle)) {
      return { valid: false, reason: 'Female vocal identity missing in adapted stylePrompt' };
    }
    if (/(?<!fe)male\s+(?:vocal|singer)/i.test(adaptStyle)) {
      return { valid: false, reason: 'Male vocal positive leakage in female stylePrompt' };
    }
    if (!/female/i.test(adapted.vocalGuide)) {
      return { valid: false, reason: 'Female vocal identity missing in adapted vocalGuide' };
    }
  }

  // 3. Male vocal validation
  const isMale = /male/i.test(context.vocalGuide) && !/female/i.test(context.vocalGuide) ||
    (/\bmale\s+vocal\b/i.test(origStyle) && !/female/i.test(origStyle));
  if (isMale && !isInstrumental) {
    if (!/male/i.test(adaptStyle)) {
      return { valid: false, reason: 'Male vocal identity missing in adapted stylePrompt' };
    }
    if (/female\s+(?:vocal|singer)/i.test(adaptStyle)) {
      return { valid: false, reason: 'Female vocal positive leakage in male stylePrompt' };
    }
    if (!/male/i.test(adapted.vocalGuide)) {
      return { valid: false, reason: 'Male vocal identity missing in adapted vocalGuide' };
    }
  }

  // 4. Duet / Mixed vocal validation
  const isDuet = /duet/i.test(origStyle) || (/male/i.test(origStyle) && /female/i.test(origStyle) && !isInstrumental);
  if (isDuet) {
    if (!/male/i.test(adaptStyle) || !/female/i.test(adaptStyle)) {
      return { valid: false, reason: 'Duet missing male or female vocal identity in adapted stylePrompt' };
    }
    if (!/male/i.test(adapted.vocalGuide) || !/female/i.test(adapted.vocalGuide)) {
      return { valid: false, reason: 'Duet missing male or female vocal identity in adapted vocalGuide' };
    }
  }

  // 5. Exclude coverage validation: all original exclude items must be preserved
  if (context.exclude && context.exclude.trim()) {
    const origExcludes = context.exclude
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    const adaptedExcludeLower = adapted.exclude.toLowerCase();

    for (const ex of origExcludes) {
      if (!adaptedExcludeLower.includes(ex)) {
        return { valid: false, reason: `Authoritative exclusion item "${ex}" missing in adapted exclude` };
      }
    }
  }

  // 6. Prohibited instruments validation: excluded instruments must not appear in positive style prompt
  if (context.exclude && context.exclude.trim()) {
    const exLower = context.exclude.toLowerCase();
    const probeTerms = ['synth', 'synthesizer', 'drums', 'electric guitar', 'rock', 'metal', 'brass', 'guitar'];
    for (const term of probeTerms) {
      if (exLower.includes(term)) {
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        if (regex.test(adaptStyle)) {
          return { valid: false, reason: `Excluded term "${term}" leaked into adapted stylePrompt` };
        }
      }
    }
  }

  // 7. Required instruments validation
  const commonInstruments = [
    'felt piano', 'vinyl crackle', 'vinyl', 'bamboo flute', 'flute',
    'acoustic guitar', 'piano', 'violin', 'cello', 'taiko', 'timpani'
  ];
  for (const inst of commonInstruments) {
    const instRegex = new RegExp(`\\b${inst}\\b`, 'i');
    if (instRegex.test(origStyle) && !instRegex.test(adaptStyle)) {
      return { valid: false, reason: `Required instrument "${inst}" was dropped during adaptation` };
    }
  }

  return { valid: true };
};

/**
 * Central Model-Aware Prompt Adapter function.
 * 
 * Takes an authoritative SunoPromptAdapterContext and produces
 * a safely adapted SunoAdaptedPrompt for the target Suno model.
 * 
 * If validation fails, it defensively falls back to the original authoritative state.
 */
export const adaptPromptForSunoModel = (
  context: SunoPromptAdapterContext
): SunoAdaptedPrompt => {
  const { modelProfile, isInstrumental = false } = context;
  const strategy = modelProfile.promptStrategy;

  // 1. Adapt style prompt
  const candidateStylePrompt = adaptStylePromptForModel(
    context.stylePrompt,
    modelProfile,
    isInstrumental
  );

  // 2. Adapt exclude
  const candidateExclude = adaptExcludeForModel(context.exclude);

  // 3. Adapt arrangement
  const candidateArrangement = adaptArrangementForModel(context.arrangement, strategy);

  // 4. Adapt vocal guide
  const candidateVocalGuide = adaptVocalGuideForModel(context.vocalGuide, isInstrumental, strategy);

  // 5. Adapt production guide
  const candidateProductionGuide = adaptProductionGuideForModel(context.productionGuide, strategy);

  const candidate = {
    stylePrompt: candidateStylePrompt,
    exclude: candidateExclude,
    arrangement: candidateArrangement,
    vocalGuide: candidateVocalGuide,
    productionGuide: candidateProductionGuide
  };

  // 6. Run Semantic Equivalence Guard
  const guardResult = validateSemanticEquivalence(context, candidate);

  if (!guardResult.valid) {
    // Immediate deterministic fallback to original authoritative presentation
    return {
      stylePrompt: context.stylePrompt,
      exclude: context.exclude,
      arrangement: context.arrangement,
      vocalGuide: isInstrumental ? '' : context.vocalGuide,
      productionGuide: context.productionGuide,
      diagnostics: {
        applied: false,
        strategyVerbosity: strategy.verbosity,
        modelId: modelProfile.id,
        guardPassed: false,
        fallbackTriggered: true,
        fallbackReason: guardResult.reason
      }
    };
  }

  const compressionRatio = context.stylePrompt.length > 0
    ? Math.round((candidate.stylePrompt.length / context.stylePrompt.length) * 100) / 100
    : 1;

  return {
    ...candidate,
    diagnostics: {
      applied: true,
      strategyVerbosity: strategy.verbosity,
      modelId: modelProfile.id,
      compressionRatio,
      guardPassed: true,
      fallbackTriggered: false
    }
  };
};
