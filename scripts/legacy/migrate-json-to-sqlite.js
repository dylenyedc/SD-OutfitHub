const {
  DB_FILE,
  openDatabase,
  newId,
  adoptOrphanData,
  replaceAllData,
  readJsonSourceFile,
  getPromptData
} = require('../../db');
const crypto = require('crypto');

function countItems(data) {
  const charCount = Array.isArray(data.chars) ? data.chars.length : 0;
  const actionCount = Array.isArray(data.actions) ? data.actions.length : 0;
  const envCount = Array.isArray(data.env) ? data.env.length : 0;
  const outfitCount = Array.isArray(data.outfit) ? data.outfit.length : 0;
  return { charCount, actionCount, envCount, outfitCount };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${digest}`;
}

function runMigration() {
  let source = '';
  let data = null;
  try {
    const result = readJsonSourceFile();
    source = result.source;
    data = result.data;
  } catch (error) {
    console.log('No JSON source found. Skip migration.');
    console.log('Hint: place data.json or prompt-data.json in project root if you need to import.');
    return;
  }

  const db = openDatabase();

  const username = process.env.MIGRATE_USERNAME || 'local';
  const password = process.env.MIGRATE_PASSWORD || 'local123456';
  let user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username);
  if (!user) {
    const userId = newId();
    db.prepare('INSERT INTO users(id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, username, hashPassword(password), Date.now());
    user = { id: userId, username };
  }

  adoptOrphanData(db, user.id);

  replaceAllData(db, data, user.id);
  const snapshot = getPromptData(db, user.id);
  const counts = countItems(snapshot);

  console.log('SQLite migration completed.');
  console.log('Source JSON:', source);
  console.log('Target DB:', DB_FILE);
  console.log('Owner user:', user.username, '(' + user.id + ')');
  console.log('Groups -> chars:', counts.charCount, 'actions:', counts.actionCount, 'env:', counts.envCount, 'outfit:', counts.outfitCount);

  db.close();
}

runMigration();