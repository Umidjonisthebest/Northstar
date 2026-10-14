// Starter content for the Practice hub. Loaded into db.json the first time the
// server runs with an empty practice bank; later versions of the starter set
// are merged into existing databases by `key` (see syncStarterQuestions in
// app.js). Admins can edit everything from /admin/practice.
//
// Reading & Writing questions are hand-written (content/readingWriting.js);
// Math combines the original hand-written set (content/mathClassic.js) with
// seeded generators, one per official skill (content/mathGen.js). The
// Challenging tier is the owner's Northstar originals (content/challengingRW.js
// and content/challengingMath.js).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SKILLS } from "./practiceSkills.js";
import { RW_QUESTIONS } from "./content/readingWriting.js";
import { MATH_CLASSIC } from "./content/mathClassic.js";
import { buildMathStarter } from "./content/mathGen.js";
import { CHALLENGING_RW } from "./content/challengingRW.js";
import { CHALLENGING_MATH } from "./content/challengingMath.js";
import { BANK_ORIGINALS } from "./content/originals.js";

// College Board's digital-SAT reporting categories (domains) per section.
// `topic` on each question is the finer-grained skill within its `domain`.
export const DOMAINS = Object.fromEntries(Object.entries(SKILLS).map(([section, domains]) => [section, Object.keys(domains)]));

export const PRACTICE_QUESTIONS = [...RW_QUESTIONS, ...MATH_CLASSIC, ...buildMathStarter(), ...CHALLENGING_RW, ...CHALLENGING_MATH];

// A question pack (content/pack/questions.json and its pictures in content/pack/media/), if this
// checkout has one. **It has none since 2026-10-13**: the pack that was here, 1,657 College Board
// question-bank items added on 2026-10-08, was taken out at the owner's decision, and db.js drops
// its rows ("qb-…") from older databases. What is left is the loader and the support for picture
// questions (`promptImage`, `explanationImage`), which nothing in the bank uses now. A pack is
// synced into the database like the starter set, but is not held to its standard (no hints or
// steps), so it is kept out of PRACTICE_QUESTIONS.
const PACK_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "content", "pack");
export const PACK_MEDIA_DIR = path.join(PACK_DIR, "media");
// The database hands these same objects out with every read (see "slim" storage in db.js), so
// they are frozen: code that tried to change one in place fails loudly instead of quietly changing
// the question for everyone until the next restart.
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
function loadPack() {
  if (process.env.QUESTION_PACK === "off") return [];
  try {
    const list = JSON.parse(fs.readFileSync(path.join(PACK_DIR, "questions.json"), "utf-8"));
    return Array.isArray(list) ? deepFreeze(list) : [];
  } catch (e) {
    // No pack in this checkout is fine. A pack that is there but can't be read is worth a line in the log.
    if (e.code !== "ENOENT") console.error(`[content] content/pack/questions.json could not be read: ${e.message}`);
    return [];
  }
}
export const PACK_QUESTIONS = loadPack();

// The owner's own question bank (content/originals/*.json, converted by content/originals.js):
// original questions with explanations for every choice, but no hints or steps, so like the
// pack they sit beside PRACTICE_QUESTIONS, not in it. QUESTION_PACK=off doesn't touch them.
export { BANK_ORIGINALS };
// Everything that is synced by key but kept out of the database file (see "slim" storage in db.js).
export const SLIM_QUESTIONS = [...PACK_QUESTIONS, ...BANK_ORIGINALS];

export const VOCAB_WORDS = [
  { word: "tenuous", pronunciation: "/ˈten-yə-wəs/", partOfSpeech: "adj.", definition: "Very weak, slight, or unlikely to last.", example: "The connection between the two events was tenuous, not causal." },
  { word: "corroborate", pronunciation: "/kə-ˈrä-bə-ˌrāt/", partOfSpeech: "v.", definition: "To confirm or support a statement, theory, or finding.", example: "The second survey helped corroborate the original result." },
  { word: "mitigate", pronunciation: "/ˈmi-tə-ˌgāt/", partOfSpeech: "v.", definition: "To make something less severe, serious, or painful.", example: "Shade trees mitigate the heat around the building." },
  { word: "ambiguous", pronunciation: "/am-ˈbi-gyə-wəs/", partOfSpeech: "adj.", definition: "Open to more than one interpretation; unclear.", example: "The ambiguous wording made the author's claim hard to identify." },
  { word: "conventional", pronunciation: "/kən-ˈven-shə-nəl/", partOfSpeech: "adj.", definition: "Based on what is generally accepted or customary.", example: "The researcher challenged the conventional explanation." },
  { word: "cogent", pronunciation: "/ˈkō-jənt/", partOfSpeech: "adj.", definition: "Clear, logical, and convincing.", example: "She made a cogent case for extending the study." },
  { word: "undermine", pronunciation: "/ˌən-dər-ˈmīn/", partOfSpeech: "v.", definition: "To weaken gradually or secretly.", example: "The new data undermine the earlier conclusion." },
  { word: "pragmatic", pronunciation: "/prag-ˈma-tik/", partOfSpeech: "adj.", definition: "Dealing with things practically rather than theoretically.", example: "The mayor took a pragmatic approach to the budget." },
  { word: "meticulous", pronunciation: "/mə-ˈti-kyə-ləs/", partOfSpeech: "adj.", definition: "Showing great attention to detail; very careful.", example: "Her meticulous notes made the experiment easy to repeat." },
  { word: "ubiquitous", pronunciation: "/yü-ˈbi-kwə-təs/", partOfSpeech: "adj.", definition: "Present, appearing, or found everywhere.", example: "Smartphones have become ubiquitous in classrooms." },
  { word: "substantiate", pronunciation: "/səb-ˈstan-shē-ˌāt/", partOfSpeech: "v.", definition: "To provide evidence to support or prove.", example: "The author substantiates each claim with archival records." },
  { word: "candid", pronunciation: "/ˈkan-dəd/", partOfSpeech: "adj.", definition: "Truthful and straightforward; frank.", example: "In a candid interview, the coach admitted the team was tired." },
  { word: "disparate", pronunciation: "/ˈdis-p(ə-)rət/", partOfSpeech: "adj.", definition: "Essentially different in kind; not comparable.", example: "The study combined data from disparate sources." },
  { word: "novel", pronunciation: "/ˈnä-vəl/", partOfSpeech: "adj.", definition: "New or unusual in an interesting way.", example: "The team proposed a novel method for recycling plastic." },
  { word: "reconcile", pronunciation: "/ˈre-kən-ˌsī(-ə)l/", partOfSpeech: "v.", definition: "To make two ideas or facts compatible.", example: "Scientists struggled to reconcile the two sets of results." },
  { word: "scrutinize", pronunciation: "/ˈskrü-tə-ˌnīz/", partOfSpeech: "v.", definition: "To examine closely and thoroughly.", example: "Reviewers scrutinized the paper's methods." },
  { word: "advocate", pronunciation: "/ˈad-və-ˌkāt/", partOfSpeech: "v.", definition: "To publicly recommend or support.", example: "The author advocates for longer school lunches." },
  { word: "concede", pronunciation: "/kən-ˈsēd/", partOfSpeech: "v.", definition: "To admit something is true, often reluctantly.", example: "The critic conceded that the film's visuals were stunning." },
  { word: "elusive", pronunciation: "/ē-ˈlü-siv/", partOfSpeech: "adj.", definition: "Difficult to find, catch, or achieve.", example: "A cure for the common cold remains elusive." },
  { word: "empirical", pronunciation: "/im-ˈpir-i-kəl/", partOfSpeech: "adj.", definition: "Based on observation or experiment rather than theory.", example: "The claim lacks empirical support." },
  { word: "laud", pronunciation: "/lȯd/", partOfSpeech: "v.", definition: "To praise highly.", example: "Critics lauded the novel for its intricate plot." },
  { word: "disparage", pronunciation: "/di-ˈsper-ij/", partOfSpeech: "v.", definition: "To speak of in a slighting way; to belittle.", example: "He refused to disparage his rival's achievements." },
  { word: "esoteric", pronunciation: "/ˌe-sə-ˈter-ik/", partOfSpeech: "adj.", definition: "Understood by only a small number of people with specialized knowledge.", example: "The lecture was so esoteric that few students could follow it." },
  { word: "ephemeral", pronunciation: "/ə-ˈfem-ə-rəl/", partOfSpeech: "adj.", definition: "Lasting for a very short time.", example: "Fame in the industry can be ephemeral." },
  { word: "zealous", pronunciation: "/ˈze-ləs/", partOfSpeech: "adj.", definition: "Filled with great energy or enthusiasm for a cause.", example: "The zealous volunteers arrived before sunrise." },
  { word: "skeptical", pronunciation: "/ˈskep-ti-kəl/", partOfSpeech: "adj.", definition: "Not easily convinced; having doubts.", example: "The scientist remained skeptical until the data was replicated." },
  { word: "vindicate", pronunciation: "/ˈvin-də-ˌkāt/", partOfSpeech: "v.", definition: "To clear of blame or suspicion with proof.", example: "New evidence eventually vindicated the accused engineer." },
  { word: "exacerbate", pronunciation: "/ig-ˈza-sər-ˌbāt/", partOfSpeech: "v.", definition: "To make a problem or situation worse.", example: "Cutting the budget only exacerbated the staffing shortage." },
  { word: "ameliorate", pronunciation: "/ə-ˈmēl-yə-ˌrāt/", partOfSpeech: "v.", definition: "To make something better or more tolerable.", example: "New irrigation methods helped ameliorate the drought's effects." },
  { word: "prudent", pronunciation: "/ˈprü-dənt/", partOfSpeech: "adj.", definition: "Acting with care and thought for the future.", example: "A prudent investor diversifies across several markets." },
  { word: "arbitrary", pronunciation: "/ˈär-bə-ˌtrer-ē/", partOfSpeech: "adj.", definition: "Based on random choice rather than reason.", example: "The deadline seemed arbitrary and unrelated to the project's scope." },
  { word: "benevolent", pronunciation: "/bə-ˈne-və-lənt/", partOfSpeech: "adj.", definition: "Kind and generous.", example: "The benevolent donor funded the entire library renovation." },
  { word: "capricious", pronunciation: "/kə-ˈpri-shəs/", partOfSpeech: "adj.", definition: "Given to sudden, unpredictable changes.", example: "The committee's capricious rulings frustrated every applicant." },
  { word: "coherent", pronunciation: "/kō-ˈhir-ənt/", partOfSpeech: "adj.", definition: "Logical and consistent; easy to follow.", example: "Her coherent argument won over the skeptical judges." },
  { word: "complacent", pronunciation: "/kəm-ˈplā-sənt/", partOfSpeech: "adj.", definition: "Overly satisfied with oneself; unaware of danger.", example: "Early success made the team complacent about future competition." },
  { word: "contentious", pronunciation: "/kən-ˈten-shəs/", partOfSpeech: "adj.", definition: "Likely to cause disagreement.", example: "Redrawing the district lines became a contentious issue." },
  { word: "deference", pronunciation: "/ˈde-f(ə-)rəns/", partOfSpeech: "n.", definition: "Respectful submission to another's opinion.", example: "The junior staff showed deference to the retiring director." },
  { word: "diligent", pronunciation: "/ˈdi-lə-jənt/", partOfSpeech: "adj.", definition: "Showing careful, persistent effort.", example: "Diligent note-taking made the exam review painless." },
  { word: "discern", pronunciation: "/di-ˈzərn/", partOfSpeech: "v.", definition: "To perceive or recognize something clearly.", example: "It was hard to discern the pattern in the noisy data." },
  { word: "eloquent", pronunciation: "/ˈe-lə-kwənt/", partOfSpeech: "adj.", definition: "Fluent and persuasive in speaking or writing.", example: "The eloquent speech moved the entire audience." },
  { word: "enervate", pronunciation: "/ˈe-nər-ˌvāt/", partOfSpeech: "v.", definition: "To weaken or drain of energy.", example: "The relentless heat enervated the hikers by midday." },
  { word: "equivocal", pronunciation: "/i-ˈkwi-və-kəl/", partOfSpeech: "adj.", definition: "Open to more than one interpretation, often deliberately.", example: "The senator's equivocal answer satisfied no one." },
  { word: "fervent", pronunciation: "/ˈfər-vənt/", partOfSpeech: "adj.", definition: "Showing great warmth or intensity of feeling.", example: "She was a fervent supporter of the recycling initiative." },
  { word: "frugal", pronunciation: "/ˈfrü-gəl/", partOfSpeech: "adj.", definition: "Sparing or economical with resources.", example: "A frugal budget let the startup survive its first year." },
  { word: "hypothesis", pronunciation: "/hī-ˈpä-thə-səs/", partOfSpeech: "n.", definition: "A proposed explanation made on limited evidence.", example: "The researchers tested their hypothesis with a controlled trial." },
  { word: "impartial", pronunciation: "/im-ˈpär-shəl/", partOfSpeech: "adj.", definition: "Not favoring one side; fair and neutral.", example: "An impartial referee is essential to a fair match." },
  { word: "incessant", pronunciation: "/in-ˈse-sənt/", partOfSpeech: "adj.", definition: "Continuing without interruption.", example: "The incessant rain delayed construction for a week." },
  { word: "indifferent", pronunciation: "/in-ˈdi-f(ə-)rənt/", partOfSpeech: "adj.", definition: "Having no particular interest or concern.", example: "He remained indifferent to the outcome of the vote." },
  { word: "inevitable", pronunciation: "/i-ˈne-və-tə-bəl/", partOfSpeech: "adj.", definition: "Certain to happen; unavoidable.", example: "Given the trend, a price increase seemed inevitable." },
  { word: "integrity", pronunciation: "/in-ˈte-grə-tē/", partOfSpeech: "n.", definition: "The quality of being honest and having strong moral principles.", example: "The auditor's integrity made her reports trustworthy." },
  { word: "intricate", pronunciation: "/ˈin-tri-kət/", partOfSpeech: "adj.", definition: "Very complicated or detailed.", example: "The watch's intricate gears required a magnifying glass to repair." },
  { word: "lucid", pronunciation: "/ˈlü-səd/", partOfSpeech: "adj.", definition: "Clear and easy to understand.", example: "The professor gave a lucid explanation of the proof." },
  { word: "malleable", pronunciation: "/ˈma-lē-ə-bəl/", partOfSpeech: "adj.", definition: "Easily shaped or influenced.", example: "Gold is malleable enough to be hammered into thin sheets." },
  { word: "meager", pronunciation: "/ˈmē-gər/", partOfSpeech: "adj.", definition: "Lacking in quantity or quality; scanty.", example: "The expedition survived on meager rations for weeks." },
  { word: "nostalgia", pronunciation: "/nä-ˈstal-jə/", partOfSpeech: "n.", definition: "A sentimental longing for the past.", example: "The old photographs filled her with nostalgia." },
  { word: "notorious", pronunciation: "/nō-ˈtȯr-ē-əs/", partOfSpeech: "adj.", definition: "Famous for some bad quality or deed.", example: "The intersection is notorious for traffic accidents." },
  { word: "objective", pronunciation: "/əb-ˈjek-tiv/", partOfSpeech: "adj.", definition: "Based on facts rather than feelings or opinions.", example: "The report offered an objective account of the incident." },
  { word: "obscure", pronunciation: "/əb-ˈskyu̇r/", partOfSpeech: "adj.", definition: "Not well known; hard to understand.", example: "The footnote referenced an obscure 19th-century journal." },
  { word: "ominous", pronunciation: "/ˈä-mə-nəs/", partOfSpeech: "adj.", definition: "Suggesting that something bad is going to happen.", example: "Dark clouds gave the afternoon an ominous feel." },
  { word: "optimistic", pronunciation: "/ˌäp-tə-ˈmis-tik/", partOfSpeech: "adj.", definition: "Hopeful and confident about the future.", example: "The coach stayed optimistic despite the losing streak." },
  { word: "paradox", pronunciation: "/ˈper-ə-ˌdäks/", partOfSpeech: "n.", definition: "A statement that seems contradictory but may be true.", example: "It's a paradox that more choices can make deciding harder." },
  { word: "perpetual", pronunciation: "/pər-ˈpe-chə-wəl/", partOfSpeech: "adj.", definition: "Never ending or changing.", example: "The city's perpetual construction frustrated commuters." },
  { word: "plausible", pronunciation: "/ˈplȯ-zə-bəl/", partOfSpeech: "adj.", definition: "Seeming reasonable or probable.", example: "The detective offered a plausible explanation for the missing keys." },
  { word: "precarious", pronunciation: "/pri-ˈker-ē-əs/", partOfSpeech: "adj.", definition: "Not securely held or in a dangerous position.", example: "The ladder rested at a precarious angle against the wall." },
  { word: "prevalent", pronunciation: "/ˈpre-və-lənt/", partOfSpeech: "adj.", definition: "Widespread in a particular area or time.", example: "Remote work became prevalent after 2020." },
  { word: "prolific", pronunciation: "/prə-ˈli-fik/", partOfSpeech: "adj.", definition: "Producing much fruit, work, or offspring.", example: "The prolific author published a novel every year." },
  { word: "quixotic", pronunciation: "/kwik-ˈsä-tik/", partOfSpeech: "adj.", definition: "Extremely idealistic and impractical.", example: "His quixotic plan to sail solo around the world worried his family." },
  { word: "rational", pronunciation: "/ˈrash-nəl/", partOfSpeech: "adj.", definition: "Based on reason or logic.", example: "A rational approach weighs costs against benefits." },
  { word: "redundant", pronunciation: "/ri-ˈdən-dənt/", partOfSpeech: "adj.", definition: "Not needed; repetitive.", example: "The editor cut several redundant phrases from the essay." },
  { word: "reluctant", pronunciation: "/ri-ˈlək-tənt/", partOfSpeech: "adj.", definition: "Unwilling and hesitant.", example: "She was reluctant to volunteer for the extra shift." },
  { word: "resilient", pronunciation: "/ri-ˈzil-yənt/", partOfSpeech: "adj.", definition: "Able to recover quickly from difficulties.", example: "The resilient economy rebounded within two quarters." },
  { word: "reverence", pronunciation: "/ˈre-v(ə-)rəns/", partOfSpeech: "n.", definition: "Deep respect for someone or something.", example: "The students listened with reverence to the retired astronaut." },
  { word: "rigid", pronunciation: "/ˈri-jəd/", partOfSpeech: "adj.", definition: "Not able to bend or change; strict.", example: "The rigid schedule left no room for delays." },
  { word: "robust", pronunciation: "/rō-ˈbəst/", partOfSpeech: "adj.", definition: "Strong and healthy; vigorous.", example: "The new bridge design proved remarkably robust in testing." },
  { word: "solitary", pronunciation: "/ˈsä-lə-ˌter-ē/", partOfSpeech: "adj.", definition: "Existing or done alone.", example: "She preferred a solitary walk before sunrise." },
  { word: "spontaneous", pronunciation: "/spän-ˈtā-nē-əs/", partOfSpeech: "adj.", definition: "Done without planning, on impulse.", example: "The spontaneous road trip became their favorite memory." },
  { word: "stagnant", pronunciation: "/ˈstag-nənt/", partOfSpeech: "adj.", definition: "Not flowing or developing; inactive.", example: "Wages remained stagnant despite rising profits." },
  { word: "staunch", pronunciation: "/stȯnch/", partOfSpeech: "adj.", definition: "Loyal and committed, especially to a cause.", example: "She was a staunch defender of the public library's budget." },
  { word: "stringent", pronunciation: "/ˈstrin-jənt/", partOfSpeech: "adj.", definition: "Strict and precisely controlled.", example: "New stringent safety codes followed the accident." },
  { word: "subtle", pronunciation: "/ˈsə-təl/", partOfSpeech: "adj.", definition: "So delicate as to be difficult to notice or analyze.", example: "A subtle shift in tone changed the meaning of the sentence." },
  { word: "superficial", pronunciation: "/ˌsü-pər-ˈfi-shəl/", partOfSpeech: "adj.", definition: "Existing only on the surface; not thorough.", example: "The report offered only a superficial analysis of the data." },
  { word: "tedious", pronunciation: "/ˈtē-dē-əs/", partOfSpeech: "adj.", definition: "Tiresomely long or dull.", example: "Filing the paperwork was a tedious but necessary task." },
  { word: "thrive", pronunciation: "/thrīv/", partOfSpeech: "v.", definition: "To grow or develop successfully.", example: "The garden thrived once it received more sunlight." },
  { word: "transient", pronunciation: "/ˈtran-zhənt/", partOfSpeech: "adj.", definition: "Lasting only for a short time; passing through.", example: "The village saw a transient population of seasonal workers." },
  { word: "trivial", pronunciation: "/ˈtri-vē-əl/", partOfSpeech: "adj.", definition: "Of little value or importance.", example: "They argued over a trivial detail in the contract." },
  { word: "unprecedented", pronunciation: "/ˌən-ˈpre-sə-ˌden-təd/", partOfSpeech: "adj.", definition: "Never done or known before.", example: "The company reported unprecedented growth this quarter." },
  { word: "vigilant", pronunciation: "/ˈvi-jə-lənt/", partOfSpeech: "adj.", definition: "Keeping careful watch for danger or trouble.", example: "Lifeguards stayed vigilant as the beach grew crowded." },
  { word: "viable", pronunciation: "/ˈvī-ə-bəl/", partOfSpeech: "adj.", definition: "Capable of working successfully; feasible.", example: "The engineers proposed a viable alternative to the original design." },
  { word: "volatile", pronunciation: "/ˈvä-lə-təl/", partOfSpeech: "adj.", definition: "Likely to change rapidly and unpredictably.", example: "Investors braced for a volatile trading session." },
  { word: "whimsical", pronunciation: "/ˈ(h)wim-zi-kəl/", partOfSpeech: "adj.", definition: "Playfully quaint or fanciful.", example: "The children's book was full of whimsical illustrations." },
  { word: "zealot", pronunciation: "/ˈze-lət/", partOfSpeech: "n.", definition: "A person who is fanatical about a cause.", example: "The reform attracted both supporters and zealots on either side." },
  { word: "austere", pronunciation: "/ȯ-ˈstir/", partOfSpeech: "adj.", definition: "Severe or strict in manner; plain and simple.", example: "The monastery's austere rooms held only a bed and a desk." },
  { word: "banal", pronunciation: "/bə-ˈnal/", partOfSpeech: "adj.", definition: "Lacking originality; boring.", example: "Critics dismissed the sequel's plot as banal." },
  { word: "debunk", pronunciation: "/dē-ˈbəŋk/", partOfSpeech: "v.", definition: "To expose the falseness of a belief or claim.", example: "The documentary set out to debunk the popular myth." },
  { word: "deride", pronunciation: "/di-ˈrīd/", partOfSpeech: "v.", definition: "To express contempt for; ridicule.", example: "Early reviewers derided the invention as impractical." },
  { word: "digress", pronunciation: "/dī-ˈgres/", partOfSpeech: "v.", definition: "To turn aside from the main subject temporarily.", example: "The professor digressed into an anecdote about her own thesis." },
  { word: "dubious", pronunciation: "/ˈdü-bē-əs/", partOfSpeech: "adj.", definition: "Hesitating or doubting; of questionable value.", example: "The claim rested on dubious statistics." },
  { word: "enigma", pronunciation: "/i-ˈnig-mə/", partOfSpeech: "n.", definition: "Something or someone mysterious or hard to understand.", example: "The author's true identity remains an enigma." },
  { word: "feasible", pronunciation: "/ˈfē-zə-bəl/", partOfSpeech: "adj.", definition: "Possible to do easily or conveniently.", example: "A feasible plan accounts for the available budget." },
  { word: "galvanize", pronunciation: "/ˈgal-və-ˌnīz/", partOfSpeech: "v.", definition: "To shock or excite into sudden action.", example: "The speech galvanized the crowd into signing up." },
  { word: "hinder", pronunciation: "/ˈhin-dər/", partOfSpeech: "v.", definition: "To create difficulty for; obstruct.", example: "Heavy fog hindered the search-and-rescue effort." },
  { word: "impetuous", pronunciation: "/im-ˈpe-chə-wəs/", partOfSpeech: "adj.", definition: "Acting quickly without thought.", example: "His impetuous decision to quit surprised his coworkers." },
  { word: "innate", pronunciation: "/i-ˈnāt/", partOfSpeech: "adj.", definition: "Existing from birth; inborn.", example: "She showed an innate talent for languages." },
  { word: "juxtapose", pronunciation: "/ˈjək-stə-ˌpōz/", partOfSpeech: "v.", definition: "To place side by side for contrasting effect.", example: "The exhibit juxtaposes photographs from a century apart." },
  { word: "lament", pronunciation: "/lə-ˈment/", partOfSpeech: "v.", definition: "To express sorrow or regret about.", example: "Residents lamented the closing of the old theater." }
];

// Starter words close enough in meaning that one must never be offered as a wrong choice for
// another: in "The engineers proposed a ___ alternative", "feasible" is as right as "viable".
// vocabPractice.js adds the pairs it can tell from the definitions themselves, which is all a
// teacher's own words get; a new starter word with a near-synonym in the deck belongs here.
export const VOCAB_NEAR = [
  ["viable", "feasible", "plausible"],
  ["ephemeral", "transient"],
  ["incessant", "perpetual"],
  ["ambiguous", "equivocal", "obscure", "enigma"],
  ["cogent", "coherent", "lucid", "rational", "eloquent"],
  ["zealous", "fervent", "staunch", "zealot"],
  ["rigid", "stringent", "austere"],
  ["disparage", "deride"],
  ["undermine", "enervate", "hinder", "exacerbate"],
  ["mitigate", "ameliorate"],
  ["prevalent", "ubiquitous"],
  ["corroborate", "substantiate", "vindicate"],
  ["meticulous", "diligent", "vigilant", "prudent"],
  ["novel", "unprecedented"],
  ["skeptical", "dubious", "reluctant"],
  ["capricious", "volatile", "whimsical", "impetuous", "spontaneous", "arbitrary"],
  ["banal", "tedious", "trivial", "superficial", "redundant", "meager"],
  ["candid", "objective", "impartial"],
  ["deference", "reverence"],
  ["laud", "advocate"],
  ["prudent", "frugal", "pragmatic"],
  ["complacent", "indifferent"],
  ["intricate", "subtle", "esoteric"],
  ["resilient", "robust"],
  ["scrutinize", "discern"],
  ["enigma", "paradox"]
];

// Official 2026–27 SAT dates (College Board; verify before registering).
export const SAT_DATES = [
  { iso: "2026-10-03T08:00:00+05:00", label: "October 3, 2026", lateDeadline: "2026-09-22" },
  { iso: "2026-11-07T08:00:00+05:00", label: "November 7, 2026", lateDeadline: "2026-10-27" },
  { iso: "2026-12-05T08:00:00+05:00", label: "December 5, 2026", lateDeadline: "2026-11-24" },
  { iso: "2027-03-06T08:00:00+05:00", label: "March 6, 2027", lateDeadline: "2027-02-23" },
  { iso: "2027-05-01T08:00:00+05:00", label: "May 1, 2027", lateDeadline: "2027-04-20" },
  { iso: "2027-06-05T08:00:00+05:00", label: "June 5, 2027", lateDeadline: "2027-05-25" }
];
