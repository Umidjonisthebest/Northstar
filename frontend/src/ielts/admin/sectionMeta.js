import { BookOpen, Headphones, Mic, PenLine } from "lucide-react";

export const SECTION_META = {
  reading: { label: "Reading", icon: BookOpen },
  listening: { label: "Listening", icon: Headphones },
  writing: { label: "Writing", icon: PenLine },
  speaking: { label: "Speaking", icon: Mic }
};

// Chart colours. Reading / listening / writing match the student hub's IELTS skill colours
// (shell.css `.ns-ip-card`, and the `--ie-skill-*` tokens in styles/base.css); overall and the
// average/best bars use the Northstar brand blue. Charts need literal colours, not var().
export const SECTION_COLORS = {
  reading: "#d9468f",
  listening: "#1c9ff0",
  writing: "#7c4dff",
  overall: "#1664e2"
};

export const BAR_COLORS = { average: "#96b9f2", best: "#1664e2" };
