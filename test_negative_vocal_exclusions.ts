import {
  extractExclusions,
  isTagExcluded,
  applyQualityEngine,
  buildUserIntentProfile,
  createEmptyExclusionProfile
} from './musicQualityEngine';
import { createEmptySelections, PrimaryIntent } from './semanticValidator';

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

console.log('=== RUNNING NEGATIVE VOCAL EXCLUSIONS REGRESSION SUITE ===\n');

// =========================================================================
// GROUP 1: Required Minimum Phrases in extractExclusions
// =========================================================================
console.log('--- Group 1: Required Minimum Exclusion Phrases ---');

{
  // 1.1 "no male lead vocals"
  const ex = extractExclusions('no male lead vocals');
  assert(
    ex.excludeMaleVocal === true && ex.excludeFemaleVocal === false && ex.excludeVocals === false,
    'Test 1.1: "no male lead vocals" sets excludeMaleVocal=true, female=false, vocals=false',
    `got male=${ex.excludeMaleVocal}, female=${ex.excludeFemaleVocal}, vocals=${ex.excludeVocals}`
  );
  assert(
    ex.rawExclusions.includes('Male Vocal'),
    'Test 1.1b: rawExclusions includes "Male Vocal"',
    `rawExclusions was ${JSON.stringify(ex.rawExclusions)}`
  );

  // 1.2 "without female singer"
  const ex2 = extractExclusions('without female singer');
  assert(
    ex2.excludeFemaleVocal === true && ex2.excludeMaleVocal === false && ex2.excludeVocals === false,
    'Test 1.2: "without female singer" sets excludeFemaleVocal=true, male=false, vocals=false',
    `got female=${ex2.excludeFemaleVocal}, male=${ex2.excludeMaleVocal}, vocals=${ex2.excludeVocals}`
  );
  assert(
    ex2.rawExclusions.includes('Female Vocal'),
    'Test 1.2b: rawExclusions includes "Female Vocal"',
    `rawExclusions was ${JSON.stringify(ex2.rawExclusions)}`
  );

  // 1.3 "no singing"
  const ex3 = extractExclusions('no singing');
  assert(
    ex3.excludeVocals === true && ex3.excludeFemaleVocal === false && ex3.excludeMaleVocal === false,
    'Test 1.3: "no singing" sets excludeVocals=true, female=false, male=false',
    `got vocals=${ex3.excludeVocals}, female=${ex3.excludeFemaleVocal}, male=${ex3.excludeMaleVocal}`
  );
  assert(
    ex3.rawExclusions.includes('Vocals'),
    'Test 1.3b: rawExclusions includes "Vocals"',
    `rawExclusions was ${JSON.stringify(ex3.rawExclusions)}`
  );

  // 1.4 "không giọng nữ chính"
  const ex4 = extractExclusions('không giọng nữ chính');
  assert(
    ex4.excludeFemaleVocal === true && ex4.excludeMaleVocal === false && ex4.excludeVocals === false,
    'Test 1.4: "không giọng nữ chính" sets excludeFemaleVocal=true, male=false, vocals=false',
    `got female=${ex4.excludeFemaleVocal}, male=${ex4.excludeMaleVocal}, vocals=${ex4.excludeVocals}`
  );
  assert(
    ex4.rawExclusions.includes('Female Vocal'),
    'Test 1.4b: rawExclusions includes "Female Vocal"',
    `rawExclusions was ${JSON.stringify(ex4.rawExclusions)}`
  );

  // 1.5 "không ca sĩ nam"
  const ex5 = extractExclusions('không ca sĩ nam');
  assert(
    ex5.excludeMaleVocal === true && ex5.excludeFemaleVocal === false && ex5.excludeVocals === false,
    'Test 1.5: "không ca sĩ nam" sets excludeMaleVocal=true, female=false, vocals=false',
    `got male=${ex5.excludeMaleVocal}, female=${ex5.excludeFemaleVocal}, vocals=${ex5.excludeVocals}`
  );
  assert(
    ex5.rawExclusions.includes('Male Vocal'),
    'Test 1.5b: rawExclusions includes "Male Vocal"',
    `rawExclusions was ${JSON.stringify(ex5.rawExclusions)}`
  );

  // 1.6 "không vocal nữ"
  const ex6 = extractExclusions('không vocal nữ');
  assert(
    ex6.excludeFemaleVocal === true && ex6.excludeMaleVocal === false && ex6.excludeVocals === false,
    'Test 1.6: "không vocal nữ" sets excludeFemaleVocal=true, male=false, vocals=false',
    `got female=${ex6.excludeFemaleVocal}, male=${ex6.excludeMaleVocal}, vocals=${ex6.excludeVocals}`
  );
  assert(
    ex6.rawExclusions.includes('Female Vocal'),
    'Test 1.6b: rawExclusions includes "Female Vocal"',
    `rawExclusions was ${JSON.stringify(ex6.rawExclusions)}`
  );
}

// =========================================================================
// GROUP 2: Accented & Unaccented Variants
// =========================================================================
console.log('\n--- Group 2: Accented & Unaccented Variants ---');

{
  // 2.1 "khong giong nu chinh" (unaccented)
  const ex1 = extractExclusions('khong giong nu chinh');
  assert(
    ex1.excludeFemaleVocal === true && ex1.excludeMaleVocal === false,
    'Test 2.1: "khong giong nu chinh" sets excludeFemaleVocal=true',
    `got female=${ex1.excludeFemaleVocal}, male=${ex1.excludeMaleVocal}`
  );

  // 2.2 "khong ca si nam" (unaccented)
  const ex2 = extractExclusions('khong ca si nam');
  assert(
    ex2.excludeMaleVocal === true && ex2.excludeFemaleVocal === false,
    'Test 2.2: "khong ca si nam" sets excludeMaleVocal=true',
    `got male=${ex2.excludeMaleVocal}, female=${ex2.excludeFemaleVocal}`
  );

  // 2.3 "khong vocal nu" (unaccented)
  const ex3 = extractExclusions('khong vocal nu');
  assert(
    ex3.excludeFemaleVocal === true && ex3.excludeMaleVocal === false && ex3.excludeVocals === false,
    'Test 2.3: "khong vocal nu" sets excludeFemaleVocal=true and does not fallback to generic excludeVocals',
    `got female=${ex3.excludeFemaleVocal}, male=${ex3.excludeMaleVocal}, vocals=${ex3.excludeVocals}`
  );

  // 2.4 "khong vocal nam" (unaccented)
  const ex4 = extractExclusions('khong vocal nam');
  assert(
    ex4.excludeMaleVocal === true && ex4.excludeFemaleVocal === false && ex4.excludeVocals === false,
    'Test 2.4: "khong vocal nam" sets excludeMaleVocal=true and does not fallback to generic excludeVocals',
    `got male=${ex4.excludeMaleVocal}, female=${ex4.excludeFemaleVocal}, vocals=${ex4.excludeVocals}`
  );

  // 2.5 "không vocal nam" (accented)
  const ex5 = extractExclusions('không vocal nam');
  assert(
    ex5.excludeMaleVocal === true && ex5.excludeFemaleVocal === false && ex5.excludeVocals === false,
    'Test 2.5: "không vocal nam" sets excludeMaleVocal=true',
    `got male=${ex5.excludeMaleVocal}, female=${ex5.excludeFemaleVocal}, vocals=${ex5.excludeVocals}`
  );

  // 2.6 "không ca sĩ nữ" (accented)
  const ex6 = extractExclusions('không ca sĩ nữ');
  assert(
    ex6.excludeFemaleVocal === true && ex6.excludeMaleVocal === false,
    'Test 2.6: "không ca sĩ nữ" sets excludeFemaleVocal=true',
    `got female=${ex6.excludeFemaleVocal}, male=${ex6.excludeMaleVocal}`
  );

  // 2.7 "khong ca si nu" (unaccented)
  const ex7 = extractExclusions('khong ca si nu');
  assert(
    ex7.excludeFemaleVocal === true && ex7.excludeMaleVocal === false,
    'Test 2.7: "khong ca si nu" sets excludeFemaleVocal=true',
    `got female=${ex7.excludeFemaleVocal}, male=${ex7.excludeMaleVocal}`
  );

  // 2.8 "không giọng nữ" (accented simple)
  const ex8 = extractExclusions('không giọng nữ');
  assert(
    ex8.excludeFemaleVocal === true && ex8.excludeMaleVocal === false,
    'Test 2.8: "không giọng nữ" sets excludeFemaleVocal=true',
    `got female=${ex8.excludeFemaleVocal}, male=${ex8.excludeMaleVocal}`
  );

  // 2.9 "khong giong nu" (unaccented simple)
  const ex9 = extractExclusions('khong giong nu');
  assert(
    ex9.excludeFemaleVocal === true && ex9.excludeMaleVocal === false,
    'Test 2.9: "khong giong nu" sets excludeFemaleVocal=true',
    `got female=${ex9.excludeFemaleVocal}, male=${ex9.excludeMaleVocal}`
  );

  // 2.10 "không giọng nam" (accented simple)
  const ex10 = extractExclusions('không giọng nam');
  assert(
    ex10.excludeMaleVocal === true && ex10.excludeFemaleVocal === false,
    'Test 2.10: "không giọng nam" sets excludeMaleVocal=true',
    `got male=${ex10.excludeMaleVocal}, female=${ex10.excludeFemaleVocal}`
  );

  // 2.11 "khong giong nam" (unaccented simple)
  const ex11 = extractExclusions('khong giong nam');
  assert(
    ex11.excludeMaleVocal === true && ex11.excludeFemaleVocal === false,
    'Test 2.11: "khong giong nam" sets excludeMaleVocal=true',
    `got male=${ex11.excludeMaleVocal}, female=${ex11.excludeFemaleVocal}`
  );
}

// =========================================================================
// GROUP 3: Plural & Singular Phrasing Variants
// =========================================================================
console.log('\n--- Group 3: Plural & Singular Phrasing Variants ---');

{
  // 3.1 Singular vs Plural: "no male lead vocal" vs "no male lead vocals"
  const exSingularMale = extractExclusions('no male lead vocal');
  const exPluralMale = extractExclusions('no male lead vocals');
  assert(
    exSingularMale.excludeMaleVocal === true && exPluralMale.excludeMaleVocal === true,
    'Test 3.1: Both "no male lead vocal" (singular) and "no male lead vocals" (plural) exclude male',
    `singular=${exSingularMale.excludeMaleVocal}, plural=${exPluralMale.excludeMaleVocal}`
  );

  // 3.2 Singular vs Plural: "without female singer" vs "without female singers"
  const exSingularFemaleSinger = extractExclusions('without female singer');
  const exPluralFemaleSinger = extractExclusions('without female singers');
  assert(
    exSingularFemaleSinger.excludeFemaleVocal === true && exPluralFemaleSinger.excludeFemaleVocal === true,
    'Test 3.2: Both "without female singer" (singular) and "without female singers" (plural) exclude female',
    `singular=${exSingularFemaleSinger.excludeFemaleVocal}, plural=${exPluralFemaleSinger.excludeFemaleVocal}`
  );

  // 3.3 Plural: "without female lead vocals"
  const exPluralFemaleVocals = extractExclusions('without female lead vocals');
  assert(
    exPluralFemaleVocals.excludeFemaleVocal === true && exPluralFemaleVocals.excludeVocals === false,
    'Test 3.3: "without female lead vocals" excludes female vocal, not generic vocals',
    `female=${exPluralFemaleVocals.excludeFemaleVocal}, vocals=${exPluralFemaleVocals.excludeVocals}`
  );

  // 3.4 Singular vs Plural: "without female voice" vs "without female voices"
  const exSingularFemaleVoice = extractExclusions('without female voice');
  const exPluralFemaleVoice = extractExclusions('without female voices');
  assert(
    exSingularFemaleVoice.excludeFemaleVocal === true && exPluralFemaleVoice.excludeFemaleVocal === true,
    'Test 3.4: Both "without female voice" and "without female voices" exclude female',
    `singular=${exSingularFemaleVoice.excludeFemaleVocal}, plural=${exPluralFemaleVoice.excludeFemaleVocal}`
  );

  // 3.5 Singular vs Plural: "no male singer" vs "no male singers"
  const exSingularMaleSinger = extractExclusions('no male singer');
  const exPluralMaleSinger = extractExclusions('no male singers');
  assert(
    exSingularMaleSinger.excludeMaleVocal === true && exPluralMaleSinger.excludeMaleVocal === true,
    'Test 3.5: Both "no male singer" and "no male singers" exclude male',
    `singular=${exSingularMaleSinger.excludeMaleVocal}, plural=${exPluralMaleSinger.excludeMaleVocal}`
  );

  // 3.6 Generic vocals: "no singing" vs "without singing" vs "no vocals"
  const exNoSing = extractExclusions('no singing');
  const exWithoutSing = extractExclusions('without singing');
  const exNoVocals = extractExclusions('no vocals');
  assert(
    exNoSing.excludeVocals === true && exWithoutSing.excludeVocals === true && exNoVocals.excludeVocals === true,
    'Test 3.6: "no singing", "without singing", and "no vocals" all set excludeVocals=true',
    `noSinging=${exNoSing.excludeVocals}, withoutSinging=${exWithoutSing.excludeVocals}, noVocals=${exNoVocals.excludeVocals}`
  );
}

// =========================================================================
// GROUP 4: Substring Collision Guard in isTagExcluded
// =========================================================================
console.log('\n--- Group 4: Substring Collision Guard in isTagExcluded ---');

{
  // 4.1 When excluding male vocal, Female Vocal must NOT be excluded
  const maleExclusions = extractExclusions('positive female lead, no male lead vocals');
  const femaleVocalIsExcluded = isTagExcluded('vocals', 'Female Vocal', maleExclusions);
  const femaleHarmonyIsExcluded = isTagExcluded('vocals', 'Female Harmony', maleExclusions);
  const maleVocalIsExcluded = isTagExcluded('vocals', 'Male Vocal', maleExclusions);
  const maleVocoderIsExcluded = isTagExcluded('vocals', 'Male Vocoder', maleExclusions);

  assert(
    femaleVocalIsExcluded === false,
    'Test 4.1a: Excluding male vocal does NOT exclude "Female Vocal"',
    `Expected false, got ${femaleVocalIsExcluded}`
  );
  assert(
    femaleHarmonyIsExcluded === false,
    'Test 4.1b: Excluding male vocal does NOT exclude "Female Harmony"',
    `Expected false, got ${femaleHarmonyIsExcluded}`
  );
  assert(
    maleVocalIsExcluded === true,
    'Test 4.1c: Excluding male vocal DOES exclude "Male Vocal"',
    `Expected true, got ${maleVocalIsExcluded}`
  );
  assert(
    maleVocoderIsExcluded === true,
    'Test 4.1d: Excluding male vocal DOES exclude "Male Vocoder"',
    `Expected true, got ${maleVocoderIsExcluded}`
  );

  // 4.2 When excluding female vocal, Male Vocal must NOT be excluded
  const femaleExclusions = extractExclusions('positive male lead, without female singer');
  const maleVocalIsExcluded2 = isTagExcluded('vocals', 'Male Vocal', femaleExclusions);
  const femaleVocalIsExcluded2 = isTagExcluded('vocals', 'Female Vocal', femaleExclusions);

  assert(
    maleVocalIsExcluded2 === false,
    'Test 4.2a: Excluding female singer does NOT exclude "Male Vocal"',
    `Expected false, got ${maleVocalIsExcluded2}`
  );
  assert(
    femaleVocalIsExcluded2 === true,
    'Test 4.2b: Excluding female singer DOES exclude "Female Vocal"',
    `Expected true, got ${femaleVocalIsExcluded2}`
  );

  // 4.3 Direct raw keyword guard verification: keyword "male" against tag "Female Vocal"
  const syntheticMaleEx = createEmptyExclusionProfile('test');
  syntheticMaleEx.excludedKeywords.push('male');
  syntheticMaleEx.excludeMaleVocal = true;

  const directMaleCollision = isTagExcluded('vocals', 'Female Vocal', syntheticMaleEx);
  assert(
    directMaleCollision === false,
    'Test 4.3: Raw keyword "male" collision guard protects "Female Vocal" from substring matching',
    `Expected false, got ${directMaleCollision}`
  );

  // 4.4 Direct raw keyword guard verification: keyword "female" against tag "Male Vocal"
  const syntheticFemaleEx = createEmptyExclusionProfile('test');
  syntheticFemaleEx.excludedKeywords.push('female');
  syntheticFemaleEx.excludeFemaleVocal = true;

  const directFemaleCollision = isTagExcluded('vocals', 'Male Vocal', syntheticFemaleEx);
  assert(
    directFemaleCollision === false,
    'Test 4.4: Raw keyword "female" does not match "Male Vocal"',
    `Expected false, got ${directFemaleCollision}`
  );
}

// =========================================================================
// GROUP 5: End-to-End applyQualityEngine Filtering
// =========================================================================
console.log('\n--- Group 5: End-to-End applyQualityEngine Filtering ---');

{
  const dummyIntent: PrimaryIntent = {
    profile: 'pop_contemporary',
    label: 'Contemporary Pop',
    descriptor: 'modern vocal pop',
    atmosphere: 'bright and polished',
    isAcoustic: false,
    isIntimate: false,
    isHeavy: false,
    isElectronic: false
  };

  // Helper to build initial dual-vocal selections
  const makeDualVocalSelections = () => ({
    ...createEmptySelections(),
    genres: ['Pop'],
    instruments: ['Piano'],
    vocals: ['Female Vocal', 'Male Vocal']
  });

  // 5.1 "no male lead vocals": Male Vocal removed, Female Vocal kept
  {
    const profile = buildUserIntentProfile('Acoustic piano, no male lead vocals');
    const { selections, removedTags } = applyQualityEngine(makeDualVocalSelections(), dummyIntent, profile);
    assert(
      selections.vocals.includes('Female Vocal') && !selections.vocals.includes('Male Vocal'),
      'Test 5.1: applyQualityEngine keeps Female Vocal and purges Male Vocal for "no male lead vocals"',
      `vocals=${JSON.stringify(selections.vocals)}`
    );
    assert(
      removedTags.some(r => r.tag === 'Male Vocal'),
      'Test 5.1b: removedTags explicitly records removal of "Male Vocal"',
      `removedTags=${JSON.stringify(removedTags)}`
    );
  }

  // 5.2 "without female singer": Female Vocal removed, Male Vocal kept
  {
    const profile = buildUserIntentProfile('Acoustic piano, without female singer');
    const { selections, removedTags } = applyQualityEngine(makeDualVocalSelections(), dummyIntent, profile);
    assert(
      selections.vocals.includes('Male Vocal') && !selections.vocals.includes('Female Vocal'),
      'Test 5.2: applyQualityEngine keeps Male Vocal and purges Female Vocal for "without female singer"',
      `vocals=${JSON.stringify(selections.vocals)}`
    );
    assert(
      removedTags.some(r => r.tag === 'Female Vocal'),
      'Test 5.2b: removedTags explicitly records removal of "Female Vocal"',
      `removedTags=${JSON.stringify(removedTags)}`
    );
  }

  // 5.3 "không giọng nữ chính": Female Vocal removed, Male Vocal kept
  {
    const profile = buildUserIntentProfile('Piano ballad, không giọng nữ chính');
    const { selections } = applyQualityEngine(makeDualVocalSelections(), dummyIntent, profile);
    assert(
      selections.vocals.includes('Male Vocal') && !selections.vocals.includes('Female Vocal'),
      'Test 5.3: applyQualityEngine keeps Male Vocal and purges Female Vocal for "không giọng nữ chính"',
      `vocals=${JSON.stringify(selections.vocals)}`
    );
  }

  // 5.4 "không ca sĩ nam": Male Vocal removed, Female Vocal kept
  {
    const profile = buildUserIntentProfile('Piano ballad, không ca sĩ nam');
    const { selections } = applyQualityEngine(makeDualVocalSelections(), dummyIntent, profile);
    assert(
      selections.vocals.includes('Female Vocal') && !selections.vocals.includes('Male Vocal'),
      'Test 5.4: applyQualityEngine keeps Female Vocal and purges Male Vocal for "không ca sĩ nam"',
      `vocals=${JSON.stringify(selections.vocals)}`
    );
  }

  // 5.5 "không vocal nữ": Female Vocal removed, Male Vocal kept (does not purge both)
  {
    const profile = buildUserIntentProfile('R&B track, không vocal nữ');
    const { selections } = applyQualityEngine(makeDualVocalSelections(), dummyIntent, profile);
    assert(
      selections.vocals.includes('Male Vocal') && !selections.vocals.includes('Female Vocal'),
      'Test 5.5: applyQualityEngine preserves Male Vocal for "không vocal nữ" (does not treat as generic instrumental)',
      `vocals=${JSON.stringify(selections.vocals)}`
    );
  }

  // 5.6 "no singing": All vocals purged, Instrumental added
  {
    const profile = buildUserIntentProfile('Ambient piano, no singing');
    const { selections } = applyQualityEngine(makeDualVocalSelections(), dummyIntent, profile);
    assert(
      selections.vocals.length === 0,
      'Test 5.6a: applyQualityEngine purges all vocals for "no singing"',
      `vocals=${JSON.stringify(selections.vocals)}`
    );
    assert(
      selections.structure.includes('Instrumental') || selections.production.includes('Instrumental'),
      'Test 5.6b: applyQualityEngine sets Instrumental in structure or production for "no singing"',
      `structure=${JSON.stringify(selections.structure)}, production=${JSON.stringify(selections.production)}`
    );
  }

  // 5.7 "khong giong nu chinh" (unaccented): Female Vocal removed, Male Vocal kept
  {
    const profile = buildUserIntentProfile('Piano ballad, khong giong nu chinh');
    const { selections } = applyQualityEngine(makeDualVocalSelections(), dummyIntent, profile);
    assert(
      selections.vocals.includes('Male Vocal') && !selections.vocals.includes('Female Vocal'),
      'Test 5.7: applyQualityEngine keeps Male Vocal and purges Female Vocal for unaccented "khong giong nu chinh"',
      `vocals=${JSON.stringify(selections.vocals)}`
    );
  }

  // 5.8 "khong ca si nam" (unaccented): Male Vocal removed, Female Vocal kept
  {
    const profile = buildUserIntentProfile('Piano ballad, khong ca si nam');
    const { selections } = applyQualityEngine(makeDualVocalSelections(), dummyIntent, profile);
    assert(
      selections.vocals.includes('Female Vocal') && !selections.vocals.includes('Male Vocal'),
      'Test 5.8: applyQualityEngine keeps Female Vocal and purges Male Vocal for unaccented "khong ca si nam"',
      `vocals=${JSON.stringify(selections.vocals)}`
    );
  }

  // 5.9 "khong vocal nu" (unaccented): Female Vocal removed, Male Vocal kept
  {
    const profile = buildUserIntentProfile('Pop ballad, khong vocal nu');
    const { selections } = applyQualityEngine(makeDualVocalSelections(), dummyIntent, profile);
    assert(
      selections.vocals.includes('Male Vocal') && !selections.vocals.includes('Female Vocal'),
      'Test 5.9: applyQualityEngine keeps Male Vocal and purges Female Vocal for unaccented "khong vocal nu"',
      `vocals=${JSON.stringify(selections.vocals)}`
    );
  }
}

// =========================================================================
// GROUP 6: Positive Controls (No Negative Phrasing -> Zero False Exclusions)
// =========================================================================
console.log('\n--- Group 6: Positive Controls (Proving Zero Regression) ---');

{
  // 6.1 Affirmative female vocal prompt: "tiệc EDM mùa hè trên bãi biển, nữ vocal trẻ, năng lượng cao"
  {
    const prompt = 'tiệc EDM mùa hè trên bãi biển, nữ vocal trẻ, năng lượng cao';
    const ex = extractExclusions(prompt);
    assert(
      ex.excludeFemaleVocal === false && ex.excludeMaleVocal === false && ex.excludeVocals === false,
      'Test 6.1a: Positive female prompt produces zero false vocal exclusions',
      `female=${ex.excludeFemaleVocal}, male=${ex.excludeMaleVocal}, vocals=${ex.excludeVocals}`
    );
    assert(
      !isTagExcluded('vocals', 'Female Vocal', ex),
      'Test 6.1b: "Female Vocal" is NOT excluded in affirmative female prompt',
      'Female Vocal was falsely excluded'
    );
  }

  // 6.2 Affirmative male vocal prompt: "người đàn ông trung niên, giọng nam ấm áp"
  {
    const prompt = 'người đàn ông trung niên, giọng nam ấm áp';
    const ex = extractExclusions(prompt);
    assert(
      ex.excludeFemaleVocal === false && ex.excludeMaleVocal === false && ex.excludeVocals === false,
      'Test 6.2a: Positive male prompt produces zero false vocal exclusions',
      `female=${ex.excludeFemaleVocal}, male=${ex.excludeMaleVocal}, vocals=${ex.excludeVocals}`
    );
    assert(
      !isTagExcluded('vocals', 'Male Vocal', ex),
      'Test 6.2b: "Male Vocal" is NOT excluded in affirmative male prompt',
      'Male Vocal was falsely excluded'
    );
  }

  // 6.3 "không khí lễ hội sôi động" (negative lookahead ensures 'không khí' is NOT treated as negation)
  {
    const prompt = 'không khí lễ hội sôi động, âm nhạc tưng bừng';
    const ex = extractExclusions(prompt);
    assert(
      ex.excludeVocals === false && ex.excludeFemaleVocal === false && ex.excludeMaleVocal === false,
      'Test 6.3a: "không khí" is not treated as a negation trigger',
      `rawExclusions=${JSON.stringify(ex.rawExclusions)}`
    );
    assert(
      ex.rawExclusions.length === 0,
      'Test 6.3b: "không khí lễ hội" produces empty rawExclusions',
      `got ${JSON.stringify(ex.rawExclusions)}`
    );
  }

  // 6.4 "không gian yên tĩnh lãng mạn" (negative lookahead ensures 'không gian' is NOT treated as negation)
  {
    const prompt = 'không gian yên tĩnh lãng mạn bên quán cà phê nhỏ';
    const ex = extractExclusions(prompt);
    assert(
      ex.excludeVocals === false && ex.rawExclusions.length === 0,
      'Test 6.4: "không gian" is not treated as a negation trigger',
      `rawExclusions=${JSON.stringify(ex.rawExclusions)}`
    );
  }

  // 6.5 "không chỉ là tình yêu" (negative lookahead ensures 'không chỉ' is NOT treated as negation)
  {
    const prompt = 'không chỉ là tình yêu mà còn là tri kỷ';
    const ex = extractExclusions(prompt);
    assert(
      ex.excludeVocals === false && ex.rawExclusions.length === 0,
      'Test 6.5: "không chỉ" is not treated as a negation trigger',
      `rawExclusions=${JSON.stringify(ex.rawExclusions)}`
    );
  }

  // 6.6 "khong khi soi dong" (unaccented lookahead check)
  {
    const prompt = 'khong khi soi dong ben bo bien';
    const ex = extractExclusions(prompt);
    assert(
      ex.excludeVocals === false && ex.rawExclusions.length === 0,
      'Test 6.6: unaccented "khong khi" is not treated as a negation trigger',
      `rawExclusions=${JSON.stringify(ex.rawExclusions)}`
    );
  }

  // 6.7 Official UPGRADE_2026_V4 Scenario 1: Viking Metal
  {
    const prompt = 'Nhạc metal Viking kể về cuộc chiến giữa rồng băng và thần sấm Bắc Âu';
    const ex = extractExclusions(prompt);
    assert(
      ex.excludeVocals === false && ex.excludeFemaleVocal === false && ex.excludeMaleVocal === false,
      'Test 6.7: Viking Metal prompt produces zero false exclusions',
      `rawExclusions=${JSON.stringify(ex.rawExclusions)}`
    );
  }
}

// =========================================================================
// SUMMARY REPORT
// =========================================================================
console.log('\n=== TEST SUMMARY ===');
const failedCount = results.filter(r => !r.passed).length;
const passedCount = results.filter(r => r.passed).length;
console.log(`Total: ${results.length}, Passed: ${passedCount}, Failed: ${failedCount}`);

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('ALL NEGATIVE VOCAL EXCLUSION TESTS PASSED DETERMINISTICALLY!');
}
