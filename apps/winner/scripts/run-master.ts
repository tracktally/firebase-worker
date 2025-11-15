#!/usr/bin/env -S npx ts-node

import * as admin from "firebase-admin";
import { exit } from "process";
import { generateRanking, runWinnerApp } from "../../winner/winner";
import { TRACKTALLY_HIGHLIGHT_CHALLENGE_ID, TRACKTALLY_PROD, TRACKTALLY_TEST_CHALLENGE_ID } from "../../defines";
import { notifyGroup, notifyTest } from "../../whatsapp";

const app = admin.initializeApp({
  credential: admin.credential.cert(require(TRACKTALLY_PROD)),
});

/* XXX: This runs in a docker container. so we must mount the share directory,
 * otherwise we lose the data between runs.
 */
const challengeId = TRACKTALLY_HIGHLIGHT_CHALLENGE_ID;
const dbFile = __dirname + "/../../../share/master_winner.json";
const debug = true;
const alwaysRun = false;

async function main() {
  let result = await runWinnerApp(app,
     challengeId, 
     dbFile,
     debug, alwaysRun);

  if (result) {
    console.log("Winners detected, sending notification to test group");
    notifyGroup(result);
  }
}

main().then(() => exit(0)).catch((err) => {
  console.error("Error in test:", err);
  exit(1);
});


