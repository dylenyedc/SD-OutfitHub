const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { newId } = require('../../db');

const ROOT = path.join(__dirname, '..', '..');
const DB_FILE = path.join(ROOT, 'data.sqlite');

const CLOTHING_PATTERNS = [
  /dress|jacket|coat|shirt|skirt|shorts|pants|trousers|sweater|vest|cape|cloak|apron|kimono|hanfu|bikini|swimsuit|bodysuit|uniform|boots|shoes|sneakers|sandals|heels|socks|thighhigh|pantyhose|stockings|legwear|gloves|choker|collar|sleeves?|hat|beret|headwear|ribbon|necktie|belt|armor|armlet|gauntlets|footwear|loafers|open clothes|open_clothes|micro shorts|crop top|tube top|top\b|clothes\b/i,
  /礼装|礼裙|礼服|女仆|和服|汉服|外套|夹克|衬衫|裙|短裤|长裤|袜|过膝|裤袜|手套|鞋|靴|披风|围裙|泳装|比基尼|装甲|头饰|发饰|帽|腰带|领结|领带|袖/i
];

const PROP_PATTERNS = [
  /\bholding\b|\bweapon\b|\bsword\b|\bstaff\b|\baxe\b|\bgun\b|\bhammer\b|\bbook\b|\bmicrophone\b|\bumbrella\b|\bdrone\b|\blantern\b|\bgourd\b|\btelescope\b|\btripod\b|\bsuitcase\b|\bcase\b/i,
  /持[剑杖枪弓斧锤书伞]|道具|武器|附加|配件|镜头|视角/i
];

const STRICT_PROP_PATTERNS = [
  /\bholding\b|\bweapon\b|\bsword\b|\bstaff\b|\baxe\b|\bgun\b|\bhammer\b|\bbook\b|\bmicrophone\b|\bumbrella\b|\bdrone\b|\blantern\b|\bgourd\b|\btelescope\b|\btripod\b|\bsuitcase\b|\bcase\b/i,
  /持[剑杖枪弓斧锤书伞]|道具|武器/i
];

function splitTags(text) {
  return String(text || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function uniqueInOrder(items) {
  const seen = new Set();
  const result = [];
  items.forEach(item => {
    const key = String(item || '').trim();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(key);
  });
  return result;
}

function classifyTag(tag) {
  const text = String(tag || '').trim();
  if (!text) {
    return 'skip';
  }

  if (PROP_PATTERNS.some(pattern => pattern.test(text))) {
    return 'prop';
  }

  if (CLOTHING_PATTERNS.some(pattern => pattern.test(text))) {
    return 'outfit';
  }

  return 'character';
}

function normalizePrompt(tags) {
  return uniqueInOrder(tags).join(', ');
}

function isAccessoryTitle(title) {
  const text = String(title || '').trim();
  return /附加|道具|武器|镜头|视角|\(配件\)|（配件）/i.test(text);
}

function isStrictPropText(text) {
  return STRICT_PROP_PATTERNS.some(pattern => pattern.test(String(text || '').trim()));
}

function mergeOtherTags(existingOther, tagToAdd) {
  const parts = String(existingOther || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  if (parts.indexOf(tagToAdd) < 0) {
    parts.push(tagToAdd);
  }
  return parts.join(',');
}

function run() {
  const backupFile = path.join(ROOT, `data.backup-before-separate-${Date.now()}.sqlite`);
  fs.copyFileSync(DB_FILE, backupFile);

  const db = new Database(DB_FILE);

  const outfits = db.prepare('SELECT id, owner_user_id, title, part, style, source_character, safety, other_tags, prompt FROM outfits ORDER BY rowid ASC').all();
  const characters = db.prepare('SELECT id, owner_user_id, title, description FROM characters ORDER BY rowid ASC').all();

  const updateOutfitStmt = db.prepare('UPDATE outfits SET part = ?, other_tags = ?, prompt = ? WHERE owner_user_id = ? AND id = ?');
  const insertOutfitStmt = db.prepare('INSERT INTO outfits(id, owner_user_id, title, part, style, source_character, safety, other_tags, prompt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const findDuplicateAccessoryStmt = db.prepare('SELECT id FROM outfits WHERE owner_user_id = ? AND title = ? AND source_character = ? AND prompt = ? LIMIT 1');
  const updateCharacterStmt = db.prepare('UPDATE characters SET description = ? WHERE owner_user_id = ? AND id = ?');
  const deleteOutfitStmt = db.prepare('DELETE FROM outfits WHERE owner_user_id = ? AND id = ?');

  const tx = db.transaction(() => {
    const charTokenMap = new Map();
    let outfitsUpdated = 0;
    let accessoriesInserted = 0;
    let charactersUpdated = 0;

    outfits.forEach(outfit => {
      const owner = String(outfit.owner_user_id || '').trim();
      const source = String(outfit.source_character || '无').trim() || '无';
      const tags = splitTags(outfit.prompt);
      const accessoryTitle = isAccessoryTitle(outfit.title);

      const outfitTags = [];
      const propTags = [];
      const charTags = [];

      tags.forEach(tag => {
        const type = classifyTag(tag);
        if (type === 'outfit') {
          outfitTags.push(tag);
          return;
        }
        if (type === 'prop') {
          propTags.push(tag);
          return;
        }
        if (type === 'character') {
          charTags.push(tag);
        }
      });

      if (source && source !== '无' && charTags.length) {
        const key = owner + '::' + source;
        const existing = charTokenMap.get(key) || [];
        charTokenMap.set(key, existing.concat(charTags));
      }

      const nextOutfitPrompt = normalizePrompt(outfitTags.length ? outfitTags : tags.filter(tag => classifyTag(tag) !== 'prop')) || normalizePrompt(tags);
      const nextPart = accessoryTitle ? '配件' : '套装';
      const nextOther = nextPart === '配件'
        ? mergeOtherTags(outfit.other_tags, '配件')
        : String(outfit.other_tags || '').trim();

      if (nextPart !== String(outfit.part || '').trim() || nextOther !== String(outfit.other_tags || '').trim() || nextOutfitPrompt !== String(outfit.prompt || '').trim()) {
        updateOutfitStmt.run(nextPart, nextOther, nextOutfitPrompt, owner, outfit.id);
        outfitsUpdated += 1;
      }

      if (!accessoryTitle && propTags.length) {
        const accessoryPrompt = normalizePrompt(propTags);
        if (accessoryPrompt && isStrictPropText(accessoryPrompt)) {
          const accessoryTitle = String(outfit.title || '未命名服装') + '（配件）';
          const duplicated = findDuplicateAccessoryStmt.get(owner, accessoryTitle, source, accessoryPrompt);
          if (!duplicated) {
            insertOutfitStmt.run(
              newId(),
              owner,
              accessoryTitle,
              '配件',
              String(outfit.style || '').trim(),
              source,
              String(outfit.safety || 'SFW').trim().toUpperCase() === 'NSFW' ? 'NSFW' : 'SFW',
              mergeOtherTags(outfit.other_tags, '配件'),
              accessoryPrompt
            );
            accessoriesInserted += 1;
          }
        }
      }

      if (accessoryTitle && !isStrictPropText(String(outfit.prompt || ''))) {
        deleteOutfitStmt.run(owner, outfit.id);
      }
    });

    characters.forEach(character => {
      const owner = String(character.owner_user_id || '').trim();
      const title = String(character.title || '').trim();
      const key = owner + '::' + title;
      const extraTags = charTokenMap.get(key) || [];

      const baseTags = splitTags(character.description);
      const cleanedBaseTags = baseTags.filter(tag => classifyTag(tag) !== 'outfit' && classifyTag(tag) !== 'prop');
      const nextDescription = normalizePrompt(cleanedBaseTags.concat(extraTags));
      if (nextDescription && nextDescription !== String(character.description || '').trim()) {
        updateCharacterStmt.run(nextDescription, owner, character.id);
        charactersUpdated += 1;
      }
    });

    return {
      backupFile,
      outfitsUpdated,
      accessoriesInserted,
      charactersUpdated
    };
  });

  const result = tx();
  console.log(JSON.stringify(result, null, 2));
}

run();