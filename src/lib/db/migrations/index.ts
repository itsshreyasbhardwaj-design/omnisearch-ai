import * as m0001 from './0001_init';

export interface Migration {
  id: string;
  sql: string;
}

/** Applied in array order — append new migrations, never reorder or edit a shipped one. */
export const migrations: Migration[] = [{ id: m0001.id, sql: m0001.sql }];
