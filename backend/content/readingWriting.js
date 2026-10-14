// Reading & Writing starter questions for the practice bank.
//
// Shape (see also CLAUDE.md "Practice question shape"):
//   passage   text shown in the left pane. "Text 1" / "Text 2" on their own
//             line become labels, "• " lines become bullets, "______" is a blank.
//   prompt    the question itself (right pane).
//   rationales  one explanation per option, in option order.
//   steps     the step-by-step explanation; `quote` is shown highlighted.
//   keyQuote  exact substring of the passage: the evidence Nova highlights.
//   hint      a nudge that doesn't give the answer away.
//   legacyTitle  title of the pre-2026-09-27 starter question this replaces,
//             so existing databases upgrade it in place (same id, same progress).
//
// Passages are original to Northstar. Researchers named in invented studies
// are fictional.

const RW = "Reading & Writing";
const II = "Information and Ideas";
const CS = "Craft and Structure";
const EI = "Expression of Ideas";
const SEC = "Standard English Conventions";

const COMPLETE = "Which choice completes the text so that it conforms to the conventions of Standard English?";
const LOGICAL = "Which choice completes the text with the most logical and precise word or phrase?";
const TRANSITION = "Which choice completes the text with the most logical transition?";
const MAIN_IDEA = "Which choice best states the main idea of the text?";

function q(domain, topic, difficulty, key, fields) {
  return { key, section: RW, domain, topic, difficulty, type: "mcq", ...fields };
}

// Questions are written with the correct option wherever it reads best;
// balanceAnswers() (bottom of the file) then moves each correct option so
// A–D are equally common. Explanations refer to options as {A}…{D}, which
// is re-lettered to match the final order.
const RAW_QUESTIONS = [
  // =====================================================================
  // Information and Ideas: Central Ideas and Details
  // =====================================================================
  q(II, "Central Ideas and Details", "Easy", "rw-cid-01", {
    legacyTitle: "Main idea in one line",
    title: "Main idea in one line",
    passage:
      "Honeybees perform a \"waggle dance\" whose angle and duration tell other bees the direction and distance of food. Researchers who have learned to decode these dances have used them to map where colonies forage across entire seasons.",
    prompt: MAIN_IDEA,
    options: [
      "Honeybees prefer to forage close to their hives.",
      "Bee dances encode information that researchers can use to study foraging.",
      "Researchers have trained bees to dance on command.",
      "The waggle dance is the only way bees communicate."
    ],
    correctIndex: 1,
    explanation: "The text explains what the dance encodes and how researchers use it. Choice {B} captures both parts without overreaching.",
    rationales: [
      "The text never says how far bees prefer to fly, so this adds a claim the passage doesn't make.",
      "Correct. The first sentence says what the dance encodes; the second says researchers use it to map foraging. {B} combines both.",
      "Researchers decode the dances; nothing suggests they trained bees to perform them.",
      "\"The only way\" is extreme. The text describes one form of communication without ruling out others."
    ],
    steps: [
      { title: "Summarize each sentence", body: "Sentence 1: the dance tells other bees where food is. Sentence 2: researchers decode it to map foraging." },
      { title: "Combine them into one idea", body: "The dance carries information, and scientists can use that information.", quote: "used them to map where colonies forage across entire seasons" },
      { title: "Check the choices", body: "Only {B} covers both halves. {A} and {D} add claims the text doesn't make, and {C} misreads who does what." }
    ],
    keyQuote: "have used them to map where colonies forage across entire seasons",
    hint: "The main idea should cover both sentences, not just the first."
  }),
  q(II, "Central Ideas and Details", "Easy", "rw-cid-02", {
    title: "The neighborhood farm",
    passage:
      "In 2019, a group of residents in Detroit converted three vacant lots into a community farm. Within two years, the farm was supplying vegetables to a nearby school cafeteria and hosting weekend workshops on composting and seed saving. Organizers say the project's greatest success, however, has been social: neighbors who had never spoken now share tools, trade harvests, and meet regularly to plan the next season.",
    prompt: MAIN_IDEA,
    options: [
      "Community farms in Detroit grow more vegetables than local schools can use.",
      "A farm built on vacant lots has provided food and education, but organizers value most how it has connected neighbors.",
      "Composting workshops are the most popular activity at the farm.",
      "Residents built the farm because a local school asked for fresh vegetables."
    ],
    correctIndex: 1,
    explanation: "The passage lists the farm's practical benefits, then uses \"however\" to stress that its greatest success is social.",
    rationales: [
      "The text says the farm supplies a school cafeteria, not that it produces more than schools can use.",
      "Correct. {B} keeps the practical benefits and the text's emphasis on the social connection that organizers value most.",
      "Workshops are mentioned, but nothing says they are the most popular activity.",
      "The text never gives a reason the farm was started, so this cause is invented."
    ],
    steps: [
      { title: "Summarize the text", body: "Residents build a farm; it supplies food and runs workshops; organizers say its biggest success is social." },
      { title: "Find the emphasis", body: "\"However\" signals the point the author cares about most.", quote: "the project's greatest success, however, has been social" },
      { title: "Match the choice", body: "{B} includes the benefits and the social emphasis. The other choices add claims or focus on a single detail." }
    ],
    keyQuote: "Organizers say the project's greatest success, however, has been social",
    hint: "Look for the word that signals what matters most to the organizers."
  }),
  q(II, "Central Ideas and Details", "Medium", "rw-cid-03", {
    title: "The orchid's single partner",
    passage:
      "Most flowering plants attract many kinds of pollinators, but the Australian hammer orchid depends on just one: a species of thynnid wasp. The orchid's lip mimics the shape and scent of a female wasp, luring males that try to carry it away. As a male grips the lip and attempts to fly, a hinge swings him into the flower's column, where pollen sticks to his back. Because the orchid relies on this single deception, it can reproduce only where that wasp species also lives.",
    prompt: "According to the text, why can the hammer orchid reproduce only in certain places?",
    options: [
      "It needs a type of soil found only in parts of Australia.",
      "Its flowers open only during the short season when wasps are active.",
      "It depends on a single wasp species for pollination, so it is limited to where that wasp lives.",
      "Female wasps destroy the flowers in areas where male wasps are rare."
    ],
    correctIndex: 2,
    explanation: "The last sentence states the reason directly: the orchid relies on one wasp species, so it can reproduce only where that wasp lives.",
    rationales: [
      "Soil is never mentioned in the text.",
      "The text says nothing about when the flowers open.",
      "Correct. The final sentence gives exactly this cause and effect.",
      "The orchid mimics female wasps; nothing says real female wasps harm the flowers."
    ],
    steps: [
      { title: "Identify the question", body: "It asks for a reason: why is reproduction limited to certain places?", quote: "why can the hammer orchid reproduce only in certain places?" },
      { title: "Find the line that answers it", body: "The last sentence begins with \"Because\" and states the limitation.", quote: "Because the orchid relies on this single deception, it can reproduce only where that wasp species also lives." },
      { title: "Match it", body: "Choice {C} restates that sentence. The others bring in soil, seasons, or behavior the text never describes." }
    ],
    keyQuote: "Because the orchid relies on this single deception, it can reproduce only where that wasp species also lives.",
    hint: "Detail questions are answered by one specific sentence. Which sentence contains \"only where\"?"
  }),
  q(II, "Central Ideas and Details", "Medium", "rw-cid-04", {
    title: "The underrated translator",
    passage:
      "When the first English translation of a celebrated Russian novel appeared in the 1880s, reviewers praised its energy and clarity but rarely mentioned its translator, Harriet Vale. Vale had worked mainly from a French version of the novel rather than the Russian original, and later scholars often faulted her for it. Yet her recently catalogued letters show that she checked difficult passages against the Russian with the help of native speakers, a practice suggesting that her translation was more careful than its reputation implies.",
    prompt: MAIN_IDEA,
    options: [
      "Vale's translation was praised mainly because it was based on the Russian original.",
      "Although Vale's translation has been criticized, new evidence suggests she worked on it more carefully than critics assumed.",
      "Translations made from French versions of Russian novels are always unreliable.",
      "Vale was the first translator to consult native speakers when translating Russian literature."
    ],
    correctIndex: 1,
    explanation: "The text moves from criticism of Vale to evidence that complicates it: her letters show a careful process.",
    rationales: [
      "The text says she worked mainly from a French version, so this contradicts it.",
      "Correct. {B} captures the shift from criticism (\"faulted her\") to the new evidence (\"more careful than its reputation implies\").",
      "\"Always unreliable\" is a sweeping claim the text never makes.",
      "The text never claims she was the first to do this."
    ],
    steps: [
      { title: "Track the turn", body: "The word \"Yet\" marks the author's main point, after the background and the criticism." },
      { title: "Read the conclusion", body: "The final clause states what the letters suggest.", quote: "her translation was more careful than its reputation implies" },
      { title: "Choose the full summary", body: "{B} mentions both the criticism and the evidence that answers it. The others misstate or exaggerate details." }
    ],
    keyQuote: "a practice suggesting that her translation was more careful than its reputation implies",
    hint: "The main idea usually comes after a turn word like \"Yet\" or \"However\"."
  }),
  q(II, "Central Ideas and Details", "Hard", "rw-cid-05", {
    title: "Songs in a noisy city",
    passage:
      "Researchers have found that great tits living in noisy cities sing at higher pitches than those in quiet forests. Because traffic noise is concentrated at low frequencies, a higher song is less likely to be drowned out. The shift may carry a cost, though: in some populations, females respond more strongly to lower-pitched songs, which they may associate with larger, healthier males. City birds, in other words, may be trading attractiveness for audibility.",
    prompt: MAIN_IDEA,
    options: [
      "Female great tits in cities prefer males that sing at higher pitches than forest birds do.",
      "City great tits sing higher to be heard over traffic, but this may make their songs less appealing to potential mates.",
      "Traffic noise has caused great tit populations in cities to shrink.",
      "Larger great tits always sing at lower pitches than smaller great tits."
    ],
    correctIndex: 1,
    explanation: "The text describes an adaptation (higher songs) and its possible cost (less attractive to females), summed up in the last sentence.",
    rationales: [
      "The text says some females respond more to lower songs, the opposite of this choice.",
      "Correct. {B} combines the benefit (audibility) and the cost (attractiveness) that the last sentence sums up.",
      "Nothing in the text discusses population size.",
      "The text says females may associate low songs with larger males; it never says larger birds always sing lower."
    ],
    steps: [
      { title: "Find the benefit", body: "Higher songs are harder for low-frequency traffic noise to mask." },
      { title: "Find the cost", body: "Females in some populations prefer lower songs.", quote: "females respond more strongly to lower-pitched songs" },
      { title: "Use the summary sentence", body: "\"In other words\" introduces the author's own summary of the main idea.", quote: "City birds, in other words, may be trading attractiveness for audibility." }
    ],
    keyQuote: "City birds, in other words, may be trading attractiveness for audibility.",
    hint: "\"In other words\" often introduces the author's own summary."
  }),
  q(II, "Central Ideas and Details", "Easy", "rw-cid-06", {
    title: "A library of things",
    passage:
      "Some public libraries now lend far more than books. The Sacramento Public Library, for example, runs a \"Library of Things\" where cardholders can borrow sewing machines, musical instruments, and board games. Librarians say the program lets residents try expensive items before buying them, and it lets people use equipment they need only once or twice a year.",
    prompt: "According to the text, what is one benefit of the Library of Things?",
    options: [
      "It lets residents use equipment they need only occasionally.",
      "It raises money for the library through rental fees.",
      "It has replaced the library's collection of books.",
      "It teaches residents how to repair sewing machines."
    ],
    correctIndex: 0,
    explanation: "The last sentence names two benefits; choice A restates the second one.",
    rationales: [
      "Correct. The text says the program lets people use equipment \"they need only once or twice a year.\"",
      "Fees are never mentioned.",
      "The text says libraries lend \"more than books,\" not instead of books.",
      "Repair lessons are never mentioned."
    ],
    steps: [
      { title: "Find where benefits are listed", body: "The last sentence reports what librarians say the program does." },
      { title: "Read it closely", body: "It lists two benefits.", quote: "it lets people use equipment they need only once or twice a year" },
      { title: "Match", body: "A paraphrases \"once or twice a year\" as \"occasionally.\"" }
    ],
    keyQuote: "it lets people use equipment they need only once or twice a year",
    hint: "Find the sentence that tells you what the librarians say."
  }),

  // =====================================================================
  // Information and Ideas: Command of Evidence
  // =====================================================================
  q(II, "Command of Evidence", "Hard", "rw-coe-01", {
    legacyTitle: "What the study actually suggests",
    title: "What the study actually suggests",
    passage:
      "A study finds that neighborhoods with more mature trees report cooler summer temperatures than neighborhoods with fewer trees. The researchers conclude that the trees themselves cause the cooler temperatures.",
    prompt: "Which finding, if true, would most directly strengthen the researchers' conclusion?",
    options: [
      "The neighborhoods planted their trees at different times.",
      "Residents prefer the appearance of mature trees.",
      "Temperatures in all the neighborhoods were measured at the same time of day and at the same elevation.",
      "Tree-rich neighborhoods have higher property values."
    ],
    correctIndex: 2,
    explanation: "Measuring at the same time and elevation rules out other explanations, so the temperature difference is more plausibly caused by the trees.",
    rationales: [
      "Planting times don't help show that the trees cause cooling.",
      "Residents' preferences are irrelevant to temperature.",
      "Correct. Controlling time of day and elevation removes other possible causes, which strengthens the causal claim.",
      "Property values are a different variable; if anything they suggest other differences between neighborhoods."
    ],
    steps: [
      { title: "Pin down the claim", body: "The claim is causal: trees cause cooler temperatures.", quote: "the trees themselves cause the cooler temperatures" },
      { title: "Ask what could weaken it", body: "Other differences, such as when or where temperatures were measured, could explain the gap." },
      { title: "Pick the choice that rules those out", body: "{C} controls for time and elevation, making the trees the most plausible cause." }
    ],
    keyQuote: "The researchers conclude that the trees themselves cause the cooler temperatures.",
    hint: "To strengthen a cause-and-effect claim, rule out other possible causes."
  }),
  q(II, "Command of Evidence", "Hard", "rw-coe-02", {
    legacyTitle: "Data that actually supports the claim",
    title: "Data that actually supports the claim",
    passage: "A student claims that a school's new reading program improved students' reading scores.",
    prompt: "Which finding, if true, would most directly support the student's claim?",
    options: [
      "Students said they enjoyed the program.",
      "Scores rose 15% for program participants but stayed flat for similar students who did not participate.",
      "The program was expensive to run.",
      "Reading scores rose at many schools nationwide in the same year."
    ],
    correctIndex: 1,
    explanation: "A comparison group that didn't improve isolates the program's effect.",
    rationales: [
      "Enjoyment says nothing about whether scores improved.",
      "Correct. Participants improved while similar non-participants didn't, which points to the program as the cause.",
      "Cost is irrelevant to whether the program worked.",
      "A nationwide rise suggests something other than this program raised scores, which weakens the claim."
    ],
    steps: [
      { title: "Restate the claim", body: "The program caused higher reading scores." },
      { title: "Think like a scientist", body: "The strongest support compares students who got the program with similar students who didn't." },
      { title: "Choose", body: "Only {B} offers that comparison." }
    ],
    keyQuote: "a school's new reading program improved students' reading scores",
    hint: "What kind of comparison would show the program, not something else, made the difference?"
  }),
  q(II, "Command of Evidence", "Medium", "rw-coe-03", {
    title: "The restless sea",
    passage:
      "In the poem \"The Tide Clock,\" poet Maren Oyelaran portrays the sea as restless and impatient, never content to stay in one place.",
    prompt: "Which quotation from \"The Tide Clock\" most effectively illustrates the claim?",
    options: [
      "\"The gulls are gray above the gray, / and wait for evening's end.\"",
      "\"It pulls its skirts across the stones / then flings them back, and will not rest.\"",
      "\"A child has left a single shoe / half buried where the dunes begin.\"",
      "\"The lighthouse keeps its patient count / of every ship that passes by.\""
    ],
    correctIndex: 1,
    explanation: "Only {B} shows the sea in constant motion (\"pulls,\" \"flings\") and states it \"will not rest.\"",
    rationales: [
      "This describes the gulls waiting, not the sea moving.",
      "Correct. The sea pulls and flings, and \"will not rest\" directly expresses restlessness.",
      "This is a detail on the beach; it says nothing about the sea.",
      "\"Patient\" describes the lighthouse and is the opposite of the claim."
    ],
    steps: [
      { title: "Underline the claim", body: "The sea is restless and impatient.", quote: "portrays the sea as restless and impatient" },
      { title: "Check each quotation's subject", body: "{A} is about gulls, {C} about a shoe, and {D} about a lighthouse. Only {B} is about the sea." },
      { title: "Confirm the meaning", body: "\"Will not rest\" matches \"restless\" almost word for word." }
    ],
    keyQuote: "portrays the sea as restless and impatient",
    hint: "First check which quotations are even about the sea."
  }),
  q(II, "Command of Evidence", "Hard", "rw-coe-04", {
    title: "Sleep and memory",
    passage:
      "Neuroscientist Lena Okafor hypothesizes that the brain uses sleep to strengthen newly formed memories. In a study, participants learned a list of word pairs in the evening. Half of them then slept for eight hours, while the other half stayed awake overnight under supervision. The next morning, both groups were tested on the word pairs.",
    prompt: "Which finding, if true, would most directly support Okafor's hypothesis?",
    options: [
      "Participants in both groups remembered more word pairs in the morning than they had right after learning them.",
      "Participants who slept remembered significantly more word pairs than participants who stayed awake.",
      "Participants who stayed awake reported feeling more tired during the test.",
      "Participants who slept took longer than usual to fall asleep."
    ],
    correctIndex: 1,
    explanation: "The hypothesis predicts that sleepers will remember more than people who stayed awake. {B} is exactly that result.",
    rationales: [
      "If both groups improved equally, sleep wouldn't explain the difference, so this doesn't support the hypothesis.",
      "Correct. The only difference between the groups is sleep, so better recall among sleepers supports the idea that sleep strengthens memory.",
      "Tiredness is not memory; this doesn't address the hypothesis.",
      "How quickly they fell asleep is irrelevant to memory strength."
    ],
    steps: [
      { title: "State the hypothesis", body: "Sleep strengthens new memories.", quote: "the brain uses sleep to strengthen newly formed memories" },
      { title: "Predict the supporting result", body: "If it's true, the sleep group should recall more than the awake group." },
      { title: "Match", body: "{B} describes that difference; the other choices don't compare memory across the groups." }
    ],
    keyQuote: "the brain uses sleep to strengthen newly formed memories",
    hint: "The two groups differ in only one way. What result would show that difference mattered?"
  }),
  q(II, "Command of Evidence", "Medium", "rw-coe-05", {
    title: "Bicycles and independence",
    passage:
      "Historian Tomas Ruiz argues that the spread of affordable bicycles in the 1890s gave many young women a new degree of independence, allowing them to travel without escorts and to take part in social activities farther from home.",
    prompt: "Which quotation from an 1895 newspaper would most directly support Ruiz's argument?",
    options: [
      "\"Bicycle makers report that sales have doubled since last spring, owing chiefly to a fall in prices.\"",
      "\"Miss Ada Crane rode twelve miles alone to attend the county debate, a journey she could not have made a year ago without a chaperone and a carriage.\"",
      "\"Physicians disagree about whether cycling is a healthful exercise for the young.\"",
      "\"The new cycling paths along the river have become popular with families on Sunday afternoons.\""
    ],
    correctIndex: 1,
    explanation: "{B} shows a young woman traveling alone to a distant social event because of the bicycle, which is exactly Ruiz's claim.",
    rationales: [
      "This supports \"affordable\" but says nothing about women's independence.",
      "Correct. She travels alone, farther from home, to a social event she couldn't have reached before.",
      "Health debates are unrelated to independence.",
      "Families using paths doesn't show young women gaining independence."
    ],
    steps: [
      { title: "Break the claim into parts", body: "Young women + traveled without escorts + farther from home.", quote: "allowing them to travel without escorts" },
      { title: "Test each quotation", body: "Which one mentions a young woman, traveling alone, to a distant activity?" },
      { title: "Choose", body: "{B} hits every part of the claim." }
    ],
    keyQuote: "allowing them to travel without escorts and to take part in social activities farther from home",
    hint: "The right quotation should mention a woman traveling without an escort."
  }),
  q(II, "Command of Evidence", "Medium", "rw-coe-06", {
    title: "E-bikes and longer trips",
    passage:
      "A city transportation office tracked trips on its bike-share system during the first year after it added electric bikes to the fleet. A planner claims that electric bikes were especially popular for longer trips.",
    table: {
      title: "Bike-share trips by bike type and trip length (thousands of trips)",
      columns: ["Trip length", "Standard bikes", "Electric bikes"],
      rows: [
        ["Under 2 miles", "310", "120"],
        ["2 to 5 miles", "140", "150"],
        ["Over 5 miles", "30", "95"]
      ]
    },
    prompt: "Which choice most effectively uses data from the table to support the planner's claim?",
    options: [
      "Standard bikes were used for 310 thousand trips under 2 miles, more than any other category.",
      "Electric bikes were used for 95 thousand trips over 5 miles, while standard bikes were used for only 30 thousand trips of that length.",
      "Electric bikes were used for 120 thousand trips under 2 miles.",
      "Standard bikes were used for more trips in total than electric bikes were."
    ],
    correctIndex: 1,
    explanation: "For the longest trips, electric bikes outnumber standard bikes by more than 3 to 1, the strongest evidence that they were popular for long trips.",
    rationales: [
      "True, but it's about standard bikes on short trips, not electric bikes on long trips.",
      "Correct. It compares the two bike types on the longest trips, where electric bikes clearly dominate.",
      "True, but short trips don't support a claim about longer trips.",
      "True (480 vs. 365 thousand), but totals don't address trip length."
    ],
    steps: [
      { title: "Restate the claim", body: "Electric bikes were especially popular for long trips." },
      { title: "Find the relevant rows", body: "Look at the longer trips and compare the two columns: 95 vs. 30 for trips over 5 miles." },
      { title: "Reject accurate but irrelevant data", body: "{A}, {C}, and {D} are true readings of the table but don't address the claim." }
    ],
    keyQuote: "electric bikes were especially popular for longer trips",
    hint: "Which rows of the table are about longer trips?"
  }),
  q(II, "Command of Evidence", "Hard", "rw-coe-07", {
    title: "When more reading stops helping",
    passage:
      "A researcher surveyed high school students about how many hours per week they read for pleasure and compared the results with their scores on a vocabulary test. The researcher concluded that students who read more tend to score higher, but that the benefit levels off after about six hours per week.",
    table: {
      title: "Average vocabulary score by weekly reading time",
      columns: ["Hours of reading per week", "Average score (out of 100)"],
      rows: [
        ["0–1", "61"],
        ["2–3", "70"],
        ["4–5", "78"],
        ["6–7", "83"],
        ["8–9", "84"],
        ["10 or more", "84"]
      ]
    },
    prompt: "Which choice most effectively uses data from the table to support the researcher's conclusion?",
    options: [
      "Students who read 0–1 hours had an average score of 61, and students who read 10 or more hours had an average score of 84.",
      "Average scores rose from 61 to 83 between the 0–1 and 6–7 hour groups but increased by only 1 point among the groups that read more.",
      "Students who read 4–5 hours scored higher on average than students who read 2–3 hours.",
      "The highest average score in the table was 84."
    ],
    correctIndex: 1,
    explanation: "The conclusion has two parts: scores rise with reading, and the benefit levels off after about six hours. Only {B} shows both.",
    rationales: [
      "This shows that readers score higher but not that the benefit levels off.",
      "Correct. It shows the steep rise up to 6–7 hours and the flattening afterward, which covers both parts of the conclusion.",
      "This supports only the first part.",
      "The maximum alone shows no trend."
    ],
    steps: [
      { title: "Split the claim", body: "Part 1: more reading, higher scores. Part 2: the gain levels off after about six hours.", quote: "the benefit levels off after about six hours per week" },
      { title: "Read the table for both parts", body: "61 → 70 → 78 → 83 (rising), then 84 → 84 (flat)." },
      { title: "Pick the choice that covers both", body: "{B} is the only choice that describes the rise and the plateau." }
    ],
    keyQuote: "the benefit levels off after about six hours per week",
    hint: "The conclusion has two parts. Which choice supports the second part too?"
  }),

  // =====================================================================
  // Information and Ideas: Inferences
  // =====================================================================
  q(II, "Inferences", "Medium", "rw-inf-01", {
    title: "Lab results versus the beach",
    passage:
      "Laboratory studies have found that oxybenzone, a chemical in some sunscreens, can damage coral larvae at high concentrations. However, measurements taken near several popular swimming beaches have found oxybenzone at concentrations far lower than those used in the laboratory studies. Therefore, ______",
    prompt: "Which choice most logically completes the text?",
    options: [
      "sunscreen use has no effect on any marine organisms.",
      "the laboratory studies alone may not show that oxybenzone is harming coral near those beaches.",
      "oxybenzone concentrations in the ocean will increase in the future.",
      "coral larvae are more sensitive to oxybenzone than adult coral are."
    ],
    correctIndex: 1,
    explanation: "Harm was shown only at high concentrations, and the beaches have much lower levels, so the lab results alone don't prove harm at those beaches.",
    rationales: [
      "\"No effect on any marine organisms\" goes far beyond the text.",
      "Correct. It follows directly: harm at high levels doesn't show harm at the much lower levels actually measured.",
      "The text says nothing about future concentrations.",
      "Adult coral is never discussed."
    ],
    steps: [
      { title: "Premise 1", body: "Harm was found at high concentrations in the lab." },
      { title: "Premise 2", body: "Beach concentrations are far lower.", quote: "far lower than those used in the laboratory studies" },
      { title: "What must follow", body: "The lab evidence may not apply to the beaches. {B} says exactly that, without overreaching." }
    ],
    keyQuote: "found oxybenzone at concentrations far lower than those used in the laboratory studies",
    hint: "Compare the concentrations in the lab with those at the beaches."
  }),
  q(II, "Inferences", "Hard", "rw-inf-02", {
    title: "The unsigned manuscript",
    passage:
      "Medieval scribes often recorded their names in the final lines of the manuscripts they copied. A manuscript of sermons held in a Welsh archive lacks such a note, but its handwriting closely matches that of a signed manuscript copied by a scribe named Iorwerth. The sermons manuscript also uses unusual abbreviations for Latin words that appear in Iorwerth's signed work and in no other known manuscript from the period. These similarities suggest that ______",
    prompt: "Which choice most logically completes the text?",
    options: [
      "Iorwerth copied more manuscripts than any other scribe of his time.",
      "the sermons manuscript was probably copied by Iorwerth, even though it doesn't include his name.",
      "scribes rarely signed manuscripts of sermons.",
      "Iorwerth invented the abbreviations used in the sermons manuscript."
    ],
    correctIndex: 1,
    explanation: "Matching handwriting and abbreviations found nowhere else point to the same scribe.",
    rationales: [
      "The text never compares how many manuscripts scribes produced.",
      "Correct. Both clues point to Iorwerth as the copyist of the unsigned manuscript.",
      "One unsigned manuscript doesn't support a claim about sermon manuscripts in general.",
      "The abbreviations appear only in his work, but that doesn't prove he invented them."
    ],
    steps: [
      { title: "Collect the clues", body: "Matching handwriting, plus abbreviations found only in Iorwerth's work.", quote: "in no other known manuscript from the period" },
      { title: "Predict", body: "The unsigned manuscript was likely copied by Iorwerth." },
      { title: "Avoid overreach", body: "{D} goes too far: shared abbreviations don't show who invented them." }
    ],
    keyQuote: "appear in Iorwerth's signed work and in no other known manuscript from the period",
    hint: "What do the two clues about handwriting and abbreviations point to together?"
  }),
  q(II, "Inferences", "Easy", "rw-inf-03", {
    title: "Flowers that bloom at night",
    passage:
      "Many flowers that open only at night are white or pale in color and release strong scents after sunset. Moths, which are active at night, rely heavily on scent and on spotting pale shapes in low light when they search for nectar. It is therefore likely that the color and scent of these flowers ______",
    prompt: "Which choice most logically completes the text?",
    options: [
      "help attract pollinators that are active at night.",
      "protect the flowers from being eaten by insects.",
      "developed because bees prefer white flowers.",
      "make the flowers easier for gardeners to see."
    ],
    correctIndex: 0,
    explanation: "Moths find nectar by scent and pale shapes, and night flowers are pale and scented, so these traits likely attract night pollinators.",
    rationales: [
      "Correct. The traits match exactly what night-active moths look for.",
      "Nothing suggests the traits are defenses.",
      "Bees aren't mentioned, and the flowers open at night.",
      "Gardeners have nothing to do with the logic of the text."
    ],
    steps: [
      { title: "Connect the two sentences", body: "Night flowers are pale and scented; moths look for pale shapes and scent." },
      { title: "Draw the link", body: "The flowers' traits fit what moths need.", quote: "rely heavily on scent and on spotting pale shapes in low light" },
      { title: "Choose", body: "A states that link." }
    ],
    keyQuote: "rely heavily on scent and on spotting pale shapes in low light",
    hint: "How do the traits in the first sentence connect to the moths in the second?"
  }),
  q(II, "Inferences", "Medium", "rw-inf-04", {
    title: "Free shipping math",
    passage:
      "An online retailer began offering free shipping on all orders over $35. Analysts found that after the change, the average order grew from $28 to $39 while the number of orders stayed about the same. Because shipping costs per order also stayed about the same, the analysts concluded that the policy most likely ______",
    prompt: "Which choice most logically completes the text?",
    options: [
      "increased the retailer's total sales without increasing the number of shipments it paid for.",
      "reduced the retailer's shipping costs per order.",
      "attracted many new customers who had never shopped with the retailer.",
      "caused customers to place more frequent small orders."
    ],
    correctIndex: 0,
    explanation: "Same number of orders at a larger average size means more total sales, while shipments (one per order) stayed the same.",
    rationales: [
      "Correct. More money per order and the same number of orders means higher total sales with the same number of shipments.",
      "The text says shipping costs per order stayed about the same.",
      "The number of orders didn't change, so there's no evidence of many new customers.",
      "Orders got larger, not smaller, and weren't more frequent."
    ],
    steps: [
      { title: "List the facts", body: "Average order $28 → $39. Number of orders about the same. Shipping cost per order about the same." },
      { title: "Combine them", body: "Total sales = orders × average order, so sales went up. Shipments = orders, so shipments stayed flat." },
      { title: "Eliminate contradictions", body: "{B}, {C}, and {D} each contradict one of the stated facts." }
    ],
    keyQuote: "the average order grew from $28 to $39 while the number of orders stayed about the same",
    hint: "Total sales = number of orders × average order size."
  }),
  q(II, "Inferences", "Hard", "rw-inf-05", {
    title: "Light from long ago",
    passage:
      "Astronomers estimate a galaxy's distance by measuring its redshift: the stretching of its light toward longer wavelengths as the universe expands. Light from more distant galaxies has traveled longer to reach us, so it shows those galaxies as they were further in the past. A team observing two galaxies found that Galaxy A has a much larger redshift than Galaxy B. The team can therefore conclude that ______",
    prompt: "Which choice most logically completes the text?",
    options: [
      "Galaxy A is older than Galaxy B.",
      "the light observed from Galaxy A left that galaxy earlier than the light observed from Galaxy B left Galaxy B.",
      "Galaxy A is moving toward Earth faster than Galaxy B is.",
      "Galaxy B contains more stars than Galaxy A does."
    ],
    correctIndex: 1,
    explanation: "A larger redshift means greater distance, so Galaxy A's light has traveled longer. It left earlier, which is why we see Galaxy A further in the past.",
    rationales: [
      "Tempting, but seeing Galaxy A as it was longer ago doesn't mean the galaxy itself is older.",
      "Correct. More distance means a longer travel time, so Galaxy A's light departed earlier.",
      "Redshift comes from expansion carrying galaxies away; the text doesn't support motion toward Earth.",
      "Star counts are never discussed."
    ],
    steps: [
      { title: "Chain the logic", body: "Larger redshift → more distant → light traveled longer." },
      { title: "Apply it to Galaxy A", body: "Galaxy A has the larger redshift, so its light has been traveling longer.", quote: "it shows those galaxies as they were further in the past" },
      { title: "Beware the trap", body: "Seeing Galaxy A further in the past tells you when its light left, not how old the galaxy is. Pick the choice about when the light left, not the one about age." }
    ],
    keyQuote: "Light from more distant galaxies has traveled longer to reach us",
    hint: "Follow the chain: redshift → distance → travel time of light."
  }),

  // =====================================================================
  // Craft and Structure: Words in Context
  // =====================================================================
  q(CS, "Words in Context", "Medium", "rw-wic-01", {
    legacyTitle: "Precision over personality",
    title: "Precision over personality",
    passage: "The evidence was ______: several independent experiments produced the same result.",
    prompt: LOGICAL,
    options: ["corroborating", "ambiguous", "irrelevant", "tentative"],
    correctIndex: 0,
    explanation: "Independent experiments producing the same result confirm one another, so the evidence is corroborating.",
    rationales: [
      "Correct. \"Corroborating\" means confirming, which is what repeated independent results do.",
      "Consistent results are the opposite of ambiguous.",
      "Nothing suggests the evidence is off-topic.",
      "Repeated confirmation makes evidence stronger, not tentative."
    ],
    steps: [
      { title: "Use the colon", body: "Everything after the colon explains the blank.", quote: "several independent experiments produced the same result" },
      { title: "Predict", body: "Your own word: \"confirming\" or \"consistent.\"" },
      { title: "Match", body: "\"Corroborating\" means confirming." }
    ],
    keyQuote: "several independent experiments produced the same result",
    hint: "The part after the colon defines the blank."
  }),
  q(CS, "Words in Context", "Hard", "rw-wic-02", {
    legacyTitle: "The sneaky secondary meaning",
    title: "Hard to find fault",
    passage: "The senator's speech was so ______ that even her critics admitted it was difficult to find fault with its reasoning.",
    prompt: LOGICAL,
    options: ["cogent", "verbose", "cursory", "polemical"],
    correctIndex: 0,
    explanation: "Critics couldn't fault the reasoning, so the speech was clear and convincing: cogent.",
    rationales: [
      "Correct. \"Cogent\" means clear, logical, and convincing, which explains why critics couldn't find fault.",
      "\"Verbose\" (wordy) wouldn't make the reasoning hard to criticize.",
      "\"Cursory\" (hasty, superficial) would make the reasoning easier to criticize.",
      "\"Polemical\" (aggressively argumentative) doesn't explain why critics agreed."
    ],
    steps: [
      { title: "Find the result", body: "The \"so ... that\" structure means the blank caused the result.", quote: "even her critics admitted it was difficult to find fault with its reasoning" },
      { title: "Predict", body: "The speech was very convincing and logical." },
      { title: "Match precisely", body: "Only \"cogent\" means logically convincing." }
    ],
    keyQuote: "even her critics admitted it was difficult to find fault with its reasoning",
    hint: "The blank must cause even critics to agree."
  }),
  q(CS, "Words in Context", "Easy", "rw-wic-03", {
    title: "Easy after all",
    passage: "Although the new scheduling software seemed ______ at first, most employees found it easy to use after a short tutorial.",
    prompt: LOGICAL,
    options: ["intuitive", "daunting", "inexpensive", "popular"],
    correctIndex: 1,
    explanation: "\"Although\" sets up a contrast with \"easy to use,\" so at first it must have seemed difficult or intimidating.",
    rationales: [
      "\"Intuitive\" means easy, so there would be no contrast with \"easy to use.\"",
      "Correct. \"Daunting\" (intimidating) contrasts with finding it easy later.",
      "Price has nothing to do with the contrast.",
      "Popularity doesn't contrast with ease of use."
    ],
    steps: [
      { title: "Spot the contrast word", body: "\"Although\" signals that the two parts disagree." },
      { title: "Predict the opposite of 'easy'", body: "At first it seemed hard or intimidating.", quote: "found it easy to use after a short tutorial" },
      { title: "Choose", body: "\"Daunting\" fits." }
    ],
    keyQuote: "most employees found it easy to use after a short tutorial",
    hint: "\"Although\" means the blank contrasts with the second half of the sentence."
  }),
  q(CS, "Words in Context", "Medium", "rw-wic-04", {
    title: "A cool reception",
    passage:
      "Archaeologist Rosa Delgado's findings were initially met with ______; many colleagues doubted that pottery so sophisticated could have been made so early. Only after additional sites were excavated did her conclusions gain wide acceptance.",
    prompt: LOGICAL,
    options: ["skepticism", "enthusiasm", "indifference", "hostility"],
    correctIndex: 0,
    explanation: "Colleagues \"doubted\" her findings, which is skepticism.",
    rationales: [
      "Correct. The next clause says colleagues doubted the findings, which is exactly skepticism.",
      "Doubt is the opposite of enthusiasm.",
      "Doubting a claim isn't the same as not caring about it.",
      "\"Hostility\" is stronger than the text supports; the colleagues doubted, they weren't described as hostile."
    ],
    steps: [
      { title: "Read past the semicolon", body: "It explains the reaction.", quote: "many colleagues doubted that pottery so sophisticated could have been made so early" },
      { title: "Predict", body: "Doubt." },
      { title: "Choose the precise word", body: "\"Skepticism\" means doubt; \"hostility\" is too strong." }
    ],
    keyQuote: "many colleagues doubted that pottery so sophisticated could have been made so early",
    hint: "What word in the next clause describes the colleagues' reaction?"
  }),
  q(CS, "Words in Context", "Hard", "rw-wic-05", {
    title: "Not a word wasted",
    passage: "The novelist's prose is notably ______: she rarely uses two words where one will do, and her chapters seldom run longer than a few pages.",
    prompt: LOGICAL,
    options: ["ornate", "economical", "whimsical", "erratic"],
    correctIndex: 1,
    explanation: "Using as few words as possible, with short chapters, describes economical prose.",
    rationales: [
      "\"Ornate\" (elaborately decorated) is the opposite of spare prose.",
      "Correct. \"Economical\" means using no more than is needed.",
      "\"Whimsical\" (playful) has nothing to do with length.",
      "\"Erratic\" (inconsistent) doesn't match a consistent habit of brevity."
    ],
    steps: [
      { title: "Use the colon", body: "The clues follow the colon.", quote: "she rarely uses two words where one will do" },
      { title: "Predict", body: "Concise, spare, efficient." },
      { title: "Match", body: "\"Economical\" means efficient, with nothing wasted." }
    ],
    keyQuote: "she rarely uses two words where one will do",
    hint: "What would you call writing that never uses an extra word?"
  }),
  q(CS, "Words in Context", "Medium", "rw-wic-06", {
    title: "Stopping short",
    passage:
      "The committee's report stopped short of ______ the proposal: although it praised the plan's goals, it recommended that the city postpone a vote until more data were available.",
    prompt: LOGICAL,
    options: ["endorsing", "criticizing", "misrepresenting", "abandoning"],
    correctIndex: 0,
    explanation: "It praised the goals but asked for a delay, so it didn't go as far as fully supporting (endorsing) the plan.",
    rationales: [
      "Correct. Praise plus a delay means the report didn't quite endorse the proposal.",
      "The report praised the goals, so \"stopped short of criticizing\" doesn't capture the tension the colon sets up.",
      "Nothing suggests the proposal was described inaccurately.",
      "The report wanted a later vote, not to abandon the plan."
    ],
    steps: [
      { title: "Understand 'stopped short of'", body: "It means the report almost did something but didn't." },
      { title: "Read the explanation", body: "It praised the goals, which is nearly support, but asked for a delay.", quote: "although it praised the plan's goals, it recommended that the city postpone a vote" },
      { title: "Choose", body: "It stopped short of endorsing." }
    ],
    keyQuote: "although it praised the plan's goals, it recommended that the city postpone a vote",
    hint: "The report came close to doing something positive. What?"
  }),

  // =====================================================================
  // Craft and Structure: Text Structure and Purpose
  // =====================================================================
  q(CS, "Text Structure and Purpose", "Medium", "rw-tsp-01", {
    legacyTitle: "What the sentence is doing",
    title: "Then and now",
    passage: "Early critics dismissed the painter's work as unfinished. Today, museums compete to display it.",
    prompt: "Which choice best describes the overall structure of the text?",
    options: [
      "It presents a problem and then a solution.",
      "It contrasts an early reaction with a later one.",
      "It describes a process step by step.",
      "It lists examples supporting one claim."
    ],
    correctIndex: 1,
    explanation: "The text moves from how the work was received then to how it is received now: a contrast over time.",
    rationales: [
      "No problem is solved; opinions simply changed.",
      "Correct. \"Early critics\" and \"Today\" frame a contrast between two reactions.",
      "No process is described.",
      "The two sentences contrast; they don't both support one claim."
    ],
    steps: [
      { title: "Label each sentence", body: "Sentence 1: early rejection. Sentence 2: current enthusiasm." },
      { title: "Name the relationship", body: "Time words (\"Early,\" \"Today\") mark a before-and-after contrast." },
      { title: "Choose", body: "{B} describes that structure." }
    ],
    keyQuote: "Today, museums compete to display it.",
    hint: "Notice the time words at the start of each sentence."
  }),
  q(CS, "Text Structure and Purpose", "Medium", "rw-tsp-02", {
    title: "Plants that signal",
    passage:
      "For decades, scientists assumed that plants were largely passive, responding to their surroundings only through slow growth. Recent experiments challenge that view. When caterpillars chew on the leaves of a thale cress plant, electrical signals travel through the plant within minutes, triggering the production of defensive chemicals in leaves that haven't been touched.",
    prompt: "Which choice best describes the main purpose of the text?",
    options: [
      "To describe research that challenges an earlier assumption about plants",
      "To explain why caterpillars prefer thale cress to other plants",
      "To argue that scientists should stop studying plant growth",
      "To compare the defensive chemicals of several plant species"
    ],
    correctIndex: 0,
    explanation: "The text states an old assumption, says new experiments challenge it, and describes one such experiment.",
    rationales: [
      "Correct. Old assumption → \"Recent experiments challenge that view\" → the evidence.",
      "Caterpillar preferences aren't discussed.",
      "Too strong; the text reports findings and doesn't tell scientists what to stop doing.",
      "Only one plant is discussed."
    ],
    steps: [
      { title: "Map the text", body: "Old view → it's challenged → example experiment." },
      { title: "Find the pivot", body: "The second sentence tells you the author's purpose.", quote: "Recent experiments challenge that view." },
      { title: "Match the verb", body: "\"Describe research that challenges\" fits; \"argue\" and \"compare\" don't." }
    ],
    keyQuote: "Recent experiments challenge that view.",
    hint: "Which short sentence tells you what the whole text is doing?"
  }),
  q(CS, "Text Structure and Purpose", "Hard", "rw-tsp-03", {
    title: "Why colonies leave",
    passage:
      "Beekeepers have long noticed that honeybee colonies sometimes abandon their hives in late summer. Some researchers have attributed this behavior to shortages of flowering plants. A long-term study of several hundred colonies, however, found that abandonments occurred even in years with plentiful flowers, and that they coincided instead with outbreaks of a parasitic mite. The researchers now suspect that the mites, not food shortages, drive most abandonments.",
    prompt: "Which choice best describes the function of the second sentence in the overall structure of the text?",
    options: [
      "It presents an explanation that the rest of the text calls into question.",
      "It provides evidence that supports the study's conclusion.",
      "It describes a method used in the long-term study.",
      "It introduces a problem that the text says has no known cause."
    ],
    correctIndex: 0,
    explanation: "Sentence 2 offers the food-shortage explanation; \"however\" then introduces evidence against it.",
    rationales: [
      "Correct. The food-shortage explanation is undercut by the study that follows (\"however\").",
      "The study's conclusion points to mites, so the food-shortage idea doesn't support it.",
      "It isn't a method; it's an earlier explanation.",
      "The text does propose a cause: mites."
    ],
    steps: [
      { title: "Find sentence 2", body: "It gives the older explanation.", quote: "Some researchers have attributed this behavior to shortages of flowering plants." },
      { title: "See how the text treats it", body: "\"However\" introduces a study that contradicts it." },
      { title: "Describe the function", body: "It's an explanation the text goes on to question: choice {A}." }
    ],
    keyQuote: "Some researchers have attributed this behavior to shortages of flowering plants.",
    hint: "Look at what the word \"however\" in the next sentence does to sentence 2."
  }),
  q(CS, "Text Structure and Purpose", "Medium", "rw-tsp-04", {
    title: "The station at Millbrook",
    passage:
      "The following text is from a short story. The narrator describes a small train station.\n\nThe station at Millbrook was a single wooden platform with a bench that nobody trusted. Twice a day the express rushed past without slowing, and the stationmaster, a thin man named Pruitt, would lift his cap to the passing windows as though greeting old friends who had forgotten him.",
    prompt: "Which choice best states the main purpose of the text?",
    options: [
      "To convey the station's isolation and the stationmaster's quiet loneliness",
      "To explain why the express train no longer stops at Millbrook",
      "To criticize the railroad company for neglecting small towns",
      "To describe the stationmaster's friendships with passengers on the express"
    ],
    correctIndex: 0,
    explanation: "Details like the untrusted bench, the train that never slows, and Pruitt greeting \"friends who had forgotten him\" create a mood of isolation and loneliness.",
    rationales: [
      "Correct. The bare platform, the passing train, and the forgotten \"friends\" all build that mood.",
      "No reason is ever given for the train not stopping.",
      "The narrator describes; there's no criticism of a company.",
      "\"As though\" signals comparison: the passengers aren't really his friends."
    ],
    steps: [
      { title: "Collect the details", body: "A single platform, a bench nobody trusts, an express that never slows." },
      { title: "Read the simile carefully", body: "\"As though\" means it only seems like a greeting to friends.", quote: "as though greeting old friends who had forgotten him" },
      { title: "Name the purpose", body: "The details build a picture of isolation and loneliness." }
    ],
    keyQuote: "as though greeting old friends who had forgotten him",
    hint: "What mood do all the details have in common?"
  }),
  q(CS, "Text Structure and Purpose", "Easy", "rw-tsp-05", {
    title: "See-through frogs",
    passage:
      "Glass frogs, found in rainforests of Central and South America, have translucent skin on their undersides. When a glass frog rests on a leaf, light passes through its body, making the frog far harder for predators to spot. Researchers recently found that sleeping glass frogs also store most of their red blood cells in their livers, which makes their bodies even more transparent.",
    prompt: "Which choice best describes the overall structure of the text?",
    options: [
      "It describes a trait of an animal and then presents a related recent finding.",
      "It presents a hypothesis and then explains why it was rejected.",
      "It compares two species of frogs and their predators.",
      "It describes a problem researchers faced and how they solved it."
    ],
    correctIndex: 0,
    explanation: "Sentences 1–2 describe the frogs' transparency; sentence 3 adds a recent discovery about it.",
    rationales: [
      "Correct. Trait (translucent skin, camouflage), then a related new finding (hiding blood cells).",
      "No hypothesis is rejected.",
      "Only one kind of frog is discussed.",
      "No research problem is described."
    ],
    steps: [
      { title: "Label the parts", body: "Trait → why it helps → new research about it." },
      { title: "Spot the signal", body: "\"Researchers recently found\" introduces the new finding.", quote: "Researchers recently found" },
      { title: "Choose", body: "A matches that order." }
    ],
    keyQuote: "Researchers recently found that sleeping glass frogs also store most of their red blood cells in their livers",
    hint: "What does the last sentence add to the first two?"
  }),
  q(CS, "Text Structure and Purpose", "Hard", "rw-tsp-06", {
    title: "What GDP misses",
    passage:
      "Economists often measure a country's well-being using gross domestic product (GDP), the total value of the goods and services it produces. Critics point out that GDP rises when a country spends money cleaning up after a disaster, even though no one is better off than before the disaster occurred. For this reason, some economists advocate supplementing GDP with measures of health, education, and environmental quality.",
    prompt: "Which choice best describes the function of the second sentence in the overall structure of the text?",
    options: [
      "It gives an example that illustrates a limitation of GDP as a measure of well-being.",
      "It explains how GDP is calculated.",
      "It presents evidence that disasters improve economic well-being.",
      "It introduces the alternative measures that some economists prefer."
    ],
    correctIndex: 0,
    explanation: "The disaster example shows GDP rising while no one is better off, which is a flaw in using GDP to measure well-being.",
    rationales: [
      "Correct. The cleanup example shows a case where GDP and well-being come apart.",
      "The first sentence defines GDP; the second doesn't explain a calculation.",
      "It says the opposite: no one is better off.",
      "The alternative measures appear in the third sentence."
    ],
    steps: [
      { title: "Read sentence 2 alone", body: "GDP goes up after a disaster, but no one is better off.", quote: "even though no one is better off than before the disaster occurred" },
      { title: "Connect it to the text", body: "It shows a mismatch between GDP and well-being, and sentence 3 responds to that flaw." },
      { title: "Choose", body: "{A}: an example illustrating a limitation." }
    ],
    keyQuote: "even though no one is better off than before the disaster occurred",
    hint: "What does the disaster example reveal about GDP?"
  }),

  // =====================================================================
  // Craft and Structure: Cross-Text Connections
  // =====================================================================
  q(CS, "Cross-Text Connections", "Medium", "rw-ctc-01", {
    title: "Is breakfast the key?",
    passage:
      "Text 1\nMany nutrition researchers argue that breakfast is the most important meal of the day. They point to studies showing that people who eat breakfast tend to have healthier body weights than people who skip it, and they conclude that eating breakfast helps people control their weight.\n\nText 2\nStudies linking breakfast to healthy weight are mostly observational: they compare people who happen to eat breakfast with people who don't. Such people may differ in many other ways, such as how much they exercise. When researchers randomly assigned participants to eat or skip breakfast, the groups' weight changes were nearly identical.",
    prompt: "Based on the texts, how would the author of Text 2 most likely respond to the conclusion of the researchers in Text 1?",
    options: [
      "By agreeing that breakfast is the most important factor in controlling weight",
      "By arguing that the evidence they cite doesn't show that eating breakfast causes weight control",
      "By claiming that people who skip breakfast exercise more than people who eat it",
      "By insisting that observational studies of diet are always inaccurate"
    ],
    correctIndex: 1,
    explanation: "Text 2 says the Text 1 evidence is observational and that a randomized experiment found no difference, so it challenges the causal conclusion.",
    rationales: [
      "Text 2's experiment found no weight difference, so it would not agree.",
      "Correct. Text 2 questions whether breakfast causes weight control, since the observational data can't show that and the experiment found no effect.",
      "Text 2 says the groups \"may differ\" in exercise; it doesn't claim which group exercises more.",
      "\"Always inaccurate\" is too extreme; Text 2 only says observational studies can't isolate the cause."
    ],
    steps: [
      { title: "Text 1's claim", body: "Breakfast helps control weight, based on comparisons of eaters and skippers.", quote: "they conclude that eating breakfast helps people control their weight" },
      { title: "Text 2's claim", body: "Those studies are observational; a randomized test showed no difference.", quote: "the groups' weight changes were nearly identical" },
      { title: "Predict the response", body: "Text 2's author would say the evidence doesn't prove cause and effect: choice {B}." }
    ],
    keyQuote: "When researchers randomly assigned participants to eat or skip breakfast, the groups' weight changes were nearly identical.",
    hint: "Text 2 criticizes the kind of study Text 1 relies on. What's the problem with it?"
  }),
  q(CS, "Cross-Text Connections", "Hard", "rw-ctc-02", {
    title: "Steam and the mill towns",
    passage:
      "Text 1\nHistorians have traditionally credited the rapid growth of 19th-century Manchester to the steam engine, which freed textile mills from having to be built beside fast-moving rivers. Once mills could be located anywhere, the argument goes, they clustered in cities where workers were plentiful.\n\nText 2\nRecords from Lancashire mills complicate the steam-engine story. As late as the 1830s, water wheels still powered a substantial share of the region's cotton mills, and many early steam-powered mills were built along rivers anyway, because their boilers needed a reliable supply of water. The move to cities, these records suggest, was gradual and depended as much on canals and railways as on steam.",
    prompt: "Based on the texts, how would the author of Text 2 most likely respond to the traditional explanation described in Text 1?",
    options: [
      "The explanation is correct but overlooks the role of water wheels in powering steam engines.",
      "The explanation overstates the steam engine's role, since other factors also shaped where mills were located.",
      "The explanation is wrong because Manchester's population didn't grow in the 19th century.",
      "The explanation is supported by the fact that many steam-powered mills were built along rivers."
    ],
    correctIndex: 1,
    explanation: "Text 2 doesn't deny steam mattered but says the shift was gradual and \"depended as much on canals and railways as on steam\": steam's role was overstated.",
    rationales: [
      "Water wheels didn't power steam engines; this garbles Text 2's point.",
      "Correct. Text 2 qualifies the traditional story: steam mattered, but canals and railways mattered just as much.",
      "Text 2 never disputes Manchester's growth.",
      "Mills along rivers undercut the idea that steam freed mills from rivers, so this weakens, not supports, the traditional view."
    ],
    steps: [
      { title: "Text 1 in brief", body: "Steam engines freed mills from rivers, so they moved to cities." },
      { title: "Text 2 in brief", body: "The move was gradual and had several causes.", quote: "depended as much on canals and railways as on steam" },
      { title: "Relationship", body: "Text 2 qualifies (partly disagrees with) Text 1. It doesn't reject steam entirely, so choice {B} is the right strength." }
    ],
    keyQuote: "depended as much on canals and railways as on steam",
    hint: "Does Text 2 say steam didn't matter at all, or that it wasn't the whole story?"
  }),
  q(CS, "Cross-Text Connections", "Medium", "rw-ctc-03", {
    title: "Music that listens back",
    passage:
      "Text 1\nSome critics dismiss video game soundtracks as background noise, written to fill silence rather than to be heard. On this view, game music lacks the ambition of film scores, which are composed to shape an audience's emotions at every moment.\n\nText 2\nComposers for games face a challenge film composers never do: they can't know how long a player will stay in a scene. Many respond by writing music in layers that enter and fade as the player acts, so that the score reacts to each choice. This adaptive writing demands careful planning of how every layer will sound in combination with the others.",
    prompt: "Based on the texts, how would the author of Text 2 most likely respond to the critics' view described in Text 1?",
    options: [
      "By agreeing that game music is mainly meant to fill silence",
      "By pointing out that adaptive game music requires ambitious planning that film scoring doesn't",
      "By arguing that film scores are less emotional than game soundtracks",
      "By noting that most players turn off game music while playing"
    ],
    correctIndex: 1,
    explanation: "Critics say game music lacks ambition; Text 2 describes a challenge unique to games that demands careful, complex planning.",
    rationales: [
      "Text 2 describes deliberate, reactive music, not filler.",
      "Correct. Text 2's point about layered, adaptive music directly answers the charge that game music lacks ambition.",
      "Text 2 never compares how emotional the two forms are.",
      "Players turning off music is never mentioned."
    ],
    steps: [
      { title: "The critics' claim", body: "Game music is filler without ambition.", quote: "game music lacks the ambition of film scores" },
      { title: "Text 2's point", body: "Games create a unique challenge that composers solve with complex layered writing.", quote: "This adaptive writing demands careful planning" },
      { title: "Predict", body: "Text 2 would push back by showing the ambition involved: choice {B}." }
    ],
    keyQuote: "This adaptive writing demands careful planning of how every layer will sound in combination with the others.",
    hint: "The critics say game music lacks ambition. What in Text 2 answers that?"
  }),
  q(CS, "Cross-Text Connections", "Hard", "rw-ctc-04", {
    title: "Keystone overload",
    passage:
      "Text 1\nEcologists use the term \"keystone species\" for animals whose effect on an ecosystem is far larger than their numbers suggest. Sea otters are a classic example: by eating sea urchins, which graze on kelp, otters allow kelp forests to thrive.\n\nText 2\nThe keystone label has become so popular that it is now applied to dozens of species, often with little evidence. When a term stretches to cover nearly any animal that affects its habitat, it stops distinguishing truly exceptional cases like the sea otter from ordinary ones. Ecologists should reserve the label for species whose outsized effect has been demonstrated.",
    prompt: "Based on the texts, how would the author of Text 2 most likely view the sea otter example in Text 1?",
    options: [
      "As an appropriate use of the keystone label that shows the concept's value",
      "As evidence that the keystone label should be abandoned",
      "As an example of the label being applied with little evidence",
      "As a case in which kelp, not otters, is the true keystone species"
    ],
    correctIndex: 0,
    explanation: "Text 2 calls the sea otter one of the \"truly exceptional cases,\" so it sees this as a proper use of the term.",
    rationales: [
      "Correct. Text 2 explicitly names the sea otter as a truly exceptional case that deserves the label.",
      "Text 2 wants the label used more carefully, not abandoned.",
      "Text 2 criticizes other uses; it treats the sea otter as the model of a good one.",
      "Nothing suggests kelp is the keystone species."
    ],
    steps: [
      { title: "Text 2's main point", body: "The label is overused; save it for proven cases." },
      { title: "Find the otter in Text 2", body: "Text 2 mentions the otter directly.", quote: "truly exceptional cases like the sea otter" },
      { title: "Conclude", body: "Text 2 approves of the otter example: choice {A}." }
    ],
    keyQuote: "truly exceptional cases like the sea otter",
    hint: "Text 2 mentions sea otters by name. How does it describe them?"
  }),
  q(CS, "Cross-Text Connections", "Medium", "rw-ctc-05", {
    title: "The four-day school week",
    passage:
      "Text 1\nFour-day school weeks have spread across rural districts in the United States, largely to save money on transportation and utilities. Supporters report that teachers are easier to recruit and that students use the fifth day for jobs, family time, or catching up on work.\n\nText 2\nResearchers comparing districts that adopted four-day weeks with similar districts that didn't found that students' test-score gains were slightly smaller in the four-day districts. The researchers caution that the effect was modest and varied widely, but they argue that districts should weigh academic effects alongside savings.",
    prompt: "Based on the texts, how would the researchers in Text 2 most likely respond to the supporters described in Text 1?",
    options: [
      "By acknowledging possible benefits of the schedule while noting academic costs that should also be considered",
      "By arguing that four-day weeks save less money than supporters claim",
      "By agreeing that four-day weeks improve both teacher recruitment and achievement",
      "By insisting that all districts return to five-day weeks immediately"
    ],
    correctIndex: 0,
    explanation: "The researchers found modest academic costs and ask districts to weigh them \"alongside savings,\" a balanced response.",
    rationales: [
      "Correct. \"Weigh academic effects alongside savings\" accepts the benefits while adding a cost.",
      "Text 2 doesn't dispute the savings.",
      "Text 2 found slightly smaller gains, not improved achievement.",
      "Far too strong; the researchers call the effect modest and variable."
    ],
    steps: [
      { title: "Supporters' view", body: "The schedule saves money and has other benefits." },
      { title: "Researchers' view", body: "There's a small academic cost; weigh it too.", quote: "districts should weigh academic effects alongside savings" },
      { title: "Choose the right strength", body: "{A} is balanced like Text 2; {D} is far too extreme." }
    ],
    keyQuote: "they argue that districts should weigh academic effects alongside savings",
    hint: "Text 2's final sentence is measured, not extreme. Look for a choice with the same tone."
  }),

  // =====================================================================
  // Expression of Ideas: Rhetorical Synthesis
  // =====================================================================
  q(EI, "Rhetorical Synthesis", "Hard", "rw-rs-01", {
    legacyTitle: "Meet the goal, not the notes",
    title: "Meet the goal, not the notes",
    passage:
      "While researching a topic, a student has taken the following notes:\n• The Hubble Space Telescope launched in 1990.\n• Hubble observes mainly visible and ultraviolet light.\n• The James Webb Space Telescope launched in 2021.\n• Webb observes mainly infrared light.",
    prompt: "The student wants to emphasize a difference in the kinds of light the two telescopes observe. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
    options: [
      "Hubble and Webb are both space telescopes.",
      "While Hubble observes mainly visible and ultraviolet light, Webb observes mainly infrared light.",
      "Webb launched in 2021, many years after Hubble.",
      "Both telescopes have produced famous images."
    ],
    correctIndex: 1,
    explanation: "Only {B} contrasts the kinds of light (\"While ... \"), which is exactly the goal.",
    rationales: [
      "This is a similarity, not a difference.",
      "Correct. \"While\" sets up the contrast, and it names each telescope's kind of light.",
      "This is a difference, but in launch dates, not in the light observed.",
      "A similarity, and it isn't in the notes."
    ],
    steps: [
      { title: "Read the goal first", body: "A difference in the kinds of light observed.", quote: "emphasize a difference in the kinds of light the two telescopes observe" },
      { title: "Filter the choices", body: "Drop similarities ({A}, {D}) and differences about something else ({C})." },
      { title: "Choose", body: "{B} is the only choice that contrasts the light." }
    ],
    keyQuote: "Hubble observes mainly visible and ultraviolet light",
    hint: "Read the goal carefully: a difference in what, exactly?"
  }),
  q(EI, "Rhetorical Synthesis", "Medium", "rw-rs-02", {
    title: "Introducing Merian's book",
    passage:
      "While researching a topic, a student has taken the following notes:\n• Maria Sibylla Merian (1647–1717) was a German-born naturalist and artist.\n• In 1699, she traveled to Suriname to study insects.\n• She documented the full life cycles of butterflies and moths, from egg to adult.\n• Her book Metamorphosis insectorum Surinamensium was published in 1705.",
    prompt: "The student wants to introduce Merian's book to an audience unfamiliar with Merian. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
    options: [
      "Metamorphosis insectorum Surinamensium was published in 1705.",
      "German-born naturalist and artist Maria Sibylla Merian published Metamorphosis insectorum Surinamensium in 1705, after traveling to Suriname to study insects.",
      "Merian documented the life cycles of butterflies and moths.",
      "In 1699, Merian traveled to Suriname."
    ],
    correctIndex: 1,
    explanation: "An unfamiliar audience needs to know who Merian was and what the book is. {B} introduces both.",
    rationales: [
      "It names the book but never introduces Merian.",
      "Correct. It identifies Merian (naturalist and artist) and presents the book with context.",
      "It doesn't mention the book.",
      "It doesn't mention the book."
    ],
    steps: [
      { title: "Goal", body: "Introduce the book, to readers who don't know Merian.", quote: "introduce Merian's book to an audience unfamiliar with Merian" },
      { title: "What's required", body: "The sentence must name the book and explain who Merian was." },
      { title: "Choose", body: "Only {B} does both." }
    ],
    keyQuote: "Her book Metamorphosis insectorum Surinamensium was published in 1705.",
    hint: "An audience that doesn't know Merian needs to be told who she was."
  }),
  q(EI, "Rhetorical Synthesis", "Hard", "rw-rs-03", {
    title: "Bamboo versus timber",
    passage:
      "While researching a topic, a student has taken the following notes:\n• Some bamboo species can grow up to 91 centimeters in a single day.\n• Most timber trees take 20 to 50 years to reach a harvestable size.\n• Bamboo can be harvested every 3 to 5 years.\n• Both bamboo and timber are used in construction.",
    prompt: "The student wants to emphasize how much sooner bamboo can be harvested than timber trees. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
    options: [
      "Some bamboo species can grow up to 91 centimeters in a single day.",
      "Bamboo and timber are both used in construction.",
      "While most timber trees take 20 to 50 years to reach a harvestable size, bamboo can be harvested every 3 to 5 years.",
      "Most timber trees take 20 to 50 years to reach a harvestable size."
    ],
    correctIndex: 2,
    explanation: "The goal is a comparison of harvest times. {C} puts both harvest times side by side.",
    rationales: [
      "This is about growth speed, not harvest time, and it doesn't mention timber.",
      "This is a similarity.",
      "Correct. It compares the two harvest times directly.",
      "It gives only timber's harvest time, with no comparison."
    ],
    steps: [
      { title: "Goal", body: "Compare harvest times, and emphasize that bamboo is sooner." },
      { title: "Find the two facts needed", body: "Timber: 20–50 years. Bamboo: every 3–5 years.", quote: "Bamboo can be harvested every 3 to 5 years." },
      { title: "Choose", body: "{C} includes both facts in a contrast." }
    ],
    keyQuote: "Bamboo can be harvested every 3 to 5 years.",
    hint: "A comparison needs information about both plants."
  }),
  q(EI, "Rhetorical Synthesis", "Medium", "rw-rs-04", {
    title: "Describe the method",
    passage:
      "While researching a topic, a student has taken the following notes:\n• A team of researchers studied whether classroom plants affect students' concentration.\n• They placed plants in half of 20 classrooms and left the other classrooms unchanged.\n• After four weeks, students in all 20 classrooms completed the same attention test.\n• Students in classrooms with plants scored about 10% higher on average.",
    prompt: "The student wants to describe the method the researchers used. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
    options: [
      "Students in classrooms with plants scored about 10% higher on an attention test.",
      "The researchers placed plants in half of 20 classrooms, left the rest unchanged, and gave all the students the same attention test four weeks later.",
      "Classroom plants may help students concentrate.",
      "The researchers wanted to know whether classroom plants affect concentration."
    ],
    correctIndex: 1,
    explanation: "A method is what the researchers did. {B} describes the setup and the test.",
    rationales: [
      "That's the result, not the method.",
      "Correct. It describes what was done: plants in half the rooms, a control group, and the same test for everyone.",
      "That's a conclusion.",
      "That's the research question, not the method."
    ],
    steps: [
      { title: "Goal", body: "Describe the method: what the researchers did." },
      { title: "Sort the notes", body: "Note 1 = question, notes 2–3 = method, note 4 = result.", quote: "They placed plants in half of 20 classrooms" },
      { title: "Choose", body: "{B} uses the method notes." }
    ],
    keyQuote: "They placed plants in half of 20 classrooms and left the other classrooms unchanged.",
    hint: "Sort the notes into question, method, and result."
  }),
  q(EI, "Rhetorical Synthesis", "Easy", "rw-rs-05", {
    title: "Two American painters",
    passage:
      "While researching a topic, a student has taken the following notes:\n• Georgia O'Keeffe (1887–1986) was an American painter.\n• O'Keeffe is known for large, close-up paintings of flowers.\n• Mary Cassatt (1844–1926) was an American painter.\n• Cassatt is known for paintings of everyday domestic life, especially mothers and children.",
    prompt: "The student wants to emphasize a similarity between the two painters. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
    options: [
      "O'Keeffe painted large, close-up flowers, while Cassatt painted mothers and children.",
      "Both Georgia O'Keeffe and Mary Cassatt were American painters.",
      "Mary Cassatt, who lived from 1844 to 1926, painted scenes of domestic life.",
      "O'Keeffe lived longer than Cassatt did."
    ],
    correctIndex: 1,
    explanation: "The only shared trait in the notes is that both were American painters.",
    rationales: [
      "This emphasizes a difference.",
      "Correct. \"Both ... were American painters\" states a similarity.",
      "This describes only Cassatt.",
      "This is a difference."
    ],
    steps: [
      { title: "Goal", body: "A similarity." },
      { title: "Find what they share", body: "Notes 1 and 3: both were American painters.", quote: "was an American painter" },
      { title: "Choose", body: "{B}." }
    ],
    keyQuote: "Georgia O'Keeffe (1887–1986) was an American painter.",
    hint: "What do the two painters have in common in the notes?"
  }),
  q(EI, "Rhetorical Synthesis", "Easy", "rw-rs-06", {
    title: "A very long wall",
    passage:
      "While researching a topic, a student has taken the following notes:\n• The Great Wall of China is a series of fortifications in northern China.\n• Construction took place over many centuries, beginning as early as the 7th century BCE.\n• Including all its branches, the wall's total length is about 21,000 kilometers.\n• Many sections visited today were built during the Ming dynasty (1368–1644).",
    prompt: "The student wants to emphasize the wall's great length. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
    options: [
      "Construction of the Great Wall began as early as the 7th century BCE.",
      "Including all its branches, the Great Wall of China stretches about 21,000 kilometers.",
      "Many sections of the Great Wall were built during the Ming dynasty.",
      "The Great Wall is a series of fortifications in northern China."
    ],
    correctIndex: 1,
    explanation: "Only {B} mentions length.",
    rationales: [
      "That's about age, not length.",
      "Correct. It gives the length, the one thing the goal asks for.",
      "That's about when sections were built.",
      "That's about what the wall is, not how long it is."
    ],
    steps: [
      { title: "Goal", body: "Length." },
      { title: "Find the length note", body: "Note 3 gives it.", quote: "about 21,000 kilometers" },
      { title: "Choose", body: "{B}." }
    ],
    keyQuote: "Including all its branches, the wall's total length is about 21,000 kilometers.",
    hint: "Which note gives a length?"
  }),

  // =====================================================================
  // Expression of Ideas: Transitions
  // =====================================================================
  q(EI, "Transitions", "Easy", "rw-tr-01", {
    legacyTitle: "The contrast signal",
    title: "The contrast signal",
    passage: "The city expected its new bike lanes to be used mostly on weekends. ______ weekday commuters accounted for 70% of all trips.",
    prompt: TRANSITION,
    options: ["Similarly,", "For example,", "However,", "Therefore,"],
    correctIndex: 2,
    explanation: "The second sentence contradicts the city's expectation, so a contrast transition is needed.",
    rationales: [
      "\"Similarly\" signals agreement, but the sentences conflict.",
      "The second sentence isn't an example of the first.",
      "Correct. Expected weekends, but actually weekdays: a contrast.",
      "The second sentence isn't a consequence of the first."
    ],
    steps: [
      { title: "Cover the choices", body: "Read both sentences on their own." },
      { title: "Name the relationship", body: "Expectation versus reality: a contrast.", quote: "expected its new bike lanes to be used mostly on weekends" },
      { title: "Choose", body: "\"However\" signals contrast." }
    ],
    keyQuote: "The city expected its new bike lanes to be used mostly on weekends.",
    hint: "Does the second sentence agree with the first, or surprise you?"
  }),
  q(EI, "Transitions", "Medium", "rw-tr-02", {
    title: "Operators to machines",
    passage:
      "Early telephone systems required human operators to connect every call by hand. ______ as the number of subscribers grew, telephone companies began installing automatic switching equipment.",
    prompt: TRANSITION,
    options: ["Eventually,", "For instance,", "Nevertheless,", "Similarly,"],
    correctIndex: 0,
    explanation: "The text moves forward in time, from early manual systems to later automatic ones.",
    rationales: [
      "Correct. \"Eventually\" marks the later development.",
      "The second sentence isn't an example of manual connection.",
      "Nothing is being conceded; this is a sequence over time.",
      "The two methods are different, not similar."
    ],
    steps: [
      { title: "Relationship", body: "Early → later: a time sequence.", quote: "Early telephone systems" },
      { title: "Look for time words", body: "\"as the number of subscribers grew\" shows time passing." },
      { title: "Choose", body: "\"Eventually\" fits a sequence." }
    ],
    keyQuote: "Early telephone systems required human operators to connect every call by hand.",
    hint: "The first sentence says \"Early.\" What happened later?"
  }),
  q(EI, "Transitions", "Hard", "rw-tr-03", {
    title: "Arms that think",
    passage:
      "The octopus has an unusual nervous system: about two-thirds of its neurons are located in its arms rather than its brain. ______ each arm can respond to touch and taste on its own, even when the brain isn't directing it.",
    prompt: TRANSITION,
    options: ["In contrast,", "As a result,", "Nonetheless,", "Previously,"],
    correctIndex: 1,
    explanation: "Because the arms contain so many neurons, they can act on their own: cause and effect.",
    rationales: [
      "The second sentence builds on the first; it doesn't contrast with it.",
      "Correct. Neurons in the arms (cause) → arms respond independently (effect).",
      "\"Nonetheless\" implies the second fact is surprising given the first, but it's expected.",
      "There's no earlier-versus-later sequence."
    ],
    steps: [
      { title: "Relationship", body: "Is sentence 2 caused by sentence 1? Yes: neurons in the arms let the arms act alone.", quote: "two-thirds of its neurons are located in its arms" },
      { title: "Eliminate", body: "No contrast ({A}, {C}) and no time sequence ({D})." },
      { title: "Choose", body: "\"As a result\" signals cause and effect." }
    ],
    keyQuote: "about two-thirds of its neurons are located in its arms rather than its brain",
    hint: "Is the second sentence a consequence of the first?"
  }),
  q(EI, "Transitions", "Medium", "rw-tr-04", {
    title: "Cold deserts",
    passage: "Many people assume that deserts are always hot. ______ the Gobi Desert regularly experiences winter temperatures below −30°C.",
    prompt: TRANSITION,
    options: ["However,", "Therefore,", "Likewise,", "In addition,"],
    correctIndex: 0,
    explanation: "The Gobi fact contradicts the common assumption, so the relationship is contrast.",
    rationales: [
      "Correct. A cold desert contradicts the assumption that deserts are always hot.",
      "The cold temperatures aren't caused by the assumption.",
      "\"Likewise\" signals similarity.",
      "\"In addition\" adds a supporting point; this one contradicts."
    ],
    steps: [
      { title: "Read both sentences", body: "Assumption: deserts are hot. Fact: a desert gets extremely cold." },
      { title: "Relationship", body: "The fact contradicts the assumption.", quote: "Many people assume that deserts are always hot." },
      { title: "Choose", body: "\"However.\"" }
    ],
    keyQuote: "Many people assume that deserts are always hot.",
    hint: "Does the Gobi example support or undercut the assumption?"
  }),
  q(EI, "Transitions", "Hard", "rw-tr-05", {
    title: "Playing the strongest",
    passage:
      "As an adult, chess grandmaster Judit Polgár chose not to compete in women-only tournaments, preferring to face the strongest opponents regardless of gender. ______ she became the only woman ever to rank among the world's top ten players.",
    prompt: TRANSITION,
    options: ["Ultimately,", "Conversely,", "For instance,", "Meanwhile,"],
    correctIndex: 0,
    explanation: "The second sentence describes where her career led: an eventual outcome.",
    rationales: [
      "Correct. \"Ultimately\" introduces the eventual outcome of her approach.",
      "Nothing is reversed or opposed.",
      "Reaching the top ten isn't an example of avoiding women-only events.",
      "\"Meanwhile\" suggests something happening at the same time, not an outcome."
    ],
    steps: [
      { title: "Relationship", body: "Her choice → where her career eventually led." },
      { title: "Eliminate", body: "Not a contrast ({B}), not an example ({C}), not simultaneous ({D})." },
      { title: "Choose", body: "\"Ultimately\" signals the final outcome.", quote: "she became the only woman ever to rank among the world's top ten players" }
    ],
    keyQuote: "preferring to face the strongest opponents regardless of gender",
    hint: "Is the second sentence an example, a contrast, or an outcome?"
  }),
  q(EI, "Transitions", "Easy", "rw-tr-06", {
    title: "Dances and trails",
    passage: "Honeybees tell nestmates where food is by dancing. Ants, ______ lay down chemical trails that other ants can follow.",
    prompt: TRANSITION,
    options: ["on the other hand,", "for example,", "therefore,", "in other words,"],
    correctIndex: 0,
    explanation: "Bees and ants use different methods, so the relationship is contrast.",
    rationales: [
      "Correct. It contrasts the ants' method with the bees'.",
      "Ants aren't an example of bee dancing.",
      "Ants' trails aren't a consequence of bee dances.",
      "Trails don't restate dancing; they're a different method."
    ],
    steps: [
      { title: "Compare", body: "Bees dance; ants leave trails." },
      { title: "Relationship", body: "Two different methods: contrast.", quote: "lay down chemical trails" },
      { title: "Choose", body: "\"On the other hand.\"" }
    ],
    keyQuote: "Honeybees tell nestmates where food is by dancing.",
    hint: "Do bees and ants use the same method or different ones?"
  }),

  // =====================================================================
  // Standard English Conventions: Boundaries
  // =====================================================================
  q(SEC, "Boundaries", "Medium", "rw-bnd-01", {
    legacyTitle: "The comma splice that looks right",
    title: "The comma splice that looks right",
    passage: "The committee reviewed the ______ approved the final version after lunch.",
    prompt: COMPLETE,
    options: ["proposal, it", "proposal; it", "proposal it", "proposal, it,"],
    correctIndex: 1,
    explanation: "Both halves are independent clauses. A semicolon can join them; a comma alone creates a comma splice.",
    rationales: [
      "A comma alone between two independent clauses is a comma splice.",
      "Correct. A semicolon correctly joins two independent clauses.",
      "No punctuation creates a run-on sentence.",
      "Still a comma splice, plus an extra comma between the subject \"it\" and its verb."
    ],
    steps: [
      { title: "Find the clauses", body: "\"The committee reviewed the proposal\" and \"it approved the final version\" can each stand alone." },
      { title: "Apply the rule", body: "Two independent clauses need a period, a semicolon, or a comma plus FANBOYS." },
      { title: "Choose", body: "Only the semicolon works." }
    ],
    keyQuote: "approved the final version after lunch",
    hint: "Could each side of the blank be its own sentence?"
  }),
  q(SEC, "Boundaries", "Medium", "rw-bnd-02", {
    legacyTitle: "Colon before a list",
    title: "Colon before a list",
    passage: "The expedition carried three ______ water filters, satellite phones, and spare batteries.",
    prompt: COMPLETE,
    options: ["essentials:", "essentials;", "essentials, and", "essentials"],
    correctIndex: 0,
    explanation: "A colon introduces a list after a complete independent clause.",
    rationales: [
      "Correct. \"The expedition carried three essentials\" is complete, so a colon can introduce the list.",
      "A semicolon needs an independent clause on both sides; the list isn't one.",
      "\"And\" makes the list sound like extra items rather than the three essentials.",
      "No punctuation runs \"essentials\" straight into the list, which is ungrammatical."
    ],
    steps: [
      { title: "Check the first part", body: "\"The expedition carried three essentials\" is a complete clause." },
      { title: "Check the second part", body: "A list that names the three essentials." },
      { title: "Rule", body: "Complete clause + list → colon." }
    ],
    keyQuote: "water filters, satellite phones, and spare batteries",
    hint: "What punctuation introduces a list after a complete sentence?"
  }),
  q(SEC, "Boundaries", "Medium", "rw-bnd-03", {
    title: "Fleming's contaminated dish",
    passage:
      "In 1928, Alexander Fleming noticed that mold had contaminated one of his bacterial ______ bacteria near the mold had been destroyed.",
    prompt: COMPLETE,
    options: ["cultures, the", "cultures; the", "cultures the", "cultures and, the"],
    correctIndex: 1,
    explanation: "Two independent clauses must be joined by a semicolon (or a period, or a comma plus a conjunction).",
    rationales: [
      "A comma alone between two independent clauses is a comma splice.",
      "Correct. The semicolon joins two independent clauses.",
      "No punctuation creates a run-on.",
      "The comma after \"and\" is misplaced."
    ],
    steps: [
      { title: "Split the sentence", body: "\"Fleming noticed ... cultures\" / \"the bacteria near the mold had been destroyed.\"" },
      { title: "Both are independent", body: "Each has a subject and verb and can stand alone." },
      { title: "Choose", body: "The semicolon." }
    ],
    keyQuote: "bacteria near the mold had been destroyed",
    hint: "Can \"the bacteria near the mold had been destroyed\" stand alone?"
  }),
  q(SEC, "Boundaries", "Hard", "rw-bnd-04", {
    title: "Closing the pair",
    passage:
      "The Svalbard Global Seed Vault, built into a mountain on a remote Norwegian ______ holds more than a million seed samples from around the world.",
    prompt: COMPLETE,
    options: ["island,", "island;", "island—", "island"],
    correctIndex: 0,
    explanation: "The phrase \"built into a mountain ...\" opens with a comma, so it must close with a comma.",
    rationales: [
      "Correct. The comma closes the pair around the extra phrase.",
      "A semicolon would separate the subject from its verb \"holds.\"",
      "A dash can't close a phrase that opened with a comma.",
      "Without a closing comma, the extra phrase runs into the verb."
    ],
    steps: [
      { title: "Find the extra phrase", body: "\"built into a mountain on a remote Norwegian island\" adds information about the vault.", quote: "The Svalbard Global Seed Vault, built into a mountain" },
      { title: "Match the punctuation", body: "It opens with a comma, so it must close with a comma." },
      { title: "Check", body: "Remove the phrase: \"The Svalbard Global Seed Vault holds ...\" still works." }
    ],
    keyQuote: "The Svalbard Global Seed Vault, built into a mountain",
    hint: "Look at how the extra phrase begins."
  }),
  q(SEC, "Boundaries", "Hard", "rw-bnd-05", {
    title: "An explanation follows",
    passage:
      "The results surprised the research ______ supposedly inactive volcano had released more gas in one month than in the previous ten years.",
    prompt: COMPLETE,
    options: ["team: the", "team, the", "team the", "team, which the"],
    correctIndex: 0,
    explanation: "The second clause explains why the team was surprised, and a colon can introduce an explanation after a complete clause.",
    rationales: [
      "Correct. A complete clause followed by a colon introducing its explanation.",
      "Comma splice: two independent clauses joined only by a comma.",
      "Run-on sentence.",
      "\"Which\" makes the second part ungrammatical."
    ],
    steps: [
      { title: "First clause", body: "\"The results surprised the research team\" is complete." },
      { title: "Second clause", body: "It explains the surprise.", quote: "supposedly inactive volcano had released more gas" },
      { title: "Rule", body: "A colon can introduce an explanation after a complete clause." }
    ],
    keyQuote: "supposedly inactive volcano had released more gas in one month than in the previous ten years",
    hint: "The second half explains the first. Which punctuation mark introduces an explanation?"
  }),
  q(SEC, "Boundaries", "Easy", "rw-bnd-06", {
    title: "Too many tomatoes",
    passage: "My grandmother's garden produces more tomatoes than she can ______ shares the extra with her neighbors.",
    prompt: COMPLETE,
    options: ["eat, so she", "eat, she", "eat she", "eat; so, she"],
    correctIndex: 0,
    explanation: "Two independent clauses joined by a comma plus a FANBOYS conjunction (\"so\") are correct.",
    rationales: [
      "Correct. Comma + \"so\" joins two independent clauses.",
      "Comma splice.",
      "Run-on.",
      "The comma after \"so\" is incorrect."
    ],
    steps: [
      { title: "Two clauses", body: "\"...more tomatoes than she can eat\" and \"she shares the extra ...\"" },
      { title: "Options for joining", body: "A period, a semicolon, or a comma + FANBOYS." },
      { title: "Choose", body: "\"eat, so she\" uses comma + FANBOYS." }
    ],
    keyQuote: "shares the extra with her neighbors",
    hint: "FANBOYS: for, and, nor, but, or, yet, so."
  }),
  q(SEC, "Boundaries", "Hard", "rw-bnd-07", {
    title: "No comma between subject and verb",
    passage:
      "The biologist who first described the deep-sea anglerfish's glowing ______ that the light came from bacteria living inside it.",
    prompt: COMPLETE,
    options: ["lure suspected", "lure, suspected", "lure; suspected", "lure: suspected"],
    correctIndex: 0,
    explanation: "\"The biologist ... lure\" is the subject and \"suspected\" is its verb. No punctuation goes between them.",
    rationales: [
      "Correct. A subject and its verb shouldn't be separated by punctuation.",
      "The comma splits the subject from its verb.",
      "A semicolon needs independent clauses on both sides.",
      "A colon can't come between a subject and its verb."
    ],
    steps: [
      { title: "Find the subject", body: "\"The biologist who first described the ... glowing lure\" (a long subject)." },
      { title: "Find the verb", body: "\"suspected.\"" },
      { title: "Rule", body: "Never separate a subject from its verb with a single punctuation mark." }
    ],
    keyQuote: "The biologist who first described the deep-sea anglerfish's glowing",
    hint: "What is the main verb? What is its subject?"
  }),

  // =====================================================================
  // Standard English Conventions: Form, Structure, and Sense
  // =====================================================================
  q(SEC, "Form, Structure, and Sense", "Medium", "rw-fss-01", {
    legacyTitle: "The distracting prepositional phrase",
    title: "The distracting prepositional phrase",
    passage: "The collection of rare manuscripts, gathered over four decades by the library's founders, ______ now available online.",
    prompt: COMPLETE,
    options: ["are", "were", "is", "have been"],
    correctIndex: 2,
    explanation: "The subject is the singular \"collection,\" not \"manuscripts\"; \"now\" calls for the present tense.",
    rationales: [
      "\"Are\" is plural; the subject \"collection\" is singular.",
      "\"Were\" is plural and past tense.",
      "Correct. Singular subject + present tense (\"now\") → \"is.\"",
      "\"Have been\" is plural."
    ],
    steps: [
      { title: "Cross out the extras", body: "Remove \"of rare manuscripts\" and the phrase between the commas.", quote: "The collection ... now available online." },
      { title: "Identify the subject", body: "\"collection\" is singular." },
      { title: "Check the tense", body: "\"now\" means present tense, so \"is.\"" }
    ],
    keyQuote: "The collection of rare manuscripts",
    hint: "What is actually available online: the collection, or the manuscripts?"
  }),
  q(SEC, "Form, Structure, and Sense", "Easy", "rw-fss-02", {
    legacyTitle: "Whose is it?",
    title: "Whose supplies?",
    passage: "The volunteers brought ______ own supplies to the cleanup.",
    prompt: COMPLETE,
    options: ["their", "they're", "there", "its"],
    correctIndex: 0,
    explanation: "\"Their\" is the plural possessive pronoun, matching \"volunteers.\"",
    rationales: [
      "Correct. Plural possessive for the plural \"volunteers.\"",
      "\"They're\" means \"they are.\"",
      "\"There\" refers to a place.",
      "\"Its\" is singular and isn't used for people."
    ],
    steps: [
      { title: "What's needed", body: "A possessive: the supplies belong to the volunteers." },
      { title: "Number", body: "\"Volunteers\" is plural." },
      { title: "Choose", body: "\"Their.\"" }
    ],
    keyQuote: "The volunteers brought",
    hint: "The supplies belong to whom? One person or many?"
  }),
  q(SEC, "Form, Structure, and Sense", "Medium", "rw-fss-03", {
    title: "Last spring's reopening",
    passage: "When the museum reopened last spring, it ______ three new galleries devoted to textile art.",
    prompt: COMPLETE,
    options: ["features", "had featured", "featured", "will feature"],
    correctIndex: 2,
    explanation: "The event happened \"last spring,\" so the simple past \"featured\" matches \"reopened.\"",
    rationales: [
      "Present tense doesn't match \"last spring.\"",
      "The past perfect would mean the galleries existed before the reopening.",
      "Correct. Simple past, consistent with \"reopened last spring.\"",
      "The future tense contradicts \"last spring.\""
    ],
    steps: [
      { title: "Find the time clue", body: "\"last spring\" means the past.", quote: "When the museum reopened last spring" },
      { title: "Match the other verb", body: "\"reopened\" is simple past." },
      { title: "Choose", body: "\"featured.\"" }
    ],
    keyQuote: "When the museum reopened last spring",
    hint: "When did this happen?"
  }),
  q(SEC, "Form, Structure, and Sense", "Hard", "rw-fss-04", {
    title: "Who did the studying?",
    passage: "Having studied the migration routes of monarch butterflies for over a decade, ______",
    prompt: COMPLETE,
    options: [
      "the data collected by entomologist Lin Zhao revealed a surprising pattern.",
      "entomologist Lin Zhao discovered a surprising pattern in the data.",
      "a surprising pattern was discovered in the data by entomologist Lin Zhao.",
      "there was a surprising pattern that entomologist Lin Zhao discovered."
    ],
    correctIndex: 1,
    explanation: "The person who \"studied\" must come right after the modifier. Only {B} places Lin Zhao there.",
    rationales: [
      "Dangling modifier: data can't study anything.",
      "Correct. \"entomologist Lin Zhao\" is the one who studied, placed right after the comma.",
      "Dangling: \"a surprising pattern\" didn't study the routes.",
      "Dangling: \"there\" isn't the one who studied."
    ],
    steps: [
      { title: "Ask who did the action", body: "Who studied the migration routes? A person: Lin Zhao." },
      { title: "Apply the modifier rule", body: "That person must be the first noun after the comma." },
      { title: "Choose", body: "Only {B} starts with \"entomologist Lin Zhao.\"" }
    ],
    keyQuote: "Having studied the migration routes of monarch butterflies for over a decade",
    hint: "Who did the studying? That noun must come right after the comma."
  }),
  q(SEC, "Form, Structure, and Sense", "Medium", "rw-fss-05", {
    title: "A joint statement",
    passage: "The city council and the school board released a joint statement explaining ______ plan to repair the district's aging buildings.",
    prompt: COMPLETE,
    options: ["its", "their", "it's", "they're"],
    correctIndex: 1,
    explanation: "Two groups (\"the council and the board\") form a plural antecedent, so the possessive is \"their.\"",
    rationales: [
      "\"Its\" is singular; two bodies are the antecedent.",
      "Correct. A plural possessive for the compound subject.",
      "\"It's\" means \"it is.\"",
      "\"They're\" means \"they are.\""
    ],
    steps: [
      { title: "Find the antecedent", body: "\"The city council and the school board\": two groups joined by \"and.\"" },
      { title: "Number", body: "A compound subject joined by \"and\" is plural." },
      { title: "Possessive form", body: "\"their.\"" }
    ],
    keyQuote: "The city council and the school board",
    hint: "Whose plan is it? How many groups are involved?"
  }),
  q(SEC, "Form, Structure, and Sense", "Easy", "rw-fss-06", {
    title: "The puffins' burrows",
    passage: "Hundreds of puffins return to the island each spring. The ______ nests are built in burrows high on the cliffs, safely out of reach of foxes.",
    prompt: COMPLETE,
    options: ["puffins'", "puffins", "puffin's", "puffins's"],
    correctIndex: 0,
    explanation: "The nests belong to many puffins, so the plural possessive \"puffins'\" is correct.",
    rationales: [
      "Correct. Plural possessive: the nests of the puffins.",
      "No apostrophe means no possession.",
      "Singular possessive, but there are hundreds of puffins.",
      "Not a correct possessive form of a plural noun ending in s."
    ],
    steps: [
      { title: "Possession?", body: "Yes: the nests belong to the puffins." },
      { title: "Singular or plural?", body: "\"Hundreds of puffins\" means plural.", quote: "Hundreds of puffins return to the island" },
      { title: "Form", body: "Plural noun ending in s → add only an apostrophe: puffins'." }
    ],
    keyQuote: "Hundreds of puffins return to the island each spring.",
    hint: "How many puffins own the nests?"
  })
];

// ---------------------------------------------------------------------------
// Answer placement
// ---------------------------------------------------------------------------
const LETTERS = "ABCD";
// Target positions cycle through this order, so every letter gets the same share.
const CYCLE = [2, 0, 3, 1];

function relabel(text, newIndexOf) {
  return typeof text === "string" ? text.replace(/\{([A-D])\}/g, (_, l) => LETTERS[newIndexOf[LETTERS.indexOf(l)]]) : text;
}

// Moves the correct option to `target`, keeping the wrong options in their
// written order, and re-letters {A}…{D} references in the explanation text.
function placeCorrect(question, target) {
  const others = question.options.map((_, i) => i).filter((i) => i !== question.correctIndex);
  const order = [...others.slice(0, target), question.correctIndex, ...others.slice(target)];
  const newIndexOf = [];
  order.forEach((oldIdx, pos) => {
    newIndexOf[oldIdx] = pos;
  });
  return {
    ...question,
    options: order.map((i) => question.options[i]),
    rationales: order.map((i) => relabel(question.rationales[i], newIndexOf)),
    correctIndex: target,
    explanation: relabel(question.explanation, newIndexOf),
    hint: relabel(question.hint, newIndexOf),
    steps: question.steps.map((s) => ({ ...s, title: relabel(s.title, newIndexOf), body: relabel(s.body, newIndexOf) }))
  };
}

export function balanceAnswers(list) {
  return list.map((question, i) => placeCorrect(question, CYCLE[i % CYCLE.length] % question.options.length));
}

export const RW_QUESTIONS = balanceAnswers(RAW_QUESTIONS);
