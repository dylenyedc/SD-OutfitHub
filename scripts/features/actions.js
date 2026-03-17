async function addCharGroupByTitle(titleRaw) {
    const title = String(titleRaw || '').trim();
    if (!title) {
        showToast('请输入角色分组名称');
        return false;
    }

    const result = await mutatePromptData('addCharGroup', { title: title });
    if (!result.ok) {
        return false;
    }

    renderTab('chars');
    showToast(result.message);
    return true;
}

async function editCharGroupTags(groupId) {
    const groups = promptData.chars || [];
    const targetGroup = groups.find(function (group) {
        return group.id === groupId;
    });
    if (!targetGroup) {
        showToast('角色分组不存在');
        return false;
    }

    const oldTagsText = (targetGroup.tags || []).join(', ');
    const nextTagsRaw = window.prompt('请输入标签，多个标签用英文逗号分隔；建议用“分类:标签”格式，例如：作品:明日方舟, 性别:女, 分级:SFW, 其他:维多利亚', oldTagsText);
    if (nextTagsRaw === null) {
        return false;
    }

    return editCharGroupTagsByValue(groupId, nextTagsRaw);
}

async function editCharGroupTagsByValue(groupId, nextTagsRaw) {
    const nextTags = parseTags(nextTagsRaw);
    const result = await mutatePromptData('editCharGroupTags', { groupId: groupId, tags: nextTags });
    if (!result.ok) {
        return false;
    }

    const availableTags = collectCharTags();
    activeCharTags = activeCharTags.filter(function (tag) {
        return availableTags.indexOf(tag) > -1;
    });

    renderCharTagFilters();
    renderTab('chars');
    showToast(result.message);
    return true;
}

async function addCharTagByValue(groupId, nextTagRaw) {
    const nextTag = String(nextTagRaw || '').trim();
    if (!nextTag) {
        showToast('标签不能为空');
        return false;
    }

    const result = await mutatePromptData('addCharTag', { groupId: groupId, tag: nextTag });
    if (!result.ok) {
        return false;
    }

    renderCharTagFilters();
    renderTab('chars');
    showToast(result.message);
    return true;
}

async function editCharTagByValue(groupId, oldTag, nextTagRaw) {
    const nextTag = String(nextTagRaw || '').trim();
    if (!nextTag) {
        showToast('标签不能为空');
        return false;
    }

    const result = await mutatePromptData('editCharTag', {
        groupId: groupId,
        oldTag: oldTag,
        nextTag: nextTag
    });
    if (!result.ok) {
        return false;
    }

    activeCharTags = activeCharTags.map(function (tag) {
        return tag === oldTag ? nextTag : tag;
    });

    renderCharTagFilters();
    renderTab('chars');
    showToast(result.message);
    return true;
}

async function deleteCharTagByValue(groupId, oldTag) {
    const result = await mutatePromptData('deleteCharTag', {
        groupId: groupId,
        tag: oldTag
    });
    if (!result.ok) {
        return false;
    }

    activeCharTags = activeCharTags.filter(function (tag) {
        return tag !== oldTag;
    });

    renderCharTagFilters();
    renderTab('chars');
    showToast(result.message);
    return true;
}

async function renameCharGroup(groupId, oldTitle) {
    const groups = promptData.chars || [];
    const targetGroup = groups.find(group => group.id === groupId);
    if (!targetGroup) {
        showToast('角色分组不存在');
        return false;
    }

    const nextTitleRaw = window.prompt('请输入新的角色名称：', oldTitle || targetGroup.title);
    if (nextTitleRaw === null) {
        return false;
    }

    return renameCharGroupByValue(groupId, nextTitleRaw);
}

async function renameCharGroupByValue(groupId, nextTitleRaw) {
    const nextTitle = String(nextTitleRaw || '').trim();
    if (!nextTitle) {
        showToast('角色名称不能为空');
        return false;
    }

    const result = await mutatePromptData('renameCharGroup', {
        groupId: groupId,
        title: nextTitle
    });
    if (!result.ok) {
        return false;
    }

    renderTab('chars');
    showToast(result.message);
    return true;
}

async function saveCharDescriptionByValue(groupId, descriptionRaw) {
    const description = String(descriptionRaw || '').trim();
    if (!description) {
        showToast('角色描述不能为空');
        return false;
    }

    const result = await mutatePromptData('saveCharDescription', {
        groupId: groupId,
        description: description
    });
    if (!result.ok) {
        return false;
    }

    renderTab('chars');
    showToast(result.message);
    return true;
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

    const result = await mutatePromptData('deleteCharGroup', { groupId: groupId });
    if (!result.ok) {
        return;
    }

    if (editState && editState.tabId === 'chars' && editState.groupId === groupId) {
        editState = null;
    }
    if (addState && addState.tabId === 'chars' && addState.groupId === groupId) {
        addState = null;
    }

    renderTab('chars');
    showToast(result.message);
}

async function deleteItem(tabId, groupId, itemId, itemName) {
    if (tabId === 'outfit') {
        return;
    }

    if (!window.confirm('确认删除条目“' + itemName + '”吗？')) {
        return;
    }

    const result = await mutatePromptData('deleteItem', {
        tabId: tabId,
        groupId: groupId,
        itemId: itemId
    });
    if (!result.ok) {
        return;
    }

    if (editState && editState.itemId === itemId && editState.groupId === groupId && editState.tabId === tabId) {
        editState = null;
    }

    renderTab(tabId);
    showToast(result.message);
}

async function saveInlineEditedItem(itemNode, formNode) {
    const tabId = itemNode.dataset.tabId;
    const itemId = itemNode.dataset.itemId;
    let result = null;

    if (tabId === 'outfit') {
        const titleInput = formNode.querySelector('.inline-item-name');
        const partInput = formNode.querySelector('.inline-outfit-part');
        const styleInput = formNode.querySelector('.inline-outfit-style');
        const sourceInput = formNode.querySelector('.inline-outfit-source');
        const safetyInput = formNode.querySelector('.inline-outfit-safety');
        const otherInput = formNode.querySelector('.inline-outfit-other');
        const promptInput = formNode.querySelector('.inline-item-prompt');
        const payload = {
            outfitId: itemId,
            title: titleInput ? titleInput.value.trim() : '',
            part: partInput ? partInput.value.trim() : '未知',
            style: styleInput ? styleInput.value.trim() : '',
            sourceCharacter: sourceInput ? sourceInput.value.trim() : '无',
            safety: safetyInput ? safetyInput.value.trim() : 'SFW',
            other: otherInput ? otherInput.value.trim() : '',
            prompt: promptInput ? promptInput.value.trim() : ''
        };
        if (!payload.title || !payload.prompt) {
            showToast('请填写完整信息');
            return;
        }
        result = await mutatePromptData('saveOutfitEntry', payload);
    } else {
        const groupId = itemNode.dataset.groupId;
        const nameInput = formNode.querySelector('.inline-item-name');
        const promptInput = formNode.querySelector('.inline-item-prompt');
        const name = nameInput ? nameInput.value.trim() : '';
        const prompt = promptInput ? promptInput.value.trim() : '';

        if (!name || !prompt) {
            showToast('请填写完整信息');
            return;
        }

        result = await mutatePromptData('saveItem', {
            tabId: tabId,
            groupId: groupId,
            itemId: itemId,
            categoryKey: '',
            name: name,
            prompt: prompt
        });
    }

    if (!result.ok) {
        return;
    }

    editState = null;
    renderTab(activeTab === 'chars' && tabId === 'outfit' ? 'chars' : tabId);
    showToast(result.message);
}

async function saveInlineAddedItem(formNode) {
    const tabId = formNode.dataset.tabId;
    const groupId = formNode.dataset.groupId;
    const categoryKey = formNode.dataset.categoryKey || '';
    const nameInput = formNode.querySelector('.inline-item-name');
    const promptInput = formNode.querySelector('.inline-item-prompt');
    const name = nameInput ? nameInput.value.trim() : '';
    const prompt = promptInput ? promptInput.value.trim() : '';

    if (!tabId || !groupId || !name || !prompt) {
        showToast('请填写完整信息');
        return;
    }

    const result = await mutatePromptData('addItem', {
        tabId: tabId,
        groupId: groupId,
        categoryKey: categoryKey,
        name: name,
        prompt: prompt
    });
    if (!result.ok) {
        return;
    }

    addState = null;
    renderTab(tabId);
    showToast(result.message);
}

function startEdit(tabId, groupId, itemId, categoryKey) {
    const resolvedCategoryKey = categoryKey || '';
    const keepCharsView = activeTab === 'chars' && tabId === 'outfit';

    if (!keepCharsView && tabId !== activeTab) {
        activeTab = tabId;
    }

    const group = (promptData[tabId] || []).find(g => g.id === groupId);
    let item = null;
    if (tabId === 'outfit') {
        item = (promptData.outfit || []).find(function (entry) {
            return entry.id === itemId;
        }) || null;
    } else {
        item = group ? group.items.find(i => i.id === itemId) : null;
    }

    const missingTarget = tabId === 'outfit' ? !item : (!group || !item);
    if (missingTarget) {
        showToast('找不到要编辑的条目');
        return;
    }

    if (!keepCharsView && tabId !== activeTab) {
        switchToTab(tabId);
    }

    editState = { tabId: tabId, groupId: groupId, itemId: itemId, categoryKey: resolvedCategoryKey };
    addState = null;
    renderTab(keepCharsView ? 'chars' : tabId);
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

async function addOutfitEntry() {
    const title = outfitGroupTitleInput ? outfitGroupTitleInput.value.trim() : '';
    const part = outfitPartInput ? outfitPartInput.value.trim() : '未知';
    const style = outfitStyleInput ? outfitStyleInput.value.trim() : '';
    const sourceCharacter = outfitSourceCharacterInput ? outfitSourceCharacterInput.value.trim() : '无';
    const safety = outfitSafetyInput ? outfitSafetyInput.value.trim() : 'SFW';
    const other = outfitOtherInput ? outfitOtherInput.value.trim() : '';
    const prompt = outfitPromptInput ? outfitPromptInput.value.trim() : '';
    if (!title) {
        showToast('请输入服装条目名称');
        return false;
    }

    if (!prompt) {
        showToast('请输入提示词内容');
        return false;
    }

    let result = await mutatePromptData('addOutfitEntry', {
        title: title,
        part: part || '未知',
        style: style,
        sourceCharacter: sourceCharacter || '无',
        safety: safety || 'SFW',
        other: other,
        prompt: prompt
    });

    if (!result.ok && String(result.message || '').indexOf('未知操作类型') > -1) {
        result = await mutatePromptData('addOutfitGroup', {
            title: title
        });
    }

    if (!result.ok) {
        return false;
    }

    if (outfitGroupTitleInput) {
        outfitGroupTitleInput.value = '';
    }
    if (outfitStyleInput) {
        outfitStyleInput.value = '';
    }
    if (outfitSourceCharacterInput) {
        outfitSourceCharacterInput.value = '无';
    }
    if (outfitSafetyInput) {
        outfitSafetyInput.value = 'SFW';
    }
    if (outfitOtherInput) {
        outfitOtherInput.value = '';
    }
    if (outfitPromptInput) {
        outfitPromptInput.value = '';
    }
    renderTab('outfit');
    showToast(result.message);
    return true;
}

async function renameOutfitGroup(groupId, oldTitle) {
    const groups = promptData.outfit || [];
    const targetGroup = groups.find(function (group) {
        return group.id === groupId;
    });
    if (!targetGroup) {
        showToast('服装风格不存在');
        return;
    }

    const nextTitleRaw = window.prompt('请输入新的风格名称：', oldTitle || targetGroup.title);
    if (nextTitleRaw === null) {
        return;
    }

    const nextTitle = nextTitleRaw.trim();
    if (!nextTitle) {
        showToast('风格名称不能为空');
        return;
    }

    const result = await mutatePromptData('renameOutfitGroup', {
        groupId: groupId,
        title: nextTitle
    });
    if (!result.ok) {
        return;
    }

    renderTab(activeTab === 'chars' ? 'chars' : 'outfit');
    showToast(result.message);
}

async function deleteOutfitGroup(groupId, groupTitle) {
    const groups = promptData.outfit || [];
    const targetGroup = groups.find(function (group) {
        return group.id === groupId;
    });
    if (!targetGroup) {
        showToast('服装风格不存在');
        return;
    }

    if (!window.confirm('确认删除风格“' + (groupTitle || targetGroup.title) + '”吗？该风格下的所有子分类条目会一并删除。')) {
        return;
    }

    const result = await mutatePromptData('deleteOutfitGroup', { groupId: groupId });
    if (!result.ok) {
        return;
    }

    if (editState && editState.tabId === 'outfit' && editState.groupId === groupId) {
        editState = null;
    }
    if (addState && addState.tabId === 'outfit' && addState.groupId === groupId) {
        addState = null;
    }

    renderTab('outfit');
    showToast(result.message);
}

async function deleteOutfitItem(groupId, categoryKey, itemId, itemName) {
    await deleteOutfitEntry(itemId, itemName);
}

async function deleteOutfitEntry(outfitId, outfitTitle) {
    if (!window.confirm('确认删除服装条目“' + (outfitTitle || '该条目') + '”吗？')) {
        return;
    }

    const result = await mutatePromptData('deleteOutfitEntry', {
        outfitId: outfitId
    });
    if (!result.ok) {
        return;
    }

    if (editState && editState.tabId === 'outfit' && editState.itemId === outfitId) {
        editState = null;
    }

    renderTab('outfit');
    showToast(result.message);
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

function composeCharacterPrompt(basePrompt, outfitPrompt) {
    const base = String(basePrompt || '').trim();
    const outfit = String(outfitPrompt || '').trim();

    if (!base) {
        return '';
    }

    if (!outfit) {
        return base;
    }

    return base + ', ' + outfit;
}

function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
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
