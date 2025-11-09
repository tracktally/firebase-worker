import * as admin from "firebase-admin";
import { dailyStatsDateFormat, normalizeDate, userProgressSort } from "../util";
import { generateWinnerMessage } from "./gpt_winner";

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

export async function runWinnerApp(app, challengeId: string, storagePath: string, debug = false) {
  // check storage path (json if it ran already)

  let returnMsg = {
    message: "",
    containsWinners: false
  };

  // if not ran, run maintenance
  let {message} = await generateRanking(app, challengeId);
  let ranking = message;
  if (message == null || message.length == 0) {
    console.log("No winners yet");
    return returnMsg;
  }

  let winnerMessage = await generateWinnerMessage(ranking, debug);

  returnMsg.message = winnerMessage;
  returnMsg.containsWinners = true;
  return returnMsg;
}

export async function generateRanking(app, challengeId: string) {
  const { users } = await getToday(app, challengeId);
  let today = "";
  let rank = 1;
  users
    .filter(r => r.counter > 0 && r.goalReachedAt != null)
    .forEach((u) => {
      const time = normalizeDate(u.goalReachedAt)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      today += `- ${rank}: ${u.name} reps: ${u.counter} at: ${time}\n`;
      rank++;
    });

  return { message: today };
}
