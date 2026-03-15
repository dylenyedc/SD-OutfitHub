async function editCharGroupTags(groupId) {
    const groups = promptData.chars || [];
    const targetGroup = groups.find(function (group) {
        return group.id === groupId;
    });
    if (!targetGroup) {
        showToast('角色分组不存在');
        return;
    }

    const oldTagsText = (targetGroup.tags || []).join(', ');
    const nextTagsRaw = window.prompt('请输入标签，多个标签用英文逗号分隔：', oldTagsText);
    if (nextTagsRaw === null) {
        return;
    }

    const nextTags = parseTags(nextTagsRaw);
    const backup = deepClone(promptData);
    targetGroup.tags = nextTags;

    const saved = await savePromptData();
    if (!saved) {
        promptData = backup;
        return;
    }

    const availableTags = collectCharTags();
    if (activeCharTag !== '__all__' && availableTags.indexOf(activeCharTag) === -1) {
        activeCharTag = '__all__';
    }

    renderCharTagFilters();
    renderTab('chars');
    showToast('角色标签已更新');
}

async function renameCharGroup(groupId, oldTitle) {
    const groups = promptData.chars || [];
    const targetGroup = groups.find(group => group.id === groupId);
    if (!targetGroup) {
        showToast('角色分组不存在');
        return;
    }

    const nextTitleRaw = window.prompt('请输入新的角色名称：', oldTitle || targetGroup.title);
    if (nextTitleRaw === null) {
        return;
    }

    const nextTitle = nextTitleRaw.trim();
    if (!nextTitle) {
        showToast('角色名称不能为空');
        return;
    }

    const duplicated = groups.some(group => group.id !== groupId && group.title === nextTitle);
    if (duplicated) {
        showToast('角色名称已存在');
        return;
    }

    const backup = deepClone(promptData);
    targetGroup.title = nextTitle;

    const saved = await savePromptData();
    if (!saved) {
        promptData = backup;
        return;
    }

    renderTab('chars');
    showToast('角色名称已更新');
}

async function deleteCharGroup(groupId, groupTitle) {
    const groups = promptData.chars || [];
    const targetGroup = groups.find(group => group.id === groupId);
    if (!targetGroup) {
        showToast('角色分组不存在');
        return;
    }

    const hasItems = (targetGroup.items || []).length > 0;
    const confirmText = hasItems
        ? '确认删除角色“' + (groupTitle || targetGroup.title) + '”吗？该角色下的提示词也会一并删除。'
        : '确认删除角色“' + (groupTitle || targetGroup.title) + '”吗？';

    if (!window.confirm(confirmText)) {
        return;
    }

    const backup = deepClone(promptData);
    promptData.chars = groups.filter(group => group.id !== groupId);

    const saved = await savePromptData();
    if (!saved) {
        promptData = backup;
        return;
    }

    if (editState && editState.tabId === 'chars' && editState.groupId === groupId) {
        editState = null;
    }
    if (addState && addState.tabId === 'chars' && addState.groupId === groupId) {
        addState = null;
    }

    renderTab('chars');
    showToast('角色已删除');
}

async function deleteItem(tabId, groupId, itemId, itemName) {
    if (!window.confirm('确认删除条目“' + itemName + '”吗？')) {
        return;
    }

    const groups = promptData[tabId] || [];
    const targetGroup = groups.find(group => group.id === groupId);
    if (!targetGroup) {
        showToast('未找到所属分组');
        return;
    }

    const backup = deepClone(promptData);
    const beforeCount = targetGroup.items.length;
    targetGroup.items = targetGroup.items.filter(item => item.id !== itemId);
    if (beforeCount === targetGroup.items.length) {
        showToast('条目不存在，无法删除');
        return;
    }

    const saved = await savePromptData();
    if (!saved) {
        promptData = backup;
        return;
    }

    if (editState && editState.itemId === itemId && editState.groupId === groupId && editState.tabId === tabId) {
        editState = null;
    }

    renderTab(tabId);
    showToast('条目已删除');
}

async function saveInlineEditedItem(itemNode, formNode) {
    const tabId = itemNode.dataset.tabId;
    const groupId = itemNode.dataset.groupId;
    const itemId = itemNode.dataset.itemId;
    const nameInput = formNode.querySelector('.inline-item-name');
    const promptInput = formNode.querySelector('.inline-item-prompt');
    const name = nameInput ? nameInput.value.trim() : '';
    const prompt = promptInput ? promptInput.value.trim() : '';

    if (!name || !prompt) {
        showToast('请填写完整信息');
        return;
    }

    const groups = promptData[tabId] || [];
    const targetGroup = groups.find(group => group.id === groupId);
    const targetItem = targetGroup ? targetGroup.items.find(item => item.id === itemId) : null;
    if (!targetGroup || !targetItem) {
        showToast('条目不存在，可能已被删除');
        editState = null;
        renderTab(tabId);
        return;
    }

    const backup = deepClone(promptData);
    targetItem.name = name;
    targetItem.prompt = prompt;

    const saved = await savePromptData();
    if (!saved) {
        promptData = backup;
        return;
    }

    editState = null;
    renderTab(tabId);
    showToast('提示词已更新');
}

async function saveInlineAddedItem(formNode) {
    const tabId = formNode.dataset.tabId;
    const groupId = formNode.dataset.groupId;
    const nameInput = formNode.querySelector('.inline-item-name');
    const promptInput = formNode.querySelector('.inline-item-prompt');
    const name = nameInput ? nameInput.value.trim() : '';
    const prompt = promptInput ? promptInput.value.trim() : '';

    if (!tabId || !groupId || !name || !prompt) {
        showToast('请填写完整信息');
        return;
    }

    const groups = promptData[tabId] || [];
    const targetGroup = groups.find(group => group.id === groupId);
    if (!targetGroup) {
        showToast('未找到分组');
        return;
    }

    const backup = deepClone(promptData);
    targetGroup.items.unshift({
        id: newId(),
        name: name,
        prompt: prompt
    });

    const saved = await savePromptData();
    if (!saved) {
        promptData = backup;
        return;
    }

    addState = null;
    renderTab(tabId);
    showToast('已新增提示词条目');
}

function startEdit(tabId, groupId, itemId) {
    if (tabId !== activeTab) {
        activeTab = tabId;
    }

    const group = (promptData[tabId] || []).find(g => g.id === groupId);
    const item = group ? group.items.find(i => i.id === itemId) : null;

    if (!group || !item) {
        showToast('找不到要编辑的条目');
        return;
    }

    if (tabId !== activeTab) {
        switchToTab(tabId);
    }
    editState = { tabId: tabId, groupId: groupId, itemId: itemId };
    addState = null;
    renderTab(tabId);
}

function switchTab(tabId, element) {
    activeTab = tabId;
    switchToTab(tabId, element);
    editState = null;
    addState = null;
    if (tabId === 'chars') {
        renderCharTagFilters();
    }
}

function copyPrompt(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast();
        }).catch(() => {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast();
    } catch (err) {
        alert('复制失败，请手动复制');
    }
    document.body.removeChild(textArea);
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (message) {
        toast.textContent = message;
    } else {
        toast.textContent = '已复制到剪贴板';
    }
    toast.style.opacity = '1';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
}
