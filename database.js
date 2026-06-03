const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS advokats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      photo TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS qna (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      question TEXT NOT NULL,
      answer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_answered INTEGER DEFAULT 0
    )
  `);

  db.get(`SELECT COUNT(*) as count FROM advokats`, (err, row) => {
    if (err) return;
    if (row.count === 0) {
      const advokats = [
        ['Michael J. Nakamnamu, S.H.', 'Advokat Senior & Partner', null],
        ['Manuel D. Nakamnamu, S.H., M.H', 'Advokat & Partner', null],
        ['Richard F. Talubun, S.H., M.H', 'Advokat & Partner', null]
      ];
      const stmt = db.prepare(`INSERT INTO advokats (name, title, photo) VALUES (?, ?, ?)`);
      advokats.forEach(a => stmt.run(a));
      stmt.finalize();
    }
  });
});

module.exports = db;