// src/db.js
import Dexie from 'dexie';

const db = new Dexie('FlowBoardDB');

db.version(1).stores({
  tasks: '++id, title, description, status, deleted, synced'
});

export default db;
