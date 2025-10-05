import { count } from "console";
import * as admin from "firebase-admin";
import { getResetDates, normalizeDate } from "../util";
import { challengeMessageCallback } from "../challenge-notify"
import { runChallengeMaintenanceCustomInterval } from "../challenge-maintenance"
import { spawn } from "child_process";


let app = admin.initializeApp({
  credential: admin.credential.cert(require("../secrets/service-account-challenge.json")),
});

const debug = false;

runChallengeMaintenanceCustomInterval(
  app,
  debug, /* debug */
  null, /* should notify */
  null /* do notify */ )
  .then(() => {
    console.log("Daily rollup finished");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error running rollup", err);
    process.exit(1);
  });
