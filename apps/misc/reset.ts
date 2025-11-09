#!/usr/bin/env -S npx ts-node

import * as admin from "firebase-admin";
import readline from "readline";

export async function wait(message = "Press any key to continue..."):
    Promise<void> {
    return new Promise((resolve) => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdout.write(`${message}\n`);
        process.stdin.once("data", () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            resolve();
        });
    });
}

export async function resetChallenge(
    app: admin.app.App,
    challengeId: string
): Promise<void> {
    const db = app.firestore();
    const challengeRef = db.collection("challenges").doc(challengeId);
    const challengeSnap = await challengeRef.get();

    if (!challengeSnap.exists) {
        console.error(`Challenge ${challengeId} not found`);
        return;
    }

    const challengeData = challengeSnap.data();
    console.log(`Resetting challenge "${challengeData?.name ?? challengeId}"...`);

    wait();

    const dailyStatsRef = challengeRef.collection("dailyStats");
    const dailyStatsSnap = await dailyStatsRef.get();

    if (!dailyStatsSnap.empty) {
        const batch = db.batch();
        dailyStatsSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`Deleted ${dailyStatsSnap.size} dailyStats entries`);
    }

    const usersRef = challengeRef.collection("users");
    const usersSnap = await usersRef.get();
    if (!usersSnap.empty) {
        const batch = db.batch();
        usersSnap.docs.forEach((u) => {
            batch.update(u.ref, {
                counter: 0,
                partialStreak: 0,
                fullStreak: 0,
                totalCounter: 0,
                bestPartialStreak: 0,
                bestFullStreak: 0,
                goalReachedAt: null,
                goalPartialReachedAt: null,
            });
        });
        await batch.commit();
        console.log(`Reset ${usersSnap.size} users`);
    }

    await challengeRef.update({
        counter: 0,
        partialStreak: 0,
        fullStreak: 0,
        totalCounter: 0,
        bestPartialStreak: 0,
        bestFullStreak: 0,
        goalReachedAt: null,
        goalPartialReachedAt: null,
        lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Challenge "${challengeData?.name ?? challengeId}" fully reset`);
}

console.log("starting reset script...");


// let app = admin.initializeApp({
//   credential: admin.credential.cert(require("../secrets/service-account-challenge.json")),
// });

// let app = admin.initializeApp({
//   credential: admin.credential.cert(require("../secrets/tracktally-prod-firebase.json")),
// });

// const testGroup = "XkROPB7880JnY05TcNCv";
// resetChallenge(app, testGroup);