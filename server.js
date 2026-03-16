const path = require('path');
const express = require('express');
const {
  OUTFIT_CATEGORY_KEYS,
  newId,
  normalizePromptData,
  openDatabase,
  replaceAllData,
  getPromptData,
  getCharacters,
  searchPromptDatabase,
  parseTags
} = require('./db');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

const db = openDatabase();

function requireString(value, message) {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error(message);
  }
  return text;
}

function getPromptDataSnapshot() {
  return getPromptData(db);
}

function findPromptGroupTable(section) {
  if (section === 'actions' || section === 'env') {
    return 'prompt_groups';
  }
  if (section === 'chars') {
    return 'characters';
  }
  if (section === 'outfit') {
    return 'outfits';
  }
  return '';
}

function mutateByAction(action, payload = {}) {
  const tx = db.transaction(() => {
    if (action === 'addCharGroup') {
      const title = requireString(payload.title, '请输入角色分组名称');
      const existed = db.prepare('SELECT 1 FROM characters WHERE title = ?').get(title);
      if (existed) {
        throw new Error('该角色分组已存在');
      }
      db.prepare('INSERT INTO characters(id, title, tags_json) VALUES (?, ?, ?)').run(newId(), title, '[]');
      return '已新增角色分组';
    }

    if (action === 'addOutfitGroup') {
      const title = requireString(payload.title, '请输入服装风格名称');
      const existed = db.prepare('SELECT 1 FROM outfits WHERE title = ?').get(title);
      if (existed) {
        throw new Error('该服装风格已存在');
      }
      db.prepare('INSERT INTO outfits(id, title) VALUES (?, ?)').run(newId(), title);
      return '已新增服装风格';
    }

    if (action === 'editCharGroupTags') {
      const groupId = requireString(payload.groupId, '角色分组不存在');
      const existed = db.prepare('SELECT 1 FROM characters WHERE id = ?').get(groupId);
      if (!existed) {
        throw new Error('角色分组不存在');
      }
      const tags = Array.isArray(payload.tags) ? payload.tags : parseTags(payload.tagsRaw || '');
      db.prepare('UPDATE characters SET tags_json = ? WHERE id = ?').run(JSON.stringify(tags), groupId);
      return '角色标签已更新';
    }

    if (action === 'addCharTag') {
      const groupId = requireString(payload.groupId, '角色分组不存在');
      const tag = requireString(payload.tag, '标签不能为空');
      const row = db.prepare('SELECT tags_json FROM characters WHERE id = ?').get(groupId);
      if (!row) {
        throw new Error('角色分组不存在');
      }
      const tags = Array.isArray(JSON.parse(row.tags_json || '[]')) ? JSON.parse(row.tags_json || '[]') : [];
      if (tags.includes(tag)) {
        throw new Error('该标签已存在');
      }
      tags.push(tag);
      db.prepare('UPDATE characters SET tags_json = ? WHERE id = ?').run(JSON.stringify(tags), groupId);
      return '标签已添加';
    }

    if (action === 'editCharTag') {
      const groupId = requireString(payload.groupId, '角色分组不存在');
      const oldTag = requireString(payload.oldTag, '标签不存在');
      const nextTag = requireString(payload.nextTag, '标签不能为空');
      const row = db.prepare('SELECT tags_json FROM characters WHERE id = ?').get(groupId);
      if (!row) {
        throw new Error('角色分组不存在');
      }
      const tags = Array.isArray(JSON.parse(row.tags_json || '[]')) ? JSON.parse(row.tags_json || '[]') : [];
      const index = tags.indexOf(oldTag);
      if (index < 0) {
        throw new Error('标签不存在');
      }
      if (oldTag !== nextTag && tags.includes(nextTag)) {
        throw new Error('该标签已存在');
      }
      tags[index] = nextTag;
      db.prepare('UPDATE characters SET tags_json = ? WHERE id = ?').run(JSON.stringify(tags), groupId);
      return '标签已更新';
    }

    if (action === 'deleteCharTag') {
      const groupId = requireString(payload.groupId, '角色分组不存在');
      const tag = requireString(payload.tag, '标签不存在');
      const row = db.prepare('SELECT tags_json FROM characters WHERE id = ?').get(groupId);
      if (!row) {
        throw new Error('角色分组不存在');
      }
      const tags = Array.isArray(JSON.parse(row.tags_json || '[]')) ? JSON.parse(row.tags_json || '[]') : [];
      if (!tags.includes(tag)) {
        throw new Error('标签不存在');
      }
      const next = tags.filter(item => item !== tag);
      db.prepare('UPDATE characters SET tags_json = ? WHERE id = ?').run(JSON.stringify(next), groupId);
      return '标签已删除';
    }

    if (action === 'renameCharGroup') {
      const groupId = requireString(payload.groupId, '角色分组不存在');
      const title = requireString(payload.title, '角色名称不能为空');
      const existed = db.prepare('SELECT 1 FROM characters WHERE id = ?').get(groupId);
      if (!existed) {
        throw new Error('角色分组不存在');
      }
      const duplicated = db.prepare('SELECT 1 FROM characters WHERE title = ? AND id <> ?').get(title, groupId);
      if (duplicated) {
        throw new Error('角色名称已存在');
      }
      db.prepare('UPDATE characters SET title = ? WHERE id = ?').run(title, groupId);
      return '角色名称已更新';
    }

    if (action === 'deleteCharGroup') {
      const groupId = requireString(payload.groupId, '角色分组不存在');
      const existed = db.prepare('SELECT 1 FROM characters WHERE id = ?').get(groupId);
      if (!existed) {
        throw new Error('角色分组不存在');
      }
      db.prepare("DELETE FROM prompts WHERE section = 'chars' AND group_id = ?").run(groupId);
      db.prepare('DELETE FROM characters WHERE id = ?').run(groupId);
      return '角色已删除';
    }

    if (action === 'deleteItem') {
      const tabId = requireString(payload.tabId, '分组类型无效');
      if (!['chars', 'actions', 'env'].includes(tabId)) {
        throw new Error('分组类型无效');
      }
      const groupId = requireString(payload.groupId, '未找到所属分组');
      const itemId = requireString(payload.itemId, '条目不存在，无法删除');
      const removed = db.prepare('DELETE FROM prompts WHERE id = ? AND section = ? AND group_id = ?').run(itemId, tabId, groupId);
      if (!removed.changes) {
        throw new Error('条目不存在，无法删除');
      }
      return '条目已删除';
    }

    if (action === 'saveItem') {
      const tabId = requireString(payload.tabId, '分组类型无效');
      const groupId = requireString(payload.groupId, '未找到所属分组');
      const itemId = requireString(payload.itemId, '条目不存在，可能已被删除');
      const name = requireString(payload.name, '请填写完整信息');
      const prompt = requireString(payload.prompt, '请填写完整信息');
      const categoryKey = String(payload.categoryKey || '');

      if (tabId === 'outfit') {
        if (!OUTFIT_CATEGORY_KEYS.includes(categoryKey)) {
          throw new Error('服装分类无效');
        }
      } else if (!['chars', 'actions', 'env'].includes(tabId)) {
        throw new Error('分组类型无效');
      }

      const updated = db.prepare('UPDATE prompts SET name = ?, prompt = ? WHERE id = ? AND section = ? AND group_id = ?')
        .run(name, prompt, itemId, tabId, groupId);
      if (!updated.changes) {
        throw new Error('条目不存在，可能已被删除');
      }
      return '提示词已更新';
    }

    if (action === 'addItem') {
      const tabId = requireString(payload.tabId, '分组类型无效');
      const groupId = requireString(payload.groupId, '未找到分组');
      const name = requireString(payload.name, '请填写完整信息');
      const prompt = requireString(payload.prompt, '请填写完整信息');
      let categoryKey = '';

      if (tabId === 'outfit') {
        categoryKey = requireString(payload.categoryKey, '服装分类无效');
        if (!OUTFIT_CATEGORY_KEYS.includes(categoryKey)) {
          throw new Error('服装分类无效');
        }
      } else if (!['chars', 'actions', 'env'].includes(tabId)) {
        throw new Error('分组类型无效');
      }

      const groupTable = findPromptGroupTable(tabId);
      const groupExists = db.prepare(`SELECT 1 FROM ${groupTable} WHERE id = ?`).get(groupId);
      if (!groupExists) {
        throw new Error(tabId === 'outfit' ? '未找到所属风格或分类' : '未找到分组');
      }

      db.prepare('INSERT INTO prompts(id, section, group_id, category_key, name, prompt) VALUES (?, ?, ?, ?, ?, ?)')
        .run(newId(), tabId, groupId, categoryKey, name, prompt);
      return '已新增提示词条目';
    }

    if (action === 'renameOutfitGroup') {
      const groupId = requireString(payload.groupId, '服装风格不存在');
      const title = requireString(payload.title, '风格名称不能为空');
      const existed = db.prepare('SELECT 1 FROM outfits WHERE id = ?').get(groupId);
      if (!existed) {
        throw new Error('服装风格不存在');
      }
      const duplicated = db.prepare('SELECT 1 FROM outfits WHERE title = ? AND id <> ?').get(title, groupId);
      if (duplicated) {
        throw new Error('风格名称已存在');
      }
      db.prepare('UPDATE outfits SET title = ? WHERE id = ?').run(title, groupId);
      return '风格名称已更新';
    }

    if (action === 'deleteOutfitGroup') {
      const groupId = requireString(payload.groupId, '服装风格不存在');
      const existed = db.prepare('SELECT 1 FROM outfits WHERE id = ?').get(groupId);
      if (!existed) {
        throw new Error('服装风格不存在');
      }
      db.prepare("DELETE FROM prompts WHERE section = 'outfit' AND group_id = ?").run(groupId);
      db.prepare('DELETE FROM outfits WHERE id = ?').run(groupId);
      return '服装风格已删除';
    }

    if (action === 'deleteOutfitItem') {
      const groupId = requireString(payload.groupId, '未找到所属风格或分类');
      const categoryKey = requireString(payload.categoryKey, '服装分类无效');
      const itemId = requireString(payload.itemId, '条目不存在，无法删除');
      if (!OUTFIT_CATEGORY_KEYS.includes(categoryKey)) {
        throw new Error('服装分类无效');
      }
      const removed = db.prepare("DELETE FROM prompts WHERE id = ? AND section = 'outfit' AND group_id = ? AND category_key = ?")
        .run(itemId, groupId, categoryKey);
      if (!removed.changes) {
        throw new Error('条目不存在，无法删除');
      }
      return '条目已删除';
    }

    throw new Error('未知操作类型');
  });

  return tx();
}

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(ROOT_DIR, { index: false }));

app.get('/api/prompts', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(getPromptDataSnapshot());
  } catch (error) {
    res.status(500).json({ message: '读取数据失败', detail: error.message });
  }
});

app.put('/api/prompts', (req, res) => {
  try {
    const parsed = req.body;
    if (!parsed || typeof parsed !== 'object') {
      res.status(400).json({ message: '数据格式错误' });
      return;
    }

    const normalized = normalizePromptData(parsed);
    replaceAllData(db, normalized);
    res.json({ message: '保存成功', data: getPromptDataSnapshot() });
  } catch (error) {
    res.status(400).json({ message: '无法解析 JSON', detail: error.message });
  }
});

app.post('/api/prompts/mutate', (req, res) => {
  try {
    const action = String(req.body && req.body.action || '');
    const payload = req.body && req.body.payload ? req.body.payload : {};
    if (!action) {
      res.status(400).json({ message: '缺少 action 参数' });
      return;
    }

    const message = mutateByAction(action, payload);
    res.json({ message: message || '操作成功', data: getPromptDataSnapshot() });
  } catch (error) {
    res.status(400).json({ message: error.message || '操作失败' });
  }
});

app.get('/api/characters', (req, res) => {
  try {
    const chars = getCharacters(db);
    res.set('Cache-Control', 'no-store');
    res.json({ total: chars.length, chars });
  } catch (error) {
    res.status(500).json({ message: '读取角色列表失败', detail: error.message });
  }
});

app.get('/api/chars', (req, res) => {
  try {
    const chars = getCharacters(db);
    res.set('Cache-Control', 'no-store');
    res.json({ total: chars.length, chars });
  } catch (error) {
    res.status(500).json({ message: '读取角色列表失败', detail: error.message });
  }
});

app.post('/api/characters', (req, res) => {
  try {
    const title = requireString(req.body && req.body.title, '请输入角色分组名称');
    const tags = Array.isArray(req.body && req.body.tags) ? req.body.tags : [];
    const existed = db.prepare('SELECT 1 FROM characters WHERE title = ?').get(title);
    if (existed) {
      res.status(400).json({ message: '该角色分组已存在' });
      return;
    }

    const id = newId();
    db.prepare('INSERT INTO characters(id, title, tags_json) VALUES (?, ?, ?)').run(id, title, JSON.stringify(tags));
    res.status(201).json({ id, title, tags });
  } catch (error) {
    res.status(400).json({ message: error.message || '创建角色失败' });
  }
});

app.put('/api/characters/:id', (req, res) => {
  try {
    const id = requireString(req.params.id, '角色分组不存在');
    const existing = db.prepare('SELECT id, title, tags_json FROM characters WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ message: '角色分组不存在' });
      return;
    }

    const nextTitle = (req.body && Object.prototype.hasOwnProperty.call(req.body, 'title'))
      ? requireString(req.body.title, '角色名称不能为空')
      : existing.title;
    const nextTags = (req.body && Object.prototype.hasOwnProperty.call(req.body, 'tags'))
      ? (Array.isArray(req.body.tags) ? req.body.tags : [])
      : JSON.parse(existing.tags_json || '[]');

    const duplicated = db.prepare('SELECT 1 FROM characters WHERE title = ? AND id <> ?').get(nextTitle, id);
    if (duplicated) {
      res.status(400).json({ message: '角色名称已存在' });
      return;
    }

    db.prepare('UPDATE characters SET title = ?, tags_json = ? WHERE id = ?').run(nextTitle, JSON.stringify(nextTags), id);
    res.json({ id, title: nextTitle, tags: nextTags });
  } catch (error) {
    res.status(400).json({ message: error.message || '更新角色失败' });
  }
});

app.delete('/api/characters/:id', (req, res) => {
  try {
    const id = requireString(req.params.id, '角色分组不存在');
    const existed = db.prepare('SELECT 1 FROM characters WHERE id = ?').get(id);
    if (!existed) {
      res.status(404).json({ message: '角色分组不存在' });
      return;
    }

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM prompts WHERE section = 'chars' AND group_id = ?").run(id);
      db.prepare('DELETE FROM characters WHERE id = ?').run(id);
    });

    tx();
    res.json({ message: '角色已删除' });
  } catch (error) {
    res.status(400).json({ message: error.message || '删除角色失败' });
  }
});

app.get('/api/agent-skill/search', (req, res) => {
  const keyword = req.query.keyword || req.query.q || '';
  const limit = req.query.limit || '10';
  const section = req.query.section || '';

  if (!String(keyword).trim()) {
    res.status(400).json({ message: '缺少关键词参数，请提供 keyword 或 q' });
    return;
  }

  try {
    const results = searchPromptDatabase(db, keyword, { limit, section });
    res.json({
      skill: 'prompt-search',
      query: String(keyword),
      section: section || 'all',
      total: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({ message: '检索失败', detail: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log('SD-OutfitHub server is running at http://localhost:' + PORT);
});
