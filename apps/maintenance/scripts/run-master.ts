#!/usr/bin/env -S npx ts-node

import * as admin from "firebase-admin";
import { runChallengeMaintenanceCustomInterval } from "../challenge-maintenance"
import { spawn } from "child_process";
import { SEND_SCRIPT, TRACKTALLY_PROD } from "../../paths";

let app = admin.initializeApp({
  credential: admin.credential.cert(require(TRACKTALLY_PROD)),
});

/*
 * Track Tally Production Database.
 * With notifaction in whatsapp chat 
 */
const debug = false;

runChallengeMaintenanceCustomInterval(
  app,
  debug, /* debug */
  shouldNotify,
  notify)
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
  if (challenge.id == "XkROPB7880JnY05TcNCv") {
    console.log("Sending message...");
    return true;
  }
  return false;
}

function notify(message: string) {
  let script = SEND_SCRIPT
  const args = [`${message}`];

  const child = spawn(script, args, { stdio: "inherit" });

  child.on("close", (code) => {
    console.log(`Script exited with code ${code}`);
  });
  return;
}
