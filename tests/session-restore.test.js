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

console.log('All session restore checks passed.');
