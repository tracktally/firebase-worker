import * as admin from "firebase-admin";
import { dailyStatsDateFormat, getResetDates, normalizeDate, userProgressSort } from "../util";
import { generateWinnerMessage } from "./gpt_winner";
import { promises as fs } from "fs";
import path from "path";

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

export async function generateRanking(app, challengeId: string) {
  const { users } = await getToday(app, challengeId);
  let today = "";
  let rank = 1;

  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(1, "0");
  const tz=`UTC${sign}${hours}`

  users
    .filter(r => r.counter > 0 && r.goalReachedAt != null)
    .forEach((u) => {
      const time = normalizeDate(u.goalReachedAt)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      today += `- ${rank}: ${u.name} reps: ${u.counter} at: ${time} ${tz}\n`;
      rank++;
    });

  return { message: today };
}

async function getChallenge(app, challengeId: string) {
  const db = app.firestore();
  const challengeRef = db.collection("challenges").doc(challengeId);
  const challengeSnap = await challengeRef.get();

  if (!challengeSnap.exists) {
    console.error(`Challenge ${challengeId} not found`);
    return null;
  }

  const challengeData = challengeSnap.data();
  return challengeData;
}

type StoredData = {
  lastRun: Date | null;
  nextRun: Date | null;
};

async function loadStorageData(storagePath: string): Promise<StoredData | null> {
  const fullPath = path.resolve(storagePath);
  let storedData = {};
  try {
    const raw = await fs.readFile(fullPath, "utf-8");
    storedData = JSON.parse(raw);
  } catch (err) {
    console.warn(`No stored data found at ${fullPath}, starting fresh.`);
  }
  return storedData as StoredData;
}

export async function saveStorage(
  storagePath: string,
  data: StoredData,
) {
  const fullPath = path.resolve(storagePath);

  try {
    const json = JSON.stringify(data, null, 2);
    // const tmp = fullPath + ".tmp";
    await fs.writeFile(fullPath, json, "utf-8");

    console.log("Storage saved:", fullPath);
  } catch (err) {
    console.error("Failed to save storage JSON:", err);
    throw err;
  }
}

async function generateMessage(app, challengeId, debug = false) {
  let { message: ranking } = await generateRanking(app, challengeId);
  if (ranking == null || ranking.length == 0) {
    console.log("No winners yet");
    return null;
  }
  return await generateWinnerMessage(ranking, debug);
}


export async function runWinnerApp(app,
  challengeId: string, storagePath: string, debug = false,
  alwaysRun = false) {
  let returnMsg = {
    message: "",
    containsWinners: false
  };

  const challenge = await getChallenge(app, challengeId);
  const storedData = await loadStorageData(storagePath);
  const now = new Date();
  let lastRun = normalizeDate(storedData.lastRun) ?? null;
  let nextRun = normalizeDate(storedData.nextRun) ?? null;
  const { lastResetDate, nextResetDate, intervalHrs } = getResetDates(challenge, now);
  
  // XXX: To awoid races between reset and winner announcement,
  // add a minimum wait time after reset
  const waitTime = new Date(now.getTime() 
      - 30 /*30 minutes */ * 60 * 1000);

  const minWaitTimePassed = lastResetDate < waitTime;

  console.log("lastreset" ,lastResetDate)
  console.log("nextreset" ,nextResetDate)
  console.log("intervall" ,intervalHrs)

  console.log("Challenge:", challengeId, challenge.name);
  console.log("Time:", now.toString());
  console.log("lastRun:", lastRun);
  console.log("nextRun", nextRun);
  console.log("challenge: Last reset:", lastResetDate);
  console.log("challenge: next reset:", nextResetDate);
  console.log("wait time:", waitTime, minWaitTimePassed);

  if (alwaysRun 
      || !nextRun 
      || (minWaitTimePassed && nextRun < nextResetDate)) {
    console.log("Running winner generation for challenge:", challengeId);

    let message = await generateMessage(app, challengeId, debug);
    if (message != null) {
      console.log("Winner message generated");
      returnMsg.message = message;
      returnMsg.containsWinners = true;
    }
  } else {
    console.log("Skipping winner generation");
  }

  if (returnMsg.containsWinners) {
    storedData.lastRun = new Date();
    storedData.nextRun = nextResetDate;
    await saveStorage(storagePath, storedData);
  }
  
  return returnMsg;
}
