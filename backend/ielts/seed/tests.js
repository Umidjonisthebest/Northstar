// The practice tests that come with Northstar (the hub's Practice Tests page). A test is a list of
// seeded practice records, named by their seedKey: Test 1 is the first practice set (practice.js),
// Test 2 is test2.js. All of it is original material in the IELTS format.
// A teacher can change a seeded test or build new ones in the studio (lib/practiceTests.js).

export const PRACTICE_TESTS = [
  {
    seedKey: "PT1",
    title: "Practice Test 1",
    level: "MEDIUM",
    description: "Cycle tours, a library, canteen waste and Roman concrete; then the tin can, hot cities and the case for boredom.",
    listening: ["PL1", "PL2", "PL3", "PL4"],
    reading: ["PR1", "PR2", "PR3"],
    writing: ["PW1", "PW3"]
  },
  {
    seedKey: "PT2",
    title: "Practice Test 2",
    level: "MEDIUM",
    description: "A community garden, a railway museum, the four-day week and salt; then a clock at sea, a seed vault and the lone genius.",
    listening: ["T2L1", "T2L2", "T2L3", "T2L4"],
    reading: ["T2R1", "T2R2", "T2R3"],
    writing: ["T2W1", "T2W2"]
  }
];
