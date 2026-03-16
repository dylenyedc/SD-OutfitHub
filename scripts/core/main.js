async function init() {
    consumeAuthTokensFromUrlHash();
    initAuthUI();
    promptData = await loadPromptData();
    renderAllTabs();
    bindListEvents();
    bindGroupEvents();
    bindCharSearchEvents();
    bindTagFilterEvents();
    bindCharSettingsModalEvents();
    initSidebarNavigation();
    updateReadOnlyUI();

    if (isReadOnlyMode) {
        showToast('当前为只读模式，登录后可修改数据');
    }
}

function initAuthUI() {
    const status = document.getElementById('auth-status-text');
    const loginBtn = document.getElementById('github-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const exportBtn = document.getElementById('export-prompts-btn');
    const updateStatus = function () {
        if (!status) {
            return;
        }
        if (hasAuthSession() && !isReadOnlyMode) {
            status.textContent = '当前已登录（GitHub，可编辑）';
            return;
        }
        status.textContent = '当前未登录（只读模式）';
    };

    updateStatus();

    if (loginBtn) {
        loginBtn.addEventListener('click', function () {
            authLoginWithGitHub(window.location.pathname || '/');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            authLogout();
            if (typeof setReadOnlyMode === 'function') {
                setReadOnlyMode(true);
            }
            updateStatus();
            showToast('已退出登录');
            window.location.reload();
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', async function () {
            await downloadPromptDataExport();
        });
    }

    window.updateReadOnlyUI = function () {
        const tip = document.getElementById('readonly-mode-tip');
        if (tip) {
            tip.textContent = isReadOnlyMode
                ? '当前为只读模式：可浏览数据，登录后才能新增、编辑、删除。'
                : '当前为编辑模式：你可以新增、编辑、删除自己的数据。';
        }

        document.body.classList.toggle('is-readonly-mode', isReadOnlyMode);

        [
            'char-group-title-input',
            'char-group-add-btn',
            'outfit-group-title-input',
            'outfit-group-add-btn',
            'char-settings-edit-tags-btn',
            'char-settings-rename-btn',
            'char-settings-delete-btn',
            'char-settings-editor-input',
            'char-settings-editor-textarea',
            'char-settings-editor-save-btn'
        ].forEach(function (id) {
            const node = document.getElementById(id);
            if (node) {
                node.disabled = !!isReadOnlyMode;
            }
        });

        updateStatus();
    };
}

function initSidebarNavigation() {
    const sidebar = document.getElementById('left-sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const mask = document.getElementById('sidebar-mask');
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    const pages = {
        prompts: document.getElementById('app-page-prompts'),
        community: document.getElementById('app-page-community'),
        profile: document.getElementById('app-page-profile')
    };

    if (!sidebar || !toggleBtn || !mask || !navItems.length) {
        return;
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        mask.classList.remove('active');
    }

    function toggleSidebar() {
        const willOpen = !sidebar.classList.contains('open');
        sidebar.classList.toggle('open', willOpen);
        mask.classList.toggle('active', willOpen);
    }

    function setPage(pageKey) {
        Object.keys(pages).forEach(function (key) {
            const page = pages[key];
            if (!page) {
                return;
            }
            page.classList.toggle('active', key === pageKey);
        });

        navItems.forEach(function (item) {
            item.classList.toggle('active', item.dataset.page === pageKey);
        });

        closeSidebar();
        window.scrollTo(0, 0);
    }

    toggleBtn.addEventListener('click', toggleSidebar);
    mask.addEventListener('click', closeSidebar);

    navItems.forEach(function (item) {
        item.addEventListener('click', function () {
            const pageKey = item.dataset.page || 'prompts';
            setPage(pageKey);
        });
    });
}

window.switchTab = switchTab;

init();
