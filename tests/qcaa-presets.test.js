// Guards the QCAA preset dataset. These timings decide how long students actually
// get, so the shape and provenance of every entry is checked, and a few values are
// pinned against the syllabuses they were read from.
const assert = require('node:assert/strict');

const { QCAA_PRESETS, QCAA_SUBJECTS, QCAA_EA_DIRECTIONS } = require('../presets.js');
const { normalizeExam, validateExam, createExamTimeline } = require('../timer-core.js');

// --- shape and provenance -------------------------------------------------
assert.ok(QCAA_SUBJECTS.length >= 40, 'the full General subject list should be present');
assert.ok(QCAA_PRESETS.length >= 100, 'every timed instrument should produce a preset');

const ids = QCAA_PRESETS.map(preset => preset.id);
assert.equal(ids.length, new Set(ids).size, 'preset ids must be unique');

for (const preset of QCAA_PRESETS) {
  const where = preset.id;
  assert.ok(preset.subject, `${where}: needs a subject`);
  assert.ok(preset.label, `${where}: needs an instrument label`);
  assert.match(preset.type, /^(IA|EA|FIA)$/, `${where}: type must be IA, EA or FIA`);

  // A missing or zero working time would silently produce a 0-minute exam.
  assert.ok(Number.isInteger(preset.working) && preset.working > 0, `${where}: working time must be a positive whole number of minutes`);
  assert.ok(Number.isInteger(preset.perusal) && preset.perusal >= 0, `${where}: perusal/planning must be a whole number of minutes`);
  assert.ok(preset.working <= 240 && preset.perusal <= 60, `${where}: times should be within a plausible range`);

  // Provenance: every timing must name the syllabus version it came from.
  assert.match(preset.source, /20\d\d v[\d.]+ \(\w+ 20\d\d\)$/, `${where}: source must carry a syllabus version`);
  assert.match(preset.sourceUrl, /^https:\/\/www\.qcaa\.qld\.edu\.au\/.*_syll\.pdf$/, `${where}: sourceUrl must point at a QCAA syllabus PDF`);

  // Every preset must survive the app's own validation and produce a sane timeline.
  assert.equal(validateExam(normalizeExam(preset)), true, `${where}: should pass the app's exam validation`);
}

// --- labels and ids are clean --------------------------------------------
// The instrument names are read out of the syllabus PDFs, where a heading can run
// into the page footer. That leaked strings like "IA1 Page 45 of 59 C onditions"
// into a label and its preset id, so both are checked for that debris.
const DEBRIS = /page \d+|\d+ of \d+|onditi|conditio/i;
for (const preset of QCAA_PRESETS) {
  assert.ok(!DEBRIS.test(preset.label), `${preset.id}: label carries page-footer text ("${preset.label}")`);
  assert.ok(!DEBRIS.test(preset.name), `${preset.id}: name carries page-footer text ("${preset.name}")`);
  assert.ok(!DEBRIS.test(preset.id), `preset id carries page-footer text ("${preset.id}")`);
  // A label is an instrument, not a sentence: short, and no stray digits beyond IA1-3.
  assert.ok(preset.label.length <= 40, `${preset.id}: label is too long to be an instrument name`);
}

// A few known-good shapes, so a future re-extraction cannot quietly rewrite them.
const labelOf = id => QCAA_PRESETS.find(p => p.id === id)?.label;
assert.equal(labelOf('qcaa-chemistry-ia1'), 'IA1 Data test', 'Chemistry IA1 is the data test');
assert.equal(labelOf('qcaa-french-ea'), 'EA', 'French has a single external examination');
assert.equal(labelOf('qcaa-german-ea'), 'EA', 'German has a single external examination');
assert.equal(labelOf('qcaa-music-extension-performance-ea'), 'EA', 'Music Extension Performance likewise');

// --- the QCAA external assessment leaving rule ----------------------------
for (const preset of QCAA_PRESETS.filter(p => p.type === 'EA')) {
  assert.equal(preset.leavingPolicy, 'qcaa-ea-2025', `${preset.id}: EA must use the QCAA leaving policy`);
  assert.equal(preset.leaveAfterStart, QCAA_EA_DIRECTIONS.firstMinutesFromScheduledStart, `${preset.id}: EA leaving offset`);
  assert.equal(preset.noLeaveBeforeEnd, QCAA_EA_DIRECTIONS.finalMinutes, `${preset.id}: EA final restricted period`);
}
for (const preset of QCAA_PRESETS.filter(p => p.type !== 'EA')) {
  assert.equal(preset.leavingPolicy, 'teacher', `${preset.id}: internal assessment leaving is teacher-defined`);
  assert.equal(preset.leaveAfterStart, null, `${preset.id}: internal leaving window must be left blank`);
}

// --- Units 1-2 (FIA) ------------------------------------------------------
// QCAA prescribes no Units 1-2 timings, so each FIA mirrors that subject own
// summative instrument and must say so rather than citing the syllabus for a time
// the syllabus does not give.
const fiaPresets = QCAA_PRESETS.filter(p => p.type === 'FIA');
assert.equal(fiaPresets.length, QCAA_SUBJECTS.length, 'every subject gets exactly one FIA');

for (const fia of fiaPresets) {
  assert.match(fia.source, /^Units 1–2 school-developed · timing mirrors /, `${fia.id}: FIA must be marked school-developed`);
  assert.match(fia.label, /^FIA \(mirrors /, `${fia.id}: FIA label names what it mirrors`);

  const subject = QCAA_SUBJECTS.find(item => item.subject === fia.subject);
  const mirrored = subject.instruments.find(item => item.label === subject.instruments.find(i => i.key === 'fia').mirrors);
  assert.ok(mirrored, `${fia.id}: the mirrored instrument should exist on the subject`);
  assert.equal(fia.perusal, mirrored.perusal, `${fia.id}: perusal matches the mirrored instrument`);
  assert.equal(fia.working, mirrored.working, `${fia.id}: working time matches the mirrored instrument`);
}

// Where a subject has a timed internal assessment, that is what the FIA mirrors.
const bioFia = QCAA_PRESETS.find(p => p.id === 'qcaa-biology-fia');
assert.deepEqual([bioFia.perusal, bioFia.working], [5, 60], 'Biology FIA mirrors the IA1 data test');
assert.match(bioFia.label, /IA1 Data test/, 'Biology FIA names the data test');

const englishFia = QCAA_PRESETS.find(p => p.id === 'qcaa-english-fia');
assert.deepEqual([englishFia.perusal, englishFia.working], [15, 120], 'English FIA mirrors its IA3 examination');

// --- values pinned to the syllabuses they were read from ------------------
const find = id => {
  const preset = QCAA_PRESETS.find(p => p.id === id);
  assert.ok(preset, `expected preset ${id} to exist`);
  return preset;
};
const timing = id => [find(id).perusal, find(id).working];

// Mathematics: unchanged from the original hand-sourced presets, so these double as
// a regression check on the whole extraction pipeline.
assert.deepEqual(timing('qcaa-general-mathematics-ea-p1'), [5, 90], 'General Mathematics EA Paper 1');
assert.deepEqual(timing('qcaa-general-mathematics-ea-p2'), [5, 90], 'General Mathematics EA Paper 2');
assert.deepEqual(timing('qcaa-general-mathematics-ia2'), [5, 90], 'General Mathematics IA2');
assert.deepEqual(timing('qcaa-mathematical-methods-ea-p1'), [5, 90], 'Mathematical Methods EA Paper 1');
assert.deepEqual(timing('qcaa-specialist-mathematics-ea-p1'), [5, 90], 'Specialist Mathematics EA Paper 1');

// Sciences: the timed internal is IA1 (a 60-minute data test), not IA2/IA3.
assert.deepEqual(timing('qcaa-biology-ia1'), [5, 60], 'Biology IA1 data test');
assert.deepEqual(timing('qcaa-biology-ea-p1'), [5, 90], 'Biology EA Paper 1');
assert.deepEqual(timing('qcaa-physics-ia1'), [5, 60], 'Physics IA1 data test');

// English uses planning time, and its external assessment is a single paper.
assert.deepEqual(timing('qcaa-english-ea'), [15, 120], 'English EA');
assert.equal(find('qcaa-english-ea').timing ?? 'planning', 'planning', 'English uses planning time');
assert.equal(QCAA_PRESETS.filter(p => p.id.startsWith('qcaa-english-ea')).length, 1, 'English EA is a single paper');

// Languages: IA2 is one instrument with two separately timed components.
assert.deepEqual(timing('qcaa-japanese-ia2-extended-response'), [10, 80], 'Japanese IA2 extended response');
assert.deepEqual(timing('qcaa-japanese-ia2-conversation'), [10, 7], 'Japanese IA2 conversation');

// --- a preset drives a correct timeline -----------------------------------
const start = new Date(2026, 9, 26, 9, 0, 0);
const bio = createExamTimeline(normalizeExam(find('qcaa-biology-ea-p1')), start, QCAA_EA_DIRECTIONS);
assert.equal(bio.workingStartMs, new Date(2026, 9, 26, 9, 5, 0).getTime(), 'working starts after 5 minutes perusal');
assert.equal(bio.finishMs, new Date(2026, 9, 26, 10, 35, 0).getTime(), 'working ends 90 minutes later');
assert.equal(bio.leavingStartMs, new Date(2026, 9, 26, 9, 40, 0).getTime(), 'QCAA leaving opens 40 minutes after the scheduled start');

console.log(`All QCAA preset checks passed (${QCAA_SUBJECTS.length} subjects, ${QCAA_PRESETS.length} instruments).`);
