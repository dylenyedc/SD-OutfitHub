async function init() {
    promptData = await loadPromptData();
    renderAllTabs();
    bindListEvents();
    bindGroupEvents();
    bindCharSearchEvents();
    bindTagFilterEvents();
}

window.switchTab = switchTab;

init();
