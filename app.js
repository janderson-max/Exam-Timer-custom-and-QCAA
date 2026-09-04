const SAMPLE_EXAMS = [
  { name: "Sample Mathematics — Paper 1", type: "EA", perusal: 5, working: 90, aara: 5, leaveAfterStart: 30, noLeaveBeforeEnd: 15, leavingPolicy: "teacher", colour: "blue", presetId: "manual" },
  { name: "Sample English — Written response", type: "IA", perusal: 10, working: 120, aara: 0, leaveAfterStart: 60, noLeaveBeforeEnd: 30, leavingPolicy: "teacher", colour: "purple", presetId: "manual" },
  { name: "Custom Year 11 Science", type: "Custom", perusal: 10, working: 100, aara: 10, leaveAfterStart: 30, noLeaveBeforeEnd: 15, leavingPolicy: "teacher", colour: "teal", presetId: "manual" },
];

const STORAGE_KEY = "exam-room-timer-session-v1";
const CUSTOM_PRESETS_KEY = "exam-room-timer-custom-presets-v1";
const EXAM_COLOURS = ["blue", "purple", "teal", "orange", "rose"];
let exams = structuredClone(SAMPLE_EXAMS);
let customPresets = loadCustomPresets();
let sessionDate = dateKey(new Date());

const examGrid = document.querySelector("#examGrid");
const editors = document.querySelector("#examEditors");
const panel = document.querySelector("#setupPanel");
const scrim = document.querySelector("#scrim");
const form = document.querySelector("#setupForm");
const resetDialog = document.querySelector("#resetDialog");

function formatClock(date) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  }).format(date);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long", day: "numeric", month: "long",
  }).format(date);
}

function timeFromMinutes(base, minutes) {
  const date = new Date(base);
  date.setMinutes(date.getMinutes() + minutes);
  return new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).format(date);
}

function getBaseDate() {
  const [hour, minute, second = 0] = document.querySelector("#sessionStart").value.split(":").map(Number);
  const [year, month, day] = sessionDate.split("-").map(Number);
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

function dateKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((value, index) => String(value).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
}

function inputTime(date) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(value => String(value).padStart(2, "0"))
    .join(":");
}

function persistSession(message = "Session saved on this browser.") {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      start: document.querySelector("#sessionStart").value,
      date: sessionDate,
      exams,
    }));
    document.querySelector("#sessionSaveStatus").textContent = message;
  } catch {
    document.querySelector("#sessionSaveStatus").textContent = "Browser storage is unavailable; keep this tab open.";
  }
}

function loadCustomPresets() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function persistCustomPresets() {
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets));
    return true;
  } catch {
    return false;
  }
}

function restoreSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(saved.start)) return;
    document.querySelector("#sessionStart").value = saved.start;
    if (/^\d{4}-\d{2}-\d{2}$/.test(saved.date)) sessionDate = saved.date;
    if (Array.isArray(saved.exams) && saved.exams.length >= 1 && saved.exams.length <= 3) {
      exams = saved.exams.map(exam => {
        const hasCurrentLeavingModel = Boolean(exam.leavingPolicy);
        return {
          ...exam,
          type: String(exam.type || "Custom").replace(" sample", ""),
          leaveAfterStart: hasCurrentLeavingModel
            ? exam.leaveAfterStart
            : Number(exam.leaveAfterStart || 0) + Number(exam.perusal || 0),
          leavingPolicy: exam.leavingPolicy || "teacher",
          presetId: exam.presetId || "manual",
        };
      });
    }
    document.querySelector("#sessionSaveStatus").textContent = "Previous session restored from this browser.";
  } catch {
    // Ignore incomplete or invalid saved draft data and use the sample session.
  }
}

function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return [hours ? `${hours} hr${hours === 1 ? "" : "s"}` : "", mins ? `${mins} min` : ""].filter(Boolean).join(" ");
}

function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function examTimes(exam, start = getBaseDate()) {
  const startMs = start.getTime();
  const workingStartMs = startMs + exam.perusal * 60_000;
  const finishMs = workingStartMs + exam.working * 60_000;
  const extraMinutes = Math.round((exam.working / 30) * exam.aara);
  let leavingStartMs = startMs + Number(exam.leaveAfterStart) * 60_000;
  if (exam.leavingPolicy === "qcaa-ea-2025") {
    const [scheduledHour, scheduledMinute] = (exam.eaScheduledStart || "09:00").split(":").map(Number);
    const scheduledStart = new Date(start);
    scheduledStart.setHours(scheduledHour, scheduledMinute, 0, 0);
    leavingStartMs = scheduledStart.getTime() + QCAA_EA_DIRECTIONS.firstMinutesFromScheduledStart * 60_000;
  }

  return {
    startMs,
    workingStartMs,
    warningMs: Math.max(workingStartMs, finishMs - 10 * 60_000),
    finishMs,
    aaraFinishMs: finishMs + extraMinutes * 60_000,
    leavingStartMs,
    leavingEndMs: finishMs - Number(exam.noLeaveBeforeEnd) * 60_000,
  };
}

function renderCards() {
  const start = getBaseDate();
  examGrid.dataset.count = String(exams.length);
  examGrid.innerHTML = exams.map((exam, index) => {
    const workingStart = exam.perusal;
    const finish = workingStart + exam.working;
    const warning = Math.max(workingStart, finish - 10);
    const extra = Math.round((exam.working / 30) * exam.aara);
    const times = examTimes(exam, start);
    const hasLeavingWindow = times.leavingStartMs <= times.leavingEndMs;
    return `
      <article class="exam-card colour-${exam.colour} ${index === 0 ? "current" : ""}" data-exam-index="${index}">
        <header class="exam-header">
          <span class="exam-number">EXAM ${index + 1} · ${exam.type.toUpperCase()}</span>
          <h3>${escapeHtml(exam.name)}</h3>
          <p>${exam.perusal ? `${exam.perusal} min perusal / planning` : "No perusal / planning"} · ${durationLabel(exam.working)} working</p>
        </header>
        <div class="phase phase-waiting">
          <span class="phase-label">WAITING</span>
          <strong class="countdown">0:00:00</strong>
          <small class="countdown-caption">until exam begins</small>
        </div>
        <div class="timeline">
          <div class="timeline-row"><span>${exam.perusal ? "Perusal / planning" : "Exam begins"}</span><strong>${timeFromMinutes(start, 0)}</strong></div>
          <div class="timeline-row"><span>Working starts</span><strong>${timeFromMinutes(start, workingStart)}</strong></div>
          <div class="timeline-row warning"><span>10-minute warning</span><strong>${timeFromMinutes(start, warning)}</strong></div>
          <div class="timeline-row finish"><span>Working finishes</span><strong>${timeFromMinutes(start, finish)}</strong></div>
        </div>
        <div class="permissions">
          <span>PERMITTED LEAVING WINDOW</span>
          ${hasLeavingWindow
            ? `<strong>${formatClock(new Date(times.leavingStartMs))} <i>to</i> ${formatClock(new Date(times.leavingEndMs))}</strong>`
            : `<strong class="invalid-window">No valid window</strong>`}
        </div>
        ${exam.aara ? `<div class="aara">AARA +${exam.aara}/30 finish <strong>${timeFromMinutes(start, finish + extra)}</strong></div>` : ""}
      </article>`;
  }).join("");

  const first = exams[0];
  document.querySelector("#nextEvent").textContent = `10-minute warning at ${timeFromMinutes(start, first.perusal + first.working - 10)}`;
  updateSessionState();
}

function updateSessionState(now = new Date()) {
  const nowMs = now.getTime();
  const upcomingEvents = [];
  let hasWorking = false;
  let hasPerusal = false;
  let hasAara = false;
  let hasWaiting = false;

  exams.forEach((exam, index) => {
    const card = examGrid.querySelector(`[data-exam-index="${index}"]`);
    if (!card) return;
    const phase = card.querySelector(".phase");
    const label = card.querySelector(".phase-label");
    const countdown = card.querySelector(".countdown");
    const caption = card.querySelector(".countdown-caption");
    const permissions = card.querySelector(".permissions");
    const permissionLabel = permissions.querySelector("span");
    const times = examTimes(exam);
    let remaining = 0;
    let phaseName = "FINISHED";
    let phaseClass = "phase-finished";
    let phaseCaption = "exam complete";

    if (nowMs < times.startMs) {
      hasWaiting = true;
      phaseName = "STARTS IN";
      phaseClass = "phase-waiting";
      phaseCaption = "until exam begins";
      remaining = times.startMs - nowMs;
      upcomingEvents.push({ time: times.startMs, label: `${exam.name} begins` });
    } else if (exam.perusal > 0 && nowMs < times.workingStartMs) {
      hasPerusal = true;
      phaseName = "PERUSAL / PLANNING";
      phaseClass = "phase-perusal";
      phaseCaption = "remaining";
      remaining = times.workingStartMs - nowMs;
      upcomingEvents.push({ time: times.workingStartMs, label: `${exam.name} working time begins` });
    } else if (nowMs < times.finishMs) {
      hasWorking = true;
      phaseName = "WORKING";
      phaseClass = "phase-working";
      phaseCaption = "remaining";
      remaining = times.finishMs - nowMs;
      if (nowMs < times.warningMs) upcomingEvents.push({ time: times.warningMs, label: `${exam.name} 10-minute warning` });
      upcomingEvents.push({ time: times.finishMs, label: `${exam.name} working time finishes` });
    } else if (exam.aara > 0 && nowMs < times.aaraFinishMs) {
      hasAara = true;
      phaseName = "AARA EXTRA TIME";
      phaseClass = "phase-aara";
      phaseCaption = "remaining for approved students";
      remaining = times.aaraFinishMs - nowMs;
      upcomingEvents.push({ time: times.aaraFinishMs, label: `${exam.name} AARA time finishes` });
    }

    phase.className = `phase ${phaseClass}`;
    label.textContent = phaseName;
    countdown.textContent = formatRemaining(remaining);
    caption.textContent = phaseCaption;

    permissions.classList.toggle("leaving-now", nowMs >= times.leavingStartMs && nowMs <= times.leavingEndMs);
    permissions.classList.toggle("leaving-closed", nowMs > times.leavingEndMs);
    permissionLabel.textContent = nowMs >= times.leavingStartMs && nowMs <= times.leavingEndMs
      ? "LEAVING PERMITTED NOW"
      : nowMs > times.leavingEndMs
        ? "LEAVING WINDOW CLOSED"
        : "PERMITTED LEAVING WINDOW";

    if (nowMs < times.leavingStartMs) upcomingEvents.push({ time: times.leavingStartMs, label: `${exam.name} leaving window opens` });
    else if (nowMs <= times.leavingEndMs) upcomingEvents.push({ time: times.leavingEndMs, label: `${exam.name} leaving window closes` });
  });

  document.querySelector("#roomHeading").textContent = hasWorking
    ? "Working time in progress"
    : hasPerusal
      ? "Perusal / planning in progress"
      : hasAara
        ? "AARA extra time in progress"
        : hasWaiting
          ? "Exams have not started"
          : "All exams have finished";

  upcomingEvents.sort((a, b) => a.time - b.time);
  document.querySelector("#nextEvent").textContent = upcomingEvents.length
    ? `${upcomingEvents[0].label} at ${formatClock(new Date(upcomingEvents[0].time))}`
    : "No further scheduled events";
}

function presetOptions(selectedId) {
  const option = preset => `<option value="${preset.id}" ${preset.id === selectedId ? "selected" : ""}>${escapeHtml(preset.name)}</option>`;
  return `
    <option value="manual" ${selectedId === "manual" ? "selected" : ""}>Custom / manual exam</option>
    <optgroup label="QCAA 2025 syllabus">${QCAA_PRESETS.map(option).join("")}</optgroup>
    ${customPresets.length ? `<optgroup label="Saved custom exams">${customPresets.map(option).join("")}</optgroup>` : ""}`;
}

function leavingControls(exam, index) {
  if (exam.leavingPolicy === "qcaa-ea-2025") {
    return `
      <label>Leaving rules
        <select name="leavingPolicy-${index}" data-leaving-policy-index="${index}">
          <option value="teacher">Teacher-defined</option>
          <option value="qcaa-ea-2025" selected>QCAA EA June 2025</option>
        </select>
      </label>
      <label>Scheduled EA session
        <select name="eaScheduledStart-${index}">
          <option value="09:00" ${exam.eaScheduledStart === "09:00" ? "selected" : ""}>Morning — 9:00 am</option>
          <option value="12:30" ${exam.eaScheduledStart === "12:30" ? "selected" : ""}>Afternoon — 12:30 pm</option>
        </select>
      </label>
      <p class="field-note wide">Leaving is blocked until 40 minutes after the scheduled start and during the final 10 minutes.</p>`;
  }

  return `
    <label>Leaving rules
      <select name="leavingPolicy-${index}" data-leaving-policy-index="${index}">
        <option value="teacher" selected>Teacher-defined</option>
        <option value="qcaa-ea-2025">QCAA EA June 2025</option>
      </select>
    </label>
    <span></span>
    <label>Cannot leave for first (session min)<input name="leaveAfterStart-${index}" type="number" min="0" max="600" value="${exam.leaveAfterStart ?? ""}" required /></label>
    <label>Cannot leave during final (min)<input name="noLeaveBeforeEnd-${index}" type="number" min="0" max="600" value="${exam.noLeaveBeforeEnd ?? ""}" required /></label>`;
}

function sourceNote(exam) {
  if (!exam.source) return "Manual exam — save it below to reuse it in future sessions.";
  const source = escapeHtml(exam.source);
  const syllabusLink = exam.sourceUrl
    ? `<a href="${exam.sourceUrl}" target="_blank" rel="noreferrer">${source}</a>`
    : source;
  return exam.leavingPolicy === "qcaa-ea-2025"
    ? `${syllabusLink} · <a href="${QCAA_EA_DIRECTIONS.url}" target="_blank" rel="noreferrer">EA leaving directions (June 2025)</a>`
    : syllabusLink;
}

function renderEditors() {
  editors.innerHTML = exams.map((exam, index) => `
    <section class="editor">
      <div class="editor-heading">
        <h3>Exam ${index + 1}</h3>
        <button class="remove-exam" type="button" data-remove-exam="${index}" ${exams.length === 1 ? "disabled" : ""} aria-label="Remove exam ${index + 1}">Remove</button>
      </div>
      <div class="editor-grid">
        <label class="wide">Preset
          <select name="preset-${index}" data-preset-index="${index}">${presetOptions(exam.presetId || "manual")}</select>
        </label>
        <p class="preset-source wide">${sourceNote(exam)}</p>
        <label class="wide">Display name<input name="name-${index}" value="${escapeHtml(exam.name)}" required /></label>
        <label>Category
          <select name="type-${index}">
            ${["Custom", "FIA", "IA", "EA"].map(type => `<option ${type === exam.type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
        <label>Perusal / planning (min)<input name="perusal-${index}" type="number" min="0" max="120" value="${exam.perusal ?? ""}" required /></label>
        <label>Working time (min)<input name="working-${index}" type="number" min="1" max="600" value="${exam.working ?? ""}" required /></label>
        <label>AARA extra time
          <select name="aara-${index}">
            <option value="0" ${exam.aara === 0 ? "selected" : ""}>None</option>
            <option value="5" ${exam.aara === 5 ? "selected" : ""}>5 min per 30</option>
            <option value="10" ${exam.aara === 10 ? "selected" : ""}>10 min per 30</option>
          </select>
        </label>
        ${leavingControls(exam, index)}
        <label>Subject colour
          <select name="colour-${index}">
            ${EXAM_COLOURS.map(colour => `<option value="${colour}" ${colour === exam.colour ? "selected" : ""}>${colour[0].toUpperCase() + colour.slice(1)}</option>`).join("")}
          </select>
        </label>
        <div class="custom-preset-actions wide">
          <button type="button" class="save-custom" data-save-custom="${index}">${String(exam.presetId).startsWith("custom-") ? "Update saved option" : "Save as custom option"}</button>
          ${String(exam.presetId).startsWith("custom-") ? `<button type="button" class="delete-custom" data-delete-custom="${index}">Delete saved option</button>` : ""}
        </div>
      </div>
    </section>`).join("");

  document.querySelector("#examCount").textContent = `${exams.length} of 3`;
  document.querySelector("#addExamButton").disabled = exams.length >= 3;
}

function nullableNumber(name, fallback) {
  const field = form.elements.namedItem(name);
  if (!field) return fallback ?? null;
  return field.value === "" ? null : Number(field.value);
}

function readEditorDraft() {
  return exams.map((exam, index) => ({
    ...exam,
    presetId: form.elements.namedItem(`preset-${index}`)?.value ?? exam.presetId ?? "manual",
    name: form.elements.namedItem(`name-${index}`)?.value ?? exam.name,
    type: form.elements.namedItem(`type-${index}`)?.value ?? exam.type,
    perusal: nullableNumber(`perusal-${index}`, exam.perusal),
    working: nullableNumber(`working-${index}`, exam.working),
    aara: nullableNumber(`aara-${index}`, exam.aara),
    leaveAfterStart: nullableNumber(`leaveAfterStart-${index}`, exam.leaveAfterStart),
    noLeaveBeforeEnd: nullableNumber(`noLeaveBeforeEnd-${index}`, exam.noLeaveBeforeEnd),
    leavingPolicy: form.elements.namedItem(`leavingPolicy-${index}`)?.value ?? exam.leavingPolicy ?? "teacher",
    eaScheduledStart: form.elements.namedItem(`eaScheduledStart-${index}`)?.value ?? exam.eaScheduledStart ?? "09:00",
    colour: form.elements.namedItem(`colour-${index}`)?.value ?? exam.colour,
  }));
}

function newExam(index) {
  return {
    name: `Custom exam ${index + 1}`,
    type: "Custom",
    perusal: 10,
    working: 90,
    aara: 0,
    leaveAfterStart: 30,
    noLeaveBeforeEnd: 15,
    leavingPolicy: "teacher",
    eaScheduledStart: "09:00",
    colour: EXAM_COLOURS[index % EXAM_COLOURS.length],
    presetId: "manual",
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function openPanel() {
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  scrim.hidden = false;
  document.querySelector("#closeSetupButton").focus();
}

function closePanel() {
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  scrim.hidden = true;
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const nextExams = readEditorDraft();

  const invalidIndex = nextExams.findIndex(exam => exam.leavingPolicy === "teacher"
    && exam.leaveAfterStart + exam.noLeaveBeforeEnd > exam.perusal + exam.working);
  if (invalidIndex !== -1) {
    const input = form.elements.namedItem(`noLeaveBeforeEnd-${invalidIndex}`);
    input.setCustomValidity("The two restricted periods overlap, so there would be no permitted leaving window.");
    input.reportValidity();
    input.addEventListener("input", () => input.setCustomValidity(""), { once: true });
    return;
  }

  exams = nextExams;
  persistSession();
  renderCards();
  closePanel();
});

document.querySelector("#setupButton").addEventListener("click", openPanel);
document.querySelector("#closeSetupButton").addEventListener("click", closePanel);
document.querySelector("#addExamButton").addEventListener("click", () => {
  if (exams.length >= 3) return;
  exams = readEditorDraft();
  exams.push(newExam(exams.length));
  renderEditors();
});
editors.addEventListener("click", event => {
  const removeButton = event.target.closest("[data-remove-exam]");
  if (removeButton && exams.length > 1) {
    const nextExams = readEditorDraft();
    nextExams.splice(Number(removeButton.dataset.removeExam), 1);
    exams = nextExams;
    renderEditors();
    return;
  }

  const saveButton = event.target.closest("[data-save-custom]");
  if (saveButton) {
    const index = Number(saveButton.dataset.saveCustom);
    const nextExams = readEditorDraft();
    const exam = nextExams[index];
    const valid = exam.name.trim() && Number.isFinite(exam.perusal) && Number.isFinite(exam.working)
      && Number.isFinite(exam.leaveAfterStart) && Number.isFinite(exam.noLeaveBeforeEnd);
    if (!valid) {
      document.querySelector("#sessionSaveStatus").textContent = "Complete this exam's timing fields before saving it as an option.";
      return;
    }

    const existingId = String(exam.presetId).startsWith("custom-") ? exam.presetId : null;
    const id = existingId || `custom-${Date.now()}`;
    const savedPreset = { ...exam, id, presetId: id, source: "Saved custom exam", sourceUrl: "" };
    const existingIndex = customPresets.findIndex(preset => preset.id === id);
    if (existingIndex === -1) customPresets.push(savedPreset);
    else customPresets[existingIndex] = savedPreset;
    nextExams[index] = savedPreset;
    exams = nextExams;
    const saved = persistCustomPresets();
    renderEditors();
    document.querySelector("#sessionSaveStatus").textContent = saved
      ? `“${exam.name}” saved as a reusable custom option.`
      : "Browser storage is unavailable; the custom option could not be saved.";
    return;
  }

  const deleteButton = event.target.closest("[data-delete-custom]");
  if (deleteButton) {
    const index = Number(deleteButton.dataset.deleteCustom);
    const nextExams = readEditorDraft();
    const id = nextExams[index].presetId;
    customPresets = customPresets.filter(preset => preset.id !== id);
    nextExams[index] = { ...nextExams[index], presetId: "manual", source: "", sourceUrl: "" };
    exams = nextExams;
    persistCustomPresets();
    renderEditors();
    document.querySelector("#sessionSaveStatus").textContent = "Saved custom option deleted; the current exam settings were retained.";
  }
});
editors.addEventListener("change", event => {
  const presetSelect = event.target.closest("[data-preset-index]");
  if (presetSelect) {
    const index = Number(presetSelect.dataset.presetIndex);
    const nextExams = readEditorDraft();
    const presetId = presetSelect.value;
    if (presetId === "manual") {
      nextExams[index] = { ...nextExams[index], presetId: "manual", source: "", sourceUrl: "" };
    } else {
      const preset = [...QCAA_PRESETS, ...customPresets].find(item => item.id === presetId);
      if (preset) {
        const current = nextExams[index];
        const selected = structuredClone(preset);
        ["perusal", "working", "leaveAfterStart", "noLeaveBeforeEnd"].forEach(field => {
          if (selected[field] == null) selected[field] = current[field];
        });
        nextExams[index] = { ...selected, presetId };
      }
    }
    exams = nextExams;
    renderEditors();
    return;
  }

  const policySelect = event.target.closest("[data-leaving-policy-index]");
  if (policySelect) {
    const index = Number(policySelect.dataset.leavingPolicyIndex);
    const nextExams = readEditorDraft();
    nextExams[index].leavingPolicy = policySelect.value;
    if (policySelect.value === "qcaa-ea-2025") {
      nextExams[index].leaveAfterStart = QCAA_EA_DIRECTIONS.firstMinutesFromScheduledStart;
      nextExams[index].noLeaveBeforeEnd = QCAA_EA_DIRECTIONS.finalMinutes;
      nextExams[index].eaScheduledStart ||= "09:00";
    }
    exams = nextExams;
    renderEditors();
  }
});
document.querySelector("#currentTimeButton").addEventListener("click", () => {
  const now = new Date();
  sessionDate = dateKey(now);
  document.querySelector("#sessionStart").value = inputTime(now);
  persistSession("Current browser time saved as the session start.");
  renderCards();
});
document.querySelector("#sessionStart").addEventListener("input", () => {
  sessionDate = dateKey(new Date());
  document.querySelector("#sessionSaveStatus").textContent = "Apply the session to save this start time.";
});
scrim.addEventListener("click", closePanel);
document.addEventListener("keydown", event => { if (event.key === "Escape" && panel.classList.contains("open")) closePanel(); });

document.querySelector("#fullscreenButton").addEventListener("click", async () => {
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  else await document.exitFullscreen();
});

document.querySelector("#resetButton").addEventListener("click", () => resetDialog.showModal());
document.querySelector("#cancelReset").addEventListener("click", () => resetDialog.close());
document.querySelector("#confirmReset").addEventListener("click", () => {
  exams = structuredClone(SAMPLE_EXAMS);
  sessionDate = dateKey(new Date());
  document.querySelector("#sessionStart").value = "09:00:00";
  renderEditors();
  renderCards();
  persistSession("Sample session restored and saved on this browser.");
  resetDialog.close();
});

function updateClock() {
  const now = new Date();
  document.querySelector("#clock").textContent = formatClock(now);
  document.querySelector("#date").textContent = formatDate(now);
  updateSessionState(now);
}

restoreSession();
renderEditors();
renderCards();
updateClock();
setInterval(updateClock, 1000);
