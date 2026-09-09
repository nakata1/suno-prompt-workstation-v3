import { CategoryKey, SelectionState } from './types';
import { PrimaryIntent, RemovedTagReport, IntentProfile, createEmptySelections } from './semanticValidator';

export interface ExclusionProfile {
  rawExclusions: string[];       // e.g. ['EDM', 'Metal', 'Lo-Fi']
  positiveText: string;          // input with all negated spans cleanly removed
  excludedKeywords: string[];    // lowercased tokens: ['edm', 'metal', 'lo-fi', 'electric guitar', ...]

  // Category exclusion booleans
  excludeMetal: boolean;
  excludeEdm: boolean;
  excludeLofi: boolean;
  excludeRock: boolean;
  excludeHipHop: boolean;
  excludeTrap: boolean;
  excludeAcoustic: boolean;
  excludePop: boolean;
  excludeJazz: boolean;
  excludeClassical: boolean;
  excludeSynthwave: boolean;
  excludeRetro: boolean;

  // Vocal / Instrument flags
  excludeVocals: boolean;
  excludeFemaleVocal: boolean;
  excludeMaleVocal: boolean;
  excludeChoir: boolean;
  excludeDrums: boolean;
  excludeHeavyDrums: boolean;
  excludeWarDrums: boolean;
  excludeGuitar: boolean;
  excludeElectricGuitar: boolean;
  excludeAcousticGuitar: boolean;
  excludePiano: boolean;
  excludeSynthesizer: boolean;
  excludeStrings: boolean;

  // Production exclusions
  excludeDistortion: boolean;
  excludeAutotune: boolean;
}

export const createEmptyExclusionProfile = (text: string): ExclusionProfile => ({
  rawExclusions: [],
  positiveText: text,
  excludedKeywords: [],
  excludeMetal: false,
  excludeEdm: false,
  excludeLofi: false,
  excludeRock: false,
  excludeHipHop: false,
  excludeTrap: false,
  excludeAcoustic: false,
  excludePop: false,
  excludeJazz: false,
  excludeClassical: false,
  excludeSynthwave: false,
  excludeRetro: false,
  excludeVocals: false,
  excludeFemaleVocal: false,
  excludeMaleVocal: false,
  excludeChoir: false,
  excludeDrums: false,
  excludeHeavyDrums: false,
  excludeWarDrums: false,
  excludeGuitar: false,
  excludeElectricGuitar: false,
  excludeAcousticGuitar: false,
  excludePiano: false,
  excludeSynthesizer: false,
  excludeStrings: false,
  excludeDistortion: false,
  excludeAutotune: false,
});

/**
 * Extracts negation/exclusion directives from user input in both Vietnamese and English.
 * Prevents negated words (e.g., 'không metal', 'không EDM', 'avoid rock') from contributing
 * positive keyword matches.
 */
export const extractExclusions = (rawInput: string): ExclusionProfile => {
  const text = (rawInput || '').trim();
  if (!text) return createEmptyExclusionProfile('');

  // Negation trigger regex (Vietnamese & English)
  // Negative lookahead on 'không' ensures we DO NOT match 'không khí' (atmosphere), 'không gian' (space), 'không chỉ' (not only)
  // Negative lookahead on 'no' ensures we DO NOT match 'no matter', 'no doubt'
  const triggerRegex =
    /(?:^|[\.,;\n\(\)\s])(không(?:\s+(?:theo\s+phong\s+cách|dùng|có|muốn|cần|nên|được))?(?!\s*(?:khí|gian|chỉ)\b)|tuyệt\s+đối\s+không|tránh|loại\s+bỏ|đừng|chớ|without(?:\s+any)?|avoid|exclude|excluding|do\s+not(?:\s+use|\s+want|\s+include)?|don'?t(?:\s+use|\s+want|\s+include)?|never(?:\s+use)?|no(?!\s*(?:doubt|matter|one|body)\b)|not(?!\s+only\b))\s+/i;

  const contrastiveRegex =
    /\b(?:nhưng(?:\s+có)?|tuy\s+nhiên|thay\s+vào\s+đó|thay\s+vì|mà\s+là|but(?:\s+with)?|however|instead(?:\s+of)?|rather\s+than)\b/i;

  // Split input into sentences by . ! ? \n
  const sentenceDelim = /([.!?\n]+)/;
  const sentenceTokens = text.split(sentenceDelim);

  const positiveSentences: string[] = [];
  const extractedPhrases: string[] = [];

  for (let i = 0; i < sentenceTokens.length; i += 2) {
    const sentence = sentenceTokens[i].trim();
    if (!sentence) continue;

    if (!triggerRegex.test(sentence)) {
      positiveSentences.push(sentence);
      continue;
    }

    // Sentence contains negation triggers: split into clauses by commas, semicolons
    const clauses = sentence.split(/([,;]+)/);
    let isNegationActive = false;
    const sentencePositiveClauses: string[] = [];

    for (let c = 0; c < clauses.length; c += 2) {
      const clause = clauses[c].trim();
      if (!clause) continue;

      // Check contrastive switch back to positive
      const contrastMatch = clause.match(contrastiveRegex);
      if (contrastMatch && contrastMatch.index !== undefined) {
        const prePart = clause.substring(0, contrastMatch.index).trim();
        const postPart = clause.substring(contrastMatch.index + contrastMatch[0].length).trim();
        if (isNegationActive && prePart) {
          extractedPhrases.push(prePart);
        }
        isNegationActive = false;
        if (postPart) {
          sentencePositiveClauses.push(postPart);
        }
        continue;
      }

      // Check if clause starts or contains a trigger
      const triggerMatch = clause.match(triggerRegex);
      if (triggerMatch && triggerMatch.index !== undefined) {
        const triggerWord = triggerMatch[1];
        const triggerWordPos = clause.indexOf(triggerWord, triggerMatch.index);
        const preTrigger = clause.substring(0, triggerWordPos).trim();
        if (preTrigger) {
          sentencePositiveClauses.push(preTrigger);
        }
        const postTrigger = clause.substring(triggerWordPos + triggerWord.length).trim();
        if (postTrigger) {
          extractedPhrases.push(postTrigger);
        }
        isNegationActive = true;
        continue;
      }

      if (isNegationActive) {
        // Check if clause is a full positive predicate (e.g. contains "là nhạc cụ", "là chính", "giọng nam")
        const isPositivePredicate = /\b(?:là\s+nhạc\s+cụ|là\s+chính|chính|primary|features?|featuring|mở\s+đầu|kết\s+thúc)\b/i.test(clause);
        if (isPositivePredicate) {
          isNegationActive = false;
          sentencePositiveClauses.push(clause);
        } else {
          extractedPhrases.push(clause);
        }
      } else {
        sentencePositiveClauses.push(clause);
      }
    }

    if (sentencePositiveClauses.length > 0) {
      positiveSentences.push(sentencePositiveClauses.join(', '));
    }
  }

  const positiveText = positiveSentences.join('. ').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();

  const rawExclusions: string[] = [];
  const excludedKeywords: string[] = [];

  let excludeMetal = false;
  let excludeEdm = false;
  let excludeLofi = false;
  let excludeRock = false;
  let excludeHipHop = false;
  let excludeTrap = false;
  let excludeAcoustic = false;
  let excludePop = false;
  let excludeJazz = false;
  let excludeClassical = false;
  let excludeSynthwave = false;
  let excludeRetro = false;

  let excludeVocals = false;
  let excludeFemaleVocal = false;
  let excludeMaleVocal = false;
  let excludeChoir = false;
  let excludeDrums = false;
  let excludeHeavyDrums = false;
  let excludeWarDrums = false;
  let excludeGuitar = false;
  let excludeElectricGuitar = false;
  let excludeAcousticGuitar = false;
  let excludePiano = false;
  let excludeSynthesizer = false;
  let excludeStrings = false;

  let excludeDistortion = false;
  let excludeAutotune = false;

  extractedPhrases.forEach(rawPhrase => {
    // Split on 'and', 'và', 'or', 'hay', slashes or commas
    const subItems = rawPhrase.split(/\b(?:và|and|or|hay)\b|[,/]+/i).map(s => s.trim()).filter(Boolean);
    subItems.forEach(item => {
      const p = item.toLowerCase();
      if (!p) return;

      const cleanKeyword = p
        .replace(/^(?:dùng|có|phong\s+cách|theo|cho|thêm|bất\s+kỳ|any|no|without(?:\s+any)?|exclude|excluding|avoid|không(?:\s+dùng|\s+có)?|tránh|loại\s+bỏ)\s+/i, '')
        .trim();
      if (cleanKeyword.length >= 2 && !excludedKeywords.includes(cleanKeyword)) {
        excludedKeywords.push(cleanKeyword);
      }

      // Check Metal
      if (/\b(?:metal|heavy\s*metal|death\s*metal|black\s*metal|thrash|power\s*metal|folk\s*metal|symphonic\s*metal|metalcore|djent)\b/i.test(p)) {
        excludeMetal = true;
        if (!rawExclusions.includes('Metal')) rawExclusions.push('Metal');
      }

      // Check EDM
      if (/\b(?:edm|techno|house|dubstep|hardstyle|dance\s*pop|psytrance|future\s*bass|breakcore|club)\b/i.test(p)) {
        excludeEdm = true;
        if (!rawExclusions.includes('EDM')) rawExclusions.push('EDM');
      }

      // Check Lo-Fi
      if (/\b(?:lo-?fi|chillhop|bedroom\s*pop)\b/i.test(p)) {
        excludeLofi = true;
        if (!rawExclusions.includes('Lo-Fi')) rawExclusions.push('Lo-Fi');
      }

      // Check Rock
      if (/\b(?:rock|punk|grunge|hard\s*rock|alternative\s*rock)\b/i.test(p) && !/metal/.test(p)) {
        excludeRock = true;
        if (!rawExclusions.includes('Rock')) rawExclusions.push('Rock');
      }

      // Check Trap / Hip-Hop
      if (/\b(?:trap)\b/i.test(p)) {
        excludeTrap = true;
        excludeHipHop = true;
        if (!rawExclusions.includes('Trap')) rawExclusions.push('Trap');
      }
      if (/\b(?:hip-?hop|rap|boom\s*bap|drill)\b/i.test(p)) {
        excludeHipHop = true;
        if (!rawExclusions.includes('Hip-Hop')) rawExclusions.push('Hip-Hop');
      }

      // Check Electric Guitar vs Acoustic Guitar vs Generic Guitar
      if (/\b(?:electric\s*guitar|guitar\s*điện|distorted\s*guitar)\b/i.test(p)) {
        excludeElectricGuitar = true;
        if (!rawExclusions.includes('Electric Guitar')) rawExclusions.push('Electric Guitar');
      } else if (/\b(?:acoustic\s*guitar|guitar\s*acoustic|guitar\s*thùng|guitar\s*mộc)\b/i.test(p)) {
        excludeAcousticGuitar = true;
        if (!rawExclusions.includes('Acoustic Guitar')) rawExclusions.push('Acoustic Guitar');
      } else if (/\b(?:guitar|đàn\s*guitar|tiếng\s*guitar)\b/i.test(p)) {
        excludeGuitar = true;
        excludeElectricGuitar = true;
        excludeAcousticGuitar = true;
        if (!rawExclusions.includes('Guitar')) rawExclusions.push('Guitar');
      }

      // Check Choir
      if (/\b(?:choir|hợp\s*xướng|hop\s*xuong)\b/i.test(p)) {
        excludeChoir = true;
        if (!rawExclusions.includes('Choir')) rawExclusions.push('Choir');
      }

      // Check Acoustic in general (if not specifically guitar)
      if (/\b(?:acoustic|mộc|unplugged)\b/i.test(p) && !/guitar/.test(p)) {
        excludeAcoustic = true;
        if (!rawExclusions.includes('Acoustic')) rawExclusions.push('Acoustic');
      }

      // Check Drums
      if (/\b(?:war\s*drums?|trống\s*chiến|trống\s*trận)\b/i.test(p)) {
        excludeWarDrums = true;
        excludeHeavyDrums = true;
        if (!rawExclusions.includes('War Drums')) rawExclusions.push('War Drums');
      } else if (/\b(?:drum\s*mạnh|heavy\s*drums?|power\s*drums?|trống\s*mạnh|aggressive\s*drums?)\b/i.test(p)) {
        excludeHeavyDrums = true;
        if (!rawExclusions.includes('Heavy Drums')) rawExclusions.push('Heavy Drums');
      } else if (/\b(?:drums?|trống|drum\s*kit)\b/i.test(p)) {
        excludeDrums = true;
        excludeHeavyDrums = true;
        if (!rawExclusions.includes('Drums')) rawExclusions.push('Drums');
      }

      // Check Vocals
      if (/\b(?:giọng\s*nữ|female\s*vocals?|nữ\s*hát|female\s*voice)\b/i.test(p)) {
        excludeFemaleVocal = true;
        if (!rawExclusions.includes('Female Vocal')) rawExclusions.push('Female Vocal');
      } else if (/\b(?:giọng\s*nam|(?<!fe)male\s*vocals?|nam\s*hát|(?<!fe)male\s*voice)\b/i.test(p)) {
        excludeMaleVocal = true;
        if (!rawExclusions.includes('Male Vocal')) rawExclusions.push('Male Vocal');
      } else if (/\b(?:vocals?|giọng|hát|lời|tiếng\s*hát)\b/i.test(p)) {
        excludeVocals = true;
        if (!rawExclusions.includes('Vocals')) rawExclusions.push('Vocals');
      }

      // Check Piano
      if (/\b(?:piano|đại\s*dương\s*cầm)\b/i.test(p)) {
        excludePiano = true;
        if (!rawExclusions.includes('Piano')) rawExclusions.push('Piano');
      }

      // Check Synthesizer (comprehensive match for all synth / electronic synth variants)
      if (
        /\b(?:electronic\s*synthesizers?|electronic\s*synths?|synthesizers?|synths?|sawtooth|sub-bass|808\s*bass|reese\s*bass|analog\s*synths?|modular\s*synths?|wavetable\s*synths?|fm\s*synths?|moog\s*synths?|tiếng\s*synth|đàn\s*synth|nhạc\s*cụ\s*điện\s*tử)\b/i.test(p) ||
        /\b(?:electronic\s*synthesizers?|electronic\s*synths?|synthesizers?|synths?|sawtooth|sub-bass|808\s*bass|reese\s*bass|analog\s*synths?|modular\s*synths?|wavetable\s*synths?|fm\s*synths?|moog\s*synths?|tiếng\s*synth|đàn\s*synth|nhạc\s*cụ\s*điện\s*tử)\b/i.test(cleanKeyword)
      ) {
        excludeSynthesizer = true;
        if (!rawExclusions.includes('Synthesizer')) rawExclusions.push('Synthesizer');
        if (!rawExclusions.includes('Electronic Synth')) rawExclusions.push('Electronic Synth');
      }

      // Check Strings
      if (/\b(?:strings?|dàn\s*dây|dan\s*day|violin|cello|orchestral\s*strings?)\b/i.test(p)) {
        excludeStrings = true;
        if (!rawExclusions.includes('Strings')) rawExclusions.push('Strings');
      }

      // Check Distortion
      if (/\b(?:distortion|méo\s*tiếng|fuzz|overdrive)\b/i.test(p)) {
        excludeDistortion = true;
        if (!rawExclusions.includes('Distortion')) rawExclusions.push('Distortion');
      }

      // Check Autotune
      if (/\b(?:autotune)\b/i.test(p)) {
        excludeAutotune = true;
        if (!rawExclusions.includes('Autotune')) rawExclusions.push('Autotune');
      }

      // Check Synthwave / Retro
      if (/\b(?:synthwave|retrowave)\b/i.test(p)) {
        excludeSynthwave = true;
        if (!rawExclusions.includes('Synthwave')) rawExclusions.push('Synthwave');
      }
      if (/\b(?:retro|vintage|1980s|80s)\b/i.test(p)) {
        excludeRetro = true;
        if (!rawExclusions.includes('Retro/80s')) rawExclusions.push('Retro/80s');
      }
    });
  });

  // Explicit synth exclusion expressions check across raw input text:
  // "no electronic synths", "no synths", "no synthesizer", "no synthesizers",
  // "without electronic synths", "without synths", "without synthesizer", "without synthesizers",
  // "exclude synths", "exclude synthesizers", "avoid synths", and Vietnamese equivalents
  const explicitSynthRegex =
    /\b(?:no|without(?:\s+any)?|exclude|excluding|avoid|không(?:\s+dùng|\s+có)?|tránh|loại\s+bỏ)\s+(?:electronic\s+synths?|electronic\s+synthesizers?|synths?|synthesizers?)\b/i;
  if (explicitSynthRegex.test(text)) {
    excludeSynthesizer = true;
    if (!rawExclusions.includes('Synthesizer')) rawExclusions.push('Synthesizer');
    if (!rawExclusions.includes('Electronic Synth')) rawExclusions.push('Electronic Synth');
    if (!excludedKeywords.includes('electronic synths')) excludedKeywords.push('electronic synths');
    if (!excludedKeywords.includes('synthesizer')) excludedKeywords.push('synthesizer');
    if (!excludedKeywords.includes('synths')) excludedKeywords.push('synths');
  }

  let finalPositive = positiveText;
  if (excludeSynthesizer) {
    finalPositive = finalPositive
      .replace(explicitSynthRegex, '')
      .replace(/\s+,/g, ',')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    rawExclusions,
    positiveText: finalPositive || text,
    excludedKeywords,
    excludeMetal,
    excludeEdm,
    excludeLofi,
    excludeRock,
    excludeHipHop,
    excludeTrap,
    excludeAcoustic,
    excludePop,
    excludeJazz,
    excludeClassical,
    excludeSynthwave,
    excludeRetro,
    excludeVocals,
    excludeFemaleVocal,
    excludeMaleVocal,
    excludeChoir,
    excludeDrums,
    excludeHeavyDrums,
    excludeWarDrums,
    excludeGuitar,
    excludeElectricGuitar,
    excludeAcousticGuitar,
    excludePiano,
    excludeSynthesizer,
    excludeStrings,
    excludeDistortion,
    excludeAutotune,
  };
};

/**
 * Validates whether a specific tag is explicitly excluded by the user's negative directives.
 */
export const isTagExcluded = (
  category: CategoryKey,
  tag: string,
  exclusions: ExclusionProfile
): boolean => {
  const tagLower = tag.toLowerCase();

  // 1. Keyword check with semantic protections
  for (const kw of exclusions.excludedKeywords) {
    if (kw.length >= 3 && tagLower.includes(kw)) {
      // Don't let 'electric guitar' exclusion falsely exclude 'acoustic guitar'
      if (kw.includes('electric') && tagLower.includes('acoustic')) continue;
      // Don't let 'acoustic guitar' exclusion falsely exclude 'electric guitar'
      if (kw.includes('acoustic') && tagLower.includes('electric')) continue;
      // Don't let 'metal' exclusion falsely exclude non-metal terms
      if (kw === 'metal' && !tagLower.includes('metal')) continue;
      return true;
    }
  }

  // 2. Category checks
  if (category === 'genres') {
    if (exclusions.excludeMetal && /metal|djent|sludge/i.test(tagLower)) return true;
    if (exclusions.excludeEdm && /edm|dubstep|hardstyle|techno|house|trance|dance pop|electro|breakcore/i.test(tagLower)) return true;
    if (exclusions.excludeLofi && /lo-?fi|chillhop|bedroom pop/i.test(tagLower)) return true;
    if (exclusions.excludeRock && /rock|punk|grunge/i.test(tagLower)) return true;
    if (exclusions.excludeHipHop && /hip-?hop|rap|boom bap|drill/i.test(tagLower)) return true;
    if (exclusions.excludeTrap && tag === 'Trap') return true;
    if (exclusions.excludeAcoustic && (tag === 'Acoustic' || tag === 'Acoustic Folk')) return true;
    if (exclusions.excludeSynthwave && (tag === 'Synthwave' || tag === 'Cyberpunk')) return true;
    if (exclusions.excludePop && (tag === 'Pop' || tag === 'Dance Pop')) return true;
    if (exclusions.excludeJazz && /jazz|swing|bebop|bossa/i.test(tagLower)) return true;
  }

  if (category === 'instruments') {
    if (exclusions.excludeGuitar && tagLower.includes('guitar')) return true;
    if (exclusions.excludeElectricGuitar && (tag === 'Electric Guitar' || tag === 'Distorted Guitar')) return true;
    if (exclusions.excludeAcousticGuitar && tag === 'Acoustic Guitar') return true;
    if (exclusions.excludePiano && tagLower.includes('piano')) return true;
    if (exclusions.excludeWarDrums && (tag === 'Taiko' || tagLower.includes('war drum') || tag === 'Timpani')) return true;
    if (exclusions.excludeDrums && (tagLower.includes('drum') || tag === 'Taiko' || tag === 'Timpani' || tag === '808 Kick')) return true;
    if (exclusions.excludeHeavyDrums && (tag === '808 Kick' || tag === 'Power Drums' || tag === 'Electronic Drums')) return true;
    if (exclusions.excludeSynthesizer && (
      tag === 'Synthesizer' ||
      tag === 'Electronic Synth' ||
      tag === 'Sawtooth Wave' ||
      tag === 'Square Wave' ||
      tag === 'Sub-bass' ||
      tag === '808 Bass' ||
      tag === 'Reese Bass' ||
      tag === 'Analog Synth' ||
      tag === 'Modular Synth' ||
      tag === 'Wavetable Synth' ||
      tag === 'FM Synth' ||
      tag === 'Moog Synth' ||
      tag === 'Arpeggiator' ||
      tagLower.includes('synth') ||
      tagLower.includes('synthesizer')
    )) return true;
    if (exclusions.excludeStrings && (tag === 'String Section' || tag === 'Violin' || tag === 'Cello')) return true;
  }

  if (category === 'vocals') {
    if (exclusions.excludeVocals) return true;
    if (exclusions.excludeChoir && /choir|hợp xướng/i.test(tagLower)) return true;
    if (exclusions.excludeFemaleVocal && (tag === 'Female Vocal' || tag === 'Female Harmony')) return true;
    if (exclusions.excludeMaleVocal && (tag === 'Male Vocal' || tag === 'Male Vocoder')) return true;
  }

  if (category === 'production' || category === 'effects' || category === 'mixingPresets') {
    if (exclusions.excludeDistortion && (tag === 'Distortion' || tag === 'Overdrive' || tag === 'Fuzz' || tag === 'Bitcrusher')) return true;
    if (exclusions.excludeAutotune && (tag === 'Autotune' || tag === 'Heavy Autotune')) return true;
    if (exclusions.excludeMetal && (tag === 'Guitar Shredding' || tag === 'Live Stadium' || tag === 'Power Drums')) return true;
    if (exclusions.excludeEdm && (tag === '[Bass Drop]' || tag === 'Bass Boosted' || tag === 'Punchy')) return true;
    if (exclusions.excludeLofi && (tag === 'Lo-Fi' || tag === 'Vinyl Crackle')) return true;
    if (exclusions.excludeHeavyDrums && tag === 'Power Drums') return true;
    if (exclusions.excludeSynthesizer && (tagLower.includes('synth') || tagLower.includes('synthesizer'))) return true;
  }

  return false;
};

export interface UserIntentProfile {
  rawInput: string;
  exclusions: ExclusionProfile;
  // Primary / Secondary Genre signals
  explicitPrimaryGenre?: string;
  explicitSecondaryGenre?: string;

  // Broad acoustic / electronic / cinematic / metal / ambient orientations
  isAcoustic: boolean;
  isElectronic: boolean;
  isCinematic: boolean;
  isMetalOrHeavy: boolean;
  isAmbient: boolean;
  isLofi: boolean;
  isRock: boolean;
  isHipHop: boolean;
  isPop: boolean;
  isFolk: boolean;

  // Cultural or Regional Style
  culturalStyle?: 'vietnamese' | 'nordic' | 'japanese' | 'celtic' | 'latin' | 'other';

  // Era / Decade
  explicitEra?: '1980s' | '1970s' | '1990s' | 'vintage' | 'retro' | 'modern' | 'futuristic';
  isModernExplicit: boolean;

  // Energy & Emotion
  energyLevel: 'high' | 'moderate' | 'intimate' | 'calm' | 'unspecified';
  explicitMoods: string[];

  // Vocal Specifications
  vocalGender: 'male' | 'female' | 'duet' | 'choir' | 'none' | 'unspecified';
  vocalTexture: string[]; // e.g., 'warm', 'mature', 'airy', 'raspy', 'operatic'
  isInstrumental: boolean;

  // Instrumentation
  explicitInstruments: string[];

  // Song Progression & Arrangement
  explicitArrangement: string[];

  // Production Aesthetics
  explicitProduction: string[];
}

/**
 * Deterministically constructs a User Intent Profile strictly from CURRENT user input.
 * Priority: explicit exclusion > explicit positive user request > semantic inference > fallback defaults
 */
export const buildUserIntentProfile = (rawInput: string): UserIntentProfile => {
  const exclusions = extractExclusions(rawInput);
  const text = exclusions.positiveText;
  const lower = text.toLowerCase();

  // 1. Vocal Analysis
  let isInstrumental = exclusions.excludeVocals || /\b(?:không\s+(?:lời|vocal|hát)|khong\s+(?:loi|vocal|hat)|nhạc\s+không\s+lời|nhac\s+khong\s+loi|instrumental|no\s+vocals?|without\s+vocals?|zero\s+vocals?)\b/i.test(lower);
  let vocalGender: UserIntentProfile['vocalGender'] = 'unspecified';
  if (isInstrumental) {
    vocalGender = 'none';
  } else if (/\b(?:song\s*ca|duet|nam\s*nữ|nam\s*nu|both\s*male\s*and\s*female|male\s*(?:and|&)\s*female|female\s*(?:and|&)\s*male|mixed\s*vocals?)\b/i.test(lower)) {
    vocalGender = 'duet';
  } else if (/\b(?:giọng\s*nữ|giong\s*nu|female\s*vocals?|female\s*voice|vocal\s*nữ|vocal\s*nu|nữ\s*hát|nu\s*hat|female\s*hooks?)\b/i.test(lower)) {
    vocalGender = exclusions.excludeFemaleVocal ? 'unspecified' : 'female';
  } else if (/\b(?:giọng\s*nam|giong\s*nam|(?<!fe)male\s*vocals?|(?<!fe)male\s*voice|vocal\s*nam|nam\s*hát|nam\s*hat)\b/i.test(lower)) {
    vocalGender = exclusions.excludeMaleVocal ? 'unspecified' : 'male';
  } else if (/\b(?:hợp\s*xướng|hop\s*xuong|choir|gregorian)\b/i.test(lower)) {
    vocalGender = 'choir';
  }

  const vocalTexture: string[] = [];
  if (/\b(?:ấm\s*áp|am\s*ap|warm)\b/i.test(lower)) vocalTexture.push('warm');
  if (/\b(?:mature|trưởng\s*thành|chững\s*chạc)\b/i.test(lower)) vocalTexture.push('mature');
  if (/\b(?:airy|thoáng\s*nhẹ|thoang\s*nhe|breathy)\b/i.test(lower)) vocalTexture.push('airy');
  if (/\b(?:raspy|khàn|khan|gritty)\b/i.test(lower)) vocalTexture.push('raspy');
  if (/\b(?:deep|trầm|tram)\s+(?:voice|vocal|tone|giọng)|giọng\s+trầm\b/i.test(lower)) vocalTexture.push('deep');
  if (/\b(?:operatic|opera)\b/i.test(lower)) vocalTexture.push('operatic');
  if (/\b(?:screaming|growling|gào\s*thét|gao\s*thet)\b/i.test(lower) && !exclusions.excludeMetal) vocalTexture.push('screaming');

  // 2. Cultural / Regional Analysis
  let culturalStyle: UserIntentProfile['culturalStyle'] = undefined;
  if (/vietnamese|việt nam|viet nam|việt|v-pop|bolero|quê hương|que huong|tình ca việt/i.test(lower)) {
    culturalStyle = 'vietnamese';
  } else if (/nordic|viking|bắc âu|bac au|valhalla|odin|thor/i.test(lower)) {
    culturalStyle = 'nordic';
  } else if (/japanese|j-pop|j-rock|anime|nhật|nhat/i.test(lower)) {
    culturalStyle = 'japanese';
  } else if (/celtic|irish/i.test(lower)) {
    culturalStyle = 'celtic';
  } else if (/latin|salsa|flamenco|bossa/i.test(lower)) {
    culturalStyle = 'latin';
  }

  // 3. Era & Decade
  let explicitEra: UserIntentProfile['explicitEra'] = undefined;
  const isModernExplicit = /modern|hiện đại|hien dai|contemporary/i.test(lower);
  if (!exclusions.excludeRetro) {
    if (/1980s|80s|eighties|synthwave|retrowave/i.test(lower)) explicitEra = '1980s';
    else if (/1970s|70s|seventies|disco/i.test(lower)) explicitEra = '1970s';
    else if (/1990s|90s|nineties/i.test(lower)) explicitEra = '1990s';
    else if (/retro|vintage|cổ điển/i.test(lower) && !/cổ điển &|classical/i.test(lower)) explicitEra = 'retro';
  }
  if (!explicitEra) {
    if (isModernExplicit) explicitEra = 'modern';
    else if (/futuristic|tương lai|tuong lai/i.test(lower)) explicitEra = 'futuristic';
  }

  // 4. Orientations (Strictly respecting exclusions!)
  const isAcoustic = !exclusions.excludeAcoustic &&
    (/acoustic|mộc|moc|unplugged|singer-songwriter|ballad/i.test(lower)) &&
    !/electronic|edm|techno|metal|dubstep/i.test(lower);
  const isElectronic = !exclusions.excludeEdm &&
    /edm|future bass|electronic|synthesizer|synth|drop|techno|house|trance|dubstep|club/i.test(lower);
  const isCinematic = /cinematic|orchestral|soundtrack|nhạc phim|nhac phim|trailer|sử thi|su thi|epic/i.test(lower);
  const isMetalOrHeavy = !exclusions.excludeMetal &&
    /metal|heavy metal|folk metal|symphonic metal|death metal|thrash|metalcore/i.test(lower);
  const isAmbient = /ambient|meditative|soundscape|drone|thiền|thien|healing|thư giãn|thu gian/i.test(lower);
  const isLofi = !exclusions.excludeLofi && /lo-fi|lofi|chillhop|bedroom pop/i.test(lower);
  const isRock = !exclusions.excludeRock && !isMetalOrHeavy && /rock|punk|grunge|indie rock/i.test(lower);
  const isHipHop = !exclusions.excludeHipHop && /hip-hop|hip hop|rap|boom bap|drill/i.test(lower) && (!exclusions.excludeTrap || !/trap/.test(lower));
  const isPop = !exclusions.excludePop && /pop|v-pop|k-pop|j-pop|dance pop/i.test(lower);
  const isFolk = /folk|dân ca|dan ca|traditional|celtic/i.test(lower);

  // 5. Energy Level
  let energyLevel: UserIntentProfile['energyLevel'] = 'unspecified';
  if (/festival|explosive|powerful drop|bùng nổ|bung no|massive|high energy|energetic|fast tempo/i.test(lower)) {
    energyLevel = 'high';
  } else if (/intimate|minimal|thân mật|than mat|sâu lắng|sau lang|gentle|mộc|nhẹ nhàng|nhe nhang/i.test(lower)) {
    energyLevel = 'intimate';
  } else if (/calm|peaceful|bình yên|binh yen|relaxing|thư thái|thu thai/i.test(lower)) {
    energyLevel = 'calm';
  } else if (/mid-tempo|moderate/i.test(lower)) {
    energyLevel = 'moderate';
  }

  // 6. Explicit Instruments
  const explicitInstruments: string[] = [];
  const addInst = (name: string) => {
    if (!explicitInstruments.includes(name) && !isTagExcluded('instruments', name, exclusions)) {
      explicitInstruments.push(name);
    }
  };
  if (/felt piano|piano nỉ/i.test(lower)) addInst('Felt Piano');
  else if (/grand piano|đại dương cầm/i.test(lower)) addInst('Grand Piano');
  else if (/piano/i.test(lower)) addInst('Piano');

  if (/acoustic guitar|guitar acoustic|guitar thùng|guitar thung|guitar mộc|guitar moc/i.test(lower)) addInst('Acoustic Guitar');
  if (/electric guitar|guitar điện|guitar dien/i.test(lower) && !exclusions.excludeElectricGuitar) {
    if (/heavy|distorted|méo tiếng|méo/i.test(lower) && !exclusions.excludeDistortion) addInst('Distorted Guitar');
    else addInst('Electric Guitar');
  }

  if (/sub-bass|sub bass/i.test(lower) && !exclusions.excludeSynthesizer && !exclusions.excludeEdm) addInst('Sub-bass');
  if (/supersaw|super-saw|sawtooth/i.test(lower) && !exclusions.excludeSynthesizer && !exclusions.excludeEdm) addInst('Sawtooth Wave');
  if (/synth|synthesizer/i.test(lower) && !exclusions.excludeSynthesizer && !exclusions.excludeEdm) addInst('Synthesizer');
  if (/punchy kick|808 kick|kick/i.test(lower) && !exclusions.excludeHeavyDrums) addInst('808 Kick');
  if (/808 bass/i.test(lower)) addInst('808 Bass');
  if (/war drums|trống trận|trong tran/i.test(lower) && !exclusions.excludeHeavyDrums) {
    addInst('Drum Kit');
    addInst('Taiko');
  } else if (/drums?|trống|trong|drum kit/i.test(lower) && !exclusions.excludeDrums) {
    addInst('Drum Kit');
  }

  if (/choir|hợp xướng|hop xuong/i.test(lower)) addInst('Choir');
  if (/timpani|trống định âm|trong dinh am/i.test(lower)) addInst('Timpani');
  if (/strings|string section|dàn dây|dan day/i.test(lower)) addInst('String Section');
  if (/violin/i.test(lower)) addInst('Violin');
  if (/cello/i.test(lower)) addInst('Cello');
  if (/flute|sáo|sao/i.test(lower)) addInst('Flute');
  if (/saxophone|sax/i.test(lower)) addInst('Saxophone');

  // 7. Explicit Song Progression / Arrangement
  const explicitArrangement: string[] = [];
  if (/atmospheric intro|spacious intro|mở đầu không gian/i.test(lower)) explicitArrangement.push('atmospheric intro');
  else if (/minimal intro|mở đầu mộc|gentle intro|mở đầu tối giản/i.test(lower)) explicitArrangement.push('minimal intro');

  if (/build-up|build up|escalating build-up|dồn dập/i.test(lower)) explicitArrangement.push('escalating build-up');
  if (/gradual emotional development|phát triển cảm xúc|tăng dần/i.test(lower)) explicitArrangement.push('gradual emotional development');
  if (/battle escalation|orchestral lift/i.test(lower)) explicitArrangement.push('orchestral lift');

  if (/powerful drop|explosive drop|major drop|drop mạnh/i.test(lower) && !exclusions.excludeEdm) explicitArrangement.push('explosive drop');
  else if (/\bdrop\b/i.test(lower) && !exclusions.excludeEdm) explicitArrangement.push('drop');

  if (/gentle ending|kết êm|gentle outro|kết thúc nhẹ nhàng/i.test(lower)) explicitArrangement.push('gentle ending');
  if (/cinematic climax|cao trào sử thi/i.test(lower)) explicitArrangement.push('cinematic climax');

  // 8. Explicit Moods
  const explicitMoods: string[] = [];
  if (/melanchol|u sầu|buồn|sad/i.test(lower)) explicitMoods.push('Melancholic');
  if (/epic|hùng tráng|hung trang/i.test(lower)) explicitMoods.push('Epic');
  if (/intimate|thân mật|than mat/i.test(lower)) explicitMoods.push('Intimate');
  if (/warm|ấm áp|am ap/i.test(lower)) explicitMoods.push('Warm');
  if (/dark|tăm tối|tam toi/i.test(lower) && !exclusions.excludeMetal) explicitMoods.push('Dark');
  if (/aggressive|hung hăng|hung hang/i.test(lower) && !exclusions.excludeMetal) explicitMoods.push('Aggressive');
  if (/uplifting|phấn chấn|phan chan/i.test(lower)) explicitMoods.push('Uplifting');
  if (/euphoric|hưng phấn/i.test(lower)) explicitMoods.push('Euphoric');
  if (/mysterious|bí ẩn|bi an/i.test(lower)) explicitMoods.push('Mysterious');
  if (/nostalgic|hoài niệm|hoai niem/i.test(lower)) explicitMoods.push('Nostalgic');

  // 9. Explicit Production
  const explicitProduction: string[] = [];
  if (!exclusions.excludeLofi && /lo-fi|lofi/i.test(lower)) explicitProduction.push('Lo-Fi');
  if (!exclusions.excludeAcoustic && /acoustic|mộc|unplugged/i.test(lower)) explicitProduction.push('Acoustic');
  if (!exclusions.excludeDistortion && /distortion|méo tiếng/i.test(lower)) explicitProduction.push('Distortion');

  return {
    rawInput: (rawInput || '').trim(),
    exclusions,
    isAcoustic,
    isElectronic,
    isCinematic,
    isMetalOrHeavy,
    isAmbient,
    isLofi,
    isRock,
    isHipHop,
    isPop,
    isFolk,
    culturalStyle,
    explicitEra,
    isModernExplicit,
    energyLevel,
    explicitMoods,
    vocalGender,
    vocalTexture,
    isInstrumental,
    explicitInstruments,
    explicitArrangement,
    explicitProduction
  };
};

/**
 * Checks whether an attribute (e.g. '1980s', 'Lo-Fi', 'Metal', 'Jazz') has meaningful
 * support in the UserIntentProfile derived from the CURRENT input.
 */
export const hasExplicitSupport = (attribute: string, profile: UserIntentProfile): boolean => {
  const lowerAttr = attribute.toLowerCase();
  const inputLower = profile.rawInput.toLowerCase();

  switch (lowerAttr) {
    case '1980s':
    case '80s':
      return profile.explicitEra === '1980s';
    case 'retro':
    case 'vintage':
      return profile.explicitEra === 'retro' || profile.explicitEra === '1980s' || profile.explicitEra === '1970s';
    case 'synthwave':
    case 'retrowave':
      return /synthwave|retrowave|outrun/i.test(inputLower);
    case 'cyberpunk':
      return /cyberpunk|cyber\b/i.test(inputLower);
    case 'lo-fi':
    case 'lofi':
    case 'lo-fi hip hop':
      return profile.isLofi;
    case 'orchestral':
    case 'symphony':
    case 'chamber music':
      return profile.isCinematic || /orchestral|symphon|dàn nhạc|giao hưởng/i.test(inputLower);
    case 'jazz':
    case 'smooth jazz':
    case 'bebop':
    case 'swing':
      return /jazz|blues|swing|bebop|bossa/i.test(inputLower);
    case 'metal':
    case 'heavy metal':
    case 'thrash metal':
    case 'death metal':
    case 'power metal':
    case 'symphonic metal':
    case 'folk metal':
      return profile.isMetalOrHeavy;
    case 'trap':
      return /trap|drill|phonk/i.test(inputLower);
    case 'gospel':
      return /gospel|thánh ca/i.test(inputLower);
    case 'operatic':
    case 'opera':
      return /operatic|opera/i.test(inputLower) || profile.vocalTexture.includes('operatic');
    case 'cinematic':
    case 'soundtrack':
    case 'trailer music':
      return profile.isCinematic;
    case 'aggressive':
      return profile.explicitMoods.includes('Aggressive') || profile.isMetalOrHeavy || /aggressive|hung hăng|gắt/i.test(inputLower);
    case 'ambient':
      return profile.isAmbient;
    case 'dark':
      return profile.explicitMoods.includes('Dark') || profile.isMetalOrHeavy || /dark|tăm tối|u tối/i.test(inputLower);
    case 'female vocal':
    case 'female harmony':
      return profile.vocalGender === 'female' || profile.vocalGender === 'duet';
    case 'male vocal':
    case 'male harmony':
      return profile.vocalGender === 'male' || profile.vocalGender === 'duet';
    case 'vocoder':
    case 'male vocoder':
      return /vocoder/i.test(inputLower);
    default:
      return inputLower.includes(lowerAttr);
  }
};

/**
 * Quality Engine Post-Processing Pipeline:
 * Enforces:
 * 1. User Intent Priority
 * 2. Unsupported Inference Guard
 * 3. Genre Drift Guard
 * 4. Vocal Fidelity Lock
 * 5. Instrument Fidelity
 * 6. Arrangement Fidelity
 */
export const applyQualityEngine = (
  initialSelections: SelectionState,
  intent: PrimaryIntent,
  profile: UserIntentProfile
): { selections: SelectionState; removedTags: RemovedTagReport[] } => {
  const result: SelectionState = createEmptySelections();
  const removed: RemovedTagReport[] = [];

  const addTag = (cat: CategoryKey, tag: string) => {
    if (!result[cat].includes(tag)) result[cat].push(tag);
  };

  const removeTag = (cat: CategoryKey, tag: string, reason: string) => {
    removed.push({ category: cat, tag, reason });
  };

  // Copy initial items into working set
  (Object.keys(initialSelections) as CategoryKey[]).forEach(cat => {
    result[cat] = [...initialSelections[cat]];
  });

  // =========================================================================
  // 0. EXCLUSION & NEGATION GUARD (Highest Priority)
  // Tags matching user negative directives are immediately purged.
  // =========================================================================
  (Object.keys(result) as CategoryKey[]).forEach(cat => {
    result[cat] = result[cat].filter(tag => {
      if (isTagExcluded(cat, tag, profile.exclusions)) {
        removeTag(cat, tag, `Yếu tố "${tag}" bị loại trừ rõ ràng theo yêu cầu phủ định của người dùng`);
        return false;
      }
      return true;
    });
  });

  // =========================================================================
  // 1. VOCAL FIDELITY LOCK
  // Explicit vocal instructions from the user MUST override inferred vocals.
  // =========================================================================
  if (profile.isInstrumental) {
    result.vocals = [];
    addTag('production', 'Instrumental');
    addTag('structure', 'Instrumental');
  } else if (profile.vocalGender === 'male') {
    // Remove female vocal indicators
    result.vocals = result.vocals.filter(v => {
      if (/\bfemale\b|\bnữ\b|\bnu\b|idol group/i.test(v)) {
        removeTag('vocals', v, 'Xung đột với yêu cầu giọng nam của người dùng');
        return false;
      }
      return true;
    });
    addTag('vocals', 'Male Vocal');

    if (profile.vocalTexture.includes('warm') || profile.vocalTexture.includes('mature')) {
      if (!result.vocals.includes('Soulful Singing') && !result.vocals.includes('Deep Voice')) {
        addTag('vocals', 'Soulful Singing');
      }
    }
  } else if (profile.vocalGender === 'female') {
    // Remove male vocal indicators (prevent false match on 'Female Vocal')
    result.vocals = result.vocals.filter(v => {
      if (/(?<!fe)male|\bnam\b|vocoder/i.test(v)) {
        removeTag('vocals', v, 'Xung đột với yêu cầu giọng nữ của người dùng');
        return false;
      }
      return true;
    });
    addTag('vocals', 'Female Vocal');

    if (profile.vocalTexture.includes('airy')) {
      addTag('vocals', 'Airy Vocal');
    }
  } else if (profile.vocalGender === 'duet') {
    // Duet / Mixed allows both
    if (!result.vocals.includes('Female Vocal') && !result.vocals.includes('Male Vocal')) {
      addTag('vocals', 'Female Vocal');
      addTag('vocals', 'Male Vocal');
    }
  }

  // =========================================================================
  // 2. INSTRUMENT FIDELITY
  // Explicitly requested instruments are retained/added at top priority.
  // =========================================================================
  profile.explicitInstruments.forEach(inst => {
    if (!result.instruments.includes(inst)) {
      result.instruments.unshift(inst);
    }
  });

  // =========================================================================
  // 3. GENRE DRIFT GUARD & UNSUPPORTED INFERENCE GUARD
  // Checks strong attributes and secondary genres.
  // =========================================================================
  const strongAttributesToCheck: { tag: string; cat: CategoryKey; check: () => boolean }[] = [
    { tag: '1980s', cat: 'production', check: () => hasExplicitSupport('1980s', profile) },
    { tag: 'Retro', cat: 'production', check: () => hasExplicitSupport('retro', profile) },
    { tag: 'Synthwave', cat: 'genres', check: () => hasExplicitSupport('synthwave', profile) },
    { tag: 'Cyberpunk', cat: 'production', check: () => hasExplicitSupport('cyberpunk', profile) },
    { tag: 'Lo-Fi', cat: 'production', check: () => hasExplicitSupport('lo-fi', profile) },
    { tag: 'Lo-Fi Hip Hop', cat: 'genres', check: () => hasExplicitSupport('lo-fi', profile) },
    { tag: 'Jazz', cat: 'genres', check: () => hasExplicitSupport('jazz', profile) },
    { tag: 'Metal', cat: 'genres', check: () => hasExplicitSupport('metal', profile) },
    { tag: 'Heavy Metal', cat: 'genres', check: () => hasExplicitSupport('metal', profile) },
    { tag: 'Trap', cat: 'genres', check: () => hasExplicitSupport('trap', profile) },
    { tag: 'Gospel', cat: 'genres', check: () => hasExplicitSupport('gospel', profile) },
    { tag: 'Orchestral', cat: 'genres', check: () => hasExplicitSupport('orchestral', profile) },
    { tag: 'Cinematic', cat: 'genres', check: () => hasExplicitSupport('cinematic', profile) },
    { tag: 'Vocoder', cat: 'effects', check: () => hasExplicitSupport('vocoder', profile) },
    { tag: 'Male Vocoder', cat: 'vocals', check: () => hasExplicitSupport('vocoder', profile) }
  ];

  strongAttributesToCheck.forEach(({ tag, cat, check }) => {
    if (result[cat].includes(tag) && !check()) {
      // If modern is explicitly requested, eliminate 80s/synthwave/retro
      result[cat] = result[cat].filter(t => t !== tag);
      removeTag(cat, tag, `Thuộc tính mạnh "${tag}" không có cơ sở trong yêu cầu người dùng (Unsupported Inference Guard)`);
    }
  });

  // Primary Intent specific genre drift guards:
  if (intent.profile === 'edm_electronic') {
    // E.g. Festival future bass EDM: prevent 80s/synthwave/retro drift unless supported
    const edmDisallowedGenres = ['Synthwave', 'Vaporwave', 'Lo-Fi Hip Hop', 'Heavy Metal', 'Country', 'Blues'];
    result.genres = result.genres.filter(g => {
      if (edmDisallowedGenres.includes(g) && !profile.rawInput.toLowerCase().includes(g.toLowerCase())) {
        removeTag('genres', g, `Lệch thể loại so với định hướng EDM/Electronic chủ đạo (Genre Drift Guard)`);
        return false;
      }
      return true;
    });
    if (profile.isModernExplicit) {
      result.production = result.production.filter(p => {
        if (p === '1980s' || p === 'Retro' || p === 'Vintage') {
          removeTag('production', p, 'Mâu thuẫn với yêu cầu hiện đại (Modern EDM)');
          return false;
        }
        return true;
      });
    }
  } else if (intent.profile === 'acoustic_ballad' || intent.profile === 'piano_ballad') {
    // Acoustic Ballads: prevent Lo-Fi, Jazz, EDM, Metal drift unless explicitly supported
    const balladDisallowedGenres = ['EDM', 'Dubstep', 'Techno', 'Heavy Metal', 'Thrash Metal', 'Hardstyle', 'Lo-Fi Hip Hop'];
    result.genres = result.genres.filter(g => {
      if (balladDisallowedGenres.includes(g) && !profile.rawInput.toLowerCase().includes(g.toLowerCase())) {
        removeTag('genres', g, `Lệch thể loại so với Ballad mộc (Genre Drift Guard)`);
        return false;
      }
      return true;
    });
  }

  // =========================================================================
  // 4. ARRANGEMENT FIDELITY
  // Preserve explicit progression instructions
  // =========================================================================
  if (profile.explicitArrangement.includes('atmospheric intro') || profile.explicitArrangement.includes('minimal intro')) {
    if (!result.structure.includes('[Intro]')) addTag('structure', '[Intro]');
  }
  if (profile.explicitArrangement.includes('escalating build-up') || profile.explicitArrangement.includes('gradual emotional development')) {
    if (!result.structure.includes('Slow build-up') && !result.structure.includes('Crescendo')) {
      addTag('structure', 'Slow build-up');
    }
  }
  if (profile.explicitArrangement.includes('explosive drop') || profile.explicitArrangement.includes('drop')) {
    if (!result.production.includes('[Bass Drop]')) addTag('production', '[Bass Drop]');
  }

  // Cap lengths cleanly
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

  return { selections: result, removedTags: removed };
};
