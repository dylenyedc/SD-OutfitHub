function renderAllTabs() {
    renderCharTagFilters();
    renderTab('chars');
    renderTab('actions');
    renderTab('env');
}

function renderTab(tabId) {
    const listNode = document.getElementById('list-' + tabId);
    const groups = promptData[tabId] || [];
    const visibleGroups = tabId === 'chars' ? getVisibleCharGroups(groups) : groups;

    listNode.innerHTML = visibleGroups.map(group => {
        const itemsHtml = group.items.map(item => {
            const isEditing = !!editState && editState.tabId === tabId && editState.groupId === group.id && editState.itemId === item.id;
            const previewHtml = isEditing
                ? '<div class="preview-box active"><div class="inline-item-form" data-inline-form="edit"><input class="inline-item-name" type="text" value="' + escapeAttr(item.name) + '" placeholder="条目名称" /><textarea class="inline-item-prompt" placeholder="提示词内容">' + escapeHtml(item.prompt) + '</textarea><div class="form-actions"><button class="copy-btn" data-action="edit-inline-save">保存</button><button class="copy-btn secondary-btn" data-action="edit-inline-cancel">取消</button></div></div></div>'
                : '<div class="preview-box">' + escapeHtml(item.prompt) + '</div>';

            return '\n                        <div class="prompt-item" data-item-id="' + item.id + '" data-group-id="' + group.id + '" data-tab-id="' + tabId + '">\n                            <div class="prompt-main">\n                                <span class="prompt-name">' + escapeHtml(item.name) + '</span>\n                                <div class="prompt-actions">\n                                    <button class="copy-btn" data-action="copy" data-prompt="' + escapeAttr(item.prompt) + '">复制</button>\n                                    <button class="copy-btn secondary-btn" data-action="edit">编辑</button>\n                                    <button class="copy-btn secondary-btn" data-action="preview">预览</button>\n                                    <button class="copy-btn danger-btn" data-action="delete" data-item-name="' + escapeAttr(item.name) + '">删除</button>\n                                </div>\n                            </div>\n                            ' + previewHtml + '\n                        </div>\n                    ';
        }).join('');

        const content = itemsHtml || '<div class="hint-text">当前分组还没有提示词，使用上方表单新增。</div>';
        const commonAddBtn = '<button class="copy-btn" data-action="add-item-start" data-tab-id="' + tabId + '" data-group-id="' + group.id + '">新增提示词</button>';
        const groupManageBtns = tabId === 'chars'
            ? '<button class="copy-btn secondary-btn" data-action="edit-tags" data-group-id="' + group.id + '">编辑标签</button><button class="copy-btn secondary-btn" data-action="rename-group" data-group-id="' + group.id + '" data-group-title="' + escapeAttr(group.title) + '">编辑角色名</button><button class="copy-btn danger-btn" data-action="delete-group" data-group-id="' + group.id + '" data-group-title="' + escapeAttr(group.title) + '">删除角色</button>'
            : '';
        const groupActionHtml = '<div class="group-actions">' + commonAddBtn + groupManageBtns + '</div>';
        const addFormHtml = (addState && addState.tabId === tabId && addState.groupId === group.id)
            ? '<div class="inline-item-form" data-inline-form="add" data-tab-id="' + tabId + '" data-group-id="' + group.id + '"><input class="inline-item-name" type="text" placeholder="输入条目名称" /><textarea class="inline-item-prompt" placeholder="输入完整提示词"></textarea><div class="form-actions"><button class="copy-btn" data-action="add-item-save">保存新增</button><button class="copy-btn secondary-btn" data-action="add-item-cancel">取消</button></div></div>'
            : '';
        const tagsHtml = tabId === 'chars' ? renderCardTags(group.tags || []) : '';

        return '\n                    <div class="card">\n                        <div class="card-header">\n                            <div class="card-title">' + escapeHtml(group.title) + '</div>\n                            ' + groupActionHtml + '\n                        </div>\n                        ' + tagsHtml + '\n                        ' + content + '\n                        ' + addFormHtml + '\n                    </div>\n                ';
    }).join('');

    if (!groups.length) {
        listNode.innerHTML = '<div class="card"><div class="hint-text">当前菜单暂无分组，请先新增分组。</div></div>';
        return;
    }

    if (tabId === 'chars' && !visibleGroups.length) {
        listNode.innerHTML = '<div class="card"><div class="hint-text">当前筛选条件下没有角色，试试清空关键词或切换标签。</div></div>';
    }
}

function renderCharTagFilters() {
    if (!charTagFilters) {
        return;
    }

    const tags = collectCharTags();
    const allBtn = '<button class="tag-chip' + (activeCharTag === '__all__' ? ' active' : '') + '" data-action="filter-tag" data-tag="__all__">全部</button>';
    const tagBtns = tags.map(function (tag) {
        const isActive = tag === activeCharTag;
        return '<button class="tag-chip' + (isActive ? ' active' : '') + '" data-action="filter-tag" data-tag="' + escapeAttr(tag) + '">' + escapeHtml(tag) + '</button>';
    }).join('');

    charTagFilters.innerHTML = allBtn + tagBtns;
    if (!tags.length) {
        charTagFilters.innerHTML = allBtn + '<span class="tag-empty">暂无标签</span>';
    }
}

function collectCharTags() {
    const groups = promptData.chars || [];
    const tagSet = new Set();
    groups.forEach(function (group) {
        (group.tags || []).forEach(function (tag) {
            if (tag) {
                tagSet.add(tag);
            }
        });
    });
    return Array.from(tagSet);
}

function getVisibleCharGroups(groups) {
    return groups.filter(function (group) {
        const passTag = activeCharTag === '__all__' || (group.tags || []).indexOf(activeCharTag) > -1;
        const passKeyword = !activeCharKeyword || String(group.title || '').toLowerCase().indexOf(activeCharKeyword) > -1;
        return passTag && passKeyword;
    });
}

function renderCardTags(tags) {
    if (!tags.length) {
        return '<div class="hint-text" style="margin-bottom: 12px;">标签：未设置</div>';
    }

    const chips = tags.map(function (tag) {
        return '<span class="card-tag">' + escapeHtml(tag) + '</span>';
    }).join('');
    return '<div class="card-tags">' + chips + '</div>';
}

function switchToTab(tabId, element) {
    document.querySelectorAll('.container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    document.getElementById('tab-' + tabId).classList.add('active');

    if (element) {
        element.classList.add('active');
    } else {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(function (item) {
            const tabText = item.textContent || '';
            if ((tabId === 'chars' && tabText.indexOf('人物') > -1) ||
                (tabId === 'actions' && tabText.indexOf('动作') > -1) ||
                (tabId === 'env' && tabText.indexOf('环境质量') > -1)) {
                item.classList.add('active');
            }
        });
    }

    window.scrollTo(0, 0);
}
