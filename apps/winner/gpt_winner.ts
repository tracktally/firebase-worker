import OpenAI from "openai";

import { OPENAI_API_KEY } from "../../secrets/openai";
import { winnerPrompts } from "./winner_promts";

const client = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

function getRandomPrompt() {
    return winnerPrompts[Math.floor(Math.random() * winnerPrompts.length)];
}

function createPromt(currentProgress) {
    const randomPrompt = getRandomPrompt();
    return `
${randomPrompt}

leaderboard:
${currentProgress}
`;
}

export async function generateWinnerMessage(currentProgress: string, debug = false) {
    const promt = createPromt(currentProgress);

    if (debug) {
        console.log("Winner prompt:\n", promt);
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
        .replace("****", "*")
        .replace("***", "*")
        .replace("**", "*")
        .trim();

    if (debug) {
        console.log("Winner response:\n", message);
    }
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

    generateMotivation(yesterday, today, true).then((message) => {
        console.log("Generated message:");
        console.log(message);
    });
}
*/