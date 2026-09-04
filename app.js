const SAMPLE_EXAMS = [
  { name: "Sample Mathematics — Paper 1", type: "EA sample", perusal: 5, working: 90, aara: 5 },
  { name: "Sample English — Written response", type: "IA sample", perusal: 10, working: 120, aara: 0 },
  { name: "Custom Year 11 Science", type: "Custom sample", perusal: 10, working: 100, aara: 10 },
];

let exams = structuredClone(SAMPLE_EXAMS);

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
  return new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function getBaseDate() {
  const [hour, minute] = document.querySelector("#sessionStart").value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return [hours ? `${hours} hr${hours === 1 ? "" : "s"}` : "", mins ? `${mins} min` : ""].filter(Boolean).join(" ");
}

function renderCards() {
  const start = getBaseDate();
  examGrid.innerHTML = exams.map((exam, index) => {
    const workingStart = exam.perusal;
    const finish = workingStart + exam.working;
    const warning = Math.max(workingStart, finish - 10);
    const extra = Math.round((exam.working / 30) * exam.aara);
    return `
      <article class="exam-card ${index === 0 ? "current" : ""}">
        <header class="exam-header">
          <span class="exam-number">EXAM ${index + 1} · ${exam.type.toUpperCase()}</span>
          <h3>${escapeHtml(exam.name)}</h3>
          <p>${exam.perusal ? `${exam.perusal} min perusal / planning` : "No perusal / planning"} · ${durationLabel(exam.working)} working</p>
        </header>
        <div class="phase">
          <span class="phase-label">WORKING</span>
          <strong>${index === 0 ? "1:17:42" : index === 1 ? "1:47:42" : "1:27:42"}</strong>
          <small>remaining</small>
        </div>
        <div class="timeline">
          <div class="timeline-row"><span>${exam.perusal ? "Perusal / planning" : "Exam begins"}</span><strong>${timeFromMinutes(start, 0)}</strong></div>
          <div class="timeline-row"><span>Working starts</span><strong>${timeFromMinutes(start, workingStart)}</strong></div>
          <div class="timeline-row warning"><span>10-minute warning</span><strong>${timeFromMinutes(start, warning)}</strong></div>
          <div class="timeline-row finish"><span>Working finishes</span><strong>${timeFromMinutes(start, finish)}</strong></div>
        </div>
        ${exam.aara ? `<div class="aara">AARA +${exam.aara}/30 finish <strong>${timeFromMinutes(start, finish + extra)}</strong></div>` : ""}
      </article>`;
  }).join("");

  const first = exams[0];
  document.querySelector("#nextEvent").textContent = `10-minute warning at ${timeFromMinutes(start, first.perusal + first.working - 10)}`;
}

function renderEditors() {
  editors.innerHTML = exams.map((exam, index) => `
    <section class="editor">
      <h3>Exam ${index + 1}</h3>
      <div class="editor-grid">
        <label class="wide">Display name<input name="name-${index}" value="${escapeHtml(exam.name)}" required /></label>
        <label>Category
          <select name="type-${index}">
            ${["Custom sample", "FIA sample", "IA sample", "EA sample"].map(type => `<option ${type === exam.type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
        <label>Perusal / planning (min)<input name="perusal-${index}" type="number" min="0" max="120" value="${exam.perusal}" required /></label>
        <label>Working time (min)<input name="working-${index}" type="number" min="1" max="600" value="${exam.working}" required /></label>
        <label>AARA extra time
          <select name="aara-${index}">
            <option value="0" ${exam.aara === 0 ? "selected" : ""}>None</option>
            <option value="5" ${exam.aara === 5 ? "selected" : ""}>5 min per 30</option>
            <option value="10" ${exam.aara === 10 ? "selected" : ""}>10 min per 30</option>
          </select>
        </label>
      </div>
    </section>`).join("");
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
  const data = new FormData(form);
  exams = exams.map((_, index) => ({
    name: data.get(`name-${index}`),
    type: data.get(`type-${index}`),
    perusal: Number(data.get(`perusal-${index}`)),
    working: Number(data.get(`working-${index}`)),
    aara: Number(data.get(`aara-${index}`)),
  }));
  renderCards();
  closePanel();
});

document.querySelector("#setupButton").addEventListener("click", openPanel);
document.querySelector("#closeSetupButton").addEventListener("click", closePanel);
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
  document.querySelector("#sessionStart").value = "09:00";
  renderEditors();
  renderCards();
  resetDialog.close();
});

function updateClock() {
  const now = new Date();
  document.querySelector("#clock").textContent = formatClock(now);
  document.querySelector("#date").textContent = formatDate(now);
}

renderEditors();
renderCards();
updateClock();
setInterval(updateClock, 1000);
