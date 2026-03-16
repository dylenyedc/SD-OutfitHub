const {
  DB_FILE,
  openDatabase,
  replaceAllData,
  readJsonSourceFile,
  getPromptData
} = require('../db');

function countItems(data) {
  const charCount = Array.isArray(data.chars) ? data.chars.length : 0;
  const actionCount = Array.isArray(data.actions) ? data.actions.length : 0;
  const envCount = Array.isArray(data.env) ? data.env.length : 0;
  const outfitCount = Array.isArray(data.outfit) ? data.outfit.length : 0;
  return { charCount, actionCount, envCount, outfitCount };
}

function runMigration() {
  const { source, data } = readJsonSourceFile();
  const db = openDatabase();

  replaceAllData(db, data);
  const snapshot = getPromptData(db);
  const counts = countItems(snapshot);

  console.log('SQLite migration completed.');
  console.log('Source JSON:', source);
  console.log('Target DB:', DB_FILE);
  console.log('Groups -> chars:', counts.charCount, 'actions:', counts.actionCount, 'env:', counts.envCount, 'outfit:', counts.outfitCount);

  db.close();
}

runMigration();
