const defaultPromptData = {
    chars: [
        {
            id: 'cyber-girl',
            title: '👨‍🎤 赛博朋克女孩 (Cyber Girl)',
            description: '1girl, solo, cyberpunk style, neon lights, short silver hair, glowing visor, high detail, masterpiece',
            items: []
        },
        {
            id: 'fantasy-mage',
            title: '🧙‍♂️ 奇幻法师 (Fantasy Mage)',
            description: '1boy, male mage, fantasy illustration, glowing staff, arcane aura, dramatic lighting, ultra detailed',
            items: []
        }
    ],
    actions: [
        {
            id: 'action-basic',
            title: '🏃‍♂️ 动态与姿势',
            items: [
                { id: 'ab-1', name: '拔剑姿势', prompt: 'dynamic pose, drawing sword, leaning forward, looking at viewer, intense action' },
                { id: 'ab-2', name: '漂浮半空', prompt: 'floating in the air, weightless, zero gravity, hair blowing in the wind, magical pose' },
                { id: 'ab-3', name: '回眸一笑', prompt: 'looking back over shoulder, gentle smile, eye contact, cinematic angle' }
            ]
        }
    ],
    env: [
        {
            id: 'env-light',
            title: '🌄 环境与光影',
            items: [
                { id: 'el-1', name: '废弃城市落日', prompt: 'ruined city, overgrown with plants, sunset, golden hour, god rays, atmospheric lighting' },
                { id: 'el-2', name: '魔法森林起雾', prompt: 'magical forest, glowing mushrooms, dense fog, mystical atmosphere, fireflies' }
            ]
        },
        {
            id: 'env-quality',
            title: '💎 画质提升词',
            items: [
                { id: 'eq-1', name: '通用高画质', prompt: 'masterpiece, best quality, ultra-detailed, 8k resolution, finely detailed, photorealistic' },
                { id: 'eq-2', name: '二次元质感', prompt: 'anime visual novel style, studio ghibli, vivid colors, clear lines, high contrast' }
            ]
        }
    ],
    outfit: [
        {
            id: 'outfit-test-1',
            title: '星穹巡礼礼装',
            part: '套装',
            style: '轻奢幻想',
            sourceCharacter: '塞拉',
            safety: 'SFW',
            other: '披风,金线刺绣',
            prompt: 'full body, fantasy ceremonial outfit, white and gold layered dress, cape, detailed embroidery, cinematic lighting, masterpiece'
        },
        {
            id: 'outfit-test-2',
            title: '夜行战术外套',
            part: '上衣',
            style: '机能街头',
            sourceCharacter: '无',
            safety: 'NSFW',
            other: '短款,束带,皮革拼接',
            prompt: 'single upper-body outfit, black tactical cropped jacket, belts and straps, glossy leather panels, cyberpunk neon, ultra detailed'
        }
    ]
};

const TAB_KEYS = ['chars', 'actions', 'env', 'outfit'];
const OUTFIT_PART_OPTIONS = ['套装', '上衣', '下装', '鞋子', '头饰', '配件', '武器', '其他', '未知'];

let promptData = JSON.parse(JSON.stringify(defaultPromptData));
let activeTab = 'chars';
let editState = null;
let addState = null;
let activeCharTagEditor = null;
let activeCharTags = [];
let activeCharTagMode = 'or';
let activeCharKeyword = '';
let isReadOnlyMode = false;
let isAdminUser = false;
let currentUserId = '';
let currentUsername = '';
let currentNickname = '';
let toastTimeout;

const charGroupTitleInput = document.getElementById('char-group-title-input');
const charGroupAddBtn = document.getElementById('char-group-add-btn');
const outfitGroupTitleInput = document.getElementById('outfit-group-title-input');
const outfitGroupAddBtn = document.getElementById('outfit-group-add-btn');
const outfitPartInput = document.getElementById('outfit-part-input');
const outfitStyleInput = document.getElementById('outfit-style-input');
const outfitSourceCharacterInput = document.getElementById('outfit-source-character-input');
const outfitSafetyInput = document.getElementById('outfit-safety-input');
const outfitOtherInput = document.getElementById('outfit-other-input');
const outfitPromptInput = document.getElementById('outfit-prompt-input');
const charTagFilters = document.getElementById('char-tag-filters');
const charNameSearch = document.getElementById('char-name-search');
const charNameSearchClear = document.getElementById('char-name-search-clear');
