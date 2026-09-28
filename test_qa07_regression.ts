import { extractExclusions } from './musicQualityEngine';
import { determineVocalAuthority } from './vocalAuthority';
import {
  compileSunoPrompt,
  buildSunoPackage,
  formatFullSunoPackageText,
  buildSunoExportPack
} from './sunoPromptCompiler';
import { computeCanonicalAppState, CanonicalAppInputState } from './App';
import { createEmptySelections } from './semanticValidator';

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

console.log('=== RUNNING QA-07 FOCUSED REGRESSION TESTS ===\n');

// -------------------------------------------------------------------------
// TEST 1: positive female lead + no male lead vocals
// Expectation: female authority, excludeMaleVocal=true, excludeVocals=false
// -------------------------------------------------------------------------
{
  const prompt = 'positive female lead, no male lead vocals';
  const exclusions = extractExclusions(prompt);
  const vocalAuth = determineVocalAuthority(prompt);

  assert(
    exclusions.excludeMaleVocal === true,
    'Test 1.1: excludeMaleVocal flag',
    `Expected excludeMaleVocal=true, got ${exclusions.excludeMaleVocal}`
  );
  assert(
    exclusions.excludeVocals === false,
    'Test 1.2: excludeVocals flag',
    `Expected excludeVocals=false, got ${exclusions.excludeVocals}`
  );
  assert(
    exclusions.excludeFemaleVocal === false,
    'Test 1.3: excludeFemaleVocal flag',
    `Expected excludeFemaleVocal=false, got ${exclusions.excludeFemaleVocal}`
  );
  assert(
    vocalAuth.authority === 'female',
    'Test 1.4: vocal authority is female',
    `Expected authority='female', got '${vocalAuth.authority}'`
  );
  assert(
    vocalAuth.isInstrumental === false,
    'Test 1.5: not instrumental',
    `Expected isInstrumental=false, got ${vocalAuth.isInstrumental}`
  );
  assert(
    vocalAuth.allowFemale === true && vocalAuth.allowMale === false,
    'Test 1.6: allowFemale=true, allowMale=false',
    `Expected allowFemale=true, allowMale=false; got female=${vocalAuth.allowFemale}, male=${vocalAuth.allowMale}`
  );
}

// -------------------------------------------------------------------------
// TEST 1b (Natural Variants): "Female lead vocal, acoustic guitar, avoid male lead vocals"
// -------------------------------------------------------------------------
{
  const prompt = 'Female lead vocal, acoustic guitar, avoid male lead vocals';
  const exclusions = extractExclusions(prompt);
  const vocalAuth = determineVocalAuthority(prompt);

  assert(
    exclusions.excludeMaleVocal === true && exclusions.excludeVocals === false,
    'Test 1b: Natural variant "avoid male lead vocals"',
    `Expected excludeMaleVocal=true and excludeVocals=false, got male=${exclusions.excludeMaleVocal}, vocals=${exclusions.excludeVocals}`
  );
  assert(
    vocalAuth.authority === 'female',
    'Test 1b.2: Authority is female for natural variant',
    `Expected authority='female', got '${vocalAuth.authority}'`
  );
}

// -------------------------------------------------------------------------
// TEST 2: positive male lead + no female lead vocals
// Expectation: male authority, excludeFemaleVocal=true, excludeVocals=false
// -------------------------------------------------------------------------
{
  const prompt = 'positive male lead, no female lead vocals';
  const exclusions = extractExclusions(prompt);
  const vocalAuth = determineVocalAuthority(prompt);

  assert(
    exclusions.excludeFemaleVocal === true,
    'Test 2.1: excludeFemaleVocal flag',
    `Expected excludeFemaleVocal=true, got ${exclusions.excludeFemaleVocal}`
  );
  assert(
    exclusions.excludeVocals === false,
    'Test 2.2: excludeVocals flag',
    `Expected excludeVocals=false, got ${exclusions.excludeVocals}`
  );
  assert(
    exclusions.excludeMaleVocal === false,
    'Test 2.3: excludeMaleVocal flag',
    `Expected excludeMaleVocal=false, got ${exclusions.excludeMaleVocal}`
  );
  assert(
    vocalAuth.authority === 'male',
    'Test 2.4: vocal authority is male',
    `Expected authority='male', got '${vocalAuth.authority}'`
  );
  assert(
    vocalAuth.isInstrumental === false,
    'Test 2.5: not instrumental',
    `Expected isInstrumental=false, got ${vocalAuth.isInstrumental}`
  );
  assert(
    vocalAuth.allowMale === true && vocalAuth.allowFemale === false,
    'Test 2.6: allowMale=true, allowFemale=false',
    `Expected allowMale=true, allowFemale=false; got male=${vocalAuth.allowMale}, female=${vocalAuth.allowFemale}`
  );
}

// -------------------------------------------------------------------------
// TEST 2b (Natural Variants): "Male singer, guitar, without female lead vocal"
// -------------------------------------------------------------------------
{
  const prompt = 'Male singer, guitar, without female lead vocal';
  const exclusions = extractExclusions(prompt);
  const vocalAuth = determineVocalAuthority(prompt);

  assert(
    exclusions.excludeFemaleVocal === true && exclusions.excludeVocals === false,
    'Test 2b: Natural variant "without female lead vocal"',
    `Expected excludeFemaleVocal=true and excludeVocals=false, got female=${exclusions.excludeFemaleVocal}, vocals=${exclusions.excludeVocals}`
  );
  assert(
    vocalAuth.authority === 'male',
    'Test 2b.2: Authority is male for natural variant',
    `Expected authority='male', got '${vocalAuth.authority}'`
  );
}

// -------------------------------------------------------------------------
// TEST 3: no vocals (and true generic negatives "without vocals", "no singing")
// Expectation: instrumental authority
// -------------------------------------------------------------------------
{
  const prompt1 = 'ambient synth, no vocals';
  const ex1 = extractExclusions(prompt1);
  const auth1 = determineVocalAuthority(prompt1);

  assert(
    ex1.excludeVocals === true,
    'Test 3.1a: "no vocals" sets excludeVocals=true',
    `Expected excludeVocals=true, got ${ex1.excludeVocals}`
  );
  assert(
    auth1.authority === 'instrumental' && auth1.isInstrumental === true,
    'Test 3.1b: "no vocals" resolves to instrumental',
    `Expected authority='instrumental', got '${auth1.authority}'`
  );

  const prompt2 = 'electronic beat, without vocals';
  const auth2 = determineVocalAuthority(prompt2);
  assert(
    auth2.authority === 'instrumental' && auth2.isInstrumental === true,
    'Test 3.2: "without vocals" resolves to instrumental',
    `Expected authority='instrumental', got '${auth2.authority}'`
  );

  const prompt3 = 'lofi hip hop, no singing';
  const ex3 = extractExclusions(prompt3);
  const auth3 = determineVocalAuthority(prompt3);
  assert(
    ex3.excludeVocals === true,
    'Test 3.3a: "no singing" sets excludeVocals=true',
    `Expected excludeVocals=true, got ${ex3.excludeVocals}`
  );
  assert(
    auth3.authority === 'instrumental' && auth3.isInstrumental === true,
    'Test 3.3b: "no singing" resolves to instrumental',
    `Expected authority='instrumental', got '${auth3.authority}'`
  );
}

// -------------------------------------------------------------------------
// TEST 4: explicit instrumental
// Expectation: instrumental authority
// -------------------------------------------------------------------------
{
  const prompt1 = 'acoustic piano instrumental';
  const auth1 = determineVocalAuthority(prompt1);
  assert(
    auth1.authority === 'instrumental' && auth1.isInstrumental === true,
    'Test 4.1: "instrumental" in prompt resolves to instrumental',
    `Expected authority='instrumental', got '${auth1.authority}'`
  );

  const prompt2 = 'nhạc không lời piano acoustic';
  const auth2 = determineVocalAuthority(prompt2);
  assert(
    auth2.authority === 'instrumental' && auth2.isInstrumental === true,
    'Test 4.2: "nhạc không lời" resolves to instrumental',
    `Expected authority='instrumental', got '${auth2.authority}'`
  );
}

// -------------------------------------------------------------------------
// TEST 5: End-to-End Canonical App/Export Package Path for QA-07
// Input: "positive female lead, no male lead vocals", v6-mini,
// Instrumental OFF, Female Vocal selected.
// -------------------------------------------------------------------------
{
  const qa07Selections = {
    genres: ['Pop', 'Ballad'],
    production: ['Acoustic'],
    instruments: ['Piano'],
    moods: ['Emotional'],
    vocals: ['Nữ (Female Vocal)'],
    structure: [],
    effects: [],
    v5Advanced: [],
    mixingPresets: [],
    animeDrama: [],
    v5Performance: []
  };

  const rawInput = 'positive female lead, no male lead vocals';
  const compiled = compileSunoPrompt(rawInput, '', qa07Selections, 'v6-mini');
  const pkg = buildSunoPackage(compiled, 'local', 95, 80, 'v6-mini');
  const fullPackageText = formatFullSunoPackageText(pkg);
  const exportPackText = buildSunoExportPack(pkg.stylePrompt, '', {
    model: pkg.settings.model,
    weirdness: pkg.settings.weirdness,
    styleInfluence: pkg.settings.styleInfluence,
    durationMinutes: 3.5,
    exclude: pkg.exclude,
    note: compiled.settings.note
  });

  // 5.1: Vocal guide and VOCAL block
  assert(
    Boolean(pkg.vocalGuide && /female lead vocal/i.test(pkg.vocalGuide)),
    'Test 5.1: Package contains female lead vocal guidance',
    `Expected pkg.vocalGuide to include female lead vocal, got: "${pkg.vocalGuide}"`
  );

  assert(
    /VOCAL:\n[^\n]*female lead vocal/i.test(fullPackageText),
    'Test 5.2: Full package text contains non-empty VOCAL block with female lead',
    `Expected fullPackageText to have VOCAL section, got:\n${fullPackageText}`
  );

  // 5.2: Exclusions must include Male Lead Vocals, Duet, Choir, heavy distortion / aggressive rock
  const excludeLower = pkg.exclude.toLowerCase();
  assert(
    excludeLower.includes('male lead vocals') || excludeLower.includes('male vocal'),
    'Test 5.3: Excludes Male Lead Vocals / Male Vocal',
    `Expected exclude to contain male lead vocals, got: "${pkg.exclude}"`
  );
  assert(
    excludeLower.includes('duet') && excludeLower.includes('choir'),
    'Test 5.4: Excludes Duet and Choir',
    `Expected exclude to contain duet and choir, got: "${pkg.exclude}"`
  );
  assert(
    excludeLower.includes('heavy distortion') || excludeLower.includes('harsh distortion') || excludeLower.includes('aggressive rock'),
    'Test 5.5: Excludes heavy distortion / aggressive rock',
    `Expected exclude to contain heavy distortion/aggressive rock, got: "${pkg.exclude}"`
  );

  // 5.3: Exclusions MUST NOT exclude generic Vocals, Singing, Lead Vocal, or Lead Vocals
  const excludeTerms = pkg.exclude.split(',').map((t: string) => t.trim().toLowerCase());
  const prohibitedExclusions = ['vocals', 'singing', 'lead vocal', 'lead vocals'];
  const leakedGeneric = prohibitedExclusions.filter(term => excludeTerms.includes(term));
  assert(
    leakedGeneric.length === 0,
    'Test 5.6: Does NOT exclude generic Vocals, Singing, Lead Vocal, or Lead Vocals',
    `Prohibited exclusions found in exclude: ${leakedGeneric.join(', ')} (full exclude: "${pkg.exclude}")`
  );

  // 5.4: Style prompt contains NO positive "Instrumental composition" wording
  assert(
    !/instrumental composition/i.test(pkg.stylePrompt),
    'Test 5.7: Style prompt contains NO positive "Instrumental composition" wording',
    `Found "Instrumental composition" in stylePrompt: "${pkg.stylePrompt}"`
  );

  // 5.5: Canonical consistency across export formats
  assert(
    exportPackText.includes(pkg.stylePrompt) && exportPackText.includes(pkg.exclude),
    'Test 5.8: Export Pack consumes identical canonical style and exclude snapshot',
    'Export pack diverges from package snapshot'
  );

  // 5.6: UI Selections Authority: when prompt has no vocal directive, UI Female Vocal selection enforces female authority
  const uiOnlySelections = {
    ...qa07Selections,
    vocals: ['Nữ (Female Vocal)']
  };
  const uiCompiled = compileSunoPrompt('QA-07 Music Idea', '', uiOnlySelections, 'v6-mini');
  const uiPkg = buildSunoPackage(uiCompiled, 'local', 95, 80, 'v6-mini');
  assert(
    Boolean(uiPkg.vocalGuide && /female lead vocal/i.test(uiPkg.vocalGuide)),
    'Test 5.9: UI selection "Female Vocal" alone enforces female vocal authority and non-empty vocal guide',
    `Expected uiPkg.vocalGuide to have female lead vocal, got: "${uiPkg.vocalGuide}"`
  );
  assert(
    !/instrumental composition/i.test(uiPkg.stylePrompt),
    'Test 5.10: UI selection "Female Vocal" does not produce "Instrumental composition"',
    `Found "Instrumental composition" in uiPkg.stylePrompt: "${uiPkg.stylePrompt}"`
  );
}

// -------------------------------------------------------------------------
// TEST 6: Consecutive App State & Export Handler Path (Live React State Wiring)
// Asserts that consecutive inputs (Instrumental/default first, then QA-07 female)
// cannot reuse the previous instrumental package, and visible style + export pack
// are built atomically from the same canonical snapshot in the same render.
// -------------------------------------------------------------------------
{
  // 6.1 First run: Instrumental selection active (e.g. default / user had instrumental on)
  const input1: CanonicalAppInputState = {
    aiInput: 'expressive guitar theme',
    selections: {
      ...createEmptySelections(),
      structure: ['[Instrumental]']
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 80,
    lyricsOutput: ''
  };

  const state1 = computeCanonicalAppState(input1);

  assert(
    state1.sunoPackage.vocalGuide === '' && state1.sunoPackage.exclude.toLowerCase().includes('vocals'),
    'Test 6.1: First run with Instrumental produces an instrumental package (empty vocalGuide, excludes vocals)',
    `Expected empty vocalGuide and excluded vocals, got vocalGuide="${state1.sunoPackage.vocalGuide}", exclude="${state1.sunoPackage.exclude}"`
  );
  assert(
    state1.exportPayload.includes(state1.generatedPrompt),
    'Test 6.2: First run export payload includes its own visible stylePrompt',
    'First run export payload did not include stylePrompt'
  );

  // 6.2 Second run: Fresh reload/switch to QA-07 female (Instrumental OFF, Female Vocal ON, QA-07 prompt)
  const input2: CanonicalAppInputState = {
    aiInput: 'positive female lead, no male lead vocals',
    selections: {
      ...createEmptySelections(),
      vocals: ['Nữ (Female Vocal)']
    },
    sunoModelProfile: 'v6-mini',
    directorEngine: 'local',
    directorConfidence: 80,
    lyricsOutput: ''
  };

  const state2 = computeCanonicalAppState(input2);

  // Assert consecutive calls produce distinct package instances (no reuse of stale package)
  assert(
    state2.sunoPackage !== state1.sunoPackage,
    'Test 6.3: Second run produces fresh package instance (cannot reuse first package object)',
    'Expected state2.sunoPackage to be a distinct object from state1.sunoPackage'
  );

  assert(
    state2.exportPayload !== state1.exportPayload,
    'Test 6.4: Second run export payload is fresh (cannot reuse first export payload)',
    'Expected state2.exportPayload to differ from state1.exportPayload'
  );

  // Assert atomic synchronization in the same render
  assert(
    state2.generatedPrompt === state2.sunoPackage.stylePrompt,
    'Test 6.5: Visible Style and sunoPackage.stylePrompt are identical in same render',
    `Mismatch: generatedPrompt="${state2.generatedPrompt}" vs pkg.stylePrompt="${state2.sunoPackage.stylePrompt}"`
  );

  assert(
    state2.sunoSettings.exclude === state2.sunoPackage.exclude,
    'Test 6.6: sunoSettings.exclude and sunoPackage.exclude are identical in same render',
    `Mismatch: settings.exclude="${state2.sunoSettings.exclude}" vs pkg.exclude="${state2.sunoPackage.exclude}"`
  );

  // Assert second run does not retain instrumental attributes
  assert(
    state2.sunoPackage.vocalGuide !== '',
    'Test 6.7: Second run package is NOT instrumental (has non-empty vocalGuide)',
    `Expected non-empty vocalGuide, got "${state2.sunoPackage.vocalGuide}"`
  );

  assert(
    !/instrumental composition/i.test(state2.sunoPackage.stylePrompt),
    'Test 6.8: Second run style prompt contains NO positive "Instrumental composition"',
    `Found "Instrumental composition" in: "${state2.sunoPackage.stylePrompt}"`
  );

  assert(
    !/instrumental composition/i.test(state2.exportPayload),
    'Test 6.9: Second run export payload contains NO positive "Instrumental composition"',
    `Found "Instrumental composition" in export payload:\n${state2.exportPayload}`
  );

  // Assert female lead guidance and non-empty VOCAL block
  assert(
    Boolean(state2.sunoPackage.vocalGuide && /female lead vocal/i.test(state2.sunoPackage.vocalGuide)),
    'Test 6.10: Second run contains female lead vocal guidance in sunoPackage.vocalGuide',
    `Expected female lead vocal guide, got: "${state2.sunoPackage.vocalGuide}"`
  );

  assert(
    /VOCAL:\n[^\n]*female lead vocal/i.test(state2.fullPackageText),
    'Test 6.11: Second run fullPackageText contains non-empty VOCAL block',
    `Expected VOCAL block in fullPackageText, got:\n${state2.fullPackageText}`
  );

  // Assert exclusions: excludes male vocal/heavy distortion, does NOT exclude generic vocals
  const s2Exclude = state2.sunoPackage.exclude.toLowerCase();
  assert(
    s2Exclude.includes('male lead vocals') || s2Exclude.includes('male vocal'),
    'Test 6.12: Second run excludes Male Lead Vocals / Male Vocal',
    `Exclude was: "${state2.sunoPackage.exclude}"`
  );
  assert(
    s2Exclude.includes('duet') && s2Exclude.includes('choir'),
    'Test 6.13: Second run excludes Duet and Choir',
    `Exclude was: "${state2.sunoPackage.exclude}"`
  );
  assert(
    s2Exclude.includes('heavy distortion') || s2Exclude.includes('aggressive rock') || s2Exclude.includes('harsh distortion'),
    'Test 6.14: Second run excludes heavy distortion / aggressive rock',
    `Exclude was: "${state2.sunoPackage.exclude}"`
  );

  const s2ExcludeTerms = state2.sunoPackage.exclude.split(',').map((t: string) => t.trim().toLowerCase());
  const prohibited = ['vocals', 'singing', 'lead vocal', 'lead vocals'];
  const leakedInS2 = prohibited.filter(p => s2ExcludeTerms.includes(p));
  assert(
    leakedInS2.length === 0,
    'Test 6.15: Second run does NOT exclude generic Vocals, Singing, Lead Vocal, or Lead Vocals',
    `Prohibited exclusions found: ${leakedInS2.join(', ')} in "${state2.sunoPackage.exclude}"`
  );
}

console.log('\n=== TEST SUMMARY ===');
const failedCount = results.filter(r => !r.passed).length;
const passedCount = results.filter(r => r.passed).length;
console.log(`Total: ${results.length}, Passed: ${passedCount}, Failed: ${failedCount}`);

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('ALL QA-07 REGRESSION TESTS PASSED DETERMINISTICALLY!');
}
