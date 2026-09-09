import { extractExclusions, ExclusionProfile, isTagExcluded } from './musicQualityEngine';
import { CategoryKey } from './types';

/**
 * Authoritative Deterministic Music Blueprint Type (V4.4)
 * Represents the single source of truth for the CURRENT user's musical intent.
 */
export interface MusicBlueprint {
  primaryStyle: string;
  secondaryStyles: string[];

  moods: string[];
  energy: {
    start: string;
    middle: string;
    climax: string;
    ending: string;
  };

  vocals: {
    presence: 'instrumental' | 'vocal' | 'unspecified';
    gender: 'male' | 'female' | 'mixed' | 'unspecified';
    character: string[];
    language?: string;
  };

  instruments: {
    required: string[];
    optional: string[];
    excluded: string[];
  };

  arrangement: {
    intro?: string;
    development?: string;
    climax?: string;
    ending?: string;
    structuralCues: string[];
  };

  production: {
    orientation: string[];
    texture: string[];
    era?: string;
  };

  culturalContext: string[];
  cinematicContext: string[];

  exclusions: string[];

  explicitRequirements: string[];
  inferredRequirements: string[];

  confidence: number;
}

/**
 * Deterministically constructs a MusicBlueprint from raw user input.
 * Priority: explicit exclusions > explicit positive instructions > strong semantic inference > conservative defaults.
 */
export const buildMusicBlueprint = (rawInput: string): MusicBlueprint => {
  const input = (rawInput || '').trim();
  const exclusionsProfile: ExclusionProfile = extractExclusions(input);
  const positiveText = exclusionsProfile.positiveText;
  const lower = positiveText.toLowerCase();

  const explicitRequirements: string[] = [];
  const inferredRequirements: string[] = [];

  // =========================================================================
  // 1. EXCLUSIONS MAPPING
  // =========================================================================
  const exclusions: string[] = [...exclusionsProfile.rawExclusions];

  // Specific instrument exclusions
  const excludedInstruments: string[] = [];
  if (exclusionsProfile.excludeMetal || exclusionsProfile.excludeElectricGuitar) {
    excludedInstruments.push('Electric Guitar', 'Distorted Guitar');
  }
  if (exclusionsProfile.excludeHeavyDrums) {
    excludedInstruments.push('Power Drums', 'Aggressive Drums');
  }
  if (exclusionsProfile.excludeDrums) {
    excludedInstruments.push('Drums', 'Drum Kit', 'Drum Machine');
  }
  if (exclusionsProfile.excludePiano) {
    excludedInstruments.push('Piano', 'Grand Piano', 'Felt Piano');
  }
  if (exclusionsProfile.excludeAcousticGuitar) {
    excludedInstruments.push('Acoustic Guitar');
  }
  if (exclusionsProfile.excludeSynthesizer || exclusionsProfile.excludeEdm) {
    excludedInstruments.push('Synthesizer', 'Sawtooth Wave', 'Sub-bass', '808 Bass');
  }

  // Record negative directives in explicitRequirements for transparency
  if (exclusions.length > 0) {
    explicitRequirements.push(`Exclude: ${exclusions.join(', ')}`);
  }

  // =========================================================================
  // 2. VOCAL BLUEPRINT
  // =========================================================================
  let presence: MusicBlueprint['vocals']['presence'] = 'unspecified';
  let gender: MusicBlueprint['vocals']['gender'] = 'unspecified';
  const vocalCharacter: string[] = [];
  let detectedLanguage: string | undefined = undefined;

  // Language detection
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(input) || /tiếng việt|vietnamese/i.test(lower)) {
    detectedLanguage = 'Vietnamese';
  } else if (/english|tiếng anh/i.test(lower)) {
    detectedLanguage = 'English';
  } else if (/japanese|tiếng nhật/i.test(lower)) {
    detectedLanguage = 'Japanese';
  }

  // Instrumental / Vocal Presence
  const isExplicitInstrumental =
    exclusionsProfile.excludeVocals ||
    /\b(?:không\s+vocal|không\s+lời|khong\s+loi|no\s+vocals?|without\s+vocals?|instrumental|nhạc\s+không\s+lời)\b/i.test(input);

  if (isExplicitInstrumental) {
    presence = 'instrumental';
    explicitRequirements.push('Instrumental (no vocals)');
  } else {
    // Vocal gender
    if (/\b(?:song\s*ca|duet|nam\s*nữ|nam\s*nu|both\s*male\s*and\s*female|male\s*(?:and|&)\s*female|female\s*(?:and|&)\s*male|mixed\s*vocals?)\b/i.test(lower)) {
      presence = 'vocal';
      gender = 'mixed';
      explicitRequirements.push('Duet / Mixed vocals');
    } else if (/\b(?:giọng\s*nữ|giong\s*nu|vocal\s*nữ|nữ\s*hát|female\s*vocal|female\s*voice|female\s*hook)\b/i.test(lower)) {
      if (!exclusionsProfile.excludeFemaleVocal) {
        presence = 'vocal';
        gender = 'female';
        explicitRequirements.push('Female vocal');
      }
    } else if (/\b(?:giọng\s*nam|giong\s*nam|vocal\s*nam|nam\s*hát|(?<!fe)male\s*vocal|(?<!fe)male\s*voice)\b/i.test(lower)) {
      if (!exclusionsProfile.excludeMaleVocal) {
        presence = 'vocal';
        gender = 'male';
        explicitRequirements.push('Male vocal');
      }
    } else if (/\b(?:hợp\s*xướng|hop\s*xuong|choir)\b/i.test(lower)) {
      presence = 'vocal';
      gender = 'mixed';
      vocalCharacter.push('Choir');
      explicitRequirements.push('Choir vocals');
    }

    // Vocal character nuances
    if (/\b(?:ấm\s*áp|am\s*ap|warm)\b/i.test(lower)) {
      vocalCharacter.push('warm');
      explicitRequirements.push('Warm vocal');
    }
    if (/\b(?:mature|trưởng\s*thành|chững\s*chạc)\b/i.test(lower)) {
      vocalCharacter.push('mature');
      explicitRequirements.push('Mature vocal');
    }
    if (/\b(?:airy|thoáng\s*nhẹ|thoang\s*nhe|breathy)\b/i.test(lower)) {
      vocalCharacter.push('airy');
      explicitRequirements.push('Airy vocal');
    }
    if (/\b(?:natural|tự\s*nhiên|tu\s*nhien)\b/i.test(lower)) {
      vocalCharacter.push('natural');
    }
    if (/\b(?:heartfelt|giàu\s*cảm\s*xúc|giau\s*cam\s*xuc|cảm\s*xúc|emotional)\b/i.test(lower)) {
      vocalCharacter.push('heartfelt');
    }
    if (/\b(?:hook|female\s*vocal\s*hook)\b/i.test(lower)) {
      vocalCharacter.push('vocal hook');
    }
    if (/\b(?:raspy|khàn|khan|gritty)\b/i.test(lower)) {
      vocalCharacter.push('raspy');
    }
    if (/\b(?:operatic|opera)\b/i.test(lower)) {
      vocalCharacter.push('operatic');
    }
  }

  // =========================================================================
  // 3. INSTRUMENT BLUEPRINT (Required, Optional, Excluded)
  // =========================================================================
  const requiredInstruments: string[] = [];
  const optionalInstruments: string[] = [];

  const addRequired = (inst: string) => {
    if (!requiredInstruments.includes(inst) && !excludedInstruments.includes(inst)) {
      requiredInstruments.push(inst);
      explicitRequirements.push(`Instrument: ${inst}`);
    }
  };

  const addOptional = (inst: string) => {
    if (!optionalInstruments.includes(inst) && !requiredInstruments.includes(inst) && !excludedInstruments.includes(inst)) {
      optionalInstruments.push(inst);
    }
  };

  // Check explicit instrument calls
  if (/\b(?:felt\s*piano|piano\s*nỉ)\b/i.test(lower)) addRequired('Felt Piano');
  else if (/\b(?:grand\s*piano|đại\s*dương\s*cầm)\b/i.test(lower)) addRequired('Grand Piano');
  else if (/\bpiano\b/i.test(lower)) addRequired('Piano');

  if (/\b(?:acoustic\s*guitar|guitar\s*acoustic|guitar\s*mộc|guitar\s*thùng)\b/i.test(lower)) {
    addRequired('Acoustic Guitar');
  }

  if (/\b(?:heavy\s*electric\s*guitar|distorted\s*guitar|guitar\s*méo\s*tiếng)\b/i.test(lower) && !exclusionsProfile.excludeMetal) {
    addRequired('Heavy Electric Guitar');
  } else if (/\b(?:electric\s*guitar|guitar\s*điện)\b/i.test(lower) && !exclusionsProfile.excludeElectricGuitar) {
    addRequired('Electric Guitar');
  }

  if (/\b(?:war\s*drums|trống\s*trận)\b/i.test(lower) && !exclusionsProfile.excludeHeavyDrums) {
    addRequired('War Drums');
  } else if (/\b(?:taiko)\b/i.test(lower)) {
    addRequired('Taiko');
  } else if (/\b(?:timpani|trống\s*định\s*âm)\b/i.test(lower)) {
    addRequired('Timpani');
  } else if (/\b(?:drums?|trống|drum\s*kit)\b/i.test(lower) && !exclusionsProfile.excludeDrums && !exclusionsProfile.excludeHeavyDrums) {
    addRequired('Drum Kit');
  }

  if (/\b(?:choir|hợp\s*xướng)\b/i.test(lower)) {
    addRequired('Choir');
  }

  if (/\b(?:deep\s*sub-bass|sub-bass|sub\s*bass)\b/i.test(lower) && !exclusionsProfile.excludeEdm) {
    addRequired('Deep Sub-bass');
  }
  if (/\b(?:punchy\s*kick|808\s*kick)\b/i.test(lower) && !exclusionsProfile.excludeHeavyDrums) {
    addRequired('Punchy Kick');
  }
  if (/\b(?:wide\s*supersaw|supersaw|super-saw|sawtooth)\b/i.test(lower) && !exclusionsProfile.excludeEdm) {
    addRequired('Wide Supersaw');
  }
  if (/\b(?:synthesizer|synth)\b/i.test(lower) && !exclusionsProfile.excludeSynthesizer && !exclusionsProfile.excludeEdm) {
    addRequired('Synthesizer');
  }

  if (/\b(?:strings?|string\s*section|dàn\s*dây)\b/i.test(lower)) {
    addRequired('Strings');
  }
  if (/\b(?:brass|kèn\s*đồng)\b/i.test(lower)) {
    addRequired('Brass');
  }
  if (/\b(?:violin)\b/i.test(lower)) addRequired('Violin');
  if (/\b(?:cello)\b/i.test(lower)) addRequired('Cello');
  if (/\b(?:flute|sáo)\b/i.test(lower)) addRequired('Flute');

  // =========================================================================
  // 4. ARRANGEMENT & ENERGY BLUEPRINT
  // =========================================================================
  let intro: string | undefined = undefined;
  let development: string | undefined = undefined;
  let climax: string | undefined = undefined;
  let ending: string | undefined = undefined;
  const structuralCues: string[] = [];

  // Intro
  if (/\b(?:mở\s*đầu\s*tối\s*giản|minimal\s*intro)\b/i.test(lower)) {
    intro = 'minimal intro';
    explicitRequirements.push('Minimal intro');
    structuralCues.push('[Intro]');
  } else if (/\b(?:atmospheric\s*intro|spacious\s*intro)\b/i.test(lower)) {
    intro = 'atmospheric intro';
    explicitRequirements.push('Atmospheric intro');
    structuralCues.push('[Intro]');
  } else if (/\b(?:slow\s*tension\s*build)\b/i.test(lower)) {
    intro = 'slow tension build';
    explicitRequirements.push('Slow tension build');
    structuralCues.push('[Intro]');
  }

  // Development
  if (/\b(?:phát\s*triển\s*cảm\s*xúc\s*từ\s*từ|gradual\s*emotional\s*development)\b/i.test(lower)) {
    development = 'gradual emotional development';
    explicitRequirements.push('Gradual emotional development');
    structuralCues.push('[Verse]', '[Pre-Chorus]');
  } else if (/\b(?:escalating\s*build-up|build-up|dồn\s*dập)\b/i.test(lower)) {
    development = 'escalating build-up';
    explicitRequirements.push('Escalating build-up');
    structuralCues.push('[Build-up]');
  } else if (/\b(?:orchestral\s*lift|battle\s*build)\b/i.test(lower)) {
    development = 'orchestral lift';
    structuralCues.push('[Build-up]');
  }

  // Climax
  if (/\b(?:cao\s*trào(?:\s*cảm\s*xúc)?|emotional\s*climax|string\s*nhẹ\s*ở\s*cao\s*trào)\b/i.test(lower)) {
    climax = 'emotional climax';
    explicitRequirements.push('Emotional climax');
    structuralCues.push('[Climax]');
  } else if (/\b(?:explosive\s*drop|major\s*drop|bùng\s*nổ)\b/i.test(lower) && !exclusionsProfile.excludeEdm) {
    climax = 'explosive drop';
    explicitRequirements.push('Explosive drop');
    structuralCues.push('[Drop]');
  } else if (/\b(?:massive\s*battle\s*climax|huge\s*climax|battle\s*climax)\b/i.test(lower)) {
    climax = 'massive battle climax';
    explicitRequirements.push('Massive battle climax');
    structuralCues.push('[Climax]');
  }

  // Ending
  if (/\b(?:kết\s*thúc\s*nhẹ\s*nhàng|kết\s*nhẹ|gentle\s*ending|gentle\s*outro)\b/i.test(lower)) {
    ending = 'gentle ending';
    explicitRequirements.push('Gentle ending');
    structuralCues.push('[Outro]');
  } else if (/\b(?:dramatic\s*resolution)\b/i.test(lower)) {
    ending = 'dramatic resolution';
    structuralCues.push('[Outro]');
  } else if (/\b(?:fade\s*out|tape\s*fade)\b/i.test(lower)) {
    ending = 'soft tape fade-out';
    structuralCues.push('[Outro]');
  }

  // Default structural cues if none
  if (structuralCues.length === 0) {
    structuralCues.push('[Verse]', '[Chorus]', '[Outro]');
  }

  // =========================================================================
  // 5. CULTURAL & CINEMATIC CONTEXT
  // =========================================================================
  const culturalContext: string[] = [];
  const cinematicContext: string[] = [];

  if (/\b(?:việt\s*nam|vietnam|v-pop|tình\s*ca\s*việt)\b/i.test(lower)) {
    culturalContext.push('Vietnamese', 'V-Pop');
  }
  if (/\b(?:nordic|viking|bắc\s*âu|scandinavian)\b/i.test(lower)) {
    culturalContext.push('Nordic', 'Scandinavian');
  }
  if (/\b(?:japanese|j-pop|anime)\b/i.test(lower)) {
    culturalContext.push('Japanese');
  }
  if (/\b(?:celtic|irish)\b/i.test(lower)) {
    culturalContext.push('Celtic');
  }

  if (/\b(?:cinematic|soundtrack|nhạc\s*phim|trailer)\b/i.test(lower)) {
    cinematicContext.push('Cinematic Soundtrack');
  }
  if (/\b(?:battle\s*score|chiến\s*trường|sử\s*thi|battle)\b/i.test(lower)) {
    cinematicContext.push('Battle Score', 'Epic Drama');
  }

  // =========================================================================
  // 6. PRIMARY & SECONDARY STYLE RESOLUTION (Authoritative)
  // Resolve ONE dominant musical identity. Avoid generic labels.
  // =========================================================================
  let primaryStyle = '';
  const secondaryStyles: string[] = [];

  // CASE A: Vietnamese V-Pop Acoustic Ballad
  if (culturalContext.includes('Vietnamese') && /\b(?:ballad|acoustic|tình\s*ca|mộc)\b/i.test(lower) && !exclusionsProfile.excludeAcoustic) {
    primaryStyle = 'Vietnamese V-Pop acoustic ballad';
    secondaryStyles.push('Acoustic Ballad', 'V-Pop', 'Singer-Songwriter');
  }
  // CASE B: Nordic Symphonic Folk Metal
  else if (culturalContext.includes('Nordic') && /\b(?:metal|folk\s*metal|symphonic)\b/i.test(lower) && !exclusionsProfile.excludeMetal) {
    primaryStyle = 'Nordic symphonic folk metal';
    secondaryStyles.push('Symphonic Metal', 'Folk Metal', 'Epic Orchestral');
  }
  // CASE C: Modern Festival Future Bass EDM
  else if (/\b(?:future\s*bass|festival|edm)\b/i.test(lower) && !exclusionsProfile.excludeEdm) {
    primaryStyle = 'modern festival future bass EDM';
    secondaryStyles.push('Future Bass', 'Festival EDM', 'Melodic Electronic');
  }
  // CASE D: Instrumental Lo-Fi Study Piano
  else if (/\b(?:lo-?fi|chillhop)\b/i.test(lower) && !exclusionsProfile.excludeLofi) {
    if (requiredInstruments.some(i => i.includes('Piano')) || /\bpiano\b/i.test(lower)) {
      primaryStyle = 'Lo-Fi study piano';
      secondaryStyles.push('Lo-Fi Chillhop', 'Study Beats', 'Downtempo');
    } else {
      primaryStyle = 'Lo-Fi chillhop groove';
      secondaryStyles.push('Lo-Fi Hip Hop', 'Chillhop', 'Bedroom Pop');
    }
  }
  // CASE E: Cinematic Orchestral Battle Score
  else if (/\b(?:cinematic|orchestral)\b/i.test(lower) && /\b(?:battle|war|sử\s*thi)\b/i.test(lower)) {
    primaryStyle = 'cinematic orchestral battle score';
    secondaryStyles.push('Cinematic Orchestral', 'Epic Battle Score', 'Trailer Music');
  }
  // General Cinematic Orchestral
  else if (/\b(?:cinematic|orchestral|symphon)\b/i.test(lower)) {
    primaryStyle = 'cinematic orchestral score';
    secondaryStyles.push('Orchestral Score', 'Cinematic Soundtrack');
  }
  // General Heavy Metal
  else if (/\b(?:metal|heavy\s*metal)\b/i.test(lower) && !exclusionsProfile.excludeMetal) {
    primaryStyle = 'heavy metal anthem';
    secondaryStyles.push('Heavy Metal', 'Hard Rock');
  }
  // General Acoustic Ballad
  else if (/\b(?:acoustic|ballad|singer-songwriter)\b/i.test(lower) && !exclusionsProfile.excludeAcoustic) {
    primaryStyle = 'intimate singer-songwriter acoustic ballad';
    secondaryStyles.push('Acoustic Ballad', 'Singer-Songwriter', 'Folk Pop');
  }
  // Alternative Rock
  else if (/\b(?:rock|alternative|punk)\b/i.test(lower) && !exclusionsProfile.excludeRock) {
    primaryStyle = 'energetic alternative rock';
    secondaryStyles.push('Alternative Rock', 'Indie Rock');
  }
  // Urban Hip-Hop
  else if (/\b(?:hip-?hop|rap|trap|urban)\b/i.test(lower) && !exclusionsProfile.excludeHipHop) {
    primaryStyle = 'modern urban hip-hop';
    secondaryStyles.push('Hip-Hop', 'Trap Beat', 'Urban Groove');
  }
  // Traditional Folk
  else if (/\b(?:folk|dân\s*ca|traditional)\b/i.test(lower)) {
    primaryStyle = 'traditional world folk';
    secondaryStyles.push('World Folk', 'Traditional Acoustic');
  }
  // Ambient Meditative
  else if (/\b(?:ambient|meditative|thiền|soundscape)\b/i.test(lower)) {
    primaryStyle = 'ambient meditative soundscape';
    secondaryStyles.push('Ambient', 'Meditative', 'Healing Soundscape');
  }
  // Fallback
  else {
    primaryStyle = 'contemporary melodic pop';
    secondaryStyles.push('Pop', 'Melodic');
  }

  // Complement optional instruments based on primaryStyle
  if (primaryStyle.includes('ballad') || primaryStyle.includes('acoustic')) {
    addOptional('String Section');
    addOptional('Acoustic Bass');
  } else if (primaryStyle.includes('metal')) {
    addOptional('Bass Guitar');
    addOptional('Guitar Solo');
  } else if (primaryStyle.includes('EDM')) {
    addOptional('White Noise Riser');
    addOptional('Snare Roll');
  } else if (primaryStyle.includes('Lo-Fi')) {
    addOptional('Rhodes Piano');
    addOptional('Vinyl Crackle');
  } else if (primaryStyle.includes('orchestral') || primaryStyle.includes('battle')) {
    addOptional('French Horn');
    addOptional('Snare Drum');
  }

  // =========================================================================
  // 7. ENERGY CURVE BLUEPRINT
  // =========================================================================
  const energy = {
    start: intro || 'moderate start',
    middle: development || 'steady progression',
    climax: climax || 'melodic peak',
    ending: ending || 'natural resolution'
  };

  // Adjust energy based on resolved style if unspecified
  if (!intro) {
    if (primaryStyle.includes('ballad') || primaryStyle.includes('Lo-Fi')) energy.start = 'low, intimate';
    else if (primaryStyle.includes('EDM')) energy.start = 'atmospheric, building tension';
    else if (primaryStyle.includes('metal')) energy.start = 'medium-high driving pulse';
  }
  if (!development) {
    if (primaryStyle.includes('ballad')) energy.middle = 'gradual emotional rise';
    else if (primaryStyle.includes('EDM')) energy.middle = 'escalating build-up';
    else if (primaryStyle.includes('metal')) energy.middle = 'high momentum';
  }
  if (!climax) {
    if (primaryStyle.includes('ballad')) energy.climax = 'emotional peak';
    else if (primaryStyle.includes('EDM')) energy.climax = 'explosive drop';
    else if (primaryStyle.includes('metal')) energy.climax = 'powerful climax';
  }
  if (!ending) {
    if (primaryStyle.includes('ballad')) energy.ending = 'gentle fading resolution';
    else if (primaryStyle.includes('Lo-Fi')) energy.ending = 'soft warm fade';
    else if (primaryStyle.includes('metal') || primaryStyle.includes('battle')) energy.ending = 'dramatic resolution';
  }

  // =========================================================================
  // 8. MOODS BLUEPRINT
  // =========================================================================
  const moods: string[] = [];
  const addMood = (m: string) => {
    if (!moods.includes(m)) moods.push(m);
  };

  if (/\b(?:u\s*sầu|buồn|sad|melanchol)\b/i.test(lower)) addMood('Melancholic');
  if (/\b(?:hoài\s*niệm|nhớ|hoai\s*niem|nostalgic)\b/i.test(lower)) addMood('Nostalgic');
  if (/\b(?:ấm\s*áp|am\s*ap|warm)\b/i.test(lower)) addMood('Warm');
  if (/\b(?:thân\s*mật|sâu\s*lắng|intimate)\b/i.test(lower)) addMood('Intimate');
  if (/\b(?:giàu\s*cảm\s*xúc|heartfelt|emotional)\b/i.test(lower)) addMood('Heartfelt');

  if (/\b(?:epic|hùng\s*tráng|hung\s*trang)\b/i.test(lower)) addMood('Epic');
  if (/\b(?:cold|icy|lạnh\s*giá)\b/i.test(lower)) addMood('Cold');
  if (/\b(?:mythic|thần\s*thoại)\b/i.test(lower)) addMood('Mythic');
  if (/\b(?:heroic|anh\s*hùng)\b/i.test(lower)) addMood('Heroic');
  if (/\b(?:martial|chiến\s*đấu)\b/i.test(lower)) addMood('Martial');
  if (/\b(?:dark|tăm\s*tối)\b/i.test(lower) && !exclusionsProfile.excludeMetal) addMood('Dark');

  if (/\b(?:futuristic|tương\s*lai)\b/i.test(lower)) addMood('Futuristic');
  if (/\b(?:euphoric|hưng\s*phấn)\b/i.test(lower)) addMood('Euphoric');
  if (/\b(?:energetic|năng\s*động|sôi\s*động)\b/i.test(lower)) addMood('Energetic');
  if (/\b(?:relaxed|thư\s*giãn|chill)\b/i.test(lower)) addMood('Relaxed');

  // Fill in inferred moods if empty
  if (moods.length === 0) {
    if (primaryStyle.includes('ballad')) {
      moods.push('Melancholic', 'Nostalgic', 'Heartfelt');
    } else if (primaryStyle.includes('metal')) {
      moods.push('Epic', 'Mythic', 'Heroic');
    } else if (primaryStyle.includes('EDM')) {
      moods.push('Euphoric', 'Energetic', 'Futuristic');
    } else if (primaryStyle.includes('Lo-Fi')) {
      moods.push('Relaxed', 'Warm', 'Nostalgic');
    } else if (primaryStyle.includes('battle') || primaryStyle.includes('orchestral')) {
      moods.push('Epic', 'Martial', 'Grand');
    } else {
      moods.push('Melodic', 'Emotional');
    }
  }

  // =========================================================================
  // 9. PRODUCTION BLUEPRINT
  // =========================================================================
  const orientation: string[] = [];
  const texture: string[] = [];
  let era: string | undefined = undefined;

  // Era determination (strict: do NOT invent vintage/retro/80s unless supported)
  if (/\b(?:1980s|80s|eighties|synthwave)\b/i.test(lower) && !exclusionsProfile.excludeRetro) {
    era = '1980s';
  } else if (/\b(?:modern|hiện\s*đại|futuristic)\b/i.test(lower)) {
    era = 'modern';
  } else if (/\b(?:retro|vintage)\b/i.test(lower) && !exclusionsProfile.excludeRetro) {
    era = 'retro';
  }

  // Orientation & Texture
  if (primaryStyle.includes('ballad') || primaryStyle.includes('acoustic')) {
    orientation.push('Acoustic', 'Organic', 'Intimate');
    texture.push('Natural acoustic warmth', 'Dynamic balance', 'Spatial clarity');
  } else if (primaryStyle.includes('metal')) {
    orientation.push('Epic', 'Heavy', 'Symphonic');
    texture.push('Icy mythic atmosphere', 'Distorted drive', 'Commanding resonance');
  } else if (primaryStyle.includes('EDM')) {
    orientation.push('Modern electronic', 'Festival', 'Wide stereo');
    texture.push('Punchy club master', 'Clean supersaw spread', 'Sub-bass impact');
  } else if (primaryStyle.includes('Lo-Fi')) {
    orientation.push('Lo-Fi', 'Relaxed');
    texture.push('Warm tape texture', 'Soft crackle', 'Mellow resonance');
  } else if (primaryStyle.includes('battle') || primaryStyle.includes('orchestral')) {
    orientation.push('Cinematic', 'Orchestral', 'Grand');
    texture.push('Wide dynamic range', 'Acoustic hall reverberation', 'Martial impact');
  } else {
    orientation.push('Polished studio');
    texture.push('Balanced stereo imaging');
  }

  // Custom tape texture check
  if (/\b(?:warm\s*tape\s*texture|tape\s*texture)\b/i.test(lower)) {
    if (!texture.includes('Warm tape texture')) texture.unshift('Warm tape texture');
  }

  // =========================================================================
  // 10. DETERMINISTIC BLUEPRINT CONFIDENCE SCORE
  // High confidence (0.85 - 1.0): multiple explicit musical constraints.
  // Medium confidence (0.65 - 0.84): some explicit details + inference.
  // Low confidence (< 0.65): vague input.
  // =========================================================================
  let confidenceScore = 0.55;

  if (input.length > 20) confidenceScore += 0.05;
  if (primaryStyle && primaryStyle !== 'contemporary melodic pop') confidenceScore += 0.10;
  if (requiredInstruments.length >= 2) confidenceScore += 0.12;
  if (presence !== 'unspecified' || gender !== 'unspecified') confidenceScore += 0.08;
  if (intro || development || climax || ending) confidenceScore += 0.08;
  if (exclusions.length > 0) confidenceScore += 0.05;

  const confidence = Math.min(0.98, Math.max(0.45, Math.round(confidenceScore * 100) / 100));

  return {
    primaryStyle,
    secondaryStyles,
    moods,
    energy,
    vocals: {
      presence,
      gender,
      character: vocalCharacter,
      language: detectedLanguage
    },
    instruments: {
      required: requiredInstruments,
      optional: optionalInstruments,
      excluded: excludedInstruments
    },
    arrangement: {
      intro,
      development,
      climax,
      ending,
      structuralCues
    },
    production: {
      orientation,
      texture,
      era
    },
    culturalContext,
    cinematicContext,
    exclusions,
    explicitRequirements,
    inferredRequirements,
    confidence
  };
};

/**
 * Validates any candidate tags/selections strictly against a MusicBlueprint.
 * Automatically repairs or removes contradictions:
 * - Excluded genres, instruments, vocals, production
 * - Vocal contradictions
 * - Omission of required instruments
 * - Strong genre and era drift
 */
export const validateAgainstBlueprint = (
  selections: Record<CategoryKey, string[]>,
  blueprint: MusicBlueprint
): { validatedSelections: Record<CategoryKey, string[]>; repairs: string[] } => {
  const result: Record<CategoryKey, string[]> = {
    genres: [...(selections.genres || [])],
    production: [...(selections.production || [])],
    instruments: [...(selections.instruments || [])],
    moods: [...(selections.moods || [])],
    vocals: [...(selections.vocals || [])],
    structure: [...(selections.structure || [])],
    effects: [...(selections.effects || [])],
    v5Advanced: [...(selections.v5Advanced || [])],
    mixingPresets: [...(selections.mixingPresets || [])],
    animeDrama: [...(selections.animeDrama || [])],
    v5Performance: [...(selections.v5Performance || [])]
  };

  const repairs: string[] = [];

  // 1. Purge Excluded Concepts
  const lowerExclusions = blueprint.exclusions.map(e => e.toLowerCase());
  const excludedInstLower = blueprint.instruments.excluded.map(e => e.toLowerCase());

  (Object.keys(result) as CategoryKey[]).forEach(cat => {
    result[cat] = result[cat].filter(tag => {
      const tagLower = tag.toLowerCase();
      // Check general exclusions
      for (const ex of lowerExclusions) {
        if (tagLower === ex || (ex.length >= 3 && tagLower.includes(ex))) {
          repairs.push(`Removed "${tag}" in ${cat} because "${ex}" is excluded by Blueprint`);
          return false;
        }
      }
      // Check instrument exclusions
      if (cat === 'instruments') {
        for (const exInst of excludedInstLower) {
          if (tagLower === exInst || tagLower.includes(exInst)) {
            repairs.push(`Removed instrument "${tag}" because it is excluded by Blueprint`);
            return false;
          }
        }
      }
      return true;
    });
  });

  // 2. Vocal Contradiction Enforcement
  if (blueprint.vocals.presence === 'instrumental') {
    if (result.vocals.length > 0) {
      repairs.push(`Purged vocal tags [${result.vocals.join(', ')}] because Blueprint is instrumental`);
      result.vocals = [];
    }
  } else if (blueprint.vocals.gender === 'male') {
    result.vocals = result.vocals.filter(v => {
      if (/\bfemale\b|\bnữ\b|\bnu\b/i.test(v)) {
        repairs.push(`Removed female vocal tag "${v}" to match Blueprint male vocal`);
        return false;
      }
      return true;
    });
    if (!result.vocals.some(v => /(?<!fe)male/i.test(v))) {
      result.vocals.unshift('Male Vocal');
    }
  } else if (blueprint.vocals.gender === 'female') {
    result.vocals = result.vocals.filter(v => {
      if (/(?<!fe)male|\bnam\b/i.test(v)) {
        repairs.push(`Removed male vocal tag "${v}" to match Blueprint female vocal`);
        return false;
      }
      return true;
    });
    if (!result.vocals.some(v => /female/i.test(v))) {
      result.vocals.unshift('Female Vocal');
    }
  } else if (blueprint.vocals.gender === 'mixed') {
    // Preserve both male and female vocals for duet / mixed
    repairs.push('Preserved mixed vocal configuration from Blueprint');
  }

  // 3. Required Instruments Insertion
  blueprint.instruments.required.forEach(inst => {
    // Map Blueprint required instrument to catalog tag if needed
    let catalogTag = inst;
    if (inst === 'Heavy Electric Guitar' || inst === 'Heavy electric guitar') catalogTag = 'Distorted Guitar';
    if (inst === 'War Drums') catalogTag = 'Drum Kit';
    if (inst === 'Deep Sub-bass') catalogTag = 'Sub-bass';
    if (inst === 'Wide Supersaw') catalogTag = 'Sawtooth Wave';
    if (inst === 'Punchy Kick') catalogTag = '808 Kick';
    if (inst === 'Strings') catalogTag = 'String Section';

    if (!result.instruments.includes(catalogTag) && !blueprint.instruments.excluded.includes(catalogTag)) {
      result.instruments.unshift(catalogTag);
      repairs.push(`Preserved required instrument "${catalogTag}" from Blueprint`);
    }
  });

  // 4. Genre Drift & Era Drift Guard
  if (blueprint.primaryStyle.includes('ballad') || blueprint.primaryStyle.includes('acoustic')) {
    const disallowedGenres = ['Heavy Metal', 'EDM', 'Dubstep', 'Hardstyle', 'Thrash Metal'];
    result.genres = result.genres.filter(g => {
      if (disallowedGenres.includes(g)) {
        repairs.push(`Removed contradictory genre "${g}" for acoustic ballad Blueprint`);
        return false;
      }
      return true;
    });
  } else if (blueprint.primaryStyle.includes('EDM')) {
    const disallowedGenres = ['Heavy Metal', 'Country', 'Blues', 'Acoustic'];
    result.genres = result.genres.filter(g => {
      if (disallowedGenres.includes(g)) {
        repairs.push(`Removed contradictory genre "${g}" for EDM Blueprint`);
        return false;
      }
      return true;
    });
  } else if (blueprint.primaryStyle.includes('metal')) {
    const disallowedGenres = ['EDM', 'Bubblegum Pop', 'Bossa Nova', 'Lo-Fi Hip Hop'];
    result.genres = result.genres.filter(g => {
      if (disallowedGenres.includes(g)) {
        repairs.push(`Removed contradictory genre "${g}" for Metal Blueprint`);
        return false;
      }
      return true;
    });
  }

  // Limit selections per category cleanly
  result.genres = result.genres.slice(0, 3);
  result.moods = result.moods.slice(0, 3);
  result.instruments = result.instruments.slice(0, 5);
  result.vocals = result.vocals.slice(0, 2);
  result.structure = result.structure.slice(0, 2);
  result.production = result.production.slice(0, 2);

  return { validatedSelections: result, repairs };
};
