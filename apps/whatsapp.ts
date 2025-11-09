import { SEND_SCRIPT, TEST_SEND_SCRIPT } from "./defines";
import { spawn } from "child_process";

function notify(message: string, script) {
    const args = [`${message}`];

    const child = spawn(script, args, { stdio: "inherit" });

    child.on("close", (code) => {
        console.log(`Script exited with code ${code}`);
    });
    return;
}

export function notifyGroup(message: string) {
    return notify(message, SEND_SCRIPT)
}

export function notifyTest(message: string) {
    return notify(message, TEST_SEND_SCRIPT)
}
