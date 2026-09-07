// Boots the three browser scripts against a stub DOM so the saved-session paths in
// app.js are covered, not just the pure helpers in timer-core.js. The stub is
// deliberately dumb: it only needs to be good enough for app.js to reach the end
// of its start-up sequence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SESSION_KEY = 'exam-room-timer-session-v1';
const DISPLAY_KEY = 'exam-room-timer-display-v1';

function boot(seed = {}) {
  const store = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  const rendered = {};
  const elements = new Map();

  const makeEl = id => ({
    id, value: '09:00:00', checked: false, hidden: false, disabled: false,
    dataset: {}, options: [], style: {}, elements: { namedItem: () => null },
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
    setAttribute() {}, removeAttribute() {}, showModal() {}, close() {},
    reportValidity: () => true, setCustomValidity() {}, closest: () => null,
    querySelector: () => null, querySelectorAll: () => [],
    get innerHTML() { return rendered[id] ?? ''; },
    set innerHTML(value) { rendered[id] = value; },
    textContent: '',
  });

  const sandbox = {
    document: {
      documentElement: makeEl('html'),
      fullscreenElement: null,
      addEventListener() {},
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, makeEl(selector));
        return elements.get(selector);
      },
      querySelectorAll: () => [],
    },
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: key => store.delete(key),
    },
    setInterval: () => 0,
    clearInterval: () => {},
    structuredClone,
    Intl, Date, Math, JSON, Number, String, Boolean, Object, Array, Set, Map, console,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  for (const file of ['timer-core.js', 'presets.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  }

  return {
    rendered,
    read: expression => vm.runInContext(expression, sandbox),
    element: selector => elements.get(selector),
    stored: key => JSON.parse(store.get(key) ?? 'null'),
  };
}

// --- the app starts up at all ---------------------------------------------
const fresh = boot();
assert.match(fresh.rendered['#examGrid'] ?? '', /exam-card/, 'the exam cards render on a fresh load');
assert.match(fresh.rendered['#examEditors'] ?? '', /name-0/, 'the setup editors render on a fresh load');
assert.equal(fresh.read('exams').length, 3, 'the sample session loads when nothing is saved');

// --- a saved session from before the leaving-policy model ------------------
const legacy = boot({
  [SESSION_KEY]: {
    start: '09:00:00', startChoice: 'manual', date: '2026-09-07',
    exams: [{
      name: 'Old Maths', type: 'IA sample', perusal: 10, working: 90,
      aara: 5, leaveAfterStart: 30, noLeaveBeforeEnd: 15, colour: 'blue',
    }],
  },
});
const restored = legacy.read('exams');
assert.equal(restored.length, 1, 'a legacy session is restored rather than discarded');
assert.equal(restored[0].leaveAfterStart, 40, 'perusal is folded into the legacy leaving offset');
assert.equal(restored[0].leavingPolicy, 'teacher', 'a legacy exam gains the teacher-defined policy');
assert.deepEqual([...restored[0].aaraOptions], [5], 'the legacy single-rate AARA field is carried across');
assert.equal(restored[0].type, 'IA', 'the " sample" suffix is stripped');

// A save whose optional fields are missing must be repaired, not thrown away with
// the rest of the session.
const sparse = boot({
  [SESSION_KEY]: {
    start: '10:15:00', startChoice: 'manual', date: '2026-09-07',
    exams: [{ name: 'Sparse', perusal: 5, working: 60 }],
  },
});
assert.equal(sparse.read('exams').length, 1, 'a session with missing fields still restores');
assert.equal(sparse.read('exams')[0].noLeaveBeforeEnd, 0, 'missing leaving fields normalise to 0');
assert.equal(sparse.element('#sessionStart').value, '10:15:00', 'the saved start time is restored');

// Genuinely unusable data is still refused.
const broken = boot({
  [SESSION_KEY]: { start: '09:00:00', date: '2026-09-07', exams: [{ name: '', perusal: 5, working: 60 }] },
});
assert.equal(broken.read('exams').length, 3, 'an exam with no name falls back to the sample session');

// --- the display preference lives outside the session ---------------------
const prefOnly = boot({
  [DISPLAY_KEY]: { hideTimerSeconds: true },
  [SESSION_KEY]: { start: 'not-a-time', exams: [] },
});
assert.equal(prefOnly.read('hideTimerSeconds'), true, 'the preference survives a rejected session');
assert.equal(prefOnly.element('#hideTimerSeconds').checked, true, 'the checkbox reflects the restored preference');

// It is also read back from its old home so an existing browser keeps the setting.
const legacyPref = boot({
  [SESSION_KEY]: {
    start: '09:00:00', date: '2026-09-07', hideTimerSeconds: true,
    exams: [{ name: 'Old', perusal: 5, working: 60, leaveAfterStart: 10, noLeaveBeforeEnd: 5, leavingPolicy: 'teacher' }],
  },
});
assert.equal(legacyPref.read('hideTimerSeconds'), true, 'the preference is picked up from the old session blob');

// --- quick edit rebases a running timer -----------------------------------
// Once a timer is running its end times live in exam.runtime, which createExamTimeline
// prefers over the scheduled times. Without a rebase, editing the working time of a
// running exam would appear to save and change nothing.
const MIN = 60_000;
const STARTED = new Date(2026, 9, 26, 9, 0, 0).getTime();
const edit = boot();

const workingCase = edit.read(`(() => {
  exams[0] = normalizeExam({ ...exams[0], perusal: 5, working: 90 });
  exams[0].runtime = makeRuntime(exams[0], ${STARTED}, ${STARTED + 5 * MIN}, "working");
  const previous = exams[0].runtime;
  exams[0] = normalizeExam({ ...exams[0], working: 100 });
  rebaseRuntime(exams[0], previous);
  return [exams[0].runtime.workingStartMs, exams[0].runtime.finishMs].join(',');
})()`);
assert.equal(
  workingCase,
  [STARTED + 5 * MIN, STARTED + 5 * MIN + 100 * MIN].join(','),
  'a longer working time extends the finish from when working actually began',
);

const perusalCase = edit.read(`(() => {
  exams[1] = normalizeExam({ ...exams[1], perusal: 5, working: 90 });
  exams[1].runtime = makeRuntime(exams[1], ${STARTED}, ${STARTED + 5 * MIN}, "perusal");
  const previous = exams[1].runtime;
  exams[1] = normalizeExam({ ...exams[1], perusal: 15 });
  rebaseRuntime(exams[1], previous);
  return [exams[1].runtime.workingStartMs, exams[1].runtime.finishMs].join(',');
})()`);
assert.equal(
  perusalCase,
  [STARTED + 15 * MIN, STARTED + 15 * MIN + 90 * MIN].join(','),
  'during perusal, a longer perusal pushes working start and finish out from the real start',
);

// Adding an AARA group to a running exam must produce a finish time for it.
const aaraCase = edit.read(`(() => {
  exams[2] = normalizeExam({ ...exams[2], perusal: 0, working: 90, aaraOptions: [] });
  exams[2].runtime = makeRuntime(exams[2], ${STARTED}, ${STARTED}, "working");
  const previous = exams[2].runtime;
  exams[2] = normalizeExam({ ...exams[2], aaraOptions: [10] });
  rebaseRuntime(exams[2], previous);
  return String(exams[2].runtime.aaraFinishByRate[10]);
})()`);
assert.equal(
  aaraCase,
  String(STARTED + 90 * MIN + 30 * MIN),
  'a newly ticked AARA group gets a finish time based on the running exam',
);

// A paused exam stays paused across an edit, and an exam that has not started keeps
// following the scheduled session start.
const pausedCase = edit.read(`(() => {
  exams[0].runtime = makeRuntime(exams[0], ${STARTED}, ${STARTED}, "working");
  exams[0].runtime.pausedAt = ${STARTED + 10 * MIN};
  const previous = exams[0].runtime;
  exams[0] = normalizeExam({ ...exams[0], working: 45 });
  rebaseRuntime(exams[0], previous);
  return [exams[0].runtime.pausedAt, exams[0].runtime.startedPhase].join(',');
})()`);
assert.equal(pausedCase, [STARTED + 10 * MIN, 'working'].join(','), 'an edit keeps a paused exam paused');

const notStarted = edit.read(`(() => {
  delete exams[0].runtime;
  rebaseRuntime(exams[0], undefined);
  return String(exams[0].runtime);
})()`);
assert.equal(notStarted, 'undefined', 'editing an exam that has not started creates no runtime override');

console.log('All session restore checks passed.');
