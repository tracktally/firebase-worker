import { exit } from "process";
import { insertMessage, getMessages } from "./db";
import * as admin from "firebase-admin";
import { normalizeDate, userProgressSort } from "../util";
import { generateMotivation } from "./gpt_motivation";
import { generateLeaderboardCommentary } from "./gpt_leaderboard";

export function getYesterday(challengeId: string) {

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

export async function getToday(app, challengeId: string) {

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

  const cutoff = 2; // challengeData?.cutOffDays ?? 1
  const inactivityCutOff = new Date();
  inactivityCutOff.setDate(
    inactivityCutOff.getDate() - (cutoff)
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