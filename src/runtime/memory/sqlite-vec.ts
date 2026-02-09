import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

export default function loadVecExtension(db: Database.Database) : void  {
  if (!db) throw new Error("DB not initialized");
  sqliteVec.load(db);
}
