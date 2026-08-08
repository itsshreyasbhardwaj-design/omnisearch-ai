import * as m0001 from './0001_init';
import * as m0002 from './0002_phase3_7';

export interface Migration {
  id: string;
  sql: string;
}

/** Applied in array order — append new migrations, never reorder or edit a shipped one. */
export const migrations: Migration[] = [
  { id: m0001.id, sql: m0001.sql },
  { id: m0002.id, sql: m0002.sql },
];
