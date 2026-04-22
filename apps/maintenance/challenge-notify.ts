import { count } from "console";
import * as admin from "firebase-admin";
import { getResetDates, normalizeDate, userProgressSort } from "../util";
import { spawn } from "child_process";

// message formatting helpers
const nl = "\n";
const bStart = "<strong>";
const bStop = "</strong>";

// TODO: refactor users to their own type
export type ChallengeCallback = (challenge: {
  id: string;
  name: string;
  counter: number;

  totalCounter?: number,

  goalCounterUser?: number,
  goalCounterChallenge?: number,
  lastResetAt?: Date,

  // stats
  partialStreak?: number
  fullStreak?: number,
  bestPartialStreak?: number,
  bestFullStreak?: number,
},
  updatedChallenge: any,
  users: { id: string; name?: string; counter: number; totalCounter: number, lastActivityAt?: Date, goalReachedAt?: Date }[],
  updatedUsers: { id: string; name?: string; counter: number; totalCounter: number, lastActivityAt?: Date, goalReachedAt?: Date }[],
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
    max = streaks[0].partialStreak;
    let i = 0;
    streaks.forEach(s => {
      if (s.partialStreak < max && i < top) {
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
    max = streaks[0].fullStreak;
    let i = 0;
    streaks.forEach(s => {
      if (s.fullStreak < max && i < top) {
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
  let msg = `${bStart}${data.date}${bStop}${nl}${nl}`;
  msg += `${bStart}${challenge.name}:${bStop}${nl}`;
  msg += `- Team Reps: ${challenge.counter} / ${challenge.goalCounterChallenge}${nl}`;
  
  const isChallengePartialLost = 
    (challenge.partialStreak ?? 0) > 0 && (updatedChallenge.partialStreak ?? 0) == 0;
  const isChallengeFullLost = 
    (challenge.fullStreak ?? 0) > 0 && (updatedChallenge.fullStreak ?? 0) == 0;
  
  let msgChallengePatial = isChallengePartialLost ? " 💔" : "";
  let msgChallengeFull = isChallengeFullLost ? " 💔" : "";

  msg += `- Partial Streak: ${(updatedChallenge.partialStreak ?? 0)} ${msgChallengePatial}${nl}`;
  msg += `- Full Streak: ${(updatedChallenge.fullStreak ?? 0)} ${msgChallengeFull}${nl}${nl}`;

  let msgStats = "";

  const most = users.sort((a, b) => b.counter - a.counter).filter(u => u.counter > 0);
  if (most.length > 0) {
    msgStats += `${bStart}Most reps:${bStop} ${most[0].name} (${most[0].counter})${nl}`;
  }
   
  let sorted = users.sort((a, b) => userProgressSort(a, b)).filter(u => u.counter > 0);
    // .slice(0, 10);

  if (sorted.length > 0 && sorted[0].goalReachedAt && challenge.lastResetAt) {
      const f = sorted[0];
      let durationStr = "";
      try{
        const r = normalizeDate(challenge.lastResetAt) as Date;
        const d = normalizeDate(f.goalReachedAt) as Date;
        const durationMs = d.getTime() - r.getTime();
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
        durationStr = `${hours}h ${minutes}min`;
      } catch (e) {}
    msgStats += `${bStart}Fastest:${bStop} ${sorted[0].name} (${durationStr})${nl}`;
  }
  if (msgStats.length > 0) {
    msg += msgStats + nl;
  } 

  msg += `${bStart}Today:${bStop}${nl}`;

  if (sorted.length === 0) {
    msg += `- No participation${nl}`;
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
      msg += `- ${getPos(i)} ${u.name}: ${u.counter} ${getStreak(newStats)}${nl}`;
    });

  }

  // all-time leaderboard
  const allTime = updatedUsers
    .filter(u => (u.totalCounter ?? 0) > 0)
    .sort((a, b) => (b.totalCounter ?? 0) - (a.totalCounter ?? 0))
    .slice(0, 3);

  if (allTime.length > 0) {
    msg += nl + `${bStart}All Time Best:${bStop}${nl}`;
    allTime.forEach((u, i) => {
      const getPos = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      msg += `- ${getPos(i)} ${u.name}: ${u.totalCounter ?? 0}${nl}`;
    });
  }

  // lost streaks
  if (data.lostFullStreaks.length > 0) {
    msg += nl + `${bStart}Lost Full Streaks:${bStop}${nl}`;
    data.lostFullStreaks.forEach(s => {
      msg += `- ${s}${nl}`;
    });
  }

  if (data.lostPartialStreaks.length > 0) {
    msg += nl + `${bStart}Lost Partial Streaks:${bStop}${nl}`;
    data.lostPartialStreaks.forEach(s => {
      msg += `- ${s}${nl}`;
    });
  }

  // longest full streak
  let fullStreaks = data.fullStreaks.filter(s => s.fullStreak > 0)
    .sort((a, b) => b.fullStreak - a.fullStreak);

  if (fullStreaks.length > 0) {    
    let max = getTopFullStreaks(fullStreaks, 0 /* top n */);
    msg += nl + `${bStart}Longest Full Streaks:${bStop}${nl}`;
    fullStreaks.forEach(s => {
      if (s.fullStreak >= max) {
        msg += `- ${s.name}: ${s.fullStreak}${nl}`;
      }
    });
  }

  let partialStreaks = data.partialStreaks.filter(s => s.partialStreak > 0)
    .sort((a, b) => b.partialStreak - a.partialStreak);

  if (partialStreaks.length > 0) {
    let max = getTopPartialStreaks(partialStreaks, 0);
    msg += nl + `${bStart}Longest Partial Streaks:${bStop}${nl}`;
    partialStreaks.forEach(s => {
      if (s.partialStreak >= max) {
        msg += `- ${s.name}: ${s.partialStreak}${nl}`;
      }
    });
  }


  return msg;
}
