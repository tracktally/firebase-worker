import { count } from "console";
import * as admin from "firebase-admin";
import { getResetDates, normalizeDate } from "../src/util";
import { challengeMessageCallback } from "../src/challenge-notify"
import { runChallengeMaintenanceCustomInterval } from "../src/challenge-maintenance"
import { spawn } from "child_process";
import { exit } from "process";
import { insertMessage, getMessages } from "../src/motivation/db";
import { generateMotivation } from "../src/motivation/gpt_motivation";
import { getToday, getYesterday } from "../src/motivation/motivation";
import { generateLeaderboardCommentary } from "../src/motivation/gpt_leaderboard";


const SEND_SCRIPT = __dirname + "/../scripts/send_test.sh";

function notify(message: string) {
  let script = SEND_SCRIPT;
  const args = [`${message}`];

  const child = spawn(script, args, { stdio: "inherit" });

  child.on("close", (code) => {
    console.log(`Script exited with code ${code}`);
  });
  return;
}

const challengeId = 'XkROPB7880JnY05TcNCv';

const app = admin.initializeApp({
  credential: admin.credential.cert(require("../secrets/tracktally-prod-firebase.json")),
});

async function motivation() {
  const { challenge, users } = await getToday(app, challengeId)

  const yesterday = getYesterday(challengeId).message
  let today = "";

  let rank = 1;
  users.forEach((u) => {
    today += `- ${rank}: ${u.name}: ${u.counter}\n`;
    rank++;
  });

  await generateMotivation(yesterday, today, true).then((message) => {
    console.log("Generated message:");
    console.log(message);
    notify(message);
  });
}

async function leaderboard() {
  const yesterday = getYesterday(challengeId).message
  await generateLeaderboardCommentary(yesterday, true).then((message) => {
    console.log("Generated message:");
    console.log(message);
  });

}

async function main() {
  await motivation();
  // await leaderboard();
}


main().then(() => exit(0)).catch((err) => {
  console.error("Error in test:", err);
  exit(1);
});
