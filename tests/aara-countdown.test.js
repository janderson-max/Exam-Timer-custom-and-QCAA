// Exercise the browser's actual phase update against a small, hand-wired DOM.
// This catches display regressions that pure deadline-calculation tests cannot.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const MINUTE = 60_000;
const START = new Date(2026, 8, 10, 9, 0, 0).getTime();
const FINISH = START + 35 * MINUTE;
const FIVE_FINISH = FINISH + 5 * MINUTE;
const TEN_FINISH = FINISH + 10 * MINUTE;

function element(className = '') {
  const node = {
    className, value: '09:00:00', checked: false, hidden: false, disabled: false,
    dataset: {}, options: [], attributes: {}, children: [], textContent: '', innerHTML: '',
    style: { setProperty() {}, removeProperty() {} },
    elements: { namedItem: () => null },
    addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
    showModal() {}, close() {}, reportValidity: () => true, setCustomValidity() {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; },
    matches(selector) {
      if (selector.startsWith('.')) {
        return selector.slice(1).split('.').every(name => this.className.split(/\s+/).includes(name));
      }
      const data = selector.match(/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/);
      if (!data) return false;
      const key = data[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return data[2] === undefined ? key in this.dataset : this.dataset[key] === data[2];
    },
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; },
    querySelectorAll(selector) {
      const selectors = selector.split(',').map(value => value.trim().split(/\s+/));
      const found = [];
      const visit = child => {
        if (selectors.some(parts => {
          if (!child.matches(parts[parts.length - 1])) return false;
          let ancestor = child.parentElement;
          for (let i = parts.length - 2; i >= 0; i--) {
            while (ancestor && ancestor !== this && !ancestor.matches(parts[i])) ancestor = ancestor.parentElement;
            if (!ancestor || ancestor === this) return false;
            ancestor = ancestor.parentElement;
          }
          return true;
        })) found.push(child);
        child.children.forEach(visit);
      };
      this.children.forEach(visit);
      return found;
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
  };
  node.classList = {
    contains: name => node.className.split(/\s+/).includes(name),
    add(...names) { names.forEach(name => { if (!this.contains(name)) node.className += ` ${name}`; }); },
    remove(...names) { node.className = node.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
    toggle(name, force) {
      const enabled = force === undefined ? !this.contains(name) : force;
      if (enabled) this.add(name); else this.remove(name);
      return enabled;
    },
  };
  return node;
}

function makeCard(rates) {
  const card = element('exam-card');
  card.dataset.examIndex = '0';
  const phase = card.appendChild(element('phase'));
  const label = phase.appendChild(element('phase-label'));
  const slot = phase.appendChild(element('countdown-slot standard-countdown'));
  const countdown = slot.appendChild(element('countdown'));
  const caption = phase.appendChild(element('countdown-caption standard-countdown'));
  const aara = phase.appendChild(element('aara-countdowns'));
  aara.hidden = true;
  const groups = new Map(rates.map(rate => {
    const group = aara.appendChild(element('aara-countdown-group'));
    group.dataset.aaraRate = String(rate);
    const groupLabel = group.appendChild(element('aara-group-label'));
    groupLabel.textContent = `AARA +${rate}/30`;
    const groupSlot = group.appendChild(element('countdown-slot'));
    const digits = groupSlot.appendChild(element('countdown'));
    const finished = group.appendChild(element('aara-group-finished'));
    finished.textContent = 'FINISHED';
    finished.hidden = true;
    const status = group.appendChild(element('aara-group-status'));
    return [rate, { group, label: groupLabel, slot: groupSlot, countdown: digits, finished, status }];
  }));
  return { card, phase, label, slot, countdown, caption, aara, groups };
}

function boot(rates = [5, 10]) {
  const store = new Map();
  const elements = new Map();
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const sandbox = {
    document: {
      documentElement: element(), fullscreenElement: null,
      addEventListener() {}, querySelector: get, querySelectorAll: () => [],
    },
    localStorage: {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: key => store.delete(key),
    },
    setInterval: () => 0, clearInterval() {}, structuredClone,
    Intl, Date, Math, JSON, Number, String, Boolean, Object, Array, Set, Map, console,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of ['timer-core.js', 'presets.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  }
  const run = expression => vm.runInContext(expression, sandbox);
  run(`exams = [normalizeExam({ name: 'Test exam', perusal: 5, working: 30,
    aaraOptions: ${JSON.stringify(rates)}, leavingPolicy: 'none' })];
    exams[0].runtime = makeRuntime(exams[0], ${START}, ${START + 5 * MINUTE});
    hideTimerSeconds = false; renderCards();`);
  const markup = get('#examGrid').innerHTML;
  const display = makeCard(rates);
  get('#examGrid').appendChild(display.card);
  return {
    ...display, markup, run, get,
    tick(at) { run(`updateSessionState(new Date(${at}))`); },
  };
}

function assertRunning(app, rate, text) {
  const group = app.groups.get(rate);
  assert.equal(group.label.textContent, `AARA +${rate}/30`, 'the rate stays attached to its countdown');
  assert.equal(group.slot.hidden, false, `+${rate}/30 has a visible countdown`);
  assert.equal(group.countdown.textContent, text, `+${rate}/30 counts to its own deadline`);
  assert.equal(group.finished.hidden, true, `+${rate}/30 is not marked finished early`);
  assert.equal(group.status.textContent, 'remaining');
}

function assertFinished(app, rate) {
  const group = app.groups.get(rate);
  assert.equal(group.label.textContent, `AARA +${rate}/30`, 'a completed rate remains identifiable');
  assert.equal(group.slot.hidden, true, `+${rate}/30 replaces its countdown on completion`);
  assert.equal(group.finished.hidden, false, `+${rate}/30 keeps its FINISHED message visible`);
  assert.equal(group.finished.textContent, 'FINISHED');
  assert.equal(group.status.textContent, 'Stop writing');
}

const both = boot();
assert.match(both.markup, /data-aara-rate="5"/, 'renderCards creates the +5/30 group');
assert.match(both.markup, /data-aara-rate="10"/, 'renderCards creates the +10/30 group');

both.tick(FINISH - 1);
assert.equal(both.label.textContent, 'WORKING');
assert.equal(both.countdown.textContent, '0:00:01');
assert.equal(both.slot.hidden, false);
assert.equal(both.aara.hidden, true, 'ordinary working time retains one main countdown');

both.tick(FINISH);
assert.equal(both.label.textContent, 'AARA EXTRA TIME');
assert.equal(both.slot.hidden, true);
assert.equal(both.caption.hidden, true);
assert.equal(both.aara.hidden, false, 'both group countdowns appear at the ordinary finish');
assertRunning(both, 5, '0:05:00');
assertRunning(both, 10, '0:10:00');
assert.match(both.get('#nextEvent').textContent, /\+5\/30.*finishes/, 'the earliest AARA finish is the next event');

both.tick(FIVE_FINISH - 1);
assertRunning(both, 5, '0:00:01');
assertRunning(both, 10, '0:05:01');
both.tick(FIVE_FINISH);
assertFinished(both, 5);
assertRunning(both, 10, '0:05:00');
assert.equal(both.label.textContent, 'AARA EXTRA TIME');
assert.match(both.get('#nextEvent').textContent, /\+10\/30.*finishes/, 'the next event advances to +10/30');
both.tick(FIVE_FINISH + 1);
assertFinished(both, 5);
assertRunning(both, 10, '0:05:00');

both.tick(TEN_FINISH - 1);
assertFinished(both, 5);
assertRunning(both, 10, '0:00:01');
both.tick(TEN_FINISH);
assertFinished(both, 5);
assertFinished(both, 10);
assert.equal(both.label.textContent, 'FINISHED');
assert.equal(both.aara.hidden, false, 'both completed rates remain visible after the final finish');
assert.equal(both.get('#nextEvent').textContent, 'No further scheduled events');

// Hiding seconds must never show 0:00 while a group still has time left.
const minutes = boot();
minutes.run('hideTimerSeconds = true');
minutes.tick(FIVE_FINISH - 1);
assertRunning(minutes, 5, '0:01');
assertRunning(minutes, 10, '0:06');
minutes.tick(FIVE_FINISH);
assertFinished(minutes, 5);
assertRunning(minutes, 10, '0:05');

for (const rate of [5, 10]) {
  const single = boot([rate]);
  assert.equal((single.markup.match(/data-aara-rate=/g) || []).length, 1, 'only the selected rate is rendered');
  single.tick(FINISH);
  assertRunning(single, rate, rate === 5 ? '0:05:00' : '0:10:00');
  single.tick(FINISH + rate * MINUTE);
  assertFinished(single, rate);
  assert.equal(single.label.textContent, 'FINISHED');
}

const ordinary = boot([]);
assert.doesNotMatch(ordinary.markup, /data-aara-rate=/, 'an ordinary exam renders no AARA group');
ordinary.tick(FINISH);
assert.equal(ordinary.label.textContent, 'FINISHED');
assert.equal(ordinary.countdown.textContent, '0:00:00');
assert.equal(ordinary.slot.hidden, false);
assert.equal(ordinary.aara.hidden, true);

// Pause before the first AARA finish: both independent deadlines move on resume.
const paused = boot();
paused.run(`pauseExam(0, ${FINISH + 2 * MINUTE})`);
paused.tick(TEN_FINISH + 10 * MINUTE);
assert.match(paused.label.textContent, /^PAUSED/);
assert.equal(paused.groups.get(5).countdown.textContent, '0:03:00');
assert.equal(paused.groups.get(10).countdown.textContent, '0:08:00');
for (const { status, finished } of paused.groups.values()) {
  assert.equal(status.textContent, 'timer paused');
  assert.equal(finished.hidden, true);
}
paused.run(`resumeExam(0, ${FINISH + 4 * MINUTE})`);
paused.tick(FINISH + 4 * MINUTE);
assertRunning(paused, 5, '0:03:00');
assertRunning(paused, 10, '0:08:00');
paused.tick(FIVE_FINISH + 2 * MINUTE);
assertFinished(paused, 5);
assertRunning(paused, 10, '0:05:00');

// Pause after +5/30 ends: its finish must remain visible while only +10/30 shifts.
const laterPause = boot();
laterPause.run(`pauseExam(0, ${FIVE_FINISH + MINUTE})`);
laterPause.tick(TEN_FINISH + 20 * MINUTE);
assertFinished(laterPause, 5);
assert.equal(laterPause.groups.get(10).countdown.textContent, '0:04:00');
assert.equal(laterPause.groups.get(10).status.textContent, 'timer paused');
laterPause.run(`resumeExam(0, ${FIVE_FINISH + 3 * MINUTE})`);
laterPause.tick(FIVE_FINISH + 3 * MINUTE);
assertFinished(laterPause, 5);
assertRunning(laterPause, 10, '0:04:00');
laterPause.tick(TEN_FINISH + 2 * MINUTE);
assertFinished(laterPause, 5);
assertFinished(laterPause, 10);

console.log('All AARA countdown checks passed.');
