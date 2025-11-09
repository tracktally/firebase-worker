#!/usr/bin/env -S npx ts-node

import * as admin from "firebase-admin";
import { runChallengeMaintenanceCustomInterval } from "../challenge-maintenance"
import { spawn } from "child_process";
import { TEST_SEND_SCRIPT, TRACKTALLY_DEV, TRACKTALLY_TEST_CHALLENGE_ID } from "../../defines";
import { notifyTest } from "../../whatsapp";

let app = admin.initializeApp({
  credential: admin.credential.cert(require(TRACKTALLY_DEV)),
});

/*
 * Track Tally Test Database.
 * With notification in test group for testing.
 */

const debug = true;
console.log("test mode: debug =", debug);

runChallengeMaintenanceCustomInterval(
  app,
  debug, /* debug */
  shouldNotify,
  notifyTest)
  .then(() => {
    console.log("Daily rollup finished");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error running rollup", err);
    process.exit(1);
  });


function shouldNotify(challenge: any) {
  console.log("should notify: ", challenge.id, challenge.name);
  if (challenge.id == TRACKTALLY_TEST_CHALLENGE_ID) {
    console.log("\n\n=========== Sending message");
    return true;
  }
  return false;
}
