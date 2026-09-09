import { CategoryKey, SelectionState } from './types';
import {
  buildUserIntentProfile,
  applyQualityEngine,
  UserIntentProfile,
  hasExplicitSupport,
  isTagExcluded,
  extractExclusions,
} from './musicQualityEngine';

export { buildUserIntentProfile, applyQualityEngine, hasExplicitSupport, isTagExcluded, extractExclusions };
export type { UserIntentProfile };

export type IntentProfile =
  | 'metal_epic'
  | 'acoustic_ballad'
  | 'piano_ballad'
  | 'cinematic_orchestral'
  | 'edm_electronic'
  | 'ambient_meditative'
  | 'lofi_chill'
  | 'rock_energetic'
  | 'hiphop_urban'
  | 'folk_traditional'
  | 'pop_contemporary'
  | 'general_hybrid';

export interface PrimaryIntent {
  label: string;
  profile: IntentProfile;
  descriptor: string;
  atmosphere: string;
  isAcoustic: boolean;
  isIntimate: boolean;
  isHeavy: boolean;
  isElectronic: boolean;
}

export interface RemovedTagReport {
  category: CategoryKey;
  tag: string;
  reason: string;
}

export interface SemanticValidationResult {
  primaryIntent: PrimaryIntent;
  validatedSelections: SelectionState;
  removedTags: RemovedTagReport[];
  coherenceScore: number;
}

export interface PromptHealthResult {
  score: number;
  status: 'Excellent' | 'Good' | 'Needs Review';
  summary: string;
  reasons: string[];
}

export const createEmptySelections = (): SelectionState => ({
  genres: [],
  production: [],
  instruments: [],
  moods: [],
  vocals: [],
  structure: [],
  effects: [],
  v5Advanced: [],
  mixingPresets: [],
  animeDrama: [],
  v5Performance: []
});

/**
 * Primary Intent Lock:
 * Derives a concise, dominant Primary Musical Intent from the user idea,
 * creative direction, initial AI selections, and deterministic User Intent Profile.
 */
export const derivePrimaryIntent = (
  idea: string,
  creativeDirection: string,
  selections: Partial<Record<CategoryKey, string[]>>,
  inputProfile?: UserIntentProfile
): PrimaryIntent => {
  const profile = inputProfile || buildUserIntentProfile(idea);

  // Clean selections: filter out any tags that violate user exclusions before intent derivation
  const cleanGenres = (selections.genres || []).filter(g => !isTagExcluded('genres', g, profile.exclusions));
  const cleanMoods = (selections.moods || []).filter(m => !isTagExcluded('moods', m, profile.exclusions));
  const cleanInst = (selections.instruments || []).filter(i => !isTagExcluded('instruments', i, profile.exclusions));
  const cleanVocals = (selections.vocals || []).filter(v => !isTagExcluded('vocals', v, profile.exclusions));

  const g = cleanGenres.join(' ');
  const m = cleanMoods.join(' ');
  const inst = cleanInst.join(' ');
  const v = cleanVocals.join(' ');

  // CRITICAL: use profile.exclusions.positiveText instead of raw idea so negated keywords NEVER contribute positive score!
  const text = `${profile.exclusions.positiveText} ${creativeDirection} ${g} ${m} ${inst} ${v}`.toLowerCase();

  // 1. Nordic / Viking / Symphonic / Folk Metal
  const isNordicMythic = profile.culturalStyle === 'nordic' || /viking|bắc âu|nordic|valhalla|dragon|rồng|thần sấm|thor|odin|battle|chiến binh/.test(text);
  const isMetal = !profile.exclusions.excludeMetal && (profile.isMetalOrHeavy || /folk metal|symphonic metal|heavy metal|power metal|death metal|black metal|thrash metal|metalcore|metal/.test(text));
  if (isNordicMythic && isMetal) {
    return {
      label: 'Nordic symphonic folk metal',
      profile: 'metal_epic',
      descriptor: 'epic Nordic symphonic folk-metal track',
      atmosphere: 'icy mythic atmosphere, thunderous war drums, heavy electric guitars, and heroic choir',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: true,
      isElectronic: false,
    };
  }
  if (isMetal) {
    const isSymphonic = /symphonic|choir|orchestral|epic/.test(text);
    return {
      label: isSymphonic ? 'Symphonic epic metal' : 'Heavy metal anthem',
      profile: 'metal_epic',
      descriptor: isSymphonic ? 'symphonic epic metal track' : 'hard-hitting heavy metal track',
      atmosphere: 'dark, aggressive drive, soaring distorted guitars, and commanding power',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: true,
      isElectronic: false,
    };
  }

  // 2. Cinematic Orchestral / Battle Score
  const isCinematic = profile.isCinematic || /cinematic|orchestral|symphony|trailer|soundtrack|nhạc phim|sử thi/.test(text);
  const isBattle = /battle|war|chiến|epic|heroic/.test(text);
  if (isCinematic && isBattle) {
    return {
      label: 'Cinematic orchestral battle score',
      profile: 'cinematic_orchestral',
      descriptor: 'cinematic orchestral battle score',
      atmosphere: 'tense, sweeping grandeur, thundering percussion, and martial intensity',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: true,
      isElectronic: false,
    };
  }
  if (isCinematic) {
    return {
      label: 'Cinematic orchestral soundtrack',
      profile: 'cinematic_orchestral',
      descriptor: 'cinematic orchestral score',
      atmosphere: 'expansive emotional depth and evocative narrative progression',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: false,
      isElectronic: false,
    };
  }

  // 3. Intimate Piano Singer-Songwriter Ballad
  const hasPiano = profile.explicitInstruments.some(i => i.includes('Piano')) || /piano|grand piano|felt piano/.test(text);
  const isSadIntimate = profile.energyLevel === 'intimate' || profile.energyLevel === 'calm' || /buồn|sad|chia tay|mưa|cô đơn|intimate|melanchol|emotional|heartbroken|heartfelt/.test(text);
  if (hasPiano && isSadIntimate && !/edm|dance|metal|rock|disco/.test(text)) {
    return {
      label: 'Intimate piano singer-songwriter ballad',
      profile: 'piano_ballad',
      descriptor: 'intimate piano singer-songwriter ballad',
      atmosphere: 'delicate piano phrasing, tender vulnerability, and heartfelt emotional intimacy',
      isAcoustic: true,
      isIntimate: true,
      isHeavy: false,
      isElectronic: false,
    };
  }

  // 4. Vietnamese Nostalgic Acoustic Ballad & General Acoustic Ballad
  const isVietnamese = profile.culturalStyle === 'vietnamese' || /việt|vietnamese|quê hương|bolero|v-pop/.test(text);
  const isAcousticBallad = profile.isAcoustic || /acoustic|ballad|trữ tình|mộc|acoustic folk/.test(text);
  if (isAcousticBallad || isSadIntimate) {
    if (isVietnamese) {
      return {
        label: 'Vietnamese acoustic ballad',
        profile: 'acoustic_ballad',
        descriptor: 'intimate Vietnamese acoustic ballad',
        atmosphere: 'delicate acoustic resonance, lyrical warmth, and poignant emotional reflection',
        isAcoustic: true,
        isIntimate: true,
        isHeavy: false,
        isElectronic: false,
      };
    }
    return {
      label: 'Acoustic singer-songwriter ballad',
      profile: 'acoustic_ballad',
      descriptor: 'gentle acoustic singer-songwriter ballad',
      atmosphere: 'raw emotional intimacy, warm guitar resonance, and heartfelt delivery',
      isAcoustic: true,
      isIntimate: true,
      isHeavy: false,
      isElectronic: false,
    };
  }

  // 5. Festival Future Bass EDM / Electronic Dance
  const isEdm = !profile.exclusions.excludeEdm && (profile.isElectronic || /future bass|edm|festival|dance pop|drop|techno|house|dubstep|hardstyle|trance|electro swing/.test(text));
  if (isEdm) {
    const isFutureBass = /future bass|supersaw|sub-bass/.test(text) || (profile.explicitInstruments.includes('Sawtooth Wave') && profile.explicitInstruments.includes('Sub-bass'));
    const isModernFestival = profile.isModernExplicit || /festival|bùng nổ|drop/.test(text);
    return {
      label: isModernFestival ? 'Modern festival future-bass EDM' : isFutureBass ? 'Festival future bass EDM' : 'High-energy electronic dance track',
      profile: 'edm_electronic',
      descriptor: isModernFestival ? 'modern festival future-bass EDM track' : isFutureBass ? 'festival future-bass EDM track' : 'dynamic electronic club anthem',
      atmosphere: 'escalating build-up, punchy percussion, and an explosive drop with wide supersaws',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: false,
      isElectronic: true,
    };
  }

  // 6. Ambient / Meditative Soundscape
  const isAmbient = profile.isAmbient || /ambient|meditative|soundscape|drone|thiền|spa|healing|thư giãn|peaceful|relaxing/.test(text);
  if (isAmbient) {
    return {
      label: 'Ambient meditative soundscape',
      profile: 'ambient_meditative',
      descriptor: 'serene ambient meditative soundscape',
      atmosphere: 'tranquil stillness, spacious harmonic layers, and restorative sonic warmth',
      isAcoustic: true,
      isIntimate: true,
      isHeavy: false,
      isElectronic: false,
    };
  }

  // 7. Lo-Fi Chillhop
  const isLofi = !profile.exclusions.excludeLofi && (profile.isLofi || /lo-fi|lofi|chillhop|bedroom pop/.test(text));
  if (isLofi) {
    return {
      label: 'Lo-Fi chillhop groove',
      profile: 'lofi_chill',
      descriptor: 'cozy lo-fi chillhop beat',
      atmosphere: 'warm vintage crackle, mellow electric piano chords, and a relaxed swing groove',
      isAcoustic: false,
      isIntimate: true,
      isHeavy: false,
      isElectronic: true,
    };
  }

  // 8. Rock / Punk
  const isRock = !profile.exclusions.excludeRock && (profile.isRock || /rock|punk|grunge|indie rock|hard rock/.test(text));
  if (isRock) {
    return {
      label: 'Energetic alternative rock',
      profile: 'rock_energetic',
      descriptor: 'driving alternative rock anthem',
      atmosphere: 'gritty guitar drive, punchy drum groove, and energetic momentum',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: true,
      isElectronic: false,
    };
  }

  // 9. Hip-Hop / R&B
  const isHipHop = !profile.exclusions.excludeHipHop && (profile.isHipHop || /hip-hop|rap|trap|boom bap|r&b|neo-soul/.test(text));
  if (isHipHop) {
    return {
      label: 'Modern urban hip-hop',
      profile: 'hiphop_urban',
      descriptor: 'modern urban groove',
      atmosphere: 'tight pocket rhythm, clean 808 foundation, and expressive swagger',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: false,
      isElectronic: true,
    };
  }

  // 10. Traditional Folk / World
  const isFolk = profile.isFolk || /folk|celtic|traditional|guzheng|dizi|đàn bầu|đàn tranh/.test(text);
  if (isFolk) {
    return {
      label: 'Traditional world folk',
      profile: 'folk_traditional',
      descriptor: 'traditional world folk composition',
      atmosphere: 'earthy cultural richness, acoustic authenticity, and timeless melodic depth',
      isAcoustic: true,
      isIntimate: true,
      isHeavy: false,
      isElectronic: false,
    };
  }

  // Default: Contemporary Polished Song
  const primaryGenre = (selections.genres && selections.genres[0]) || 'Pop';
  const primaryMood = (selections.moods && selections.moods[0]) || 'Melodic';
  return {
    label: `${primaryMood} ${primaryGenre}`,
    profile: 'pop_contemporary',
    descriptor: `contemporary ${primaryGenre.toLowerCase()} track`,
    atmosphere: `${primaryMood.toLowerCase()} emotional presence and cohesive production`,
    isAcoustic: false,
    isIntimate: false,
    isHeavy: false,
    isElectronic: false,
  };
};

/**
 * Deterministic Semantic Validator with V4.3 Quality Engine Integration:
 * 1. Validates tag coherence against the Primary Intent Lock.
 * 2. Applies Unsupported Inference Guard, Genre Drift Guard, Vocal Fidelity Lock,
 *    and Instrument Fidelity via applyQualityEngine.
 */
export const validateSelectionsWithIntent = (
  rawSelections: Partial<Record<CategoryKey, string[]>>,
  intent: PrimaryIntent,
  userProfile?: UserIntentProfile | string
): { validatedSelections: SelectionState; removedTags: RemovedTagReport[] } => {
  const profile = typeof userProfile === 'string'
    ? buildUserIntentProfile(userProfile)
    : userProfile || buildUserIntentProfile(intent.label);

  const result = createEmptySelections();
  const removed: RemovedTagReport[] = [];

  const addTag = (category: CategoryKey, tag: string) => {
    if (!result[category].includes(tag)) {
      result[category].push(tag);
    }
  };

  const rejectTag = (category: CategoryKey, tag: string, reason: string) => {
    removed.push({ category, tag, reason });
  };

  // Helper sets
  const heavyMetalGenres = new Set([
    'Metal', 'Heavy Metal', 'Thrash Metal', 'Death Metal', 'Black Metal', 'Power Metal',
    'Doom Metal', 'Metalcore', 'Nu Metal', 'Industrial Metal', 'Djent', 'Sludge Metal'
  ]);
  const aggressiveEdmGenres = new Set([
    'EDM', 'Hardstyle', 'Dubstep', 'Breakcore', 'Hardcore', 'Techno', 'Psytrance', 'Drum and Bass'
  ]);
  const aggressiveMoods = new Set([
    'Aggressive', 'Angry', 'Manic', 'Chaotic', 'Doom'
  ]);
  const heavyInstruments = new Set([
    'Distorted Guitar', '808 Bass', 'Sub-bass', 'Sawtooth Wave', 'Electronic Drums', '808 Kick'
  ]);
  const harshVocals = new Set([
    'Screaming', 'Growling', 'Fast-Talking', 'Robot Voice', 'Male Vocoder'
  ]);
  const heavyProduction = new Set([
    'Distortion', 'Overdrive', 'Fuzz', 'Bitcrusher', 'Live Stadium', 'Bass Boosted', 'Punchy',
    '[Bass Drop]', '[Big Finish]', 'Fast BPM', 'Guitar Shredding', 'Power Drums'
  ]);

  (Object.keys(result) as CategoryKey[]).forEach(category => {
    const list = Array.isArray(rawSelections[category]) ? rawSelections[category]! : [];

    list.forEach(tag => {
      // Pre-Rule 0: Exclusion & Negation Guard (Priority 1)
      if (isTagExcluded(category, tag, profile.exclusions)) {
        rejectTag(category, tag, `Yếu tố "${tag}" bị loại trừ rõ ràng theo yêu cầu người dùng`);
        return;
      }

      // Rule 1: Acoustic Ballads & Piano Ballads Contradiction Guard
      if (intent.profile === 'acoustic_ballad' || intent.profile === 'piano_ballad') {
        if (category === 'genres' && (heavyMetalGenres.has(tag) || aggressiveEdmGenres.has(tag))) {
          rejectTag(category, tag, `Không phù hợp với bản ballad mộc (${intent.label})`);
          return;
        }
        if (category === 'instruments' && heavyInstruments.has(tag)) {
          rejectTag(category, tag, `Nhạc cụ điện tử/méo tiếng xung đột với ballad mộc`);
          return;
        }
        if (category === 'moods' && aggressiveMoods.has(tag)) {
          rejectTag(category, tag, `Tâm trạng hung hăng xung đột với tính chất sâu lắng của ballad`);
          return;
        }
        if (category === 'vocals' && harshVocals.has(tag)) {
          rejectTag(category, tag, `Giọng hét/gầm không thích hợp cho bản ballad`);
          return;
        }
        if (heavyProduction.has(tag)) {
          rejectTag(category, tag, `Hiệu ứng méo tiếng/drop mạnh xung đột với phối khí mộc`);
          return;
        }
      }

      // Rule 2: Ambient & Meditative Contradiction Guard
      if (intent.profile === 'ambient_meditative') {
        if (category === 'genres' && (heavyMetalGenres.has(tag) || aggressiveEdmGenres.has(tag) || tag === 'Hip-Hop' || tag === 'Drill' || tag === 'Punk')) {
          rejectTag(category, tag, `Thể loại xung đột với không gian thiền định / ambient`);
          return;
        }
        if (category === 'moods' && (aggressiveMoods.has(tag) || tag === 'Energetic' || tag === 'Driving' || tag === 'Tense')) {
          rejectTag(category, tag, `Tâm trạng mạnh bạo xung đột với ambient thư giãn`);
          return;
        }
        if (tag === 'Punchy' || tag === '[Bass Drop]' || tag === 'Fast BPM' || tag === 'Guitar Shredding' || tag === 'Power Drums') {
          rejectTag(category, tag, `Cao trào/tiết tấu nhanh xung đột với không gian ambient tĩnh lặng`);
          return;
        }
      }

      // Rule 3: Heavy Metal / Nordic Symphonic Folk Metal Guard
      if (intent.profile === 'metal_epic') {
        const bubblegumTags = new Set(['Bubblegum Pop', 'Teen Pop', 'Bossa Nova', 'Bedroom Pop', 'Kawaii', 'Sweet', 'Lo-Fi Hip Hop']);
        if (bubblegumTags.has(tag)) {
          rejectTag(category, tag, `Thẻ nhẹ/ngọt ngào xung đột với khí chất sử thi của Epic Metal`);
          return;
        }
      }

      // Rule 4: Direct Pair Contradictions
      if (tag === 'No Drums' && (rawSelections.instruments || []).some(i => i.includes('Drum') || i === 'Timpani')) {
        rejectTag(category, tag, `Xung đột trực tiếp với dàn trống đã chọn`);
        return;
      }
      if (tag === 'Unplugged' && (rawSelections.effects || []).includes('Distortion')) {
        rejectTag(category, tag, `Xung đột giữa Mộc (Unplugged) và Méo tiếng (Distortion)`);
        return;
      }

      addTag(category, tag);
    });
  });

  // Apply V4.3 Quality Engine Pipeline:
  // Unsupported Inference Guard, Genre Drift Guard, Vocal Fidelity Lock, Instrument Fidelity
  const quality = applyQualityEngine(result, intent, profile);

  return {
    validatedSelections: quality.selections,
    removedTags: [...removed, ...quality.removedTags]
  };
};

/**
 * Deterministic Prompt Health V2 Evaluator:
 * Calculates a 0-100 quality score and status without calling Gemini.
 * Evaluates tag density, primary intent alignment, unsupported strong additions,
 * era drift, vocal contradiction, explicit instrument omission, arrangement progression,
 * and language leakage.
 */
export const evaluatePromptHealth = (
  idea: string,
  optimizedIdea: string,
  selections: SelectionState,
  promptText: string
): PromptHealthResult => {
  let score = 95;
  const reasons: string[] = [];
  const profile = buildUserIntentProfile(idea);
  const intent = derivePrimaryIntent(idea, optimizedIdea, selections, profile);

  const totalTags = Object.values(selections).reduce((acc, list) => acc + list.length, 0);

  // 1. Tag Density & Completeness
  if (totalTags === 0) {
    return {
      score: 40,
      status: 'Needs Review',
      summary: 'Prompt trống hoặc thiếu hoàn toàn các thành phần âm nhạc cốt lõi.',
      reasons: ['Chưa có thẻ phong cách nào được chọn'],
    };
  }

  if (selections.genres.length === 0) {
    score -= 15;
    reasons.push('Thiếu thể loại chủ đạo');
  } else if (selections.genres.length >= 1 && selections.genres.length <= 3) {
    score += 3;
    reasons.push('Thể loại chủ đạo được định hình rõ ràng');
  }

  if (selections.moods.length === 0) {
    score -= 10;
    reasons.push('Thiếu định hướng tâm trạng/cảm xúc');
  }

  if (selections.instruments.length === 0) {
    score -= 10;
    reasons.push('Chưa chỉ định nhạc cụ đặc trưng');
  }

  if (totalTags > 16) {
    score -= 12;
    reasons.push('Mật độ thẻ quá dày có thể làm loãng định hướng của Suno');
  } else if (totalTags >= 4 && totalTags <= 12) {
    score += 5;
    reasons.push('Mật độ thẻ cân đối, tập trung vào bản sắc bài hát');
  }

  const promptLower = promptText.toLowerCase();

  // 2. Unsupported Strong Genre Additions Guard
  const strongGenres = ['1980s', 'Retro', 'Synthwave', 'Cyberpunk', 'Lo-Fi', 'Metal', 'Trap', 'Jazz', 'Gospel'];
  const unsupportedInSelections = strongGenres.filter(sg => {
    const hasTag = selections.genres.includes(sg) || selections.production.includes(sg);
    return hasTag && !hasExplicitSupport(sg, profile);
  });
  if (unsupportedInSelections.length > 0) {
    score -= 18;
    reasons.push(`Phát hiện thể loại mạnh chưa có căn cứ từ yêu cầu: ${unsupportedInSelections.join(', ')}`);
  }

  // 3. Era Drift Guard
  if (profile.isModernExplicit) {
    const hasOldEra = selections.production.some(p => p === '1980s' || p === 'Retro' || p === 'Vintage' || p === '1970s') ||
      promptLower.includes('1980s') || promptLower.includes('synthwave');
    if (hasOldEra) {
      score -= 15;
      reasons.push('Phát hiện lệch thời đại (Era Drift: yêu cầu hiện đại nhưng xuất hiện phong cách thập niên cũ)');
    }
  }

  // 4. Vocal Contradiction Guard
  if (profile.vocalGender === 'male' && (selections.vocals.includes('Female Vocal') || /female vocal/i.test(promptLower))) {
    score -= 25;
    reasons.push('Xung đột giọng hát: người dùng yêu cầu giọng nam nhưng xuất hiện giọng nữ');
  } else if (profile.vocalGender === 'female' && (selections.vocals.includes('Male Vocal') || /male vocal/i.test(promptLower))) {
    score -= 25;
    reasons.push('Xung đột giọng hát: người dùng yêu cầu giọng nữ nhưng xuất hiện giọng nam');
  } else if (profile.isInstrumental && (selections.vocals.length > 0 || (promptLower.includes('vocal') && !promptLower.includes('no vocal') && !promptLower.includes('instrumental')))) {
    score -= 25;
    reasons.push('Xung đột: người dùng yêu cầu nhạc không lời nhưng prompt có chứa giọng hát');
  }

  // 5. Explicit Instrument Omission Guard
  if (profile.explicitInstruments.length > 0) {
    const missing = profile.explicitInstruments.filter(inst => {
      const inSel = selections.instruments.includes(inst);
      const inPrompt = promptLower.includes(inst.toLowerCase());
      return !inSel && !inPrompt;
    });
    if (missing.length > 0) {
      score -= 15;
      reasons.push(`Bỏ sót nhạc cụ người dùng yêu cầu trực tiếp: ${missing.join(', ')}`);
    }
  }

  // 6. Arrangement Mismatch Guard
  if (profile.explicitArrangement.length > 0) {
    const expectsDrop = profile.explicitArrangement.some(a => a.includes('drop'));
    const hasDrop = selections.production.includes('[Bass Drop]') || promptLower.includes('drop');
    if (expectsDrop && !hasDrop) {
      score -= 10;
      reasons.push('Chưa phản ánh đoạn cao trào / drop người dùng yêu cầu');
    }
  }

  // 7. Language Leakage into English prompt
  const vietnameseLeakRegex = /\b(bài hát về|lời bài hát|giọng nam|giọng nữ|đoạn cao trào|điệp khúc|mở đầu|kết thúc|không lời|tiếng việt|nhạc mộc)\b/i;
  if (vietnameseLeakRegex.test(promptText)) {
    score -= 15;
    reasons.push('Phát hiện rò rỉ cụm từ tiếng Việt vào prompt phong cách tiếng Anh');
  }

  // 8. Acoustic vs Heavy clash check
  const text = `${profile.exclusions.positiveText} ${optimizedIdea} ${promptText}`.toLowerCase();
  if (intent.isAcoustic && /metal|dubstep|hardcore|screaming|distortion/.test(text)) {
    score -= 25;
    reasons.push('Phát hiện xung đột giữa phối khí mộc và hiệu ứng nặng/điện tử');
  }

  // 9. Negation & Exclusion Contradiction Guard (Major Contradiction)
  if (profile.exclusions.excludedKeywords.length > 0) {
    const leakedExclusions: string[] = [];
    profile.exclusions.excludedKeywords.forEach(kw => {
      if (kw.length >= 3) {
        // Prevent false positive on sub-words like 'acoustic' when 'electric' is excluded
        const inPrompt = promptLower.split(/[,.\s]+/).some(token => token === kw) || (promptLower.includes(kw) && !promptLower.includes(`no ${kw}`) && !promptLower.includes(`without ${kw}`));
        const inSelections = Object.values(selections).flat().some(t => {
          const tLower = t.toLowerCase();
          return tLower === kw || tLower.includes(kw);
        });
        if (inPrompt || inSelections) {
          if (!leakedExclusions.includes(kw)) leakedExclusions.push(kw);
        }
      }
    });
    if (leakedExclusions.length > 0) {
      score -= 30;
      reasons.push(`Xung đột nghiêm trọng: Yếu tố người dùng đã loại trừ ("${leakedExclusions.join(', ')}") vẫn xuất hiện trong bản phối.`);
    }
  }

  // Clamp score between 0 and 100
  const finalScore = Math.max(0, Math.min(100, score));

  let status: 'Excellent' | 'Good' | 'Needs Review';
  let summary: string;

  if (finalScore >= 90) {
    status = 'Excellent';
    summary = `Bản phối có độ nhất quán cao theo chuẩn "${intent.label}", cấu trúc hài hòa và trung thực với yêu cầu.`;
  } else if (finalScore >= 75) {
    status = 'Good';
    summary = `Bản phối có định hướng tốt theo "${intent.label}", đáp ứng các chỉ tiêu âm nhạc chính.`;
  } else {
    status = 'Needs Review';
    summary = 'Cần rà soát lại để loại bỏ lệch thể loại, xung đột giọng hát hoặc nhạc cụ bị bỏ sót.';
  }

  return {
    score: finalScore,
    status,
    summary,
    reasons,
  };
};
