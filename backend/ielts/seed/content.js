// Original demo content (two partial "tests" so the per-part shuffle has
// something to mix). Blank ids and item ids are globally unique because a
// candidate's answers for a whole section live in one map.

import { ROMAN, blankAnswers, blanks, headingSlot, key, opts } from "./helpers.js";

// ---------------------------------------------------------------- LISTENING

const LA1 = {
  key: "LA1",
  title: "Riverside Community Centre – Evening Classes",
  section: 1,
  level: "EASY",
  source: "Real exam",
  groups: [
    {
      id: "LA1-g1",
      type: "form_completion",
      instructionHtml: "<p>Complete the form below.</p><p>Write <strong>ONE WORD AND/OR A NUMBER</strong> for each answer.</p>",
      contentHtml: blanks(
        "LA1",
        "<p><strong>Riverside Community Centre – Enrolment Form</strong></p><ul><li>Name: Daniel {{1}}</li><li>Address: 42 {{2}} Road</li><li>Mobile number: {{3}}</li><li>Class chosen: {{4}}</li><li>Preferred day: {{5}}</li><li>First heard about the centre from: the local {{6}}</li></ul>"
      ),
      answers: blankAnswers("LA1", {
        1: "Kowalski",
        2: "Maple",
        3: ["07784 512 690", "07784512690", "07784-512-690"],
        4: "pottery",
        5: ["Wednesday", "Wednesdays", "Wed"],
        6: ["newspaper", "paper"]
      })
    },
    {
      id: "LA1-g2",
      type: "table_completion",
      instructionHtml: "<p>Complete the table below.</p><p>Write <strong>ONE WORD AND/OR A NUMBER</strong> for each answer.</p>",
      table: {
        columns: [
          { header: "Class", width: 150 },
          { header: "Location", width: 170 },
          { header: "Cost per term", width: 170 },
          { header: "Students bring", width: 200 }
        ],
        rows: [
          [{ html: "<p>Pottery</p>" }, { html: blanks("LA1", "<p>Room {{7}}</p>") }, { html: blanks("LA1", "<p>£{{8}}</p>") }, { html: blanks("LA1", "<p>an old {{9}}</p>") }],
          [{ html: "<p>Painting</p>" }, { html: "<p>Studio B</p>" }, { html: "<p>£90</p>" }, { html: blanks("LA1", "<p>their own {{10}}</p>") }]
        ]
      },
      answers: blankAnswers("LA1", {
        7: ["12", "twelve"],
        8: ["85", "eighty-five", "85 pounds"],
        9: ["shirt", "old shirt"],
        10: ["brushes", "paintbrushes", "paint brushes"]
      })
    }
  ]
};

const LA2 = {
  key: "LA2",
  title: "Greenfield Wildlife Park – Visitor Introduction",
  section: 2,
  level: "MEDIUM",
  source: "Real exam",
  groups: [
    {
      id: "LA2-g1",
      type: "multiple_choice",
      instructionHtml: "<p>Choose the correct letter, <strong>A, B or C</strong>.</p>",
      items: [
        { id: "LA2-q1", text: "George Hill opened the park mainly in order to", options: opts("protect rare birds", "provide land for farming", "educate local schoolchildren") },
        { id: "LA2-q2", text: "Most of the park's income comes from", options: opts("government grants", "local businesses", "tickets and memberships") },
        { id: "LA2-q3", text: "The otter feeding now takes place at", options: opts("11 am", "12 noon", "2 pm") },
        { id: "LA2-q4", text: "In the reptile house, visitors must not", options: opts("take photographs", "use a camera flash", "eat or drink") },
        { id: "LA2-q5", text: "People who want to volunteer must", options: opts("have previous experience", "work at least one day a month", "become members of the park") }
      ],
      answers: { "LA2-q1": key("A"), "LA2-q2": key("C"), "LA2-q3": key("C"), "LA2-q4": key("B"), "LA2-q5": key("B") }
    },
    {
      id: "LA2-g2",
      type: "map_select",
      instructionHtml: "<p>Label the map below.</p><p>Choose the correct letter, <strong>A–H</strong>, next to each place.</p>",
      image: { url: "/ielts-assets/images/wildlife-park-map.svg", name: "wildlife-park-map.svg" },
      options: opts("", "", "", "", "", "", "", "").map((o) => ({ key: o.key, text: "" })),
      items: [
        { id: "LA2-m1", text: "Café" },
        { id: "LA2-m2", text: "Gift shop" },
        { id: "LA2-m3", text: "Picnic area" },
        { id: "LA2-m4", text: "Bird hide" },
        { id: "LA2-m5", text: "First aid room" }
      ],
      answers: { "LA2-m1": key("A"), "LA2-m2": key("C"), "LA2-m3": key("E"), "LA2-m4": key("F"), "LA2-m5": key("G") }
    }
  ]
};

const LA3 = {
  key: "LA3",
  title: "Student Project on Rooftop Gardens",
  section: 3,
  level: "MEDIUM",
  source: "Real exam",
  groups: [
    {
      id: "LA3-g1",
      type: "multiple_answers",
      instructionHtml: "<p>Choose <strong>TWO</strong> letters, <strong>A–E</strong>.</p>",
      items: [
        {
          id: "LA3-mq1",
          text: "Which TWO problems did the students have with their survey?",
          count: 2,
          options: opts("Too few people replied.", "The questions were confusing.", "The online form stopped working.", "The data took too long to analyse.", "Some answers were incomplete."),
          correct: ["A", "C"]
        }
      ],
      answers: {}
    },
    {
      id: "LA3-g2",
      type: "matching_features",
      instructionHtml: "<p>What do the students decide to do with each of the following sources?</p><p>Drag the correct letter, <strong>A–D</strong>, next to questions 23–26.</p>",
      optionsTitle: "Decisions",
      allowReuse: true,
      options: opts("use it in the introduction", "leave it out", "check it with the tutor", "use it to support the conclusion"),
      items: [
        { id: "LA3-f1", text: "the city council report" },
        { id: "LA3-f2", text: "the magazine article" },
        { id: "LA3-f3", text: "the interviews with residents" },
        { id: "LA3-f4", text: "the photographs" }
      ],
      answers: { "LA3-f1": key("A"), "LA3-f2": key("B"), "LA3-f3": key("D"), "LA3-f4": key("C") }
    },
    {
      id: "LA3-g3",
      type: "sentence_completion",
      instructionHtml: "<p>Complete the sentences below.</p><p>Write <strong>ONE WORD AND/OR A NUMBER</strong> for each answer.</p>",
      contentHtml: blanks(
        "LA3",
        "<ul><li>The students will meet again on {{27}} afternoon.</li><li>Tom will prepare the {{28}} using the survey data.</li><li>Maya will write a summary of the {{29}}.</li><li>The report must be no longer than {{30}} words.</li></ul>"
      ),
      answers: blankAnswers("LA3", { 27: "Thursday", 28: ["graphs", "graph"], 29: ["interviews", "interview"], 30: ["3000", "3,000", "three thousand"] })
    }
  ]
};

const LA4 = {
  key: "LA4",
  title: "Lecture: How Honeybees Communicate",
  section: 4,
  level: "HARD",
  source: "Real exam",
  groups: [
    {
      id: "LA4-g1",
      type: "note_completion",
      instructionHtml: "<p>Complete the notes below.</p><p>Write <strong>ONE WORD ONLY</strong> for each answer.</p>",
      contentHtml: blanks(
        "LA4",
        "<p><strong>The Honeybee Waggle Dance</strong></p><p><strong>Background</strong></p><ul><li>First explained in detail by Karl von Frisch (Nobel Prize, 1973)</li></ul><p><strong>How the dance works</strong></p><ul><li>The direction of the straight run shows the direction of food in relation to the {{31}}</li><li>The length of the waggle run shows the {{32}} to the food</li><li>A strong {{33}} can make bees overestimate how far they have flown</li><li>Bees learn the type of flower from its {{34}}</li></ul><p><strong>Limitations and threats</strong></p><ul><li>Only about a quarter of bees find the food on their {{35}} attempt</li><li>Some {{36}} may damage bees' memory</li><li>Air {{37}} breaks down the scent of flowers</li></ul><p><strong>Recent research</strong></p><ul><li>A {{38}} bee has successfully directed real bees</li><li>Understanding bees matters for {{39}} and for food {{40}}</li></ul>"
      ),
      answers: blankAnswers("LA4", {
        31: "sun",
        32: "distance",
        33: "wind",
        34: ["scent", "smell"],
        35: "first",
        36: ["pesticides", "pesticide"],
        37: "pollution",
        38: ["robot", "robotic"],
        39: ["farmers", "farming"],
        40: "security"
      })
    }
  ]
};

const LB1 = {
  key: "LB1",
  title: "Harbour View Hotel – Room Booking",
  section: 1,
  level: "EASY",
  source: "Cambridge style",
  groups: [
    {
      id: "LB1-g1",
      type: "note_completion",
      instructionHtml: "<p>Complete the notes below.</p><p>Write <strong>ONE WORD AND/OR A NUMBER</strong> for each answer.</p>",
      contentHtml: blanks(
        "LB1",
        "<p><strong>Harbour View Hotel – Booking Details</strong></p><ul><li>Surname: {{1}}</li><li>Number of nights: {{2}}</li><li>Room: double room with a view of the {{3}}</li><li>Special request: a {{4}} room</li><li>Deposit: £{{5}}</li></ul>"
      ),
      answers: blankAnswers("LB1", { 1: "Whitfield", 2: ["3", "three"], 3: ["harbour", "harbor"], 4: "quiet", 5: ["60", "sixty"] })
    },
    {
      id: "LB1-g2",
      type: "multiple_choice",
      instructionHtml: "<p>Choose the correct letter, <strong>A, B or C</strong>.</p>",
      items: [
        { id: "LB1-q6", text: "Why is the woman visiting the city?", options: opts("to attend a wedding", "to attend a conference", "to go on holiday") },
        { id: "LB1-q7", text: "Breakfast is served until", options: opts("9.30 am", "10.00 am", "10.30 am") },
        { id: "LB1-q8", text: "What does the receptionist say about the car park?", options: opts("It is free for hotel guests.", "Spaces must be reserved in advance.", "It closes at midnight.") },
        { id: "LB1-q9", text: "The receptionist particularly recommends", options: opts("a seafood restaurant", "the art gallery", "a boat trip") },
        { id: "LB1-q10", text: "How will the woman receive her confirmation?", options: opts("by email", "by text message", "by post") }
      ],
      answers: { "LB1-q6": key("B"), "LB1-q7": key("C"), "LB1-q8": key("B"), "LB1-q9": key("C"), "LB1-q10": key("B") }
    }
  ]
};

const LB4 = {
  key: "LB4",
  title: "Lecture: A Short History of Paper",
  section: 4,
  level: "MEDIUM",
  source: "Cambridge style",
  groups: [
    {
      id: "LB4-g1",
      type: "flowchart_dnd",
      instructionHtml: "<p>Complete the flow-chart below.</p><p>Choose <strong>FIVE</strong> answers from the box and drag the correct letter, <strong>A–H</strong>, into gaps 31–35.</p>",
      optionsTitle: "",
      allowReuse: false,
      options: opts("bamboo", "stone", "beaten", "boiled", "soaked", "screen", "sun", "wool"),
      steps: [
        { html: blanks("LB4", "<p>The inner bark of the mulberry tree was {{31}} in water for several days.</p>") },
        { html: blanks("LB4", "<p>The fibres were {{32}} with wooden hammers to make a pulp.</p>") },
        { html: blanks("LB4", "<p>A fine {{33}} made of {{34}} was dipped into the pulp and water.</p>") },
        { html: blanks("LB4", "<p>The wet sheets were left in the {{35}} to dry.</p>") }
      ],
      answers: blankAnswers("LB4", { 31: "E", 32: "C", 33: "F", 34: "A", 35: "G" })
    },
    {
      id: "LB4-g2",
      type: "note_completion",
      instructionHtml: "<p>Complete the notes below.</p><p>Write <strong>ONE WORD ONLY</strong> for each answer.</p>",
      contentHtml: blanks(
        "LB4",
        "<p><strong>The spread of paper-making</strong></p><ul><li>Reached the Middle East in the {{36}} century</li><li>First European paper mills were built in {{37}}</li><li>European paper was made from old {{38}}</li><li>The printing press increased {{39}} for paper</li><li>Wood pulp was first used in the {{40}} century</li></ul>"
      ),
      answers: blankAnswers("LB4", { 36: ["eighth", "8th"], 37: "Spain", 38: ["rags", "cloth"], 39: "demand", 40: ["nineteenth", "19th"] })
    }
  ]
};

export const LISTENING = [LA1, LA2, LA3, LA4, LB1, LB4];

// ---------------------------------------------------------------- READING

const RA1_TEXT = `<p>For decades, scientists who study coral reefs focused mainly on the corals themselves: how they grow, how they reproduce and why they die. The fish that swim among them were often treated as little more than decoration. Over the past thirty years, however, marine biologists have discovered that reef fish play a far more active role in keeping reefs healthy than anyone had imagined.</p>
<p>One of the most important of these roles is grazing. Many reef fish, particularly parrotfish and surgeonfish, feed on the algae that grow on dead coral. Without them, fast-growing algae can quickly cover a reef and prevent young corals from settling. In a well-known experiment in the Caribbean, researchers fenced off small areas of reef so that grazing fish could not enter. Within a year, algae covered almost ninety per cent of the protected areas, compared with less than twenty per cent of the areas outside the fences.</p>
<p>Parrotfish have another surprising effect on their environment. As they scrape algae from rock, they also swallow small pieces of coral skeleton, which they grind into fine sand and excrete. A single large parrotfish can produce several hundred kilograms of sand each year, and some of the white beaches that attract tourists to tropical islands are made largely of this material.</p>
<p>Reef fish are also more intelligent than was once believed. The cleaner wrasse, a small blue-and-black fish, runs what biologists describe as 'cleaning stations', where larger fish come to have parasites removed from their skin and gills. Studies have shown that cleaner wrasse remember individual clients and treat them differently: they are more careful with fish that have other stations nearby, since these customers could easily go elsewhere. In laboratory tests, cleaner wrasse have even passed a version of the mirror test, which is often used to measure self-awareness in animals.</p>
<p>Size, too, matters in unexpected ways. It has long been assumed that bigger fish are more likely to survive attacks by predators, because they can swim faster and are harder to swallow. A study carried out at Lizard Island, on Australia's Great Barrier Reef, challenged this idea. Researchers tagged young damselfish of different sizes and followed them for several weeks. Surprisingly, larger individuals were not more likely to survive. Instead, survival depended mainly on the fish's position on the reef and the amount of shelter available, suggesting that choosing a good hiding place matters more than growing quickly.</p>
<p>Studying reef fish in the wild is far from easy. Many species are active only at night, and the complex structure of a reef makes it difficult to follow individual animals. Traditional methods, such as counting fish while swimming along a measured line, depend heavily on the experience of the diver and can disturb shy species. For this reason, researchers increasingly rely on underwater cameras, which can record behaviour for many hours without a human present.</p>
<p>These studies have become more urgent as reefs face growing threats. Rising sea temperatures cause corals to lose the algae that live inside them, a process known as bleaching. When a reef bleaches, the fish that depend on it for food and shelter often disappear within months. Some scientists argue that protecting populations of grazing fish may give damaged reefs a better chance of recovering, and several countries have already banned the fishing of parrotfish for this reason.</p>`;

const RA1 = {
  key: "RA1",
  globalTitle: "Demo Academic Test 1",
  title: "The Hidden Lives of Reef Fish",
  part: 1,
  level: "MEDIUM",
  source: "Real exam",
  contentHtml: RA1_TEXT,
  groups: [
    {
      id: "RA1-g1",
      type: "tfng",
      instructionHtml:
        "<p>Do the following statements agree with the information given in the reading passage?</p><p>Choose <strong>TRUE</strong> if the statement agrees with the information, <strong>FALSE</strong> if the statement contradicts the information, or <strong>NOT GIVEN</strong> if there is no information on this.</p>",
      items: [
        { id: "RA1-t1", text: "In the past, reef scientists were more interested in coral than in fish." },
        { id: "RA1-t2", text: "In the Caribbean experiment, algae grew more slowly inside the fenced areas." },
        { id: "RA1-t3", text: "Parrotfish produce sand by grinding up pieces of coral." },
        { id: "RA1-t4", text: "Most tourists are aware that some beaches are made by parrotfish." },
        { id: "RA1-t5", text: "Cleaner wrasse treat all of their clients in the same way." },
        { id: "RA1-t6", text: "Cleaner wrasse are the only fish known to pass the mirror test." }
      ],
      answers: {
        "RA1-t1": key("TRUE"),
        "RA1-t2": key("FALSE"),
        "RA1-t3": key("TRUE"),
        "RA1-t4": key("NOT GIVEN"),
        "RA1-t5": key("FALSE"),
        "RA1-t6": key("NOT GIVEN")
      }
    },
    {
      id: "RA1-g2",
      type: "note_completion",
      instructionHtml: "<p>Complete the notes below.</p><p>Choose <strong>NO MORE THAN TWO WORDS</strong> from the passage for each answer.</p>",
      contentHtml: blanks(
        "RA1",
        "<p><strong>Lizard Island study</strong></p><p>Aim:</p><ul><li>to test the belief that larger fish are more likely to survive attacks by {{7}}</li></ul><p>Method:</p><ul><li>young {{8}} of different sizes were tagged and followed</li></ul><p>Findings:</p><ul><li>survival depended on position on the reef and the amount of {{9}}</li></ul><p><strong>Problems with studying reef fish</strong></p><ul><li>many species are only active at {{10}}</li><li>counting fish along a measured line relies on the diver's {{11}}</li><li>such counts can disturb {{12}}</li><li>solution: using underwater {{13}}</li></ul>"
      ),
      answers: blankAnswers("RA1", {
        7: "predators",
        8: "damselfish",
        9: ["shelter", "shelter available"],
        10: "night",
        11: "experience",
        12: ["shy species"],
        13: "cameras"
      })
    }
  ]
};

const RA2_PARAS = [
  "In the 1930s, a nutrition scientist at Cornell University named Clive McCay made a curious discovery. Rats that were fed a diet containing all the necessary nutrients, but around a third fewer calories than normal, lived considerably longer than rats that could eat as much as they liked. Some of the underfed rats lived almost twice as long as the others. At the time, the finding attracted little interest outside the laboratory, and it would be several decades before other scientists took it seriously.",
  "Since then, the same effect has been observed in a remarkable range of species, from yeast and worms to fruit flies and mice. In most cases, reducing food intake by between twenty and forty per cent extends average lifespan, and animals on restricted diets also tend to develop age-related diseases such as cancer later in life. The consistency of these results has led some researchers to describe calorie restriction as the most reliable way known to slow ageing in laboratory animals.",
  "Exactly why eating less should have this effect is still debated. One early theory held that a slower metabolism simply meant less 'wear and tear' on the body. More recent work points to changes inside cells. When food is scarce, cells appear to switch from growth to maintenance, repairing damaged proteins and recycling worn-out components in a process called autophagy. A group of genes that respond to nutrient levels seems to control this switch, and several of them have been found in almost all animals, including humans.",
  "Whether these findings apply to people is much harder to establish. Human lives are long, and few volunteers are willing to eat far less than they want for decades. The largest controlled trial so far, known as CALERIE, asked healthy adults to reduce their calorie intake by a quarter for two years. In practice, most participants managed a reduction of only about twelve per cent. Even so, they showed improvements in blood pressure, cholesterol and other markers linked to heart disease.",
  "Two well-known studies of monkeys produced conflicting results. In one, carried out at the University of Wisconsin, monkeys on a restricted diet lived longer and suffered less disease than a control group. In the other, at the National Institute on Aging, restriction brought health benefits but no clear increase in lifespan. Researchers later pointed out that the control monkeys in the second study had themselves been fed a fairly limited, healthy diet, which may explain why the difference between the two groups was small.",
  "Because strict calorie restriction is so difficult, attention has turned to alternatives that might produce similar benefits. These include intermittent fasting, in which people eat normally on most days but very little on one or two days a week, and drugs that imitate the effects of food shortage on cells. Early results are encouraging, but most scientists warn that eating too little can be harmful, particularly for older people, who need enough protein to maintain muscle strength."
];

const RA2 = {
  key: "RA2",
  globalTitle: "Demo Academic Test 1",
  title: "Can Eating Less Help Us Live Longer?",
  part: 2,
  level: "MEDIUM",
  source: "Real exam",
  contentHtml: RA2_PARAS.map((p, i) => `${headingSlot(`RA2-h${i + 1}`)}<p><strong>${String.fromCharCode(65 + i)}</strong>&nbsp;&nbsp;${p}</p>`).join(""),
  groups: [
    {
      id: "RA2-g1",
      type: "matching_headings",
      instructionHtml: "<p>The reading passage has six paragraphs, <strong>A–F</strong>.</p><p>Choose the correct heading for each paragraph from the list of headings below. Drag the headings into the gaps in the passage.</p>",
      optionsTitle: "List of Headings",
      allowReuse: false,
      options: [
        "A discovery that was ignored for years",
        "Results that are repeated across many living things",
        "Possible explanations at the level of cells",
        "The difficulty of testing the idea in people",
        "Why two similar experiments disagreed",
        "Easier ways of getting the same effect",
        "The financial cost of long-term research",
        "How diet affects intelligence"
      ].map((text, i) => ({ key: ROMAN[i], text })),
      items: RA2_PARAS.map((_, i) => ({ id: `RA2-hq${i + 1}`, text: `Paragraph ${String.fromCharCode(65 + i)}`, slotRef: `RA2-h${i + 1}` })),
      answers: Object.fromEntries(RA2_PARAS.map((_, i) => [`RA2-hq${i + 1}`, key(ROMAN[i])]))
    },
    {
      id: "RA2-g2",
      type: "summary_dnd",
      instructionHtml: "<p>Complete the summary using the list of words, <strong>A–H</strong>, below.</p>",
      optionsTitle: "",
      allowReuse: false,
      options: opts("a quarter", "a third", "reduction", "increase", "blood pressure", "muscle strength", "heart disease", "cancer"),
      contentHtml: blanks(
        "RA2",
        "<p><strong>The CALERIE trial</strong></p><p>In the CALERIE trial, healthy adults were asked to cut their calorie intake by {{20}} for two years. Most participants achieved only about half of this {{21}}, but they still showed better {{22}} and cholesterol levels, which are both linked to {{23}}.</p>"
      ),
      answers: blankAnswers("RA2", { 20: "A", 21: "C", 22: "E", 23: "G" })
    },
    {
      id: "RA2-g3",
      type: "multiple_answers",
      instructionHtml: "<p>Choose <strong>TWO</strong> letters, <strong>A–E</strong>.</p>",
      items: [
        {
          id: "RA2-mq1",
          text: "Which TWO alternatives to strict calorie restriction are mentioned in the passage?",
          count: 2,
          options: opts("eating only vegetables", "intermittent fasting", "drugs that imitate food shortage", "exercising more often", "sleeping for longer"),
          correct: ["B", "C"]
        }
      ],
      answers: {}
    },
    {
      id: "RA2-g4",
      type: "multiple_choice",
      instructionHtml: "<p>Choose the correct letter, <strong>A, B, C or D</strong>.</p>",
      items: [
        {
          id: "RA2-q26",
          text: "Why were the results of the second monkey study less clear?",
          options: opts("The monkeys were older at the start.", "The control group was also fed a limited, healthy diet.", "Too few monkeys were used.", "The study was stopped early.")
        }
      ],
      answers: { "RA2-q26": key("B") }
    }
  ]
};

const RA3_TEXT = `<p>It is often said that it takes ten thousand hours of practice to become an expert in any field. The figure became famous after the publication of a popular book in 2008, which drew on research carried out in the early 1990s by the psychologist Anders Ericsson and his colleagues. In their study, violin students at a music academy in Berlin were divided into three groups according to their teachers' judgements of their ability. The researchers then asked the students to estimate how much time they had spent practising since they first picked up the instrument. By the age of twenty, the best violinists had accumulated an average of around ten thousand hours of practice, while the least accomplished group had practised for about four thousand hours.</p>
<p>Ericsson did not claim that ten thousand hours was a magic number, and he was frustrated by the way his work was later described. What mattered, he argued, was not simply the quantity of practice but its quality. He used the term 'deliberate practice' to describe activity that is specifically designed to improve performance: it is usually guided by a teacher, focuses on weaknesses rather than strengths, and involves constant feedback. Playing through a favourite piece for enjoyment, however pleasant, does not count.</p>
<p>In recent years, several researchers have questioned whether practice alone can explain expert performance. In 2014, a team led by Brooke Macnamara combined the results of dozens of earlier studies and concluded that deliberate practice accounted for only about a fifth of the differences in musical skill between individuals. Other factors, they suggested, must also play a significant role. One of these may be the age at which training begins. Children who start music lessons early seem to have an advantage that is not fully explained by the extra hours of practice they accumulate, perhaps because the developing brain is especially flexible.</p>
<p>Genetics is another candidate. A large study of Swedish twins found that identical twins, who share all of their genes, were more similar in their musical ability than non-identical twins, even when one twin had practised far more than the other. The researchers were careful to point out that this does not mean practice is pointless – the twin who practised more was usually the better player – but it does suggest that people differ in how much they benefit from it.</p>
<p>Personality may matter too. Psychologists have found that people who score highly on a trait called 'openness to experience', which includes curiosity and an interest in art, are more likely to take up an instrument and to persist with it. Motivation is equally important. Practice, particularly the deliberate kind, is often tiring and not always enjoyable, and learners who are driven by a genuine love of music tend to continue for longer than those who are pushed by parents or teachers.</p>
<p>Finally, some researchers emphasise the role of the environment in which a musician grows up. Access to good teachers, instruments and opportunities to perform is far from equally distributed, and a gifted child in a family without these resources may never discover his or her potential. From this point of view, expertise is not only a matter of individual effort or talent, but also of opportunity.</p>
<p>Most researchers now accept that expert musicianship is the product of many interacting factors. The debate is no longer about whether practice or talent matters, but about how the two combine. For teachers, this suggests that encouraging practice remains essential, but that it should be designed carefully and adapted to the individual learner.</p>`;

const RA3 = {
  key: "RA3",
  globalTitle: "Demo Academic Test 1",
  title: "What Makes an Expert Musician?",
  part: 3,
  level: "HARD",
  source: "Real exam",
  contentHtml: RA3_TEXT,
  groups: [
    {
      id: "RA3-g1",
      type: "multiple_choice",
      instructionHtml: "<p>Choose the correct letter, <strong>A, B, C or D</strong>.</p>",
      items: [
        {
          id: "RA3-q27",
          text: "What was the purpose of Ericsson's study of violin students?",
          options: opts("to compare different teaching methods", "to find out how much the students had practised", "to test the students' memory for music", "to identify the best violin teachers in Berlin")
        },
        {
          id: "RA3-q28",
          text: "According to the second paragraph, Ericsson believed that",
          options: opts(
            "ten thousand hours is the minimum needed to become an expert.",
            "the popular book described his research accurately.",
            "how people practise matters more than how long they practise.",
            "playing for enjoyment is a useful form of practice."
          )
        },
        {
          id: "RA3-q29",
          text: "What did Macnamara's team conclude?",
          options: opts(
            "Deliberate practice explains most differences in musical skill.",
            "Deliberate practice explains only part of the differences in skill.",
            "Earlier studies of practice were badly designed.",
            "Practice has no effect on musical ability."
          )
        },
        {
          id: "RA3-q30",
          text: "The study of Swedish twins suggested that",
          options: opts(
            "practice made no difference to the twins' ability.",
            "non-identical twins were more musical than identical twins.",
            "people benefit from practice to different degrees.",
            "twins usually practise for the same amount of time."
          )
        }
      ],
      answers: { "RA3-q27": key("B"), "RA3-q28": key("C"), "RA3-q29": key("B"), "RA3-q30": key("C") }
    },
    {
      id: "RA3-g2",
      type: "ynng",
      instructionHtml:
        "<p>Do the following statements agree with the claims of the writer in the reading passage?</p><p>Choose <strong>YES</strong> if the statement agrees with the claims of the writer, <strong>NO</strong> if the statement contradicts the claims of the writer, or <strong>NOT GIVEN</strong> if it is impossible to say what the writer thinks about this.</p>",
      items: [
        { id: "RA3-y1", text: "The ten-thousand-hour figure became widely known because of a popular book." },
        { id: "RA3-y2", text: "Ericsson was pleased with the way other people presented his research." },
        { id: "RA3-y3", text: "Children who begin music lessons early benefit only because they practise for longer." },
        { id: "RA3-y4", text: "Most professional musicians started learning before the age of five." },
        { id: "RA3-y5", text: "Teachers should design practice to suit each individual learner." }
      ],
      answers: { "RA3-y1": key("YES"), "RA3-y2": key("NO"), "RA3-y3": key("NO"), "RA3-y4": key("NOT GIVEN"), "RA3-y5": key("YES") }
    },
    {
      id: "RA3-g3",
      type: "matching_sentence_endings",
      instructionHtml: "<p>Complete each sentence with the correct ending, <strong>A–G</strong>, below.</p>",
      optionsTitle: "",
      allowReuse: false,
      options: opts(
        "are more likely to start and continue playing an instrument.",
        "usually practise less than their parents want.",
        "focuses on the areas where a learner is weakest.",
        "was the main subject of the 2008 book.",
        "tend to keep practising for longer.",
        "may never realise his or her ability.",
        "is about how practice and talent work together."
      ),
      items: [
        { id: "RA3-e1", text: "Deliberate practice" },
        { id: "RA3-e2", text: "People with a high level of openness to experience" },
        { id: "RA3-e3", text: "Learners who genuinely love music" },
        { id: "RA3-e4", text: "A gifted child from a family with few resources" },
        { id: "RA3-e5", text: "The current debate among researchers" }
      ],
      answers: { "RA3-e1": key("C"), "RA3-e2": key("A"), "RA3-e3": key("E"), "RA3-e4": key("F"), "RA3-e5": key("G") }
    }
  ]
};

const RB1_PARAS = [
  "For most of the twentieth century, the red fox was regarded in Britain as a creature of the countryside, hunted by farmers who blamed it for killing chickens and young lambs. Yet from the 1930s onwards, a small number of foxes began to appear in the suburbs of London and other southern cities. Today, it is estimated that around 150,000 foxes live in British towns and cities, and many residents see one more often than they see a hedgehog.",
  "The first urban foxes probably moved into the new suburbs that spread rapidly between the two world wars. These areas, with their large gardens, quiet railway lines and low-density housing, offered plenty of places to hide and raise young. Unlike the crowded city centres, they also provided a rich supply of food, from fruit trees and bird tables to insects and earthworms in lawns.",
  "Contrary to popular belief, urban foxes do not rely mainly on rubbish bins. When researchers at the University of Bristol analysed the diet of foxes killed on roads, they found that around a third of it consisted of food deliberately left out by people, while the rest was made up of animals the foxes had caught themselves, such as rats, pigeons and beetles, together with fruit and animals found dead by the road.",
  "City life has changed fox behaviour in several ways. Urban foxes tend to have smaller territories than their rural relatives, sometimes covering no more than a few streets, because food is so concentrated. They have also become bolder: studies using cameras have shown that city foxes approach unfamiliar objects more quickly than country foxes, which may help them to exploit new sources of food.",
  "Not everyone welcomes the animals. Complaints about foxes digging in gardens, screaming at night during the breeding season and occasionally entering houses are common. Some local councils receive hundreds of calls about foxes every year, yet experts argue that removing the animals is pointless, because any territory that becomes empty is quickly filled by a fox from a neighbouring area.",
  "Instead, wildlife organisations recommend that people learn to live alongside foxes. Simple measures, such as keeping rubbish in sealed containers, blocking gaps under sheds and never feeding foxes by hand, can greatly reduce problems. Some researchers believe that urban foxes may even be useful, since they help to control the populations of rats and mice."
];

const RB1 = {
  key: "RB1",
  globalTitle: "Demo Academic Test 2",
  title: "The Return of the Urban Fox",
  part: 1,
  level: "EASY",
  source: "Cambridge style",
  contentHtml: RB1_PARAS.map((p, i) => `<p><strong>${String.fromCharCode(65 + i)}</strong>&nbsp;&nbsp;${p}</p>`).join(""),
  groups: [
    {
      id: "RB1-g1",
      type: "matching_information",
      instructionHtml: "<p>The reading passage has six paragraphs, <strong>A–F</strong>.</p><p>Which paragraph contains the following information? Drag the correct letter, <strong>A–F</strong>, into boxes 1–5.</p><p><em>NB</em> You may use any letter more than once.</p>",
      optionsTitle: "Paragraphs",
      allowReuse: true,
      options: opts("Paragraph A", "Paragraph B", "Paragraph C", "Paragraph D", "Paragraph E", "Paragraph F"),
      items: [
        { id: "RB1-i1", text: "an explanation of why removing foxes does not solve problems" },
        { id: "RB1-i2", text: "a description of what urban foxes eat" },
        { id: "RB1-i3", text: "a reason why urban foxes need less space than rural foxes" },
        { id: "RB1-i4", text: "an estimate of the number of foxes living in towns" },
        { id: "RB1-i5", text: "a description of the places where foxes first settled in towns" }
      ],
      answers: { "RB1-i1": key("E"), "RB1-i2": key("C"), "RB1-i3": key("D"), "RB1-i4": key("A"), "RB1-i5": key("B") }
    },
    {
      id: "RB1-g2",
      type: "short_answer",
      instructionHtml: "<p>Answer the questions below.</p><p>Choose <strong>NO MORE THAN THREE WORDS AND/OR A NUMBER</strong> from the passage for each answer.</p>",
      items: [
        { id: "RB1-s1", text: "In which decade did foxes start to appear in British suburbs?" },
        { id: "RB1-s2", text: "Which university studied the diet of urban foxes?" },
        { id: "RB1-s3", text: "What proportion of urban foxes' diet was food left out by people?" },
        { id: "RB1-s4", text: "What equipment did studies use to compare the boldness of city and country foxes?" }
      ],
      answers: {
        "RB1-s1": key("1930s", "the 1930s", "1930"),
        "RB1-s2": key("Bristol", "University of Bristol", "the University of Bristol"),
        "RB1-s3": key("a third", "one third", "1/3", "third"),
        "RB1-s4": key("cameras", "camera")
      }
    },
    {
      id: "RB1-g3",
      type: "sentence_completion",
      instructionHtml: "<p>Complete the sentences below.</p><p>Choose <strong>ONE WORD ONLY</strong> from the passage for each answer.</p>",
      contentHtml: blanks(
        "RB1",
        "<ul><li>Farmers traditionally blamed foxes for killing chickens and young {{10}}.</li><li>Foxes can be noisy at night during the {{11}} season.</li><li>People are advised to keep rubbish in {{12}} containers.</li><li>Urban foxes may help to control the numbers of rats and {{13}}.</li></ul>"
      ),
      answers: blankAnswers("RB1", { 10: "lambs", 11: "breeding", 12: "sealed", 13: "mice" })
    }
  ]
};

export const READING = [RA1, RA2, RA3, RB1];

// ---------------------------------------------------------------- WRITING

export const WRITING = [
  {
    key: "WA1",
    task: 1,
    title: "Writing Task 1",
    source: "Real exam",
    questionHtml:
      "<p>The chart below shows the percentage of adults in one country who donated money to charity, by age group, in 2004 and 2024.</p><p>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</p>",
    image: { url: "/ielts-assets/images/charity-donations-chart.svg", name: "charity-donations-chart.svg" }
  },
  {
    key: "WA2",
    task: 2,
    title: "Writing Task 2",
    source: "Real exam",
    questionHtml:
      "<p>Some people prefer to spend their whole working life with one organisation. Others believe it is better to change employers several times during their career.</p><p>Discuss both these views and give your own opinion.</p>",
    image: null
  },
  {
    key: "WB1",
    task: 1,
    title: "Writing Task 1 – Internet use",
    source: "Cambridge style",
    questionHtml:
      "<p>The graph below shows the average number of hours per week that people in three age groups spent online between 2010 and 2025.</p><p>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</p>",
    image: { url: "/ielts-assets/images/internet-use-graph.svg", name: "internet-use-graph.svg" }
  },
  {
    key: "WB2",
    task: 2,
    title: "Writing Task 2 – Cycling to work",
    source: "Cambridge style",
    questionHtml:
      "<p>In many cities, the number of people who cycle to work is increasing.</p><p>What are the benefits of this trend? Are there any disadvantages?</p>",
    image: null
  }
];
