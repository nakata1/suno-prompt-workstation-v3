import { SelectionState } from './types';
import { derivePrimaryIntent } from './semanticValidator';
import { buildUserIntentProfile } from './musicQualityEngine';

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
  modelProfile: SunoModelProfile = 'auto'
): string => {
  const profile = buildUserIntentProfile(idea);
  const intent = derivePrimaryIntent(idea, optimizedIdea, selections, profile);

  const sentences: string[] = [];

  // 1. Dominant genre & Primary Intent Opening Sentence
  const article = /^[aeiou]/i.test(intent.descriptor) ? 'an' : 'a';
  let opening = `Create ${article} ${intent.descriptor}`;
  if (profile.explicitArrangement.length > 0 && profile.explicitInstruments.length > 0) {
    const arrText = profile.explicitArrangement.join(', ');
    const instText = profile.explicitInstruments.slice(0, 3).join(', ');
    opening += ` with ${arrText} driven by ${instText.toLowerCase()}`;
  } else if (intent.atmosphere) {
    opening += ` with ${intent.atmosphere}`;
  }
  sentences.push(opening.trim());

  // 2. Emotional tone & mood nuances (excluding words already prominent in the opening)
  const openingLower = sentences[0].toLowerCase();
  const remainingMoods = selections.moods.filter(m => !openingLower.includes(m.toLowerCase()));
  if (remainingMoods.length) {
    sentences.push(`Emotional tone: ${unique(remainingMoods).join(', ')}`);
  }

  // 3. Instrumentation
  if (selections.instruments.length) {
    const instList = unique(selections.instruments).join(', ');
    sentences.push(`Instrumentation: ${instList}, arranged with dynamic balance and spatial clarity`);
  }

  // 4. Vocal Character (Vocal Fidelity Lock)
  if (profile.isInstrumental || selections.structure.includes('Instrumental')) {
    sentences.push('Instrumental composition without lead vocals, emphasizing expressive melodic phrasing');
  } else if (selections.vocals.length) {
    if (profile.vocalGender === 'male') {
      const textures = profile.vocalTexture.length ? profile.vocalTexture.join(' ') : 'warm mature';
      sentences.push(`Vocal character: ${textures} male vocal, natural phrasing with heartfelt delivery`);
    } else if (profile.vocalGender === 'female') {
      const textures = profile.vocalTexture.length ? profile.vocalTexture.join(' ') : 'airy';
      sentences.push(`Vocal character: ${textures} female vocal hooks, clear phrasing with emotional nuance`);
    } else if (profile.vocalGender === 'choir') {
      sentences.push('Vocal character: soaring choir with harmonic grandeur and commanding resonance');
    } else {
      const vocalList = unique(selections.vocals).join(', ');
      sentences.push(`Vocal character: ${vocalList}, natural phrasing with emotionally believable delivery`);
    }
  }

  // 5. Rhythm and pacing
  sentences.push(`Rhythm and pacing: ${inferTempo(selections, idea, profile.exclusions.positiveText)}`);

  // 6. Arrangement arc
  sentences.push(`Arrangement arc: ${inferArc(selections)}`);

  // 7. Production aesthetic
  const rawProd = [
    ...selections.production,
    ...selections.mixingPresets,
    ...selections.v5Performance,
    ...selections.effects
  ];
  // Filter out generic buzzwords
  const prodElements = unique(rawProd.filter(p => !/studio quality|masterpiece|high-fidelity/i.test(p)));
  if (prodElements.length) {
    sentences.push(`Production aesthetic: ${prodElements.join(', ')}, wide stereo imaging, and natural frequency response`);
  }

  // Stylistic nuances (Anime/Drama, V5 Advanced)
  const specialElements = unique([...selections.animeDrama, ...selections.v5Advanced]);
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
  if (modelProfile === 'v5.5') {
    sentences.push('Prioritize expressive vocals, rich arrangement detail, strong prompt adherence, and natural musical transitions');
  } else {
    sentences.push('Prioritize strong prompt adherence, expressive performance, rich arrangement detail, and natural musical transitions');
  }

  return sentences.map(s => clean(s).replace(/[.]+$/, '')).filter(Boolean).join('. ') + '.';
};

export const recommendSunoSettings = (
  idea: string,
  selections: SelectionState,
  modelProfile: SunoModelProfile = 'auto'
): SunoSettingsRecommendation => {
  const profile = buildUserIntentProfile(idea);
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

  // Direct transfer of explicit user-negated terms into Suno Exclude Styles setting
  if (profile.exclusions.excludedKeywords.length > 0) {
    exclude.push(...profile.exclusions.excludedKeywords);
  }

  if (/acoustic|folk|ballad|bolero|piano/.test(positiveHay)) {
    if (!exclude.includes('harsh distortion')) exclude.push('harsh distortion');
    if (!exclude.includes('overly busy drums')) exclude.push('overly busy drums');
  }
  if (/cinematic|orchestral|classical/.test(positiveHay)) {
    if (!exclude.includes('cheap synth presets')) exclude.push('cheap synth presets');
  }
  if (/lo-fi|lofi/.test(positiveHay) && !profile.exclusions.excludeLofi) {
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
