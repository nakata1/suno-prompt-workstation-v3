import { SelectionState } from './types';
import { derivePrimaryIntent } from './semanticValidator';
import { buildUserIntentProfile } from './musicQualityEngine';
import { MusicBlueprint, buildMusicBlueprint } from './musicBlueprint';
import {
  determineVocalAuthority,
  sanitizeSelectionsByVocalAuthority,
  sanitizePromptOutputByVocalAuthority
} from './vocalAuthority';

export type SunoModelProfile = 'auto' | 'v5.5';

export interface SunoSettingsRecommendation {
  model: string;
  weirdness: number;
  styleInfluence: number;
  durationMinutes: number;
  exclude: string;
  note: string;
}

const clean = (value: string) => value.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
const unique = (items: string[]) => Array.from(new Set(items.map(clean).filter(Boolean)));
const join = (items: string[]) => unique(items).join(', ');

const inferTempo = (s: SelectionState, idea: string, positiveText?: string): string => {
  const hay = `${positiveText || idea} ${s.structure.join(' ')} ${s.moods.join(' ')}`.toLowerCase();
  if (/fast|upbeat|energetic|dance|edm|drum and bass|rock|nhanh|sôi động/.test(hay)) return 'up-tempo, driving rhythmic pulse';
  if (/slow|sad|melanch|ballad|romantic|buồn|chậm|trữ tình/.test(hay)) return 'slow to mid-tempo, spacious emotional pulse';
  return 'moderate tempo with natural, organic rhythmic movement';
};

const inferArc = (s: SelectionState): string => {
  if (s.structure.length) return `clear song form with ${join(s.structure).toLowerCase()}`;
  return 'clear verse-to-chorus progression, memorable melodic hook, and dynamic lift into the climax';
};

export const composeSunoStylePrompt = (
  idea: string,
  optimizedIdea: string,
  selections: SelectionState,
  modelProfile: SunoModelProfile = 'auto',
  inputBlueprint?: MusicBlueprint
): string => {
  const profile = buildUserIntentProfile(idea);
  const blueprint = inputBlueprint || buildMusicBlueprint(idea);
  const vocalAuth = determineVocalAuthority(idea, blueprint, profile);
  const cleanSelections = sanitizeSelectionsByVocalAuthority(selections, vocalAuth);
  const intent = derivePrimaryIntent(idea, optimizedIdea, cleanSelections, profile, blueprint);

  const sentences: string[] = [];

  // 1. Dominant genre & Primary Style Opening Sentence
  const styleDescriptor = blueprint.primaryStyle || intent.descriptor;
  const article = /^[aeiou]/i.test(styleDescriptor) ? 'an' : 'a';
  let opening = `Create ${article} ${styleDescriptor}`;

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
  } else if (intent.atmosphere) {
    opening += ` with ${intent.atmosphere}`;
  }
  sentences.push(opening.trim());

  // 2. Emotional atmosphere (avoiding words already prominent in the opening)
  const openingLower = sentences[0].toLowerCase();
  const allMoods = unique([...blueprint.moods, ...cleanSelections.moods])
    .filter(m => !openingLower.includes(m.toLowerCase()) && !blueprint.exclusions.some(e => e.toLowerCase() === m.toLowerCase()));
  if (allMoods.length) {
    sentences.push(`Emotional tone: ${allMoods.join(', ')}`);
  }

  // 3. Required Instrumentation
  const allInst = unique([
    ...blueprint.instruments.required,
    ...cleanSelections.instruments
  ]).filter(inst => !blueprint.instruments.excluded.some(ex => ex.toLowerCase() === inst.toLowerCase()));
  if (allInst.length) {
    sentences.push(`Instrumentation: ${allInst.join(', ')}, arranged with dynamic balance and spatial clarity`);
  }

  // 4. Vocal Character (Authoritative Vocal Constraint Enforcement)
  if (vocalAuth.authority === 'instrumental' || cleanSelections.structure.includes('Instrumental')) {
    sentences.push('Instrumental composition without lead vocals, emphasizing expressive melodic phrasing');
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
  } else if (cleanSelections.vocals.length) {
    const vocalList = unique(cleanSelections.vocals).join(', ');
    sentences.push(`Vocal character: ${vocalList}, natural phrasing with emotionally believable delivery`);
  }

  // 5. Rhythm and pacing / Energy
  const pacingDesc = inferTempo(cleanSelections, idea, profile.exclusions.positiveText);
  sentences.push(`Rhythm and pacing: ${pacingDesc}`);

  // 6. Arrangement arc
  if (blueprint.arrangement.structuralCues.length > 0) {
    sentences.push(`Arrangement arc: clear song form with ${join(blueprint.arrangement.structuralCues).toLowerCase()}`);
  } else {
    sentences.push(`Arrangement arc: ${inferArc(cleanSelections)}`);
  }

  // 7. Production aesthetic & Texture
  const rawProd = [
    ...blueprint.production.orientation,
    ...blueprint.production.texture,
    ...cleanSelections.production,
    ...cleanSelections.mixingPresets,
    ...cleanSelections.v5Performance,
    ...cleanSelections.effects
  ];
  // Filter out generic buzzwords
  const prodElements = unique(rawProd.filter(p => !/studio quality|masterpiece|high-fidelity/i.test(p)));
  if (prodElements.length) {
    sentences.push(`Production aesthetic: ${prodElements.join(', ')}, wide stereo imaging, and natural frequency response`);
  }

  // Stylistic nuances (Anime/Drama, V5 Advanced)
  const specialElements = unique([...cleanSelections.animeDrama, ...cleanSelections.v5Advanced]);
  if (specialElements.length) {
    sentences.push(`Stylistic nuances: ${specialElements.join(', ')}`);
  }

  // 8. Core thematic focus (sanitized, avoiding generic template phrases and language leakage)
  const rawConcept = clean(optimizedIdea || idea);
  const isVietnameseRaw = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(rawConcept);
  const isGenericFluff = /a high-quality song about|core narrative|studio production|rich instrumentation/i.test(rawConcept);
  if (rawConcept && !isVietnameseRaw && !isGenericFluff && !sentences[0].toLowerCase().includes(rawConcept.toLowerCase())) {
    sentences.push(`Core theme: ${rawConcept}`);
  }

  // Directional priority for Suno
  if (vocalAuth.authority === 'instrumental') {
    sentences.push('Prioritize expressive instrumental performance, rich arrangement detail, strong prompt adherence, and natural musical transitions');
  } else if (modelProfile === 'v5.5') {
    sentences.push('Prioritize expressive vocals, rich arrangement detail, strong prompt adherence, and natural musical transitions');
  } else {
    sentences.push('Prioritize strong prompt adherence, expressive performance, rich arrangement detail, and natural musical transitions');
  }

  const rawPrompt = sentences.map(s => clean(s).replace(/[.]+$/, '')).filter(Boolean).join('. ') + '.';
  return sanitizePromptOutputByVocalAuthority(rawPrompt, vocalAuth);
};

export const recommendSunoSettings = (
  idea: string,
  selections: SelectionState,
  modelProfile: SunoModelProfile = 'auto',
  inputBlueprint?: MusicBlueprint
): SunoSettingsRecommendation => {
  const profile = buildUserIntentProfile(idea);
  const blueprint = inputBlueprint || buildMusicBlueprint(idea);
  const positiveHay = `${profile.exclusions.positiveText} ${Object.values(selections).flat().join(' ')}`.toLowerCase();
  const experimental = /experimental|avant|glitch|noise|hyperpop|breakcore|abstract|psychedelic|thực nghiệm/.test(positiveHay);
  const strict = /ballad|classical|orchestral|bolero|folk|acoustic|worship|trữ tình|dân ca/.test(positiveHay);
  const energetic = /edm|dance|rock|metal|drum and bass|fast|energetic|sôi động/.test(positiveHay);

  let weirdness = experimental ? 68 : strict ? 32 : 45;
  let styleInfluence = experimental ? 66 : strict ? 82 : 74;
  if (selections.genres.length >= 3) styleInfluence = Math.min(styleInfluence, 70);
  if (selections.v5Advanced.length >= 3) weirdness = Math.min(65, weirdness + 8);

  let durationMinutes = 3.5;
  if (/epic|cinematic|progressive|symphony|opera|sử thi/.test(positiveHay)) durationMinutes = 4.5;
  if (/short|jingle|intro|tiktok|ngắn/.test(positiveHay)) durationMinutes = 2.0;
  if (energetic && durationMinutes === 3.5) durationMinutes = 3.25;

  const exclude: string[] = [];

  // Direct transfer of Blueprint and explicit user exclusions into Suno Exclude Styles setting
  if (blueprint.exclusions.length > 0) {
    exclude.push(...blueprint.exclusions);
  }
  if (profile.exclusions.excludedKeywords.length > 0) {
    exclude.push(...profile.exclusions.excludedKeywords);
  }

  // Vocal Authority negative constraints for Suno Exclude Styles
  const vocalAuth = determineVocalAuthority(idea, blueprint, profile);
  if (vocalAuth.authority === 'instrumental') {
    if (!exclude.includes('vocals')) exclude.push('vocals');
    if (!exclude.includes('singing')) exclude.push('singing');
  } else if (vocalAuth.authority === 'female') {
    if (!exclude.includes('male vocal')) exclude.push('male vocal');
  } else if (vocalAuth.authority === 'male') {
    if (!exclude.includes('female vocal')) exclude.push('female vocal');
  }

  if (/acoustic|folk|ballad|bolero|piano/.test(positiveHay) || blueprint.primaryStyle.includes('ballad')) {
    if (!exclude.includes('harsh distortion')) exclude.push('harsh distortion');
    if (!exclude.includes('overly busy drums')) exclude.push('overly busy drums');
  }
  if (/cinematic|orchestral|classical/.test(positiveHay) || blueprint.primaryStyle.includes('orchestral')) {
    if (!exclude.includes('cheap synth presets')) exclude.push('cheap synth presets');
  }
  if ((/lo-fi|lofi/.test(positiveHay) || blueprint.primaryStyle.includes('Lo-Fi')) && !profile.exclusions.excludeLofi) {
    if (!exclude.includes('over-polished mastering')) exclude.push('over-polished mastering');
  }

  return {
    model: modelProfile === 'v5.5' ? 'v5.5' : 'Latest / Auto',
    weirdness,
    styleInfluence,
    durationMinutes,
    exclude: unique(exclude).join(', '),
    note: 'Các giá trị là điểm khởi đầu đề xuất. Sau khi nghe bản đầu tiên, tăng Style Influence nếu Suno đi lệch phong cách; tăng Weirdness nếu kết quả quá an toàn hoặc lặp lại.'
  };
};

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
