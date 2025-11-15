import OpenAI from "openai";

import { OPENAI_API_KEY } from "../../secrets/openai";
import { winnerPrompts } from "./winner_promts";
import { topUserPrompts } from "./topuser_prompts";

const client = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

function getRandomPrompt(prompts: string[]): string {
    return prompts[Math.floor(Math.random() * prompts.length)];
}

function createWinnerPromt(currentProgress) {
    const randomPrompt = getRandomPrompt(winnerPrompts);
    return `
${randomPrompt}

leaderboard:
${currentProgress}
`;
}

export function createTopUserPrompt(progress: string, previousWinner: string,
    context: string) {
    const randomPrompt = getRandomPrompt(topUserPrompts);
    return `
${randomPrompt}

new winner:
${progress}

Previous top user:
${previousWinner}

Previous announcements for context:
${context}
`;
}

export async function generateWinnerMessage(currentProgress: string, debug = false) {
    return generateGptMessage(createWinnerPromt(currentProgress), debug);
}

export async function generateTopUserMessage(message: string,
     previousTop: string, context: string, debug = false) {
    return generateGptMessage(createTopUserPrompt(message, previousTop, context), debug);
}

export async function generateGptMessage(promt: string, debug = false) {

    if (debug) {
        console.log("prompt:\n", promt);
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
        console.log("response:\n", message);
    }
    return message;
}
