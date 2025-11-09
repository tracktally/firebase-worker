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
    .replace("markdown", "")
    .replace(/```/g, "")
    .replace(/\*{2,}/g, "*")
    .trim();        

    if (debug) {
        console.log("Winner response:\n", message);
    }
    return message;
}
