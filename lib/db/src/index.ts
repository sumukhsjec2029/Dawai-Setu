import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Mock database for demo/testing mode
const mockDb = {
  select: () => ({ from: () => ({ where: () => [], limit: () => [], orderBy: () => [] }) }),
  insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
  update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
  delete: () => ({ where: () => Promise.resolve([]) }),
  transaction: (fn: (tx: any) => Promise<any>) => fn(mockDb),
};

export const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
export const db = process.env.DATABASE_URL ? drizzle(pool!, { schema }) : (mockDb as any);

export * from "./schema";
