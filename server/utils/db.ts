import { Pool } from "pg";

const config = useRuntimeConfig()
const databaseUrl = config.dbURL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({ connectionString: databaseUrl });
