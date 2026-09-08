import { SelectionState } from './types';

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
  if (/fast|upbeat|energetic|dance|edm|drum and bass|rock|nhanh|sôi động/.test(hay)) return 'up-tempo, driving pulse';
  if (/slow|sad|melanch|ballad|romantic|buồn|chậm|trữ tình/.test(hay)) return 'slow to mid-tempo, spacious pulse';
  return 'moderate tempo with natural rhythmic movement';
};

const inferArc = (s: SelectionState): string => {
  if (s.structure.length) return `clear song form with ${join(s.structure).toLowerCase()}`;
  return 'clear verse-to-chorus development, memorable hook, controlled dynamic lift into the final section';
};

export const composeSunoStylePrompt = (
  idea: string,
  optimizedIdea: string,
  selections: SelectionState,
  modelProfile: SunoModelProfile = 'auto'
): string => {
  const genres = join(selections.genres);
  const moods = join(selections.moods);
  const vocals = join(selections.vocals);
  const instruments = join(selections.instruments);
  const production = join([...selections.production, ...selections.mixingPresets]);
  const performance = join([...selections.v5Performance, ...selections.v5Advanced]);
  const effects = join(selections.effects);
  const special = join(selections.animeDrama);
  const concept = clean(optimizedIdea || idea);

  const sentences: string[] = [];
  if (genres || moods) sentences.push(`Create ${[moods, genres].filter(Boolean).join(' ')} music`.trim());
  else if (concept) sentences.push(`Create a song inspired by: ${concept}`);
  else sentences.push('Create a polished, emotionally coherent song');

  if (concept && !sentences[0].includes(concept)) sentences.push(`Core concept: ${concept}`);
  if (vocals) sentences.push(`Vocal direction: ${vocals}, natural phrasing, emotionally believable delivery`);
  if (instruments) sentences.push(`Instrumentation: ${instruments}`);
  sentences.push(`Rhythm and pacing: ${inferTempo(selections, concept)}`);
  sentences.push(`Arrangement: ${inferArc(selections)}`);
  if (performance) sentences.push(`Performance character: ${performance}`);
  if (production || effects) sentences.push(`Production: ${join([production, effects])}, balanced mix, clear separation, controlled dynamics`);
  if (special) sentences.push(`Additional aesthetic: ${special}`);

  // Current Suno generations respond well to detailed natural-language style instructions.
  // Keep the output model-agnostic so it remains usable when Suno retires older models.
  if (modelProfile === 'v5.5') sentences.push('Prioritize expressive vocals, rich arrangement detail, strong prompt adherence, and natural musical transitions');
  else sentences.push('Prioritize strong prompt adherence, expressive performance, rich arrangement detail, and natural musical transitions');

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
