import { count } from "console";
import * as admin from "firebase-admin";
import { getResetDates, normalizeDate } from "../util";
import { challengeMessageCallback } from "../challenge-notify"
import { runChallengeMaintenanceCustomInterval } from "../challenge-maintenance"
import { spawn } from "child_process";

const debug = false;

runChallengeMaintenanceCustomInterval(
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
