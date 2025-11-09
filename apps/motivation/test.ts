import { exit } from "process";
import { insertMessage, getMessages } from "./db";
import * as admin from "firebase-admin";
import { normalizeDate, userProgressSort } from "../util";
import { generateMotivation } from "./gpt_motivation";
import { generateLeaderboardCommentary } from "./gpt_leaderboard";

function getYesterday(challengeId: string) {

  let history = getMessages(challengeId)

  if (history.length == 0) {
    throw new Error("No message history found");
  }

  let last = history[0];
  let yesterday = last.message;

  return {
    message: yesterday
  };
}

async function getToday(app, challengeId: string) {

  const db = app.firestore();
  const challengeRef = db.collection("challenges").doc(challengeId);
  const challengeSnap = await challengeRef.get();

  if (!challengeSnap.exists) {
    throw new Error(`Challenge ${challengeId} not found`);
  }

  const challengeData = { id: challengeSnap.id, ...challengeSnap.data() };

  let users: any[] = [];

  const usersSnap = await db.collection(`challenges/${challengeId}/users`).get();
  users = usersSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const inactivityCutOff = new Date();
  inactivityCutOff.setDate(
    inactivityCutOff.getDate() - (challengeData?.cutOffDays ?? 1)
  );
  console.log(inactivityCutOff);

  users = users.sort((a, b) => userProgressSort(a, b))
    .filter((a) => {
      let date = normalizeDate(a.lastActivityAt);
      return date != null && date > inactivityCutOff;
    });

  return {
    challenge: challengeData,
    users,
  };
}

// insertMessage({
//   challengeName: "Push-Up Challenge 3.0",
//   challengeId: "pushup-3",
//   message: "🔥 Reto smashed 100 before lunch — everyone else, stop scrolling!",
//   date: new Date("2025-10-24"),
// });

const challengeId = 'XkROPB7880JnY05TcNCv';
const app = admin.initializeApp({
  credential: admin.credential.cert(require("../../secrets/tracktally-prod-firebase.json")),
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

  await generateMotivation(yesterday, today).then((message) => {
    console.log("Generated message:");
    console.log(message);
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
  // await motivation();
  await leaderboard();
}


main().then(() => exit(0)).catch((err) => {
  console.error("Error in test:", err);
  exit(1);
});