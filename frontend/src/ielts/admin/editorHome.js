import { useSearchParams } from "react-router-dom";
import { adminPath } from "../paths.js";

// IELTS material is one of three things, each kept where it is used:
//   a part of a practice test   made and changed from the test's page (IELTS > Practice tests)
//   section practice            IELTS > Section practice
//   mock material               IELTS > Practice tests > Teacher mocks
// The Listening, Reading and Writing editors serve all three. These helpers tell an editor which
// one it was opened for, and where to go back to.

// What the address says: ?test=<id> (opened from a practice test's page), ?part=<n> (the slot to
// start on) and, for a new record made from a list, ?use=practice | mock.
export function useEditorHome() {
  const [params] = useSearchParams();
  const use = params.get("use");
  return {
    testId: params.get("test") || null,
    part: Number(params.get("part")) || null,
    use: use === "practice" || use === "mock" ? use : null
  };
}

// The list (or test) a record belongs on.
export function contentHome(kind, { testId, use } = {}) {
  if (testId) return adminPath("tests", testId);
  if (use === "practice" || use === "both") return `${adminPath("practice")}?kind=${kind}`;
  return `${adminPath("tests")}?tab=mocks&view=${kind}`;
}

// The link that opens an editor for a practice test's part: an existing part, or a new one in
// slot `number`. With parts already in the section, the editor is opened on one of them so it
// loads them all together.
export function testPartEditor(kind, testId, { partId = null, number = null } = {}) {
  const query = `?test=${encodeURIComponent(testId)}${number ? `&part=${number}` : ""}`;
  return partId ? `${adminPath(kind, partId, "edit")}${query}` : `${adminPath(kind, "new")}${query}`;
}
