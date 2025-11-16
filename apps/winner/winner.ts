import * as admin from "firebase-admin";
import { dailyStatsDateFormat, getResetDates, normalizeDate, userProgressSort } from "../util";
import { generateTopUserMessage, generateWinnerMessage } from "./gpt_winner";
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
  const tz = `UTC${sign}${hours}`

  users
    .filter(r => r.counter > 0 && r.goalReachedAt != null)
    .forEach((u) => {
      const time = normalizeDate(u.goalReachedAt)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      today += `- ${rank}: ${u.name} reps: ${u.counter} at: ${time} ${tz}\n`;
      rank++;
    });

  return {
    message: today,
    users: users
  };
};


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
  topUserId: string | null;
  topUserCounter: number | null;
  topUserName: string | null;
  topUserPromptContext: string;
};

async function loadStorageData(storagePath: string): Promise<StoredData | null> {
  const fullPath = path.resolve(storagePath);
  let storedData = {} as StoredData
  try {
    const raw = await fs.readFile(fullPath, "utf-8");
    storedData = JSON.parse(raw);
  } catch (err) {
    console.warn(`No stored data found at ${fullPath}, starting fresh.`);
  }

  storedData.nextRun = normalizeDate(storedData.nextRun) ?? null;
  storedData.lastRun = normalizeDate(storedData.lastRun) ?? null;
  storedData.topUserId = storedData.topUserId ?? null;
  storedData.topUserCounter = storedData.topUserCounter ?? 0;
  storedData.topUserName = storedData.topUserName ?? "";
  storedData.topUserPromptContext = storedData.topUserPromptContext ?? "";
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

async function fetchData(app, challengeId, storagePath, debug):
  Promise<{
    challenge: any,
    storedData: StoredData,
    nextRun: Date | null,
    nextResetDate: Date | null,
    hasNoWinnerYet: boolean
  }> {

  const challenge = await getChallenge(app, challengeId);
  const storedData = await loadStorageData(storagePath);

  const now = new Date();
  const nextRun = normalizeDate(storedData.nextRun) ?? null;
  const { lastResetDate, nextResetDate, intervalHrs } = getResetDates(challenge, now);

  // XXX: To awoid races between reset and winner announcement,
  // add a minimum wait time after reset
  const waitMin = 30;
  const waitTime = new Date(now.getTime() - waitMin * 60 * 1000);
  const minWaitTimePassed = lastResetDate < waitTime;

  // XXX: One winner per day
  const hasNoWinnerYet = minWaitTimePassed && nextRun < nextResetDate;

  return {
    challenge,
    storedData,
    nextRun,
    nextResetDate,
    hasNoWinnerYet
  }
}

function newTopUser(topUser, users, topUserThreshold, storedData) {
  let oldTopUserId = storedData.topUserId;
  if (oldTopUserId == null){
    console.warn("No previous top user stored. Happens only during migration.");
    oldTopUserId = topUser.id;
  }

  // XXX: Use old (previous top user and see if they increased their score)
  const oldTopUser = users.filter(u => u.id == oldTopUserId)[0];
  const threshold = Math.round(oldTopUser.counter * topUserThreshold);
  
  console.log("Checking for new top user:", topUser?.name);
  console.log("Previous top user:", oldTopUser.name, oldTopUser.counter);
  console.log("new top user counter:", topUser.name, topUser.counter);
  console.log("threshold to reach: ", threshold);
  
  const isReached = topUser?.id !== oldTopUser?.id
    && (topUser.counter ?? 0) >= threshold;

  return {
    isReached,
    threshold,
    oldTopUser    
  }
}

export async function runWinnerApp(app,
  challengeId: string, storagePath: string, debug = false,
  alwaysRun = false,
  topUserThreshold = 1.1): Promise<string | null> {
  
  // Include previous prompt context in the top user message
  const givePreviousPromtContext = false;

  const {
    challenge,
    storedData,
    nextRun,
    nextResetDate,
    hasNoWinnerYet,
  } = await fetchData(app, challengeId, storagePath, debug);

  console.log("Running winner generation for challenge:", challengeId);

  const {
    message: ranking,
    users,
  } = await generateRanking(app, challengeId);

  // XXX: No winners yet, try later
  if (ranking == null || ranking.length == 0) {
    console.log("No winners yet");
    return null;
  }

  const topUser = users.sort((a, b) => b.counter - a.counter)[0];

  // XXX: We have a winner, but never notfied about it, notify now
  if (hasNoWinnerYet) {
    console.log("New winner detected");
    let message = await generateWinnerMessage(ranking, debug);
    
    storedData.lastRun = new Date();
    storedData.nextRun = nextResetDate;    
    await saveTopUser(topUser, message, storedData, storagePath, true)
    return message;
  }

  // XXX: We already have a winner, check if we have a new top user
  const {isReached, threshold, oldTopUser} 
    = newTopUser(topUser, users, topUserThreshold, storedData);
  if (isReached) {
    console.log("New top user detected:", topUser.name);
    let newBest = `${topUser.name} (${topUser.counter})`;
    let oldBest = `${oldTopUser.name} (${oldTopUser.counter})`;
    let newThreshold = `${topUser.counter * topUserThreshold}`;
    let message = await generateTopUserMessage(newBest,
      oldBest,
      givePreviousPromtContext ? storedData.topUserPromptContext : "",
      debug);

    await saveTopUser(topUser, message, storedData, storagePath);
    return message;
  }

  console.log("No new winners or top users detected");
  return null;
}

async function saveTopUser(topUser, promptContext, storedData, storagePath, clear: boolean = false) {
  
  storedData.topUserCounter = topUser.counter;
  storedData.topUserId = topUser.id;
  storedData.topUserName = topUser.name;
  if (clear) {
    storedData.topUserPromptContext = promptContext;
  } else {
    storedData.topUserPromptContext += `
    
    "${promptContext}
    
    `;
  }
  
  await saveStorage(storagePath, storedData);
}

