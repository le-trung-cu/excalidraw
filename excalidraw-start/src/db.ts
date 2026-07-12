import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

// Conforming to Prisma 7 SQLite adapter constructor which manages DB instantiation internally
const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db'

const adapter = new PrismaBetterSqlite3({
  url: dbUrl
})

export const prisma = new PrismaClient({ adapter })
