// The Challenging tier, Reading & Writing: the 20 Northstar originals from the
// owner's question pack (NS-E-001 … NS-E-020; each `key` is that id in lower
// case). Two per skill, written in digital-SAT format on the question types
// that are hardest on the real test. The passages, people, studies and places
// are invented for practice.
//
// The rest of that pack (its Easy, Medium and Hard files) is College Board
// question-bank material and is deliberately not in this repo.
//
// Same shape as readingWriting.js, plus `underline` for a question about an
// underlined part of the passage. Options are written in the pack's order and
// then balanced over A–D, so the letters here can differ from the pack's key.

import { balanceAnswers } from "./readingWriting.js";

const RW = "Reading & Writing";
const II = "Information and Ideas";
const CS = "Craft and Structure";
const EI = "Expression of Ideas";
const SEC = "Standard English Conventions";

const COMPLETE = "Which choice completes the text so that it conforms to the conventions of Standard English?";
const LOGICAL = "Which choice completes the text with the most logical and precise word or phrase?";
const TRANSITION = "Which choice completes the text with the most logical transition?";
const MAIN_IDEA = "Which choice best states the main idea of the text?";
const COMPLETES_LOGICALLY = "Which choice most logically completes the text?";

function q(domain, topic, key, fields) {
  return { key, section: RW, domain, topic, difficulty: "Challenging", type: "mcq", ...fields };
}

// [start, end) of `part` inside `text`: the `underline` field of a question about an underlined part.
const span = (text, part) => [text.indexOf(part), text.indexOf(part) + part.length];
const TELEGRAPH =
  "Many accounts of the telegraph emphasize its speed. Yet for the merchants who first adopted it, speed mattered less than certainty. A letter might arrive in ten days or in thirty; a telegram, though costly, arrived when it was said to arrive, and contracts could be written around that fact.";

const RAW_QUESTIONS = [
  // =====================================================================
  // Information and Ideas
  // =====================================================================
  q(II, "Central Ideas and Details", "ns-e-001", {
    title: "The clockmaker's workshop",
    passage:
      "The following text is from an original short story. Ilse has returned to the workshop where her late aunt repaired clocks.\n\nThe bench was as she had left it, which is to say as her aunt had left it: loupe, tweezers, a saucer of screws sorted by a logic Ilse had never been taught. She had expected the room to accuse her of something—of the years she had stayed away, perhaps. Instead it merely continued. A mantel clock on the shelf, gutted and waiting, seemed less a reproach than an invitation that did not much care whether it was accepted.",
    prompt: MAIN_IDEA,
    options: [
      "Ilse finds that the workshop meets her with indifference instead of the blame she had expected.",
      "Ilse decides to finish the clock repair that her aunt was unable to complete.",
      "Ilse regrets that she never learned her aunt's method for organizing tools.",
      "Ilse discovers that the workshop has fallen into disorder since her aunt's death."
    ],
    correctIndex: 0,
    explanation:
      "Ilse expected the room to \"accuse her,\" but \"instead it merely continued,\" and the waiting clock is an invitation that \"did not much care\" whether she accepted. The text turns on that reversal: indifference where she expected blame.",
    rationales: [
      "Correct. Ilse expected the room to accuse her; instead it \"merely continued,\" and even the clock is an invitation that doesn't care whether she accepts.",
      "This goes too far. The gutted clock is described as an invitation, but nothing says Ilse accepts it or decides to finish the repair.",
      "The screws sorted \"by a logic Ilse had never been taught\" are a passing detail, and the text never says she regrets it.",
      "This contradicts the text: the bench was \"as she had left it,\" with the screws still sorted."
    ],
    steps: [
      { title: "Find what Ilse expected", body: "She thought the room would blame her for the years she stayed away.", quote: "She had expected the room to accuse her of something" },
      { title: "Find what she met instead", body: "The room \"merely continued,\" and the clock is \"less a reproach than an invitation that did not much care.\"", quote: "Instead it merely continued." },
      { title: "Match the reversal", body: "Expected blame, found indifference. Only {A} states both halves." }
    ],
    keyQuote: "Instead it merely continued.",
    hint: "Look for the sentence that begins with \"Instead.\" What did Ilse expect, and what did she find?"
  }),
  q(II, "Central Ideas and Details", "ns-e-002", {
    title: "Hiding in the coral",
    passage:
      "Marine biologists have long assumed that fish of one small reef species spend the day hidden inside branching coral mainly to avoid predators. A team led by biologist Mara Oduya observed the fish on a section of reef where their predators had been absent for a year. The fish spent just as much of the day inside the coral as before, although at dusk they swam farther from it. Oduya's team proposes that the daytime hiding may have less to do with predators than with strong midday currents, which the coral blocks.",
    prompt: "According to the text, what did the observations on the predator-free section of reef show?",
    options: [
      "The fish spent less of the day inside the coral and swam farther from it at dusk.",
      "The fish spent more of the day inside the coral as the midday currents grew weaker.",
      "The fish spent about as much of the day inside the coral but swam farther from it at dusk.",
      "The fish left the coral during the day because it no longer blocked the currents."
    ],
    correctIndex: 2,
    explanation:
      "The text reports two results: the fish \"spent just as much of the day inside the coral as before, although at dusk they swam farther from it.\" Choice {C} restates both.",
    rationales: [
      "Half right. The fish did swim farther at dusk, but they spent just as much of the day inside the coral, not less.",
      "The text reports no increase in hiding and no change in the currents. This blends the observation with the team's later explanation.",
      "Correct. Daytime hiding stayed the same (\"just as much ... as before\"), and at dusk the fish swam farther from the coral.",
      "The fish kept hiding during the day. The currents belong to the team's proposed explanation, not to what was observed."
    ],
    steps: [
      { title: "Find the observation", body: "The question asks what the observations showed, so look for the sentence that reports results, not the one that explains them.", quote: "The fish spent just as much of the day inside the coral as before, although at dusk they swam farther from it." },
      { title: "Split it into two facts", body: "Daytime: no change. Dusk: farther from the coral." },
      { title: "Check each choice against both facts", body: "{A} gets the daytime fact wrong. {B} and {D} bring in the currents, which are the team's explanation. {C} matches both." }
    ],
    keyQuote: "The fish spent just as much of the day inside the coral as before, although at dusk they swam farther from it.",
    hint: "Separate what the team saw from what the team later proposed. The question asks only about what they saw."
  }),
  q(II, "Command of Evidence", "ns-e-003", {
    title: "How children learn \"went\"",
    passage:
      "Linguist Tomas Verhey hypothesizes that young children learn irregular past-tense verbs, such as \"went\" and \"broke,\" one by one through repeated exposure, not by applying a general rule. To test this idea, Verhey tracked the speech of 60 children over two years and counted how often each child heard particular verbs at home.",
    prompt: "Which finding, if true, would most directly support Verhey's hypothesis?",
    options: [
      "Children who heard more speech overall produced more regular past-tense forms correctly.",
      "Children correctly produced the irregular forms of verbs they heard often well before the irregular forms of verbs they heard rarely.",
      "Children added the regular ending \"-ed\" to made-up verbs that they had never heard before.",
      "Children began producing irregular forms correctly at about the same age for common verbs and rare verbs."
    ],
    correctIndex: 1,
    explanation:
      "If irregular forms are learned one at a time through exposure, the forms a child hears most should be mastered first. Choice {B} reports exactly that pattern.",
    rationales: [
      "This is about regular past-tense forms and overall speech. The hypothesis concerns irregular verbs and how often each one is heard.",
      "Correct. If each irregular form is learned through repeated exposure, often-heard verbs should be mastered before rarely heard ones.",
      "Adding \"-ed\" to made-up verbs shows children applying a general rule, which is the alternative Verhey rejects.",
      "If common and rare verbs were mastered at the same age, exposure would seem not to matter. That would weaken the hypothesis."
    ],
    steps: [
      { title: "Restate the hypothesis", body: "Irregular past-tense forms are learned one by one, through hearing them often, not through a rule.", quote: "one by one through repeated exposure, not by applying a general rule" },
      { title: "Predict the evidence", body: "If exposure drives learning, verbs heard more often should be learned sooner." },
      { title: "Test the choices", body: "{B} shows that pattern. {A} is about regular verbs, {C} shows rule use, and {D} shows exposure making no difference." }
    ],
    keyQuote: "one by one through repeated exposure, not by applying a general rule",
    hint: "If hearing a verb often is what teaches it, which verbs should children get right first?"
  }),
  q(II, "Command of Evidence", "ns-e-004", {
    title: "Cold storage and germination",
    passage:
      "Botanist Renata Solís studied whether storing the seeds of a prairie grass in the cold before planting improves germination. She claims that how much cold storage helps depends on the temperature at which the seeds are later germinated.",
    table: {
      title: "Percent of Seeds That Germinated, by Weeks of Cold Storage and Germination Temperature",
      columns: ["Weeks of cold storage", "At 15°C", "At 25°C"],
      rows: [
        ["0", "12%", "14%"],
        ["4", "31%", "22%"],
        ["8", "58%", "27%"],
        ["12", "61%", "26%"]
      ]
    },
    prompt: "Which choice most effectively uses data from the table to support Solís's claim?",
    options: [
      "At 15°C, the germination rate rose from 12% with no cold storage to 61% after 12 weeks of cold storage.",
      "At 25°C, the germination rate was 27% after 8 weeks of cold storage and 26% after 12 weeks.",
      "With no cold storage, the germination rate was 14% at 25°C, slightly higher than the rate at 15°C.",
      "After 8 weeks of cold storage, 58% of seeds germinated at 15°C but only 27% at 25°C, although the rates with no cold storage were nearly the same."
    ],
    correctIndex: 3,
    explanation:
      "The claim is about an interaction: the benefit of cold storage depends on germination temperature. Supporting it takes a comparison of both temperatures with and without storage, which only choice {D} gives.",
    rationales: [
      "Accurate, but it covers only 15°C. It shows that cold storage helps there, not that the benefit differs by temperature.",
      "Accurate, but it compares two storage times at one temperature and says nothing about 15°C.",
      "Accurate, but it describes seeds with no cold storage, so it can't show how much storage helps.",
      "Correct. With no storage the rates are nearly equal (12% and 14%); after 8 weeks they are 58% and 27%. The benefit depends on temperature."
    ],
    steps: [
      { title: "Pin down the claim", body: "Not just \"cold storage helps\" but \"how much it helps depends on the germination temperature.\"", quote: "how much cold storage helps depends on the temperature at which the seeds are later germinated" },
      { title: "Decide what evidence that needs", body: "A comparison of both temperatures, before and after cold storage." },
      { title: "Check the table", body: "0 weeks: 12% and 14%, nearly the same. 8 weeks: 58% and 27%, far apart. Only {D} uses all four values." }
    ],
    keyQuote: "how much cold storage helps depends on the temperature at which the seeds are later germinated",
    hint: "A claim that one thing \"depends on\" another needs data from both temperatures, not just one."
  }),
  q(II, "Inferences", "ns-e-005", {
    title: "Fish bones by the shore",
    passage:
      "Archaeologists studying a coastal settlement found that the fish bones in its oldest layers come almost entirely from species that live in shallow water near the shore. Later layers contain many bones from deep-water species. No change in local sea conditions is recorded for the period, and the deep-water species cannot be caught from shore. The archaeologists therefore conclude that ______",
    prompt: COMPLETES_LOGICALLY,
    options: [
      "the shallow-water species died out near the settlement over time.",
      "the settlement's inhabitants began fishing from boats at some point during its occupation.",
      "the settlement's population declined between the earlier and later periods.",
      "the settlement's inhabitants started trading fish with communities farther inland."
    ],
    correctIndex: 1,
    explanation:
      "The text rules out a change in the sea and says deep-water fish can't be caught from shore, so the inhabitants must have started fishing offshore.",
    rationales: [
      "Later layers contain \"many\" deep-water bones, not only deep-water bones, and nothing says the shallow-water species disappeared.",
      "Correct. Sea conditions didn't change and deep-water fish can't be caught from shore, so people must have begun fishing from boats.",
      "Population size is never mentioned, and a smaller population wouldn't explain the new deep-water species.",
      "Trade with inland communities is never mentioned and wouldn't bring deep-water fish to the settlement."
    ],
    steps: [
      { title: "List what changed", body: "Oldest layers: shallow-water fish. Later layers: many deep-water fish.", quote: "Later layers contain many bones from deep-water species." },
      { title: "Note what the text rules out", body: "The sea didn't change, and deep-water fish can't be caught from shore.", quote: "the deep-water species cannot be caught from shore" },
      { title: "Draw the conclusion", body: "The only explanation left is that people went out onto the water: {B}." }
    ],
    keyQuote: "the deep-water species cannot be caught from shore",
    hint: "Two explanations are ruled out in the sentence before the blank. What is left?"
  }),
  q(II, "Inferences", "ns-e-006", {
    title: "Bike-share rides that stayed short",
    passage:
      "Economists studying a city's bike-share program noted that after stations were added in outlying neighborhoods, the total number of rides rose by 18 percent, yet the average length of a ride barely changed. If the new stations had mainly attracted commuters traveling from the outlying neighborhoods to the city center, the average ride would have become much longer. The pattern therefore suggests that ______",
    prompt: COMPLETES_LOGICALLY,
    options: [
      "commuters from outlying neighborhoods rode to the city center more often than the economists expected.",
      "the new stations reduced the number of rides that began in the city center.",
      "many of the additional rides were trips within the outlying neighborhoods that were no longer than a typical ride.",
      "the bike-share program became less popular among riders in the city center."
    ],
    correctIndex: 2,
    explanation:
      "More rides but no longer rides means the new rides were about as long as the old ones. Local trips within the outlying neighborhoods fit; long commutes to the center don't.",
    rationales: [
      "This is the outcome the text says did not happen: such commutes would have made the average ride much longer.",
      "Total rides rose by 18 percent, and the text gives no information about where the earlier rides began.",
      "Correct. Rides increased while the average length barely changed, so the added rides were about as long as a typical ride, which fits trips within the outlying neighborhoods.",
      "Nothing in the text is about the program's popularity among city-center riders."
    ],
    steps: [
      { title: "State the two results", body: "Rides rose 18 percent. Average ride length barely changed.", quote: "the average length of a ride barely changed" },
      { title: "Use the if-then sentence", body: "If the new riders were commuting to the center, the average would be much longer. It isn't, so that isn't what happened." },
      { title: "Complete the logic", body: "The new rides must be about as long as the old ones: {C}." }
    ],
    keyQuote: "the average ride would have become much longer",
    hint: "The text tells you what would have happened if the new riders were long-distance commuters. Did it happen?"
  }),

  // =====================================================================
  // Craft and Structure
  // =====================================================================
  q(CS, "Words in Context", "ns-e-007", {
    title: "A qualified endorsement",
    passage:
      "The committee's endorsement of the proposal was far from ______: although members praised the plan's ambition, their report also listed a dozen unresolved technical problems and questioned whether the budget was realistic.",
    prompt: LOGICAL,
    options: ["tentative", "unreserved", "grudging", "equivocal"],
    correctIndex: 1,
    explanation:
      "The report mixes praise with serious doubts, so the endorsement was not wholehearted. \"Far from unreserved\" says exactly that.",
    rationales: [
      "\"Far from tentative\" would mean the endorsement was confident, which the dozen unresolved problems contradict.",
      "Correct. \"Unreserved\" means without reservations. An endorsement that comes with a list of problems is far from that.",
      "\"Far from grudging\" would mean the endorsement was given gladly. The doubts about the budget say otherwise.",
      "\"Far from equivocal\" would mean the endorsement was clear and one-sided. It was mixed."
    ],
    steps: [
      { title: "Read past the colon", body: "The members praised the ambition but listed a dozen problems and doubted the budget. The endorsement was mixed.", quote: "their report also listed a dozen unresolved technical problems" },
      { title: "Account for \"far from\"", body: "The blank is negated. You need a word that means the opposite of mixed, so that \"far from ______\" comes out as mixed." },
      { title: "Test each word with \"far from\"", body: "Far from unreserved = with reservations. That fits. The other three would describe a confident, wholehearted endorsement." }
    ],
    keyQuote: "although members praised the plan's ambition, their report also listed a dozen unresolved technical problems",
    hint: "\"Far from\" flips the meaning. Pick the word that describes what the endorsement was not."
  }),
  q(CS, "Words in Context", "ns-e-008", {
    title: "Debts in several currencies",
    passage:
      "In her study of medieval trade ledgers, historian Aiko Brandt argues that the merchants' habit of recording debts in several currencies was not carelessness but a ______ strategy: by never fixing an exchange rate on paper, they kept the freedom to settle each account in whichever currency later proved most favorable.",
    prompt: LOGICAL,
    options: ["haphazard", "transparent", "futile", "calculated"],
    correctIndex: 3,
    explanation:
      "The sentence sets \"carelessness\" against a strategy with a deliberate purpose, which the part after the colon explains. \"Calculated\" means carefully planned.",
    rationales: [
      "\"Haphazard\" means careless, so it can't be the contrast to \"carelessness.\"",
      "Leaving the exchange rate off the page makes the accounts less clear, not more.",
      "The sentence describes a real benefit, so the strategy wasn't futile.",
      "Correct. \"Calculated\" means deliberately planned, the opposite of carelessness, and the part after the colon shows the plan."
    ],
    steps: [
      { title: "Find the contrast", body: "\"Not carelessness but a ______ strategy\": the blank is the opposite of careless.", quote: "was not carelessness but a ______ strategy" },
      { title: "Use the explanation", body: "After the colon, the merchants keep \"the freedom to settle each account\" in the best currency. That is a plan." },
      { title: "Choose", body: "\"Calculated\" = deliberate. {A} repeats \"careless\"; {B} and {C} contradict the benefit described." }
    ],
    keyQuote: "they kept the freedom to settle each account in whichever currency later proved most favorable",
    hint: "\"Not X but Y\": the blank must be the opposite of carelessness."
  }),
  q(CS, "Text Structure and Purpose", "ns-e-009", {
    title: "Pollen and the island's forests",
    passage:
      "For decades, the standard account held that the island's forests were cleared rapidly by its first settlers. Pollen samples taken from the mud of three lake beds complicate this picture: tree pollen declines gradually over six centuries, with periods of partial recovery. Clearing, it seems, was neither sudden nor continuous.",
    prompt: "Which choice best states the main purpose of the text?",
    options: [
      "To explain how pollen samples are collected from lake beds and dated",
      "To argue that the island's first settlers had little effect on its forests",
      "To present evidence that calls for revising a long-accepted account of how the island's forests were cleared",
      "To compare the reliability of pollen evidence with that of written records"
    ],
    correctIndex: 2,
    explanation:
      "The text states the standard account, brings in pollen evidence that complicates it, and ends with a revised conclusion.",
    rationales: [
      "The lake-bed samples are mentioned, but the text never explains how they are collected or dated.",
      "Too strong. The forests were still cleared; the evidence changes how fast and how steadily, not whether.",
      "Correct. The text gives the standard account, then evidence that complicates it, then a revised conclusion.",
      "Written records never appear in the text, so nothing is compared with them."
    ],
    steps: [
      { title: "Map the three sentences", body: "1: the standard account (rapid clearing). 2: pollen evidence that complicates it. 3: the revised view.", quote: "Pollen samples taken from the mud of three lake beds complicate this picture" },
      { title: "Name what the text does", body: "It uses new evidence to revise an accepted account." },
      { title: "Watch the scope", body: "{B} overshoots: clearing still happened. {A} and {D} are about topics the text doesn't cover." }
    ],
    keyQuote: "Clearing, it seems, was neither sudden nor continuous.",
    hint: "What happens to \"the standard account\" by the end of the text?"
  }),
  q(CS, "Text Structure and Purpose", "ns-e-010", {
    title: "What the telegraph offered",
    passage: TELEGRAPH,
    underline: span(TELEGRAPH, "Yet for the merchants who first adopted it, speed mattered less than certainty."),
    prompt: "Which choice best describes the function of the underlined sentence in the text as a whole?",
    options: [
      "It gives an example of the emphasis described in the first sentence.",
      "It qualifies a common emphasis by pointing to a different benefit, which the next sentence illustrates.",
      "It concedes a weakness in the argument that the next sentence develops.",
      "It summarizes the evidence that the rest of the text presents."
    ],
    correctIndex: 1,
    explanation:
      "The first sentence states what accounts usually stress, which is speed. The underlined sentence, beginning with \"Yet,\" shifts to what mattered more to early users, which is certainty, and the last sentence illustrates that point.",
    rationales: [
      "The sentence departs from the emphasis on speed; it doesn't give an example of it.",
      "Correct. \"Yet\" qualifies the usual emphasis on speed by naming a different benefit, certainty, and the next sentence illustrates it with letters and telegrams.",
      "It introduces the text's main point, not a weakness in the argument.",
      "The evidence comes after this sentence, so the sentence can't be a summary of it."
    ],
    steps: [
      { title: "Read the sentence before", body: "Accounts of the telegraph usually stress speed.", quote: "Many accounts of the telegraph emphasize its speed." },
      { title: "Notice the pivot word", body: "The underlined sentence opens with \"Yet,\" which signals a turn: for early merchants, certainty mattered more than speed." },
      { title: "Read the sentence after", body: "Letters arrived unpredictably; telegrams arrived when promised. That illustrates the point about certainty, so {B} fits." }
    ],
    keyQuote: "Yet for the merchants who first adopted it, speed mattered less than certainty.",
    hint: "The sentence starts with \"Yet.\" What is it turning away from, and what follows it?"
  }),
  q(CS, "Cross-Text Connections", "ns-e-011", {
    title: "Did the container do it alone?",
    passage:
      "Text 1\nThe rapid growth of world trade in the late twentieth century is best explained by one invention: the standardized shipping container. By allowing cargo to move between ships, trains, and trucks without being unpacked, the container cut the cost of handling goods so sharply that distance almost stopped mattering.\n\nText 2\nEconomist Lena Farrow examined trade between forty pairs of countries and found that trade grew quickly after containers were adopted only where governments had also lowered tariffs and rebuilt their ports. Where those changes did not happen, the adoption of containers was followed by little change in trade.",
    prompt: "Based on the texts, how would Farrow (Text 2) most likely respond to the explanation offered in Text 1?",
    options: [
      "By agreeing that the shipping container alone accounts for the growth of trade",
      "By claiming that the shipping container had no real effect on the cost of moving goods",
      "By suggesting that Text 1 underestimates how much containers reduced handling costs",
      "By arguing that it gives too much credit to one technology whose effect depended on other conditions"
    ],
    correctIndex: 3,
    explanation:
      "Text 1 credits \"one invention\" for the growth of trade. Farrow found that containers were followed by growth only where tariffs fell and ports were rebuilt, so she would say the container's effect depended on other conditions.",
    rationales: [
      "Farrow found little change in trade where tariffs and ports stayed the same, so she would not credit the container alone.",
      "Too strong. Trade did grow quickly after containers arrived where the other changes were also made.",
      "The reverse of her likely criticism: her findings suggest Text 1 gives containers too much credit, not too little.",
      "Correct. Containers were followed by rapid growth only where governments also lowered tariffs and rebuilt ports."
    ],
    steps: [
      { title: "Text 1's explanation", body: "One invention, the shipping container, explains the growth of world trade.", quote: "is best explained by one invention" },
      { title: "Farrow's finding", body: "Trade grew quickly only where tariffs were lowered and ports rebuilt as well.", quote: "only where governments had also lowered tariffs and rebuilt their ports" },
      { title: "Predict her response", body: "The container mattered, but not by itself: {D}. {A} ignores her data and {B} overstates it." }
    ],
    keyQuote: "Where those changes did not happen, the adoption of containers was followed by little change in trade.",
    hint: "Text 1 says \"one invention.\" What else did Farrow find had to be true?"
  }),
  q(CS, "Cross-Text Connections", "ns-e-012", {
    title: "Motion or speaking aloud?",
    passage:
      "Text 1\nResearchers studying trainee pilots found that those who practiced emergency procedures in a full-motion simulator later made fewer errors than those who practiced on a desktop computer. The researchers concluded that the physical sensation of motion is what makes the training last.\n\nText 2\nA later team repeated the comparison and found only a small advantage for the full-motion simulator. When the desktop trainees were required to say each step aloud before performing it, as the simulator trainees had been doing all along, the difference between the two groups disappeared.",
    prompt: "Based on the texts, how would the team in Text 2 most likely respond to the conclusion in Text 1?",
    options: [
      "By proposing that any advantage comes from saying the steps aloud, not from the sensation of motion",
      "By agreeing that the sensation of motion is what makes simulator training effective",
      "By arguing that desktop practice leads to fewer errors than simulator practice does",
      "By claiming that practice of any kind has no effect on the errors pilots make later"
    ],
    correctIndex: 0,
    explanation:
      "In Text 2 the gap disappeared once the desktop trainees also said each step aloud. That points to saying the steps aloud, not the sensation of motion, as the source of the advantage.",
    rationales: [
      "Correct. When desktop trainees also said each step aloud, the difference disappeared, so that habit, not motion, explains the advantage.",
      "This repeats Text 1's conclusion, which Text 2's result calls into question.",
      "The desktop trainees only matched the simulator trainees; they didn't outperform them.",
      "Far broader than anything Text 2 found. Both groups practiced, and how they practiced mattered."
    ],
    steps: [
      { title: "Text 1's conclusion", body: "The physical sensation of motion is what makes the training last.", quote: "the physical sensation of motion is what makes the training last" },
      { title: "What Text 2 changed", body: "Desktop trainees were made to say each step aloud, as the simulator trainees already did. The difference vanished.", quote: "the difference between the two groups disappeared" },
      { title: "Predict the response", body: "The cause was the speaking, not the motion: {A}." }
    ],
    keyQuote: "as the simulator trainees had been doing all along",
    hint: "What did the simulator trainees do that the desktop trainees didn't, until Text 2's team changed it?"
  }),

  // =====================================================================
  // Expression of Ideas
  // =====================================================================
  q(EI, "Rhetorical Synthesis", "ns-e-013", {
    title: "The Tessaly Canal",
    passage:
      "While researching a topic, a student has taken the following notes:\n• The Tessaly Canal was completed in 1874.\n• It was built to carry grain barges between two river systems.\n• By 1910, railways had made most of the canal's freight traffic unprofitable.\n• In 1986, the canal was restored as a recreational waterway.\n• Today it carries about 40,000 pleasure boats per year.",
    prompt: "The student wants to emphasize how the canal's purpose has changed. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
    options: [
      "The Tessaly Canal, completed in 1874, connected two river systems.",
      "By 1910, railways had made most of the Tessaly Canal's freight traffic unprofitable.",
      "Built in 1874 to carry grain barges, the Tessaly Canal now serves about 40,000 pleasure boats per year as a recreational waterway.",
      "Restored in 1986, the Tessaly Canal carries about 40,000 pleasure boats per year."
    ],
    correctIndex: 2,
    explanation:
      "To show a change in purpose, the sentence must give both the original purpose (carrying grain barges) and the present one (recreation). Only choice {C} does both.",
    rationales: [
      "This gives the date and the route but no purpose, old or new.",
      "This explains why freight declined but names no new purpose.",
      "Correct. It pairs the original purpose (grain barges) with the present one (pleasure boats on a recreational waterway).",
      "This gives only the present use, so no change is shown."
    ],
    steps: [
      { title: "Underline the goal", body: "\"Emphasize how the canal's purpose has changed.\" A change needs a before and an after." },
      { title: "Find both in the notes", body: "Before: built to carry grain barges. After: a recreational waterway with 40,000 pleasure boats a year.", quote: "It was built to carry grain barges between two river systems." },
      { title: "Pick the choice with both", body: "{C} is the only one that states the old purpose and the new one." }
    ],
    keyQuote: "In 1986, the canal was restored as a recreational waterway.",
    hint: "A change has two sides. Which choice gives both the old purpose and the new one?"
  }),
  q(EI, "Rhetorical Synthesis", "ns-e-014", {
    title: "Where the buried grew up",
    passage:
      "While researching a topic, a student has taken the following notes:\n• Strontium isotope analysis of tooth enamel can show where a person lived as a child.\n• The ratio of strontium isotopes in enamel reflects the local geology of the place where the person grew up.\n• A research team analyzed the enamel of 42 people buried at an ancient site.\n• Seventeen of the 42 had ratios that did not match the local geology.\n• The team concluded that many of the people buried at the site had grown up elsewhere.",
    prompt: "The student wants to present the study's conclusion to an audience already familiar with strontium isotope analysis. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
    options: [
      "Strontium isotope analysis, which can show where a person lived as a child, was used to study 42 people buried at an ancient site.",
      "Because 17 of the 42 people analyzed had strontium ratios that did not match the local geology, the team concluded that many of those buried at the site had grown up elsewhere.",
      "The ratio of strontium isotopes in tooth enamel reflects the local geology of the place where a person grew up.",
      "A research team analyzed the tooth enamel of 42 people who were buried at an ancient site."
    ],
    correctIndex: 1,
    explanation:
      "The audience already knows the method, so the sentence should not explain it. It should state the conclusion and the result behind it, which choice {B} does.",
    rationales: [
      "It spends its words explaining what the method can show, which this audience already knows, and never gives the conclusion.",
      "Correct. It skips the explanation of the method and states the result (17 of 42) and the conclusion drawn from it.",
      "This only explains how the method works. The audience knows that already, and the study isn't mentioned.",
      "It says what the team did but leaves out what the team concluded."
    ],
    steps: [
      { title: "Read the goal twice", body: "Two parts: present the study's conclusion, and do it for readers who already know the method." },
      { title: "Drop what the audience knows", body: "Any choice that explains strontium isotope analysis ({A}, {C}) wastes the sentence." },
      { title: "Keep the conclusion", body: "{D} stops before the conclusion. {B} gives the key result and the conclusion.", quote: "The team concluded that many of the people buried at the site had grown up elsewhere." }
    ],
    keyQuote: "The team concluded that many of the people buried at the site had grown up elsewhere.",
    hint: "If the audience already knows the method, what should the sentence leave out, and what must it include?"
  }),
  q(EI, "Transitions", "ns-e-015", {
    title: "Not formless after all",
    passage:
      "Early critics dismissed the novel as formless, a loose collection of scenes with no plan behind it. ______ its structure is intricate: each chapter in the second half mirrors, in reverse order, an episode from the first.",
    prompt: TRANSITION,
    options: ["Similarly,", "As a result,", "For example,", "In fact,"],
    correctIndex: 3,
    explanation:
      "The second sentence contradicts the critics and gives the truth of the matter. \"In fact\" signals that kind of correction.",
    rationales: [
      "\"Similarly\" would mean the second sentence agrees with the critics. It contradicts them.",
      "\"As a result\" would mean the intricate structure was caused by the critics' judgment.",
      "\"For example\" would make the mirrored chapters an example of formlessness.",
      "Correct. \"In fact\" introduces a statement that corrects the mistaken view before it."
    ],
    steps: [
      { title: "Sentence 1", body: "Critics called the novel formless.", quote: "Early critics dismissed the novel as formless" },
      { title: "Sentence 2", body: "Its structure is intricate. That is the opposite of formless, presented as the truth." },
      { title: "Name the relationship", body: "A correction of a mistaken view. \"In fact\" does that; {A}, {B} and {C} signal agreement, result and example." }
    ],
    keyQuote: "its structure is intricate",
    hint: "Does the second sentence agree with the critics or set the record straight?"
  }),
  q(EI, "Transitions", "ns-e-016", {
    title: "A shorter questionnaire",
    passage:
      "The survey's designers shortened the questionnaire from forty items to twelve, hoping to raise the response rate. The response rate did rise; ______ the shorter form could no longer distinguish between respondents with moderate views and those with strong ones.",
    prompt: TRANSITION,
    options: ["therefore,", "however,", "specifically,", "for example,"],
    correctIndex: 1,
    explanation:
      "The first half of the sentence reports a success and the second half reports a drawback, so a contrast word is needed.",
    rationales: [
      "\"Therefore\" would make the drawback a logical result of the higher response rate. It is a result of the shorter form.",
      "Correct. \"However\" sets the unintended cost against the intended success.",
      "\"Specifically\" would make the drawback a detail of the response rate rising. It is a different matter.",
      "\"For example\" would make the drawback an example of the response rate rising."
    ],
    steps: [
      { title: "Before the blank", body: "The plan worked: the response rate rose.", quote: "The response rate did rise;" },
      { title: "After the blank", body: "A cost: the short form can't tell moderate views from strong ones." },
      { title: "Name the relationship", body: "Success, then drawback: contrast. Only {B} signals contrast." }
    ],
    keyQuote: "The response rate did rise;",
    hint: "Is what comes after the blank good news or bad news, compared with what comes before it?"
  }),

  // =====================================================================
  // Standard English Conventions
  // =====================================================================
  q(SEC, "Boundaries", "ns-e-017", {
    title: "The botanist who made watches",
    passage: "The expedition's botanist—who had trained, improbably, as a ______ catalogued more than 300 plant species in a single season.",
    prompt: COMPLETE,
    options: ["watchmaker,", "watchmaker;", "watchmaker—", "watchmaker"],
    correctIndex: 2,
    explanation:
      "The clause \"who had trained, improbably, as a watchmaker\" interrupts the sentence. It opens with a dash, so it must close with a matching dash.",
    rationales: [
      "A comma can't close an interruption that opened with a dash. The pair must match.",
      "A semicolon would cut the subject \"botanist\" off from its verb \"catalogued.\"",
      "Correct. The interrupting clause opens with a dash and closes with a dash.",
      "With no punctuation, the interrupting clause never closes and runs into the verb."
    ],
    steps: [
      { title: "Find the interruption", body: "\"who had trained, improbably, as a watchmaker\" is extra information set inside the main sentence.", quote: "The expedition's botanist—who had trained" },
      { title: "See how it opens", body: "With a dash, right after \"botanist.\"" },
      { title: "Close it the same way", body: "Dash opens, dash closes. Check by removing it: \"The expedition's botanist catalogued more than 300 plant species\" still works." }
    ],
    keyQuote: "The expedition's botanist—who had trained",
    hint: "Look at the punctuation mark right after \"botanist.\" The interruption has to end the way it began."
  }),
  q(SEC, "Boundaries", "ns-e-018", {
    title: "The charter of 1952",
    passage: "The city's new charter was approved in ______ its provisions did not take effect until 1954, after a further round of public hearings.",
    prompt: COMPLETE,
    options: ["1952,", "1952", "1952 and,", "1952;"],
    correctIndex: 3,
    explanation:
      "\"The city's new charter was approved in 1952\" and \"its provisions did not take effect until 1954\" are both independent clauses, and a semicolon can join them.",
    rationales: [
      "A comma alone between two independent clauses is a comma splice.",
      "No punctuation between two independent clauses makes a run-on sentence.",
      "The comma is on the wrong side of \"and\": it belongs before the conjunction, not after it.",
      "Correct. A semicolon joins two independent clauses."
    ],
    steps: [
      { title: "Test the first half", body: "\"The city's new charter was approved in 1952\" can stand alone." },
      { title: "Test the second half", body: "\"its provisions did not take effect until 1954\" can stand alone too.", quote: "its provisions did not take effect until 1954" },
      { title: "Apply the rule", body: "Two independent clauses need a period, a semicolon, or a comma plus a conjunction. Only {D} is one of those." }
    ],
    keyQuote: "its provisions did not take effect until 1954",
    hint: "Could each side of the blank be its own sentence?"
  }),
  q(SEC, "Form, Structure, and Sense", "ns-e-019", {
    title: "One collection, many items",
    passage: "The collection of letters, diaries, and annotated maps that the explorer's descendants donated to the archive ______ scholars a detailed record of the expedition's final months.",
    prompt: COMPLETE,
    options: ["give", "gives", "are giving", "have given"],
    correctIndex: 1,
    explanation:
      "The subject is the singular noun \"collection,\" so the verb must be singular: \"gives.\" The plural nouns between the subject and the verb don't change it.",
    rationales: [
      "\"Give\" is plural, but the subject \"collection\" is singular.",
      "Correct. Singular subject \"collection,\" singular verb \"gives.\"",
      "\"Are giving\" is plural. It agrees with the nearby nouns, not with the subject.",
      "\"Have given\" is plural as well."
    ],
    steps: [
      { title: "Find the subject", body: "Ask what gives scholars a record: the collection.", quote: "The collection of letters, diaries, and annotated maps" },
      { title: "Cross out what sits in between", body: "\"of letters, diaries, and annotated maps that the explorer's descendants donated to the archive\" describes the collection. None of those plural nouns is the subject." },
      { title: "Match the verb", body: "\"The collection ... gives.\" The other three choices are plural forms." }
    ],
    keyQuote: "The collection of letters, diaries, and annotated maps",
    hint: "Strip the sentence down: \"The collection ... ______ scholars a detailed record.\""
  }),
  q(SEC, "Form, Structure, and Sense", "ns-e-020", {
    title: "Who analyzed the samples?",
    passage: "Having analyzed more than 2,000 soil samples, ______",
    prompt: COMPLETE,
    options: [
      "the contamination was found by the researchers to be confined to the northern field.",
      "it was concluded that the contamination was confined to the northern field.",
      "the researchers concluded that the contamination was confined to the northern field.",
      "the conclusion of the researchers was that the contamination was confined to the northern field."
    ],
    correctIndex: 2,
    explanation:
      "The opening phrase must describe whoever did the analyzing, so the subject that follows the comma must be \"the researchers.\"",
    rationales: [
      "This makes \"the contamination\" the one that analyzed the samples.",
      "\"It\" refers to no one, so the opening phrase has nothing to describe.",
      "Correct. \"The researchers\" analyzed the samples, and they come right after the comma.",
      "This makes \"the conclusion\" the one that analyzed the samples."
    ],
    steps: [
      { title: "Ask who did the action", body: "Who analyzed more than 2,000 soil samples? The researchers.", quote: "Having analyzed more than 2,000 soil samples" },
      { title: "Apply the modifier rule", body: "An opening \"-ing\" phrase describes the subject that comes right after the comma." },
      { title: "Check the first words of each choice", body: "\"the contamination,\" \"it,\" \"the researchers,\" \"the conclusion.\" Only {C} starts with the people who did the analyzing." }
    ],
    keyQuote: "Having analyzed more than 2,000 soil samples",
    hint: "Who did the analyzing? That noun must come right after the comma."
  })
];

export const CHALLENGING_RW = balanceAnswers(RAW_QUESTIONS);
