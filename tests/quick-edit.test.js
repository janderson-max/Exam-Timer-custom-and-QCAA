// Drives the quick-edit dialog's own code against a stub DOM: the subject search and
// the leaving-rule fields. The stub records event listeners so the real handlers can
// be invoked rather than reimplemented here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function boot() {
  const store = new Map();
  const rendered = {};
  const elements = new Map();

  function makeEl(id) {
    const listeners = {};
    const el = {
      id,
      listeners,
      _value: '09:00:00',
      checked: false,
      hidden: false,
      disabled: false,
      dataset: {},
      options: [],
      style: {},
      attributes: {},
      elements: { namedItem: () => null },
      classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
      removeEventListener() {},
      dispatch(type, event = {}) { (listeners[type] || []).forEach(fn => fn({ preventDefault() {}, stopPropagation() {}, currentTarget: el, target: el, ...event })); },
      focus() {}, blur() {}, select() {},
      setAttribute(name, value) { el.attributes[name] = value; },
      removeAttribute(name) { delete el.attributes[name]; },
      showModal() {}, close() {},
      reportValidity: () => true,
      setCustomValidity() {},
      closest: () => null,
      scrollIntoView() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      // A real input coerces assigned values to strings; start-up also reads
      // #sessionStart, so every field gets a parseable default.
      get value() { return el._value; },
      set value(v) { el._value = String(v); },
      get innerHTML() { return rendered[id] ?? ''; },
      set innerHTML(v) { rendered[id] = v; },
      textContent: '',
    };
    return el;
  }

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
    el: selector => sandbox.document.querySelector(selector),
    read: expression => vm.runInContext(expression, sandbox),
  };
}

const app = boot();
const input = app.el('#editPresetInput');
const list = app.el('#editPresetList');

// Typing filters the list; the options rendered are the only ones selectable.
function search(text) {
  input.value = text;
  input.dispatch('input');
  return app.rendered['#editPresetList'] || '';
}

const optionsIn = html => [...html.matchAll(/data-combo-index="\d+"[^>]*>([^<]*)</g)].map(m => m[1]);
const groupsIn = html => [...html.matchAll(/class="combo-group"[^>]*>([^<]*)</g)].map(m => m[1]);

// Every term must match, so a subject plus an instrument narrows to one paper.
const bioEa = search('biology ea');
assert.deepEqual(groupsIn(bioEa), ['Biology'], 'only Biology should remain');
assert.deepEqual(optionsIn(bioEa), ['EA Paper 1', 'EA Paper 2'], 'only the Biology EA papers should remain');

const dataTests = search('data test');
assert.ok(optionsIn(dataTests).length >= 4, 'a search across subjects still matches each of them');
assert.ok(optionsIn(dataTests).every(text => text.includes('Data test')), 'every match should be a data test');
assert.ok(groupsIn(dataTests).includes('Biology') && groupsIn(dataTests).includes('Physics'), 'matches span subjects');

// Search is case-insensitive and order-insensitive.
assert.deepEqual(optionsIn(search('EA PAPER 1 biology')), ['EA Paper 1'], 'terms may be typed in any order or case');

// A search with no matches says so rather than silently showing everything.
const nothing = search('zzzz');
assert.equal(optionsIn(nothing).length, 0, 'no options for an unmatched search');
assert.match(nothing, /combo-empty/, 'an explicit empty state is shown');

// Clearing the box brings the whole list back, including the manual option.
const all = search('');
assert.ok(optionsIn(all).length > 100, 'clearing the search restores every instrument');
assert.ok(optionsIn(all).includes('Custom / manual exam'), 'the manual option is always available');

// --- choosing a subject fills the leaving rules ---------------------------
app.read('editingExamIndex = 0;');
app.read('applyPresetChoice("qcaa-biology-ea-p1")');
assert.equal(app.el('#editPreset').value, 'qcaa-biology-ea-p1', 'the chosen preset id is stored');
assert.equal(app.el('#editPresetInput').value, 'Biology — EA Paper 1', 'the box shows the full subject and instrument');
assert.equal(app.el('#editPerusal').value, '5', 'perusal comes from the syllabus');
assert.equal(app.el('#editWorking').value, '90', 'working time comes from the syllabus');
assert.equal(app.el('#editLeavingPolicy').value, 'qcaa-ea-2025', 'an EA preset brings the QCAA leaving policy');
assert.equal(app.el('#editLeaveAfterStart').value, '40', 'and the QCAA leaving offset');
assert.equal(app.el('#editNoLeaveBeforeEnd').value, '10', 'and the QCAA final restricted period');

// Under the QCAA policy its two fixed figures are shown as a note, not as fields.
assert.equal(app.el('#editLeaveAfterField').hidden, true, 'QCAA hides the teacher-defined leaving fields');
assert.equal(app.el('#editEaSessionField').hidden, false, 'QCAA shows the scheduled session');
assert.equal(app.el('#editEaLeavingNote').hidden, false, 'QCAA shows its leaving note');

// Switching back to teacher-defined restores the editable fields.
app.el('#editLeavingPolicy').value = 'teacher';
app.el('#editLeavingPolicy').dispatch('change');
assert.equal(app.el('#editLeaveAfterField').hidden, false, 'teacher-defined shows its leaving fields');
assert.equal(app.el('#editEaSessionField').hidden, true, 'teacher-defined hides the scheduled session');

// An internal assessment preset leaves the window teacher-defined and blank.
app.read('applyPresetChoice("qcaa-biology-ia1")');
assert.equal(app.el('#editLeavingPolicy').value, 'teacher', 'an IA preset stays teacher-defined');
assert.equal(app.el('#editWorking').value, '60', 'the IA1 data test is 60 minutes');

// --- a school-set FIA timing is remembered --------------------------------
// Units 1-2 timings are not prescribed, so an override sticks until Restore sample.
const fia = boot();
fia.read('editingExamIndex = 0;');
fia.read('applyPresetChoice("qcaa-biology-fia")');
assert.equal(fia.el('#editWorking').value, '60', 'the Biology FIA starts by mirroring its IA1 data test');

// Saving a changed working time records it against that FIA.
fia.read('rememberPresetOverride({ presetId: "qcaa-biology-fia", perusal: 10, working: 75 })');
assert.deepEqual(
  JSON.parse(fia.read('JSON.stringify(presetOverrides)')),
  { 'qcaa-biology-fia': { perusal: 10, working: 75 } },
  'the changed FIA timing is remembered',
);

// Choosing that FIA again brings the remembered timing back, not the mirror.
fia.read('applyPresetChoice("qcaa-biology-fia")');
assert.equal(fia.el('#editWorking').value, '75', 'the remembered working time is reapplied');
assert.equal(fia.el('#editPerusal').value, '10', 'the remembered perusal is reapplied');

// Setting it back to the mirrored values forgets the override rather than storing a
// redundant copy.
fia.read('rememberPresetOverride({ presetId: "qcaa-biology-fia", perusal: 5, working: 60 })');
assert.deepEqual(JSON.parse(fia.read('JSON.stringify(presetOverrides)')), {}, 'matching the mirror clears the override');

// A syllabus-prescribed instrument is never overridden this way.
fia.read('rememberPresetOverride({ presetId: "qcaa-biology-ea-p1", perusal: 5, working: 120 })');
assert.deepEqual(JSON.parse(fia.read('JSON.stringify(presetOverrides)')), {}, 'sourced QCAA timings are not overridable');
fia.read('applyPresetChoice("qcaa-biology-ea-p1")');
assert.equal(fia.el('#editWorking').value, '90', 'the EA paper still comes straight from the syllabus');

// --- changing the number of exams from the display ------------------------
// With session setup out of the panel, these are the only controls for it.
const count = boot();
const cardCount = () => (count.rendered['#examGrid'] || '').split('data-exam-index=').length - 1;

assert.equal(cardCount(), 3, 'the sample session starts with three exams');
assert.equal(count.el('#addExamFromDisplay').disabled, true, 'adding is refused at three');

count.read('addExam()');
assert.equal(cardCount(), 3, 'a fourth exam cannot be added');

count.read('removeExam(2)');
assert.equal(cardCount(), 2, 'an exam can be removed from the display');
assert.equal(count.el('#examCountStatus').textContent, '2 of 3 exams', 'the readout follows the count');
assert.equal(count.el('#addExamFromDisplay').disabled, false, 'adding is available again below three');

count.read('removeExam(1)');
assert.equal(count.el('#examCountStatus').textContent, '1 of 3 exams', 'the readout still says "of 3" with one exam');

// The room display always needs at least one exam.
count.read('removeExam(0)');
assert.equal(cardCount(), 1, 'the last exam cannot be removed');

count.read('addExam()');
assert.equal(cardCount(), 2, 'exams can be added back');
assert.equal(
  JSON.parse(count.read('localStorage.getItem("exam-room-timer-session-v1")')).exams.length,
  2,
  'the new exam count is saved on this browser',
);

console.log('All quick-edit checks passed.');
