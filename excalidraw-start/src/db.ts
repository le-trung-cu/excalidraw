import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import Database from 'better-sqlite3'

// Read the database path from DATABASE_URL env var, stripping "file:" if present
const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db'
const dbPath = dbUrl.startsWith('file:') ? dbUrl.substring(5) : dbUrl

const sqlite = new Database(dbPath)
const adapter = new PrismaBetterSqlite3(sqlite)

export const prisma = new PrismaClient({ adapter })
