const ACCESS_TOKEN_KEY = 'sd_access_token';
const REFRESH_TOKEN_KEY = 'sd_refresh_token';

function setReadOnlyMode(nextReadOnly) {
    isReadOnlyMode = !!nextReadOnly;
    if (typeof window.updateReadOnlyUI === 'function') {
        window.updateReadOnlyUI();
    }
}

function createEmptyPromptData() {
    return {
        chars: [],
        actions: [],
        env: [],
        outfit: []
    };
}

function getAuthTokens() {
    return {
        accessToken: localStorage.getItem(ACCESS_TOKEN_KEY) || '',
        refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) || ''
    };
}

function hasAuthSession() {
    const tokens = getAuthTokens();
    return !!tokens.accessToken;
}

function setAuthTokens(accessToken, refreshToken) {
    if (accessToken) {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
}

function clearAuthTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function tryRefreshAccessToken() {
    const tokens = getAuthTokens();
    if (!tokens.refreshToken) {
        return false;
    }

    const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: tokens.refreshToken })
    });

    if (!response.ok) {
        clearAuthTokens();
        return false;
    }

    const result = await response.json();
    if (!result || !result.accessToken || !result.refreshToken) {
        clearAuthTokens();
        return false;
    }

    setAuthTokens(result.accessToken, result.refreshToken);
    return true;
}

function consumeAuthTokensFromUrlHash() {
    const hash = String(window.location.hash || '');
    if (!hash || hash.length < 2) {
        return false;
    }

    const hashText = hash.startsWith('#') ? hash.slice(1) : hash;
    const params = new URLSearchParams(hashText);
    const accessToken = params.get('access_token') || '';
    const refreshToken = params.get('refresh_token') || '';
    if (!accessToken || !refreshToken) {
        return false;
    }

    setAuthTokens(accessToken, refreshToken);
    if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return true;
}

function authLoginWithGitHub(redirectPath) {
    const target = String(redirectPath || '/').trim() || '/';
    const safe = target.startsWith('/') ? target : '/';
    window.location.href = '/api/auth/github/start?redirect=' + encodeURIComponent(safe);
}

async function apiFetch(url, options, allowRefresh) {
    const requestOptions = options ? deepClone(options) : {};
    requestOptions.headers = requestOptions.headers || {};
    const tokens = getAuthTokens();
    if (tokens.accessToken) {
        requestOptions.headers.Authorization = 'Bearer ' + tokens.accessToken;
    }

    const response = await fetch(url, requestOptions);
    if (response.status === 401 && allowRefresh !== false) {
        const refreshed = await tryRefreshAccessToken();
        if (refreshed) {
            return apiFetch(url, options, false);
        }
    }

    return response;
}

function authLogout() {
    clearAuthTokens();
}

async function loadPromptData() {
    try {
        const response = await apiFetch('/api/prompts', {
            method: 'GET'
        });
        if (!response.ok) {
            if (response.status === 401) {
                clearAuthTokens();
                setReadOnlyMode(true);
                throw new Error('未登录或登录已过期');
            }
            throw new Error('数据读取失败: ' + response.status);
        }
        const readOnlyHeader = response.headers.get('X-Read-Only');
        const readOnlyByServer = readOnlyHeader === '1';
        setReadOnlyMode(readOnlyByServer || !hasAuthSession());
        const data = await response.json();
        if (!data || typeof data !== 'object') {
            throw new Error('数据格式无效');
        }
        return normalizePromptData(data);
    } catch (e) {
        console.warn('读取服务端数据失败，使用空数据', e);
        showToast('数据读取失败，请先登录或检查服务状态');
    }
    return normalizePromptData(createEmptyPromptData());
}

async function mutatePromptData(action, payload) {
    if (isReadOnlyMode || !hasAuthSession()) {
        showToast('当前为只读模式，请先使用 GitHub 登录后再修改');
        return Promise.resolve({ ok: false, message: '当前为只读模式' });
    }

    try {
        const response = await apiFetch('/api/prompts/mutate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: action, payload: payload || {} })
        });

        let result = null;
        try {
            result = await response.json();
        } catch (_) {
            result = null;
        }

        if (!response.ok) {
            if (response.status === 401) {
                clearAuthTokens();
                setReadOnlyMode(true);
            }
            const message = result && result.message ? result.message : '操作失败';
            showToast(message);
            return { ok: false, message: message };
        }

        if (result && result.data) {
            promptData = normalizePromptData(result.data);
        }

        return {
            ok: true,
            message: result && result.message ? result.message : '操作成功'
        };
    } catch (e) {
        console.error('请求后端变更失败', e);
        showToast('请求失败，请检查服务器状态');
        return { ok: false, message: '请求失败' };
    }
}

async function downloadPromptDataExport() {
    try {
        const response = await apiFetch('/api/prompts/export', {
            method: 'GET'
        });

        if (!response.ok) {
            if (response.status === 401) {
                clearAuthTokens();
                setReadOnlyMode(true);
            }
            showToast('导出失败，请稍后重试');
            return false;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'prompt-data.json';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
        showToast('已开始下载 prompt-data.json');
        return true;
    } catch (error) {
        console.error('下载导出失败', error);
        showToast('下载失败，请检查服务状态');
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

    ['chars', 'actions', 'env'].forEach(function (tabKey) {
        normalized[tabKey] = normalized[tabKey].map(function (group) {
            const nextGroup = group && typeof group === 'object' ? deepClone(group) : { id: newId(), title: '未命名分组', items: [] };
            if (!Array.isArray(nextGroup.items)) {
                nextGroup.items = [];
            }
            return nextGroup;
        });
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

    normalized.outfit = normalized.outfit.map(function (group) {
        const nextGroup = group && typeof group === 'object'
            ? deepClone(group)
            : { id: newId(), title: '未命名风格', tops: [], bottoms: [], shoes: [] };

        OUTFIT_CATEGORY_KEYS.forEach(function (categoryKey) {
            if (!Array.isArray(nextGroup[categoryKey])) {
                nextGroup[categoryKey] = [];
            }
        });

        return nextGroup;
    });

    return normalized;
}
