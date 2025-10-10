import { count } from "console";
import * as admin from "firebase-admin";

import { runChallengeMaintenanceCustomInterval } from "../src/challenge-maintenance"


let app = admin.initializeApp({
  credential: admin.credential.cert(require("../secrets/service-account-challenge.json")),
});

const debug = false;

runChallengeMaintenanceCustomInterval(
  app,
  debug, /* debug */
  null /* shouldNotify */,
  null /* notify */ )
  .then(() => {
    console.log("Daily rollup finished");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error running rollup", err);
    process.exit(1);
  });
