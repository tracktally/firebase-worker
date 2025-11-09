#!/usr/bin/env -S npx ts-node

import * as admin from "firebase-admin";
import { TRACKTALLY_DEV } from "../../defines";

import { runChallengeMaintenanceCustomInterval } from "../challenge-maintenance"

let app = admin.initializeApp({
  credential: admin.credential.cert(require(TRACKTALLY_DEV)),
});

/*
 * Track Tally Dev Database.
 * No Notifications are sent.
 */
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
