import { CategoryKey, SelectionState } from './types';

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
 * creative direction, and initial AI selections.
 */
export const derivePrimaryIntent = (
  idea: string,
  creativeDirection: string,
  selections: Partial<Record<CategoryKey, string[]>>
): PrimaryIntent => {
  const g = (selections.genres || []).join(' ');
  const m = (selections.moods || []).join(' ');
  const inst = (selections.instruments || []).join(' ');
  const v = (selections.vocals || []).join(' ');

  const text = `${idea} ${creativeDirection} ${g} ${m} ${inst} ${v}`.toLowerCase();

  // 1. Nordic / Viking / Symphonic / Folk Metal
  const isNordicMythic = /viking|bắc âu|nordic|valhalla|dragon|rồng|thần sấm|thor|odin|battle|chiến binh/.test(text);
  const isMetal = /folk metal|symphonic metal|heavy metal|power metal|death metal|black metal|thrash metal|metalcore|metal/.test(text);
  if (isNordicMythic && isMetal) {
    return {
      label: 'Nordic symphonic folk metal',
      profile: 'metal_epic',
      descriptor: 'epic Nordic symphonic folk-metal track',
      atmosphere: 'icy mythic atmosphere and heroic energy',
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
      atmosphere: 'dark, aggressive drive and soaring power',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: true,
      isElectronic: false,
    };
  }

  // 2. Cinematic Orchestral / Battle Score
  const isCinematic = /cinematic|orchestral|symphony|trailer|soundtrack|nhạc phim|sử thi/.test(text);
  const isBattle = /battle|war|chiến|epic|heroic/.test(text);
  if (isCinematic && isBattle) {
    return {
      label: 'Cinematic orchestral battle score',
      profile: 'cinematic_orchestral',
      descriptor: 'cinematic orchestral battle score',
      atmosphere: 'tense, sweeping grandeur and martial intensity',
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
  const hasPiano = /piano|grand piano|felt piano/.test(text);
  const isSadIntimate = /buồn|sad|chia tay|mưa|cô đơn|intimate|melanchol|emotional|heartbroken|heartfelt/.test(text);
  if (hasPiano && isSadIntimate && !/edm|dance|metal|rock|disco/.test(text)) {
    return {
      label: 'Intimate piano singer-songwriter ballad',
      profile: 'piano_ballad',
      descriptor: 'intimate piano singer-songwriter ballad',
      atmosphere: 'delicate emotional warmth and tender vulnerability',
      isAcoustic: true,
      isIntimate: true,
      isHeavy: false,
      isElectronic: false,
    };
  }

  // 4. Vietnamese Nostalgic Acoustic Ballad & General Acoustic Ballad
  const isVietnameseNostalgic = /việt|vietnamese|nostalgic|hoài niệm|quê hương|bolero|v-pop|mưa phố|kỷ niệm/.test(text);
  const isAcousticBallad = /acoustic|ballad|trữ tình|mộc|acoustic folk/.test(text);
  if (isAcousticBallad || isSadIntimate) {
    if (isVietnameseNostalgic) {
      return {
        label: 'Vietnamese nostalgic acoustic ballad',
        profile: 'acoustic_ballad',
        descriptor: 'intimate Vietnamese nostalgic acoustic ballad',
        atmosphere: 'wistful melancholic reflection and acoustic warmth',
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
      atmosphere: 'raw emotional intimacy and organic resonance',
      isAcoustic: true,
      isIntimate: true,
      isHeavy: false,
      isElectronic: false,
    };
  }

  // 5. Festival Future Bass EDM / Electronic Dance
  const isEdm = /future bass|edm|festival|dance pop|drop|techno|house|dubstep|hardstyle|trance|electro swing/.test(text);
  if (isEdm) {
    const isFutureBass = /future bass|synthesizer|melodic/.test(text);
    return {
      label: isFutureBass ? 'Festival future bass EDM' : 'High-energy electronic dance track',
      profile: 'edm_electronic',
      descriptor: isFutureBass ? 'festival future bass EDM track' : 'dynamic electronic club anthem',
      atmosphere: 'euphoric synth energy, vibrant pulse, and massive build-ups',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: false,
      isElectronic: true,
    };
  }

  // 6. Ambient / Meditative Soundscape
  const isAmbient = /ambient|meditative|soundscape|drone|thiền|spa|healing|thư giãn|peaceful|relaxing/.test(text);
  if (isAmbient) {
    return {
      label: 'Ambient meditative soundscape',
      profile: 'ambient_meditative',
      descriptor: 'serene ambient meditative soundscape',
      atmosphere: 'tranquil, immersive stillness and floating harmonic layers',
      isAcoustic: true,
      isIntimate: true,
      isHeavy: false,
      isElectronic: false,
    };
  }

  // 7. Lo-Fi Chillhop
  const isLofi = /lo-fi|lofi|chillhop|bedroom pop/.test(text);
  if (isLofi) {
    return {
      label: 'Lo-Fi chillhop groove',
      profile: 'lofi_chill',
      descriptor: 'cozy lo-fi chillhop beat',
      atmosphere: 'warm vintage crackle, mellow chords, and laid-back swing',
      isAcoustic: false,
      isIntimate: true,
      isHeavy: false,
      isElectronic: true,
    };
  }

  // 8. Rock / Punk
  const isRock = /rock|punk|grunge|indie rock|hard rock/.test(text);
  if (isRock) {
    return {
      label: 'Energetic alternative rock',
      profile: 'rock_energetic',
      descriptor: 'driving alternative rock anthem',
      atmosphere: 'gritty guitar drive and punchy rhythm',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: true,
      isElectronic: false,
    };
  }

  // 9. Hip-Hop / R&B
  const isHipHop = /hip-hop|rap|trap|boom bap|r&b|neo-soul/.test(text);
  if (isHipHop) {
    return {
      label: 'Modern urban hip-hop',
      profile: 'hiphop_urban',
      descriptor: 'modern urban groove',
      atmosphere: 'tight pocket rhythm and expressive swagger',
      isAcoustic: false,
      isIntimate: false,
      isHeavy: false,
      isElectronic: true,
    };
  }

  // 10. Traditional Folk / World
  const isFolk = /folk|celtic|traditional|guzheng|dizi|đàn bầu|đàn tranh/.test(text);
  if (isFolk) {
    return {
      label: 'Traditional world folk',
      profile: 'folk_traditional',
      descriptor: 'traditional world folk composition',
      atmosphere: 'earthy cultural richness and timeless melodic depth',
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
 * Deterministic Semantic Validator:
 * Validates tag coherence against the Primary Intent Lock.
 * Detects and removes blatant contradictions (e.g. metal drop on acoustic ballad)
 * while preserving legitimate hybrid genres (e.g. Nordic symphonic folk metal).
 */
export const validateSelectionsWithIntent = (
  rawSelections: Partial<Record<CategoryKey, string[]>>,
  intent: PrimaryIntent
): { validatedSelections: SelectionState; removedTags: RemovedTagReport[] } => {
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
      // No Drums vs Drum Kit
      if (tag === 'No Drums' && (rawSelections.instruments || []).some(i => i.includes('Drum') || i === 'Timpani')) {
        rejectTag(category, tag, `Xung đột trực tiếp với dàn trống đã chọn`);
        return;
      }
      // Unplugged / Acoustic vs extreme distortion
      if (tag === 'Unplugged' && (rawSelections.effects || []).includes('Distortion')) {
        rejectTag(category, tag, `Xung đột giữa Mộc (Unplugged) và Méo tiếng (Distortion)`);
        return;
      }

      addTag(category, tag);
    });
  });

  // Cap density to ensure musical coherence over tag dumping
  result.genres = result.genres.slice(0, 3);
  result.moods = result.moods.slice(0, 3);
  result.instruments = result.instruments.slice(0, 5);
  result.vocals = result.vocals.slice(0, 2);
  result.structure = result.structure.slice(0, 2);
  result.production = result.production.slice(0, 2);
  result.effects = result.effects.slice(0, 2);
  result.v5Performance = result.v5Performance.slice(0, 2);
  result.v5Advanced = result.v5Advanced.slice(0, 2);
  result.mixingPresets = result.mixingPresets.slice(0, 2);
  result.animeDrama = result.animeDrama.slice(0, 2);

  return { validatedSelections: result, removedTags: removed };
};

/**
 * Deterministic Prompt Health Evaluator:
 * Calculates a 0-100 quality score and status without calling Gemini.
 */
export const evaluatePromptHealth = (
  idea: string,
  optimizedIdea: string,
  selections: SelectionState,
  promptText: string
): PromptHealthResult => {
  let score = 95;
  const reasons: string[] = [];

  const totalTags = Object.values(selections).reduce((acc, list) => acc + list.length, 0);

  // 1. Tag Density & Completeness
  if (totalTags === 0) {
    score = 45;
    reasons.push('Chưa có thẻ phong cách nào được chọn');
    return {
      score,
      status: 'Needs Review',
      summary: 'Prompt trống hoặc thiếu hoàn toàn các thành phần âm nhạc cốt lõi.',
      reasons,
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

  // 2. Primary Intent Alignment
  const intent = derivePrimaryIntent(idea, optimizedIdea, selections);
  const text = `${idea} ${optimizedIdea} ${promptText}`.toLowerCase();

  if (intent.isAcoustic && /metal|dubstep|hardcore|screaming|distortion/.test(text)) {
    score -= 25;
    reasons.push('Phát hiện xung đột giữa phối khí mộc và hiệu ứng nặng/điện tử');
  }

  if (intent.profile === 'ambient_meditative' && /aggressive|punchy|fast bpm|guitar shredding/.test(text)) {
    score -= 25;
    reasons.push('Phát hiện cao trào/tiết tấu nhanh xung đột với ambient tĩnh lặng');
  }

  // 3. Prompt Repetition Check
  const words = promptText.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const wordCounts: Record<string, number> = {};
  const ignored = new Set(['with', 'natural', 'song', 'track', 'music', 'clear', 'vocal', 'rhythm', 'arrangement', 'production']);
  words.forEach(w => {
    if (!ignored.has(w)) {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    }
  });
  const repeated = Object.entries(wordCounts).filter(([_, count]) => count >= 3);
  if (repeated.length > 0) {
    score -= 10;
    reasons.push(`Lặp từ trong prompt: ${repeated.map(([w]) => `"${w}"`).join(', ')}`);
  }

  // Clamp score
  const finalScore = Math.max(0, Math.min(100, score));

  let status: 'Excellent' | 'Good' | 'Needs Review';
  let summary: string;

  if (finalScore >= 90) {
    status = 'Excellent';
    summary = `Bản phối có độ nhất quán cao theo chuẩn "${intent.label}", cấu trúc hài hòa và tự nhiên.`;
  } else if (finalScore >= 75) {
    status = 'Good';
    summary = `Bản phối có định hướng tốt theo "${intent.label}", có thể tinh chỉnh thêm một vài chi tiết.`;
  } else {
    status = 'Needs Review';
    summary = 'Cần rà soát lại để tránh xung đột thể loại hoặc mật độ thẻ quá tải.';
  }

  return {
    score: finalScore,
    status,
    summary,
    reasons,
  };
};
