import OpenAI from "openai";

import { OPENAI_API_KEY } from "../../secrets/openai";

const client = new OpenAI({
    apiKey: OPENAI_API_KEY,
});


export async function generateLeaderboardCommentary(context: string, debug: boolean = false) {
    const prompt = `
You are a bot that manages a daily push-up challenge.
Given this leaderboard, pick out something and mention it in a message.
You dont have to mention everything, just pick something interesting.
Be motivating and funny, also shame if needed.
Some users aim for 100, some for 50. Pick something interesting to say.
At the end of your response, output only the final WhatsApp message (no explanations, in source code, make names bold with *).
Keep it short, funny, and dynamic. Same people who are lazy. (1–2 sentences). Add a title in bold. and seperate with newline.

Leaderboard data:
${context}
`;

if (debug) {
    console.log("Leaderboard prompt:\n", prompt);
}

    const response = await client.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
            // { role: "system", content: "You are a witty motivational bot for a push-up challenge." },
            { role: "user", content: prompt },
        ],
    });

    
    const message = response.choices[0].message.content
        .replace(/```/g, "")
        .trim();

    return message;
}

/*
{
    let msg = `    
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
    generateLeaderboardCommentary(msg).then((message) => {
        console.log("Generated message:");
        console.log(message);
    });
}
*/