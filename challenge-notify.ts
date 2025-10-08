import { count } from "console";
import * as admin from "firebase-admin";
import { getResetDates, normalizeDate } from "./util";
import { spawn } from "child_process";


export type ChallengeCallback = (challenge: {
  id: string;
  name: string;
  counter: number;

  goalCounterUser?: number,
  goalCounterChallenge?: number,

  // stats
  partialStreak?: number
  fullStreak?: number,
  totalCounter?: number,
  bestPartialStreak?: number,
  bestFullStreak?: number,
},
  users: { id: string; name?: string; counter: number; lastActivityAt?: Date, goalReachedAt?: Date }[],
  data: {
    date: string;
    lostPartialStreaks: string[];
    lostFullStreaks: string[];
    fullStreaks: { name?: string; fullStreak: number }[];
    partialStreaks: { name?: string; partialStreak: number }[];
  }) => string;


export function shouldNotify(challenge: any) {
    // Test group
    if (challenge.id == "rR3NHPGYsPtZ1fXEsWCT") {
        console.log("\n\n=========== Sending message");
        return true;
    }
    return false;
}

export function doNotify(message: string, script: string) {
    const args = [`${message}`];

    const child = spawn(script, args, { stdio: "inherit" });

    child.on("close", (code) => {
        console.log(`Script exited with code ${code}`);
    });
    return;
}

// TODO: refactor full/partial streak to contain "streak" field
const getTopPartialStreaks = (
  streaks: { name?: string; partialStreak: number }[],
  top: number) => {
  let max = 0;
  if (streaks.length > 0) {
    let max = streaks[0].partialStreak;
    let i = 0;
    streaks.forEach(s => {
      if (s.partialStreak < max && i < 3) {
        max = s.partialStreak;
        i++;
      }
    });
  }
  return max;
}

const getTopFullStreaks = (
  streaks: { name?: string; fullStreak: number }[],
  top: number) => {
  let max = 0;
  if (streaks.length > 0) {
    let max = streaks[0].fullStreak;
    let i = 0;
    streaks.forEach(s => {
      if (s.fullStreak < max && i < 3) {
        max = s.fullStreak;
        i++;
      }
    });
  }
  return max;
}

export const challengeMessageCallback: ChallengeCallback = (challenge, users, data): string => {
  let msg = `*${data.date}* 🏆\n\n`;
  msg += `*${challenge.name}:*\n`;
  msg += `Team: \n`;
  msg += `- Reps: ${challenge.counter} / ${challenge.goalCounterChallenge}\n`;
  // XXX: +1 already in streak counter for team
  msg += `- Partial Streak: ${(challenge.partialStreak ?? 0)}\n`;
  msg += `- Full Streak: ${(challenge.fullStreak ?? 0)}\n\n`;
   

  let sorted = users.sort((a, b) => {
    const aTime = normalizeDate(a.goalReachedAt)?.getTime() ?? null;
    const bTime = normalizeDate(b.goalReachedAt)?.getTime() ?? null;
    if (aTime && bTime) return aTime - bTime;
    if (aTime && !bTime) return -1;
    if (!aTime && bTime) return 1;

    if (a.counter !== b.counter) {
      return b.counter - a.counter;
    }

    const aAct = normalizeDate(a.lastActivityAt)?.getTime() ?? 0;
    const bAct = normalizeDate(b.lastActivityAt)?.getTime() ?? 0;
    return bAct - aAct;
  }).filter(u => u.counter > 0);
    // .slice(0, 10);

  msg += "📊 *Top Players:*\n";

  if (sorted.length === 0) {
    msg += "- No participation\n";
  } else {

    sorted.forEach((u, i) => {
      const getFullStreak = (s: number) => s > 0 ? `🌗: ${s}` : "";
      const getPartialStreak = (s: number) => s > 0 ? `🔥: ${s}` : "";
      const getHigherStreak = (f: number, p: number) => {
        return (f >= p) ? getFullStreak(f) : getPartialStreak(p);
      }
      
      // XXX: +1 to streak to reflect current streak including today
      const getStreak = (u) => {
        let f = (u.fullStreak ?? 0) + 1;
        let p = (u.partialStreak ?? 0) + 1;
        return `(${getHigherStreak(f, p)})`;
      } 
      const getPos = (i) => i === 0
        ? "🥇"
        : i === 1
          ? "🥈"
          : i === 2
            ? "🥉"
            : `${i + 1}.`;
      msg += `- ${getPos(i)} ${u.name}: ${u.counter} ${getStreak(u)}\n`;
    });

  }

  // longest full streak
  let fullStreaks = data.fullStreaks.filter(s => s.fullStreak > 0)
    .sort((a, b) => b.fullStreak - a.fullStreak);

  if (fullStreaks.length > 0) {    
    let max = getTopFullStreaks(fullStreaks, 2);
    msg += "\n🔥 *Longest Full Streaks:*\n";
    fullStreaks.forEach(s => {
      if (s.fullStreak >= max) {
        msg += `- ${s.name}: ${s.fullStreak}\n`;
      }
    });
  }

  let partialStreaks = data.partialStreaks.filter(s => s.partialStreak > 0)
    .sort((a, b) => b.partialStreak - a.partialStreak);

  if (partialStreaks.length > 0) {
    let max = getTopPartialStreaks(partialStreaks, 2);
    msg += "\n🌗 *Longest Partial Streaks:*\n";
    partialStreaks.forEach(s => {
      if (s.partialStreak >= max) {
        msg += `- ${s.name}: ${s.partialStreak}\n`;
      }
    });
  }

  if (data.lostFullStreaks.length > 0) {
    msg += "\n🔥 *Lost Full Streaks:* 💔\n";
    data.lostPartialStreaks.forEach(s => {
      msg += `- ${s}\n`;
    });
  }

  if (data.lostPartialStreaks.length > 0) {
    msg += "\n🌗 *Lost Partial Streaks:* 💔\n"
    data.lostPartialStreaks.forEach(s => {
      msg += `- ${s}\n`;
    });
  }

  return msg;
}


// doNotify("Test message from Pushup Challenge", true);