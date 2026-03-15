function newId() {
    return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
}

function deepClone(data) {
    return JSON.parse(JSON.stringify(data));
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(text) {
    return escapeHtml(text).replace(/\n/g, '&#10;');
}

function parseTags(text) {
    const parts = String(text || '').split(',').map(function (item) {
        return item.trim();
    }).filter(function (item) {
        return !!item;
    });

    const uniq = [];
    const seen = new Set();
    parts.forEach(function (tag) {
        if (!seen.has(tag)) {
            seen.add(tag);
            uniq.push(tag);
        }
    });
    return uniq;
}
