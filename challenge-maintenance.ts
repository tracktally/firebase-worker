import * as admin from "firebase-admin";

admin.initializeApp({
    credential: admin.credential.cert(require("./secrets/service-account.json")),
});


async function runChallengeMaintenance(): Promise<void> {
    
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


runChallengeMaintenance()
    .then(() => {
        console.log("Daily rollup finished");
        process.exit(0);
    })
    .catch((err) => {
        console.error("Error running rollup", err);
        process.exit(1);
    });