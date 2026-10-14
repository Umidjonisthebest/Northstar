import { useSearchParams } from "react-router-dom";
import { SectionHead, SubSwitch } from "../../studio/SectionKit.jsx";
import ContentList from "./ContentList.jsx";

// IELTS > Section practice (the admin's): the single listening parts, reading passages and writing
// tasks students work on one at a time in the hub's Section Practice. It is its own material:
// practice tests have their own parts (IELTS > Practice tests) and never draw from here, though a
// part can be copied from here into a test.

const KINDS = [
  ["listening", "Listening"],
  ["reading", "Reading"],
  ["writing", "Writing"]
];

export default function SectionPracticePage() {
  const [params, setParams] = useSearchParams();
  const asked = params.get("kind");
  const kind = KINDS.some(([k]) => k === asked) ? asked : "listening";

  return (
    <div className="ad-exam ielts">
      <SectionHead exam="ielts" title="Section practice">
        Single parts students practise one at a time: a listening part, a reading passage or a writing task. This material is separate from the practice tests, which have parts of their own.
      </SectionHead>
      <div style={{ marginBottom: 16 }}>
        <SubSwitch exam="ielts" options={KINDS} value={kind} onChange={(k) => setParams(k === "listening" ? {} : { kind: k }, { replace: true })} label="Which skill" />
      </div>
      <ContentList key={kind} kind={kind} scope="practice" />
    </div>
  );
}
