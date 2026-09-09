
// Logic ported from original JS and typed
import { CategoryKey } from './types';
import { genres, instruments, moods, vocals, structure, effects, production, v5Advanced, mixingPresets, animeDrama, v5Performance } from './data';
import {
  derivePrimaryIntent,
  validateSelectionsWithIntent,
  PrimaryIntent,
  buildUserIntentProfile,
  applyQualityEngine,
  isTagExcluded,
  MusicBlueprint,
  buildMusicBlueprint,
} from './semanticValidator';
import { MusicIntentProfile, buildMusicIntentProfile } from './musicIntentProfile';
import {
  determineVocalAuthority,
  sanitizeSelectionsByVocalAuthority,
  sanitizeCreativeDirectionByVocalAuthority,
} from './vocalAuthority';

// Helper to convert File to Base64 for Gemini API
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

interface SafeApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  text: string | null;
  isJson: boolean;
  isOverloaded: boolean;
  error?: string;
}

/**
 * Hardened client-side fetch helper for all /api/gemini/* endpoints.
 *
 * Requirements enforced:
 * 1. Checks response.ok
 * 2. Inspects Content-Type: only calls response.json() when Content-Type indicates application/json
 * 3. Reads response.text() safely for HTML / non-JSON responses to prevent SyntaxError: Unexpected token '<'
 * 4. Treats HTML / non-JSON responses as API/server transport failures
 * 5. Accurately flags transient 429/503 overload states so the caller can activate Local Fallback cleanly
 */
async function safeFetchGeminiApi<T = any>(
  endpoint: string,
  body: unknown
): Promise<SafeApiResult<T>> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.toLowerCase().includes('application/json');

    if (!isJson) {
      // Safely read response as text; NEVER call response.json() on HTML or non-JSON
      const text = await res.text().catch(() => '');
      const isOverloaded = res.status === 429 || res.status === 503 ||
        /overloaded|service unavailable|rate limit/i.test(text);

      console.warn(
        `[Gemini Transport] Non-JSON response from ${endpoint} (HTTP ${res.status}, Content-Type: "${contentType}"). Gracefully falling back.`
      );

      return {
        ok: false,
        status: res.status,
        data: null,
        text,
        isJson: false,
        isOverloaded,
        error: `Server returned non-JSON response (HTTP ${res.status})`
      };
    }

    // Response is JSON: parse safely
    let parsed: any = null;
    try {
      parsed = await res.json();
    } catch (parseError) {
      console.warn(`[Gemini Transport] Failed to parse JSON from ${endpoint}:`, parseError);
      return {
        ok: false,
        status: res.status,
        data: null,
        text: null,
        isJson: false,
        isOverloaded: res.status === 429 || res.status === 503,
        error: 'Invalid JSON payload'
      };
    }

    const isOverloaded = res.status === 429 || res.status === 503 ||
      parsed?.transient === true || parsed?.code === 429 ||
      (parsed?.code === 503 && parsed?.transient !== false);

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: parsed,
        text: null,
        isJson: true,
        isOverloaded,
        error: parsed?.error || `HTTP ${res.status}`
      };
    }

    return {
      ok: true,
      status: res.status,
      data: parsed as T,
      text: null,
      isJson: true,
      isOverloaded: false
    };
  } catch (networkError: any) {
    console.warn(`[Gemini Transport] Network or connection error calling ${endpoint}:`, networkError);
    return {
      ok: false,
      status: 0,
      data: null,
      text: null,
      isJson: false,
      isOverloaded: false,
      error: networkError?.message || 'Network error'
    };
  }
}

export const analyzeImageSim = async (file: File): Promise<{ topic: string; tags: string[] }> => {
  try {
    const base64Data = await fileToBase64(file);
    const res = await safeFetchGeminiApi<{ topic?: string; tags?: string[] }>('/api/gemini/analyze-image', {
      base64Data,
      mimeType: file.type || 'image/jpeg'
    });
    if (res.ok && res.data?.topic && Array.isArray(res.data.tags)) {
      return { topic: res.data.topic, tags: res.data.tags };
    }
  } catch (error) {
    console.warn("Server Gemini Vision API failed, falling back to simulation:", error);
  }

  // Fallback Simulation (if no key or error)
  await new Promise(resolve => setTimeout(resolve, 1500));

  const simulatedResponses = [
    {
      topic: "Đua xe tốc độ dưới ánh đèn neon thành phố về đêm",
      tags: ['Synthwave', 'Dark', 'Energetic', 'Fast Tempo', 'Analog Synth']
    },
    {
      topic: "Con đường rừng yên tĩnh trong sương sớm",
      tags: ['Ambient', 'Relaxing', 'Acoustic Guitar', 'Flute', 'Birdsong']
    },
    {
      topic: "Tiệc bãi biển sôi động cùng bạn bè dưới nắng",
      tags: ['Reggae', 'Happy', 'Uplifting', 'Steel Drums', 'Medium Tempo']
    },
    {
      topic: "Khám phá ngôi đền cổ xưa bí ẩn",
      tags: ['Cinematic', 'Ominous', 'Orchestral', 'Duduk', 'Percussion']
    }
  ];

  return simulatedResponses[Math.floor(Math.random() * simulatedResponses.length)];
};

export const optimizePromptSim = (input: string): string => {
  const profile = buildUserIntentProfile(input);
  const positiveLower = profile.exclusions.positiveText.toLowerCase();

  // Vocal character based on user intent profile
  let vocalDesc = 'expressive vocals';
  if (profile.isInstrumental) {
    vocalDesc = 'instrumental without lead vocals';
  } else if (profile.vocalGender === 'male') {
    const tex = profile.vocalTexture.length ? profile.vocalTexture.join(' ') : 'warm mature';
    vocalDesc = `${tex} male vocal`;
  } else if (profile.vocalGender === 'female') {
    const tex = profile.vocalTexture.length ? profile.vocalTexture.join(' ') : 'clear emotive';
    vocalDesc = `${tex} female vocal`;
  } else if (profile.vocalGender === 'choir') {
    vocalDesc = 'soaring harmonic choir';
  }

  // Vietnamese Acoustic Ballad
  if ((profile.culturalStyle === 'vietnamese' || positiveLower.includes('việt nam') || positiveLower.includes('v-pop') || positiveLower.includes('tình ca')) && (profile.isAcoustic || positiveLower.includes('ballad') || positiveLower.includes('mộc'))) {
    const instStr = profile.explicitInstruments.length > 0 ? profile.explicitInstruments.join(', ') : 'piano and acoustic guitar';
    return `An intimate Vietnamese acoustic ballad about memories on a rainy day, featuring gentle ${instStr}, warm strings at the climax, and heartfelt ${vocalDesc}.`;
  }

  if (positiveLower.includes('sad') || positiveLower.includes('mưa') || positiveLower.includes('buồn') || positiveLower.includes('khóc')) {
    const prodDesc = profile.exclusions.excludeLofi ? 'organic acoustic production' : 'warm acoustic production';
    return `A melancholic and somber piano ballad, evoking feelings of a rainy day, with soft strings, ${prodDesc}, and ${vocalDesc}.`;
  }
  if (!profile.exclusions.excludeMetal && (positiveLower.includes('epic') || positiveLower.includes('chiến') || positiveLower.includes('hùng tráng') || positiveLower.includes('sử thi'))) {
    return "An epic, soaring orchestral soundtrack for a cinematic battle scene, powerful timpani, dramatic choir, and a rising crescendo, studio quality.";
  }
  if (!profile.exclusions.excludePop && (positiveLower.includes('happy') || positiveLower.includes('vui') || positiveLower.includes('hạnh phúc') || positiveLower.includes('cười'))) {
    return `An upbeat, energetic and happy pop song, fast tempo, with bright acoustic and electric textures, and ${vocalDesc}.`;
  }
  if (!profile.exclusions.excludeSynthwave && !profile.exclusions.excludeRetro && (positiveLower.includes('cyber') || positiveLower.includes('tương lai') || positiveLower.includes('future') || positiveLower.includes('máy móc'))) {
    return "Dark, futuristic synthwave, 1980s style, with pulsing analog synths, arpeggiators, and a driving drum machine rhythm.";
  }
  if (!profile.exclusions.excludeLofi && (positiveLower.includes('lofi') || positiveLower.includes('học') || positiveLower.includes('chill') || positiveLower.includes('thư giãn'))) {
    return "A cozy, nostalgic Lo-Fi hip hop beat, perfect for studying, with mellow electric piano, soft drums, and vinyl crackle, instrumental.";
  }
  return `An evocative musical piece inspired by "${profile.exclusions.positiveText}", featuring expressive instrumentation, balanced dynamic progression, and cohesive production.`;
};

// Returns a list of tag keys found in the input string to simulate AI suggestion
export const suggestTagsSim = (input: string): { category: CategoryKey, tag: string }[] => {
  const profile = buildUserIntentProfile(input);
  const inputLower = profile.exclusions.positiveText.toLowerCase();
  const suggestions: { category: CategoryKey, tag: string }[] = [];

  const checkAndPush = (map: any, category: CategoryKey) => {
     // Handle nested maps (like instruments/genres) or flat maps
     Object.entries(map).forEach(([key, value]) => {
         if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // It's a nested category (e.g., 'Rock': {...})
            Object.keys(value as any).forEach(subKey => {
                if (isTagExcluded(category, subKey, profile.exclusions)) return;
                const subVal = (value as any)[subKey] || '';
                if (inputLower.includes(subKey.toLowerCase()) || (typeof subVal === 'string' && inputLower.includes(subVal.toLowerCase()))) {
                    suggestions.push({ category, tag: subKey });
                }
            });
         } else {
             // It's a flat map
             if (isTagExcluded(category, key, profile.exclusions)) return;
             const label = value as string;
             if (inputLower.includes(key.toLowerCase()) || (typeof label === 'string' && inputLower.includes(label.toLowerCase()))) {
                 suggestions.push({ category, tag: key });
             }
         }
     });
  };

  checkAndPush(genres, 'genres');
  checkAndPush(instruments, 'instruments');
  checkAndPush(moods, 'moods');
  checkAndPush(effects, 'effects');
  checkAndPush(production, 'production');
  checkAndPush(v5Advanced, 'v5Advanced');
  checkAndPush(mixingPresets, 'mixingPresets');
  checkAndPush(v5Performance, 'v5Performance');

  // Explicit instruments from intent profile
  profile.explicitInstruments.forEach(inst => {
    if (!isTagExcluded('instruments', inst, profile.exclusions)) {
      suggestions.push({ category: 'instruments', tag: inst });
    }
  });

  // Emotional associations based strictly on positive text
  if (inputLower.includes('buồn') || inputLower.includes('sad') || inputLower.includes('nhớ') || inputLower.includes('mưa')) {
      if (!isTagExcluded('moods', 'Sad', profile.exclusions)) suggestions.push({ category: 'moods', tag: 'Sad' });
      if (!isTagExcluded('moods', 'Melancholic', profile.exclusions)) suggestions.push({ category: 'moods', tag: 'Melancholic' });
      if (!isTagExcluded('moods', 'Nostalgic', profile.exclusions)) suggestions.push({ category: 'moods', tag: 'Nostalgic' });
      if (!isTagExcluded('instruments', 'Piano', profile.exclusions)) suggestions.push({ category: 'instruments', tag: 'Piano' });
      if (!isTagExcluded('v5Performance', 'Expressive', profile.exclusions)) suggestions.push({ category: 'v5Performance', tag: 'Expressive' });
      if (!isTagExcluded('v5Performance', 'Intimate', profile.exclusions)) suggestions.push({ category: 'v5Performance', tag: 'Intimate' });
  }

  // Acoustic / Ballad associations on positive text
  if (profile.isAcoustic || inputLower.includes('ballad') || inputLower.includes('mộc') || inputLower.includes('acoustic')) {
      if (!isTagExcluded('genres', 'Acoustic', profile.exclusions)) suggestions.push({ category: 'genres', tag: 'Acoustic' });
      if (!isTagExcluded('genres', 'Pop', profile.exclusions)) suggestions.push({ category: 'genres', tag: 'Pop' });
      if (!isTagExcluded('instruments', 'Acoustic Guitar', profile.exclusions)) suggestions.push({ category: 'instruments', tag: 'Acoustic Guitar' });
  }

  // Rock associations (only if Rock/Metal are NOT excluded)
  if (!profile.exclusions.excludeRock && !profile.exclusions.excludeMetal) {
    if (inputLower.includes('rock') || (inputLower.includes('mạnh') && !profile.isAcoustic)) {
        if (!isTagExcluded('genres', 'Rock', profile.exclusions)) suggestions.push({ category: 'genres', tag: 'Rock' });
        if (!isTagExcluded('instruments', 'Electric Guitar', profile.exclusions)) suggestions.push({ category: 'instruments', tag: 'Electric Guitar' });
        if (!isTagExcluded('instruments', 'Drum Kit', profile.exclusions)) suggestions.push({ category: 'instruments', tag: 'Drum Kit' });
        if (!isTagExcluded('v5Performance', 'Dynamic', profile.exclusions)) suggestions.push({ category: 'v5Performance', tag: 'Dynamic' });
    }
  }

  // EDM associations (only if EDM is NOT excluded)
  if (!profile.exclusions.excludeEdm) {
     if (inputLower.includes('điện tử') || inputLower.includes('edm') || inputLower.includes('dance')) {
        if (!isTagExcluded('genres', 'EDM', profile.exclusions)) suggestions.push({ category: 'genres', tag: 'EDM' });
        if (!isTagExcluded('instruments', 'Synthesizer', profile.exclusions)) suggestions.push({ category: 'instruments', tag: 'Synthesizer' });
        if (!isTagExcluded('v5Performance', 'Wide Stereo', profile.exclusions)) suggestions.push({ category: 'v5Performance', tag: 'Wide Stereo' });
    }
  }

  // Deduplicate and filter out any excluded tags
  return suggestions.filter((v, i, a) => {
    if (isTagExcluded(v.category, v.tag, profile.exclusions)) return false;
    return a.findIndex(t => t.category === v.category && t.tag === v.tag) === i;
  });
};

export const generatePromptSim = async (input: string): Promise<string> => {
     // Simulates "AI Generate v5" - constructing a full prompt string
     await new Promise(resolve => setTimeout(resolve, 800));
     const opt = optimizePromptSim(input);
     // Add some v5 specific formatting
     return `[Part 1]
${opt}
(Detailed instrumentation: high fidelity, studio recording)`;
};

// Simple template-based lyric generator logic
export const generateLyricsSim = async (topic: string, style: string, lang: string): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 1000));

  const isSad = style.toLowerCase().includes('sad') || style.toLowerCase().includes('rain') || style.toLowerCase().includes('blue');
  const isEpic = style.toLowerCase().includes('epic') || style.toLowerCase().includes('war') || style.toLowerCase().includes('battle');
  
  let content = '';

  if (lang === 'ja') {
      if (isSad) {
          content = `[Verse 1]\n窓の外は雨 (Mado no soto wa ame)\n君の影を探して (Kimi no kage o sagashite)\nネオンライトが滲む (Neon lights blur)\n心はまだ痛む (My heart still hurts)\n\n[Chorus]\n${topic}の記憶 (Memories of ${topic})\n色褪せないまま (Not fading away)\nサヨナラは言えない (Can't say goodbye)\n涙が止まらない (Tears won't stop)`;
      } else if (isEpic) {
          content = `[Verse 1]\n灰の中から立ち上がれ (Rise from the ashes)\n運命の声を聴け (Hear the voice of destiny)\n嵐の中を進む (Moving through the storm)\n勇気を胸に (With courage in our hearts)\n\n[Chorus]\n${topic}のために！戦う今夜 (For ${topic}! Fight tonight)\n光よりも強く (Brighter than light)\n歴史に刻むこの瞬間 (Carve this moment in history)\n勝利を掴め (Seize the victory)`;
      } else {
          content = `[Verse 1]\n街を歩けば (Walking in the city)\nリズムを感じて (Feel the rhythm)\n未来は僕らの手の中に (Future is in our hands)\n迷わず進もう (Let's go without hesitation)\n\n[Chorus]\nそれが ${topic} (That's ${topic})\n自由に生きて (Living freely)\n手を掲げて (Raise your hands)\n魔法を感じて (Feel the magic)`;
      }
  } else if (lang === 'vi') {
      if (isSad) {
          content = `[Verse 1]\nMưa rơi bên hiên vắng\nTìm bóng hình em trong nắng\nĐèn đường nhạt nhòa hư ảo\nTim đau biết làm sao?\n\n[Chorus]\nKý ức về ${topic}\nChẳng thể nào phai nhòa\nLời chia tay chưa nói\nLệ rơi mãi không thôi`;
      } else if (isEpic) {
          content = `[Verse 1]\nĐứng lên từ tro tàn đổ nát\nNghe tiếng gọi của định mệnh vang vọng\nVượt qua bão tố cuồng phong\nLòng dũng cảm rực cháy trong tim\n\n[Chorus]\nVì ${topic}! Ta chiến đấu đêm nay!\nSáng hơn cả ánh hào quang\nKhắc ghi khoảnh khắc này vào lịch sử\nChiến thắng nằm trong tầm tay`;
      } else {
          content = `[Verse 1]\nDạo bước trên phố đông\nCảm nhận nhịp điệu trong lòng\nTương lai nằm trong tay ta\nNgại chi đường đời phong ba\n\n[Chorus]\nĐó chính là ${topic}\nSống tự do thỏa thích\nGiơ tay lên trời cao\nCảm nhận phép màu nào`;
      }
  } else {
      if (isSad) {
          content = `[Verse 1]\nRaindrops falling on the window pane\nThinking about you and the eased pain\nThe city lights blur into grey\nI wish you hadn't gone away\n\n[Chorus]\nOh, ${topic}, why did it end?\nJust a broken heart I cannot mend\nMemories fading in the mist\nThe last goodbye, the final kiss`;
      } else if (isEpic) {
          content = `[Verse 1]\nRise from the ashes, stand tall\nHeed the destiny, answer the call\nThrough the fire and the storm we ride\nWith honor and courage by our side\n\n[Chorus]\nFor the ${topic}! We fight tonight!\nBurning brighter than the morning light\nHistory written in our blood and sweat\nA victory we will never forget`;
      } else {
          content = `[Verse 1]\nWalking down the street, feeling the beat\nLife is a puzzle, incomplete\nBut we keep moving, yeah we flow\nWhere the river takes us, we go\n\n[Chorus]\nIt's all about ${topic}, yeah\nLiving life without a care\nHands in the air, everywhere\nFeel the magic, if you dare`;
      }
  }

  return `[Style: ${style.substring(0, 30)}...]\n[Topic: ${topic}]\n\n[Intro]\n(Instrumental Build-up)\n\n${content}\n\n[Outro]\n(Fade out)`;
};

// --- Real Gemini helpers for the Suno Prompt Workstation ---
// These proxy requests to the backend server which holds the Gemini API key securely.
export const optimizePromptAI = async (input: string): Promise<string> => {
  try {
    const res = await safeFetchGeminiApi<{ result?: string }>('/api/gemini/optimize-prompt', { input });
    if (res.ok && res.data?.result) {
      return res.data.result;
    }
  } catch (error) {
    console.warn('Gemini idea optimization failed; using fallback:', error);
  }
  return optimizePromptSim(input);
};

export const generatePromptAI = async (input: string): Promise<string> => {
  try {
    const res = await safeFetchGeminiApi<{ result?: string }>('/api/gemini/generate-prompt', { input });
    if (res.ok && res.data?.result) {
      return res.data.result;
    }
  } catch (error) {
    console.warn('Gemini Suno prompt generation failed; using fallback:', error);
  }
  return generatePromptSim(input);
};

export const generateLyricsAI = async (topic: string, style: string, lang: string): Promise<string> => {
  try {
    const res = await safeFetchGeminiApi<{ lyrics?: string }>('/api/gemini/generate-lyrics', { topic, style, lang });
    if (res.ok && res.data?.lyrics) {
      return res.data.lyrics;
    }
  } catch (error) {
    console.warn('Gemini lyrics generation failed; using fallback:', error);
  }
  return generateLyricsSim(topic, style, lang);
};


// --- AI Music Director -------------------------------------------------------
// One-shot orchestration layer: idea -> coherent creative direction + existing app tags.
export interface MusicDirectorResult {
  creativeDirection: string;
  selections: Partial<Record<CategoryKey, string[]>>;
  rationale: string;
  confidence: number;
  engine: 'gemini' | 'local';
  model?: string;
  primaryIntent?: PrimaryIntent;
  blueprint?: MusicBlueprint;
  coherenceScore?: number;
  fallbackReason?: 'overload' | 'unavailable';
  intentProfile?: MusicIntentProfile;
}

const flattenTagKeys = (map: any): string[] => {
  const out: string[] = [];
  Object.entries(map || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...Object.keys(value as Record<string, string>));
    } else {
      out.push(key);
    }
  });
  return Array.from(new Set(out));
};

const allowedTags: Record<CategoryKey, string[]> = {
  genres: flattenTagKeys(genres),
  production: flattenTagKeys(production),
  instruments: flattenTagKeys(instruments),
  moods: flattenTagKeys(moods),
  vocals: flattenTagKeys(vocals),
  structure: flattenTagKeys(structure),
  effects: flattenTagKeys(effects),
  v5Advanced: flattenTagKeys(v5Advanced),
  mixingPresets: flattenTagKeys(mixingPresets),
  animeDrama: flattenTagKeys(animeDrama),
  v5Performance: flattenTagKeys(v5Performance),
};

const sanitizeDirectorSelections = (raw: any): Partial<Record<CategoryKey, string[]>> => {
  const result: Partial<Record<CategoryKey, string[]>> = {};
  (Object.keys(allowedTags) as CategoryKey[]).forEach(category => {
    const list = Array.isArray(raw?.[category]) ? raw[category] : [];
    const allowed = new Set(allowedTags[category]);
    const cleaned = Array.from(new Set(list.filter((x: unknown) => typeof x === 'string' && allowed.has(x as string)))) as string[];
    if (cleaned.length) result[category] = cleaned.slice(0, category === 'instruments' ? 5 : 3);
  });
  return result;
};

export const musicDirectorFallback = (input: string, isOverloaded: boolean = false, inputBlueprint?: MusicBlueprint): MusicDirectorResult => {
  const profile = buildUserIntentProfile(input);
  const blueprint = inputBlueprint || buildMusicBlueprint(input);
  const base = suggestTagsSim(input);
  const selections: Partial<Record<CategoryKey, string[]>> = {};

  base.forEach(({category, tag}) => {
    if (!isTagExcluded(category, tag, profile.exclusions) && !blueprint.exclusions.some(e => e.toLowerCase() === tag.toLowerCase())) {
      selections[category] = Array.from(new Set([...(selections[category] || []), tag]));
    }
  });

  const addFirstAvailable = (category: CategoryKey, candidates: string[]) => {
    const allowed = new Set(allowedTags[category]);
    const hit = candidates.find(x => allowed.has(x) && !isTagExcluded(category, x, profile.exclusions) && !blueprint.exclusions.some(e => e.toLowerCase() === x.toLowerCase()));
    if (hit && !(selections[category] || []).includes(hit)) {
      selections[category] = [...(selections[category] || []), hit];
    }
  };

  // 1. Authoritative Blueprint primary style mapping
  if (blueprint.primaryStyle === 'Vietnamese V-Pop acoustic ballad' || blueprint.primaryStyle.includes('acoustic ballad') || blueprint.primaryStyle.includes('ballad')) {
    addFirstAvailable('genres', ['Acoustic', 'Pop']);
    addFirstAvailable('moods', ['Nostalgic', 'Melancholic', 'Heartfelt', 'Warm', 'Sad']);
    // Guarantee required instruments from Blueprint
    blueprint.instruments.required.forEach(inst => {
      addFirstAvailable('instruments', [inst]);
    });
    addFirstAvailable('instruments', ['Piano', 'Acoustic Guitar', 'String Section']);
    if (blueprint.vocals.gender === 'male' || profile.vocalGender === 'male') {
      addFirstAvailable('vocals', ['Male Vocal', 'Soulful Singing']);
    } else if (blueprint.vocals.gender === 'female' || profile.vocalGender === 'female') {
      addFirstAvailable('vocals', ['Female Vocal', 'Airy Vocal']);
    } else if (blueprint.vocals.presence === 'instrumental') {
      addFirstAvailable('structure', ['Instrumental']);
    }
    addFirstAvailable('v5Performance', ['Intimate', 'Expressive']);
    addFirstAvailable('production', ['Acoustic', 'Organic']);
  }
  else if (blueprint.primaryStyle === 'Nordic symphonic folk metal' && !profile.exclusions.excludeMetal) {
    addFirstAvailable('genres', ['Folk Metal', 'Symphonic Metal', 'Heavy Metal', 'Cinematic']);
    addFirstAvailable('moods', ['Epic', 'Dark', 'Aggressive', 'Energetic']);
    blueprint.instruments.required.forEach(inst => {
      addFirstAvailable('instruments', [inst]);
    });
    addFirstAvailable('instruments', ['Electric Guitar', 'Drum Kit', 'Choir', 'Timpani', 'Strings']);
    if (blueprint.vocals.presence === 'instrumental') {
      addFirstAvailable('structure', ['Instrumental']);
    } else if (blueprint.vocals.gender === 'female' || profile.vocalGender === 'female') {
      addFirstAvailable('vocals', ['Female Vocal', 'Choir']);
    } else {
      addFirstAvailable('vocals', ['Male Vocal', 'Choir']);
    }
    addFirstAvailable('v5Performance', ['Dynamic', 'Expressive']);
  }
  else if ((blueprint.primaryStyle === 'modern festival future bass EDM' || blueprint.primaryStyle.includes('EDM')) && !profile.exclusions.excludeEdm) {
    addFirstAvailable('genres', ['EDM', 'Dance Pop']);
    addFirstAvailable('moods', ['Energetic', 'Uplifting']);
    blueprint.instruments.required.forEach(inst => {
      addFirstAvailable('instruments', [inst]);
    });
    addFirstAvailable('instruments', ['Synthesizer', 'Drum Machine']);
    addFirstAvailable('production', ['[Bass Drop]']);
    if (blueprint.vocals.gender === 'female' || profile.vocalGender === 'female') {
      addFirstAvailable('vocals', ['Female Vocal']);
    }
  }
  else if ((blueprint.primaryStyle === 'Lo-Fi study piano' || blueprint.primaryStyle.includes('Lo-Fi')) && !profile.exclusions.excludeLofi) {
    addFirstAvailable('genres', ['Lo-Fi Hip Hop']);
    addFirstAvailable('moods', ['Chill', 'Relaxed', 'Nostalgic']);
    blueprint.instruments.required.forEach(inst => {
      addFirstAvailable('instruments', [inst]);
    });
    addFirstAvailable('instruments', ['Piano', 'Drum Machine']);
    addFirstAvailable('production', ['Lo-Fi', 'Vinyl Crackle']);
    if (blueprint.vocals.presence === 'instrumental') {
      addFirstAvailable('structure', ['Instrumental']);
    }
  }
  else if (blueprint.primaryStyle === 'cinematic orchestral battle score' || blueprint.primaryStyle.includes('orchestral') || blueprint.primaryStyle.includes('battle')) {
    addFirstAvailable('genres', ['Cinematic', 'Orchestral']);
    addFirstAvailable('moods', ['Epic', 'Dark', 'Energetic']);
    blueprint.instruments.required.forEach(inst => {
      addFirstAvailable('instruments', [inst]);
    });
    addFirstAvailable('instruments', ['Strings', 'Choir', 'Timpani']);
    addFirstAvailable('v5Performance', ['Dynamic', 'Expressive']);
    if (blueprint.vocals.presence === 'instrumental') {
      addFirstAvailable('structure', ['Instrumental']);
    }
  }

  addFirstAvailable('structure', ['Verse-Chorus', 'Intro-Verse-Chorus-Verse-Chorus-Bridge-Chorus-Outro']);
  const confidence = Math.max(0.72, blueprint.confidence);
  const cd = optimizePromptSim(input);
  const rawClean = sanitizeDirectorSelections(selections);
  const intent = derivePrimaryIntent(input, cd, rawClean, profile, blueprint);
  const { validatedSelections } = validateSelectionsWithIntent(rawClean, intent, profile, blueprint);
  const { selections: rawFinalSelections } = applyQualityEngine(validatedSelections, intent, profile);

  // Deterministic final vocal constraint enforcement pass
  const vocalAuth = determineVocalAuthority(input, blueprint, profile);
  const finalSelections = sanitizeSelectionsByVocalAuthority(rawFinalSelections, vocalAuth);
  const constrainedCd = sanitizeCreativeDirectionByVocalAuthority(cd, vocalAuth);

  const fallbackReason: 'overload' | 'unavailable' = isOverloaded ? 'overload' : 'unavailable';
  const rationale = isOverloaded
    ? `Gemini đang tạm thời quá tải, đã kích hoạt Local Fallback chuẩn Blueprint ("${blueprint.primaryStyle}").`
    : `Đang dùng Local Fallback chuẩn Blueprint ("${blueprint.primaryStyle}").`;

  const intentProfile = buildMusicIntentProfile(
    input,
    blueprint,
    finalSelections,
    'local',
    confidence,
    fallbackReason
  );

  return {
    creativeDirection: constrainedCd,
    selections: finalSelections,
    rationale,
    confidence,
    engine: 'local',
    primaryIntent: intent,
    blueprint,
    coherenceScore: Math.round(confidence * 100),
    fallbackReason,
    intentProfile
  };
};

export const runMusicDirectorAI = async (input: string): Promise<MusicDirectorResult> => {
  const blueprint = buildMusicBlueprint(input);
  const catalog = Object.fromEntries((Object.keys(allowedTags) as CategoryKey[]).map(k => [k, allowedTags[k]]));
  let isOverloaded = false;
  try {
    const res = await safeFetchGeminiApi<any>('/api/gemini/music-director', { input, catalog, blueprint });
    if (res.ok && res.data) {
      const parsed = res.data;
      const profile = buildUserIntentProfile(input);
      const creativeDirection = typeof parsed.creativeDirection === 'string' && parsed.creativeDirection.trim()
        ? parsed.creativeDirection.trim()
        : optimizePromptSim(input);
      const rawClean = sanitizeDirectorSelections(parsed.selections);
      // Clean exclusions for Gemini results to guarantee strict parity
      (Object.keys(rawClean) as CategoryKey[]).forEach(cat => {
        rawClean[cat] = (rawClean[cat] || []).filter(t => !isTagExcluded(cat, t, profile.exclusions) && !blueprint.exclusions.some(e => e.toLowerCase() === t.toLowerCase()));
      });
      const intent = derivePrimaryIntent(input, creativeDirection, rawClean, profile, blueprint);
      const { validatedSelections } = validateSelectionsWithIntent(rawClean, intent, profile, blueprint);
      const { selections: rawFinalSelections } = applyQualityEngine(validatedSelections, intent, profile);

      // Deterministic final vocal constraint enforcement pass
      const vocalAuth = determineVocalAuthority(input, blueprint, profile);
      const finalSelections = sanitizeSelectionsByVocalAuthority(rawFinalSelections, vocalAuth);
      const constrainedCd = sanitizeCreativeDirectionByVocalAuthority(creativeDirection, vocalAuth);

      const rationale = typeof parsed.rationale === 'string' ? parsed.rationale.trim() : `Đã phối hợp thẻ tối ưu theo Music Blueprint "${blueprint.primaryStyle}".`;
      const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.8)));
      const intentProfile = buildMusicIntentProfile(
        input,
        blueprint,
        finalSelections,
        'gemini',
        confidence
      );

      return {
        creativeDirection: constrainedCd,
        selections: finalSelections,
        rationale,
        confidence,
        engine: 'gemini',
        model: typeof parsed.model === 'string' ? parsed.model : undefined,
        primaryIntent: intent,
        blueprint,
        coherenceScore: Math.round(confidence * 100),
        intentProfile
      };
    }

    if (res.isOverloaded) {
      isOverloaded = true;
    }
  } catch (error) {
    console.warn('Gemini Music Director failed; using fallback:', error);
  }
  return musicDirectorFallback(input, isOverloaded, blueprint);
};
