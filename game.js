// --- 1. Save Data System ---
let saveData = JSON.parse(localStorage.getItem('shadowSaveV8')) || {
    topWave: 1, gold: 0, 
    checkpointWave: 1, 
    unlockedBosses: [], 
    unlockedHeroes: ['🤖'], 
    selectedShadowBosses: [], 
    friends: [], 
    stats: { atk: 1, dash: 1, shield: 1, spell: 1, shadow: 1, maxShadows: 1, pSpeed: 1, pHp: 1, sSpeed: 1, sDmg: 1, sHp: 1, spellDur: 1, shieldDur: 1 }
};

if (!saveData.friends) saveData.friends = [];
if (!saveData.savedColor) saveData.savedColor = '#ffffff';
if (!saveData.savedTeam) saveData.savedTeam = '#000000';
if (!saveData.savedHeroEmoji) saveData.savedHeroEmoji = '🤖';
if (!saveData.savedHeroName) saveData.savedHeroName = 'Robot';
if (saveData.savedName === undefined) saveData.savedName = '';

const statConfig = {
    atk: { name: "Attack Damage", base: 40, step: 6 },
    dash: { name: "Dash CD", base: 180, step: -3 },
    shield: { name: "Shield CD", base: 400, step: -6 },
    spell: { name: "Spell CD", base: 600, step: -8 },     
    shadow: { name: "Shadow CD", base: 3600, step: -50 },
    maxShadows: { name: "Max Shadow Output", base: 1, step: 1 },
    pSpeed: { name: "Player Speed", base: 7, step: 0.2 },
    pHp: { name: "Player Health", base: 1000, step: 100 },
    sSpeed: { name: "Shadow Speed", base: 6, step: 0.3 },
    sDmg: { name: "Shadow Damage", base: 180, step: 30 },
    sHp: { name: "Shadow Health", base: 3000, step: 400 },
    spellDur: { name: "Spell Duration", base: 1, step: 0.1 },
    shieldDur: { name: "Shield Duration", base: 150, step: 15 } 
};

const bossMeta = {
    '👹': { name: "Vampire Overlord", wave: 5 },
    '🔮': { name: "Void Archmage", wave: 10 },
    '⚡': { name: "Abyss Knight", wave: 15 },
    '👾': { name: "Slime Core", wave: 20 },
    '💣': { name: "Mad Bomber", wave: 25 },
    '👻': { name: "Phantom Lord", wave: 30 },
    '😈': { name: "Doom Bringer", wave: 35 }
};

const enemyTypes = ['💀', '🧟', '🧛', '🐺', '🕷️', '🦂', '🦇', '🐍', '🐊', '🦍'];

const heroShopConfig = [
    { emoji: '🤖', name: 'Robot', spell: 'None', cost: 1000 },
    { emoji: '💀', name: 'Skeleton', spell: 'None', cost: 2000 },
    { emoji: '👻', name: 'Ghost', spell: 'None', cost: 3000 },
    { emoji: '🧟', name: 'Zombie', spell: 'None', cost: 4000 },
    { emoji: '👺', name: 'Tengu', spell: 'None', cost: 5000 },
    { emoji: '👹', name: 'Oni', spell: 'None', cost: 6000 },
    { emoji: '🧛‍♂️', name: 'Vampire', spell: 'Aura Drain', cost: 10000 },
    { emoji: '🦁', name: 'Lion', spell: 'Roar Buff', cost: 20000 },
    { emoji: '🥷', name: 'Ninja', spell: 'Shuriken', cost: 30000 },
    { emoji: '🧙‍♂️', name: 'Wizard', spell: 'Magic Buff', cost: 40000 }
];

function getStatValue(key) { return statConfig[key].base + (statConfig[key].step * (saveData.stats[key] - 1)); }
function getStatCost(key, lvl) {
    if (key === 'maxShadows') return 10000 * Math.pow(3, lvl - 1);
    return Math.floor(100 * Math.pow(1.5, lvl - 1));
}

function saveGame() {
    localStorage.setItem('shadowSaveV8', JSON.stringify(saveData));
    updateMenuUI();
    updateFriendsUI();
}

function updateMenuUI() {
    document.getElementById('lb-highwave').innerText = `🏆 Top Wave: ${saveData.topWave}`;
    document.getElementById('lb-gold').innerText = `🪙 Gold: ${saveData.gold}`;
    document.getElementById('ingame-gold').innerText = `🪙 ${saveData.gold}`;
}

// --- UTF-8 Emoji Safe Helper (စာမကွဲအောင်) ---
function safeEncode(str) { try { return encodeURIComponent(str || ""); } catch(e) { return str; } }
function safeDecode(str) { try { return decodeURIComponent(str || ""); } catch(e) { return str; } }

// --- 2. PeerJS Stable Networking & Friends (Hotspot/LAN Support) ---
let mainPeer = null, myClientId = "", pendingInviteId = null;
let connections = [];
let isHost = false, lobbyPlayers = [], remotePlayers = {}; 
let isOnlineMode = false;
let isHotspotLANMode = false;

function initMainNetworking(useHotspotLAN = false) {
    if (mainPeer) mainPeer.destroy();
    isHotspotLANMode = useHotspotLAN;
    
    // Hotspot / Same Wi-Fi ဖြစ်ရင် STUN/TURN server မစောင့်ဘဲ LAN Direct ချိတ်နိုင်ရန် Config
    const peerOptions = useHotspotLAN ? { config: { 'iceServers': [] } } : undefined;
    mainPeer = new Peer(undefined, peerOptions);

    mainPeer.on('open', (id) => {
        myClientId = id;
        document.getElementById('my-acc-id').innerText = id + (useHotspotLAN ? " (LAN/Hotspot)" : "");
        updateFriendsUI();
        checkFriendStatusOnline();
    });

    mainPeer.on('connection', (conn) => {
        conn.on('data', (data) => {
            if (data.type === 'ping') {
                conn.send({ type: 'pong', name: safeEncode(saveData.savedName), emoji: safeEncode(saveData.savedHeroEmoji) });
            }
            else if (data.type === 'game_invite') {
                pendingInviteId = data.hostId;
                document.getElementById('invite-msg-txt').innerText = `${safeDecode(data.hostName)} invited you!`;
                document.getElementById('invite-toast').style.display = 'block';
            }
            else if (data.type === 'update_settings') {
                if (isHost) {
                    if (!connections.find(c => c.peer === conn.peer)) connections.push(conn);
                    addLobbyPlayer(data.id, safeDecode(data.name), safeDecode(data.emoji), data.color, data.team, false);
                    broadcast({ type: 'lobby_update', players: lobbyPlayers });
                }
            }
            else if (data.type === 'client_update' && gameState === 'PLAYING') {
                if (isHost) {
                    // Host က Client ရဲ့ Position/Input ကိုပဲ ယူပြီး HP/Dead State ကို Authoritative အနေနဲ့ ထိန်းသည်
                    let decodedName = safeDecode(data.playerState.name);
                    let decodedEmoji = safeDecode(data.playerState.emoji);
                    if (!remotePlayers[data.id]) {
                        remotePlayers[data.id] = { ...data.playerState, name: decodedName, emoji: decodedEmoji, hp: getStatValue('pHp'), maxHp: getStatValue('pHp'), isDead: false, lives: 5 };
                    } else {
                        remotePlayers[data.id].x = data.playerState.x;
                        remotePlayers[data.id].y = data.playerState.y;
                        remotePlayers[data.id].vx = data.playerState.vx;
                        remotePlayers[data.id].vy = data.playerState.vy;
                        remotePlayers[data.id].isMoving = data.playerState.isMoving;
                        remotePlayers[data.id].isShielded = data.playerState.isShielded;
                        remotePlayers[data.id].name = decodedName;
                        remotePlayers[data.id].emoji = decodedEmoji;
                        remotePlayers[data.id].color = data.playerState.color;
                        remotePlayers[data.id].team = data.playerState.team;
                        remotePlayers[data.id].lastAtkFrame = data.playerState.lastAtkFrame;
                    }
                }
            }
            // --- Client တိုက်ခိုက်မှု (Attack/Spell) များကို Host က ထိန်းချုပ်ပေးခြင်း ---
            else if (data.type === 'client_attack' && isHost && remotePlayers[data.id]) {
                let clientP = remotePlayers[data.id];
                handleLocalAttacks(clientP, data.dmg);
            }
            else if (data.type === 'client_spell' && isHost && remotePlayers[data.id]) {
                let clientP = remotePlayers[data.id];
                let em = safeDecode(data.emoji);
                let dirX = clientP.vx || 1, dirY = clientP.vy || 0;
                if(['🤖','💀','👻','🧟','👺','👹'].includes(em)) {
                    spells.push({ x: clientP.x, y: clientP.y, vx: dirX * 18, vy: dirY * 18, life: 100, color: clientP.color, isPlayerSpell: true, dmg: 65 + data.atk });
                } else if (em === '🥷') {
                    for(let a=0; a<Math.PI*2; a+=Math.PI/4) { spells.push({ x: clientP.x, y: clientP.y, vx: Math.cos(a)*20, vy: Math.sin(a)*20, life: 50, color: '#94a3b8', isPlayerSpell: true, dmg: 50 + data.atk }); }
                }
            }
            else if (data.type === 'client_summon' && isHost && remotePlayers[data.id]) {
                let clientP = remotePlayers[data.id];
                (data.bosses || []).forEach(bEmoji => {
                    allyShadows.push({ x: clientP.x + (Math.random()*60-30), y: clientP.y + (Math.random()*60-30), emoji: safeDecode(bEmoji), hp: getStatValue('sHp'), maxHp: getStatValue('sHp'), speed: getStatValue('sSpeed'), dmg: getStatValue('sDmg'), lastSpellFrame: 0 });
                });
                createParticles(clientP.x, clientP.y, '#7c3aed', 50);
            }
        });
        
        conn.on('close', () => {
            if (isHost) {
                connections = connections.filter(c => c.peer !== conn.peer);
                lobbyPlayers = lobbyPlayers.filter(p => p.id !== conn.peer);
                broadcast({ type: 'lobby_update', players: lobbyPlayers });
                updateLobbyListUI();
                if(remotePlayers[conn.peer]) delete remotePlayers[conn.peer];
            }
        });
    });

    mainPeer.on('error', (err) => {
        console.error("Peer Error:", err);
        if (err.type === 'peer-unavailable') alert("Connection failed. ID not found or offline.");
    });
}

// Hotspot / Wi-Fi LAN Mode ကို ဖွင့်/ပိတ်ပေးမည့် Function
function toggleHotspotLANMode() {
    isHotspotLANMode = !isHotspotLANMode;
    initMainNetworking(isHotspotLANMode);
    alert(isHotspotLANMode ? "Hotspot/LAN Mode ON: လိုင်းမလိုဘဲ Hotspot / Wi-Fi တစ်ခုတည်းချိတ်ဆော့နိုင်ပါပြီ။" : "Online Mode Normal: အင်တာနက် ပုံမှန် Mode သို့ ပြောင်းလိုက်ပါပြီ။");
}

function copyMyId() {
    if(!myClientId) return;
    let dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    dummy.value = myClientId;
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
    alert("Account ID Copied!");
}

function openAddFriendModal() { showModal('add-friend-modal'); }

function confirmAddFriend() {
    let fId = document.getElementById('friend-id-input').value.trim();
    if (!fId || fId === myClientId) return alert("Invalid ID!");
    if (saveData.friends.some(f => f.id === fId)) return alert("Already added!");

    saveData.friends.push({ id: fId, name: "Friend", emoji: "🤖", online: false });
    saveGame();
    hideModal('add-friend-modal');
    document.getElementById('friend-id-input').value = "";
    checkFriendStatusOnline();
}

function checkFriendStatusOnline() {
    saveData.friends.forEach(f => {
        let c = mainPeer.connect(f.id);
        c.on('open', () => {
            f.online = true;
            c.send({ type: 'ping' });
            updateFriendsUI();
        });
        c.on('data', (data) => {
            if (data.type === 'pong') {
                f.name = safeDecode(data.name) || f.name;
                f.emoji = safeDecode(data.emoji) || f.emoji;
                updateFriendsUI();
            }
        });
        c.on('error', () => { f.online = false; updateFriendsUI(); });
    });
}

function updateFriendsUI() {
    const listContainer = document.getElementById('friend-list-ui');
    listContainer.innerHTML = '';
    document.getElementById('friend-count-txt').innerText = `(${saveData.friends.length})`;

    saveData.friends.forEach(f => {
        let card = document.createElement('div');
        card.className = 'friend-card';
        card.innerHTML = `
            <div class="friend-info">
                <div class="friend-avatar">${f.emoji}</div>
                <div>
                    <div class="friend-name">${f.name}</div>
                    <div style="font-size:0.65rem; color:#cbd5e1;">
                        <span class="status-dot ${f.online ? 'status-online' : 'status-offline'}"></span>
                        ${f.online ? 'Online' : 'Offline'}
                    </div>
                </div>
            </div>
            <button class="btn-invite" ${!f.online ? 'disabled' : ''} onclick="inviteFriend('${f.id}')">+</button>
        `;
        listContainer.appendChild(card);
    });
}

function inviteFriend(targetId) {
    if (!mainPeer) return;
    let conn = mainPeer.connect(targetId);
    conn.on('open', () => {
        conn.send({ type: 'game_invite', hostId: myClientId, hostName: safeEncode(saveData.savedName || "Player") });
        alert("Invite Sent!");
    });
}

function acceptGameInvite() {
    document.getElementById('invite-toast').style.display = 'none';
    if (!pendingInviteId) return;
    setupMultiplayerLobby(false);
    document.getElementById('join-code-input').value = pendingInviteId;
    joinRoomSubmit();
}
function declineGameInvite() { document.getElementById('invite-toast').style.display = 'none'; pendingInviteId = null; }

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('player-name').value = saveData.savedName;
    document.getElementById('disp-emoji').innerText = saveData.savedHeroEmoji;
    document.getElementById('disp-name').innerText = saveData.savedHeroName;
    document.getElementById('hud-emoji').innerText = saveData.savedHeroEmoji;
    initMainNetworking(false);
});

document.getElementById('player-name').addEventListener('input', (e) => { saveData.savedName = e.target.value; saveGame(); });
updateMenuUI();

function applyRedeemCode() {
    const code = document.getElementById('redeem-input').value;
    if (code === '!@#$12345678!@#$') {
        saveData.gold += 999999;
        Object.keys(saveData.stats).forEach(key => saveData.stats[key] = (key === 'maxShadows' ? 7 : 50));
        Object.keys(bossMeta).forEach(emoji => { if(!saveData.unlockedBosses.includes(emoji)) saveData.unlockedBosses.push(emoji); });
        heroShopConfig.forEach(h => { if(!saveData.unlockedHeroes.includes(h.emoji)) saveData.unlockedHeroes.push(h.emoji); });
        saveGame(); alert("Cheat Code Activated!");
    } else { alert("Invalid Code!"); }
}

function openStatsModal() {
    document.getElementById('modal-gold').innerText = `🪙 ${saveData.gold}`;
    const container = document.getElementById('stats-container'); container.innerHTML = '';
    Object.keys(saveData.stats).forEach(key => {
        let lvl = saveData.stats[key]; let maxLvl = key === 'maxShadows' ? 7 : 50; let cost = getStatCost(key, lvl);
        let row = document.createElement('div'); row.className = 'stat-row';
        row.innerHTML = `<div class="stat-info"><div class="stat-name">${statConfig[key].name} <span class="stat-lvl">(Lvl ${lvl}/${maxLvl})</span></div><div style="font-size: 11px; color: #cbd5e1;">🪙 ${lvl < maxLvl ? cost : 'MAX'}</div></div><button class="btn-upg" ${saveData.gold < cost || lvl >= maxLvl ? 'disabled' : ''} onclick="buyUpgrade('${key}', ${cost})">UPGRADE</button>`;
        container.appendChild(row);
    });

    document.getElementById('max-shadows-txt').innerText = saveData.stats.maxShadows;
    const indexList = document.getElementById('boss-index-list'); indexList.innerHTML = '';
    Object.keys(bossMeta).forEach(emoji => {
        const info = bossMeta[emoji]; const isUnlocked = saveData.unlockedBosses.includes(emoji); const isSelected = saveData.selectedShadowBosses.includes(emoji);
        const card = document.createElement('div'); card.className = `boss-index-card ${isUnlocked ? '' : 'locked'} ${isSelected ? 'selected' : ''}`;
        card.innerHTML = `<div style="font-size:24px;">${isUnlocked ? emoji : '🔒'}</div><div style="font-size:9px; margin-top:4px; font-weight:bold;">${info.name}</div>${isSelected ? '<div class="selection-badge">✓</div>' : ''}`;
        if (isUnlocked) {
            card.onclick = () => { 
                if (isSelected) saveData.selectedShadowBosses = saveData.selectedShadowBosses.filter(e => e !== emoji);
                else {
                    if (saveData.selectedShadowBosses.length < saveData.stats.maxShadows) saveData.selectedShadowBosses.push(emoji);
                    else { alert(`Max capacity reached! Upgrade Max Shadows stat.`); return; }
                }
                saveGame(); openStatsModal(); 
            };
        }
        indexList.appendChild(card);
    });
    showModal('stats-modal');
}

function buyUpgrade(key, cost) { let maxLvl = key === 'maxShadows' ? 7 : 50; if (saveData.gold >= cost && saveData.stats[key] < maxLvl) { saveData.gold -= cost; saveData.stats[key]++; saveGame(); openStatsModal(); } }

// --- 3. Customization & Hero Shop ---
const bodyColors = ['#ffffff', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
const teamColors = ['#000000', '#ef4444', '#3b82f6', '#10b981', '#facc15']; 
let playerColor = saveData.savedColor, playerTeamColor = saveData.savedTeam; 
let currentHero = { emoji: saveData.savedHeroEmoji, name: saveData.savedHeroName };
let myName = saveData.savedName || "Player";

function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

const colorGrid = document.getElementById('color-grid');
bodyColors.forEach(c => {
    let btn = document.createElement('div'); btn.className = 'color-btn'; btn.style.backgroundColor = c;
    if(c === playerColor) btn.classList.add('active');
    btn.onclick = () => { document.querySelectorAll('#color-grid .color-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); playerColor = c; saveData.savedColor = c; saveGame(); sendPlayerSettingsUpdate(); }; 
    colorGrid.appendChild(btn);
});
const teamGrid = document.getElementById('team-grid');
teamColors.forEach(t => {
    let btn = document.createElement('div'); btn.className = 'color-btn'; btn.style.backgroundColor = t;
    if (t === '#000000') btn.style.border = '2px dashed #94a3b8';
    if(t === playerTeamColor) btn.classList.add('active');
    btn.onclick = () => { document.querySelectorAll('#team-grid .color-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); playerTeamColor = t; saveData.savedTeam = t; saveGame(); sendPlayerSettingsUpdate(); }; 
    teamGrid.appendChild(btn);
});

function openHeroModal() {
    document.getElementById('shop-gold').innerText = `🪙 ${saveData.gold}`;
    const gridContainer = document.getElementById('hero-grid-container'); gridContainer.innerHTML = '';
    heroShopConfig.forEach(h => {
        const isUnlocked = saveData.unlockedHeroes.includes(h.emoji);
        let div = document.createElement('div'); div.className = 'hero-shop-item';
        div.innerHTML = `<div class="emoji">${h.emoji}</div><div style="font-weight:bold; font-size:0.85rem; margin-top:4px;">${h.name}</div><div style="font-size:0.7rem; color:#94a3b8;">${h.spell}</div>`;
        if (isUnlocked) {
            let btn = document.createElement('button'); btn.className = 'btn-equip'; btn.innerText = 'EQUIP';
            btn.onclick = () => {
                currentHero = { emoji: h.emoji, name: h.name }; saveData.savedHeroEmoji = h.emoji; saveData.savedHeroName = h.name; saveGame();
                document.getElementById('disp-emoji').innerText = h.emoji; document.getElementById('disp-name').innerText = h.name; document.getElementById('hud-emoji').innerText = h.emoji;
                hideModal('hero-modal'); sendPlayerSettingsUpdate();
            };
            div.appendChild(btn);
        } else {
            let p = document.createElement('div'); p.className = 'price'; p.innerText = `🪙 ${h.cost}`; div.appendChild(p);
            let btn = document.createElement('button'); btn.className = 'btn-buy'; btn.innerText = 'BUY';
            if (saveData.gold < h.cost) btn.disabled = true;
            btn.onclick = () => { if (saveData.gold >= h.cost) { saveData.gold -= h.cost; saveData.unlockedHeroes.push(h.emoji); saveGame(); openHeroModal(); } };
            div.appendChild(btn);
        }
        gridContainer.appendChild(div);
    });
    showModal('hero-modal');
}

// --- 4. Multiplayer Join/Host Logic ---
function setupMultiplayerLobby(asHost) {
    myName = document.getElementById('player-name').value.trim() || "Player";
    isHost = asHost;
    showModal('mp-lobby-modal');
    document.getElementById('mp-code-container').style.display = 'block';
    document.getElementById('join-input-container').style.display = 'none';
    
    if (asHost) {
        document.getElementById('mp-title').innerText = "Host Lobby" + (isHotspotLANMode ? " (LAN/Hotspot)" : "");
        document.getElementById('room-code-txt').innerText = myClientId; 
        document.getElementById('btn-start-mp').style.display = 'inline-block';
        lobbyPlayers = []; connections = []; 
        addLobbyPlayer(myClientId, myName, currentHero.emoji, playerColor, playerTeamColor, true);
    } else {
        document.getElementById('mp-title').innerText = "Join Room" + (isHotspotLANMode ? " (LAN/Hotspot)" : "");
        document.getElementById('mp-code-container').style.display = 'none';
        document.getElementById('join-input-container').style.display = 'block';
        document.getElementById('btn-start-mp').style.display = 'none';
    }
}

function joinRoomSubmit() {
    const code = document.getElementById('join-code-input').value.trim();
    if (!code) return;
    document.getElementById('room-code-txt').innerText = "Connecting...";
    document.getElementById('mp-code-container').style.display = 'block';
    
    let conn = mainPeer.connect(code, { reliable: true });
    
    conn.on('open', () => {
        document.getElementById('room-code-txt').innerText = "Connected!";
        connections = [conn];
        conn.send({ type: 'update_settings', id: myClientId, name: safeEncode(myName), emoji: safeEncode(currentHero.emoji), color: playerColor, team: playerTeamColor });
    });

    conn.on('data', (data) => {
        if (data.type === 'lobby_update') { lobbyPlayers = data.players; updateLobbyListUI(); }
        if (data.type === 'start_game') { startPlayingPhase(true); }
        if (data.type === 'sync_game_state') {
            enemies = data.enemies; spells = data.spells; particles = data.particles; allyShadows = data.allyShadows; hazards = data.hazards; wave = data.wave; waveState = data.waveState; frames = data.frames; remotePlayers = data.players;
            // Host ထံမှ ဆင်းလာသည့် Authoritative HP နှင့် Lives ကိုမှ Client က ယူသည်
            if (data.players[myClientId]) { 
                player.hp = data.players[myClientId].hp; 
                player.isDead = data.players[myClientId].isDead; 
                player.lives = data.players[myClientId].lives; 
                updateHPBar(); 
                updateLivesUI(); 
            }
        }
        if (data.type === 'float_text') addFloatText(data.text, data.x, data.y, data.color);
        if (data.type === 'end_game') showEndGame(data.status, data.color, data.sub);
    });
}

function addLobbyPlayer(id, name, emoji, color, team, hostFlag = false) {
    lobbyPlayers = lobbyPlayers.filter(p => p.id !== id);
    lobbyPlayers.push({ id, name, emoji, color, team, isHost: hostFlag });
    updateLobbyListUI();
}

function updateLobbyListUI() {
    const listDiv = document.getElementById('mp-players-list'); listDiv.innerHTML = "";
    lobbyPlayers.forEach(p => {
        let row = document.createElement('div'); row.className = 'player-row';
        let teamIndicator = p.team === '#000000' ? '⚫ Solo' : `<span style="color:${p.team};">■ Team</span>`;
        row.innerHTML = `<div style="display:flex; align-items:center; gap:8px;"><span style="font-size:20px; padding:2px; background:${p.color}; border-radius:50%;">${p.emoji}</span><span>${p.name} ${p.isHost ? '👑' : ''}</span></div><div>${teamIndicator}</div>`;
        listDiv.appendChild(row);
    });
}

function sendPlayerSettingsUpdate() {
    myName = document.getElementById('player-name').value.trim() || "Player";
    if (isHost) {
        let self = lobbyPlayers.find(p => p.id === myClientId);
        if (self) { self.emoji = currentHero.emoji; self.color = playerColor; self.team = playerTeamColor; self.name = myName; }
        broadcast({ type: 'lobby_update', players: lobbyPlayers }); updateLobbyListUI();
    } else if (connections[0] && connections[0].open) {
        connections[0].send({ type: 'update_settings', id: myClientId, name: safeEncode(myName), emoji: safeEncode(currentHero.emoji), color: playerColor, team: playerTeamColor });
    }
}

function broadcast(data) { connections.forEach(conn => { if (conn.open) conn.send(data); }); }
function leaveMultiplayer() { connections.forEach(c => c.close()); connections = []; lobbyPlayers = []; remotePlayers = {}; isHost = false; hideModal('mp-lobby-modal'); gameState = 'MENU'; }

// --- 5. Game Engine Logic ---
const canvas = document.getElementById('gameCanvas'); const ctx = canvas.getContext('2d');
let width, height; function resize() { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

const MAP_SIZE = 3000; let gameState = 'MENU', camera = { x: 0, y: 0 }, frames = 0;

let player = {
    id: "local", name: "Player", x: MAP_SIZE/2, y: MAP_SIZE/2, speed: 7, hp: 1000, maxHp: 1000, vx: 0, vy: 0, isShielded: false, isMoving: false,
    cdDash: 0, cdShield: 0, cdSpell: 0, shadowCD: 0, lastHitFrame: 0, lionBuff: 0, wizardBuff: 0, slowTimer: 0, emoji: '🤖', color: '#fff', team: '#000000', lastAtkFrame: 0,
    isDead: false, deathCount: 0, respawnTimer: 0, lives: 1
};

let enemies = [], spells = [], particles = [], allyShadows = [], tombstones = [], hazards = [];
let wave = 1, waveState = 'SPAWNING', totalEnemiesThisWave = 0, spawnedThisWave = 0;

for(let i=0; i<MAP_SIZE; i+=400) { for(let j=0; j<MAP_SIZE; j+=350) { if(Math.random() > 0.3) tombstones.push({x: i + Math.random()*100, y: j + Math.random()*100, type: Math.floor(Math.random()*3)}); } }

function addFloatText(text, x, y, color='#facc15') { let el = document.createElement('div'); el.className = 'float-txt'; el.innerText = text; el.style.color = color; el.style.left = x + 'px'; el.style.top = y + 'px'; document.body.appendChild(el); setTimeout(() => el.remove(), 1200); }
function updateHPBar() { document.getElementById('hp-fill').style.width = player.isDead ? '0%' : Math.max(0, (player.hp/player.maxHp)*100) + '%'; }
function healPlayer(amt) { if(!player.isDead){ player.hp = Math.min(player.maxHp, player.hp + amt); updateHPBar(); } }

function updateLivesUI() {
    if (!isOnlineMode) { document.getElementById('hud-lives').innerHTML = ''; return; }
    let hearts = ''; for(let i=0; i<player.lives; i++) hearts += '❤️';
    document.getElementById('hud-lives').innerHTML = hearts;
}

function showEndGame(status, color, subtitle = "") {
    gameState = 'END';
    document.getElementById('end-screen').style.display = 'flex';
    let txt = document.getElementById('end-title');
    let sub = document.getElementById('end-subtitle');
    txt.innerText = status; txt.className = status === 'VICTORY' ? 'victory-text' : 'defeat-text'; sub.innerText = subtitle;
}

function exitGame() {
    saveGame();
    gameState = 'MENU';
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('lobby').style.display = 'flex';
    
    if (isOnlineMode) {
        if (isHost) broadcast({ type: 'end_game', status: 'HOST LEFT', color: '#ef4444', sub: "Host ended the match." });
        leaveMultiplayer();
    }
}

// Touch Controls
let joyActive = false, joyOrigin = { x: 0, y: 0 };
const joyZone = document.getElementById('joy-zone'), joyKnob = document.getElementById('joy-knob');
joyZone.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0], r = joyZone.getBoundingClientRect(); joyOrigin = { x: r.left + r.width/2, y: r.top + r.height/2 }; updateJoystick(t.clientX, t.clientY); joyActive = true; });
joyZone.addEventListener('touchmove', e => { e.preventDefault(); if(joyActive) updateJoystick(e.changedTouches[0].clientX, e.changedTouches[0].clientY); });
joyZone.addEventListener('touchend', e => { e.preventDefault(); joyActive = false; joyKnob.style.transform = `translate(0px, 0px)`; player.vx = player.vy = 0; player.isMoving = false; });
function updateJoystick(tx, ty) {
    let dx = tx - joyOrigin.x, dy = ty - joyOrigin.y, dist = Math.hypot(dx, dy), maxDist = 40;
    if (dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`; player.vx = (dx / maxDist); player.vy = (dy / maxDist); player.isMoving = (dist > 5);
}

document.getElementById('btn-attack').ontouchstart = (e) => { 
    e.preventDefault(); if(player.isDead) return;
    player.lastAtkFrame = frames; createParticles(player.x, player.y, '#fff', 5);
    let dmg = getStatValue('atk'); if(player.lionBuff > 0) dmg *= 1.5;
    
    if (!isOnlineMode || isHost) {
        handleLocalAttacks(player, dmg);
    } else if (connections[0] && connections[0].open) {
        // Client က တိုက်ခိုက်လျှင် Host ထံ Attack Command ပို့မည်
        connections[0].send({ type: 'client_attack', id: myClientId, dmg: dmg });
    }
};

function handleLocalAttacks(attacker, dmg) {
    enemies.forEach((en) => { if(Math.hypot(en.x - attacker.x, en.y - attacker.y) < (en.isBoss ? 150 : 100)) { en.hp -= dmg; createParticles(en.x, en.y, '#ef4444', 8); } });
}

document.getElementById('btn-dash').ontouchstart = (e) => { e.preventDefault(); if(player.isDead || player.cdDash > 0) return; player.x += (player.vx || 1) * 220; player.y += (player.vy || 0) * 220; player.cdDash = getStatValue('dash'); };
document.getElementById('btn-shield').ontouchstart = (e) => { e.preventDefault(); if(player.isDead || player.cdShield > 0) return; player.isShielded = true; setTimeout(()=>player.isShielded = false, getStatValue('shieldDur') * 16.6); player.cdShield = getStatValue('shield'); };
document.getElementById('btn-spell').ontouchstart = (e) => { 
    e.preventDefault(); if(player.isDead || player.cdSpell > 0) return;
    let em = currentHero.emoji; let durMulti = getStatValue('spellDur');
    if(['🤖','💀','👻','🧟','👺','👹'].includes(em)) {
        let dirX = player.vx || 1, dirY = player.vy || 0; 
        if (!isOnlineMode || isHost) {
            spells.push({ x: player.x, y: player.y, vx: dirX * 18, vy: dirY * 18, life: 100, color: playerColor, isPlayerSpell: true, dmg: 65 + getStatValue('atk') });
        } else if (connections[0] && connections[0].open) {
            connections[0].send({ type: 'client_spell', id: myClientId, emoji: safeEncode(em), atk: getStatValue('atk') });
        }
    }
    else if(em === '🧛‍♂️') { player.slowTimer = 0; createParticles(player.x, player.y, '#dc2626', 30); healPlayer(player.maxHp * 0.2); }
    else if (em === '🦁') { player.lionBuff = 420 * durMulti; healPlayer(player.maxHp * 0.1); createParticles(player.x, player.y, '#f59e0b', 30); }
    else if (em === '🧙‍♂️') { player.wizardBuff = 480 * durMulti; createParticles(player.x, player.y, '#3b82f6', 30); }
    else if (em === '🥷') {
        if (!isOnlineMode || isHost) {
            for(let a=0; a<Math.PI*2; a+=Math.PI/4) { spells.push({ x: player.x, y: player.y, vx: Math.cos(a)*20, vy: Math.sin(a)*20, life: 50, color: '#94a3b8', isPlayerSpell: true, dmg: 50 + getStatValue('atk') }); }
        } else if (connections[0] && connections[0].open) {
            connections[0].send({ type: 'client_spell', id: myClientId, emoji: safeEncode(em), atk: getStatValue('atk') });
        }
    }
    player.cdSpell = getStatValue('spell');
};

document.getElementById('btn-summon').ontouchstart = (e) => {
    e.preventDefault(); if(player.isDead || player.shadowCD > 0) return;
    if(saveData.selectedShadowBosses.length === 0) return;
    if(!isOnlineMode || isHost) {
        saveData.selectedShadowBosses.forEach(emoji => { allyShadows.push({ x: player.x + (Math.random()*60-30), y: player.y + (Math.random()*60-30), emoji: emoji, hp: getStatValue('sHp'), maxHp: getStatValue('sHp'), speed: getStatValue('sSpeed'), dmg: getStatValue('sDmg'), lastSpellFrame: 0 }); });
    } else if (connections[0] && connections[0].open) {
        let encBosses = saveData.selectedShadowBosses.map(b => safeEncode(b));
        connections[0].send({ type: 'client_summon', id: myClientId, bosses: encBosses });
    }
    createParticles(player.x, player.y, '#7c3aed', 50); player.shadowCD = getStatValue('shadow'); 
};

function startOfflineGame() { startPlayingPhase(false); }
function startMultiplayerGame() { if(isHost) { broadcast({ type: 'start_game' }); startPlayingPhase(true); } }

function startPlayingPhase(online) {
    isOnlineMode = online;
    myName = document.getElementById('player-name').value.trim() || "Player";
    document.getElementById('lobby').style.display = 'none'; hideModal('mp-lobby-modal'); document.getElementById('game-ui').style.display = 'block';
    gameState = 'PLAYING'; 
    
    wave = (!isOnlineMode && saveData.checkpointWave > 1) ? saveData.checkpointWave : 1; 
    frames = 0; 
    prepareWave(wave);
    
    player.maxHp = getStatValue('pHp'); player.speed = getStatValue('pSpeed'); player.hp = player.maxHp;
    player.isDead = false; player.deathCount = 0; player.name = myName; player.slowTimer = 0;
    player.lives = isOnlineMode ? 5 : 1; 
    
    enemies = []; allyShadows = []; spells = []; hazards = []; 
    player.emoji = currentHero.emoji; player.color = playerColor; player.team = playerTeamColor;
    
    updateHPBar(); updateLivesUI(); requestAnimationFrame(gameLoop);
    if (saveData.selectedShadowBosses.length > 0) document.getElementById('btn-summon').classList.add('unlocked');
}

function prepareWave(w) {
    waveState = 'SPAWNING';
    totalEnemiesThisWave = w === 1 ? 5 : Math.min(300, Math.floor(5 * Math.pow(1.5, w - 1)));
    spawnedThisWave = 0;
}

function spawnBossByWave(w) {
    let angle = Math.random() * Math.PI * 2, dist = 600, ex = player.x + Math.cos(angle) * dist, ey = player.y + Math.sin(angle) * dist;
    let hpBase = 3000 + (w*300);
    let bossKeys = Object.keys(bossMeta); let bIdx = Math.min(bossKeys.length - 1, Math.floor((w / 5) - 1));
    enemies.push({ x: ex, y: ey, emoji: bossKeys[bIdx], hp: hpBase, maxHp: hpBase, speed: 4 + (w*0.05), dmg: 80 + (w*5), isBoss: true, size: 100, lastSpellFrame: frames, enraged: false });
}

function spawnEnemy() {
    let angle = Math.random() * Math.PI * 2, dist = Math.random() * 400 + 500, ex = player.x + Math.cos(angle) * dist, ey = player.y + Math.sin(angle) * dist;
    let randEmoji = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    enemies.push({ x: ex, y: ey, emoji: randEmoji, hp: 150 + (wave*60), maxHp: 150 + (wave*60), speed: Math.random() * 2 + 2.5 + (wave*0.05), dmg: 30 + (wave*5), isBoss: false, size: 45 });
}

function createParticles(x, y, color, count) { for(let i=0; i<count; i++) particles.push({ x: x, y: y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 25, color: color }); }

function handleLocalDeath() {
    if(player.isDead) return;
    player.hp = 0; updateHPBar();
    
    if (isOnlineMode) {
        player.lives--; updateLivesUI();
        if (player.lives > 0) {
            player.isDead = true; player.respawnTimer = 5; 
            let countdown = setInterval(() => {
                if(gameState !== 'PLAYING') return clearInterval(countdown);
                player.respawnTimer--;
                if(player.respawnTimer <= 0) { clearInterval(countdown); respawnLocalPlayer(); }
            }, 1000);
        } else {
            player.isDead = true;
        }
    } else {
        showEndGame("DEFEAT", "#ef4444", `You reached Wave ${wave}. Checkpoint Saved!`);
    }
}

function respawnLocalPlayer() {
    player.isDead = false; player.hp = player.maxHp; player.slowTimer = 0;
    player.x = MAP_SIZE / 2 + (Math.random() * 200 - 100); player.y = MAP_SIZE / 2 + (Math.random() * 200 - 100);
    updateHPBar();
}

function gameLoop() { if(gameState !== 'PLAYING') return; update(); draw(); requestAnimationFrame(gameLoop); }

function update() {
    frames++;
    if(player.cdDash > 0) player.cdDash--; if(player.cdShield > 0) player.cdShield--;
    if(player.cdSpell > 0) player.cdSpell--; if(player.shadowCD > 0) player.shadowCD--;
    if(player.lionBuff > 0) player.lionBuff--; if(player.wizardBuff > 0) player.wizardBuff--;
    if(player.slowTimer > 0) player.slowTimer--;
    
    if(!player.isDead && frames - player.lastHitFrame >= 180 && player.hp < player.maxHp && frames % 60 === 0) healPlayer(player.maxHp * 0.05);

    document.getElementById('cd-dash').style.height = (player.cdDash/getStatValue('dash'))*100 + '%';
    document.getElementById('cd-shield').style.height = (player.cdShield/getStatValue('shield'))*100 + '%';
    document.getElementById('cd-spell').style.height = (player.cdSpell/getStatValue('spell'))*100 + '%';
    document.getElementById('cd-summon').style.height = (player.shadowCD/getStatValue('shadow'))*100 + '%';

    if (player.hp <= 0 && !player.isDead) handleLocalDeath();

    if (isOnlineMode) {
        if (isHost) { 
            connections.forEach(conn => { let client = remotePlayers[conn.peer]; if (client) { client.x = Math.max(50, Math.min(MAP_SIZE-50, client.x)); client.y = Math.max(50, Math.min(MAP_SIZE-50, client.y)); } }); 
        } 
        else { 
            let hostConn = connections[0]; 
            if (hostConn && hostConn.open) { 
                // Client က HP / lives မပို့ဘဲ Position, Input, Emoji, Safe Text ကိုသာ ပို့ပေးသည်
                hostConn.send({ type: 'client_update', id: myClientId, playerState: { name: safeEncode(player.name), x: player.x, y: player.y, vx: player.vx, vy: player.vy, isMoving: player.isMoving, emoji: safeEncode(player.emoji), color: player.color, team: player.team, isShielded: player.isShielded, lastAtkFrame: player.lastAtkFrame } }); 
            } 
        }
        
        if (isHost && waveState !== 'GAME_OVER') {
            let allDead = player.isDead && Object.values(remotePlayers).every(p => p.isDead);
            if (allDead) {
                waveState = 'GAME_OVER';
                broadcast({ type: 'end_game', status: 'DEFEAT', color: '#ef4444', sub: "All players died!" });
                showEndGame('DEFEAT', '#ef4444', "All players died!");
            }
        }
    }

    if (!isOnlineMode || isHost) {
        if (waveState === 'SPAWNING') {
            if (spawnedThisWave < totalEnemiesThisWave && enemies.length < 300) { if (frames % 20 === 0) { spawnEnemy(); spawnedThisWave++; } } 
            else if (spawnedThisWave >= totalEnemiesThisWave) { waveState = 'CLEARING'; }
        } else if (waveState === 'CLEARING') {
            if (enemies.length === 0) { if (wave % 5 === 0) { waveState = 'BOSS'; spawnBossByWave(wave); } else { startNextWave(); } }
        } else if (waveState === 'BOSS') {
            if (enemies.length === 0) { if (!isOnlineMode) { saveData.checkpointWave = wave + 1; saveGame(); addFloatText("CHECKPOINT SAVED!", width/2 - 100, height/3, '#10b981'); } startNextWave(); }
        }
        updateMonstersAndAI();
    }

    let curSpeed = player.lionBuff > 0 ? player.speed * 1.5 : player.speed;
    if (player.slowTimer > 0) curSpeed *= 0.4;
    
    player.x += player.vx * curSpeed; player.y += player.vy * curSpeed;
    player.x = Math.max(50, Math.min(MAP_SIZE-50, player.x)); player.y = Math.max(50, Math.min(MAP_SIZE-50, player.y));
    camera.x = player.x - width/2; camera.y = player.y - height/2;

    if (player.isDead) document.getElementById('wave-info').innerHTML = `<span style="color:#ef4444; font-size:1.3rem;">DEAD</span><br><span style="font-size:0.85rem;">${player.lives > 0 ? 'Respawn: '+player.respawnTimer+'s' : 'No lives left'}</span>`;
    else {
        let statusTxt = waveState === 'BOSS' ? `<span style="color:#ef4444;">BOSS BATTLE</span>` : `Spawning: ${spawnedThisWave}/${totalEnemiesThisWave}`;
        if(waveState === 'CLEARING') statusTxt = `Remaining: ${enemies.length}`;
        document.getElementById('wave-info').innerHTML = `Wave: ${wave}<br><span style="font-size:0.85rem; color:#fff;">${statusTxt}</span>`; 
    }

    if (isOnlineMode && isHost) {
        broadcast({ type: 'sync_game_state', enemies: enemies, spells: spells, particles: particles, allyShadows: allyShadows, hazards: hazards, wave: wave, waveState: waveState, frames: frames,
            players: { host: { name: player.name, x: player.x, y: player.y, vx: player.vx, vy: player.vy, isMoving: player.isMoving, emoji: player.emoji, color: player.color, team: player.team, isShielded: player.isShielded, lionBuff: player.lionBuff, slowTimer: player.slowTimer, lastAtkFrame: player.lastAtkFrame, hp: player.hp, maxHp: player.maxHp, isDead: player.isDead, lives: player.lives }, ...remotePlayers }
        });
    }
}

function startNextWave() {
    let earned = 50 * Math.pow(1.5, wave - 1); saveData.gold += Math.floor(earned); 
    addFloatText(`+ ${Math.floor(earned)} Gold!`, width/2 - 40, height/4);
    if (isOnlineMode) broadcast({type: 'float_text', text: `+ ${Math.floor(earned)} Gold!`, x: width/2 - 40, y: height/4, color: '#facc15'});
    wave++; if(wave > saveData.topWave) saveData.topWave = wave; saveGame();
    prepareWave(wave);
}

function castEpicSpell(caster, targetX, targetY, isAlly, baseDmg) {
    let spellType = Math.floor(Math.random() * 5); let angle = Math.atan2(targetY - caster.y, targetX - caster.x);
    if (spellType === 0) spells.push({ x: caster.x, y: caster.y, vx: Math.cos(angle) * 6, vy: Math.sin(angle) * 6, life: 200, color: '#ef4444', isAlly: isAlly, dmg: baseDmg * 1.5, type: 'fire', size: 25 });
    else if (spellType === 1) spells.push({ x: caster.x, y: caster.y, vx: Math.cos(angle) * 15, vy: Math.sin(angle) * 15, life: 100, color: '#38bdf8', isAlly: isAlly, dmg: baseDmg * 0.8, type: 'ice', size: 15 });
    else if (spellType === 2) spells.push({ x: caster.x, y: caster.y, vx: Math.cos(angle) * 10, vy: Math.sin(angle) * 10, life: 150, color: '#94a3b8', isAlly: isAlly, dmg: baseDmg, type: 'shuriken', size: 20 });
    else if (spellType === 3) { for(let i=1; i<=5; i++) spells.push({ x: caster.x + Math.cos(angle)*i*60, y: caster.y + Math.sin(angle)*i*60, vx: 0, vy: 0, life: 15, color: '#facc15', isAlly: isAlly, dmg: baseDmg * 1.2, type: 'lightning', size: 30 }); } 
    else if (spellType === 4) hazards.push({ x: targetX, y: targetY, life: 120, radius: 100, color: isAlly ? '#a78bfa' : '#ef4444', isAlly: isAlly, dmg: baseDmg * 2 });
}

function updateMonstersAndAI() {
    for(let i=spells.length-1; i>=0; i--) {
        let sp = spells[i]; sp.x += sp.vx; sp.y += sp.vy; sp.life--;
        let hitTarget = false;
        
        if (sp.isPlayerSpell || sp.isAlly) {
            enemies.forEach(en => {
                if(!hitTarget && Math.hypot(en.x - sp.x, en.y - sp.y) < (en.isBoss ? 70 : 40)) { 
                    en.hp -= sp.dmg; createParticles(en.x, en.y, sp.color, 10); 
                    if (sp.type === 'ice') en.speed *= 0.5;
                    if (sp.type !== 'shuriken' && sp.type !== 'lightning') sp.life = 0; hitTarget = true;
                }
            });
        } else {
            let targetPlayer = getNearestAlivePlayer(sp.x, sp.y);
            if (targetPlayer && Math.hypot(targetPlayer.x - sp.x, targetPlayer.y - sp.y) < sp.size + 20) {
                dealDamageToPlayer(targetPlayer, sp.dmg);
                if (sp.type === 'ice' && targetPlayer.id === "local") player.slowTimer = 120;
                createParticles(sp.x, sp.y, sp.color, 15);
                if (sp.type !== 'shuriken' && sp.type !== 'lightning') sp.life = 0;
            }
        }
        if(sp.life <= 0) spells.splice(i, 1);
    }
    
    for(let i=hazards.length-1; i>=0; i--) {
        let hz = hazards[i]; hz.life--;
        if (hz.life <= 0) {
            createParticles(hz.x, hz.y, hz.color, 50);
            if (hz.isAlly) { enemies.forEach(en => { if (Math.hypot(en.x - hz.x, en.y - hz.y) < hz.radius) { en.hp -= hz.dmg; createParticles(en.x, en.y, '#fff', 5); }}); } 
            else { let p = getNearestAlivePlayer(hz.x, hz.y); if (p && Math.hypot(p.x - hz.x, p.y - hz.y) < hz.radius) { dealDamageToPlayer(p, hz.dmg); } }
            hazards.splice(i, 1);
        }
    }

    for(let i=allyShadows.length-1; i>=0; i--) {
        let ally = allyShadows[i], target = null, minDist = 1000;
        let aSpeed = player.wizardBuff > 0 ? ally.speed * 1.5 : ally.speed;
        enemies.forEach(en => { let d = Math.hypot(en.x - ally.x, en.y - ally.y); if(d < minDist) { minDist = d; target = en; } });
        
        if(target) {
            if (minDist > 150) { let angle = Math.atan2(target.y - ally.y, target.x - ally.x); ally.x += Math.cos(angle) * aSpeed; ally.y += Math.sin(angle) * aSpeed; } 
            else { if (frames - ally.lastSpellFrame > 90) { castEpicSpell(ally, target.x, target.y, true, ally.dmg); ally.lastSpellFrame = frames; } }
        } else { let angle = Math.atan2(player.y - ally.y, player.x - ally.x); if(Math.hypot(player.x - ally.x, player.y - ally.y) > 100) { ally.x += Math.cos(angle) * aSpeed; ally.y += Math.sin(angle) * aSpeed; } }
        ally.hp -= 1; if(ally.hp <= 0) { createParticles(ally.x, ally.y, '#a78bfa', 30); allyShadows.splice(i, 1); }
    }

    for(let i=enemies.length-1; i>=0; i--) {
        let en = enemies[i];
        if(en.isBoss && en.hp < (en.maxHp * 0.3) && !en.enraged) { en.enraged = true; en.size *= 1.3; en.speed *= 1.5; en.dmg *= 1.5; createParticles(en.x, en.y, '#ff0000', 50); }

        if(en.hp <= 0) { 
            if(en.isBoss) {
                if(!saveData.unlockedBosses.includes(en.emoji)) { 
                    saveData.unlockedBosses.push(en.emoji); saveGame(); 
                    addFloatText("New Shadow Unlocked!", width/2 - 80, height/2 - 40, '#a78bfa');
                    if (isOnlineMode) broadcast({type: 'float_text', text: "New Shadow Unlocked!", x: width/2 - 80, y: height/2 - 40, color: '#a78bfa'});
                }
                addFloatText("Boss Defeated!", width/2 - 50, height/2, '#ca8a04');
                if (isOnlineMode) broadcast({type: 'float_text', text: "Boss Defeated!", x: width/2 - 50, y: height/2, color: '#ca8a04'});
            }
            createParticles(en.x, en.y, '#ef4444', 15); enemies.splice(i, 1); continue; 
        }

        let targetPlayer = getNearestAlivePlayer(en.x, en.y);
        if (targetPlayer) {
            let angle = Math.atan2(targetPlayer.y - en.y, targetPlayer.x - en.x);
            let distToTarget = Math.hypot(targetPlayer.x - en.x, targetPlayer.y - en.y);
            
            if (en.isBoss) {
                if (frames - en.lastSpellFrame > (en.enraged ? 60 : 90)) { castEpicSpell(en, targetPlayer.x, targetPlayer.y, false, en.dmg); en.lastSpellFrame = frames; }
                if (distToTarget > 300) { en.x += Math.cos(angle) * en.speed; en.y += Math.sin(angle) * en.speed; }
            } else { en.x += Math.cos(angle) * en.speed; en.y += Math.sin(angle) * en.speed; }
            
            let attackRange = en.isBoss ? 70 : 35;
            if(distToTarget < attackRange && frames % 20 === 0) dealDamageToPlayer(targetPlayer, en.dmg);
        } else { en.x += (Math.random() - 0.5) * 3; en.y += (Math.random() - 0.5) * 3; }
    }

    for(let i=particles.length-1; i>=0; i--) { particles[i].x += particles[i].vx; particles[i].y += particles[i].vy; particles[i].life--; if(particles[i].life <= 0) particles.splice(i, 1); }
}

function getNearestAlivePlayer(x, y) {
    let nearest = null; let minDist = Infinity;
    let playersList = [];
    if (!player.isDead) playersList.push(player);
    Object.keys(remotePlayers).forEach(id => { if (!remotePlayers[id].isDead) playersList.push(remotePlayers[id]); });

    playersList.forEach(p => {
        let dist = Math.hypot(p.x - x, p.y - y);
        if (dist < minDist) { minDist = dist; nearest = p; }
    });
    return nearest;
}

function dealDamageToPlayer(target, dmg) {
    if (target.isShielded || target.isDead) return;
    if (target.id === "local" || !isOnlineMode) {
        player.hp -= dmg; player.lastHitFrame = frames; updateHPBar();
        addFloatText(`-${Math.floor(dmg)}`, player.x, player.y - 40, '#ef4444');
        if(player.hp <= 0) handleLocalDeath(); 
    } else {
        target.hp -= dmg;
        if (isOnlineMode) broadcast({type: 'float_text', text: `-${Math.floor(dmg)}`, x: target.x, y: target.y - 40, color: '#ef4444'});
    }
}

// --- 6. Graphics Render ---
function drawBoldStickman(ctx, x, y, color, emoji, isMoving, f, isShadow = false, isAttacking = false, pName = "", teamColor = "") {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if(isShadow) { ctx.globalAlpha = 0.55; ctx.shadowBlur = 20; ctx.shadowColor = color; }
    
    let swing = isMoving ? Math.sin(f * 0.2) * 18 : 0; let bounce = isMoving ? Math.abs(Math.sin(f * 0.2)) * 6 : 0;
    let bodyTop = y - bounce, bodyBottom = bodyTop + 35; let atkSwing = isAttacking ? Math.sin(f * 0.6) * 30 : 0;

    ctx.beginPath(); ctx.moveTo(x, bodyTop+5); ctx.lineTo(x - 20 + swing, bodyBottom-5); ctx.stroke(); 
    ctx.beginPath(); ctx.moveTo(x, bodyTop+5); ctx.lineTo(x + 20 - swing + atkSwing, bodyBottom-5); ctx.stroke(); 
    ctx.beginPath(); ctx.moveTo(x, bodyBottom); ctx.lineTo(x - 15 - swing, bodyBottom + 25); ctx.stroke(); 
    ctx.beginPath(); ctx.moveTo(x, bodyBottom); ctx.lineTo(x + 15 + swing, bodyBottom + 25); ctx.stroke(); 
    ctx.beginPath(); ctx.moveTo(x, bodyTop); ctx.lineTo(x, bodyBottom); ctx.stroke(); 
    
    ctx.globalAlpha = 1.0; ctx.font = `50px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    if(!isShadow) { ctx.shadowBlur = 5; ctx.shadowColor = 'rgba(0,0,0,0.8)'; } 
    ctx.fillText(emoji, x, bodyTop + 5);

    if (pName) {
        ctx.font = 'bold 15px Arial'; ctx.fillStyle = teamColor === '#000000' ? '#ffffff' : teamColor;
        ctx.shadowBlur = 5; ctx.shadowColor = '#000'; ctx.fillText(pName, x, bodyTop - 50);
    }
    ctx.restore();
}

function drawGraveyardMap(ctx, camX, camY) {
    ctx.fillStyle = '#1e1b4b'; ctx.fillRect(0, 0, width, height); ctx.save(); ctx.translate(-camX, -camY);
    ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.lineWidth = 2;
    for(let i=0; i<=MAP_SIZE; i+=150) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, MAP_SIZE); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(MAP_SIZE, i); ctx.stroke(); }
    tombstones.forEach(t => {
        ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.roundRect(t.x, t.y, 70, 90, 10); ctx.fill(); ctx.fillStyle = '#1e293b';
        if(t.type === 0) { ctx.fillRect(t.x + 30, t.y + 20, 10, 40); ctx.fillRect(t.x + 20, t.y + 35, 30, 10); }
        else if (t.type === 1) { ctx.beginPath(); ctx.arc(t.x + 35, t.y + 30, 15, 0, Math.PI*2); ctx.fill(); }
        else { ctx.fillRect(t.x + 20, t.y + 20, 30, 15); ctx.fillRect(t.x + 20, t.y + 45, 30, 10); }
        ctx.fillStyle = '#fef08a'; ctx.shadowBlur = 15; ctx.shadowColor = '#fef08a'; ctx.fillRect(t.x - 15, t.y + 70, 8, 8); ctx.fillRect(t.x + 80, t.y + 60, 8, 8); ctx.shadowBlur = 0;
    });
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE); ctx.restore();
}

function draw() {
    drawGraveyardMap(ctx, camera.x, camera.y); 
    ctx.save(); ctx.translate(-camera.x, -camera.y);
    
    hazards.forEach(hz => {
        ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI*2);
        ctx.fillStyle = hz.color; ctx.globalAlpha = 0.2 + (Math.sin(frames * 0.2) * 0.1); ctx.fill();
        ctx.strokeStyle = hz.color; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.fillText(Math.ceil(hz.life/60) + 's', hz.x, hz.y);
    });

    spells.forEach(sp => { 
        ctx.fillStyle = sp.color; ctx.shadowBlur = 10; ctx.shadowColor = sp.color; 
        if (sp.type === 'shuriken') {
            ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(frames * 0.5); ctx.fillRect(-sp.size/2, -sp.size/2, sp.size, sp.size); ctx.restore();
        } else if (sp.type === 'lightning') { ctx.fillRect(sp.x - sp.size/4, sp.y - sp.size*2, sp.size/2, sp.size*4); } 
        else { ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI*2); ctx.fill(); }
        ctx.shadowBlur = 0; 
    });
    
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    
    enemies.forEach(en => {
        if (en.enraged) { ctx.shadowBlur = 20; ctx.shadowColor = '#ff0000'; }
        if(en.isBoss) drawBoldStickman(ctx, en.x, en.y, en.enraged ? '#b91c1c' : '#ef4444', en.emoji, true, frames);
        else { ctx.font = `${en.size}px Arial`; ctx.fillText(en.emoji, en.x, en.y + Math.sin(frames * 0.1) * 3); }
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1e293b'; ctx.fillRect(en.x - en.size/2, en.y - 12, en.size, 6); ctx.fillStyle = en.isBoss ? '#facc15' : '#10b981'; ctx.fillRect(en.x - en.size/2, en.y - 12, (en.hp/en.maxHp)*en.size, 6);
    });

    allyShadows.forEach(ally => {
        let color = '#a78bfa'; drawBoldStickman(ctx, ally.x, ally.y, color, ally.emoji, true, frames, true);
        ctx.fillStyle = '#4c1d95'; ctx.fillRect(ally.x - 45, ally.y - 12, 90, 6); ctx.fillStyle = color; ctx.fillRect(ally.x - 45, ally.y - 12, (ally.hp/ally.maxHp)*90, 6);
    });

    Object.keys(remotePlayers).forEach(id => {
        let rp = remotePlayers[id];
        if (id !== myClientId) {
            let isPlayerAttacking = (frames - rp.lastAtkFrame) < 15;
            if(rp.isShielded && !rp.isDead) { ctx.beginPath(); ctx.arc(rp.x, rp.y, 65, 0, Math.PI*2); ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; ctx.fill(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.stroke(); }
            if(rp.slowTimer > 0 && !rp.isDead) { ctx.beginPath(); ctx.arc(rp.x, rp.y, 45, 0, Math.PI*2); ctx.fillStyle = 'rgba(56, 189, 248, 0.4)'; ctx.fill(); }
            if (rp.team !== '#000000' && !rp.isDead) { ctx.shadowBlur = 10; ctx.shadowColor = rp.team; }
            
            if(rp.isDead) ctx.globalAlpha = 0.3;
            drawBoldStickman(ctx, rp.x, rp.y, rp.color, rp.emoji, rp.isMoving, frames, false, isPlayerAttacking, rp.name, rp.team);
            ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
            
            if(!rp.isDead) { ctx.fillStyle = '#1e293b'; ctx.fillRect(rp.x - 40, rp.y - 35, 80, 6); ctx.fillStyle = '#ef4444'; ctx.fillRect(rp.x - 40, rp.y - 35, (rp.hp/rp.maxHp)*80, 6); }
        }
    });

    let isLocalAttacking = (frames - player.lastAtkFrame) < 15;
    if(player.isShielded && !player.isDead) { ctx.beginPath(); ctx.arc(player.x, player.y, 65, 0, Math.PI*2); ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; ctx.fill(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3; ctx.stroke(); }
    if(player.slowTimer > 0 && !player.isDead) { ctx.beginPath(); ctx.arc(player.x, player.y, 45, 0, Math.PI*2); ctx.fillStyle = 'rgba(56, 189, 248, 0.4)'; ctx.fill(); }
    if(player.lionBuff > 0 && !player.isDead) { ctx.shadowBlur = 20; ctx.shadowColor = '#f59e0b'; }
    if(player.team !== '#000000' && !player.isDead) { ctx.shadowBlur = 15; ctx.shadowColor = player.team; }
    
    if(player.isDead) ctx.globalAlpha = 0.3;
    drawBoldStickman(ctx, player.x, player.y, playerColor, currentHero.emoji, player.isMoving, frames, false, isLocalAttacking, player.name, player.team);
    ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;

    particles.forEach(p => { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill(); });
    ctx.restore();
}

