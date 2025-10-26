import { open, type DB } from '@op-engineering/op-sqlite'
import { migrateDbIfNeeded } from './schema'

let dbInstance: DB | null = null

/* Initialize the database and run migrations. This should be called once when the app starts */
export async function initializeDatabase(): Promise<DB> {
  if (dbInstance) {
    return dbInstance
  }

  try {
    dbInstance = open({ name: 'memoriq.db' })
    await migrateDbIfNeeded(dbInstance)
    return dbInstance
  } catch (error) {
    throw error
  }
}

export function getDatabaseInstance(): DB {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return dbInstance
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
