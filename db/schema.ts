import {sqliteTable,integer,text} from 'drizzle-orm/sqlite-core';
export const project=sqliteTable('project',{id:integer('id').primaryKey(),records:text('records').notNull()});
export const authAttempts=sqliteTable('auth_attempts',{key:text('key').primaryKey(),fails:integer('fails').notNull(),window:integer('window').notNull()});
