// Self-study practice material for the student hub's IELTS Practice area:
// four listening parts, three reading passages and four writing tasks. All of
// it is original, written for Northstar in the format of the IELTS test (it is
// not taken from any published book). Records are loaded with use: "practice",
// so they never appear in teacher-run mock sessions (see lib/practice.js).
// `seedKey` lets startup add missing items without touching existing ones.

import { ROMAN, blankAnswers, blanks, headingSlot, key, opts } from "./helpers.js";
import { PRACTICE_TRANSCRIPTS, transcriptHtml } from "./practiceTranscripts.js";

const SOURCE = "Northstar practice (original)";
const TFNG_HTML =
  "<p>Do the following statements agree with the information given in the reading passage?</p><p>Choose <strong>TRUE</strong> if the statement agrees with the information, <strong>FALSE</strong> if the statement contradicts the information, or <strong>NOT GIVEN</strong> if there is no information on this.</p>";
const YNNG_HTML =
  "<p>Do the following statements agree with the views of the writer in the reading passage?</p><p>Choose <strong>YES</strong> if the statement agrees with the views of the writer, <strong>NO</strong> if the statement contradicts the views of the writer, or <strong>NOT GIVEN</strong> if it is impossible to say what the writer thinks about this.</p>";

// ---------------------------------------------------------------- LISTENING

const PL1 = {
  seedKey: "PL1",
  title: "Coastal Cycle Tours – Booking a Family Tour",
  section: 1,
  level: "EASY",
  groups: [
    {
      id: "PL1-g1",
      type: "form_completion",
      instructionHtml: "<p>Complete the form below.</p><p>Write <strong>ONE WORD AND/OR A NUMBER</strong> for each answer.</p>",
      contentHtml: blanks(
        "PL1",
        "<p><strong>Coastal Cycle Tours – Booking Form</strong></p><ul><li>Name: Martin {{1}}</li><li>Contact number: {{2}}</li><li>Tour: the {{3}} Trail</li><li>Date: Saturday {{4}} July</li><li>Group: 2 adults and {{5}} children</li><li>Extra equipment: a child {{6}}</li></ul>"
      ),
      answers: blankAnswers("PL1", {
        1: "Ashworth",
        2: ["07915 346 802", "07915346802", "07915-346-802", "07915 346802"],
        3: "Lighthouse",
        4: ["19th", "19", "nineteenth"],
        5: ["3", "three"],
        6: "seat"
      })
    },
    {
      id: "PL1-g2",
      type: "note_completion",
      instructionHtml: "<p>Complete the notes below.</p><p>Write <strong>ONE WORD AND/OR A NUMBER</strong> for each answer.</p>",
      contentHtml: blanks(
        "PL1",
        "<p><strong>Tour information</strong></p><ul><li>Meeting point: the car park behind the {{7}}</li><li>Tour starts at {{8}} a.m.</li><li>Riders must bring their own {{9}}</li><li>Total cost: £{{10}}</li></ul>"
      ),
      answers: blankAnswers("PL1", {
        7: "aquarium",
        8: ["9.30", "9:30", "nine thirty", "9.30am", "9.30 am"],
        9: "gloves",
        10: ["96", "ninety-six", "96 pounds"]
      })
    }
  ]
};

const PL2 = {
  seedKey: "PL2",
  title: "Maple Hill Library – Changes During Renovation",
  section: 2,
  level: "MEDIUM",
  groups: [
    {
      id: "PL2-g1",
      type: "multiple_choice",
      instructionHtml: "<p>Choose the correct letter, <strong>A, B or C</strong>.</p>",
      items: [
        { id: "PL2-q11", text: "What is the main reason for the renovation?", options: opts("to provide spaces for group study", "to make room for more books", "to reduce energy costs") },
        { id: "PL2-q12", text: "While the library is closed, residents can borrow books from", options: opts("the town hall.", "the sports centre.", "the mobile library only.") },
        { id: "PL2-q13", text: "The library is now expected to reopen", options: opts("in early March.", "in February.", "in late April.") },
        { id: "PL2-q14", text: "After the renovation, members will", options: opts("need a new library card.", "be able to borrow books with a phone app.", "pay a small annual fee.") },
        { id: "PL2-q15", text: "The manager asks local people to", options: opts("suggest names for the new rooms.", "donate books to the library.", "help with moving the collection.") }
      ],
      answers: { "PL2-q11": key("A"), "PL2-q12": key("B"), "PL2-q13": key("C"), "PL2-q14": key("B"), "PL2-q15": key("A") }
    },
    {
      id: "PL2-g2",
      type: "matching_features",
      instructionHtml:
        "<p>What change will be made to each of the following library services?</p><p>Choose <strong>FIVE</strong> answers from the box and drag the correct letter, <strong>A–F</strong>, next to questions 16–20.</p>",
      optionsTitle: "Changes",
      allowReuse: false,
      options: opts(
        "It will be available for longer hours.",
        "It will need to be booked in advance.",
        "It will move to a different floor.",
        "It will no longer charge a fee.",
        "It will be run by volunteers.",
        "It will close permanently."
      ),
      items: [
        { id: "PL2-f16", text: "study rooms" },
        { id: "PL2-f17", text: "computer area" },
        { id: "PL2-f18", text: "children's section" },
        { id: "PL2-f19", text: "café" },
        { id: "PL2-f20", text: "local history room" }
      ],
      answers: { "PL2-f16": key("B"), "PL2-f17": key("D"), "PL2-f18": key("C"), "PL2-f19": key("E"), "PL2-f20": key("A") }
    }
  ]
};

const PL3 = {
  seedKey: "PL3",
  title: "Student Project on Canteen Food Waste",
  section: 3,
  level: "MEDIUM",
  groups: [
    {
      id: "PL3-g1",
      type: "multiple_answers",
      instructionHtml: "<p>Choose <strong>TWO</strong> letters, <strong>A–E</strong>.</p>",
      items: [
        {
          id: "PL3-m21",
          text: "Which TWO findings from the canteen survey surprised the students?",
          count: 2,
          options: opts(
            "Most of the waste was vegetables.",
            "Staff threw away more food than students.",
            "Students left a lot of bread.",
            "More food was wasted at lunch than at dinner.",
            "Portions were larger than expected."
          ),
          correct: ["A", "D"]
        },
        {
          id: "PL3-m23",
          text: "Which TWO changes has the canteen manager agreed to try?",
          count: 2,
          options: opts(
            "putting up posters about waste",
            "removing the trays",
            "giving leftover food to a charity",
            "changing the menu every day",
            "offering smaller portions at a lower price"
          ),
          correct: ["B", "E"]
        }
      ],
      answers: {}
    },
    {
      id: "PL3-g2",
      type: "matching_features",
      instructionHtml:
        "<p>Who will be responsible for each of the following tasks?</p><p>Drag the correct letter, <strong>A, B or C</strong>, next to questions 25–30. You may use any letter more than once.</p>",
      optionsTitle: "People",
      allowReuse: true,
      options: opts("Anna", "Kieran", "both Anna and Kieran"),
      items: [
        { id: "PL3-f25", text: "arranging another meeting with the canteen manager" },
        { id: "PL3-f26", text: "sorting the photographs of the plates" },
        { id: "PL3-f27", text: "reading studies from other universities" },
        { id: "PL3-f28", text: "producing the graphs" },
        { id: "PL3-f29", text: "writing the introduction" },
        { id: "PL3-f30", text: "preparing the handout" }
      ],
      answers: { "PL3-f25": key("B"), "PL3-f26": key("A"), "PL3-f27": key("C"), "PL3-f28": key("B"), "PL3-f29": key("A"), "PL3-f30": key("C") }
    }
  ]
};

const PL4 = {
  seedKey: "PL4",
  title: "Lecture: Why Roman Concrete Has Lasted",
  section: 4,
  level: "HARD",
  groups: [
    {
      id: "PL4-g1",
      type: "note_completion",
      instructionHtml: "<p>Complete the notes below.</p><p>Write <strong>ONE WORD ONLY</strong> for each answer.</p>",
      contentHtml: blanks(
        "PL4",
        "<p><strong>Roman concrete</strong></p><p><strong>Long-lasting structures</strong></p><ul><li>harbours built in the {{31}} are still standing</li><li>the Pantheon's {{32}} is still the largest of its kind</li></ul><p><strong>Ingredients</strong></p><ul><li>lime mixed with volcanic {{33}}</li><li>in sea walls, seawater caused new {{34}} to grow</li><li>so the sea made the material {{35}} over time</li></ul><p><strong>Self-healing</strong></p><ul><li>white lumps of {{36}} were once seen as a sign of careless mixing</li><li>'hot mixing' with quicklime produces a lot of {{37}}</li><li>water entering a crack dissolves the lumps, which stops the crack from {{38}}</li></ul><p><strong>Relevance today</strong></p><ul><li>cement production causes about 8% of the world's {{39}} emissions</li><li>a drawback: Roman concrete sets more {{40}} than modern concrete</li></ul>"
      ),
      answers: blankAnswers("PL4", {
        31: "sea",
        32: "dome",
        33: "ash",
        34: "crystals",
        35: "stronger",
        36: "lime",
        37: "heat",
        38: "spreading",
        39: ["carbon", "CO2"],
        40: "slowly"
      })
    }
  ]
};

export const PRACTICE_LISTENING = [PL1, PL2, PL3, PL4].map((l) => ({ ...l, source: SOURCE, transcriptHtml: transcriptHtml(PRACTICE_TRANSCRIPTS[l.seedKey]) }));

// ---------------------------------------------------------------- READING

const PR1_TEXT = `<p>Today, the tin can is so ordinary that it is easy to forget it was once a revolutionary invention. Its story begins not in a factory but on the battlefield. In 1795, France was at war with much of Europe, and its armies were struggling to feed soldiers who were fighting far from home. Fresh food spoiled quickly, and the salted and dried food that soldiers carried was often unpleasant and lacking in nutrients. The French government therefore offered a large cash prize to anyone who could find a better way of preserving food for its troops.</p>
<p>The challenge was taken up by Nicolas Appert, a confectioner from Paris. Over roughly fourteen years of experiments, Appert developed a method in which food was placed in thick glass bottles, sealed with cork and wax, and then heated in boiling water. Food prepared in this way stayed fresh for months, and samples that were sent to sea with the French navy were found to be in excellent condition when the ships returned. In 1810, Appert received the prize of 12,000 francs, on the condition that he publish a description of his method, which he did in a book the same year.</p>
<p>What Appert could not explain was why his method worked. He believed that the heat somehow drove out the air, and that air was responsible for food going bad. It was not until the 1860s that the French scientist Louis Pasteur showed that spoilage is caused by microorganisms, and that heating food kills them. Appert had found the right answer for the wrong reason.</p>
<p>Glass had one serious disadvantage: it broke easily, particularly when it was carried in army supply wagons over rough roads. In the same year that Appert won his prize, a British merchant called Peter Durand was granted a patent for preserving food in containers made of iron coated with tin. Durand does not appear to have manufactured any cans himself. Instead, he sold his patent to two engineers, Bryan Donkin and John Hall, who set up a factory in London. By 1813 they were supplying tinned meat and vegetables to the Royal Navy, and the Duke of Wellington is said to have tasted their products and approved of them.</p>
<p>Early cans were a far cry from the light containers we know today. They were made by hand, with a skilled worker producing only a few dozen a day, and they were so heavy that some weighed more than the food inside them. Opening them was not easy either. Instructions printed on some early cans advised the user to cut around the top with a chisel and hammer. Remarkably, the first tool designed specifically for opening cans did not appear until 1855, more than forty years after the first cans were sold. Invented in England by Robert Yeates, it was a lever with a claw at one end, which was pushed into the lid and worked around the edge. The design that most people would recognise, which uses a sharp wheel that rolls around the rim, was patented in the United States by William Lyman in 1870.</p>
<p>By then, canned food had become part of everyday life. During the American Civil War in the 1860s, soldiers on both sides depended on it, and many of them continued to buy canned goods after returning home. Factories introduced machines that made cans faster and more cheaply, and as cans became thinner, opening them became much easier.</p>
<p>The history of the can also includes some darker episodes. In 1845, the British explorer Sir John Franklin set off to find a sea route through the Arctic with two ships and a large supply of tinned food. None of the 129 men returned. Examinations of remains found many years later showed high levels of lead, and some researchers have suggested that the solder used to seal the cans, which contained lead, contributed to the men's illness. Others argue that the ships' water systems were a more likely source, and the question is still debated.</p>
<p>In the twentieth century, the can continued to evolve. Aluminium, which is lighter than steel and does not rust, became the standard material for drinks cans in the 1960s, and the ring pull meant that no tool was needed at all. More than two hundred years after Appert's first experiments, the basic principle he discovered – heating food in a sealed container – remains at the heart of the canning industry.</p>`;

const PR1 = {
  seedKey: "PR1",
  globalTitle: "Northstar Practice Reading",
  title: "The Story of the Tin Can",
  part: 1,
  level: "EASY",
  contentHtml: PR1_TEXT,
  groups: [
    {
      id: "PR1-g1",
      type: "tfng",
      instructionHtml: TFNG_HTML,
      items: [
        { id: "PR1-t1", text: "The French government's prize was intended to help it feed its soldiers." },
        { id: "PR1-t2", text: "Appert understood why heating food in sealed containers preserved it." },
        { id: "PR1-t3", text: "Appert's glass bottles were cheaper to make than Durand's containers." },
        { id: "PR1-t4", text: "Peter Durand produced the first tin cans in his own factory." },
        { id: "PR1-t5", text: "The Royal Navy was among the first customers for Donkin and Hall's products." },
        { id: "PR1-t6", text: "The first tool for opening cans was designed shortly after cans were introduced." }
      ],
      answers: { "PR1-t1": key("TRUE"), "PR1-t2": key("FALSE"), "PR1-t3": key("NOT GIVEN"), "PR1-t4": key("FALSE"), "PR1-t5": key("TRUE"), "PR1-t6": key("FALSE") }
    },
    {
      id: "PR1-g2",
      type: "note_completion",
      instructionHtml: "<p>Complete the notes below.</p><p>Choose <strong>NO MORE THAN TWO WORDS</strong> from the passage for each answer.</p>",
      contentHtml: blanks(
        "PR1",
        "<p><strong>Early cans</strong></p><ul><li>made of iron coated with {{7}}</li><li>some weighed more than the {{8}} they contained</li><li>could be opened with a hammer and a {{9}}</li></ul><p><strong>Can openers</strong></p><ul><li>1855: Yeates' opener was a lever with a {{10}} at one end</li><li>1870: Lyman's design has a sharp {{11}} that rolls around the rim</li></ul><p><strong>Later developments</strong></p><ul><li>canned food was widely used by soldiers during the American {{12}}</li><li>1960s: drinks cans made of {{13}} became standard</li></ul>"
      ),
      answers: blankAnswers("PR1", {
        7: "tin",
        8: "food",
        9: "chisel",
        10: "claw",
        11: "wheel",
        12: ["Civil War"],
        13: ["aluminium", "aluminum"]
      })
    }
  ]
};

const PR2_PARAS = [
  "On a summer night in a large city, the air can be several degrees warmer than in the surrounding countryside. This phenomenon, now known as the urban heat island, was first described more than two hundred years ago. In the early nineteenth century, an amateur scientist named Luke Howard recorded temperatures in London and in the fields outside it, and noticed that the city was consistently warmer, especially at night. His findings attracted little attention at the time, but today the urban heat island is one of the most intensively studied features of city climates, and differences of up to ten degrees Celsius between urban and rural areas have been recorded on calm, clear nights.",
  "The causes of this extra warmth are well understood. Dark surfaces such as roads and roofs absorb a large proportion of the sunlight that falls on them and release the heat slowly after sunset. Tall buildings trap this heat and block the winds that might otherwise carry it away, while the lack of soil and vegetation means that there is little water available to cool the air through evaporation. On top of this, cities produce heat of their own: every car engine, factory and air-conditioning unit releases warmth into the surrounding streets.",
  "It would be easy to regard the heat island as nothing more than an inconvenience, but its effects can be serious. During heatwaves, high night-time temperatures prevent people's bodies from recovering from the heat of the day, and the elderly and those with health conditions are particularly at risk. Hotter cities also consume more electricity, as residents turn up their air conditioning. Because much of that electricity is still generated by burning fossil fuels, and because air conditioners themselves pump hot air into the street, the result is a vicious circle in which attempts to stay cool make the city warmer still. Higher temperatures also speed up the chemical reactions that produce ground-level ozone, a harmful air pollutant.",
  "One of the simplest ways to cool a city is to change the colour of its surfaces. Light-coloured materials reflect more sunlight and therefore absorb less heat, and so-called 'cool roofs', painted white or covered with reflective coatings, can be many degrees cooler than traditional dark roofs on a sunny day. Several cities have also experimented with reflective coatings on roads. In Los Angeles, where some streets were coated with a pale grey material, measurements showed a significant fall in the temperature of the road surface. However, researchers have warned that reflective pavements may bounce sunlight back onto people walking on them, so that pedestrians feel hotter even though the road itself is cooler.",
  "Plants offer another solution. Trees cool the air in two ways: they provide shade, and they release water vapour through their leaves, a process that absorbs heat from their surroundings. Studies have found that large parks can be several degrees cooler than nearby streets, and even a single row of trees can make a noticeable difference. For this reason, many cities have set ambitious targets for tree planting. Melbourne, for example, aims to increase the proportion of the city covered by tree canopy to forty per cent by 2040. Yet trees are not a simple fix. They need a reliable supply of water, which may be scarce during the very heatwaves they are meant to protect against, and in crowded city centres there is often too little space for their roots to grow.",
  "Increasingly, researchers are turning their attention to who suffers most from urban heat. Satellite images and networks of inexpensive temperature sensors have revealed that heat is not evenly distributed within cities. In many places, the hottest neighbourhoods are those with the fewest trees and the most concrete, and these are frequently the areas where people on low incomes live. Some of these residents cannot afford air conditioning, or the electricity to run it. Planners are therefore being urged to consider not only how much a city can be cooled, but where cooling measures are most needed."
];

const PR2 = {
  seedKey: "PR2",
  globalTitle: "Northstar Practice Reading",
  title: "Cooling the Urban Heat Island",
  part: 2,
  level: "MEDIUM",
  contentHtml: PR2_PARAS.map((p, i) => `${headingSlot(`PR2-h${i + 1}`)}<p><strong>${String.fromCharCode(65 + i)}</strong>&nbsp;&nbsp;${p}</p>`).join(""),
  groups: [
    {
      id: "PR2-g1",
      type: "matching_headings",
      instructionHtml:
        "<p>The reading passage has six paragraphs, <strong>A–F</strong>.</p><p>Choose the correct heading for each paragraph from the list of headings below. Drag the headings into the gaps in the passage.</p>",
      optionsTitle: "List of Headings",
      allowReuse: false,
      options: [
        "More than a minor discomfort",
        "The rising cost of cooling systems",
        "Natural cooling and its limits",
        "An old discovery that took time to catch on",
        "Why the countryside is warming faster",
        "Lightening the city",
        "How cities store and produce heat",
        "An uneven burden"
      ].map((text, i) => ({ key: ROMAN[i], text })),
      items: PR2_PARAS.map((_, i) => ({ id: `PR2-hq${i + 1}`, text: `Paragraph ${String.fromCharCode(65 + i)}`, slotRef: `PR2-h${i + 1}` })),
      // Paragraphs A–F in order; ii and v are distractors.
      answers: Object.fromEntries(["iv", "vii", "i", "vi", "iii", "viii"].map((k, i) => [`PR2-hq${i + 1}`, key(k)]))
    },
    {
      id: "PR2-g2",
      type: "summary_dnd",
      instructionHtml: "<p>Complete the summary using the list of words, <strong>A–H</strong>, below.</p>",
      optionsTitle: "",
      allowReuse: false,
      options: opts("roofs", "water", "wind", "shade", "parks", "sunlight", "leaves", "roots"),
      contentHtml: blanks(
        "PR2",
        "<p><strong>How trees cool cities</strong></p><p>Trees lower temperatures by providing {{20}} and by releasing water vapour through their {{21}}. Large {{22}} may be several degrees cooler than the streets around them. However, trees need a steady supply of {{23}}, which can be difficult to guarantee during a heatwave.</p>"
      ),
      answers: blankAnswers("PR2", { 20: "D", 21: "G", 22: "E", 23: "B" })
    },
    {
      id: "PR2-g3",
      type: "multiple_choice",
      instructionHtml: "<p>Choose the correct letter, <strong>A, B, C or D</strong>.</p>",
      items: [
        {
          id: "PR2-q24",
          text: "According to paragraph C, why can air conditioning make cities hotter?",
          options: opts(
            "It is mainly used at night.",
            "It releases hot air and increases the burning of fossil fuels.",
            "It produces ground-level ozone.",
            "It stops people's bodies from recovering from the heat."
          )
        },
        {
          id: "PR2-q25",
          text: "What concern about reflective road coatings does the writer mention?",
          options: opts("They wear out quickly.", "They are expensive to apply.", "They may make people walking nearby feel hotter.", "They make roads more slippery.")
        },
        {
          id: "PR2-q26",
          text: "What is the main idea of paragraph F?",
          options: opts(
            "Cooling measures should be directed to the places that need them most.",
            "Satellites provide the most accurate temperature data.",
            "Air conditioning should be provided free to people on low incomes.",
            "Low-income areas are always the hottest parts of a city."
          )
        }
      ],
      answers: { "PR2-q24": key("B"), "PR2-q25": key("C"), "PR2-q26": key("A") }
    }
  ]
};

const PR3_TEXT = `<p>Boredom has a bad reputation. It is blamed for everything from mindless snacking and reckless driving to vandalism, and surveys regularly find that it is one of the emotions people most want to avoid. Parents worry when their children complain of having nothing to do, and employers fear that bored staff will make careless mistakes. It is hardly surprising, then, that so much ingenuity has gone into making sure we never have to experience it.</p>
<p>Yet it is worth asking what boredom actually is. One widely cited definition, proposed by the psychologist John Eastwood and his colleagues, describes it as the uncomfortable experience of wanting to engage in satisfying activity but being unable to do so. Crucially, on this view, boredom is not the same as having nothing to do. A person can be very busy and still bored, if what they are doing fails to hold their attention; equally, someone with empty hours ahead may feel perfectly content.</p>
<p>What has changed in recent years is how easily boredom can be escaped. With a smartphone in almost every pocket, a moment of emptiness can be filled instantly with messages, videos or news. The effect, I would argue, is not that we are less bored, but that we have lost the habit of tolerating even brief periods without stimulation. A striking illustration comes from a series of experiments published in 2014 by Timothy Wilson of the University of Virginia. Participants were asked to sit alone in a room with nothing to do but think, for between six and fifteen minutes, and most found the experience unpleasant. In one version of the study, participants were given the option of giving themselves a mild electric shock during the session – a shock that they had earlier said they would pay money to avoid. Remarkably, around two thirds of the men and a quarter of the women chose to shock themselves at least once rather than simply sit with their thoughts.</p>
<p>If boredom is so unpleasant, why might it be worth preserving? One answer comes from research on creativity. In a study carried out by Sandi Mann and Rebekah Cadman at the University of Central Lancashire, some participants were first given the deliberately dull task of copying numbers from a telephone directory, while others went straight to a creativity test in which they had to think of as many uses as possible for a pair of plastic cups. Those who had done the boring task came up with more ideas. In a second experiment, a group who merely read the numbers, rather than writing them down, did better still. This suggests that the less engaging the task, the more the mind was free to wander – and wandering, it seems, is where new ideas come from.</p>
<p>Philosophers have offered a further reason to value boredom. Andreas Elpidorou has argued that boredom works rather like pain: it is unpleasant in itself, but useful as a signal. Just as pain warns us that our body has been damaged, boredom tells us that our current activity no longer matches our goals, and pushes us to look for something more meaningful. On this account, a person who never allows themselves to feel bored may also miss the prompt to change direction.</p>
<p>None of this means that boredom is always harmless. Researchers distinguish between the passing boredom that everyone feels in a traffic jam or a long meeting and a chronic tendency to feel bored, which has been linked with depression, anxiety and problem gambling. For people who experience boredom in this more persistent form, the advice to 'embrace' it would be unhelpful, and in some cases professional support may be needed.</p>
<p>For the rest of us, however, the evidence suggests that our constant efforts to escape boredom may come at a cost. The point is not to seek out tedium for its own sake, nor to deny that some tasks are genuinely dull. Rather, it is that occasional boredom deserves to be tolerated instead of immediately cured. The next time a queue or a delayed train leaves us with nothing to do, it may be worth resisting the urge to reach for our phones, and seeing where our thoughts lead.</p>`;

const PR3 = {
  seedKey: "PR3",
  globalTitle: "Northstar Practice Reading",
  title: "In Praise of Boredom",
  part: 3,
  level: "HARD",
  contentHtml: PR3_TEXT,
  groups: [
    {
      id: "PR3-g1",
      type: "ynng",
      instructionHtml: YNNG_HTML,
      items: [
        { id: "PR3-y27", text: "It is surprising that people try so hard to avoid boredom." },
        { id: "PR3-y28", text: "The main effect of smartphones has been to make people less willing to put up with boredom." },
        { id: "PR3-y29", text: "Wilson's research received too much attention in the media." },
        { id: "PR3-y30", text: "Allowing the mind to wander may help people to produce new ideas." },
        { id: "PR3-y31", text: "Everyone would benefit from learning to accept boredom." }
      ],
      answers: { "PR3-y27": key("NO"), "PR3-y28": key("YES"), "PR3-y29": key("NOT GIVEN"), "PR3-y30": key("YES"), "PR3-y31": key("NO") }
    },
    {
      id: "PR3-g2",
      type: "matching_features",
      instructionHtml:
        "<p>Look at the following statements (Questions 32–36) and the list of researchers below.</p><p>Match each statement with the correct researcher, <strong>A–D</strong>. You may use any letter more than once.</p>",
      optionsTitle: "List of Researchers",
      allowReuse: true,
      options: opts("Timothy Wilson", "Sandi Mann and Rebekah Cadman", "Andreas Elpidorou", "John Eastwood"),
      items: [
        { id: "PR3-f32", text: "described boredom in terms of a wish to be occupied that cannot be satisfied" },
        { id: "PR3-f33", text: "compared the effects of two tasks that differed in how dull they were" },
        { id: "PR3-f34", text: "found that many people preferred physical discomfort to being alone with their thoughts" },
        { id: "PR3-f35", text: "suggested that boredom can guide people towards new goals" },
        { id: "PR3-f36", text: "recorded different responses from men and women" }
      ],
      answers: { "PR3-f32": key("D"), "PR3-f33": key("B"), "PR3-f34": key("A"), "PR3-f35": key("C"), "PR3-f36": key("A") }
    },
    {
      id: "PR3-g3",
      type: "multiple_choice",
      instructionHtml: "<p>Choose the correct letter, <strong>A, B, C or D</strong>.</p>",
      items: [
        {
          id: "PR3-q37",
          text: "What is the writer's main purpose in the first paragraph?",
          options: opts("to explain why boredom causes accidents", "to describe the common negative view of boredom", "to criticise parents who worry too much", "to suggest ways of avoiding boredom")
        },
        {
          id: "PR3-q38",
          text: "The writer mentions the group who read the numbers in order to show that",
          options: opts("reading is more tiring than writing.", "the experiment needed to be repeated.", "a duller task led to greater creativity.", "creativity tests are unreliable.")
        },
        {
          id: "PR3-q39",
          text: "According to the writer, chronic boredom",
          options: opts("should not be treated in the same way as ordinary boredom.", "is caused by the use of smartphones.", "can be cured by learning to embrace it.", "is less common than researchers believe.")
        },
        {
          id: "PR3-q40",
          text: "Which of the following best summarises the writer's conclusion?",
          options: opts(
            "People should deliberately look for boring activities.",
            "Boring tasks should be removed from daily life where possible.",
            "Smartphones should not be used in public places.",
            "Occasional boredom should be accepted rather than immediately avoided."
          )
        }
      ],
      answers: { "PR3-q37": key("B"), "PR3-q38": key("C"), "PR3-q39": key("A"), "PR3-q40": key("D") }
    }
  ]
};

export const PRACTICE_READING = [PR1, PR2, PR3].map((r) => ({ ...r, source: SOURCE }));

// ---------------------------------------------------------------- WRITING

const para = (...ps) => ps.map((p) => `<p>${p}</p>`).join("");

export const PRACTICE_WRITING = [
  {
    seedKey: "PW1",
    task: 1,
    title: "Task 1 – Books read by age group",
    level: "EASY",
    questionHtml:
      "<p>The chart below shows the average number of books read per person in one year by people in four age groups in a European country, in 2005 and 2025.</p><p>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</p>",
    image: { url: "/ielts-assets/images/books-read-chart.svg", name: "books-read-chart.svg" },
    modelAnswerHtml: para(
      "The bar chart compares how many books people in four age groups read on average in a year in 2005 and 2025.",
      "Overall, reading declined among younger adults over the twenty-year period but increased among older people, so that by 2025 the over-60s had become by far the most active readers.",
      "In 2005, the number of books read rose steadily with age, from nine a year for 16- to 24-year-olds to eleven and twelve for the two middle groups, and fourteen for those aged 60 and over. The gap between the youngest and oldest groups was therefore relatively small.",
      "By 2025, this pattern had become much more pronounced. The two younger groups each read three fewer books than before, at six and eight respectively. In contrast, reading among 40- to 59-year-olds rose slightly, to thirteen books, while the figure for the over-60s increased sharply, by five books to nineteen a year – more than three times the figure for the youngest group."
    )
  },
  {
    seedKey: "PW2",
    task: 1,
    title: "Task 1 – How glass bottles are recycled",
    level: "MEDIUM",
    questionHtml:
      "<p>The diagram below shows how glass bottles are recycled.</p><p>Summarise the information by selecting and reporting the main features.</p>",
    image: { url: "/ielts-assets/images/glass-recycling-process.svg", name: "glass-recycling-process.svg" },
    modelAnswerHtml: para(
      "The diagram illustrates the process by which used glass bottles are recycled to make new ones.",
      "Overall, the process consists of nine stages, beginning with the collection of old bottles and ending with new bottles returning to shops, so it forms a continuous cycle.",
      "First, used bottles are collected from bottle banks and taken by lorry to a recycling plant. There, they are sorted into three colours – clear, green and brown – before being washed to remove labels and dirt. The clean glass is then crushed into small pieces, known as cullet.",
      "In the next stage, the cullet is mixed with sand and other raw materials, and the mixture is heated in a furnace to around 1,500°C until it melts. The molten glass is poured into moulds and shaped into new bottles. Finally, these bottles are filled and delivered to shops, where they are bought by consumers, and the cycle can begin again."
    )
  },
  {
    seedKey: "PW3",
    task: 2,
    title: "Task 2 – Money lessons at school",
    level: "MEDIUM",
    questionHtml:
      "<p>Some people believe that secondary schools should teach students how to manage money, for example how to budget, save and borrow sensibly. Others think that this is the responsibility of parents, not schools.</p><p>Discuss both these views and give your own opinion.</p>",
    image: null,
    modelAnswerHtml: para(
      "Many young people leave school with little idea of how to manage a budget or avoid debt. While some argue that teaching these skills is a job for parents, I believe schools are better placed to take the lead, although families still have an important part to play.",
      "Those who think money management belongs at home make a fair point. Attitudes to spending and saving are shaped by everyday family life, as children watch how their parents handle bills or save for holidays. Parents can also tailor their advice to their own circumstances, and some feel that financial matters are a private issue in which the state should not interfere.",
      "However, relying on parents alone has serious drawbacks. Not all adults are confident with money themselves, and those who have struggled with debt may pass on the same habits without realising it. If financial education happens only at home, children from less stable backgrounds are likely to be at a disadvantage. A school course, by contrast, would give every student the same basic knowledge, such as how interest on a loan works or how to plan a monthly budget. It could also use practical activities, such as managing an imaginary salary, which make abstract ideas easier to understand.",
      "In my view, schools should therefore teach the fundamentals of personal finance to all students, ideally as a compulsory part of the curriculum in the final years of secondary education. Parents can then build on these lessons by discussing real decisions with their children.",
      "In conclusion, although families influence how young people think about money, schools offer the fairest and most reliable way to make sure that everyone leaves education with the skills they need to manage their finances."
    )
  },
  {
    seedKey: "PW4",
    task: 2,
    title: "Task 2 – Young people leaving rural areas",
    level: "HARD",
    questionHtml:
      "<p>In many countries, young people are leaving the countryside to live and work in cities.</p><p>Why is this happening? What can be done to make rural areas more attractive to young people?</p>",
    image: null,
    modelAnswerHtml: para(
      "In many countries, young people are moving away from villages and small towns in large numbers. This essay will examine the main reasons for this trend and suggest some measures that could make rural life more appealing.",
      "The most important cause is the shortage of good jobs outside cities. Agriculture, traditionally the main employer in the countryside, now relies heavily on machinery and needs far fewer workers, while most well-paid positions in areas such as technology and finance are concentrated in urban centres. Education is a second factor. Universities and colleges are usually located in cities, and young people who move there to study often build their careers and social lives there too. Finally, many young adults are attracted by the wider range of entertainment, services and cultural activities that cities offer.",
      "Governments could reduce this movement in several ways. First, they could encourage businesses to open offices in rural areas by offering tax incentives, and invest in fast internet connections so that people can work remotely for city-based companies. Second, improving transport links would allow young people to live in the countryside while still having access to urban jobs and facilities. Local authorities could also support community projects, such as sports clubs, festivals and shared workspaces, which give young residents a reason to stay and a sense of belonging.",
      "In conclusion, young people leave rural areas mainly because of limited job and study opportunities and a lack of amenities. Although this trend is unlikely to be reversed completely, better connectivity, transport and investment in local communities could make the countryside a far more attractive place to build a life."
    )
  }
].map((w) => ({ ...w, source: SOURCE }));
