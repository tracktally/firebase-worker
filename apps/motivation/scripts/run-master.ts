#!/usr/bin/env -S npx ts-node

import * as admin from "firebase-admin";
import { exit } from "process";
import { generateMotivation } from "../gpt_motivation";
import { generateRanking } from "../motivation";
import { TRACKTALLY_HIGHLIGHT_CHALLENGE_ID, TRACKTALLY_PROD } from "../../defines";
import { notifyGroup } from "../../whatsapp";

const app = admin.initializeApp({
  credential: admin.credential.cert(require(TRACKTALLY_PROD)),
});

const challengeId = TRACKTALLY_HIGHLIGHT_CHALLENGE_ID;

async function motivation() {
  const {yesterday, today} = await generateRanking(app, challengeId);

  await generateMotivation(yesterday, today, true).then((message) => {
    console.log("Generated message:");
    console.log(message);
    notifyGroup(message);
  });
}

async function main() {
  await motivation();
}


main().then(() => exit(0)).catch((err) => {
  console.error("Error in test:", err);
  exit(1);
});


