function bindGroupEvents() {
    charGroupAddBtn.addEventListener('click', async function () {
        const title = charGroupTitleInput.value.trim();
        if (!title) {
            showToast('请输入角色分组名称');
            return;
        }

        const existed = (promptData.chars || []).some(group => group.title === title);
        if (existed) {
            showToast('该角色分组已存在');
            return;
        }

        const backup = deepClone(promptData);
        promptData.chars.unshift({
            id: newId(),
            title: title,
            tags: [],
            items: []
        });

        const saved = await savePromptData();
        if (!saved) {
            promptData = backup;
            return;
        }

        charGroupTitleInput.value = '';
        renderTab('chars');
        showToast('已新增角色分组');
    });

    if (outfitGroupAddBtn) {
        outfitGroupAddBtn.addEventListener('click', async function () {
            await addOutfitGroup();
        });
    }
}

function bindListEvents() {
    ['list-chars', 'list-actions', 'list-env', 'list-outfit'].forEach(function (id) {
        const list = document.getElementById(id);
        if (!list) {
            return;
        }
        list.addEventListener('click', async function (event) {
            const btn = event.target.closest('button');
            if (!btn) {
                return;
            }

            const action = btn.dataset.action;

            if (action === 'rename-group') {
                await renameCharGroup(btn.dataset.groupId, btn.dataset.groupTitle || '');
                return;
            }

            if (action === 'edit-tags') {
                await editCharGroupTags(btn.dataset.groupId);
                return;
            }

            if (action === 'delete-group') {
                await deleteCharGroup(btn.dataset.groupId, btn.dataset.groupTitle || '');
                return;
            }

            if (action === 'rename-outfit-group') {
                await renameOutfitGroup(btn.dataset.groupId, btn.dataset.groupTitle || '');
                return;
            }

            if (action === 'delete-outfit-group') {
                await deleteOutfitGroup(btn.dataset.groupId, btn.dataset.groupTitle || '');
                return;
            }

            if (action === 'add-item-start') {
                addState = { tabId: btn.dataset.tabId, groupId: btn.dataset.groupId };
                editState = null;
                renderTab(btn.dataset.tabId);
                return;
            }

            if (action === 'add-outfit-item-start') {
                addState = { tabId: 'outfit', groupId: btn.dataset.groupId, categoryKey: btn.dataset.categoryKey || '' };
                editState = null;
                renderTab('outfit');
                return;
            }

            const itemNode = btn.closest('.prompt-item');
            if (!itemNode) {
                if (action === 'add-item-cancel') {
                    const formNode = btn.closest('[data-inline-form="add"]');
                    const tabId = formNode ? formNode.dataset.tabId : activeTab;
                    addState = null;
                    renderTab(tabId);
                    return;
                }

                if (action === 'add-item-save') {
                    const formNode = btn.closest('[data-inline-form="add"]');
                    if (!formNode) {
                        return;
                    }
                    await saveInlineAddedItem(formNode);
                    return;
                }

                return;
            }

            if (action === 'copy') {
                copyPrompt(btn.dataset.prompt || '');
                return;
            }

            if (action === 'preview') {
                if (editState && editState.tabId === itemNode.dataset.tabId && editState.groupId === itemNode.dataset.groupId && editState.itemId === itemNode.dataset.itemId) {
                    return;
                }
                const box = itemNode.querySelector('.preview-box');
                box.classList.toggle('active');
                return;
            }

            if (action === 'edit') {
                const tabId = itemNode.dataset.tabId;
                const groupId = itemNode.dataset.groupId;
                const itemId = itemNode.dataset.itemId;
                const categoryKey = itemNode.dataset.categoryKey || '';
                startEdit(tabId, groupId, itemId, categoryKey);
                return;
            }

            if (action === 'edit-inline-cancel') {
                editState = null;
                renderTab(itemNode.dataset.tabId);
                return;
            }

            if (action === 'edit-inline-save') {
                const formNode = btn.closest('[data-inline-form="edit"]');
                if (!formNode) {
                    return;
                }
                await saveInlineEditedItem(itemNode, formNode);
                return;
            }

            if (action === 'delete') {
                const tabId = itemNode.dataset.tabId;
                const groupId = itemNode.dataset.groupId;
                const itemId = itemNode.dataset.itemId;
                const categoryKey = itemNode.dataset.categoryKey || '';
                const itemName = btn.dataset.itemName || '该条目';
                if (tabId === 'outfit') {
                    await deleteOutfitItem(groupId, categoryKey, itemId, itemName);
                } else {
                    await deleteItem(tabId, groupId, itemId, itemName);
                }
            }
        });
    });
}

function bindTagFilterEvents() {
    if (!charTagFilters) {
        if (!outfitCategoryFilters) {
            return;
        }
    }

    if (charTagFilters) {
        charTagFilters.addEventListener('click', function (event) {
            const toggleBtn = event.target.closest('button[data-action="filter-tag-toggle"]');
            if (toggleBtn) {
                activeCharTagMode = activeCharTagMode === 'and' ? 'or' : 'and';
                renderCharTagFilters();
                renderTab('chars');
                return;
            }

            const clearBtn = event.target.closest('button[data-action="filter-tag-clear"]');
            if (clearBtn) {
                activeCharTags = [];
                renderCharTagFilters();
                renderTab('chars');
                return;
            }

            const tagBtn = event.target.closest('button[data-action="filter-tag"]');
            if (!tagBtn) {
                return;
            }

            const nextTag = tagBtn.dataset.tag || '';
            if (!nextTag) {
                return;
            }

            const existingIndex = activeCharTags.indexOf(nextTag);
            if (existingIndex > -1) {
                activeCharTags.splice(existingIndex, 1);
            } else {
                activeCharTags.push(nextTag);
            }
            renderCharTagFilters();
            renderTab('chars');
        });
    }

    if (outfitCategoryFilters) {
        outfitCategoryFilters.addEventListener('click', function (event) {
            const btn = event.target.closest('button[data-action="filter-outfit-category"]');
            if (!btn) {
                return;
            }

            activeOutfitCategory = btn.dataset.category || '__all__';
            renderOutfitCategoryFilters();
            renderTab('outfit');
        });
    }
}

function bindCharSearchEvents() {
    if (!charNameSearch || !charNameSearchClear) {
        return;
    }

    charNameSearch.addEventListener('input', function () {
        activeCharKeyword = charNameSearch.value.trim().toLowerCase();
        renderTab('chars');
    });

    charNameSearchClear.addEventListener('click', function () {
        charNameSearch.value = '';
        activeCharKeyword = '';
        renderTab('chars');
    });
}
