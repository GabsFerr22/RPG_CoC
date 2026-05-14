/*
  Trieste 1919 — game.js
  Lógica principal do jogo. A variável global IS_MASTER é definida no template game.html.
*/

// ═══════════════════════════════════════════
// GAME LOGIC — Trieste 1919
// ═══════════════════════════════════════════

const socket = io();

let currentTool   = "move";
let character     = null;

let localMapPanX = 0;
let localMapPanY = 0;
let localMapScale = 0.98;

let isDraggingMap = false;
let mapDragStartX = 0;
let mapDragStartY = 0;
let mapStartPanX = 0;
let mapStartPanY = 0;
let mapWasDragged = false;

let currentPartIndex = 0;
let skills        = [];
let selectedNpcId = null;
let currentMap    = "city";
let currentRoom   = "city";
let selectedSlot  = null;
let playerTokenSize = Number(localStorage.getItem("cthulhu_player_token_size")) || 100;
let npcTokenSize    = Number(localStorage.getItem("cthulhu_npc_token_size"))    || 100;
let diceModifier    = 0;

// ─── CLOCK ────────────────────────────────
let gameDateTime = new Date(1919, 10, 24, 21, 47);

let clockInterval = null;

function startGameClock() {
  if (clockInterval) clearInterval(clockInterval);

  clockInterval = setInterval(() => {
    // avança 1 minuto no tempo do jogo a cada 60 segundos reais
    gameDateTime.setMinutes(gameDateTime.getMinutes() + 1);
    updateClockDisplay();

    // se for mestre, espalha o tempo para os jogadores
    if (IS_MASTER) {
      socket.emit("game_time_set", {
        timestamp: gameDateTime.getTime()
      });
    }
  }, 60000);

  updateClockDisplay();
}

function centerCityMap() {
  const stage = document.getElementById("cityStage");
  if (!stage) return;

  const rect = stage.getBoundingClientRect();

  cityMapPanX = (rect.width - rect.width * cityMapScale) / 2;
  cityMapPanY = (rect.height - rect.height * cityMapScale) / 2;

  applyCityMapTransform();
}

function zoomAtPoint({ stage, clientX, clientY, scale, panX, panY, minScale, maxScale, delta }) {
  const rect = stage.getBoundingClientRect();

  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  const oldScale = scale;
  const zoomFactor = delta < 0 ? 1.1 : 0.9;
  const newScale = Math.max(minScale, Math.min(maxScale, oldScale * zoomFactor));

  const worldX = (mouseX - panX) / oldScale;
  const worldY = (mouseY - panY) / oldScale;

  const newPanX = mouseX - worldX * newScale;
  const newPanY = mouseY - worldY * newScale;

  return {
    scale: newScale,
    panX: newPanX,
    panY: newPanY
  };
}


function updateClockDisplay() {
  const clockEl = document.getElementById("clockDisplay");
  const dateEl = document.getElementById("dateDisplay");

  const hora = String(gameDateTime.getHours()).padStart(2, "0");
  const minuto = String(gameDateTime.getMinutes()).padStart(2, "0");

  if (clockEl) {
    clockEl.textContent = `${hora}:${minuto}`;
  }

  if (dateEl) {
    dateEl.textContent = formatGameDate(gameDateTime);
  }
}

function formatGameDate(dateObj) {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const dia = String(dateObj.getDate()).padStart(2, "0");
  const mes = meses[dateObj.getMonth()];
  const ano = dateObj.getFullYear();

  return `${dia} de ${mes} de ${ano}`;
}

function parseGameDate(dateText) {
  if (!dateText) return null;

  // aceita formato: 24/11/1919
  const br = dateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const dia = Number(br[1]);
    const mes = Number(br[2]) - 1;
    const ano = Number(br[3]);
    return { dia, mes, ano };
  }

  return null;
}

function setGameTime() {
  const tInput = document.getElementById("masterTimeInput");
  const dInput = document.getElementById("masterDateInput");

  if (tInput && tInput.value.trim()) {
    const parts = tInput.value.trim().split(":");

    const hora = Number(parts[0]);
    const minuto = Number(parts[1]);

    if (
      Number.isFinite(hora) &&
      Number.isFinite(minuto) &&
      hora >= 0 && hora <= 23 &&
      minuto >= 0 && minuto <= 59
    ) {
      gameDateTime.setHours(hora);
      gameDateTime.setMinutes(minuto);
      gameDateTime.setSeconds(0);
    } else {
      alert("Use a hora no formato HH:MM. Exemplo: 10:00");
      return;
    }
  }

  if (dInput && dInput.value.trim()) {
    const parsed = parseGameDate(dInput.value.trim());

    if (parsed) {
      gameDateTime.setFullYear(parsed.ano);
      gameDateTime.setMonth(parsed.mes);
      gameDateTime.setDate(parsed.dia);
    } else {
      alert("Use a data no formato DD/MM/AAAA. Exemplo: 24/11/1919");
      return;
    }
  }

  updateClockDisplay();
  startGameClock();

  socket.emit("game_time_set", {
    timestamp: gameDateTime.getTime()
  });

  showToast("Tempo do jogo atualizado.");
}

// ─── MAPS ─────────────────────────────────

const LOCAL_PARTS = {
  hotel:      [{ name: "Térreo", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/hotel_terreo.webp" },{ name: "1º Andar", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/hotel_1andar.webp" },{ name: "2º Andar", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/hotel_2andar.webp" }],
  mansao:     [{ name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/mansao_valdris.webp" },{ name: "Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/mansao_valdris_terreo.webp" },{ name: "1º Andar", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/mansao_valdris_1andar.webp" },{ name: "2º Andar", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/mansao_valdris_2andar.webp" },{ name: "Porão", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/mansao_valdris_porao.webp" }],
  igreja:     [{ name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/igreja_exterior.webp" },{ name: "Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/igreja_principal.webp" },{ name: "Subsolo", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/igreja_subsolo.webp" }],
  mirante:    [{ name: "Mirante", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/mirante_esquecido.webp" }],
  esgotos:    [{ name: "Esgoto", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/esgotos_trieste.webp" }],
  cais:       [{ name: "Cais Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cais_exterior.webp" },{ name: "Cais Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cais_interior.webp" }],
  delegacia:  [{ name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/delegacia_exterior.webp" },{ name: "Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/delegacia_central.webp" },{ name: "Prisão", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/delegacia_prisao.webp" }],
  cafe:       [{ name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cafe_exterior.webp" },{ name: "Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cafe_interior.webp" }],
  praca:      [{ name: "Praça", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/praca_central.webp" }],
  Frigorifico:[{ name: "Frigorífico", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/frigorifico.webp" }],
  armazem:    [{ name: "Armazém", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/Armazem.webp" }],
  vicolo:     [{ name: "Vicolo", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/vicolo_del_muschio.webp" }],
  farmacia:   [{ name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/farmacia_weiss_exterior.webp" },{ name: "Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/farmacia_weiss.webp" }],
  prefeitura: [{ name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/prefeitura_exterior.webp" },{ name: "Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/prefeitura_interior.webp" }],
  cemiterio:  [{ name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cemiterio_exterior.webp" },{ name: "Covas", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cemiterio_covas.webp" },{ name: "Coveiro", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cemiterio_coveiro.webp" },{ name: "Sessão F", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cemiterio_familiar.webp" }]
};

// ─── VTT TOOLS ────────────────────────────

function setVttTool(tool) {
  currentTool = tool; selectedNpcId = null;
  clearNpcSelection();
  if (tool === "fog") { masterEvent("fog"); currentTool = "move"; return; }
  if (tool === "shake") { masterEvent("shake"); currentTool = "move"; return; }
}

function clearNpcSelection() {
  document.querySelectorAll(".monster-token").forEach(t => {
    t.style.outline = ""; t.style.filter = "";
  });
}

// ─── LOCAL MAP CLICK ──────────────────────

const localStage = document.getElementById("localStage");
localStage.onclick = async (e) => {
  if (mapWasDragged) {
    mapWasDragged = false;
    return;
  }

  if (currentMap === "city") return;

  const rect = localStage.getBoundingClientRect();

  let x = ((e.clientX - rect.left - localMapPanX) / localMapScale / rect.width) * 100;
  let y = ((e.clientY - rect.top - localMapPanY) / localMapScale / rect.height) * 100;

  x = Math.max(0, Math.min(100, x));
  y = Math.max(0, Math.min(100, y));


  if (IS_MASTER && currentTool === "move" && selectedNpcId) {
    await fetch(`/api/monsters/move/${selectedNpcId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pos_x: x, pos_y: y })
    });
    clearNpcSelection(); selectedNpcId = null; return;
  }
  if (e.target.closest(".token")) return;
  if (IS_MASTER && currentTool === "ping") { createPing(x, y); socket.emit("vtt_ping", { x, y, currentMap, currentRoom }); return; }
  if (IS_MASTER && currentTool === "danger") { createDangerMarker(x, y); socket.emit("vtt_danger", { x, y, currentMap, currentRoom }); return; }
  if (!IS_MASTER && character && currentTool === "move") { await moveMyToken(x, y); }
};

// ─── MAP NAVIGATION ───────────────────────

document.querySelectorAll(".hotspot").forEach(btn => {
  btn.addEventListener("click", async () => { await openLocalMap(btn.dataset.map); });
});

async function openLocalMap(mapName) {
  currentMap = mapName; currentPartIndex = 0;
  openCurrentPart();
  document.getElementById("tokensLayer").innerHTML = "";
  const lbl = document.getElementById("cityLocationLabel");
  if (lbl) lbl.textContent = mapName.charAt(0).toUpperCase() + mapName.slice(1);
  if (!IS_MASTER) await moveMyToken(50, 70);
  await loadAllCharacters(); await loadMonsters(); await refreshCityMarkers();
}


function openCurrentPart() {
  const parts = LOCAL_PARTS[currentMap] || [];
  const part = parts[currentPartIndex];

  if (!part) {
    console.warn("Nenhuma parte encontrada para o mapa:", currentMap);
    return;
  }

  currentRoom = `${currentMap}_${part.name}`;

  const localMap = document.getElementById("localMap");

  if (localMap) {
    localMap.src = part.img;
    localMap.classList.remove("hidden");

    localMap.onload = () => {
      localMapScale = 0.98;
      centerLocalMap();
    };
  }

  const titleEl = document.getElementById("localTitle");
  if (titleEl) {
    titleEl.innerHTML = `
      ${currentMap.toUpperCase()}
      <span class="map-subtitle" id="localSubtitle">${part.name}</span>
    `;
  }

  const locLabel = document.getElementById("localLocationLabel");
  if (locLabel) {
    locLabel.textContent = part.name;
  }
}

async function changeMapPart(direction) {
  const parts = LOCAL_PARTS[currentMap] || [];
  if (!parts.length) return;

  currentPartIndex = (currentPartIndex + direction + parts.length) % parts.length;

  openCurrentPart();

  const layer = document.getElementById("tokensLayer");
  if (layer) {
    layer.innerHTML = "";
  }

  setTimeout(centerLocalMap, 80);

  await loadAllCharacters();
  await loadMonsters();

  socket.emit("map_part_changed", {
    currentMap,
    currentPartIndex
  });
}

// ─── CHAR MOVEMENT ────────────────────────

async function moveMyToken(x, y) {
  if (!character || currentMap === "city") return;

  character.pos_x = x;
  character.pos_y = y;
  character.current_map = currentMap;
  character.current_room = currentRoom;

  renderToken(character.id, character.name, character.image_url, x, y);

  await fetch("/api/character/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      char_id: character.id,
      current_map: currentMap,
      current_room: currentRoom,
      pos_x: x,
      pos_y: y,
      char_name: character.name,
      image_url: character.image_url
    })
  });
}

// ─── LOAD CHARACTERS / MONSTERS ──────────

async function loadAllCharacters() {
  const res = await fetch(`/api/all_characters?map=${currentMap}&room=${currentRoom}`);
  const data = await res.json();
  const layer = document.getElementById("tokensLayer");
  layer.innerHTML = "";
  data.characters.forEach(c => renderToken(c.id, c.name, c.image_url, c.pos_x, c.pos_y));
}

async function loadMonsters() {
  const res = await fetch(`/api/monsters?map=${currentMap}&room=${currentRoom}`);
  const data = await res.json();
  data.monsters.forEach(m => renderMonster(m));
}

// ─── RENDER TOKENS ────────────────────────

function renderToken(id, name, image, x, y) {
  const layer = document.getElementById("tokensLayer");
  let token = layer.querySelector(`[data-token="${id}"]`);
  if (!token) {
    token = document.createElement("div");
    token.className = "token player-token"; token.dataset.token = id; token.title = name;
    token.innerHTML = `<img src="${image || '/static/images/default_character.png'}" onerror="this.src='/static/images/default_character.png'"><span class="token-label">${name}</span>`;
    token.onclick = async (e) => {
      e.stopPropagation();
      if (!IS_MASTER) return;
      if (currentTool === "danger" && confirm(`Remover token de ${name}?`)) {
        await fetch(`/api/character/hide/${id}`, { method: "POST" });
      }
    };
    layer.appendChild(token);
  }
  const imgEl = token.querySelector("img");
  if (imgEl) { imgEl.src = image || '/static/images/default_character.png'; }
  const lbl = token.querySelector(".token-label"); if (lbl) lbl.innerText = name;
  token.style.left = `${x}%`;
  token.style.top = `${y}%`;

  const isMyToken = character && id === character.id;

  if (!IS_MASTER && isMyToken) {
    token.style.height = `${playerTokenSize}px`;
    token.style.width = `${Math.floor(playerTokenSize * 0.72)}px`;
  } else {
    token.style.height = `100px`;
    token.style.width = `${Math.floor(100 * 0.72)}px`;
  }
}

function renderMonster(monster) {
  const layer = document.getElementById("tokensLayer");
  let token = layer.querySelector(`[data-monster="${monster.id}"]`);
  if (!token) {
    token = document.createElement("div");
    token.className = "token monster-token"; token.dataset.monster = monster.id; token.title = monster.name;
    token.innerHTML = `<img src="${monster.image_url || '/static/images/default_monster.png'}" onerror="this.src='/static/images/default_monster.png'"><span class="token-label">${monster.name}</span>`;
    token.onclick = async (e) => {
      e.stopPropagation();
      if (!IS_MASTER) return;
      if (currentTool === "danger") {
        if (confirm(`Remover ${monster.name}?`)) await fetch(`/api/monsters/${monster.id}`, { method: "DELETE" });
        return;
      }
      if (currentTool === "move") {
        const wasSel = selectedNpcId === monster.id;
        clearNpcSelection();
        if (wasSel) { selectedNpcId = null; }
        else { selectedNpcId = monster.id; token.style.outline = "2px solid #c9a84c"; token.style.filter = "drop-shadow(0 0 10px rgba(201,168,76,0.6))"; }
      }
    };
    layer.appendChild(token);
  }
  token.style.left = `${monster.pos_x}%`; token.style.top = `${monster.pos_y}%`;
  token.style.height = `${npcTokenSize}px`; token.style.width = `${Math.floor(npcTokenSize * 0.72)}px`;
}

function applyTokenSize() {
  if (!IS_MASTER && character) {
    const myToken = document.querySelector(`[data-token="${character.id}"]`);

    if (myToken) {
      myToken.style.height = `${playerTokenSize}px`;
      myToken.style.width = `${Math.floor(playerTokenSize * 0.72)}px`;
    }

    return;
  }

  if (IS_MASTER) {
    document.querySelectorAll(".monster-token").forEach(t => {
      t.style.height = `${npcTokenSize}px`;
      t.style.width = `${Math.floor(npcTokenSize * 0.72)}px`;
    });
  }
}

function setupTokenSizeControl() {
  const input = document.getElementById("tokenSizeInput");
  const label = document.getElementById("tokenSizeLabel");

  if (!input) return;

  if (IS_MASTER) {
    if (label) label.innerText = "Tamanho NPC";

    input.value = npcTokenSize;

    input.oninput = () => {
      npcTokenSize = Number(input.value);
      localStorage.setItem("cthulhu_npc_token_size", npcTokenSize);
      applyTokenSize();
    };

  } else {
    if (label) label.innerText = "Meu Tamanho";

    input.value = playerTokenSize;

    input.oninput = () => {
      playerTokenSize = Number(input.value);
      localStorage.setItem("cthulhu_player_token_size", playerTokenSize);
      applyTokenSize();
    };
  }
}

// ─── CITY MARKERS ─────────────────────────

async function refreshCityMarkers() {
  const res = await fetch("/api/all_characters"); const data = await res.json();
  const layer = document.getElementById("cityMarkersLayer"); if (!layer) return;
  layer.innerHTML = "";
  data.characters.forEach(c => { if (c.current_map && c.current_map !== "city") renderCityLocationMarker(c.current_map, c.image_url, c.name); });
}

function renderCityLocationMarker(mapName, imageUrl, name = "") {
  const hotspot = document.querySelector(`.hotspot[data-map="${mapName}"]`);
  if (!hotspot) return;
  const layer = document.getElementById("cityMarkersLayer");
  const marker = document.createElement("div");
  marker.style.cssText = `position:absolute;left:${hotspot.style.left};top:calc(${hotspot.style.top} + 18px);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;transform:translate(-50%,0);z-index:20;`;
  marker.innerHTML = `<img src="${imageUrl || '/static/images/default_character.png'}" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--gold);object-fit:contain;background:rgba(0,0,0,.65);" onerror="this.src='/static/images/default_character.png'"><span style="font-size:8px;color:var(--gold-bright);background:rgba(4,12,6,.9);border:1px solid var(--border-gold);padding:1px 3px;white-space:nowrap;">${name}</span>`;
  layer.appendChild(marker);
}


// ─── Sanidade ────────────────────────


function updateSanityTentacles() {
  if (IS_MASTER || !character) return;

  const overlay = document.getElementById("sanityTentaclesOverlay");
  if (!overlay) return;

  const sanity = Number(character.sanity ?? 99);
  const sanityMax = Number(character.sanity_max ?? 99);

  const percent = sanityMax > 0 ? (sanity / sanityMax) * 100 : 100;

  overlay.classList.remove(
    "sanity-stage-1",
    "sanity-stage-2",
    "sanity-stage-3",
    "sanity-stage-4"
  );

  // Sanidade alta: sem tentáculos
  if (percent > 70) {
    overlay.style.opacity = "0";
    return;
  }

  overlay.style.opacity = "";

  if (percent > 50) {
    overlay.classList.add("sanity-stage-1");
  } else if (percent > 30) {
    overlay.classList.add("sanity-stage-2");
  } else if (percent > 15) {
    overlay.classList.add("sanity-stage-3");
  } else {
    overlay.classList.add("sanity-stage-4");
  }
}


// ─── CHARACTER LOAD ────────────────────────

async function loadCharacter() {
  if (IS_MASTER) return;
  const res = await fetch("/api/character"); const data = await res.json();
  character = data.character; skills = data.skills || [];
  const nameEl = document.getElementById("charName"); if (nameEl) nameEl.innerText = character.name;
  const occEl = document.getElementById("charOccupation"); if (occEl) occEl.innerText = character.occupation || "Investigador";
  const img = document.getElementById("charImage");
  if (img) { img.src = character.image_url || "/static/images/default_character.png"; img.onerror = () => { img.src = "/static/images/default_character.png"; }; }

  // Attributes
  const attrMap = {
    'attr-str': 'strength', 'attr-con': 'constitution', 'attr-dex': 'dexterity',
    'attr-int': 'intelligence', 'attr-app': 'appearance', 'attr-sab': 'luck'
  };
  Object.entries(attrMap).forEach(([elId, field]) => {
    const el = document.getElementById(elId); if (el) el.textContent = character[field] ?? '--';
  });

  updateHUD();
  renderPlayerSidebar();
  initInventory();
  fillSheetModal();
  loadNotes();
  setupTokenSizeControl();
  await refreshCityMarkers();
}

function updateHUD() {
  if (!character || IS_MASTER) return;

  const s = document.getElementById("sanity");
  if (s) s.innerText = character.sanity;

  const sm = document.getElementById("sanityMax");
  if (sm) sm.innerText = character.sanity_max;

  const h = document.getElementById("hp");
  if (h) h.innerText = `${character.hp}/${character.hp_max}`;

  const c = document.getElementById("credit");
  if (c) c.innerText = `¢${character.credit_rating}`;

  const m = document.getElementById("mp");
  if (m) m.innerText = `${character.mp}/${character.mp_max}`;

  const mv = document.getElementById("mov");
  if (mv) mv.innerText = `${character.movement}/${character.movement}`;

  const hpPct = character.hp_max ? (character.hp / character.hp_max * 100) : 0;
  const mpPct = character.mp_max ? (character.mp / character.mp_max * 100) : 0;
  const sanPct = character.sanity_max ? (character.sanity / character.sanity_max * 100) : 0;

  const hpBar = document.getElementById("hpBar");
  if (hpBar) hpBar.style.width = hpPct + "%";

  const mpBar = document.getElementById("mpBar");
  if (mpBar) mpBar.style.width = mpPct + "%";

  const statEl = document.getElementById("sanStatus");
  if (statEl) {
    if (sanPct > 70) {
      statEl.textContent = "Estável ✦";
      statEl.style.color = "var(--green-text)";
    } else if (sanPct > 40) {
      statEl.textContent = "Perturbado";
      statEl.style.color = "var(--gold)";
    } else {
      statEl.textContent = "Insano";
      statEl.style.color = "var(--red-hp)";
    }
  }

  if (character.sanity <= 10) {
    document.body.style.filter = `saturate(${character.sanity / 10})`;
  } else {
    document.body.style.filter = "";
  }

  updateSanityTentacles();
}


function renderPlayerSidebar() {
  if (IS_MASTER || !character) return;
  const nameEl = document.getElementById("charName"); if (nameEl) nameEl.innerText = character.name;
  const img = document.getElementById("charImage");
  if (img) { img.src = character.image_url || "/static/images/default_character.png"; img.onerror = () => { img.src = "/static/images/default_character.png"; }; }
  const list = document.getElementById("skillsList"); if (!list) return;
  list.innerHTML = "";
  skills.forEach(skill => {
    const div = document.createElement("div"); div.className = "skill-row";
    div.innerHTML = `<span class="skill-name">${skill.name}</span><strong class="skill-pct">${skill.current_value}%</strong>`;
    div.onclick = () => rollDice("d100", skill.name, skill.current_value);
    list.appendChild(div);
  });
}

function fillSheetModal() {
  if (IS_MASTER || !character) return;
  const nameEl = document.getElementById("modalCharName"); if (nameEl) nameEl.innerText = character.name;
  const sheetEl = document.getElementById("modalSheet"); if (!sheetEl) return;
  sheetEl.innerHTML = `
    <p><b>Sanidade:</b> ${character.sanity}/${character.sanity_max}</p>
    <p><b>Vida:</b> ${character.hp}/${character.hp_max}</p>
    <p><b>Magia:</b> ${character.mp}/${character.mp_max}</p>
    <p><b>Crédito:</b> ${character.credit_rating}</p>
    <p><b>MOV:</b> ${character.movement}</p>
    <hr>
    <p><b>FOR:</b> ${character.strength} &nbsp; <b>CON:</b> ${character.constitution} &nbsp; <b>TAM:</b> ${character.size}</p>
    <p><b>DES:</b> ${character.dexterity} &nbsp; <b>APP:</b> ${character.appearance} &nbsp; <b>INT:</b> ${character.intelligence}</p>
    <p><b>POD:</b> ${character.power} &nbsp; <b>EDU:</b> ${character.education} &nbsp; <b>SORTE:</b> ${character.luck}</p>
    <hr>
    ${skills.map(s => `<p>${s.name}: <b>${s.current_value}%</b></p>`).join("")}`;
}

// ─── STATS ────────────────────────────────

async function changeStat(stat, delta) {
  if (!character) return;
  const caps = { sanity: character.sanity_max || 99, hp: character.hp_max, mp: character.mp_max };
  character[stat] = Math.max(0, Math.min(caps[stat] ?? 999, Number(character[stat]) + delta));
  updateHUD();
  await fetch("/api/character/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [stat]: character[stat] }) });
}

// ─── DICE ─────────────────────────────────

function adjMod(delta) {
  diceModifier = Math.max(-20, Math.min(20, diceModifier + delta));
  const el = document.getElementById("modVal"); if (el) el.textContent = (diceModifier >= 0 ? "+" : "") + diceModifier;
}

function rollActiveDice() {
  const select = document.getElementById("diceTypeSelect");
  const diceType = select ? select.value : "d100";
  const imgBtn = document.getElementById("dice-img-btn");
  if (imgBtn) { imgBtn.classList.add("rolling"); setTimeout(() => imgBtn.classList.remove("rolling"), 500); }
  const typeEl = document.getElementById("dice-result-type"); if (typeEl) typeEl.textContent = diceType;
  rollDice(diceType, "", null);
}

async function rollDice(dice, purpose = "", skillValue = null) {
  await fetch("/api/dice/roll", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dice, purpose, skill_value: skillValue, char_name: character ? character.name : "Desconhecido" })
  });
}

function addRollLog(text, isSuccess) {
  const rollLog = document.getElementById("rollLog"); if (!rollLog) return;
  const line = document.createElement("div");
  line.className = "roll-entry" + (isSuccess === false ? " roll-fail" : isSuccess === true ? " roll-success" : "");
  line.textContent = text;
  rollLog.prepend(line);
  while (rollLog.children.length > 50) rollLog.lastChild.remove();
  const numEl = document.getElementById("dice-result-num");
  const match = text.match(/= (\d+)/); if (match && numEl) numEl.textContent = match[1];
}

function clearRollLog() { const el = document.getElementById("rollLog"); if (el) el.innerHTML = ""; }

function formatRoll(data) {
  let t = `${data.char_name}: ${data.dice_type} = ${data.result}`;
  if (data.purpose) t += ` | ${data.purpose}`;
  if (data.skill_value != null) t += ` (${data.skill_value}%)`;
  if (data.success_level) t += ` — ${data.success_level}`;
  return t;
}

// ─── INVENTORY ────────────────────────────

function initInventory() {
  const inv = document.getElementById("inventory"); if (!inv) return;
  inv.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const slot = document.createElement("div");
    slot.className = "inv-slot"; slot.dataset.slot = i;
    slot.innerHTML = `<span style="font-size:14px;color:var(--text-dim);">${i+1}</span>`;
    slot.onclick = () => openItemModal(i);
    inv.appendChild(slot);
  }
}

function openItemModal(slot) {
  selectedSlot = slot;
  document.getElementById("itemName").value = "";
  document.getElementById("itemDescription").value = "";
  openModal("itemModal");
}

function saveItem() {
  const name = document.getElementById("itemName").value.trim();
  const desc = document.getElementById("itemDescription").value.trim();
  if (!name || selectedSlot === null) return;
  const slot = document.querySelector(`.inv-slot[data-slot="${selectedSlot}"]`);
  if (slot) {
    slot.innerHTML = `<span style="font-size:9px;text-align:center;padding:2px;color:var(--text-soft);word-break:break-word;display:block;">${name}</span>`;
    slot.title = desc;
  }
  closeModal("itemModal");
}

// ─── CHAT ─────────────────────────────────

async function sendChat() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim(); if (!msg) return; input.value = "";
  await fetch("/api/chat/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg }) });
}

function appendChatMessage(data) {
  const messages = document.getElementById("chatMessages"); if (!messages) return;
  const line = document.createElement("div");
  line.innerHTML = `<b>${data.username}</b> <small>${data.timestamp}</small>: ${data.message}`;
  messages.appendChild(line); messages.scrollTop = messages.scrollHeight;
}

const chatInputEl = document.getElementById("chatInput");
if (chatInputEl) chatInputEl.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); sendChat(); } });

// ─── EFFECTS ──────────────────────────────

function createPing(x, y) {
  const layer = document.getElementById("tokensLayer");
  const ping = document.createElement("div"); ping.className = "vtt-ping";
  ping.style.left = `${x}%`; ping.style.top = `${y}%`;
  layer.appendChild(ping); setTimeout(() => ping.remove(), 1500);
}

function createDangerMarker(x, y) {
  const layer = document.getElementById("tokensLayer");
  const m = document.createElement("div"); m.className = "danger-marker";
  m.style.left = `${x}%`; m.style.top = `${y}%`; m.innerText = "!";
  layer.appendChild(m);
}

function showToast(message) {
  const toast = document.getElementById("masterToast");
  toast.innerText = message; toast.style.opacity = "1";
  clearTimeout(toast._timeout); toast._timeout = setTimeout(() => { toast.style.opacity = "0"; }, 4000);
}

// ─── MODALS ───────────────────────────────

function openModal(id) { const el = document.getElementById(id); if (el) el.classList.add("active"); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove("active"); }

document.querySelectorAll(".modal").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m) closeModal(m.id); });
});

function toggleMasterPanel() {
  const panel = document.getElementById("master-panel");
  const btn = document.getElementById("masterMinimizeBtn");

  if (!panel || !btn) return;

  panel.classList.toggle("master-minimized");

  btn.textContent = panel.classList.contains("master-minimized") ? "+" : "−";
}


// ─── NOTES ────────────────────────────────

function loadNotes() {
  const ta = document.getElementById("playerNotes"); if (!ta) return;
  ta.value = localStorage.getItem("cthulhu_notes") || "";
  ta.oninput = () => localStorage.setItem("cthulhu_notes", ta.value);
}

// ─── MASTER FUNCTIONS ─────────────────────

async function loadMasterPlayers() {
  if (!IS_MASTER) return;
  const res = await fetch("/api/online_players"); const data = await res.json();
  const grid = document.getElementById("masterPlayersGrid"); if (!grid) return;
  grid.innerHTML = "";
  data.characters.forEach(p => {
    const card = document.createElement("div"); card.className = "player-card";
    card.innerHTML = `<img src="${p.image_url || '/static/images/default_character.png'}" onerror="this.src='/static/images/default_character.png'">
      <div class="player-info">
        <strong>${p.name}</strong><small>${p.current_map || "cidade"}</small>
        <div class="player-status">
          ❤️ <button class="stat-mini" onclick="masterChangePlayerStat('${p.id}','hp',${p.hp},-1)">−</button>${p.hp ?? "--"}/${p.hp_max ?? "--"}<button class="stat-mini" onclick="masterChangePlayerStat('${p.id}','hp',${p.hp},1)">+</button><br>
          🧠 <button class="stat-mini" onclick="masterChangePlayerStat('${p.id}','sanity',${p.sanity},-1)">−</button>${p.sanity ?? "--"}/${p.sanity_max ?? "--"}<button class="stat-mini" onclick="masterChangePlayerStat('${p.id}','sanity',${p.sanity},1)">+</button>
        </div>
        <button class="kick-btn" onclick="kickPlayer('${p.user_id}')">Deslogar</button>
      </div>`;
    grid.appendChild(card);
  });
}

async function kickPlayer(userId) { await fetch(`/api/master/kick/${userId}`, { method: "POST" }); await loadMasterPlayers(); }
async function masterChangePlayerStat(charId, stat, cur, delta) {
  await fetch(`/api/master/character/${charId}/update`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [stat]: Math.max(0, Number(cur) + delta) }) });
  await loadMasterPlayers();
}

function masterPlayMusic() {
  const audio = document.getElementById("bgMusic"); const sel = document.getElementById("musicSelect"); const vol = document.getElementById("musicVolume");
  audio.src = sel.value; audio.volume = Number(vol.value); audio.play();
  socket.emit("music_control", { action: "play", src: sel.value, volume: Number(vol.value) });
}

function masterStopMusic() { const a = document.getElementById("bgMusic"); a.pause(); a.currentTime = 0; socket.emit("music_control", { action: "stop" }); }
function masterMuteMusic() { const a = document.getElementById("bgMusic"); a.muted = !a.muted; socket.emit("music_control", { action: "mute", muted: a.muted }); }
function masterChangeVolume() { const a = document.getElementById("bgMusic"); const v = document.getElementById("musicVolume"); a.volume = Number(v.value); socket.emit("music_control", { action: "volume", volume: Number(v.value) }); }

async function masterEvent(effect) {
  await fetch("/api/master/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: effect === "fog" ? "A névoa toma o lugar..." : "Algo observa vocês.", effect }) });
}

// ─── NPC ──────────────────────────────────

function openNpcModal() { openModal("npcModal"); }

async function createNPC() {
  const name = document.getElementById("npcName").value.trim() || "NPC";
  const file = document.getElementById("npcImage").files[0];
  let imageUrl = "/static/images/default_character.png";
  if (file) {
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd }); const data = await res.json();
    if (data.url) imageUrl = data.url;
  }
  await fetch("/api/monsters/spawn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, type: "npc", current_map: currentMap, current_room: currentRoom, pos_x: 50, pos_y: 50, image_url: imageUrl, hp: 1 }) });
  document.getElementById("npcName").value = ""; document.getElementById("npcImage").value = "";
  closeModal("npcModal");
}

// ─── EDIT CHARACTER ────────────────────────

function openEditCharacterModal() {
  if (IS_MASTER || !character) return;
  document.getElementById("editCharName").value = character.name || "";
  const prev = document.getElementById("editCharPreview"); if (prev) prev.src = character.image_url || "/static/images/default_character.png";
  document.getElementById("editSanity").value = character.sanity ?? 0;
  document.getElementById("editSanityMax").value = character.sanity_max ?? 99;
  document.getElementById("editHp").value = character.hp ?? 0;
  document.getElementById("editHpMax").value = character.hp_max ?? 0;
  document.getElementById("editMp").value = character.mp ?? 0;
  document.getElementById("editMpMax").value = character.mp_max ?? 0;
  document.getElementById("editCredit").value = character.credit_rating ?? 0;
  document.getElementById("editMov").value = character.movement ?? 0;
  document.getElementById("editStrength").value = character.strength ?? 0;
  document.getElementById("editConstitution").value = character.constitution ?? 0;
  document.getElementById("editSize").value = character.size ?? 0;
  document.getElementById("editDexterity").value = character.dexterity ?? 0;
  document.getElementById("editAppearance").value = character.appearance ?? 0;
  document.getElementById("editIntelligence").value = character.intelligence ?? 0;
  document.getElementById("editPower").value = character.power ?? 0;
  document.getElementById("editEducation").value = character.education ?? 0;
  document.getElementById("editLuck").value = character.luck ?? 0;
  renderEditSkills();
  openModal("editCharacterModal");
}

function renderEditSkills() {
  const list = document.getElementById("editSkillsList"); if (!list) return;
  list.innerHTML = "";
  skills.forEach((skill, idx) => {
    const row = document.createElement("div"); row.className = "edit-skill-row";
    row.innerHTML = `<input class="edit-skill-name" value="${escapeHtml(skill.name || '')}" placeholder="Nome" data-index="${idx}"><input class="edit-skill-value" type="number" value="${skill.current_value ?? 0}" data-index="${idx}"><button type="button" onclick="removeEditSkill(${idx})">×</button>`;
    list.appendChild(row);
  });
}

function addEditSkill() { skills.push({ id: null, name: "", current_value: 0 }); renderEditSkills(); }
function removeEditSkill(i) { skills.splice(i, 1); renderEditSkills(); }

function collectEditSkills() {
  const rows = document.querySelectorAll(".edit-skill-row"); const out = [];
  rows.forEach(row => {
    const n = row.querySelector(".edit-skill-name"); const v = row.querySelector(".edit-skill-value");
    const idx = Number(n.dataset.index); const old = skills[idx] || {};
    const name = n.value.trim(); if (!name) return;
    out.push({ id: old.id || null, name, base_value: old.base_value || 0, current_value: Number(v.value) || 0, category: old.category || "general" });
  });
  return out;
}

async function saveFullCharacter() {
  if (IS_MASTER || !character) return;
  let imageUrl = character.image_url || "/static/images/default_character.png";
  const fileInput = document.getElementById("editCharImage");
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;
  if (file) {
    const fd = new FormData(); fd.append("file", file);
    const ur = await fetch("/api/upload", { method: "POST", body: fd }); const ud = await ur.json();
    if (ud.url) imageUrl = ud.url;
  }
  const payload = {
    name: document.getElementById("editCharName").value.trim(), image_url: imageUrl,
    sanity: Number(document.getElementById("editSanity").value), sanity_max: Number(document.getElementById("editSanityMax").value),
    hp: Number(document.getElementById("editHp").value), hp_max: Number(document.getElementById("editHpMax").value),
    mp: Number(document.getElementById("editMp").value), mp_max: Number(document.getElementById("editMpMax").value),
    credit_rating: Number(document.getElementById("editCredit").value), movement: Number(document.getElementById("editMov").value),
    strength: Number(document.getElementById("editStrength").value), constitution: Number(document.getElementById("editConstitution").value),
    size: Number(document.getElementById("editSize").value), dexterity: Number(document.getElementById("editDexterity").value),
    appearance: Number(document.getElementById("editAppearance").value), intelligence: Number(document.getElementById("editIntelligence").value),
    power: Number(document.getElementById("editPower").value), education: Number(document.getElementById("editEducation").value),
    luck: Number(document.getElementById("editLuck").value), skills: collectEditSkills()
  };
  if (!payload.name) { alert("O personagem precisa ter um nome."); return; }
  const res = await fetch("/api/character/full_update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok || data.error) { alert(data.error || "Erro ao salvar."); return; }
  character = data.character; skills = data.skills || [];
  updateHUD(); fillSheetModal(); renderPlayerSidebar();
  if (currentMap !== "city") renderToken(character.id, character.name, character.image_url, character.pos_x || 50, character.pos_y || 70);
  closeModal("editCharacterModal"); showToast("Personagem atualizado.");
}

const editImgInput = document.getElementById("editCharImage");
if (editImgInput) editImgInput.addEventListener("change", () => {
  const f = editImgInput.files[0]; if (!f) return;
  const prev = document.getElementById("editCharPreview"); if (prev) prev.src = URL.createObjectURL(f);
});

function escapeHtml(v) { return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

// ─── SOCKET EVENTS ────────────────────────

socket.on("online_players_updated", () => { if (IS_MASTER) loadMasterPlayers(); });
socket.on("force_logout", data => { if (character && character.user_id === data.user_id) window.location.href = "/logout"; });
socket.on("music_control", data => {
  const audio = document.getElementById("bgMusic"); if (!audio) return;
  if (data.action === "play") { audio.src = data.src; audio.volume = data.volume ?? 0.5; audio.play(); }
  if (data.action === "stop") { audio.pause(); audio.currentTime = 0; }
  if (data.action === "mute") audio.muted = data.muted;
  if (data.action === "volume") audio.volume = data.volume;
});

socket.on("character_moved", async data => {
  if (data.current_map === currentMap && data.current_room === currentRoom) {
    const tokenId = data.char_id || data.user_id;

    renderToken(
      tokenId,
      data.char_name,
      data.image_url || "/static/images/default_character.png",
      data.pos_x,
      data.pos_y
    );
  }

  await refreshCityMarkers();
});

socket.on("character_updated", data => {
  if (character && (data.user_id === character.user_id || data.char_id === character.id)) { Object.assign(character, data.updates || {}); updateHUD(); }
  if (IS_MASTER) loadMasterPlayers();
});

socket.on("character_hidden", data => { const t = document.querySelector(`[data-token="${data.id}"]`); if (t) t.remove(); });
socket.on("monster_spawned", m => { if (m.current_map === currentMap && m.current_room === currentRoom) renderMonster(m); });
socket.on("monster_moved", data => { const t = document.querySelector(`[data-monster="${data.id}"]`); if (t) { t.style.left = `${data.pos_x}%`; t.style.top = `${data.pos_y}%`; } });
socket.on("monster_removed", data => { const t = document.querySelector(`[data-monster="${data.id}"]`); if (t) t.remove(); if (selectedNpcId === data.id) selectedNpcId = null; });
socket.on("dice_rolled", data => { const ok = data.success_level ? !data.success_level.includes("Falha") : null; addRollLog(formatRoll(data), ok); });
socket.on("chat_message", appendChatMessage);
socket.on("vtt_ping", data => { if (data.currentMap === currentMap && data.currentRoom === currentRoom) createPing(data.x, data.y); });
socket.on("vtt_danger", data => { if (data.currentMap === currentMap && data.currentRoom === currentRoom) createDangerMarker(data.x, data.y); });
socket.on("map_part_changed", async data => { currentMap = data.currentMap; currentPartIndex = data.currentPartIndex; openCurrentPart(); document.getElementById("tokensLayer").innerHTML = ""; await loadAllCharacters(); await loadMonsters(); });
socket.on("master_event", data => {
  if (data.effect === "fog") { const f = document.getElementById("fogIntro"); if (f) { f.style.animation = "none"; void f.offsetWidth; f.style.animation = "fogReveal 4s forwards"; } }
  if (data.effect === "shake") { document.body.animate([{transform:"translate(0,0)"},{transform:"translate(7px,0)"},{transform:"translate(-7px,0)"},{transform:"translate(4px,0)"},{transform:"translate(0,0)"}], {duration:500}); }
  if (data.message) showToast(data.message);
});

socket.on("game_time_set", data => {
  if (!data.timestamp) return;

  gameDateTime = new Date(data.timestamp);
  updateClockDisplay();

  if (!IS_MASTER) {
    startGameClock();
  }
});


function applyLocalMapTransform() {
  const localMap = document.getElementById("localMap");
  const tokensLayer = document.getElementById("tokensLayer");

  const transform = `translate(${localMapPanX}px, ${localMapPanY}px) scale(${localMapScale})`;

  if (localMap) {
    localMap.style.transform = transform;
    localMap.style.transformOrigin = "0 0";
  }

  if (tokensLayer) {
    tokensLayer.style.transform = transform;
    tokensLayer.style.transformOrigin = "0 0";
  }
}

function centerLocalMap() {
  const stage = document.getElementById("localStage");
  if (!stage) return;

  const rect = stage.getBoundingClientRect();

  localMapPanX = (rect.width - rect.width * localMapScale) / 2;
  localMapPanY = (rect.height - rect.height * localMapScale) / 2;

  applyLocalMapTransform();
}

function setupLocalMapPan() {
  const stage = document.getElementById("localStage");
  if (!stage) return;

  stage.addEventListener("mousedown", (e) => {
    if (currentMap === "city") return;
    if (e.target.closest(".token")) return;
    if (e.target.closest(".map-part-nav")) return;

    isDraggingMap = true;
    mapWasDragged = false;

    mapDragStartX = e.clientX;
    mapDragStartY = e.clientY;

    mapStartPanX = localMapPanX;
    mapStartPanY = localMapPanY;

    stage.classList.add("dragging");
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDraggingMap) return;

    const dx = e.clientX - mapDragStartX;
    const dy = e.clientY - mapDragStartY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      mapWasDragged = true;
    }

    localMapPanX = mapStartPanX + dx;
    localMapPanY = mapStartPanY + dy;

    applyLocalMapTransform();
  });

  stage.addEventListener("wheel", (e) => {
  if (currentMap === "city") return;

  e.preventDefault();

  const result = zoomAtPoint({
    stage,
    clientX: e.clientX,
    clientY: e.clientY,
    scale: localMapScale,
    panX: localMapPanX,
    panY: localMapPanY,
    minScale: 0.8,
    maxScale: 2.8,
    delta: e.deltaY
  });

  localMapScale = result.scale;
  localMapPanX = result.panX;
  localMapPanY = result.panY;

  applyLocalMapTransform();
}, { passive: false });

  window.addEventListener("mouseup", () => {
    if (!stage) return;
    isDraggingMap = false;
    stage.classList.remove("dragging");
  });
}


// ─── INIT ─────────────────────────────────

async function initGame() {
  setupTokenSizeControl();
  setupLocalMapPan();
  startGameClock();
  await refreshCityMarkers();
  if (IS_MASTER) { await loadMasterPlayers(); setInterval(loadMasterPlayers, 3000); }
  else { await loadCharacter(); }
}

initGame();
