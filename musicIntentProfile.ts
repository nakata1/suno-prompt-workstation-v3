import { CategoryKey } from './types';
import { MusicBlueprint } from './musicBlueprint';
import { extractExclusions, ExclusionProfile } from './musicQualityEngine';

/**
 * Structured Music Intent Profile (V4.5 - Blueprint Visualizer + Intent Inspector)
 * Single authoritative internal representation of musical intent across Gemini and Local pipelines.
 */
export interface MusicIntentProfile {
  coreGenre: string[];
  subGenres: string[];
  eraStyle: string[];
  moods: string[];
  energy: string[];
  vocals: string[];
  instruments: string[];
  rhythm: string[];
  arrangement: string[];
  production: string[];
  mustInclude: string[];
  mustExclude: string[];
  inferredElements: string[];
  conflicts: string[];
  conflictResolutions?: string[];
  source: 'gemini' | 'local';
  confidence: number;
  fallbackReason?: 'overload' | 'unavailable';
}

/**
 * Extracts explicit positive user constraints from raw input text.
 */
const extractExplicitPositiveElements = (
  positiveText: string,
  exclusions: ExclusionProfile
): string[] => {
  const lower = positiveText.toLowerCase();
  const explicit: string[] = [];

  const add = (item: string) => {
    if (!explicit.includes(item)) explicit.push(item);
  };

  // 1. Instruments
  if (/\b(?:felt\s*piano|piano\s*nỉ)\b/i.test(lower) && !exclusions.excludePiano) add('Felt Piano');
  else if (/\b(?:grand\s*piano|đại\s*dương\s*cầm)\b/i.test(lower) && !exclusions.excludePiano) add('Grand Piano');
  else if (/\bpiano\b/i.test(lower) && !exclusions.excludePiano) add('Piano');

  if (/\b(?:acoustic\s*guitar|guitar\s*acoustic|guitar\s*mộc|guitar\s*thùng)\b/i.test(lower) && !exclusions.excludeAcousticGuitar && !exclusions.excludeGuitar) {
    add('Acoustic Guitar');
  }
  if (/\b(?:heavy\s*electric\s*guitar|distorted\s*guitar|guitar\s*méo\s*tiếng)\b/i.test(lower) && !exclusions.excludeElectricGuitar && !exclusions.excludeGuitar && !exclusions.excludeMetal) {
    add('Heavy Electric Guitar');
  } else if (/\b(?:electric\s*guitar|guitar\s*điện)\b/i.test(lower) && !exclusions.excludeElectricGuitar && !exclusions.excludeGuitar) {
    add('Electric Guitar');
  }

  if (/\b(?:war\s*drums|trống\s*trận|trống\s*chiến)\b/i.test(lower) && !exclusions.excludeWarDrums && !exclusions.excludeHeavyDrums && !exclusions.excludeDrums) {
    add('War Drums');
  } else if (/\b(?:taiko)\b/i.test(lower) && !exclusions.excludeDrums) {
    add('Taiko');
  } else if (/\b(?:timpani|trống\s*định\s*âm)\b/i.test(lower) && !exclusions.excludeDrums) {
    add('Timpani');
  } else if (/\b(?:drum\s*kit|trống|bộ\s*trống)\b/i.test(lower) && !exclusions.excludeDrums && !exclusions.excludeHeavyDrums) {
    add('Drum Kit');
  }

  if (/\b(?:choir|hợp\s*xướng)\b/i.test(lower) && !exclusions.excludeChoir && !exclusions.excludeVocals) {
    add('Choir');
  }

  if (/\b(?:wide\s*supersaw|supersaws?|sawtooth)\b/i.test(lower) && !exclusions.excludeEdm && !exclusions.excludeSynthesizer) {
    add('Supersaw');
  }
  if (/\b(?:sub\s*bass|sub-bass|deep\s*sub-bass)\b/i.test(lower) && !exclusions.excludeEdm && !exclusions.excludeSynthesizer) {
    add('Sub Bass');
  }
  if (/\b(?:synthesizer|synth)\b/i.test(lower) && !exclusions.excludeSynthesizer && !exclusions.excludeEdm) {
    add('Synthesizer');
  }

  if (/\b(?:strings?|dàn\s*dây|string\s*section)\b/i.test(lower) && !exclusions.excludeStrings) {
    add('Strings');
  }
  if (/\b(?:violin)\b/i.test(lower) && !exclusions.excludeStrings) add('Violin');
  if (/\b(?:cello)\b/i.test(lower) && !exclusions.excludeStrings) add('Cello');
  if (/\b(?:brass|kèn\s*đồng)\b/i.test(lower)) add('Brass');
  if (/\b(?:flute|sáo)\b/i.test(lower)) add('Flute');

  if (/\b(?:vinyl\s*texture|vinyl\s*crackle|tiếng\s*đĩa\s*than)\b/i.test(lower) && !exclusions.excludeLofi) {
    add('Vinyl Texture');
  }

  // 2. Vocals
  if (/\b(?:instrumental|không\s*lời|nhạc\s*không\s*lời|no\s*vocals?)\b/i.test(positiveText) || exclusions.excludeVocals) {
    add('Instrumental (Không vocal)');
  } else {
    if (/\b(?:song\s*ca|duet|nam\s*nữ|nam\s*nu|both\s*male\s*and\s*female|male\s*(?:and|&)\s*female|female\s*(?:and|&)\s*male|mixed\s*vocals?)\b/i.test(lower)) {
      add('Duet / Mixed Vocals');
    }
    if (/\b(?:giọng\s*nữ|vocal\s*nữ|nữ\s*hát|female\s*vocals?|female\s*hook|female\s*voice)\b/i.test(lower) && !exclusions.excludeFemaleVocal) {
      add('Female Vocal');
    }
    if (/\b(?:giọng\s*nam|vocal\s*nam|nam\s*hát|(?<!fe)male\s*vocals?|(?<!fe)male\s*voice)\b/i.test(lower) && !exclusions.excludeMaleVocal) {
      add('Male Vocal');
    }
    if (/\b(?:ấm\s*áp|warm\s*vocal)\b/i.test(lower)) add('Warm Vocal');
    if (/\b(?:trưởng\s*thành|mature\s*vocal)\b/i.test(lower)) add('Mature Vocal');
    if (/\b(?:airy|thoáng\s*nhẹ)\b/i.test(lower)) add('Airy Vocal');
  }

  // 3. Arrangement / Energy Cues
  if (/\b(?:mở\s*đầu\s*tối\s*giản|minimal\s*intro)\b/i.test(lower)) add('Minimal Intro');
  if (/\b(?:atmospheric\s*intro)\b/i.test(lower)) add('Atmospheric Intro');
  if (/\b(?:phát\s*triển\s*cảm\s*xúc\s*từ\s*từ|gradual\s*development)\b/i.test(lower)) add('Gradual Development');
  if (/\b(?:cao\s*trào|emotional\s*climax)\b/i.test(lower)) add('Emotional Climax');
  if (/\b(?:explosive\s*drop|bass\s*drop)\b/i.test(lower) && !exclusions.excludeEdm) add('Explosive Drop');
  if (/\b(?:kết\s*thúc\s*nhẹ\s*nhàng|gentle\s*ending)\b/i.test(lower)) add('Gentle Ending');

  return explicit;
};

/**
 * Builds all normalized mustExclude strings from user exclusions.
 */
const buildNormalizedExclusions = (exclusions: ExclusionProfile): string[] => {
  const result: string[] = [];

  const add = (item: string) => {
    if (!result.includes(item)) result.push(item);
  };

  // Add raw exclusions formatted nicely
  exclusions.rawExclusions.forEach(raw => add(raw));

  // Category normalization
  if (exclusions.excludeMetal) add('Heavy Metal');
  if (exclusions.excludeEdm) {
    add('EDM');
    add('Electronic Synth');
  }
  if (exclusions.excludeLofi) add('Lo-Fi');
  if (exclusions.excludeRock) add('Rock');
  if (exclusions.excludeAcoustic) add('Acoustic');
  if (exclusions.excludeHipHop) add('Hip-Hop');
  if (exclusions.excludeGuitar) {
    add('Guitar');
    add('Electric Guitar');
    add('Acoustic Guitar');
  }
  if (exclusions.excludeElectricGuitar) add('Electric Guitar');
  if (exclusions.excludeAcousticGuitar) add('Acoustic Guitar');
  if (exclusions.excludeChoir) add('Choir');
  if (exclusions.excludeVocals) {
    add('Vocals');
    add('Lead Vocals');
  }
  if (exclusions.excludeFemaleVocal) add('Female Vocal');
  if (exclusions.excludeMaleVocal) add('Male Vocal');
  if (exclusions.excludeWarDrums) add('War Drums');
  if (exclusions.excludeHeavyDrums) add('Aggressive Drums');
  if (exclusions.excludeDrums) add('Drums');
  if (exclusions.excludeSynthesizer) {
    add('Electronic Synth');
    add('Synthesizer');
  }
  if (exclusions.excludeStrings) add('Strings');

  return result;
};

/**
 * Detects conflicts between user requests, exclusions, and selections,
 * formulating deterministic resolutions following the 5-tier priority hierarchy:
 * 1. Explicit negative user constraints
 * 2. Explicit positive user constraints
 * 3. Core genre / intent
 * 4. Blueprint defaults
 * 5. AI inferred elements
 */
const detectAndResolveConflicts = (
  rawInput: string,
  exclusions: ExclusionProfile,
  mustInclude: string[],
  mustExclude: string[],
  selections: Partial<Record<CategoryKey, string[]>> = {}
): { conflicts: string[]; conflictResolutions: string[] } => {
  const conflicts: string[] = [];
  const conflictResolutions: string[] = [];
  const lowerInput = rawInput.toLowerCase();

  // Conflict 1: Instrumental vs. Vocals
  const hasInstrumentalDirective =
    exclusions.excludeVocals ||
    /\b(?:instrumental|không\s*lời|nhạc\s*không\s*lời|no\s*vocals?|without\s*vocals?)\b/i.test(rawInput);

  const hasVocalDirective =
    /\b(?:female\s*(?:lead\s*)?vocals?|giọng\s*nữ|male\s*(?:lead\s*)?vocals?|giọng\s*nam|lead\s*vocals?|choir|hợp\s*xướng|tiếng\s*hát)\b/i.test(rawInput) ||
    (Boolean(selections?.vocals && selections.vocals.length > 0) && !hasInstrumentalDirective);

  if (hasInstrumentalDirective && hasVocalDirective) {
    conflicts.push('Nhạc không lời (Instrumental) vs. Giọng hát (Lead Vocals)');
    conflictResolutions.push('Ưu tiên lệnh cấm (1): Giữ định dạng thuần nhạc cụ (Instrumental), tự động loại bỏ giọng hát.');
  }

  // Conflict 2: Excluded Guitar vs. Guitar presence
  if (exclusions.excludeGuitar) {
    const requestedGuitar = mustInclude.find(item => /guitar/i.test(item));
    const selectedGuitar = selections?.instruments?.find(item => /guitar/i.test(item));
    if (requestedGuitar || selectedGuitar) {
      conflicts.push('Yêu cầu loại trừ Guitar vs. Nhạc cụ Guitar');
      conflictResolutions.push('Ưu tiên lệnh loại trừ (1): Đã tự động loại bỏ Guitar khỏi bản phối.');
    }
  } else if (exclusions.excludeElectricGuitar) {
    const requestedElectric = mustInclude.find(item => /electric|distorted/i.test(item));
    const selectedElectric = selections?.instruments?.find(item => /electric|distorted/i.test(item));
    if (requestedElectric || selectedElectric) {
      conflicts.push('Yêu cầu loại trừ Guitar điện vs. Nhạc cụ Guitar điện');
      conflictResolutions.push('Ưu tiên lệnh loại trừ (1): Đã tự động loại bỏ Guitar điện khỏi bản phối.');
    }
  } else if (exclusions.excludeAcousticGuitar) {
    const requestedAcoustic = mustInclude.find(item => /acoustic\s*guitar/i.test(item));
    const selectedAcoustic = selections?.instruments?.find(item => /acoustic\s*guitar/i.test(item));
    if (requestedAcoustic || selectedAcoustic) {
      conflicts.push('Yêu cầu loại trừ Guitar mộc vs. Nhạc cụ Guitar mộc');
      conflictResolutions.push('Ưu tiên lệnh loại trừ (1): Đã tự động loại bỏ Guitar mộc khỏi bản phối.');
    }
  }

  // Conflict 3: Excluded Choir vs. Choir
  if (exclusions.excludeChoir) {
    if (mustInclude.includes('Choir') || selections?.vocals?.includes('Choir') || selections?.instruments?.includes('Choir')) {
      conflicts.push('Yêu cầu loại trừ Hợp xướng (Choir) vs. Choir');
      conflictResolutions.push('Ưu tiên lệnh loại trừ (1): Đã tự động gỡ bỏ Choir khỏi dàn hợp xướng.');
    }
  }

  // Conflict 4: Excluded EDM/Synth vs. Electronic Elements
  if (exclusions.excludeEdm || exclusions.excludeSynthesizer) {
    const hasSynth = selections?.instruments?.some(i => /synthesizer|sawtooth|sub-bass/i.test(i)) ||
      selections?.production?.some(p => /drop|electronic/i.test(p));
    if (hasSynth) {
      conflicts.push('Yêu cầu loại trừ EDM / Synthesizer vs. Yếu tố điện tử');
      conflictResolutions.push('Ưu tiên lệnh loại trừ (1): Loại bỏ synthesizer và hiệu ứng nhạc điện tử.');
    }
  }

  // Conflict 5: Excluded Drums vs. Drums
  if (exclusions.excludeHeavyDrums || exclusions.excludeDrums) {
    const hasHeavyDrums = selections?.instruments?.some(i => /war drums?|808 kick|power drums|taiko/i.test(i));
    if (hasHeavyDrums) {
      conflicts.push('Yêu cầu loại trừ Trống / Tiết tấu mạnh vs. Bộ trống phối');
      conflictResolutions.push('Ưu tiên lệnh loại trừ (1): Đã gỡ bỏ bộ gõ dồn dập.');
    }
  }

  // Conflict 6: Acoustic Ballad vs. Heavy Metal
  if ((/acoustic|ballad|mộc/i.test(lowerInput) && !exclusions.excludeAcoustic) &&
      (selections?.genres?.some(g => /metal/i.test(g)) || selections?.instruments?.some(i => /distorted guitar/i.test(i)))) {
    conflicts.push('Phong cách Mộc (Acoustic) vs. Phối khí Heavy Metal');
    conflictResolutions.push('Ưu tiên phong cách chủ đạo (3): Đã loại bỏ Heavy Metal để giữ chất mộc.');
  }

  return { conflicts, conflictResolutions };
};

/**
 * Builds the authoritative MusicIntentProfile for the CURRENT request and sanitization state.
 * Guaranteed:
 * - Parity across Gemini AI and Local Blueprint fallback paths
 * - Negations have absolute highest priority
 * - Excluded elements never appear in mustInclude or inferredElements
 * - Prevents state leakage across different user requests
 */
export const buildMusicIntentProfile = (
  rawInput: string,
  blueprint: MusicBlueprint,
  selections: Partial<Record<CategoryKey, string[]>> = {},
  source: 'gemini' | 'local' = 'local',
  confidence: number = 0.95,
  fallbackReason?: 'overload' | 'unavailable'
): MusicIntentProfile => {
  const input = (rawInput || '').trim();
  const exclusionsProfile: ExclusionProfile = extractExclusions(input);
  const positiveText = exclusionsProfile.positiveText;

  // 1. Build Negatives (Highest Priority)
  const mustExclude = buildNormalizedExclusions(exclusionsProfile);
  const lowerExcludes = mustExclude.map(e => e.toLowerCase());

  const isExcluded = (item: string): boolean => {
    const lower = item.toLowerCase();
    if (exclusionsProfile.excludeSynthesizer) {
      if (
        /\b(?:synths?|synthesizers?|sawtooth|sub-bass|808\s*bass|reese\s*bass|analog\s*synth|modular\s*synth|wavetable\s*synth|fm\s*synth|moog\s*synth)\b/i.test(lower) ||
        lower.includes('synth') ||
        lower.includes('synthesizer')
      ) {
        return true;
      }
    }
    return lowerExcludes.some(e => lower === e || lower.includes(e) || (e.length >= 3 && lower.includes(e)));
  };

  // 2. Build Explicit Positive Requirements
  const rawExplicit = extractExplicitPositiveElements(positiveText, exclusionsProfile);

  // Filter mustInclude strictly: NEVER contain an excluded element
  const mustInclude = rawExplicit.filter(item => !isExcluded(item));

  // 3. Detect Conflicts and Formulate Resolutions
  const { conflicts, conflictResolutions } = detectAndResolveConflicts(
    input,
    exclusionsProfile,
    mustInclude,
    mustExclude,
    selections
  );

  // If instrumental conflict resolved: ensure mustInclude has Instrumental and NO vocals
  const isInstrumentalResolved = conflicts.some(c => c.includes('Instrumental')) ||
    blueprint.vocals.presence === 'instrumental' ||
    exclusionsProfile.excludeVocals;

  const finalMustInclude = mustInclude.filter(item => {
    if (isInstrumentalResolved && (item.includes('Vocal') || item.includes('Choir'))) return false;
    return true;
  });

  // 4. Inferred Elements: Elements selected by AI/Blueprint that are NOT in mustInclude and NOT in mustExclude
  const inferredElements: string[] = [];
  const addInferred = (item: string) => {
    if (
      !item ||
      isExcluded(item) ||
      finalMustInclude.some(m => m.toLowerCase() === item.toLowerCase()) ||
      inferredElements.includes(item)
    ) {
      return;
    }
    if (isInstrumentalResolved && (item.toLowerCase().includes('vocal') || item.toLowerCase().includes('choir'))) {
      return;
    }
    inferredElements.push(item);
  };

  // Check selected tags for inferred additions
  (selections.instruments || []).forEach(inst => {
    if (!finalMustInclude.some(m => m.toLowerCase() === inst.toLowerCase())) {
      addInferred(inst);
    }
  });

  (selections.genres || []).forEach(genre => {
    if (!finalMustInclude.some(m => m.toLowerCase() === genre.toLowerCase()) && genre !== blueprint.primaryStyle) {
      addInferred(genre);
    }
  });

  (selections.production || []).forEach(prod => {
    if (!finalMustInclude.some(m => m.toLowerCase() === prod.toLowerCase())) {
      addInferred(prod);
    }
  });

  (selections.v5Performance || []).forEach(perf => addInferred(perf));

  // Blueprint optional instruments as inferred if not in selections
  (blueprint.instruments.optional || []).forEach(opt => addInferred(opt));

  // 5. Populate Structured Groups
  // Core & Sub Genres
  const coreGenre = [blueprint.primaryStyle || selections.genres?.[0] || 'Contemporary Pop']
    .filter(g => Boolean(g) && !isExcluded(g));

  const subGenres = (blueprint.secondaryStyles || [])
    .filter(sg => !isExcluded(sg) && !coreGenre.includes(sg));

  // Era Style
  const eraStyle = blueprint.production.era && !isExcluded(blueprint.production.era)
    ? [blueprint.production.era]
    : [];

  // Moods
  const moods = Array.from(new Set([...(selections.moods || []), ...blueprint.moods]))
    .filter(m => !isExcluded(m));

  // Energy
  const energy = [
    blueprint.energy.start ? `Mở đầu: ${blueprint.energy.start}` : '',
    blueprint.energy.middle ? `Phát triển: ${blueprint.energy.middle}` : '',
    blueprint.energy.climax ? `Cao trào: ${blueprint.energy.climax}` : '',
    blueprint.energy.ending ? `Kết thúc: ${blueprint.energy.ending}` : ''
  ].filter(Boolean);

  // Vocals
  const vocals: string[] = [];
  if (isInstrumentalResolved) {
    vocals.push('Instrumental (Nhạc thuần không lời)');
  } else {
    if (blueprint.vocals.gender === 'male') vocals.push('Giọng nam (Male Vocal)');
    else if (blueprint.vocals.gender === 'female') vocals.push('Giọng nữ (Female Vocal)');
    else if (blueprint.vocals.gender === 'mixed') vocals.push('Song ca / Mixed Vocals');

    blueprint.vocals.character.forEach(c => {
      if (!isExcluded(c) && !vocals.includes(c)) vocals.push(c);
    });

    (selections.vocals || []).forEach(v => {
      if (!isExcluded(v) && !vocals.includes(v)) vocals.push(v);
    });
  }

  // Instruments: strictly filtered against exclusions
  const instruments = Array.from(new Set([
    ...blueprint.instruments.required,
    ...(selections.instruments || [])
  ])).filter(inst => !isExcluded(inst));

  // Arrangement
  const arrangement: string[] = [];
  if (blueprint.arrangement.structuralCues && blueprint.arrangement.structuralCues.length > 0) {
    arrangement.push(blueprint.arrangement.structuralCues.join(' → '));
  } else if (selections.structure && selections.structure.length > 0) {
    arrangement.push(selections.structure.join(' → '));
  }

  // Production
  const production = Array.from(new Set([
    ...blueprint.production.orientation,
    ...blueprint.production.texture,
    ...(selections.production || [])
  ])).filter(p => !isExcluded(p));

  // Rhythm
  const rhythm: string[] = [];
  (selections.structure || []).forEach(s => {
    if (s.toLowerCase().includes('tempo') || s.toLowerCase().includes('bpm')) {
      rhythm.push(s);
    }
  });

  // Calculate normalized confidence percentage (integer between 45 and 98)
  const normConfidence = Math.min(98, Math.max(45, Math.round(confidence <= 1 ? confidence * 100 : confidence)));

  return {
    coreGenre,
    subGenres,
    eraStyle,
    moods,
    energy,
    vocals,
    instruments,
    rhythm,
    arrangement,
    production,
    mustInclude: finalMustInclude,
    mustExclude,
    inferredElements,
    conflicts,
    conflictResolutions,
    source,
    confidence: normConfidence,
    fallbackReason
  };
};
