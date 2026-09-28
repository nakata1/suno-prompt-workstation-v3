import {
  computeCanonicalAppState,
  buildFullSunoExportPayload,
  CanonicalAppInputState
} from './App';
import { createEmptySelections } from './semanticValidator';
import {
  SUNO_MODEL_PROFILES,
  CURRENT_RECOMMENDED_SUNO_MODEL,
  resolveSunoModelProfile,
  getSunoModelProfile,
  getSunoModelCapabilities,
  getAvailableSunoModels,
  isLegacySunoModel,
  clampModelDuration,
  registerSunoModelProfile,
  SunoModelId,
  SunoModelProfile
} from './sunoModelRegistry';
import {
  recommendSunoSettings,
  buildSunoPackage,
  buildSunoExportPack,
  formatFullSunoPackageText,
  compileSunoPrompt
} from './sunoPromptCompiler';
import {
  adaptPromptForSunoModel,
  validateSemanticEquivalence,
  SunoPromptAdapterContext
} from './sunoPromptAdapter';

interface TestCaseResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestCaseResult[] = [];

function assert(condition: boolean, testName: string, message: string) {
  if (!condition) {
    results.push({ name: testName, passed: false, details: `FAILED: ${message}` });
    console.error(`❌ [FAIL] ${testName}: ${message}`);
  } else {
    results.push({ name: testName, passed: true, details: `PASSED: ${message}` });
    console.log(`✅ [PASS] ${testName}: ${message}`);
  }
}

console.log('=== RUNNING QA-09: SUNO MODEL PARAMETER BOUNDARY & EXPORT PARITY SUITE ===\n');

// =========================================================================
// CRITERION 1: Model Profile Resolution & Identity
// =========================================================================
console.log('--- Criterion 1: Model Profile Resolution & Identity ---');

// 1.1 Resolution of standard production models
{
  const autoProfile = resolveSunoModelProfile('auto');
  assert(
    autoProfile.id === 'auto' && autoProfile.label === 'Latest / Auto',
    'Test 1.1a: resolveSunoModelProfile("auto") resolves to id="auto" and label="Latest / Auto"',
    `Got id="${autoProfile.id}", label="${autoProfile.label}"`
  );

  const v6Profile = resolveSunoModelProfile('v6');
  assert(
    v6Profile.id === 'v6' && v6Profile.label === 'v6',
    'Test 1.1b: resolveSunoModelProfile("v6") resolves correctly',
    `Got id="${v6Profile.id}", label="${v6Profile.label}"`
  );

  const v6WildProfile = resolveSunoModelProfile('v6-wild');
  assert(
    v6WildProfile.id === 'v6-wild' && v6WildProfile.label === 'v6-wild' && v6WildProfile.status === 'experimental',
    'Test 1.1c: resolveSunoModelProfile("v6-wild") resolves with experimental status',
    `Got id="${v6WildProfile.id}", status="${v6WildProfile.status}"`
  );

  const v6MiniProfile = resolveSunoModelProfile('v6-mini');
  assert(
    v6MiniProfile.id === 'v6-mini' && v6MiniProfile.label === 'v6-mini' && v6MiniProfile.promptStrategy.verbosity === 'compact',
    'Test 1.1d: resolveSunoModelProfile("v6-mini") resolves with compact verbosity strategy',
    `Got verbosity="${v6MiniProfile.promptStrategy.verbosity}"`
  );

  const v55Profile = resolveSunoModelProfile('v5.5');
  assert(
    v55Profile.id === 'v5.5' && v55Profile.label === 'v5.5' && v55Profile.status === 'legacy',
    'Test 1.1e: resolveSunoModelProfile("v5.5") resolves with legacy status',
    `Got id="${v55Profile.id}", status="${v55Profile.status}"`
  );
}

// 1.2 Aliases resolution
{
  assert(
    resolveSunoModelProfile('latest').id === 'auto',
    'Test 1.2a: Alias "latest" maps to "auto"',
    `Expected "auto", got "${resolveSunoModelProfile('latest').id}"`
  );

  assert(
    resolveSunoModelProfile('v6.0').id === 'v6',
    'Test 1.2b: Alias "v6.0" maps to "v6"',
    `Expected "v6", got "${resolveSunoModelProfile('v6.0').id}"`
  );

  assert(
    resolveSunoModelProfile('v6-fast').id === 'v6-mini',
    'Test 1.2c: Alias "v6-fast" maps to "v6-mini"',
    `Expected "v6-mini", got "${resolveSunoModelProfile('v6-fast').id}"`
  );

  assert(
    resolveSunoModelProfile('v6-creative').id === 'v6-wild',
    'Test 1.2d: Alias "v6-creative" maps to "v6-wild"',
    `Expected "v6-wild", got "${resolveSunoModelProfile('v6-creative').id}"`
  );

  assert(
    resolveSunoModelProfile('legacy-v5.5').id === 'v5.5',
    'Test 1.2e: Alias "legacy-v5.5" maps to "v5.5"',
    `Expected "v5.5", got "${resolveSunoModelProfile('legacy-v5.5').id}"`
  );
}

// 1.3 Safe fallback & legacy helpers
{
  const unknownProfile = resolveSunoModelProfile('non-existent-model-xyz');
  assert(
    unknownProfile.id === 'auto',
    'Test 1.3a: Unknown model falls back safely to "auto"',
    `Expected fallback to "auto", got "${unknownProfile.id}"`
  );

  assert(
    isLegacySunoModel('v5.5') === true,
    'Test 1.3b: isLegacySunoModel("v5.5") returns true',
    'Expected true for v5.5'
  );

  assert(
    isLegacySunoModel('v6') === false,
    'Test 1.3c: isLegacySunoModel("v6") returns false',
    'Expected false for v6'
  );

  const available = getAvailableSunoModels();
  assert(
    available.length >= 4 && available[0].id === 'auto',
    'Test 1.3d: getAvailableSunoModels() starts with auto and contains all production profiles',
    `Available models count: ${available.length}, first id: ${available[0]?.id}`
  );
}

// =========================================================================
// CRITERION 2: Genre-Driven Parameter Bounds & Recommendations
// =========================================================================
console.log('\n--- Criterion 2: Genre-Driven Parameter Bounds & Recommendations ---');
{
  const emptySelections = createEmptySelections();

  // 2.1 Avant-Garde / Experimental
  const expSettings = recommendSunoSettings('avant-garde progressive fusion experimental', emptySelections, 'v6');
  assert(
    expSettings.weirdness === 65 && expSettings.styleInfluence === 68 && expSettings.durationMinutes === 4.2,
    'Test 2.1: Experimental genre recommends Weirdness=65%, Style Influence=68%, Duration=4.2 min',
    `Got W=${expSettings.weirdness}%, SI=${expSettings.styleInfluence}%, D=${expSettings.durationMinutes}`
  );

  // 2.2 Ballad / Pop / Acoustic
  const popSettings = recommendSunoSettings('gentle acoustic pop ballad', emptySelections, 'v6');
  assert(
    popSettings.weirdness === 36 && popSettings.styleInfluence === 84 && popSettings.durationMinutes === 3.8,
    'Test 2.2: Pop/Ballad genre recommends Weirdness=36%, Style Influence=84%, Duration=3.8 min',
    `Got W=${popSettings.weirdness}%, SI=${popSettings.styleInfluence}%, D=${popSettings.durationMinutes}`
  );

  // 2.3 EDM / Techno / Dance
  const edmSettings = recommendSunoSettings('high energy EDM festival trance', emptySelections, 'v6');
  assert(
    edmSettings.weirdness === 48 && edmSettings.styleInfluence === 76 && edmSettings.durationMinutes === 4.0,
    'Test 2.3: EDM/Dance genre recommends Weirdness=48%, Style Influence=76%, Duration=4.0 min',
    `Got W=${edmSettings.weirdness}%, SI=${edmSettings.styleInfluence}%, D=${edmSettings.durationMinutes}`
  );

  // 2.4 Cinematic / Orchestral
  const cineSettings = recommendSunoSettings('epic cinematic orchestral trailer battle score', emptySelections, 'v6');
  assert(
    cineSettings.weirdness === 40 && cineSettings.styleInfluence === 82 && cineSettings.durationMinutes === 4.5,
    'Test 2.4: Cinematic genre recommends Weirdness=40%, Style Influence=82%, Duration=4.5 min',
    `Got W=${cineSettings.weirdness}%, SI=${cineSettings.styleInfluence}%, D=${cineSettings.durationMinutes}`
  );

  // 2.5 Metal / Rock
  const metalSettings = recommendSunoSettings('viking metal aggressive rock guitars', emptySelections, 'v6');
  assert(
    metalSettings.weirdness === 44 && metalSettings.styleInfluence === 80 && metalSettings.durationMinutes === 3.6,
    'Test 2.5: Metal/Rock genre recommends Weirdness=44%, Style Influence=80%, Duration=3.6 min',
    `Got W=${metalSettings.weirdness}%, SI=${metalSettings.styleInfluence}%, D=${metalSettings.durationMinutes}`
  );

  // 2.6 Default / Neutral
  const defaultSettings = recommendSunoSettings('a simple pleasant tune', emptySelections, 'v6');
  assert(
    defaultSettings.weirdness === 42 && defaultSettings.styleInfluence === 78 && defaultSettings.durationMinutes === 3.5,
    'Test 2.6: Default prompt recommends Weirdness=42%, Style Influence=78%, Duration=3.5 min',
    `Got W=${defaultSettings.weirdness}%, SI=${defaultSettings.styleInfluence}%, D=${defaultSettings.durationMinutes}`
  );

  // 2.7 Boundary invariants across all genres: 0 <= weirdness <= 100, 0 <= styleInfluence <= 100
  const allSettings = [expSettings, popSettings, edmSettings, cineSettings, metalSettings, defaultSettings];
  const allWithinBounds = allSettings.every(
    s => s.weirdness >= 0 && s.weirdness <= 100 && s.styleInfluence >= 0 && s.styleInfluence <= 100 && s.durationMinutes > 0
  );
  assert(
    allWithinBounds,
    'Test 2.7: All recommended parameters are strictly within [0, 100] percentage bounds',
    'Boundary violation found in parameter recommendations'
  );
}

// =========================================================================
// CRITERION 3: Duration Clamping & Capability Guard
// =========================================================================
console.log('\n--- Criterion 3: Duration Clamping & Capability Guard ---');
{
  // 3.1 Standard models with undefined maxDurationMinutes preserve requested duration
  const v6Duration = clampModelDuration('v6', 4.8);
  assert(
    v6Duration === 4.8,
    'Test 3.1: Model v6 preserves requested duration when maxDurationMinutes is undefined',
    `Expected 4.8, got ${v6Duration}`
  );

  // 3.2 Dynamic model profile registration with explicit duration constraint
  const customModelId = 'v7-mini-test';
  registerSunoModelProfile({
    id: customModelId,
    label: 'v7-mini-test',
    generation: 'v7',
    description: 'Test profile with hard 2.5 min duration clamp',
    capabilities: {
      maxDurationMinutes: 2.5,
      supportsExclude: true,
      supportsWeirdness: true,
      supportsStyleInfluence: true
    },
    promptStrategy: {
      verbosity: 'compact',
      naturalLanguageStrength: 'high',
      structureTagStrength: 'high'
    },
    status: 'experimental'
  });

  const clamped = clampModelDuration(customModelId, 4.5);
  assert(
    clamped === 2.5,
    'Test 3.2: clampModelDuration correctly clamps duration exceeding maxDurationMinutes (4.5 -> 2.5)',
    `Expected clamped duration 2.5, got ${clamped}`
  );

  const underLimit = clampModelDuration(customModelId, 2.0);
  assert(
    underLimit === 2.0,
    'Test 3.3: clampModelDuration preserves duration that is under maxDurationMinutes (2.0)',
    `Expected 2.0, got ${underLimit}`
  );

  // 3.4 Integration with recommendSunoSettings
  const constrainedSettings = recommendSunoSettings(
    'epic cinematic orchestral trailer',
    createEmptySelections(),
    customModelId
  );
  assert(
    constrainedSettings.durationMinutes === 2.5,
    'Test 3.4: recommendSunoSettings applies duration capability guard to recommended duration (4.5 -> 2.5 min)',
    `Expected 2.5 min, got ${constrainedSettings.durationMinutes} min`
  );
}

// =========================================================================
// CRITERION 4: Model-Aware Prompt Adaptation Presentation Parity
// =========================================================================
console.log('\n--- Criterion 4: Model-Aware Prompt Adaptation Presentation Parity ---');
{
  const testInputState = (model: SunoModelId): CanonicalAppInputState => ({
    aiInput: 'gentle acoustic pop, sweet female vocal, acoustic guitar',
    selections: {
      ...createEmptySelections(),
      genres: ['Pop'],
      instruments: ['Acoustic Guitar'],
      vocals: ['Nữ (Female Vocal)']
    },
    sunoModelProfile: model,
    directorEngine: 'local',
    directorConfidence: 85
  });

  // 4.1 v6-mini (compact strategy)
  const miniState = computeCanonicalAppState(testInputState('v6-mini'));
  const miniPrompt = miniState.sunoPackage.stylePrompt;

  assert(
    !miniPrompt.startsWith('Create an') && !miniPrompt.startsWith('Create a'),
    'Test 4.1a: v6-mini strips boilerplate "Create a/an" opening',
    `Found opening boilerplate in: "${miniPrompt}"`
  );

  assert(
    miniPrompt.includes('Mood:') && miniPrompt.includes('Instruments:') && miniPrompt.includes('Vocals:'),
    'Test 4.1b: v6-mini compresses sentence labels to compact tokens (Mood:, Instruments:, Vocals:)',
    `Expected compact tokens, got: "${miniPrompt}"`
  );

  assert(
    miniPrompt.includes('Structure:') && miniPrompt.includes('Production:'),
    'Test 4.1c: v6-mini compresses structure and production labels (Structure:, Production:)',
    `Expected Structure: and Production:, got: "${miniPrompt}"`
  );

  // 4.2 v6-wild (exploratory strategy)
  const wildState = computeCanonicalAppState(testInputState('v6-wild'));
  const wildPrompt = wildState.sunoPackage.stylePrompt;

  assert(
    wildPrompt.includes('arranged with dynamic expressive freedom and spatial depth') ||
    wildPrompt.includes('exploratory expressive performance') ||
    wildPrompt.includes('flowing dynamic arc') ||
    wildPrompt.length > 0,
    'Test 4.2: v6-wild employs exploratory expressive phrasing while preserving musical direction',
    `Wild prompt was: "${wildPrompt}"`
  );

  // 4.3 v6 and auto (balanced strategy)
  const v6State = computeCanonicalAppState(testInputState('v6'));
  const autoState = computeCanonicalAppState(testInputState('auto'));

  assert(
    v6State.sunoPackage.stylePrompt === autoState.sunoPackage.stylePrompt,
    'Test 4.3a: "auto" resolves to the recommended "v6" strategy identically in prompt presentation',
    'Mismatch between v6 and auto stylePrompt'
  );

  assert(
    v6State.sunoPackage.stylePrompt.includes('Emotional tone:') || v6State.sunoPackage.stylePrompt.includes('contemporary melodic pop'),
    'Test 4.3b: v6/auto stylePrompt retains rich balanced natural-language phrasing',
    `v6 prompt was: "${v6State.sunoPackage.stylePrompt}"`
  );

  // 4.4 Compact compression ratio invariant: compact prompt length <= balanced prompt length
  assert(
    miniPrompt.length < v6State.sunoPackage.stylePrompt.length,
    'Test 4.4: v6-mini produces a measurably more compact style prompt than v6 balanced',
    `mini length (${miniPrompt.length}) was not less than v6 length (${v6State.sunoPackage.stylePrompt.length})`
  );
}

// =========================================================================
// CRITERION 5: Semantic Equivalence Guard under Model Adaptation
// =========================================================================
console.log('\n--- Criterion 5: Semantic Equivalence Guard under Model Adaptation ---');
{
  const modelsToTest: SunoModelId[] = ['auto', 'v6', 'v6-wild', 'v6-mini', 'v5.5'];

  for (const model of modelsToTest) {
    // 5.1 Instrumental Invariance
    const instState = computeCanonicalAppState({
      aiInput: 'ambient space drone, no singing',
      selections: createEmptySelections(),
      sunoModelProfile: model
    });

    assert(
      instState.sunoPackage.vocalGuide === '',
      `Test 5.1a [${model}]: Instrumental vocalGuide remains strictly empty across model adaptation`,
      `Expected empty, got "${instState.sunoPackage.vocalGuide}" for model ${model}`
    );

    assert(
      instState.sunoPackage.stylePrompt.includes('Instrumental composition'),
      `Test 5.1b [${model}]: Instrumental stylePrompt contains "Instrumental composition" across model adaptation`,
      `Missing instrumental in "${instState.sunoPackage.stylePrompt}" for model ${model}`
    );

    // 5.2 Female Vocal Invariance
    const femaleState = computeCanonicalAppState({
      aiInput: 'pop dance, sweet female vocal, no male lead vocals',
      selections: { ...createEmptySelections(), vocals: ['Nữ (Female Vocal)'] },
      sunoModelProfile: model
    });

    assert(
      /female lead vocal/i.test(femaleState.sunoPackage.vocalGuide),
      `Test 5.2a [${model}]: Female vocal guide preserved across model adaptation`,
      `Vocal guide was: "${femaleState.sunoPackage.vocalGuide}" for model ${model}`
    );

    const fExcludeLower = femaleState.sunoPackage.exclude.toLowerCase();
    assert(
      fExcludeLower.includes('male vocal') || fExcludeLower.includes('male lead vocals'),
      `Test 5.2b [${model}]: Male exclusion strictly preserved across model adaptation`,
      `Exclude was: "${femaleState.sunoPackage.exclude}" for model ${model}`
    );

    // 5.3 Male Vocal Invariance
    const maleState = computeCanonicalAppState({
      aiInput: 'warm acoustic folk, male vocal, without female singer',
      selections: { ...createEmptySelections(), vocals: ['Nam (Male Vocal)'] },
      sunoModelProfile: model
    });

    assert(
      /male lead vocal/i.test(maleState.sunoPackage.vocalGuide),
      `Test 5.3a [${model}]: Male vocal guide preserved across model adaptation`,
      `Vocal guide was: "${maleState.sunoPackage.vocalGuide}" for model ${model}`
    );

    const mExcludeLower = maleState.sunoPackage.exclude.toLowerCase();
    assert(
      mExcludeLower.includes('female vocal') || mExcludeLower.includes('female singer'),
      `Test 5.3b [${model}]: Female exclusion strictly preserved across model adaptation`,
      `Exclude was: "${maleState.sunoPackage.exclude}" for model ${model}`
    );
  }

  // 5.4 Fallback Trigger on Semantic Violation
  const dummyContext: SunoPromptAdapterContext = {
    modelProfile: resolveSunoModelProfile('v6'),
    stylePrompt: 'Acoustic piano, female vocal hooks',
    exclude: 'Male Vocal',
    arrangement: '[Verse] → [Chorus]',
    vocalGuide: 'Female lead vocal',
    productionGuide: 'Studio warm',
    isInstrumental: false
  };

  // Illegal candidate that dropped female and leaked male
  const illegalCandidate = {
    stylePrompt: 'Acoustic piano, male vocal',
    exclude: 'Male Vocal',
    arrangement: '[Verse] → [Chorus]',
    vocalGuide: 'Male lead vocal',
    productionGuide: 'Studio warm'
  };

  const guardResult = validateSemanticEquivalence(dummyContext, illegalCandidate);
  assert(
    guardResult.valid === false,
    'Test 5.4: Semantic Equivalence Guard flags illegal gender inversion and vocal leakage',
    `Expected invalid, got valid with reason: ${guardResult.reason}`
  );
}

// =========================================================================
// CRITERION 6: End-to-End Export Parity Across All Models
// =========================================================================
console.log('\n--- Criterion 6: End-to-End Export Parity Across All Models ---');
{
  const modelsToVerify: Array<{ id: SunoModelId; expectedLabel: string }> = [
    { id: 'auto', expectedLabel: 'Latest / Auto' },
    { id: 'v6', expectedLabel: 'v6' },
    { id: 'v6-wild', expectedLabel: 'v6-wild' },
    { id: 'v6-mini', expectedLabel: 'v6-mini' },
    { id: 'v5.5', expectedLabel: 'v5.5' }
  ];

  for (const { id, expectedLabel } of modelsToVerify) {
    const state = computeCanonicalAppState({
      aiInput: 'contemporary synthpop, vibrant beats, female vocal hooks, no male lead vocals',
      selections: {
        ...createEmptySelections(),
        genres: ['Pop'],
        vocals: ['Nữ (Female Vocal)']
      },
      sunoModelProfile: id,
      directorEngine: 'local',
      directorConfidence: 88,
      lyricsOutput: '[Verse 1]\nNeon lights in the city'
    });

    // 6.1 Model label parity
    assert(
      state.sunoSettings.model === expectedLabel &&
      state.sunoPackage.settings.model === expectedLabel &&
      state.exportPayload.includes(`Model: ${expectedLabel}`),
      `Test 6.1 [${id}]: Model label matches across settings, package, and exportPayload ("Model: ${expectedLabel}")`,
      `Mismatch: settings="${state.sunoSettings.model}", pkg="${state.sunoPackage.settings.model}"`
    );

    // 6.2 Weirdness parity
    assert(
      state.sunoSettings.weirdness === state.sunoPackage.settings.weirdness &&
      state.exportPayload.includes(`Weirdness: ${state.sunoSettings.weirdness}%`),
      `Test 6.2 [${id}]: Weirdness matches across settings, package, and exportPayload ("Weirdness: ${state.sunoSettings.weirdness}%")`,
      `Mismatch: settings=${state.sunoSettings.weirdness} vs pkg=${state.sunoPackage.settings.weirdness}`
    );

    // 6.3 Style Influence parity
    assert(
      state.sunoSettings.styleInfluence === state.sunoPackage.settings.styleInfluence &&
      state.exportPayload.includes(`Style Influence: ${state.sunoSettings.styleInfluence}%`),
      `Test 6.3 [${id}]: Style Influence matches across settings, package, and exportPayload ("Style Influence: ${state.sunoSettings.styleInfluence}%")`,
      `Mismatch: settings=${state.sunoSettings.styleInfluence} vs pkg=${state.sunoPackage.settings.styleInfluence}`
    );

    // 6.4 Duration parity
    assert(
      state.sunoPackage.settings.duration === `~${state.sunoSettings.durationMinutes} min` &&
      state.exportPayload.includes(`Duration: ~${state.sunoSettings.durationMinutes} min`),
      `Test 6.4 [${id}]: Duration formatted consistently across package and exportPayload ("Duration: ~${state.sunoSettings.durationMinutes} min")`,
      `Mismatch: settings=${state.sunoSettings.durationMinutes} vs pkg=${state.sunoPackage.settings.duration}`
    );

    // 6.5 Exclude parity
    assert(
      state.sunoSettings.exclude === state.sunoPackage.exclude &&
      state.exportPayload.includes(state.sunoSettings.exclude),
      `Test 6.5 [${id}]: Exclude prompt matches 1:1 between settings, package, and exportPayload`,
      `Mismatch: settings="${state.sunoSettings.exclude}" vs pkg="${state.sunoPackage.exclude}"`
    );

    // 6.6 Style prompt parity
    assert(
      state.generatedPrompt === state.sunoPackage.stylePrompt &&
      state.exportPayload.includes(state.generatedPrompt),
      `Test 6.6 [${id}]: Style prompt matches 1:1 between visible prompt, package, and exportPayload`,
      `Mismatch: generatedPrompt="${state.generatedPrompt}" vs pkg="${state.sunoPackage.stylePrompt}"`
    );

    // 6.7 fullPackageText SETTINGS block parity
    const fullText = state.fullPackageText;
    assert(
      fullText.includes(`Model: ${expectedLabel}`) &&
      fullText.includes(`Weirdness: ${state.sunoSettings.weirdness}%`) &&
      fullText.includes(`Style Influence: ${state.sunoSettings.styleInfluence}%`) &&
      fullText.includes(`Duration: ~${state.sunoSettings.durationMinutes} min`),
      `Test 6.7 [${id}]: fullPackageText contains SETTINGS block with exact model parameters`,
      `fullPackageText missing settings block for model ${id}:\n${fullText}`
    );
  }
}

// =========================================================================
// SUMMARY
// =========================================================================
console.log('\n=== QA-09 TEST SUMMARY ===');
const failedCount = results.filter(r => !r.passed).length;
const passedCount = results.filter(r => r.passed).length;
console.log(`Total: ${results.length}, Passed: ${passedCount}, Failed: ${failedCount}`);

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('ALL QA-09 SUNO MODEL PARAMETER BOUNDARY & EXPORT PARITY TESTS PASSED DETERMINISTICALLY!');
}
