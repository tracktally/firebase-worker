import { count } from "console";
import * as admin from "firebase-admin";
import { getResetDates, normalizeDate } from "./util";

admin.initializeApp({
  credential: admin.credential.cert(require("./secrets/service-account.json")),
});

function formatDateId(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function updateStreaks(
  d: {
    counter?: number;
    partialStreak?: number;
    fullStreak?: number;
    totalCounter?: number;
    bestPartialStreak?: number;
    bestFullStreak?: number;
  },
  goal: number,
): {
  counter: number;
  totalCounter: number;
  partialStreak: number;
  fullStreak: number;
  bestPartialStreak: number;
  bestFullStreak: number;
} {
  let counter = d.counter ?? 0;
  let partialStreak = d.partialStreak ?? 0;
  let fullStreak = d.fullStreak ?? 0;
  let totalCounter = (d.totalCounter ?? 0) + counter;
  let bestPartialStreak = d.bestPartialStreak ?? 0;
  let bestFullStreak = d.bestFullStreak ?? 0;

  bestPartialStreak = Math.max(bestPartialStreak, partialStreak);
  bestFullStreak = Math.max(bestFullStreak, fullStreak);

  if (counter >= goal) {
    fullStreak += 1;
  } else {
    fullStreak = 0;
  }

  if (counter >= goal / 2) {
    partialStreak += 1;
  } else {
    partialStreak = 0;
  }

  bestPartialStreak = Math.max(bestPartialStreak, partialStreak);
  bestFullStreak = Math.max(bestFullStreak, fullStreak);

  return {
    counter,
    totalCounter,
    partialStreak,
    fullStreak,
    bestPartialStreak,
    bestFullStreak,
  };
}

type ChallengeCallback = (challenge: {
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
  }) => string | Promise<void>;


const challengeMessageCallback: ChallengeCallback = (challenge, users, data) => {
  let msg = `*${data.date}* 🏆\n\n`;
  msg += `Team: ${challenge.counter} / ${challenge.goalCounterChallenge}\n\n`;

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
  }).filter(u => u.counter > 0)
    .slice(0, 10);

  msg += "📊 *Top Players:*\n";

  if (sorted.length === 0) {
    msg += "- No participation\n";
  } else {

    sorted.forEach((u, i) => {
      const getFullStreak = (s: number) => s > 0 ? `🌗: ${s}` : "";
      const getPartialStreak = (s: number) => s > 0 ? `🔥: ${s}` : "";
      const getStreak = (u) => u.fullStreak && u.fullStreak > 0
        || u.partialStreak && u.partialStreak > 0 ?
        `(${getFullStreak(u.fullStreak ?? 0)} ${getPartialStreak(u.partialStreak ?? 0)})` : "";

      const getPos = (i) => i === 0
        ? "🥇"
        : i === 1
          ? "🥈"
          : i === 2
            ? "🥉"
            : i + 1;
      msg += `- ${getPos(i)} ${u.name}: ${u.counter} ${getStreak(u)}\n`;
    });

  }

  // longest full streak
  let fullStreaks = data.fullStreaks.filter(s => s.fullStreak > 0)
    .sort((a, b) => b.fullStreak - a.fullStreak);

  if (fullStreaks.length > 0) {
    let max = fullStreaks[0].fullStreak;
    msg += "\n🔥 *Longest Full Streaks:*\n";
    fullStreaks.forEach(s => {
      if (s.fullStreak === max) {
        msg += `- ${s.name}: ${s.fullStreak}\n`;
      }
    });
  }

  let partialStreaks = data.partialStreaks.filter(s => s.partialStreak > 0)
    .sort((a, b) => b.partialStreak - a.partialStreak);

  if (partialStreaks.length > 0) {
    let max = partialStreaks[0].partialStreak;
    msg += "\n🌗 *Longest Partial Streaks:*\n";
    partialStreaks.forEach(s => {
      if (s.partialStreak === max) {
        msg += `- ${s.name}: ${s.partialStreak}\n`;
      }
    });
  }

  if (data.lostFullStreaks.length > 0) {
    msg += "\n\n🔥 *Lost Full Streaks:* 💔\n";
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


async function runChallengeMaintenanceCustomInterval(): Promise<void> {
  console.log("Challenge maintenance started at", new Date().toString());

  const debug = true; // XXX: Watch out, setting this can loose data

  const db = admin.firestore();
  const challengesSnap = await db.collection("challenges").get();

  const now = new Date();
  const yesterdayMidnight =
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  for (const chDoc of challengesSnap.docs) {
    const challengeId = chDoc.id;
    const challengeData = chDoc.data() as {
      name?: string;
      counter?: number;
      interval_hrs?: number;
      lastResetAt,
      resetTimeStr?: string;
      goalCounterUser?: number,
      goalCounterChallenge?: number,

      // stats
      partialStreak?: number
      fullStreak?: number,
      totalCounter?: number,
      bestPartialStreak?: number,
      bestFullStreak?: number,
    };

    const teamTotal = challengeData?.counter ?? 0;
    const name = challengeData.name ?? "<unknown>";

    const { lastResetDate, nextResetDate, intervalHrs } = getResetDates(challengeData, now);

    /*
     * reset date is either midnight if no data in firebase
     * or last reset date + interval hours
     */
    const lastResetDateId = formatDateId(lastResetDate);

    const dailyRef = db.doc(`challenges/${challengeId}/dailyStats/${lastResetDateId}`);
    const exists = await dailyRef.get();

    if (nextResetDate > now && !debug) {
      // Not yet time
      continue;
    }

    if (exists.exists && !debug) {
      // already resetted
      // console.warn(`dailyStats already exists for ${challengeId} ${name} ${lastResetDateId}; skipping.`);
      continue;
    }

    console.log(`Resetting ${name}. ",
        "Interval=${intervalHrs}, ",
        "last=${formatDateTime(lastResetDate)}, ",
        "next=${formatDateTime(nextResetDate)}`);


    let { counter, totalCounter, partialStreak,
      fullStreak, bestPartialStreak,
      bestFullStreak } = updateStreaks(challengeData,
        challengeData?.goalCounterChallenge
      );

    if (challengeData.partialStreak && challengeData.partialStreak > 0 && partialStreak == 0) {
      console.log(`  Challenge (${challengeData.name ?? ""}) `,
        `lost partial streak of ${challengeData.partialStreak}`);
    }
    if (challengeData.fullStreak && challengeData.fullStreak > 0 && fullStreak == 0) {
      console.log(`  Challenge (${challengeData.name ?? ""})`,
        `lost full streak of ${challengeData.fullStreak}`);
    }

    // Collect user totals
    const usersSnap = await db.collection(`challenges/${challengeId}/users`).get();
    const usersTotals: Record<string, number> = {};
    usersSnap.forEach((u) => {
      const data = u.data() as { counter?: number };
      usersTotals[u.id] = data?.counter ?? 0;
    });

    // Store daily stats
    await dailyRef.set({
      date: admin.firestore.Timestamp.fromDate(yesterdayMidnight),
      teamTotal,
      users: usersTotals,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      goalCounterUser: challengeData?.goalCounterUser ?? 0,
      goalCounterChallenge: challengeData?.goalCounterChallenge ?? 0
    }, { merge: true });

    // Reset counters in a batch
    const batch = db.batch();
    batch.update(chDoc.ref, {
      counter: 0,
      lastResetAt: admin.firestore.FieldValue.serverTimestamp(),

      // stats
      partialStreak: partialStreak,
      fullStreak: fullStreak,
      totalCounter: totalCounter,
      bestPartialStreak: bestPartialStreak,
      bestFullStreak: bestFullStreak,

      goalReachedAt: null,
      goalPartialReachedAt: null,

    });

    const goalUser = challengeData?.goalCounterUser ?? 0;

    let users = [];
    let partialLostStreaks = [];
    let fullLostStreaks = [];
    let partialStreaks = [];
    let fullStreaks = [];

    for (const u of usersSnap.docs) {
      const d = u.data();
      users.push({ id: u.id, ...(d as any) });

      let { counter, totalCounter, partialStreak,
        fullStreak, bestPartialStreak,
        bestFullStreak } = updateStreaks(d, goalUser);

      if (d.partialStreak && d.partialStreak > 0 && partialStreak == 0) {
        console.log(`  User ${u.id} (${d.name ?? ""}) lost partial streak of ${d.partialStreak}`);
        partialLostStreaks.push(`${d.name} (ended at ${d.partialStreak})`);
      }
      if (d.fullStreak && d.fullStreak > 0 && fullStreak == 0) {
        console.log(`  User ${u.id} (${d.name ?? ""}) lost full streak of ${d.fullStreak}`);
        fullLostStreaks.push(`${d.name} (ended at ${d.fullStreak})`);
      }

      batch.update(u.ref, {
        counter: 0,

        // stats
        partialStreak: partialStreak,
        fullStreak: fullStreak,
        totalCounter: totalCounter,
        bestPartialStreak: bestPartialStreak,
        bestFullStreak: bestFullStreak,

        // Reset goal tracking as well
        goalReachedAt: null,
        goalPartialReachedAt: null,
      });

      fullStreaks.push({ name: d.name, fullStreak: fullStreak });
      partialStreaks.push({ name: d.name, partialStreak: partialStreak });

      // console.log(`  User ${u.id} (${d.name ?? ""}) did ${counter}, totalReps=${totalReps}, partialStreak=${partialStreak}, fullStreak=${fullStreak}`);
      let msg = challengeMessageCallback(challengeData as any,
        users, {
        date: `${lastResetDateId}`,
        lostPartialStreaks: partialLostStreaks,
        lostFullStreaks: fullLostStreaks,
        fullStreaks,
        partialStreaks
      });
      console.log("\n\n" + msg + "\n\n");
    }
    await batch.commit();
  }

  console.log("Challenge maintenance finished at", new Date().toString());
}


runChallengeMaintenanceCustomInterval()
  .then(() => {
    console.log("Daily rollup finished");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error running rollup", err);
    process.exit(1);
  });