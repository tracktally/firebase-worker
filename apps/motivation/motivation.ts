import * as admin from "firebase-admin";
import { dailyStatsDateFormat, normalizeDate, userProgressSort } from "../util";

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

  const inactivityCutOff = new Date();
  inactivityCutOff.setDate(
    inactivityCutOff.getDate() - (cutoff)
  );

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
): Promise<{ name: string; userId: string; counter: number }[]> {
  const db = app.firestore();

  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const dateId = dailyStatsDateFormat(yesterday);
  
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

  // XXX: Ranking currently does not consider time. ok for now.
  const ranking = Object.entries(usersMap)
    .map(([userId, counter]) => ({
      userId,
      name: nameLookup[userId] ?? userId,
      counter,
    }))
    .sort((a, b) => b.counter - a.counter);

  return ranking;
}

export async function generateRanking(app, challengeId: string) {  
  const { users } = await getToday(app, challengeId)
  const ranking = await getYesterdayFromStats(app, challengeId);
  
  let rank = 1;
  let yesterday = "";
  ranking
   .filter(r => r.counter > 0)
   .forEach((r) => {
    yesterday += `- ${rank}: ${r.name}: ${r.counter}\n`;
    rank ++;
  });

  let today = "";

  rank = 1;
  users.forEach((u) => {
    today += `- ${rank}: ${u.name}: ${u.counter}\n`;
    rank++;
  });

  return { yesterday, today };  
}
