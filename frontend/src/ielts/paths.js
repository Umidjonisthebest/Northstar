import { studioPath } from "../studio/panels.js";

// Where the IELTS module lives in Northstar's router.
export const IELTS_HOME = "/ielts"; // candidate-ID login (exam-room computers)
export const IELTS_EXAM = "/ielts/exam";
export const IELTS_ADMIN = "/admin/ielts"; // the editors and previews: the admin panel only

// A link to an IELTS staff screen, in the panel the page is shown in (/admin or /teacher): the
// session screens are in both panels.
export const adminPath = (...parts) => [studioPath("/ielts"), ...parts].join("/");
