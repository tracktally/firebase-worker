import Database from "better-sqlite3";
import path from "path";

export interface MessageEntry {
  id: number;
  created_at: Date;
  challenge_name: string;
  challenge_id: string;
  message: string;
}

export interface InsertMessageInput {
  challengeName: string;
  challengeId: string;
  message: string;
  date: Date;
}

const dbPath = path.join(__dirname, "pushup_messages.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    challenge_name TEXT NOT NULL,
    challenge_id TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

function toISODate(date: Date) {
  return date.toISOString().split("T")[0];
}

export function insertMessage(i: InsertMessageInput): number {
  const stmt = db.prepare(`
    INSERT INTO messages (date, challenge_name, challenge_id, message)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(toISODate(i.date), i.challengeName, i.challengeId, i.message);
  return info.lastInsertRowid as number;
}

export function getMessages(challengeId: string): MessageEntry[] {
  const stmt = db.prepare(`
        SELECT * 
        FROM messages 
        WHERE challenge_id = ? 
        ORDER BY created_at DESC
    `);

  return stmt.all(challengeId).map((r: any) => ({
    ...r,
    date: new Date(r.date),
    created_at: new Date(r.created_at),
  }));
}