import { count } from "console";
import * as admin from "firebase-admin";
import { getResetDates, normalizeDate } from "../src/util";
import { challengeMessageCallback } from "../src/challenge-notify"
import { runChallengeMaintenanceCustomInterval } from "../src/challenge-maintenance"
import { spawn } from "child_process";

const SEND_SCRIPT = __dirname + "/../scripts/send_test.sh";

function shouldNotify(challenge: any) {
  console.log("should notify: ", challenge.id, challenge.name);
  // Test group
  if (challenge.id == "rR3NHPGYsPtZ1fXEsWCT") {
    console.log("\n\n=========== Sending message");
    return true;
  }
  return false;
}

function notify(message: string) {
  let script = SEND_SCRIPT;
  const args = [`${message}`];

  const child = spawn(script, args, { stdio: "inherit" });

  child.on("close", (code) => {
    console.log(`Script exited with code ${code}`);
  });
  return;
}

// run test script
// uses send_test to notify in test whatsapp group
let app = admin.initializeApp({
  credential: admin.credential.cert(require("../secrets/service-account-challenge.json")),
});

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
