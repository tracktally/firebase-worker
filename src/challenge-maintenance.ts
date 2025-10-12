import { count } from "console";
import * as admin from "firebase-admin";
import { getResetDates, normalizeDate } from "./util";
import {challengeMessageCallback} from "./challenge-notify"


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

export async function runChallengeMaintenanceCustomInterval(
  app: admin.app.App,
  debug: boolean = false,
  shouldNotify: (challenge: any) => boolean = null,
  notify: (message: string) => void = null): Promise<void> {
  console.log("Challenge maintenance started at", new Date().toString(), 
              " debug=", debug);

  const db = app.firestore();
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
      continue;
    }

    console.log(`Resetting ${name} ${challengeId}. ",
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
    let updateChallengeData = {
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

    };
    batch.update(chDoc.ref, updateChallengeData);
    updateChallengeData = { ...challengeData, ...updateChallengeData };

    const goalUser = challengeData?.goalCounterUser ?? 0;

    let users = []; // users before db update
    let updatedUsers = []; // users after db update
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

      
      /* TODO: refactor: we do the reset logic here eventhough it is better
       *       done during the message generation.
       *       for this we now keep anyway two copies of the user and challenge.
       *       updateUser and updateChallenge
       */ 
      if (d.partialStreak && d.partialStreak > 0 && partialStreak == 0) {
        console.log(`  User ${u.id} (${d.name ?? ""}) lost partial streak of ${d.partialStreak}`);
        partialLostStreaks.push(`${d.name} (ended at ${d.partialStreak})`);
      }
      if (d.fullStreak && d.fullStreak > 0 && fullStreak == 0) {
        console.log(`  User ${u.id} (${d.name ?? ""}) lost full streak of ${d.fullStreak}`);
        fullLostStreaks.push(`${d.name} (ended at ${d.fullStreak})`);
      }

      const updateUser = {
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
      }
      batch.update(u.ref, updateUser);
      updatedUsers.push({ id: u.id, ...d, ...updateUser });

      fullStreaks.push({ name: d.name, fullStreak: fullStreak });
      partialStreaks.push({ name: d.name, partialStreak: partialStreak });

      // console.log(`  User ${u.id} (${d.name ?? ""}) did ${counter}, totalReps=${totalReps}, partialStreak=${partialStreak}, fullStreak=${fullStreak}`);
    }
    
    let msg: string = challengeMessageCallback(
        challengeData as any,
        updateChallengeData as any,
        users,
        updatedUsers, {
        date: `${lastResetDateId}`,
        lostPartialStreaks: partialLostStreaks,
        lostFullStreaks: fullLostStreaks,
        fullStreaks,
        partialStreaks
      });

      if (shouldNotify && shouldNotify({id: challengeId, ...challengeData})) {
        notify && notify(msg);
      }
      await batch.commit();
  }

  console.log("Challenge maintenance finished at", new Date().toString());
}
