// Practice Test 2: a whole test (four listening parts, three reading passages, two writing tasks)
// for the student hub's Practice Tests page. Like seed/practice.js, all of it is original, written
// for Northstar in the format of the IELTS test (it is not taken from any published book), and it
// is loaded with use: "practice". seed/tests.js groups these records into the test.
//
// Keep the answer keys unpatterned: option lists and headings are deliberately out of order.

import { blankAnswers, blanks, key, opts } from "./helpers.js";
import { transcriptHtml } from "./practiceTranscripts.js";
import { TEST2_TRANSCRIPTS } from "./test2Transcripts.js";

const SOURCE = "Northstar practice (original)";
const TFNG_HTML =
  "<p>Do the following statements agree with the information given in the reading passage?</p><p>Choose <strong>TRUE</strong> if the statement agrees with the information, <strong>FALSE</strong> if the statement contradicts the information, or <strong>NOT GIVEN</strong> if there is no information on this.</p>";
const YNNG_HTML =
  "<p>Do the following statements agree with the views of the writer in the reading passage?</p><p>Choose <strong>YES</strong> if the statement agrees with the views of the writer, <strong>NO</strong> if the statement contradicts the views of the writer, or <strong>NOT GIVEN</strong> if it is impossible to say what the writer thinks about this.</p>";

// ---------------------------------------------------------------- LISTENING

const T2L1 = {
  seedKey: "T2L1",
  title: "Hillbrook Community Garden – Renting a Plot",
  section: 1,
  level: "EASY",
  groups: [
    {
      id: "T2L1-g1",
      type: "form_completion",
      instructionHtml: "<p>Complete the form below.</p><p>Write <strong>ONE WORD AND/OR A NUMBER</strong> for each answer.</p>",
      contentHtml: blanks(
        "T2L1",
        "<p><strong>Hillbrook Community Garden – New Member</strong></p><ul><li>Name: Hannah {{1}}</li><li>Address: 14 {{2}} Lane</li><li>Plot number: {{3}}</li><li>Plot available from: {{4}} March</li><li>Annual fee: £{{5}}</li><li>Will share the plot with her {{6}}</li></ul>"
      ),
      answers: blankAnswers("T2L1", {
        1: "Tennant",
        2: "Quarry",
        3: ["27", "twenty-seven", "twenty seven"],
        4: ["15th", "15", "fifteenth"],
        5: ["48", "forty-eight", "forty eight", "48 pounds"],
        6: ["neighbour", "neighbor"]
      })
    },
    {
      id: "T2L1-g2",
      type: "note_completion",
      instructionHtml: "<p>Complete the notes below.</p><p>Write <strong>ONE WORD ONLY</strong> for each answer.</p>",
      contentHtml: blanks(
        "T2L1",
        "<p><strong>Information for members</strong></p><ul><li>Shared tools are kept in the green {{7}}</li><li>Members are not allowed to grow {{8}}</li><li>The water is turned off from November until {{9}}</li><li>All members help with the produce {{10}} in September</li></ul>"
      ),
      answers: blankAnswers("T2L1", {
        7: "shed",
        8: ["trees", "tree"],
        9: "February",
        10: "market"
      })
    }
  ]
};

const T2L2 = {
  seedKey: "T2L2",
  title: "Hartwell Railway Museum – Talk for New Volunteers",
  section: 2,
  level: "MEDIUM",
  groups: [
    {
      id: "T2L2-g1",
      type: "multiple_choice",
      instructionHtml: "<p>Choose the correct letter, <strong>A, B or C</strong>.</p>",
      items: [
        { id: "T2L2-q11", text: "The museum building was originally", options: opts("a railway station.", "a place where engines were repaired.", "a warehouse for goods.") },
        { id: "T2L2-q12", text: "What will be new at the museum this year?", options: opts("a miniature railway", "a driving simulator", "an outdoor play area") },
        { id: "T2L2-q13", text: "The museum most needs more volunteers", options: opts("at weekends.", "in the school holidays.", "on weekday mornings.") },
        { id: "T2L2-q14", text: "Before starting work, every new volunteer must", options: opts("take part in safety training.", "spend a day with an experienced volunteer.", "have an interview.") },
        { id: "T2L2-q15", text: "What does the museum give its volunteers?", options: opts("free tickets for their families", "money for their travel costs", "lower prices in the shop") }
      ],
      answers: { "T2L2-q11": key("B"), "T2L2-q12": key("A"), "T2L2-q13": key("C"), "T2L2-q14": key("A"), "T2L2-q15": key("B") }
    },
    {
      id: "T2L2-g2",
      type: "matching_features",
      instructionHtml:
        "<p>What does the speaker say about each of the following parts of the museum?</p><p>Choose <strong>FIVE</strong> answers from the box and drag the correct letter, <strong>A–G</strong>, next to questions 16–20.</p>",
      optionsTitle: "Comments",
      allowReuse: false,
      options: opts(
        "It is closed to visitors at present.",
        "It is going to be made bigger.",
        "It is the quietest part of the museum.",
        "Visitors often have trouble finding it.",
        "It is especially popular with young children.",
        "It gets very crowded at lunchtime.",
        "Volunteers need extra training to work there."
      ),
      items: [
        { id: "T2L2-f16", text: "the Engine Hall" },
        { id: "T2L2-f17", text: "the Signal Box" },
        { id: "T2L2-f18", text: "the Workshop Gallery" },
        { id: "T2L2-f19", text: "the Carriage Shed" },
        { id: "T2L2-f20", text: "the Archive Room" }
      ],
      answers: { "T2L2-f16": key("E"), "T2L2-f17": key("G"), "T2L2-f18": key("A"), "T2L2-f19": key("B"), "T2L2-f20": key("D") }
    }
  ]
};

const T2L3 = {
  seedKey: "T2L3",
  title: "Student Presentation on the Four-Day Week",
  section: 3,
  level: "MEDIUM",
  groups: [
    {
      id: "T2L3-g1",
      type: "multiple_choice",
      instructionHtml: "<p>Choose the correct letter, <strong>A, B or C</strong>.</p>",
      items: [
        {
          id: "T2L3-q21",
          text: "Why did Ben want to do the presentation on the four-day week?",
          options: opts("Their tutor recommended the topic.", "A lot has been published about it.", "He knows someone who has experienced it.")
        },
        {
          id: "T2L3-q22",
          text: "What surprised Leila about the trial at the software company?",
          options: opts("that the amount of work done did not fall", "how the employees spent their extra day", "how many firms kept the four-day week afterwards")
        },
        {
          id: "T2L3-q23",
          text: "Leila and Ben agree that the main weakness of the trials is that",
          options: opts("the companies involved chose to take part.", "they did not continue for long enough.", "the results depended on what staff reported.")
        },
        { id: "T2L3-q24", text: "What is the problem with the presentation at the moment?", options: opts("It does not have enough charts.", "The ending is weak.", "It is too long.") },
        {
          id: "T2L3-q25",
          text: "Which section do they decide to leave out?",
          options: opts("the costs for employers", "the history of the working week", "the trials in other countries")
        },
        { id: "T2L3-q26", text: "What will Ben do before Thursday?", options: opts("redesign the slides", "write to a manager", "time the presentation") }
      ],
      answers: {
        "T2L3-q21": key("C"),
        "T2L3-q22": key("B"),
        "T2L3-q23": key("A"),
        "T2L3-q24": key("C"),
        "T2L3-q25": key("B"),
        "T2L3-q26": key("A")
      }
    },
    {
      id: "T2L3-g2",
      type: "matching_features",
      instructionHtml:
        "<p>What do the students say about each of the following sources?</p><p>Choose <strong>FOUR</strong> answers from the box and drag the correct letter, <strong>A–F</strong>, next to questions 27–30.</p>",
      optionsTitle: "Comments",
      allowReuse: false,
      options: opts(
        "It is out of date.",
        "It is too technical for their audience.",
        "It was difficult to obtain.",
        "It contains useful statistics.",
        "It repeats what other sources say.",
        "It may not be objective."
      ),
      items: [
        { id: "T2L3-f27", text: "the Lindqvist report" },
        { id: "T2L3-f28", text: "the article by Okafor" },
        { id: "T2L3-f29", text: "the WorkWell website" },
        { id: "T2L3-f30", text: "the Osaka case study" }
      ],
      answers: { "T2L3-f27": key("D"), "T2L3-f28": key("A"), "T2L3-f29": key("F"), "T2L3-f30": key("B") }
    }
  ]
};

const T2L4 = {
  seedKey: "T2L4",
  title: "Lecture: Salt in Human History",
  section: 4,
  level: "HARD",
  groups: [
    {
      id: "T2L4-g1",
      type: "note_completion",
      instructionHtml: "<p>Complete the notes below.</p><p>Write <strong>ONE WORD ONLY</strong> for each answer.</p>",
      contentHtml: blanks(
        "T2L4",
        "<p><strong>Salt in human history</strong></p><p><strong>Why salt mattered</strong></p><ul><li>its main use was to {{31}} food</li><li>Hallstatt, Austria: salt {{32}} were worked in prehistoric times</li></ul><p><strong>Rome</strong></p><ul><li>the Via Salaria was a {{33}} for bringing salt from the coast</li><li>'salary' probably meant money given to {{34}} for buying salt</li></ul><p><strong>Trade in West Africa</strong></p><ul><li>salt was cut into large {{35}} and carried by camel</li><li>at markets in the south it was exchanged for {{36}}</li></ul><p><strong>Salt and governments</strong></p><ul><li>France: the gabelle, an unpopular {{37}} on salt</li><li>India, 1930: Gandhi led a {{38}} to the sea</li></ul><p><strong>Salt today</strong></p><ul><li>demand for salting food fell after the invention of {{39}}</li><li>most salt is now used by the {{40}} industry</li></ul>"
      ),
      answers: blankAnswers("T2L4", {
        31: "preserve",
        32: ["mines", "mine"],
        33: "road",
        34: "soldiers",
        35: ["slabs", "slab"],
        36: "gold",
        37: "tax",
        38: "march",
        39: "refrigeration",
        40: "chemical"
      })
    }
  ]
};

export const TEST2_LISTENING = [T2L1, T2L2, T2L3, T2L4].map((l) => ({ ...l, source: SOURCE, transcriptHtml: transcriptHtml(TEST2_TRANSCRIPTS[l.seedKey]) }));

// ---------------------------------------------------------------- READING

const T2R1_TEXT = `<p>For sailors in the early eighteenth century, knowing where they were was a matter of life and death. Finding a ship's latitude, its distance north or south of the equator, was fairly simple: a navigator could work it out from the height of the sun at midday or of certain stars at night. Longitude, the distance east or west, was a different matter. With no reliable way of measuring it, captains had to estimate their position from their speed and direction, and their estimates were often badly wrong. In 1707, four British warships returning from the Mediterranean struck rocks off the Isles of Scilly in bad weather, and more than 1,400 sailors drowned. The fleet's navigators had badly misjudged where they were.</p>
<p>The disaster helped to persuade the British Parliament to act. In 1714 it passed the Longitude Act, which offered a reward of up to £20,000, a huge fortune at the time, to anyone who could find a practical method of determining longitude at sea. A committee, which became known as the Board of Longitude, was set up to judge the proposals.</p>
<p>In principle, the answer had been understood for a long time. The Earth turns through fifteen degrees every hour, so a difference in time is also a difference in longitude. If a navigator knew the time at his home port at the exact moment when the sun was highest over his ship, the gap between the two would tell him how far east or west he had travelled. The difficulty was keeping the home port's time. The best clocks of the day were controlled by a swinging pendulum, which was useless on a rolling deck, and changes in temperature and dampness made metal parts expand, shrink and rust. Many of the leading scientists of the period, including Isaac Newton, doubted that a clock would ever be accurate enough, and expected the solution to come from astronomy instead.</p>
<p>The man who proved them wrong was not a scientist. John Harrison was a carpenter's son from the north of England who had taught himself to make clocks, at first almost entirely out of wood. He began work on a sea clock around 1730 and completed it five years later. Known today as H1, it was a large brass machine weighing more than thirty kilograms, in which two linked balances, moving in opposite directions, took the place of a pendulum, so that the motion of the ship did not disturb it. On a trial voyage to Lisbon in 1736, H1 performed well, and on the return journey Harrison used it to correct the ship's navigator, who had misjudged their position by many kilometres.</p>
<p>Harrison could have asked for a formal trial at that point. Instead, convinced that he could do better, he asked the Board only for money to continue. He spent the next two decades building two more large clocks. The third, H3, occupied him for nearly nineteen years and contained several important inventions, but it never satisfied him.</p>
<p>His breakthrough came from an unexpected direction. In the 1750s Harrison had a pocket watch made to his own design for his personal use, and was astonished by how well it kept time. He abandoned the big machines and applied his ideas to a watch. The result, completed in 1759 and known as H4, was only about thirteen centimetres across. In 1761 Harrison's son William carried it on a voyage to Jamaica. When the ship arrived after 81 days at sea, the watch was found to be just 5.1 seconds slow.</p>
<p>This was far more accurate than the Act required, yet the Board was reluctant to pay. Some of its members suspected that the result had been a matter of luck; others favoured a rival method based on measuring the position of the moon against the stars, which was supported by Nevil Maskelyne, the Astronomer Royal. The Board demanded a second trial, and then insisted that Harrison explain exactly how the watch worked and show that other craftsmen could copy it. He received half the reward, but the rest was held back for years.</p>
<p>By now an old man, Harrison finally appealed to King George III, who tested a later watch himself at his private observatory in 1772 and took the inventor's side. The following year, Parliament awarded Harrison a further £8,750. He died three years later, at the age of 83. Proof of the value of his work was already arriving. Captain James Cook carried a copy of H4 on his second voyage to the Pacific, between 1772 and 1775, and wrote warmly of the watch that had guided him through the journey. Within a few decades, cheaper versions were being made in large numbers, and the marine chronometer became standard equipment on ocean-going ships.</p>`;

const T2R1 = {
  seedKey: "T2R1",
  globalTitle: "Northstar Practice Test 2",
  title: "The Carpenter's Clock",
  part: 1,
  level: "EASY",
  contentHtml: T2R1_TEXT,
  groups: [
    {
      id: "T2R1-g1",
      type: "tfng",
      instructionHtml: TFNG_HTML,
      items: [
        { id: "T2R1-t1", text: "In the early 1700s, sailors found it harder to measure longitude than latitude." },
        { id: "T2R1-t2", text: "The ships lost in 1707 were on their way to the Mediterranean." },
        { id: "T2R1-t3", text: "The Longitude Act was the first law of its kind in Europe." },
        { id: "T2R1-t4", text: "Isaac Newton was confident that a clock would solve the problem of longitude." },
        { id: "T2R1-t5", text: "Harrison learned to make clocks without a teacher." },
        { id: "T2R1-t6", text: "H1 cost more to build than Harrison's later clocks." },
        { id: "T2R1-t7", text: "Captain Cook had a positive opinion of the watch he took to the Pacific." }
      ],
      answers: {
        "T2R1-t1": key("TRUE"),
        "T2R1-t2": key("FALSE"),
        "T2R1-t3": key("NOT GIVEN"),
        "T2R1-t4": key("FALSE"),
        "T2R1-t5": key("TRUE"),
        "T2R1-t6": key("NOT GIVEN"),
        "T2R1-t7": key("TRUE")
      }
    },
    {
      id: "T2R1-g2",
      type: "note_completion",
      instructionHtml: "<p>Complete the notes below.</p><p>Choose <strong>ONE WORD AND/OR A NUMBER</strong> from the passage for each answer.</p>",
      contentHtml: blanks(
        "T2R1",
        "<p><strong>Harrison's timekeepers</strong></p><p><strong>H1</strong></p><ul><li>made mainly of {{8}}</li><li>two balances were used instead of a {{9}}</li></ul><p><strong>H3</strong></p><ul><li>took almost {{10}} years to build</li></ul><p><strong>H4</strong></p><ul><li>based on a pocket {{11}} that Harrison had owned</li><li>tested on a voyage to {{12}}</li><li>lost only 5.1 {{13}} during the journey</li></ul>"
      ),
      answers: blankAnswers("T2R1", {
        8: "brass",
        9: "pendulum",
        10: ["nineteen", "19"],
        11: "watch",
        12: "Jamaica",
        13: "seconds"
      })
    }
  ]
};

const T2R2_PARAS = [
  "Deep inside a mountain on the Norwegian island of Spitsbergen, about 1,300 kilometres from the North Pole, a concrete tunnel leads to three chambers cut into the rock. They hold neither gold nor weapons, but small foil packets of seeds: wheat from Central Asia, rice from the Philippines, beans from the Andes. The Svalbard Global Seed Vault, which opened in 2008, was built to store spare copies of the seed collections held by institutions around the world, and it now contains well over a million samples.",
  "The reasoning behind the vault begins with a worrying trend. Over thousands of years, farmers developed an enormous range of local crop varieties, each suited to particular soils, climates and tastes. During the twentieth century, as agriculture became more commercial, many of these were abandoned in favour of a small number of high-yielding types, and the United Nations has estimated that about three-quarters of the genetic diversity of crops disappeared from farmers' fields in that period. Uniform crops are efficient, but they are also vulnerable. In the 1840s, Ireland's poor depended very heavily on a single variety of potato, and when a disease to which it had no resistance arrived, the harvest failed across the country and about a million people died.",
  "Old and wild varieties matter because they may carry the traits that plant breeders will need in the future, such as the ability to survive drought, salty soil or a new disease. To protect them, some 1,700 collections, known as gene banks, have been set up around the world. The idea owes much to the Russian botanist Nikolai Vavilov, who travelled to five continents in the 1920s and 1930s gathering seeds, and built up in Leningrad what was then the largest collection on Earth.",
  "The history of Vavilov's institute also shows how fragile such collections can be. When Leningrad was surrounded by the German army for more than two years during the Second World War, its scientists guarded the seeds, tubers and grain in their care, and several of them died of hunger rather than eat any of it. Vavilov himself, having fallen out of favour with the Soviet government, had died in prison by the time the siege ended. More recently, gene banks have been destroyed by fighting in Afghanistan and Iraq, and others have been damaged by floods, fires, or simply by a lack of money to keep their freezers running.",
  "Svalbard was chosen as the site of a back-up for several reasons. It is remote and politically stable, and the rock of the mountain is geologically stable. The seeds are kept at minus eighteen degrees Celsius, and because the surrounding ground is permanently frozen, they would stay cold for a long time even if the power supply failed. The Norwegian government paid for the construction and owns the building, but not its contents. Each box remains the property of the institution that deposited it, and nobody else may open it. The arrangement is often compared to a safety deposit box at a bank.",
  "The system was first put to the test in 2015. An international research centre whose gene bank was based near the Syrian city of Aleppo had been cut off from its collection by the civil war. Fortunately, it had already sent copies of most of its seeds to Svalbard. It asked for some of them back, and used them to grow new plants at stations in Lebanon and Morocco. Within a few years it had rebuilt its collection and was returning fresh seed to the vault.",
  "The vault is not without its problems or its critics. Late in 2016, during an unusually warm and wet spell, melted snow and rain ran into the entrance tunnel and froze there. No seeds were harmed, but the incident was an embarrassment for a building intended to last for centuries, and the entrance has since been rebuilt to make it waterproof. A more fundamental objection is that seeds in a freezer cannot adapt. Crops growing in fields keep changing in response to pests and to a shifting climate, whereas a stored seed is a snapshot of the past. Many experts therefore see the vault as an insurance policy of last resort, and argue that it must not become a substitute for supporting the farmers who still grow traditional varieties."
];

const T2R2 = {
  seedKey: "T2R2",
  globalTitle: "Northstar Practice Test 2",
  title: "A Vault for the World's Seeds",
  part: 2,
  level: "MEDIUM",
  contentHtml: T2R2_PARAS.map((p, i) => `<p><strong>${String.fromCharCode(65 + i)}</strong>&nbsp;&nbsp;${p}</p>`).join(""),
  groups: [
    {
      id: "T2R2-g1",
      type: "matching_information",
      instructionHtml:
        "<p>The reading passage has seven paragraphs, <strong>A–G</strong>.</p><p>Which paragraph contains the following information? Drag the correct letter, <strong>A–G</strong>, next to questions 14–18.</p><p><em>NB</em> You may use any letter more than once.</p>",
      optionsTitle: "Paragraphs",
      allowReuse: true,
      options: opts("Paragraph A", "Paragraph B", "Paragraph C", "Paragraph D", "Paragraph E", "Paragraph F", "Paragraph G"),
      items: [
        { id: "T2R2-i14", text: "an explanation of who the stored seeds belong to" },
        { id: "T2R2-i15", text: "an example of a food shortage caused by a lack of variety in a crop" },
        { id: "T2R2-i16", text: "a reference to people who gave their lives to protect a collection" },
        { id: "T2R2-i17", text: "the argument that storing seeds is not enough to protect crop diversity" },
        { id: "T2R2-i18", text: "an account of seeds being taken out of the vault and used" }
      ],
      answers: { "T2R2-i14": key("E"), "T2R2-i15": key("B"), "T2R2-i16": key("D"), "T2R2-i17": key("G"), "T2R2-i18": key("F") }
    },
    {
      id: "T2R2-g2",
      type: "sentence_completion",
      instructionHtml: "<p>Complete the sentences below.</p><p>Choose <strong>NO MORE THAN THREE WORDS</strong> from the passage for each answer.</p>",
      contentHtml: blanks(
        "T2R2",
        "<ul><li>The seeds in the vault are stored in packets made of {{19}}.</li><li>Collections of seeds kept in different countries are called {{20}}.</li><li>The agreement between depositors and the vault is said to resemble a {{21}} in a bank.</li><li>The centre near Aleppo regrew its seeds in Lebanon and {{22}}.</li></ul>"
      ),
      answers: blankAnswers("T2R2", {
        19: "foil",
        20: ["gene banks", "genebanks"],
        21: ["safety deposit box", "deposit box"],
        22: "Morocco"
      })
    },
    {
      id: "T2R2-g3",
      type: "multiple_answers",
      instructionHtml: "<p>Choose <strong>TWO</strong> letters, <strong>A–E</strong>.</p>",
      items: [
        {
          id: "T2R2-m23",
          text: "Which TWO reasons for building the vault in Svalbard are mentioned in the passage?",
          count: 2,
          options: opts(
            "The ground there is frozen all year round.",
            "Many scientists already work on the island.",
            "There is little risk of movement in the ground.",
            "It is close to the countries that provide most seeds.",
            "Construction there is cheaper than elsewhere."
          ),
          correct: ["A", "C"]
        },
        {
          id: "T2R2-m25",
          text: "Which TWO statements are true of the flooding of the entrance tunnel?",
          count: 2,
          options: opts(
            "Some of the stored seeds were damaged.",
            "The vault had to be closed for several years.",
            "The weather had been warmer than normal.",
            "Seeds were moved to another country.",
            "Changes were later made to the entrance."
          ),
          correct: ["C", "E"]
        }
      ],
      answers: {}
    }
  ]
};

const T2R3_TEXT = `<p>Ask almost anyone who invented the light bulb and the answer will be Thomas Edison. Ask who discovered the theory of evolution, and you will be told it was Charles Darwin. Our picture of how new ideas arise is built around individuals such as these: brilliant, solitary figures who see what nobody else can see. It is an attractive picture, and it makes for excellent stories. It is also, I would suggest, seriously misleading.</p>
<p>Consider Edison. By the time he began work on electric lighting in 1878, inventors had been experimenting with glowing filaments for decades, and in England Joseph Swan was demonstrating a working lamp at almost the same moment. Nor did Edison work alone. His laboratory at Menlo Park in New Jersey employed dozens of skilled assistants, who tested thousands of materials in search of a filament that would last. Edison's real achievement was arguably not a single invention but a new way of inventing: an organised team, supported by investors, working systematically towards a product that could be sold. What the public remembered, however, was the man.</p>
<p>The same pattern appears again and again. Darwin was prompted to publish his theory in 1858 only when he received a letter from Alfred Russel Wallace, a naturalist working in the islands of south-east Asia, who had arrived at the same idea independently. In the seventeenth century, Isaac Newton and Gottfried Leibniz each developed calculus without the other's help and then spent years disputing who had been first. On a single day in 1876, Alexander Graham Bell and Elisha Gray both submitted designs for a telephone to the United States patent office.</p>
<p>Such coincidences were once treated as curiosities. In 1922, however, the sociologists William Ogburn and Dorothy Thomas published a list of 148 important discoveries that had been made by two or more people at about the same time. Some decades later, another sociologist, Robert Merton, went further. Having examined hundreds of cases, he concluded that 'multiples', as he called them, are not the exception in science but the rule, and that it is the discovery made by one person alone that needs explaining.</p>
<p>Why should this be so? The most persuasive explanation is that discoveries depend on what is already known. When the necessary knowledge, instruments and questions are in place, several people are likely to take the next step, because the next step has become possible. Newton himself acknowledged as much when he wrote that if he had seen further than others, it was by standing on the shoulders of giants. On this view, an invention is less like a flash of lightning than like fruit ripening on a tree: if one hand does not pick it, another soon will.</p>
<p>If the evidence is so clear, why does the myth of the lone genius survive? One reason is that stories need heroes. A biography of one remarkable person is far easier to write, and to enjoy, than an account of a slowly developing network of people and ideas. A second reason is institutional. Patents are granted to named inventors and prizes to named scientists; the Nobel Prize in each science can be shared by no more than three people, although a single modern experiment may involve several thousand. Reward systems of this kind do not merely reflect the myth. They require it.</p>
<p>It might be objected that none of this matters very much. I believe it matters a good deal. A society that believes progress comes from rare individuals will spend its energy searching for them, and will neglect the less glamorous things on which discovery actually depends: good schools, well-equipped laboratories, and the freedom to exchange ideas. The myth is discouraging, too. Young people who are told that great work is done by people quite unlike themselves may conclude that there is little point in trying.</p>
<p>This is not to claim that individuals are interchangeable, or that talent is an illusion. Darwin spent twenty years gathering the evidence that made his theory convincing, and Wallace was the first to say that the older man deserved the greater credit. Who makes a discovery affects how soon it is made, how well it is explained and how quickly it is accepted. But there is a difference between saying that individuals matter and saying that they work alone. The first claim is obviously true. The second has never been true of anyone.</p>`;

const T2R3 = {
  seedKey: "T2R3",
  globalTitle: "Northstar Practice Test 2",
  title: "The Myth of the Lone Genius",
  part: 3,
  level: "HARD",
  contentHtml: T2R3_TEXT,
  groups: [
    {
      id: "T2R3-g1",
      type: "multiple_choice",
      instructionHtml: "<p>Choose the correct letter, <strong>A, B, C or D</strong>.</p>",
      items: [
        {
          id: "T2R3-q27",
          text: "What point does the writer make about Edison in the second paragraph?",
          options: opts(
            "He took the idea for his lamp from Joseph Swan.",
            "His assistants deserve the credit for the light bulb.",
            "His most important contribution was a method of working.",
            "He was more interested in money than in science."
          )
        },
        {
          id: "T2R3-q28",
          text: "The writer refers to Bell and Gray as an example of",
          options: opts(
            "inventors who quarrelled over an idea.",
            "an invention that appeared in two places at once.",
            "the unfairness of the patent system.",
            "a discovery that was made by accident."
          )
        },
        {
          id: "T2R3-q29",
          text: "According to the passage, Robert Merton believed that",
          options: opts(
            "Ogburn and Thomas had missed many cases.",
            "scientists often copy one another's work.",
            "discoveries by one person alone do not exist.",
            "simultaneous discovery is the normal pattern in science."
          )
        },
        {
          id: "T2R3-q30",
          text: "The writer compares an invention to fruit on a tree in order to suggest that",
          options: opts(
            "it will be made by someone once the conditions are right.",
            "it takes a long time to develop.",
            "the best ideas come from nature.",
            "its timing cannot be predicted."
          )
        }
      ],
      answers: { "T2R3-q27": key("C"), "T2R3-q28": key("B"), "T2R3-q29": key("D"), "T2R3-q30": key("A") }
    },
    {
      id: "T2R3-g2",
      type: "ynng",
      instructionHtml: YNNG_HTML,
      items: [
        { id: "T2R3-y31", text: "The popular idea of how discoveries are made gives a false impression." },
        { id: "T2R3-y32", text: "Newton treated Leibniz unfairly during their dispute." },
        { id: "T2R3-y33", text: "The rules for awarding prizes help to keep the myth of the lone genius alive." },
        { id: "T2R3-y34", text: "Believing in lone geniuses has no serious consequences." },
        { id: "T2R3-y35", text: "It makes no difference which person makes a particular discovery." }
      ],
      answers: {
        "T2R3-y31": key("YES"),
        "T2R3-y32": key("NOT GIVEN"),
        "T2R3-y33": key("YES"),
        "T2R3-y34": key("NO"),
        "T2R3-y35": key("NO")
      }
    },
    {
      id: "T2R3-g3",
      type: "matching_sentence_endings",
      instructionHtml: "<p>Complete each sentence with the correct ending, <strong>A–G</strong>, below.</p>",
      optionsTitle: "",
      allowReuse: false,
      options: opts(
        "may decide that it is not worth making an effort.",
        "admitted that he owed a great deal to earlier thinkers.",
        "is simpler to tell than the history of a group.",
        "was the first to publish a list of multiple discoveries.",
        "thought that another scientist should receive more recognition than himself.",
        "is likely to pay too little attention to education.",
        "were unable to agree on who had been first."
      ),
      items: [
        { id: "T2R3-e36", text: "Newton" },
        { id: "T2R3-e37", text: "The story of a single hero" },
        { id: "T2R3-e38", text: "A society that expects progress to come from a few individuals" },
        { id: "T2R3-e39", text: "Young people who hear that geniuses are different from them" },
        { id: "T2R3-e40", text: "Wallace" }
      ],
      answers: { "T2R3-e36": key("B"), "T2R3-e37": key("C"), "T2R3-e38": key("F"), "T2R3-e39": key("A"), "T2R3-e40": key("E") }
    }
  ]
};

export const TEST2_READING = [T2R1, T2R2, T2R3].map((r) => ({ ...r, source: SOURCE }));

// ---------------------------------------------------------------- WRITING

const para = (...ps) => ps.map((p) => `<p>${p}</p>`).join("");

export const TEST2_WRITING = [
  {
    seedKey: "T2W1",
    task: 1,
    title: "Task 1 – Visits to three kinds of attraction",
    level: "MEDIUM",
    questionHtml:
      "<p>The graph below shows the number of visits made to three kinds of attraction in one country between 2000 and 2020.</p><p>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</p>",
    image: { url: "/ielts-assets/images/attraction-visits-graph.svg", name: "attraction-visits-graph.svg" },
    modelAnswerHtml: para(
      "The line graph shows how many visits were made each year to museums, theme parks and national parks in one country over a twenty-year period from 2000.",
      "Overall, visits to national parks and museums rose over the period, with national parks becoming the most popular attraction, whereas theme parks, which had been well ahead at the start, ended with the fewest visits.",
      "In 2000, theme parks received 30 million visits, well above the figures for museums (20 million) and national parks (12 million). Visits to theme parks climbed slightly to a peak of 32 million in 2005, but then fell steadily to 23 million in 2015, before dropping more sharply to 16 million in 2020.",
      "By contrast, the number of visits to national parks grew in every five-year period, slowly at first and then much faster, so that it had overtaken the other two attractions by 2015 and reached 38 million in 2020, more than three times the starting figure. Museum visits also increased, from 20 million to 25 million in 2010, but after that they levelled off at 26 million."
    )
  },
  {
    seedKey: "T2W2",
    task: 2,
    title: "Task 2 – Free public transport",
    level: "MEDIUM",
    questionHtml:
      "<p>Some people think that the best way to reduce traffic in cities is to make public transport free of charge.</p><p>To what extent do you agree or disagree?</p>",
    image: null,
    modelAnswerHtml: para(
      "Traffic congestion is a serious problem in most large cities, and it is sometimes suggested that buses and trains should be made free in order to solve it. While I accept that removing fares would persuade some drivers to leave their cars at home, I do not believe that it is the most effective solution.",
      "There are certainly arguments in favour of free public transport. Cost is a real barrier for people on low incomes, and if a family could travel across a city for nothing, some of them would use their car less. Free travel is also simple to understand and popular with voters, and in a few smaller cities where it has been introduced, the number of passengers has risen noticeably.",
      "However, the evidence suggests that most of these new passengers are people who used to walk or cycle, rather than former drivers. The reason is that people who drive rarely do so because the bus is too expensive. They drive because it is faster, more comfortable and more convenient. A free bus that comes twice an hour and is stuck in the same queue of cars will not change their minds. Furthermore, the money lost in fares has to come from somewhere, and if it is taken from the budget for new routes and vehicles, the service may actually get worse.",
      "In my view, cities achieve more by combining a reliable, frequent service with measures that make driving less attractive, such as charging drivers to enter the centre or reducing the number of parking spaces. Money raised in this way can then be spent on improving public transport, with cheaper tickets for those who need them most.",
      "In conclusion, although free public transport would have some benefits, I disagree that it is the best way to cut traffic. Better services, together with limits on car use, are likely to be far more effective."
    )
  }
].map((w) => ({ ...w, source: SOURCE }));

export const TEST2_TRANSCRIPT_KEYS = Object.keys(TEST2_TRANSCRIPTS);
