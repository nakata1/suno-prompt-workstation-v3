import { CategoryKey, SelectionState } from './types';
import {
  buildUserIntentProfile,
  applyQualityEngine,
  UserIntentProfile,
  hasExplicitSupport,
  isTagExcluded,
  extractExclusions,
} from './musicQualityEngine';
import { MusicBlueprint, buildMusicBlueprint, validateAgainstBlueprint } from './musicBlueprint';
import { MusicIntentProfile, buildMusicIntentProfile } from './musicIntentProfile';
import {
  determineVocalAuthority,
  VocalAuthorityAnalysis,
  VocalAuthorityType,
} from './vocalAuthority';
import { SunoCompiledPrompt } from './sunoPromptCompiler';

export { buildUserIntentProfile, applyQualityEngine, hasExplicitSupport, isTagExcluded, extractExclusions };
export { buildMusicBlueprint, validateAgainstBlueprint, buildMusicIntentProfile };
export { determineVocalAuthority };
export type { UserIntentProfile, MusicBlueprint, MusicIntentProfile, VocalAuthorityAnalysis, VocalAuthorityType };

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
 * Primary Intent Lock (V4.4):
 * Derives a concise, dominant Primary Musical Intent from the user idea,
 * creative direction, initial AI selections, and deterministic Music Blueprint.
 */
export const derivePrimaryIntent = (
  idea: string,
  creativeDirection: string,
  selections: Partial<Record<CategoryKey, string[]>>,
  inputProfile?: UserIntentProfile,
  inputBlueprint?: MusicBlueprint
): PrimaryIntent => {
  const profile = inputProfile || buildUserIntentProfile(idea);
  const blueprint = inputBlueprint || buildMusicBlueprint(idea);

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

  // Authoritative Blueprint resolution check
  if (blueprint.primaryStyle === 'Vietnamese V-Pop acoustic ballad') {
    return {
      label: 'Vietnamese V-Pop acoustic ballad',
      profile: 'acoustic_ballad',
      descriptor: 'intimate Vietnamese V-Pop acoustic ballad',
      atmosphere: 'poignant acoustic reflection, lyrical warmth, delicate piano, and gentle strings at the climax',
      isAcoustic: true,
      isIntimate: true,
      isHeavy: false,
      isElectronic: false,
    };
  }

  if (blueprint.primaryStyle === 'Nordic symphonic folk metal' && !profile.exclusions.excludeMetal) {
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

  if (blueprint.primaryStyle === 'modern festival future bass EDM' && !profile.exclusions.excludeEdm) {
    return {
      label: 'modern festival future bass EDM',
      profile: 'edm_electronic',
      descriptor: 'modern festival future-bass EDM track',
      atmosphere: 'escalating build-up, punchy percussion, and an explosive drop with wide supersaws and sub-bass',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: false,
      isElectronic: true,
    };
  }

  if (blueprint.primaryStyle === 'Lo-Fi study piano' && !profile.exclusions.excludeLofi) {
    return {
      label: 'Lo-Fi study piano',
      profile: 'lofi_chill',
      descriptor: 'mellow lo-fi study piano track',
      atmosphere: 'warm tape texture, soft felt piano chords, subtle vinyl crackle, and gentle drum groove',
      isAcoustic: false,
      isIntimate: true,
      isHeavy: false,
      isElectronic: true,
    };
  }

  if (blueprint.primaryStyle === 'cinematic orchestral battle score') {
    return {
      label: 'cinematic orchestral battle score',
      profile: 'cinematic_orchestral',
      descriptor: 'cinematic orchestral battle score',
      atmosphere: 'slow tension build into a huge climax with thunderous brass, strings, and timpani',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: true,
      isElectronic: false,
    };
  }

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
 * Deterministic Semantic Validator with V4.4 Music Blueprint Integration:
 * 1. Validates tag coherence against the Primary Intent Lock.
 * 2. Applies Blueprint Verification (purging excluded concepts, enforcing vocal rules, inserting required instruments).
 * 3. Applies Unsupported Inference Guard, Genre Drift Guard, Vocal Fidelity Lock,
 *    and Instrument Fidelity via applyQualityEngine.
 */
export const validateSelectionsWithIntent = (
  rawSelections: Partial<Record<CategoryKey, string[]>>,
  intent: PrimaryIntent,
  userProfile?: UserIntentProfile | string,
  inputBlueprint?: MusicBlueprint
): { validatedSelections: SelectionState; removedTags: RemovedTagReport[] } => {
  const profile = typeof userProfile === 'string'
    ? buildUserIntentProfile(userProfile)
    : userProfile || buildUserIntentProfile(intent.label);

  const blueprint = inputBlueprint || buildMusicBlueprint(profile.exclusions.positiveText);

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
      if (isTagExcluded(category, tag, profile.exclusions) || blueprint.exclusions.some(e => e.toLowerCase() === tag.toLowerCase())) {
        rejectTag(category, tag, `Yếu tố "${tag}" bị loại trừ rõ ràng theo Blueprint của người dùng`);
        return;
      }

      // Rule 1: Acoustic Ballads & Piano Ballads Contradiction Guard
      if (intent.profile === 'acoustic_ballad' || intent.profile === 'piano_ballad' || blueprint.primaryStyle.includes('ballad')) {
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

  // Step 2: Validate against authoritative Blueprint (repair missing required instruments, enforce vocal fidelity)
  const bpValidation = validateAgainstBlueprint(result, blueprint);
  bpValidation.repairs.forEach(rep => {
    removed.push({ category: 'production', tag: 'Blueprint Repair', reason: rep });
  });

  // Step 3: Apply V4.3 Quality Engine Pipeline
  const quality = applyQualityEngine(bpValidation.validatedSelections as SelectionState, intent, profile);

  return {
    validatedSelections: quality.selections,
    removedTags: [...removed, ...quality.removedTags]
  };
};

/**
 * Deterministic Prompt Health V3 Evaluator (V4.6 Engine):
 * Evaluates the FINAL COMPILED OUTPUT, not merely selected tags.
 * Checks:
 * - Authority preservation (Instrumental, Female, Male, Mixed/Duet)
 * - Negative constraint compliance (Negative constraints MUST win)
 * - Vocal consistency & Instrumental consistency
 * - Semantic deduplication
 * - Genre coherence & Instrumentation coherence
 * - Excessive prompt density
 * Critical authority violations heavily reduce the score; a 100/100 score
 * is strictly impossible if any authoritative constraint is violated.
 */
export const evaluatePromptHealth = (
  idea: string,
  optimizedIdea: string,
  selections: SelectionState,
  promptText: string,
  inputBlueprint?: MusicBlueprint,
  inputIntentProfile?: MusicIntentProfile,
  compiledResult?: SunoCompiledPrompt
): PromptHealthResult => {
  let score = 95;
  const reasons: string[] = [];
  let hasCriticalAuthorityViolation = false;

  const rawText = (idea || optimizedIdea || '').trim();
  const profile = buildUserIntentProfile(rawText);
  const blueprint = inputBlueprint || buildMusicBlueprint(rawText);
  const intent = derivePrimaryIntent(rawText, optimizedIdea, selections, profile, blueprint);

  const totalTags = Object.values(selections).reduce((acc, list) => acc + list.length, 0);

  // 1. Tag Density & Completeness
  if (totalTags === 0 && !promptText.trim()) {
    return {
      score: 40,
      status: 'Needs Review',
      summary: 'Prompt trống hoặc thiếu hoàn toàn các thành phần âm nhạc cốt lõi.',
      reasons: ['Chưa có thẻ phong cách nào được chọn'],
    };
  }

  if (selections.genres.length === 0 && !blueprint.primaryStyle) {
    score -= 15;
    reasons.push('Thiếu thể loại chủ đạo');
  } else if (selections.genres.length >= 1 && selections.genres.length <= 3) {
    score += 3;
    reasons.push('Thể loại chủ đạo được định hình rõ ràng');
  }

  if (selections.moods.length === 0 && blueprint.moods.length === 0) {
    score -= 10;
    reasons.push('Thiếu định hướng tâm trạng/cảm xúc');
  }

  if (selections.instruments.length === 0 && blueprint.instruments.required.length === 0) {
    score -= 10;
    reasons.push('Chưa chỉ định nhạc cụ đặc trưng');
  }

  if (totalTags > 18) {
    score -= 12;
    reasons.push('Mật độ thẻ quá dày có thể làm loãng định hướng của Suno');
  } else if (totalTags >= 4 && totalTags <= 14) {
    score += 5;
    reasons.push('Mật độ thẻ cân đối, tập trung vào bản sắc bài hát');
  }

  const promptLower = (promptText || '').toLowerCase();

  // 2. Blueprint Primary Style Fidelity & Alignment
  const hasStyleMismatch =
    (blueprint.primaryStyle.includes('ballad') && /metal|screaming|heavy distorted/i.test(promptLower)) ||
    (blueprint.primaryStyle.includes('metal') && /bubblegum|kawaii|chillhop/i.test(promptLower)) ||
    (blueprint.primaryStyle.includes('EDM') && /acoustic folk|unplugged/i.test(promptLower));

  if (hasStyleMismatch) {
    score -= 25;
    hasCriticalAuthorityViolation = true;
    reasons.push(`Lệch phong cách chủ đạo Blueprint: phát hiện yếu tố xung đột với "${blueprint.primaryStyle}"`);
  } else if (blueprint.primaryStyle) {
    score += 5;
    reasons.push(`Bám sát phong cách chủ đạo Blueprint: ${blueprint.primaryStyle}`);
  }

  // 3. Unsupported Strong Genre Additions Guard
  const strongGenres = ['1980s', 'Retro', 'Synthwave', 'Cyberpunk', 'Lo-Fi', 'Metal', 'Trap', 'Jazz', 'Gospel'];
  const unsupportedInSelections = strongGenres.filter(sg => {
    const hasTag = selections.genres.includes(sg) || selections.production.includes(sg);
    return hasTag && !hasExplicitSupport(sg, profile) && !blueprint.secondaryStyles.includes(sg);
  });
  if (unsupportedInSelections.length > 0) {
    score -= 18;
    reasons.push(`Phát hiện thể loại mạnh chưa có căn cứ từ yêu cầu: ${unsupportedInSelections.join(', ')}`);
  }

  // 4. Era Drift Guard
  if (profile.isModernExplicit || blueprint.production.era === 'modern') {
    const hasOldEra = selections.production.some(p => p === '1980s' || p === 'Retro' || p === 'Vintage' || p === '1970s') ||
      promptLower.includes('1980s') || promptLower.includes('synthwave');
    if (hasOldEra) {
      score -= 15;
      reasons.push('Phát hiện lệch thời đại (Era Drift: yêu cầu hiện đại nhưng xuất hiện phong cách thập niên cũ)');
    }
  }

  // 5. Authoritative Vocal Enforcement (Prompt Health V3)
  const vocalAuth = determineVocalAuthority(rawText, blueprint, profile);
  if (vocalAuth.authority === 'instrumental') {
    const unauthorizedVocalRegex = /(?<!(?:without|no|zero)\s+(?:lead\s+)?)\b(?:vocals?|singing|choirs?|vocal\s+hooks?|vocal\s+chops?|vocal\s+textures?|female\s+vocal|(?<!fe)male\s+vocal)\b/i;
    const hasVocalTags = selections.vocals.length > 0;
    const hasVocalInCompiled = unauthorizedVocalRegex.test(promptLower);

    if (hasVocalTags || hasVocalInCompiled) {
      hasCriticalAuthorityViolation = true;
      score -= 50;
      reasons.push('XUNG ĐỘT THẨM QUYỀN: Yêu cầu định dạng không lời (Instrumental) nhưng xuất hiện yếu tố giọng hát trong prompt xuất bản');
    } else {
      score += 5;
      reasons.push('Bảo toàn tuyệt đối thẩm quyền không lời (Instrumental Authority: Strictly no vocals)');
    }
  } else if (vocalAuth.authority === 'female') {
    const maleVocalRegex = /\b(?<!fe)male\s*(?:vocals?|voice|hooks?|lead|singer)\b/i;
    const hasMaleTag = selections.vocals.some(v => /(?<!fe)male|\bnam\b/i.test(v));
    const hasMaleInCompiled = maleVocalRegex.test(promptLower);

    if (hasMaleTag || hasMaleInCompiled) {
      hasCriticalAuthorityViolation = true;
      score -= 50;
      reasons.push('XUNG ĐỘT THẨM QUYỀN: Người dùng yêu cầu giọng nữ (Female Vocal) nhưng xuất hiện giọng nam trong prompt');
    } else {
      score += 5;
      reasons.push('Bảo toàn chuẩn xác thẩm quyền giọng nữ (Female Vocal Authority)');
    }
  } else if (vocalAuth.authority === 'male') {
    const femaleVocalRegex = /\bfemale\s*(?:vocals?|voice|hooks?|lead|singer)\b/i;
    const hasFemaleTag = selections.vocals.some(v => /female|\bnữ\b|\bnu\b/i.test(v));
    const hasFemaleInCompiled = femaleVocalRegex.test(promptLower);

    if (hasFemaleTag || hasFemaleInCompiled) {
      hasCriticalAuthorityViolation = true;
      score -= 50;
      reasons.push('XUNG ĐỘT THẨM QUYỀN: Người dùng yêu cầu giọng nam (Male Vocal) nhưng xuất hiện giọng nữ trong prompt');
    } else {
      score += 5;
      reasons.push('Bảo toàn chuẩn xác thẩm quyền giọng nam (Male Vocal Authority)');
    }
  } else if (vocalAuth.authority === 'mixed') {
    score += 5;
    reasons.push('Bảo toàn chuẩn xác định dạng song ca / hợp xướng đa giọng (Duet / Mixed Vocal Authority)');
  } else if (blueprint.vocals.gender !== 'unspecified') {
    score += 5;
    reasons.push(`Bảo toàn chuẩn xác giọng hát: ${blueprint.vocals.gender}`);
  }

  // 6. Explicit Required Instrument Preservation Guard
  if (blueprint.instruments.required.length > 0) {
    const missing = blueprint.instruments.required.filter(inst => {
      const instL = inst.toLowerCase();
      const inSel = selections.instruments.some(i => i.toLowerCase().includes(instL) || instL.includes(i.toLowerCase()));
      const inPrompt = promptLower.includes(instL);
      return !inSel && !inPrompt;
    });
    if (missing.length > 0) {
      score -= 15;
      reasons.push(`Bỏ sót nhạc cụ người dùng yêu cầu trực tiếp: ${missing.join(', ')}`);
    } else {
      score += 5;
      reasons.push('Bảo tồn đầy đủ tất cả nhạc cụ chủ đạo trong Blueprint');
    }
  }

  // 7. Arrangement & Energy Arc Coherence
  if (blueprint.arrangement.climax) {
    const expectsDrop = blueprint.arrangement.climax.includes('drop');
    const hasDrop = selections.production.includes('[Bass Drop]') || promptLower.includes('drop');
    if (expectsDrop && !hasDrop) {
      score -= 10;
      reasons.push('Chưa phản ánh đoạn cao trào / drop người dùng yêu cầu');
    } else {
      score += 5;
      reasons.push('Đường cong năng lượng và cao trào phát triển nhất quán');
    }
  }

  // 8. Negative Constraint & Exclusion Compliance Guard (Major Contradiction)
  // Negative constraints MUST win.
  const exclusionsToCheck: { label: string; regex: RegExp }[] = [];

  if (profile.exclusions.excludeSynthesizer) {
    exclusionsToCheck.push({
      label: 'synthesizer/synths',
      regex: /(?<!(?:without|no|zero)\s+)\b(?:electronic\s+synths?|synthesizers?|synths?|synth\s+pads?)\b/i
    });
  }
  if (profile.exclusions.excludeHeavyDrums || profile.exclusions.excludeDrums) {
    exclusionsToCheck.push({
      label: 'heavy drums',
      regex: /(?<!(?:without|no|zero)\s+)\b(?:heavy\s+drums?|aggressive\s+drums?|war\s+drums?|808\s+kick)\b/i
    });
  }
  if (profile.exclusions.excludeElectricGuitar) {
    exclusionsToCheck.push({
      label: 'electric guitar',
      regex: /(?<!(?:without|no|zero)\s+)\b(?:electric\s+guitars?|distorted\s+guitars?)\b/i
    });
  }
  if (profile.exclusions.excludeAcousticGuitar) {
    exclusionsToCheck.push({
      label: 'acoustic guitar',
      regex: /(?<!(?:without|no|zero)\s+)\bacoustic\s+guitars?\b/i
    });
  }
  if (profile.exclusions.excludeRock || profile.exclusions.excludeMetal) {
    exclusionsToCheck.push({
      label: 'rock/metal',
      regex: /(?<!(?:without|no|zero)\s+)\b(?:heavy\s+metal|metal|hard\s+rock)\b/i
    });
  }

  // Check generic excluded keywords
  (profile.exclusions.excludedKeywords || []).forEach(kw => {
    if (kw.length >= 3) {
      exclusionsToCheck.push({
        label: kw,
        regex: new RegExp(`(?<!(?:without|no|zero)\\s+(?:lead\\s+)?)\\b${kw}\\b`, 'i')
      });
    }
  });

  const breachedExclusions: string[] = [];
  exclusionsToCheck.forEach(item => {
    if (item.regex.test(promptLower)) {
      if (!breachedExclusions.includes(item.label)) {
        breachedExclusions.push(item.label);
      }
    }
  });

  if (breachedExclusions.length > 0) {
    hasCriticalAuthorityViolation = true;
    score -= 50;
    reasons.push(`XUNG ĐỘT LOẠI TRỪ NGHIÊM TRỌNG: Yếu tố người dùng đã loại trừ ("${breachedExclusions.join(', ')}") xuất hiện trong prompt xuất bản`);
  } else if (exclusionsToCheck.length > 0) {
    score += 5;
    reasons.push('Tuân thủ nghiêm ngặt mọi ràng buộc loại trừ (Negative Constraints)');
  }

  // 9. Semantic Deduplication & Diagnostics Evaluation
  if (compiledResult?.diagnostics) {
    if (compiledResult.diagnostics.removedDuplicates.length > 0) {
      score += 3;
      reasons.push(`Trình biên dịch V2 đã tự động hợp nhất ${compiledResult.diagnostics.removedDuplicates.length} từ khóa trùng lặp`);
    }
    if (compiledResult.diagnostics.blockedConflicts.length > 0) {
      reasons.push(`Bộ bảo vệ xung đột cuối (Final Conflict Guard) đã chặn thành công ${compiledResult.diagnostics.blockedConflicts.length} xung đột muộn`);
    }
  }

  // 10. Language Leakage Guard
  const vietnameseLeakRegex = /\b(bài hát về|lời bài hát|giọng nam|giọng nữ|đoạn cao trào|điệp khúc|mở đầu|kết thúc|không lời|tiếng việt|nhạc mộc)\b/i;
  if (vietnameseLeakRegex.test(promptText)) {
    score -= 15;
    reasons.push('Phát hiện rò rỉ cụm từ tiếng Việt vào prompt phong cách tiếng Anh');
  } else {
    score += 3;
    reasons.push('Ngôn ngữ prompt tiếng Anh chuẩn xác, không rò rỉ thuật ngữ');
  }

  // 11. Intent Profile Resolutions
  if (inputIntentProfile) {
    if (inputIntentProfile.conflicts && inputIntentProfile.conflicts.length > 0) {
      inputIntentProfile.conflicts.forEach(conflict => {
        reasons.push(`Phát hiện xung đột ý định: ${conflict} (Đã xử lý theo thứ tự ưu tiên V4.6)`);
      });
      if (inputIntentProfile.conflictResolutions && inputIntentProfile.conflictResolutions.length > 0) {
        score += 2;
        reasons.push('Xung đột ý định đã được giải quyết tất định theo quy tắc ưu tiên');
      }
    } else {
      score += 3;
      reasons.push('Ý định âm nhạc (Intent Profile) nhất quán, không có xung đột');
    }
  }

  // Blueprint Completeness Reward
  if (blueprint.confidence >= 0.75) {
    score += 4;
    reasons.push(`Music Blueprint đạt độ tin cậy cao (${Math.round(blueprint.confidence * 100)}%)`);
  }

  // CRITICAL RULE: A 100/100 score must NOT be possible if any authoritative constraint is violated.
  let finalScore = Math.max(0, Math.min(100, score));
  if (hasCriticalAuthorityViolation) {
    finalScore = Math.min(55, finalScore);
  }

  let status: 'Excellent' | 'Good' | 'Needs Review';
  let summary: string;

  if (finalScore >= 90) {
    status = 'Excellent';
    summary = `Bản phối đạt độ chuẩn xác cao theo "${intent.label}", tuân thủ tuyệt đối thẩm quyền người dùng và âm học Suno V2.`;
  } else if (finalScore >= 75) {
    status = 'Good';
    summary = `Bản phối có định hướng tốt theo "${intent.label}", đáp ứng các chỉ tiêu âm nhạc chính.`;
  } else {
    status = 'Needs Review';
    summary = hasCriticalAuthorityViolation
      ? 'Phát hiện vi phạm thẩm quyền âm nhạc hoặc ràng buộc loại trừ cốt lõi!'
      : 'Cần rà soát lại để hoàn thiện mật độ thẻ hoặc bổ sung nhạc cụ đặc trưng.';
  }

  return {
    score: finalScore,
    status,
    summary,
    reasons,
  };
};

