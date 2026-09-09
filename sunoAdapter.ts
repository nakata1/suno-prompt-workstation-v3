import { SelectionState } from './types';
import { derivePrimaryIntent } from './semanticValidator';

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

const inferTempo = (s: SelectionState, idea: string): string => {
  const hay = `${idea} ${s.structure.join(' ')} ${s.moods.join(' ')}`.toLowerCase();
  if (/fast|upbeat|energetic|dance|edm|drum and bass|rock|nhanh|sôi động/.test(hay)) return 'up-tempo, driving rhythmic pulse';
  if (/slow|sad|melanch|ballad|romantic|buồn|chậm|trữ tình/.test(hay)) return 'slow to mid-tempo, spacious emotional pulse';
  return 'moderate tempo with natural, organic rhythmic movement';
};

const inferArc = (s: SelectionState): string => {
  if (s.structure.length) return `clear song form with ${join(s.structure).toLowerCase()}`;
  return 'clear verse-to-chorus progression, memorable melodic hook, and dynamic dynamic lift into the final section';
};

export const composeSunoStylePrompt = (
  idea: string,
  optimizedIdea: string,
  selections: SelectionState,
  modelProfile: SunoModelProfile = 'auto'
): string => {
  const concept = clean(optimizedIdea || idea);
  const intent = derivePrimaryIntent(idea, optimizedIdea, selections);

  const sentences: string[] = [];

  // 1. Dominant genre / musical identity with natural musical direction
  const article = /^[aeiou]/i.test(intent.descriptor) ? 'an' : 'a';
  const openingAtmosphere = intent.atmosphere ? ` with ${intent.atmosphere}` : '';
  sentences.push(`Create ${article} ${intent.descriptor}${openingAtmosphere}`.trim());

  // 2. Emotional atmosphere (filter out words already prominent in the opening)
  const openingLower = sentences[0].toLowerCase();
  const remainingMoods = selections.moods.filter(m => !openingLower.includes(m.toLowerCase()));
  if (remainingMoods.length) {
    sentences.push(`Emotional tone: ${unique(remainingMoods).join(', ')}`);
  }

  // Core concept if distinct from musical direction
  if (concept && !sentences[0].toLowerCase().includes(concept.toLowerCase())) {
    sentences.push(`Core narrative: ${concept}`);
  }

  // 3. Instrumentation
  if (selections.instruments.length) {
    const instList = unique(selections.instruments).join(', ');
    sentences.push(`Instrumentation: ${instList}, arranged with acoustic balance and clear separation`);
  }

  // 4. Vocal character
  if (selections.vocals.length) {
    const vocalList = unique(selections.vocals).join(', ');
    sentences.push(`Vocal character: ${vocalList}, natural phrasing with emotionally believable delivery`);
  }

  // 5. Rhythm / pacing
  sentences.push(`Rhythm and pacing: ${inferTempo(selections, concept)}`);

  // 6. Arrangement arc
  sentences.push(`Arrangement arc: ${inferArc(selections)}`);

  // 7. Production character
  const prodElements = unique([
    ...selections.production,
    ...selections.mixingPresets,
    ...selections.v5Performance,
    ...selections.effects
  ]);
  if (prodElements.length) {
    sentences.push(`Production character: ${prodElements.join(', ')}, balanced stereo imaging, controlled dynamics, and clean master presence`);
  }

  // Stylistic nuances (Anime/Drama, V5 Advanced)
  const specialElements = unique([...selections.animeDrama, ...selections.v5Advanced]);
  if (specialElements.length) {
    sentences.push(`Stylistic nuances: ${specialElements.join(', ')}`);
  }

  // Current Suno generations respond well to detailed natural-language style instructions.
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
  const hay = `${idea} ${Object.values(selections).flat().join(' ')}`.toLowerCase();
  const experimental = /experimental|avant|glitch|noise|hyperpop|breakcore|abstract|psychedelic|thực nghiệm/.test(hay);
  const strict = /ballad|classical|orchestral|bolero|folk|acoustic|worship|trữ tình|dân ca/.test(hay);
  const energetic = /edm|dance|rock|metal|drum and bass|fast|energetic|sôi động/.test(hay);

  let weirdness = experimental ? 68 : strict ? 32 : 45;
  let styleInfluence = experimental ? 66 : strict ? 82 : 74;
  if (selections.genres.length >= 3) styleInfluence = Math.min(styleInfluence, 70);
  if (selections.v5Advanced.length >= 3) weirdness = Math.min(65, weirdness + 8);

  let durationMinutes = 3.5;
  if (/epic|cinematic|progressive|symphony|opera|sử thi/.test(hay)) durationMinutes = 4.5;
  if (/short|jingle|intro|tiktok|ngắn/.test(hay)) durationMinutes = 2.0;
  if (energetic && durationMinutes === 3.5) durationMinutes = 3.25;

  const exclude: string[] = [];
  if (/acoustic|folk|ballad|bolero|piano/.test(hay)) exclude.push('harsh distortion', 'overly busy drums');
  if (/cinematic|orchestral|classical/.test(hay)) exclude.push('cheap synth presets');
  if (/lo-fi|lofi/.test(hay)) exclude.push('over-polished mastering');

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
