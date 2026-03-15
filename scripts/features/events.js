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
}

function bindListEvents() {
    ['list-chars', 'list-actions', 'list-env'].forEach(function (id) {
        const list = document.getElementById(id);
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

            if (action === 'add-item-start') {
                addState = { tabId: btn.dataset.tabId, groupId: btn.dataset.groupId };
                editState = null;
                renderTab(btn.dataset.tabId);
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
                startEdit(tabId, groupId, itemId);
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
                const itemName = btn.dataset.itemName || '该条目';
                deleteItem(tabId, groupId, itemId, itemName);
            }
        });
    });
}

function bindTagFilterEvents() {
    if (!charTagFilters) {
        return;
    }

    charTagFilters.addEventListener('click', function (event) {
        const btn = event.target.closest('button[data-action="filter-tag"]');
        if (!btn) {
            return;
        }

        activeCharTag = btn.dataset.tag || '__all__';
        renderCharTagFilters();
        renderTab('chars');
    });
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
