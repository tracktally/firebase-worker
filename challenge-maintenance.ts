import { count } from "console";
import * as admin from "firebase-admin";
import { getResetDates } from "./util";

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


async function runChallengeMaintenanceCustomInterval(): Promise<void> {
  console.log("Challenge maintenance started at", new Date().toString());
  
  const debug = false; // XXX: Watch out, setting this can loose data

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
    };

    const teamTotal = challengeData?.counter ?? 0;
    const name = challengeData.name ?? "<unknown>";

    const {lastResetDate, nextResetDate, intervalHrs} = getResetDates(challengeData, now);

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
    }, { merge: true });

    // Reset counters in a batch
    const batch = db.batch();
    batch.update(chDoc.ref, { 
      counter: 0,
      lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const goalUser = challengeData?.goalCounterUser ?? 0;

    for (const u of usersSnap.docs) {
      const d = u.data();
      let counter = d?.counter ?? 0;
      let partialStrike = d?.partialStrike ?? 0;
      let fullStrike = d?.fullStrike ?? 0;
      let totalCounter = (d?.totalCounter ?? 0) + counter;
      let bestPartialStrike = d?.bestPartialStrike ?? 0;
      let bestFullStrike = d?.bestFullStrike ?? 0;

      bestPartialStrike = Math.max(bestPartialStrike, partialStrike);
      bestFullStrike = Math.max(bestFullStrike, fullStrike);


      if (counter >= goalUser) {
        fullStrike += 1;
      } else {
        fullStrike = 0;
        console.log(`  User ${u.id} (${d.name ?? ""}) looses full strike with ${counter} / ${goalUser}`);
      }
      
      if (counter >= goalUser / 2) {
        partialStrike += 1;
      } else {
        partialStrike = 0;
        console.log(`  User ${u.id} (${d.name ?? ""}) looses partial strike with ${counter} / ${goalUser}`);
      }

      bestPartialStrike = Math.max(bestPartialStrike, partialStrike);
      bestFullStrike = Math.max(bestFullStrike, fullStrike);

      batch.update(u.ref, {
         counter: 0 ,
         
         // stats
         partialStrike: partialStrike,
         fullStrike: fullStrike,
         totalCounter: totalCounter,         
         bestPartialStrike: bestPartialStrike,
         bestFullStrike: bestFullStrike,
         
         // Reset goal tracking as well
         goalReachedAt: null,
         goalPartialReachedAt: null,
        });

        // console.log(`  User ${u.id} (${d.name ?? ""}) did ${counter}, totalReps=${totalReps}, partialStrike=${partialStrike}, fullStrike=${fullStrike}`);
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