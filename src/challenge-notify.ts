import { count } from "console";
import * as admin from "firebase-admin";
import { getResetDates, normalizeDate } from "./util";
import { spawn } from "child_process";

// TODO: refactor users to their own type
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
  updatedChallenge: any,
  users: { id: string; name?: string; counter: number; lastActivityAt?: Date, goalReachedAt?: Date }[],
  updatedUsers: { id: string; name?: string; counter: number; lastActivityAt?: Date, goalReachedAt?: Date }[],
  data: {
    date: string;
    lostPartialStreaks: string[];
    lostFullStreaks: string[];
    fullStreaks: { name?: string; fullStreak: number }[];
    partialStreaks: { name?: string; partialStreak: number }[];
  }) => string;



// given streaks with either full or partial streak, convert to common format
const convertStreaks = (
  streaks: 
  { name?: string;
    fullStreak?: number
    partialStreak?: number
  }[]) => {
  return streaks.map(s => ({
    name: s.name,
    streak: (s.fullStreak != undefined && s.fullStreak != null)
       ? s.fullStreak : s.partialStreak, 
  }));
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

const getStreaksForUser = (id: string, updatedUsers: any[]) => {
  let user = updatedUsers.find(u => u.id == id);
  const found = {
    user: null,
    found: false,
    fullStreak: 0,
    partialStreak: 0,
  };

  if (user) {
    found.user = user;
    found.found = true;
    found.fullStreak = user.fullStreak ?? 0;
    found.partialStreak = user.partialStreak ?? 0;
  }
  return found;
}

// XXX: users: contains update stats
// while data contains additional info like lost streaks
export const challengeMessageCallback: ChallengeCallback = (
  challenge, updatedChallenge,
  users, updatedUsers, data): string => {
  let msg = `*${data.date}* \n\n`;
  msg += `🏆 *${challenge.name}:*\n`;
  msg += `- Team Reps: ${challenge.counter} / ${challenge.goalCounterChallenge}\n`;
  
  const isChallengePartialLost = 
    (challenge.partialStreak ?? 0) > 0 && (updatedChallenge.partialStreak ?? 0) == 0;
  const isChallengeFullLost = 
    (challenge.fullStreak ?? 0) > 0 && (updatedChallenge.fullStreak ?? 0) == 0;
  
  let msgChallengePatial = isChallengePartialLost ? " 💔" : "";
  let msgChallengeFull = isChallengeFullLost ? " 💔" : "";

  msg += `- Partial Streak: ${(updatedChallenge.partialStreak ?? 0)} ${msgChallengePatial}\n`;
  msg += `- Full Streak: ${(updatedChallenge.fullStreak ?? 0)} ${msgChallengeFull}\n\n`;
   

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
      const getFullStreak = (s: number) => s > 0 ? `(🔥: ${s})` : "";
      const getPartialStreak = (s: number) => s > 0 ? `(🌗: ${s})` : "";
      const getHigherStreak = (f: number, p: number) => {
        return (f >= p) ? getFullStreak(f) : getPartialStreak(p);
      }
      
      const getStreak = (u) => {
        let f = (u.fullStreak ?? 0);
        let p = (u.partialStreak ?? 0);
        return `${getHigherStreak(f, p)}`;
      } 
      const getPos = (i) => i === 0
        ? "🥇"
        : i === 1
          ? "🥈"
          : i === 2
            ? "🥉"
            : `${i + 1}.`;
      
      // XXX: we need new stats form user as user may have
      // lost streak after current processing
      let newStats = getStreaksForUser(u.id, updatedUsers);
      msg += `- ${getPos(i)} ${u.name}: ${u.counter} ${getStreak(newStats)}\n`;
    });

  }

  // lost streaks
  if (data.lostFullStreaks.length > 0) {
    msg += "\n💔 *Lost Full Streaks:*\n";
    data.lostFullStreaks.forEach(s => {
      msg += `- ${s}\n`;
    });
  }

  if (data.lostPartialStreaks.length > 0) {
    msg += "\n💔 *Lost Partial Streaks:*\n"
    data.lostPartialStreaks.forEach(s => {
      msg += `- ${s}\n`;
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


  return msg;
}
