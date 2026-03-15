async function loadPromptData() {
    try {
        const response = await fetch('/api/prompts');
        if (!response.ok) {
            throw new Error('数据读取失败: ' + response.status);
        }
        const data = await response.json();
        if (!data || typeof data !== 'object') {
            throw new Error('数据格式无效');
        }
        return normalizePromptData(data);
    } catch (e) {
        console.warn('读取服务端数据失败，使用默认数据', e);
        showToast('服务端读取失败，已使用默认数据');
    }
    return normalizePromptData(JSON.parse(JSON.stringify(defaultPromptData)));
}

async function savePromptData() {
    try {
        const response = await fetch('/api/prompts', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(promptData)
        });

        if (!response.ok) {
            throw new Error('数据保存失败: ' + response.status);
        }

        return true;
    } catch (e) {
        console.error('保存失败', e);
        showToast('保存失败，请检查服务器状态');
        return false;
    }
}

function normalizePromptData(data) {
    const normalized = deepClone(data || {});
    TAB_KEYS.forEach(function (tabKey) {
        if (!Array.isArray(normalized[tabKey])) {
            normalized[tabKey] = [];
        }
    });

    normalized.chars = normalized.chars.map(function (group) {
        const nextGroup = group && typeof group === 'object' ? deepClone(group) : { id: newId(), title: '未命名角色', items: [] };
        if (!Array.isArray(nextGroup.items)) {
            nextGroup.items = [];
        }
        if (!Array.isArray(nextGroup.tags)) {
            nextGroup.tags = [];
        }
        return nextGroup;
    });

    return normalized;
}
