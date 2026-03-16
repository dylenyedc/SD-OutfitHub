const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = path.join(__dirname, 'data.sqlite');
const JSON_DATA_FILE = path.join(__dirname, 'data.json');
const LEGACY_JSON_DATA_FILE = path.join(__dirname, 'prompt-data.json');
const OUTFIT_CATEGORY_KEYS = ['tops', 'bottoms', 'shoes', 'headwear', 'accessories', 'weapons', 'others'];

function newId() {
  return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
}

function deepClone(data) {
  return JSON.parse(JSON.stringify(data));
}

function parseTags(value) {
  const parts = String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  const uniq = [];
  const seen = new Set();
  parts.forEach(tag => {
    if (!seen.has(tag)) {
      seen.add(tag);
      uniq.push(tag);
    }
  });

  return uniq;
}

function normalizePromptData(data) {
  const normalized = deepClone(data || {});
  ['chars', 'actions', 'env', 'outfit'].forEach(key => {
    if (!Array.isArray(normalized[key])) {
      normalized[key] = [];
    }
  });

  ['chars', 'actions', 'env'].forEach(tabKey => {
    normalized[tabKey] = normalized[tabKey].map(group => {
      const nextGroup = group && typeof group === 'object' ? deepClone(group) : { id: newId(), title: '未命名分组', items: [] };
      if (!Array.isArray(nextGroup.items)) {
        nextGroup.items = [];
      }
      return nextGroup;
    });
  });

  normalized.chars = normalized.chars.map(group => {
    const nextGroup = group && typeof group === 'object' ? deepClone(group) : { id: newId(), title: '未命名角色', items: [], tags: [] };
    if (!Array.isArray(nextGroup.items)) {
      nextGroup.items = [];
    }
    if (!Array.isArray(nextGroup.tags)) {
      nextGroup.tags = [];
    }
    return nextGroup;
  });

  normalized.outfit = normalized.outfit.map(group => {
    const nextGroup = group && typeof group === 'object' ? deepClone(group) : { id: newId(), title: '未命名风格' };
    OUTFIT_CATEGORY_KEYS.forEach(categoryKey => {
      if (!Array.isArray(nextGroup[categoryKey])) {
        nextGroup[categoryKey] = [];
      }
    });
    return nextGroup;
  });

  return normalized;
}

function openDatabase() {
  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF');

  db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS outfits (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_groups (
      id TEXT PRIMARY KEY,
      section TEXT NOT NULL CHECK(section IN ('actions', 'env')),
      title TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      section TEXT NOT NULL CHECK(section IN ('chars', 'actions', 'env', 'outfit')),
      group_id TEXT NOT NULL,
      category_key TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      prompt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prompts_section_group ON prompts(section, group_id);
    CREATE INDEX IF NOT EXISTS idx_prompts_group ON prompts(group_id);
  `);

  return db;
}

function replaceAllData(db, inputData) {
  const data = normalizePromptData(inputData);

  const insertCharacter = db.prepare('INSERT INTO characters(id, title, tags_json) VALUES (?, ?, ?)');
  const insertOutfit = db.prepare('INSERT INTO outfits(id, title) VALUES (?, ?)');
  const insertPromptGroup = db.prepare('INSERT INTO prompt_groups(id, section, title) VALUES (?, ?, ?)');
  const insertPrompt = db.prepare('INSERT INTO prompts(id, section, group_id, category_key, name, prompt) VALUES (?, ?, ?, ?, ?, ?)');

  const transaction = db.transaction(() => {
    db.exec('DELETE FROM prompts');
    db.exec('DELETE FROM prompt_groups');
    db.exec('DELETE FROM outfits');
    db.exec('DELETE FROM characters');

    data.chars.forEach(group => {
      insertCharacter.run(group.id || newId(), group.title || '', JSON.stringify(Array.isArray(group.tags) ? group.tags : []));
      const items = Array.isArray(group.items) ? group.items : [];
      items.forEach(item => {
        insertPrompt.run(item.id || newId(), 'chars', group.id, '', item.name || '', item.prompt || '');
      });
    });

    data.actions.forEach(group => {
      insertPromptGroup.run(group.id || newId(), 'actions', group.title || '');
      const items = Array.isArray(group.items) ? group.items : [];
      items.forEach(item => {
        insertPrompt.run(item.id || newId(), 'actions', group.id, '', item.name || '', item.prompt || '');
      });
    });

    data.env.forEach(group => {
      insertPromptGroup.run(group.id || newId(), 'env', group.title || '');
      const items = Array.isArray(group.items) ? group.items : [];
      items.forEach(item => {
        insertPrompt.run(item.id || newId(), 'env', group.id, '', item.name || '', item.prompt || '');
      });
    });

    data.outfit.forEach(group => {
      insertOutfit.run(group.id || newId(), group.title || '');
      OUTFIT_CATEGORY_KEYS.forEach(categoryKey => {
        const items = Array.isArray(group[categoryKey]) ? group[categoryKey] : [];
        items.forEach(item => {
          insertPrompt.run(item.id || newId(), 'outfit', group.id, categoryKey, item.name || '', item.prompt || '');
        });
      });
    });
  });

  transaction();
}

function safeParseTagsJson(tagsJson) {
  try {
    const parsed = JSON.parse(tagsJson || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function getPromptData(db) {
  const characters = db.prepare('SELECT id, title, tags_json FROM characters ORDER BY rowid ASC').all();
  const actionsGroups = db.prepare("SELECT id, title FROM prompt_groups WHERE section = 'actions' ORDER BY rowid ASC").all();
  const envGroups = db.prepare("SELECT id, title FROM prompt_groups WHERE section = 'env' ORDER BY rowid ASC").all();
  const outfits = db.prepare('SELECT id, title FROM outfits ORDER BY rowid ASC').all();
  const prompts = db.prepare('SELECT id, section, group_id, category_key, name, prompt FROM prompts ORDER BY rowid ASC').all();

  const charsById = new Map();
  const actionsById = new Map();
  const envById = new Map();
  const outfitById = new Map();

  const chars = characters.map(row => {
    const group = {
      id: row.id,
      title: row.title,
      tags: safeParseTagsJson(row.tags_json),
      items: []
    };
    charsById.set(row.id, group);
    return group;
  });

  const actions = actionsGroups.map(row => {
    const group = { id: row.id, title: row.title, items: [] };
    actionsById.set(row.id, group);
    return group;
  });

  const env = envGroups.map(row => {
    const group = { id: row.id, title: row.title, items: [] };
    envById.set(row.id, group);
    return group;
  });

  const outfit = outfits.map(row => {
    const group = {
      id: row.id,
      title: row.title,
      tops: [],
      bottoms: [],
      shoes: [],
      headwear: [],
      accessories: [],
      weapons: [],
      others: []
    };
    outfitById.set(row.id, group);
    return group;
  });

  prompts.forEach(row => {
    const item = { id: row.id, name: row.name, prompt: row.prompt };

    if (row.section === 'chars') {
      const group = charsById.get(row.group_id);
      if (group) {
        group.items.push(item);
      }
      return;
    }

    if (row.section === 'actions') {
      const group = actionsById.get(row.group_id);
      if (group) {
        group.items.push(item);
      }
      return;
    }

    if (row.section === 'env') {
      const group = envById.get(row.group_id);
      if (group) {
        group.items.push(item);
      }
      return;
    }

    if (row.section === 'outfit') {
      const group = outfitById.get(row.group_id);
      const categoryKey = OUTFIT_CATEGORY_KEYS.includes(row.category_key) ? row.category_key : 'others';
      if (group) {
        group[categoryKey].push(item);
      }
    }
  });

  return { chars, actions, env, outfit };
}

function getCharacters(db) {
  return db.prepare('SELECT id, title, tags_json FROM characters ORDER BY rowid ASC').all().map(row => {
    const itemCountRow = db.prepare("SELECT COUNT(*) AS total FROM prompts WHERE section = 'chars' AND group_id = ?").get(row.id);
    return {
      id: row.id,
      title: row.title,
      tags: safeParseTagsJson(row.tags_json),
      itemCount: itemCountRow ? itemCountRow.total : 0
    };
  });
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s_\-]+/g, '')
    .trim();
}

function isSubsequence(needle, haystack) {
  if (!needle || !haystack) {
    return false;
  }

  let i = 0;
  let j = 0;
  while (i < needle.length && j < haystack.length) {
    if (needle[i] === haystack[j]) {
      i += 1;
    }
    j += 1;
  }
  return i === needle.length;
}

function scoreField(rawKeyword, normalizedKeyword, value) {
  const raw = String(value || '');
  const normalized = normalizeText(raw);

  if (!raw || !normalized) {
    return 0;
  }

  const lowerRaw = raw.toLowerCase();
  const lowerKeyword = String(rawKeyword || '').toLowerCase().trim();

  if (normalized === normalizedKeyword) {
    return 120;
  }
  if (normalized.startsWith(normalizedKeyword)) {
    return 90;
  }
  if (normalized.includes(normalizedKeyword)) {
    return 70;
  }
  if (lowerKeyword && lowerRaw.includes(lowerKeyword)) {
    return 65;
  }
  if (isSubsequence(normalizedKeyword, normalized)) {
    return 40;
  }
  return 0;
}

function searchPromptDatabase(db, keyword, options = {}) {
  const data = getPromptData(db);
  const limit = Math.max(1, Math.min(Number(options.limit) || 10, 100));
  const sectionFilter = options.section ? String(options.section).trim() : '';
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) {
    return [];
  }

  const sections = ['chars', 'actions', 'env', 'outfit'];
  const targetSections = sectionFilter && sections.includes(sectionFilter) ? [sectionFilter] : sections;
  const results = [];

  targetSections.forEach(section => {
    const groups = Array.isArray(data[section]) ? data[section] : [];
    groups.forEach(group => {
      const groupTags = Array.isArray(group.tags) ? group.tags : [];

      if (section === 'outfit') {
        OUTFIT_CATEGORY_KEYS.forEach(categoryKey => {
          const items = Array.isArray(group[categoryKey]) ? group[categoryKey] : [];
          items.forEach(item => {
            const matchedFields = [];
            let totalScore = 0;

            const nameScore = scoreField(keyword, normalizedKeyword, item.name || '');
            if (nameScore > 0) {
              matchedFields.push('item.name');
              totalScore += nameScore + 30;
            }

            const titleScore = scoreField(keyword, normalizedKeyword, group.title || '');
            if (titleScore > 0) {
              matchedFields.push('group.title');
              totalScore += titleScore + 20;
            }

            const categoryLabelMap = {
              tops: '上衣',
              bottoms: '下装',
              shoes: '鞋子',
              headwear: '头饰',
              accessories: '配件',
              weapons: '武器',
              others: '其他'
            };
            const categoryLabel = categoryLabelMap[categoryKey] || categoryKey;
            const categoryScore = scoreField(keyword, normalizedKeyword, categoryLabel);
            if (categoryScore > 0) {
              matchedFields.push('outfit.category');
              totalScore += categoryScore + 10;
            }

            const promptScore = scoreField(keyword, normalizedKeyword, item.prompt || '');
            if (promptScore > 0) {
              matchedFields.push('item.prompt');
              totalScore += promptScore;
            }

            if (totalScore > 0) {
              results.push({
                section,
                groupId: group.id,
                groupTitle: group.title,
                itemId: item.id,
                itemName: item.name,
                prompt: item.prompt,
                categoryKey,
                tags: groupTags,
                score: totalScore,
                matchedFields
              });
            }
          });
        });
        return;
      }

      const items = Array.isArray(group.items) ? group.items : [];
      items.forEach(item => {
        const matchedFields = [];
        let totalScore = 0;

        const nameScore = scoreField(keyword, normalizedKeyword, item.name || '');
        if (nameScore > 0) {
          matchedFields.push('item.name');
          totalScore += nameScore + 30;
        }

        const titleScore = scoreField(keyword, normalizedKeyword, group.title || '');
        if (titleScore > 0) {
          matchedFields.push('group.title');
          totalScore += titleScore + 20;
        }

        const tagScore = groupTags.reduce((best, tag) => Math.max(best, scoreField(keyword, normalizedKeyword, tag)), 0);
        if (tagScore > 0) {
          matchedFields.push('group.tags');
          totalScore += tagScore + 15;
        }

        const promptScore = scoreField(keyword, normalizedKeyword, item.prompt || '');
        if (promptScore > 0) {
          matchedFields.push('item.prompt');
          totalScore += promptScore;
        }

        if (totalScore > 0) {
          results.push({
            section,
            groupId: group.id,
            groupTitle: group.title,
            itemId: item.id,
            itemName: item.name,
            prompt: item.prompt,
            categoryKey: '',
            tags: groupTags,
            score: totalScore,
            matchedFields
          });
        }
      });
    });
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function readJsonSourceFile() {
  const source = fs.existsSync(JSON_DATA_FILE)
    ? JSON_DATA_FILE
    : (fs.existsSync(LEGACY_JSON_DATA_FILE) ? LEGACY_JSON_DATA_FILE : null);

  if (!source) {
    throw new Error('未找到 data.json 或 prompt-data.json');
  }

  const raw = fs.readFileSync(source, 'utf8');
  return { source, data: JSON.parse(raw) };
}

module.exports = {
  DB_FILE,
  JSON_DATA_FILE,
  LEGACY_JSON_DATA_FILE,
  OUTFIT_CATEGORY_KEYS,
  newId,
  parseTags,
  normalizePromptData,
  openDatabase,
  replaceAllData,
  getPromptData,
  getCharacters,
  searchPromptDatabase,
  readJsonSourceFile
};
