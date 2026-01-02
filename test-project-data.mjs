import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { eq, and } from "drizzle-orm";
import * as schema from "./drizzle/schema.js";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: "default" });

const [project] = await db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.id, 90001));

console.log("Project data:", JSON.stringify(project, null, 2));
console.log("startDate type:", typeof project.startDate);
console.log("endDate type:", typeof project.endDate);

await connection.end();
