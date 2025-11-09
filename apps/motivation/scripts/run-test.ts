#!/usr/bin/env -S npx ts-node

import * as admin from "firebase-admin";
import { exit } from "process";
import { generateMotivation } from "../gpt_motivation";
import { generateRanking } from "../motivation";
import { TRACKTALLY_HIGHLIGHT_CHALLENGE_ID, TRACKTALLY_PROD, TRACKTALLY_TEST_CHALLENGE_ID } from "../../defines";
import { notifyTest } from "../../whatsapp";

/* For test we use prod database but test whatsapp group */
const app = admin.initializeApp({
  credential: admin.credential.cert(require(TRACKTALLY_PROD)),
});

const challengeId = TRACKTALLY_HIGHLIGHT_CHALLENGE_ID;

async function motivation() {
  const {yesterday, today} = await generateRanking(app, challengeId);

  await generateMotivation(yesterday, today, true).then((message) => {
    console.log("Generated message:");
    console.log(message);
    notifyTest(message); /* Test whatsapp group */
  });
}

async function main() {
  await motivation();
}

main().then(() => exit(0)).catch((err) => {
  console.error("Error in test:", err);
  exit(1);
});


