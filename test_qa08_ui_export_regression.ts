import {
  computeCanonicalAppState,
  buildFullSunoExportPayload,
  CanonicalAppInputState
} from './App';
import { createEmptySelections } from './semanticValidator';
import { extractExclusions } from './musicQualityEngine';
import { determineVocalAuthority } from './vocalAuthority';

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

console.log('=== RUNNING QA-08: UI END-TO-END NEGATIVE VOCAL EXCLUSION & EXPORT SYNCHRONIZATION SUITE ===\n');

// =========================================================================
// CRITERION 1: "no male lead vocals" & "không ca sĩ nam"
// Exclude male variants, preserve Female Vocal, provide female guidance,
// keep visible style / package / settings / export mutually consistent.
// =========================================================================
console.log('--- Criterion 1: Negative Male Exclusions (English & Vietnamese) ---');

// 1.1 English variant: "no male lead vocals"
{
  const input: CanonicalAppInputState = {
    aiInput: 'electronic pop, energetic synth, no male lead vocals',
    selections: {
      ...createEmptySelections(),
      genres: ['Pop'],
      vocals: ['Nữ (Female Vocal)']
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 85,
    lyricsOutput: '[Verse 1]\nDancing in the starlight'
  };

  const state = computeCanonicalAppState(input);
  const excludeLower = state.sunoPackage.exclude.toLowerCase();
  const excludeTerms = state.sunoPackage.exclude.split(',').map(s => s.trim().toLowerCase());

  assert(
    excludeLower.includes('male lead vocals') || excludeLower.includes('male vocal'),
    'Test 1.1a: Excludes male lead vocals / male vocal in package',
    `Expected male exclusion, got: "${state.sunoPackage.exclude}"`
  );

  assert(
    !excludeLower.includes('female vocal') && !excludeLower.includes('female lead vocals'),
    'Test 1.1b: Preserves Female Vocal (does NOT exclude female)',
    `Female exclusion mistakenly present: "${state.sunoPackage.exclude}"`
  );

  const genericVocalTerms = ['vocals', 'singing', 'lead vocal', 'lead vocals'];
  const leakedGeneric = genericVocalTerms.filter(t => excludeTerms.includes(t));
  assert(
    leakedGeneric.length === 0,
    'Test 1.1c: Does NOT exclude generic Vocals/Singing',
    `Generic vocal exclusions leaked: ${leakedGeneric.join(', ')}`
  );

  assert(
    Boolean(state.sunoPackage.vocalGuide && /female lead vocal/i.test(state.sunoPackage.vocalGuide)),
    'Test 1.1d: sunoPackage.vocalGuide provides female lead vocal guidance',
    `Expected female lead vocal guide, got: "${state.sunoPackage.vocalGuide}"`
  );

  assert(
    !/instrumental composition/i.test(state.sunoPackage.stylePrompt),
    'Test 1.1e: Style prompt is vocal (no "Instrumental composition")',
    `Found "Instrumental composition" in: "${state.sunoPackage.stylePrompt}"`
  );

  assert(
    state.generatedPrompt === state.sunoPackage.stylePrompt,
    'Test 1.1f: Visible prompt matches sunoPackage.stylePrompt identically',
    `Mismatch: visible="${state.generatedPrompt}" vs pkg="${state.sunoPackage.stylePrompt}"`
  );

  assert(
    state.sunoSettings.exclude === state.sunoPackage.exclude,
    'Test 1.1g: sunoSettings.exclude matches sunoPackage.exclude identically',
    `Mismatch: settings="${state.sunoSettings.exclude}" vs pkg="${state.sunoPackage.exclude}"`
  );

  assert(
    state.exportPayload.includes(state.generatedPrompt) && state.exportPayload.includes(state.sunoSettings.exclude),
    'Test 1.1h: Export payload includes visible style prompt and settings exclude',
    'Export payload does not match visible prompt or settings exclude'
  );

  assert(
    /VOCAL:\n[^\n]*female lead vocal/i.test(state.fullPackageText),
    'Test 1.1i: fullPackageText contains VOCAL section with female lead guidance',
    `Expected VOCAL block in fullPackageText, got:\n${state.fullPackageText}`
  );
}

// 1.2 Vietnamese variant: "tiệc EDM mùa hè, không ca sĩ nam"
{
  const input: CanonicalAppInputState = {
    aiInput: 'tiệc EDM mùa hè trên bãi biển, không ca sĩ nam',
    selections: {
      ...createEmptySelections(),
      genres: ['Electronic / EDM'],
      vocals: ['Nữ (Female Vocal)']
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 80,
    lyricsOutput: 'Vũ điệu đêm hè'
  };

  const state = computeCanonicalAppState(input);
  const excludeLower = state.sunoPackage.exclude.toLowerCase();

  assert(
    excludeLower.includes('male vocal') || excludeLower.includes('ca sĩ nam'),
    'Test 1.2a: Vietnamese prompt excludes male vocal / ca sĩ nam',
    `Exclude was: "${state.sunoPackage.exclude}"`
  );

  assert(
    !excludeLower.includes('female vocal'),
    'Test 1.2b: Vietnamese prompt preserves Female Vocal',
    `Female vocal falsely excluded: "${state.sunoPackage.exclude}"`
  );

  assert(
    Boolean(state.sunoPackage.vocalGuide && /female lead vocal/i.test(state.sunoPackage.vocalGuide)),
    'Test 1.2c: Vietnamese prompt gives female vocal guidance',
    `vocalGuide was: "${state.sunoPackage.vocalGuide}"`
  );

  assert(
    state.generatedPrompt === state.sunoPackage.stylePrompt &&
    state.sunoSettings.exclude === state.sunoPackage.exclude &&
    state.exportPayload.includes(state.sunoSettings.exclude),
    'Test 1.2d: Vietnamese negative male prompt maintains atomic export consistency',
    'Atomic export consistency failure in Vietnamese male-exclusion run'
  );
}

// =========================================================================
// CRITERION 2: "without female singer" & "không giọng nữ chính"
// Exclude female variants, preserve Male Vocal, provide male guidance,
// ensure no negative phrase leaks into positive style.
// =========================================================================
console.log('\n--- Criterion 2: Negative Female Exclusions (English & Vietnamese) ---');

// 2.1 English variant: "without female singer"
{
  const input: CanonicalAppInputState = {
    aiInput: 'acoustic ballad, piano and cello, without female singer',
    selections: {
      ...createEmptySelections(),
      genres: ['Acoustic'],
      vocals: ['Nam (Male Vocal)']
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 85,
    lyricsOutput: 'Memories in the rain'
  };

  const state = computeCanonicalAppState(input);
  const excludeLower = state.sunoPackage.exclude.toLowerCase();
  const excludeTerms = state.sunoPackage.exclude.split(',').map(s => s.trim().toLowerCase());

  assert(
    excludeLower.includes('female vocal') || excludeLower.includes('female singer') || excludeLower.includes('female lead vocals'),
    'Test 2.1a: Excludes female vocal / female singer in package',
    `Expected female exclusion, got: "${state.sunoPackage.exclude}"`
  );

  const maleItems = excludeTerms.filter(t => t === 'male vocal' || t === 'male lead vocals' || t === 'male singer');
  assert(
    maleItems.length === 0,
    'Test 2.1b: Preserves Male Vocal (does NOT exclude male)',
    `Male exclusion mistakenly present: "${state.sunoPackage.exclude}"`
  );

  const genericVocalTerms = ['vocals', 'singing', 'lead vocal', 'lead vocals'];
  const leakedGeneric = genericVocalTerms.filter(t => excludeTerms.includes(t));
  assert(
    leakedGeneric.length === 0,
    'Test 2.1c: Does NOT exclude generic Vocals/Singing',
    `Generic vocal exclusions leaked: ${leakedGeneric.join(', ')}`
  );

  assert(
    Boolean(state.sunoPackage.vocalGuide && /male lead vocal/i.test(state.sunoPackage.vocalGuide)),
    'Test 2.1d: sunoPackage.vocalGuide provides male lead vocal guidance',
    `Expected male lead vocal guide, got: "${state.sunoPackage.vocalGuide}"`
  );

  // Check that negative phrase did not leak into positive style prompt
  assert(
    !/without female singer/i.test(state.sunoPackage.stylePrompt) &&
    !/no female/i.test(state.sunoPackage.stylePrompt),
    'Test 2.1e: Style prompt contains no negative phrase leaks ("without female singer")',
    `Negative directive leaked into stylePrompt: "${state.sunoPackage.stylePrompt}"`
  );

  assert(
    !/instrumental composition/i.test(state.sunoPackage.stylePrompt),
    'Test 2.1f: Style prompt is vocal (no "Instrumental composition")',
    `Found "Instrumental composition" in: "${state.sunoPackage.stylePrompt}"`
  );

  assert(
    state.generatedPrompt === state.sunoPackage.stylePrompt &&
    state.sunoSettings.exclude === state.sunoPackage.exclude &&
    state.exportPayload.includes(state.generatedPrompt) &&
    state.exportPayload.includes(state.sunoSettings.exclude),
    'Test 2.1g: Mutual consistency between visible prompt, package, settings, and exportPayload',
    'State synchronization mismatch in negative female exclusion'
  );

  assert(
    /VOCAL:\n[^\n]*male lead vocal/i.test(state.fullPackageText),
    'Test 2.1h: fullPackageText contains VOCAL section with male lead guidance',
    `Expected VOCAL block in fullPackageText, got:\n${state.fullPackageText}`
  );
}

// 2.2 Vietnamese variant: "người đàn ông nhớ vợ, không giọng nữ chính"
{
  const input: CanonicalAppInputState = {
    aiInput: 'người đàn ông trung niên nhớ người vợ đã xa trong đêm mưa Đà Lạt, không giọng nữ chính',
    selections: {
      ...createEmptySelections(),
      genres: ['Ballad'],
      vocals: ['Nam (Male Vocal)']
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 80,
    lyricsOutput: 'Đêm mưa Đà Lạt nhớ em'
  };

  const state = computeCanonicalAppState(input);
  const excludeLower = state.sunoPackage.exclude.toLowerCase();

  assert(
    excludeLower.includes('female vocal') || excludeLower.includes('giọng nữ') || excludeLower.includes('giong nu'),
    'Test 2.2a: Vietnamese prompt excludes female vocal / giọng nữ',
    `Exclude was: "${state.sunoPackage.exclude}"`
  );

  const viExcludeTerms = state.sunoPackage.exclude.split(',').map(s => s.trim().toLowerCase());
  const maleItems = viExcludeTerms.filter(t => t === 'male vocal' || t === 'male lead vocals' || t === 'ca sĩ nam' || t === 'giọng nam');
  assert(
    maleItems.length === 0,
    'Test 2.2b: Vietnamese prompt preserves Male Vocal',
    `Male vocal falsely excluded: "${state.sunoPackage.exclude}"`
  );

  assert(
    Boolean(state.sunoPackage.vocalGuide && /male lead vocal/i.test(state.sunoPackage.vocalGuide)),
    'Test 2.2c: Vietnamese prompt gives male vocal guidance',
    `vocalGuide was: "${state.sunoPackage.vocalGuide}"`
  );

  assert(
    !state.sunoPackage.stylePrompt.includes('không giọng nữ chính') &&
    !state.sunoPackage.stylePrompt.includes('không giọng nữ'),
    'Test 2.2d: Vietnamese negative phrase does not leak into positive style prompt',
    `Style prompt leaked negative directive: "${state.sunoPackage.stylePrompt}"`
  );

  assert(
    state.generatedPrompt === state.sunoPackage.stylePrompt &&
    state.sunoSettings.exclude === state.sunoPackage.exclude &&
    state.exportPayload.includes(state.sunoSettings.exclude),
    'Test 2.2e: Vietnamese negative female prompt maintains atomic export consistency',
    'Atomic export consistency failure in Vietnamese female-exclusion run'
  );
}

// =========================================================================
// CRITERION 3: "no singing" & "không có lời"
// Clear all vocal tags/guidance, enforce Instrumental, and synchronize
// full vocal exclusions across settings/package/export.
// =========================================================================
console.log('\n--- Criterion 3: Strict Instrumental / All-Vocals Excluded ---');

// 3.1 English variant: "no singing"
{
  const input: CanonicalAppInputState = {
    aiInput: 'ambient chillout meditation, smooth synth pads, no singing',
    selections: {
      ...createEmptySelections(),
      genres: ['Ambient'],
      vocals: ['Nữ (Female Vocal)'] // Residual checkbox must be overridden by negative directive
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 90,
    lyricsOutput: ''
  };

  const state = computeCanonicalAppState(input);
  const excludeLower = state.sunoPackage.exclude.toLowerCase();

  assert(
    state.sunoPackage.vocalGuide === '',
    'Test 3.1a: sunoPackage.vocalGuide is empty string for "no singing"',
    `Expected empty vocalGuide, got: "${state.sunoPackage.vocalGuide}"`
  );

  assert(
    /instrumental composition/i.test(state.sunoPackage.stylePrompt),
    'Test 3.1b: Style prompt enforces "Instrumental composition"',
    `Expected "Instrumental composition", got: "${state.sunoPackage.stylePrompt}"`
  );

  assert(
    excludeLower.includes('vocals') && excludeLower.includes('singing') && excludeLower.includes('lead vocal'),
    'Test 3.1c: Exclude lists comprehensive vocal exclusions (Vocals, Singing, Lead Vocal)',
    `Exclude was: "${state.sunoPackage.exclude}"`
  );

  assert(
    state.sunoSettings.exclude === state.sunoPackage.exclude,
    'Test 3.1d: sunoSettings.exclude and sunoPackage.exclude are identical',
    `Settings="${state.sunoSettings.exclude}" vs Package="${state.sunoPackage.exclude}"`
  );

  assert(
    state.exportPayload.includes(state.sunoSettings.exclude),
    'Test 3.1e: exportPayload incorporates the full vocal exclusions',
    'exportPayload missing full vocal exclusions'
  );

  assert(
    !/VOCAL:\n[^\n]+/i.test(state.fullPackageText) || /VOCAL:\n\s*$/m.test(state.fullPackageText),
    'Test 3.1f: fullPackageText does NOT contain active vocal guidance',
    `fullPackageText has unexpected vocal content:\n${state.fullPackageText}`
  );
}

// 3.2 Vietnamese variant: "nhạc nền thư giãn, không có lời"
{
  const input: CanonicalAppInputState = {
    aiInput: 'nhạc nền thư giãn không có lời, piano êm dịu',
    selections: {
      ...createEmptySelections(),
      genres: ['Lofi / Chill']
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 85,
    lyricsOutput: ''
  };

  const state = computeCanonicalAppState(input);
  const excludeLower = state.sunoPackage.exclude.toLowerCase();

  assert(
    state.sunoPackage.vocalGuide === '',
    'Test 3.2a: Vietnamese "không có lời" yields empty vocalGuide',
    `Expected empty vocalGuide, got: "${state.sunoPackage.vocalGuide}"`
  );

  assert(
    /instrumental composition/i.test(state.sunoPackage.stylePrompt),
    'Test 3.2b: Vietnamese "không có lời" style prompt enforces Instrumental composition',
    `Style prompt was: "${state.sunoPackage.stylePrompt}"`
  );

  assert(
    excludeLower.includes('vocals') && excludeLower.includes('singing'),
    'Test 3.2c: Vietnamese "không có lời" excludes Vocals and Singing',
    `Exclude was: "${state.sunoPackage.exclude}"`
  );

  assert(
    state.exportPayload.includes(state.sunoPackage.stylePrompt) &&
    state.exportPayload.includes(state.sunoSettings.exclude),
    'Test 3.2d: Vietnamese "không có lời" export payload contains style and settings snapshot',
    'Export payload does not match style prompt or exclude settings'
  );
}

// =========================================================================
// CRITERION 4: Consecutive Transitions
// male-excluded -> female-excluded -> all-vocals-excluded
// Must create fresh package/payload snapshots with zero stale carryover.
// =========================================================================
console.log('\n--- Criterion 4: Consecutive Transitions & Decoupled State Snapshots ---');
{
  // Step A: Male excluded
  const inputA: CanonicalAppInputState = {
    aiInput: 'dance pop, no male lead vocals',
    selections: {
      ...createEmptySelections(),
      genres: ['Pop'],
      vocals: ['Nữ (Female Vocal)']
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 80,
    lyricsOutput: 'Dancing through the night'
  };
  const stateA = computeCanonicalAppState(inputA);

  // Step B: Female excluded
  const inputB: CanonicalAppInputState = {
    aiInput: 'acoustic folk, without female singer',
    selections: {
      ...createEmptySelections(),
      genres: ['Folk'],
      vocals: ['Nam (Male Vocal)']
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 80,
    lyricsOutput: 'Walking the mountain road'
  };
  const stateB = computeCanonicalAppState(inputB);

  // Step C: All vocals excluded (instrumental)
  const inputC: CanonicalAppInputState = {
    aiInput: 'meditative ambient soundscape, no singing',
    selections: {
      ...createEmptySelections(),
      genres: ['Ambient']
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 80,
    lyricsOutput: ''
  };
  const stateC = computeCanonicalAppState(inputC);

  // 4.1 Instance decoupling: consecutive calls produce fresh object references
  assert(
    stateA.sunoPackage !== stateB.sunoPackage && stateB.sunoPackage !== stateC.sunoPackage,
    'Test 4.1: sunoPackage instances are completely decoupled across transitions',
    'Stale sunoPackage reference reused across consecutive state evaluations'
  );

  assert(
    stateA.exportPayload !== stateB.exportPayload && stateB.exportPayload !== stateC.exportPayload,
    'Test 4.2: exportPayload strings are completely fresh across transitions',
    'Stale exportPayload string reused across consecutive state evaluations'
  );

  // 4.2 Zero stale carryover from Step A into Step B
  const excludeBItems = stateB.sunoPackage.exclude.split(',').map(s => s.trim().toLowerCase());
  const staleMaleItems = excludeBItems.filter(t => t === 'male vocal' || t === 'male lead vocals' || t === 'male singer');
  assert(
    staleMaleItems.length === 0,
    'Test 4.3: Step B contains NO stale male vocal exclusions carried over from Step A',
    `Found stale male exclusion in Step B: "${stateB.sunoPackage.exclude}"`
  );

  assert(
    Boolean(stateB.sunoPackage.vocalGuide && /male lead vocal/i.test(stateB.sunoPackage.vocalGuide)),
    'Test 4.4: Step B has fresh male lead vocal guidance (not female from Step A)',
    `Step B vocalGuide was: "${stateB.sunoPackage.vocalGuide}"`
  );

  // 4.3 Zero stale carryover from Step B into Step C
  assert(
    stateC.sunoPackage.vocalGuide === '',
    'Test 4.5: Step C has empty vocalGuide (no male vocal guidance carried over from Step B)',
    `Step C vocalGuide was: "${stateC.sunoPackage.vocalGuide}"`
  );

  assert(
    /instrumental composition/i.test(stateC.sunoPackage.stylePrompt),
    'Test 4.6: Step C enforces Instrumental composition',
    `Step C stylePrompt was: "${stateC.sunoPackage.stylePrompt}"`
  );

  const excludeC = stateC.sunoPackage.exclude.toLowerCase();
  assert(
    excludeC.includes('vocals') && excludeC.includes('singing'),
    'Test 4.7: Step C excludes generic Vocals and Singing',
    `Step C exclude was: "${stateC.sunoPackage.exclude}"`
  );

  // 4.4 Internal atomic consistency across all 3 steps
  assert(
    stateA.generatedPrompt === stateA.sunoPackage.stylePrompt &&
    stateA.sunoSettings.exclude === stateA.sunoPackage.exclude &&
    stateB.generatedPrompt === stateB.sunoPackage.stylePrompt &&
    stateB.sunoSettings.exclude === stateB.sunoPackage.exclude &&
    stateC.generatedPrompt === stateC.sunoPackage.stylePrompt &&
    stateC.sunoSettings.exclude === stateC.sunoPackage.exclude,
    'Test 4.8: All three consecutive states maintain strict internal atomicity',
    'Atomicity mismatch in one or more transitional states'
  );
}

// =========================================================================
// CRITERION 5: Collision Invariance across UI & Export
// Negative male must NEVER exclude female in the exported package,
// and negative female must NEVER exclude male.
// =========================================================================
console.log('\n--- Criterion 5: Substring Collision Invariance across UI & Export ---');
{
  // 5.1 Male exclusion collision guard
  const maleExcludedInput: CanonicalAppInputState = {
    aiInput: 'synthwave drive, no male lead vocals',
    selections: {
      ...createEmptySelections(),
      vocals: ['Nữ (Female Vocal)']
    },
    sunoModelProfile: 'v6-mini'
  };
  const maleExcludedState = computeCanonicalAppState(maleExcludedInput);
  const mExclude = maleExcludedState.sunoPackage.exclude.toLowerCase();
  const mExport = maleExcludedState.exportPayload.toLowerCase();

  assert(
    !mExclude.includes('female vocal') && !mExclude.includes('female singer') && !mExclude.includes('female lead vocals'),
    'Test 5.1a: Male exclusion does NOT include "female vocal" in package exclude',
    `Female vocal falsely excluded in package: "${maleExcludedState.sunoPackage.exclude}"`
  );

  // In the EXCLUDE section of exportPayload, verify female is not excluded
  const mExcludeSection = (maleExcludedState.exportPayload.split('Exclude:')[1] || '').split('\n')[0].toLowerCase();
  assert(
    !mExcludeSection.includes('female'),
    'Test 5.1b: Male exclusion does NOT include "female" in export payload Exclude section',
    `Female leaked into export Exclude section: "${mExcludeSection}"`
  );

  // 5.2 Female exclusion collision guard
  const femaleExcludedInput: CanonicalAppInputState = {
    aiInput: 'hard rock anthem, without female singer',
    selections: {
      ...createEmptySelections(),
      vocals: ['Nam (Male Vocal)']
    },
    sunoModelProfile: 'v6-mini'
  };
  const femaleExcludedState = computeCanonicalAppState(femaleExcludedInput);
  const fExclude = femaleExcludedState.sunoPackage.exclude.toLowerCase();

  // "male vocal" should NOT be excluded
  // We need to be careful: "female vocal" contains the letters "male vocal",
  // so check with word boundary or split items
  const fExcludeItems = femaleExcludedState.sunoPackage.exclude.split(',').map(s => s.trim().toLowerCase());
  const maleItems = fExcludeItems.filter(item => item === 'male vocal' || item === 'male lead vocals' || item === 'male singer');
  assert(
    maleItems.length === 0,
    'Test 5.2a: Female exclusion does NOT include "Male Vocal" as an excluded item',
    `Male vocal falsely excluded in package: "${femaleExcludedState.sunoPackage.exclude}"`
  );

  const fExcludeSection = (femaleExcludedState.exportPayload.split('Exclude:')[1] || '').split('\n')[0];
  const fExcludeSectionItems = fExcludeSection.split(',').map(s => s.trim().toLowerCase());
  const maleSectionItems = fExcludeSectionItems.filter(item => item === 'male vocal' || item === 'male lead vocals' || item === 'male singer');
  assert(
    maleSectionItems.length === 0,
    'Test 5.2b: Female exclusion does NOT include "Male Vocal" in export payload Exclude section',
    `Male vocal falsely excluded in export Exclude section: "${fExcludeSection}"`
  );
}

// =========================================================================
// CRITERION 6: Positive Controls (Proving Zero Regression)
// Proving normal female vocal input remains vocal and is not made instrumental.
// =========================================================================
console.log('\n--- Criterion 6: Positive Control (Zero False Instrumentalization) ---');

// 6.1 English affirmative female input
{
  const input: CanonicalAppInputState = {
    aiInput: 'gentle acoustic pop, sweet female vocal, acoustic guitar',
    selections: {
      ...createEmptySelections(),
      genres: ['Pop'],
      instruments: ['Acoustic Guitar'],
      vocals: ['Nữ (Female Vocal)']
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 85,
    lyricsOutput: 'Sunny morning breeze'
  };

  const state = computeCanonicalAppState(input);
  const excludeLower = state.sunoPackage.exclude.toLowerCase();
  const excludeTerms = state.sunoPackage.exclude.split(',').map(s => s.trim().toLowerCase());

  assert(
    Boolean(state.sunoPackage.vocalGuide && /female lead vocal/i.test(state.sunoPackage.vocalGuide)),
    'Test 6.1a: Affirmative female input provides active female lead vocal guide',
    `vocalGuide was: "${state.sunoPackage.vocalGuide}"`
  );

  assert(
    !/instrumental composition/i.test(state.sunoPackage.stylePrompt),
    'Test 6.1b: Affirmative female input contains NO "Instrumental composition"',
    `Found "Instrumental composition" in: "${state.sunoPackage.stylePrompt}"`
  );

  const prohibitedGeneric = ['vocals', 'singing', 'lead vocal', 'lead vocals', 'female vocal'];
  const leakedProhibited = prohibitedGeneric.filter(t => excludeTerms.includes(t));
  assert(
    leakedProhibited.length === 0,
    'Test 6.1c: Affirmative female input does NOT exclude Vocals, Singing, or Female Vocal',
    `Prohibited exclusions present: ${leakedProhibited.join(', ')} in "${state.sunoPackage.exclude}"`
  );

  assert(
    state.exportPayload.includes(state.generatedPrompt) &&
    state.exportPayload.includes(state.sunoSettings.exclude),
    'Test 6.1d: Affirmative female input has consistent export payload',
    'Export payload inconsistent with affirmative female state'
  );
}

// 6.2 Vietnamese affirmative female input
{
  const input: CanonicalAppInputState = {
    aiInput: 'nhạc pop nhẹ nhàng, giọng nữ ngọt ngào, acoustic guitar',
    selections: {
      ...createEmptySelections(),
      genres: ['Pop'],
      instruments: ['Acoustic Guitar'],
      vocals: ['Nữ (Female Vocal)']
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 85,
    lyricsOutput: 'Nắng mai chan hòa'
  };

  const state = computeCanonicalAppState(input);
  const excludeLower = state.sunoPackage.exclude.toLowerCase();
  const excludeTerms = state.sunoPackage.exclude.split(',').map(s => s.trim().toLowerCase());

  assert(
    Boolean(state.sunoPackage.vocalGuide && /female lead vocal/i.test(state.sunoPackage.vocalGuide)),
    'Test 6.2a: Vietnamese affirmative female input provides active female lead vocal guide',
    `vocalGuide was: "${state.sunoPackage.vocalGuide}"`
  );

  assert(
    !/instrumental composition/i.test(state.sunoPackage.stylePrompt),
    'Test 6.2b: Vietnamese affirmative female input contains NO "Instrumental composition"',
    `Found "Instrumental composition" in: "${state.sunoPackage.stylePrompt}"`
  );

  const prohibitedGeneric = ['vocals', 'singing', 'lead vocal', 'lead vocals', 'female vocal'];
  const leakedProhibited = prohibitedGeneric.filter(t => excludeTerms.includes(t));
  assert(
    leakedProhibited.length === 0,
    'Test 6.2c: Vietnamese affirmative female input does NOT exclude Vocals, Singing, or Female Vocal',
    `Prohibited exclusions present: ${leakedProhibited.join(', ')} in "${state.sunoPackage.exclude}"`
  );

  assert(
    state.exportPayload.includes(state.generatedPrompt) &&
    state.exportPayload.includes(state.sunoSettings.exclude),
    'Test 6.2d: Vietnamese affirmative female input has consistent export payload',
    'Export payload inconsistent with Vietnamese affirmative female state'
  );
}

// =========================================================================
// SUMMARY
// =========================================================================
console.log('\n=== QA-08 TEST SUMMARY ===');
const failedCount = results.filter(r => !r.passed).length;
const passedCount = results.filter(r => r.passed).length;
console.log(`Total: ${results.length}, Passed: ${passedCount}, Failed: ${failedCount}`);

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('ALL QA-08 UI & EXPORT REGRESSION TESTS PASSED DETERMINISTICALLY!');
}
