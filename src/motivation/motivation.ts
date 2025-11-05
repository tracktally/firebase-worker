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

export async function getToday(app, challengeId: string, cutoff = 2) {

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

  // challengeData?.cutOffDays ?? 1
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

export async function getYesterdayFromStats(
  app: admin.app.App,
  challengeId: string,
): Promise<{ name: string; userId: string; count: number }[]> {
  const db = app.firestore();


  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const dateId = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1)
    .padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  const dailyRef = db.doc(`challenges/${challengeId}/dailyStats/${dateId}`);
  const snap = await dailyRef.get();

  if (!snap.exists) {
    console.warn(`No dailyStats found for ${challengeId} on ${dateId}`);
    return [];
  }

  const data = snap.data() as { users?: Record<string, number> };
  const usersMap = data?.users ?? {};


  const usersSnap = await db.collection(`challenges/${challengeId}/users`).get();
  const nameLookup: Record<string, string> = {};
  usersSnap.forEach(u => {
    const d = u.data() as { name?: string };
    nameLookup[u.id] = d.name ?? u.id;
  });

  const ranking = Object.entries(usersMap)
    .map(([userId, count]) => ({
      userId,
      name: nameLookup[userId] ?? userId,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return ranking;
}
