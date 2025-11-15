#!/usr/bin/env -S npx ts-node

import * as admin from "firebase-admin";
import { exit } from "process";
import { generateRanking, runWinnerApp } from "../../winner/winner";
import { TRACKTALLY_HIGHLIGHT_CHALLENGE_ID, TRACKTALLY_DEV, TRACKTALLY_PROD, TRACKTALLY_TEST_CHALLENGE_ID } from "../../defines";
import { notifyTest } from "../../whatsapp";

/* 
 * Important: Ensure that test test script uses notifyTest
 * To inform in the test group
 */ 
const app = admin.initializeApp({
  // credential: admin.credential.cert(require(TRACKTALLY_PROD)),
  credential: admin.credential.cert(require(TRACKTALLY_DEV)),
});

const challengeId = TRACKTALLY_TEST_CHALLENGE_ID;
// const challengeId = TRACKTALLY_HIGHLIGHT_CHALLENGE_ID;
const dbFile = __dirname + "/../../../share/test_winner.json";
const debug = true;
const alwaysRun = false;

async function main() {
  let result = await runWinnerApp(app,
     challengeId, 
     dbFile,
     debug, alwaysRun);

  if (result) {
    console.log("Winners detected, sending notification to test group");
    console.log("Message:\n", result);
    notifyTest(result); /* test group */
  }
}

main().then(() => exit(0)).catch((err) => {
  console.error("Error in test:", err);
  exit(1);
});


