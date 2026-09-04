// QCAA's "2025 syllabus" is the syllabus family first implemented with
// students starting Units 1 and 2 in 2025 and completing in 2026 or later.
// These records use the current official versions available in September 2026.
const QCAA_PRESETS = [
  ...makeSubjectPresets({
    code: "general",
    subject: "General Mathematics",
    colour: "blue",
    version: "2025 v1.3 (January 2026)",
    sourceUrl: "https://www.qcaa.qld.edu.au/downloads/senior-qce/syllabuses/snr_maths_general_25_syll.pdf",
  }),
  ...makeSubjectPresets({
    code: "methods",
    subject: "Mathematical Methods",
    colour: "purple",
    version: "2025 v1.3 (January 2026)",
    sourceUrl: "https://www.qcaa.qld.edu.au/downloads/senior-qce/syllabuses/snr_maths_methods_25_syll.pdf",
  }),
  ...makeSubjectPresets({
    code: "specialist",
    subject: "Specialist Mathematics",
    colour: "teal",
    version: "2025 v1.4 (March 2026)",
    sourceUrl: "https://www.qcaa.qld.edu.au/downloads/senior-qce/syllabuses/snr_maths_specialist_25_syll.pdf",
  }),
];

const QCAA_EA_DIRECTIONS = {
  name: "Directions for students: External assessment (June 2025)",
  url: "https://www.qcaa.qld.edu.au/downloads/senior/snr_ea_directions_students.pdf",
  firstMinutesFromScheduledStart: 40,
  finalMinutes: 10,
};

function makeSubjectPresets(subject) {
  const source = `${subject.subject} ${subject.version}`;
  const common = {
    perusal: 5,
    working: 90,
    aara: 0,
    colour: subject.colour,
    source,
    sourceUrl: subject.sourceUrl,
  };

  return [
    {
      id: `qcaa-${subject.code}-fia`,
      name: `${subject.subject} — FIA (teacher-defined)`,
      type: "FIA",
      perusal: null,
      working: null,
      aara: 0,
      leaveAfterStart: null,
      noLeaveBeforeEnd: null,
      leavingPolicy: "teacher",
      colour: subject.colour,
      source: `${source}: Units 1–2 assessment conditions are school-developed`,
      sourceUrl: subject.sourceUrl,
    },
    {
      ...common,
      id: `qcaa-${subject.code}-ia2`,
      name: `${subject.subject} — IA2 examination`,
      type: "IA",
      leaveAfterStart: null,
      noLeaveBeforeEnd: null,
      leavingPolicy: "teacher",
    },
    {
      ...common,
      id: `qcaa-${subject.code}-ia3`,
      name: `${subject.subject} — IA3 examination`,
      type: "IA",
      leaveAfterStart: null,
      noLeaveBeforeEnd: null,
      leavingPolicy: "teacher",
    },
    {
      ...common,
      id: `qcaa-${subject.code}-ea1`,
      name: `${subject.subject} — EA Paper 1`,
      type: "EA",
      leaveAfterStart: 40,
      noLeaveBeforeEnd: 10,
      leavingPolicy: "qcaa-ea-2025",
      eaScheduledStart: "09:00",
    },
    {
      ...common,
      id: `qcaa-${subject.code}-ea2`,
      name: `${subject.subject} — EA Paper 2`,
      type: "EA",
      leaveAfterStart: 40,
      noLeaveBeforeEnd: 10,
      leavingPolicy: "qcaa-ea-2025",
      eaScheduledStart: "09:00",
    },
  ];
}
