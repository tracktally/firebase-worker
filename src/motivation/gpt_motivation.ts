import OpenAI from "openai";

import { OPENAI_API_KEY } from "../../secrets/openai";

const client = new OpenAI({
    apiKey: OPENAI_API_KEY,
});


export async function generateMotivation(yesterday: string, currentProgress: string, debug = false) {
    const promt = `
You are a bot that manages a daily push-up challenge.
Every day, you receive two texts in the same structured format.
one for yesterday’s results and one for today’s current progress.
you are tasked to write a motivational text so users dont lose their streaks.

Add a title to the message that matches the message (something funny, seperate from the text, a reminder, make it bold with an emoji (use *))
this message is a reminder not to lose the streak.
Optionally summarize team progress or leaderboard shifts.

To goal is either 100 (full streak 🔥) or 50 (partial 🌗) push-ups per day, but dont mention this literally in the message.
At the end of your response, output only the final WhatsApp message (no explanations, in markdown and source code)
Mention users with *bold*.

Compare to users from yesterday and mention those who have not gotten their streak today.
Mention some of their progress (how many reps) but not for everyyone.
Users still have time to catch up until tonight, so remind them
Keep it short, and dynamic, add emojis where needed.
Write 1-3 sentences. Pick something interesting to say about the progress.
Add new lines where needed for readability.
Dont use the dash (—).
Be angry and mean, trash talk if it helps motivation. Add new lines for readability.

yesterday:
${yesterday}

current progress:
${currentProgress}
`;

    if (debug) {
        console.log("Motivation prompt:\n", promt);
    }


    const response = await client.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
            // { role: "system", content: "You are a witty motivational bot for a push-up challenge." },
            { role: "user", content: promt },
        ],
    });


    const message = response.choices[0].message.content
        .replace(/```/g, "")
        .trim();

    return message;
}


/*
{
    let yesterday = `    
2025-10-24 

🏆 Pushup Challenge 3.0:
- Team Reps: 820 / 1500
- Partial Streak: 12 
- Full Streak: 0 

💪 Most reps: Michii (100)
💨 Fastest: Michii (12h 19min)

📊 Leaderboard:
- 🥇 Michii: 100 (🌗: 12)
- 🥈 Andi: 100 (🔥: 1)
- 🥉 Lucas B.: 100 (🔥: 1)
- 4. Liblor: 100 (🔥: 12)
- 5. Andrin: 100 (🔥: 12)
- 6. Kev 2.0: 100 (🔥: 9)
- 7. Dan: 80 (🌗: 2)
- 8. Robin: 60 (🌗: 1)
- 9. Flo: 50 (🌗: 4)
- 10. Jana: 50 (🌗: 12)

💔 Lost Full Streaks:
- Nicii (ended at 2)
- valentin 2 (ended at 1)
- Leo (ended at 3)
- Lena (ended at 1)

💔 Lost Partial Streaks:
- Nicii (ended at 2)
- Reto (ended at 3)
- valentin 2 (ended at 6)
- Leo (ended at 3)
- Lena (ended at 1)

🔥 Longest Full Streaks:
- Andrin: 12
- Liblor: 12

🌗 Longest Partial Streaks:
- Jana: 12
- Michii: 12
- Andrin: 12
- Liblor: 12
    `;
    let today = `
🥇
Reto
✅ 12:18:55
100 / 100

🥈
Andrin
✅ 12:19:02
101 / 100

🥉
Michii
60 / 100

4
Lucas B.
60 / 100

5
Flo
40 / 100

6
Andi
35 / 100

7
Liblor
20 / 100

8
Kev 2.0
0 / 100

9
Jana
0 / 100

10
Dan
0 / 100


`;

    generateMotivation(yesterday, today).then((message) => {
        console.log("Generated message:");
        console.log(message);
    });
}
*/