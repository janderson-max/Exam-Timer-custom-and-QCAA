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

console.log('All quick-edit checks passed.');
