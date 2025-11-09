#!/usr/bin/env -S npx ts-node

import * as admin from "firebase-admin";
import { runChallengeMaintenanceCustomInterval } from "../challenge-maintenance"
import { TRACKTALLY_DEV, TRACKTALLY_PROD } from "../../defines";

let app = admin.initializeApp({
  credential: admin.credential.cert(require(TRACKTALLY_PROD)),
});

/*
 * Track Tally Production Database.
 * No notifications are sent.
 */
const debug = false;

runChallengeMaintenanceCustomInterval(
  app,
  debug, /* debug */
  null, /* should notify */
  null /* do notify */)
  .then(() => {
    console.log("Daily rollup finished");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error running rollup", err);
    process.exit(1);
  });
