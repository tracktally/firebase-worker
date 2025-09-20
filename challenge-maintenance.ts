import { count } from "console";
import * as admin from "firebase-admin";

admin.initializeApp({
    credential: admin.credential.cert(require("./secrets/service-account.json")),
});


async function runChallengeMaintanceMidnight(): Promise<void> {
    
    const db = admin.firestore();    
    const challengesSnap = await db.collection("challenges").get();

    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    prev.setUTCDate(prev.getUTCDate() - 1);
    const yyyy = prev.getUTCFullYear();
    const mm = String(prev.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(prev.getUTCDate()).padStart(2, "0");
    const dateId = `${yyyy}-${mm}-${dd}`;

    for (const chDoc of challengesSnap.docs) {
        const challengeId = chDoc.id;
        const challengeData = chDoc.data() as { counter?: number };
        const teamTotal = challengeData?.counter ?? 0;
        console.log("processing challenge", challengeId);

        const dailyRef = db.doc(`challenges/${challengeId}/dailyStats/${dateId}`);
        const exists = await dailyRef.get();
        
        if (exists.exists) {
            console.warn(`dailyStats already exists for ${challengeId} ${dateId}; skipping.`);
            continue;
        }

        const usersSnap = await db.collection(`challenges/${challengeId}/users`).get();
        const usersTotals: Record<string, number> = {};
        usersSnap.forEach((u) => {
            const data = u.data() as { counter?: number };
            usersTotals[u.id] = data?.counter ?? 0;
        });

        await dailyRef.set({
            date: admin.firestore.Timestamp.fromDate(prev),
            teamTotal,
            users: usersTotals,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
            { merge: true }
        );

        const batch = db.batch();
        batch.update(chDoc.ref, { counter: 0 });
        for (const u of usersSnap.docs) {
            batch.update(u.ref, { counter: 0 });
        }
        await batch.commit();
    }
}

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
      lastResetAt?: admin.firestore.Timestamp;
      resetTimeStr?: string;
    };

    const teamTotal = challengeData?.counter ?? 0;
    const name = challengeData.name ?? "<unknown>";

    const intervalHrs = challengeData.interval_hrs ?? 24;
    const resetTimeStr = challengeData.resetTimeStr ?? "00:00";
    const lastResetDate = challengeData.lastResetAt?.toDate() ?? yesterdayMidnight;

    const [h, m] = resetTimeStr.split(":").map(Number);
    const nextResetDate = new Date(lastResetDate);
    nextResetDate.setHours(h, m, 0, 0);    
    nextResetDate.setHours(nextResetDate.getHours() + intervalHrs);

    /*
     * reset date is either midnight if no data in firebase
     * or last reset date + interval hours
     */
    const lastResetDateId = formatDateId(lastResetDate);

    const dailyRef = db.doc(`challenges/${challengeId}/dailyStats/${lastResetDateId}`);
    const exists = await dailyRef.get();

    if (nextResetDate > now) {
      // Not yet time
      continue;
    }

    if (exists.exists) {
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
    for (const u of usersSnap.docs) {
      batch.update(u.ref, {
         counter: 0 ,
         goalReachedAt: null,
         goalPartialReachedAt: null,
        });
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