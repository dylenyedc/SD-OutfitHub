const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { normalizePromptData, newId } = require('../../db');

const ROOT = path.join(__dirname, '..', '..');
const DB_FILE = path.join(ROOT, 'data.sqlite');
const LEGACY_JSON = path.join(ROOT, 'prompt-data.json');

function inferPart(titleText, promptText) {
  const text = String(titleText || '') + ' ' + String(promptText || '');
  if (/套装|礼装|连衣|dress|one.?piece/i.test(text)) return '套装';
  if (/上衣|外套|夹克|衬衫|上装|top|jacket|shirt/i.test(text)) return '上衣';
  if (/下装|裤|短裤|长裤|裙|bottom|pants|shorts|skirt/i.test(text)) return '下装';
  if (/鞋|靴|sneaker|boot|heels/i.test(text)) return '鞋子';
  if (/帽|头饰|发饰|headwear|hat|hair/i.test(text)) return '头饰';
  if (/配件|手套|项链|耳环|choker|glove|bracelet|necklace|earring/i.test(text)) return '配件';
  if (/武器|剑|杖|枪|弓|weapon|sword|staff|gun|bow/i.test(text)) return '武器';
  return '未知';
}

function chooseOwnerId(db) {
  const fromCharacters = db.prepare('SELECT owner_user_id AS owner, COUNT(*) AS n FROM characters GROUP BY owner_user_id ORDER BY n DESC LIMIT 1').get();
  if (fromCharacters && fromCharacters.owner) {
    return String(fromCharacters.owner);
  }
  const fromUsers = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
  if (fromUsers && fromUsers.id) {
    return String(fromUsers.id);
  }
  throw new Error('未找到可用 owner_user_id');
}

function mergeTags(existingTags, nextTags) {
  const set = new Set([].concat(existingTags || [], nextTags || []).map(item => String(item || '').trim()).filter(Boolean));
  return Array.from(set);
}

function run() {
  if (!fs.existsSync(LEGACY_JSON)) {
    throw new Error('未找到 prompt-data.json');
  }

  const raw = fs.readFileSync(LEGACY_JSON, 'utf8');
  const parsed = JSON.parse(raw);
  const normalized = normalizePromptData(parsed);
  const db = new Database(DB_FILE);

  const ownerId = chooseOwnerId(db);

  const selectCharByTitle = db.prepare('SELECT id, title, description, tags_json FROM characters WHERE owner_user_id = ? AND title = ? LIMIT 1');
  const insertChar = db.prepare('INSERT INTO characters(id, owner_user_id, title, description, tags_json) VALUES (?, ?, ?, ?, ?)');
  const updateChar = db.prepare('UPDATE characters SET description = ?, tags_json = ? WHERE owner_user_id = ? AND id = ?');

  const selectOutfitByNameSource = db.prepare('SELECT id, part, style, source_character, safety, other_tags, prompt FROM outfits WHERE owner_user_id = ? AND title = ? AND source_character = ? LIMIT 1');
  const selectOutfitByPrompt = db.prepare('SELECT id FROM outfits WHERE owner_user_id = ? AND prompt = ? LIMIT 1');
  const insertOutfit = db.prepare('INSERT INTO outfits(id, owner_user_id, title, part, style, source_character, safety, other_tags, prompt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const updateOutfit = db.prepare('UPDATE outfits SET part = ?, style = ?, safety = ?, other_tags = ?, prompt = ? WHERE owner_user_id = ? AND id = ?');

  const tx = db.transaction(() => {
    let charsInserted = 0;
    let charsUpdated = 0;
    let outfitsInserted = 0;
    let outfitsUpdated = 0;

    normalized.chars.forEach(group => {
      const title = String(group.title || '').trim();
      if (!title) {
        return;
      }

      const nextDescription = String(group.description || '').trim();
      const nextTags = Array.isArray(group.tags) ? group.tags : [];

      const existed = selectCharByTitle.get(ownerId, title);
      if (!existed) {
        insertChar.run(newId(), ownerId, title, nextDescription, JSON.stringify(nextTags));
        charsInserted += 1;
        return;
      }

      let existedTags = [];
      try {
        existedTags = JSON.parse(existed.tags_json || '[]');
      } catch (_) {
        existedTags = [];
      }
      const mergedTags = mergeTags(existedTags, nextTags);
      const mergedDescription = String(existed.description || '').trim() || nextDescription;
      const needUpdate = mergedDescription !== String(existed.description || '').trim()
        || JSON.stringify(mergedTags) !== JSON.stringify(existedTags);
      if (needUpdate) {
        updateChar.run(mergedDescription, JSON.stringify(mergedTags), ownerId, existed.id);
        charsUpdated += 1;
      }
    });

    normalized.outfit.forEach(entry => {
      const title = String(entry.title || '').trim() || '未命名服装';
      const sourceCharacter = String(entry.sourceCharacter || '').trim() || '无';
      const prompt = String(entry.prompt || '').trim();
      if (!prompt) {
        return;
      }

      const part = String(entry.part || '').trim() || inferPart(title, prompt);
      const style = String(entry.style || '').trim();
      const safety = String(entry.safety || '').trim().toUpperCase() === 'NSFW' ? 'NSFW' : 'SFW';
      const other = String(entry.other || '').trim();

      const existed = selectOutfitByNameSource.get(ownerId, title, sourceCharacter);
      if (!existed) {
        const duplicatedByPrompt = selectOutfitByPrompt.get(ownerId, prompt);
        if (duplicatedByPrompt) {
          return;
        }
        insertOutfit.run(newId(), ownerId, title, part, style, sourceCharacter, safety, other, prompt);
        outfitsInserted += 1;
        return;
      }

      const nextPart = String(existed.part || '').trim() && String(existed.part || '').trim() !== '未知'
        ? String(existed.part || '').trim()
        : part;
      const nextStyle = String(existed.style || '').trim() || style;
      const nextSafety = String(existed.safety || '').trim() || safety;
      const nextOther = String(existed.other_tags || '').trim() || other;
      const nextPrompt = String(existed.prompt || '').trim() || prompt;
      const shouldUpdate = nextPart !== String(existed.part || '').trim()
        || nextStyle !== String(existed.style || '').trim()
        || nextSafety !== String(existed.safety || '').trim()
        || nextOther !== String(existed.other_tags || '').trim()
        || nextPrompt !== String(existed.prompt || '').trim();
      if (shouldUpdate) {
        updateOutfit.run(nextPart, nextStyle, nextSafety, nextOther, nextPrompt, ownerId, existed.id);
        outfitsUpdated += 1;
      }
    });

    return { ownerId, charsInserted, charsUpdated, outfitsInserted, outfitsUpdated };
  });

  const result = tx();
  console.log(JSON.stringify(result, null, 2));
}

run();