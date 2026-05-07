// ─────────────────────────────────────────
// CALL OF CTHULHU — TRIESTE 1919
// game.js — completo e atualizado
// ─────────────────────────────────────────

const socket = io();

let currentTool   = "move";
let character     = null;
let currentPartIndex = 0;
let skills        = [];
let selectedNpcId = null;   // ID do monstro/NPC atualmente selecionado pelo mestre
let currentMap    = "city";
let currentRoom   = "city";
let selectedSlot  = null;
let playerTokenSize = Number(localStorage.getItem("cthulhu_player_token_size")) || 140;
let npcTokenSize    = Number(localStorage.getItem("cthulhu_npc_token_size"))    || 140;

// ─────────────────────────────────────────
// MAPAS E PARTES
// ─────────────────────────────────────────

const LOCAL_PARTS = {
  hotel: [
    { name: "Térreo",   img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/hotel_terreo.webp"  },
    { name: "1º Andar", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/hotel_1andar.webp"  },
    { name: "2º Andar", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/hotel_2andar.webp"  }
  ],
  mansao: [
    { name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/mansao_valdris.webp"         },
    { name: "Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/mansao_valdris_terreo.webp"  },
    { name: "1º Andar", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/mansao_valdris_1andar.webp"  },
    { name: "2º Andar", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/mansao_valdris_2andar.webp"  },
    { name: "Porão",    img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/mansao_valdris_porao.webp"   }
  ],
  igreja: [
    { name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/igreja_exterior.webp"  },
    { name: "Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/igreja_principal.webp" },
    { name: "Subsolo",  img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/igreja_subsolo.webp"   }
  ],
  mirante: [
    { name: "Mirante", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/mirante_esquecido.webp" }
  ],
  esgotos: [
    { name: "Esgoto", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/esgotos_trieste.webp" }
  ],
  cais: [
    { name: "Cais Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cais_exterior.webp" },
    { name: "Cais Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cais_interior.webp" }
  ],
  delegacia: [
    { name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/delegacia_exterior.webp" },
    { name: "Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/delegacia_central.webp"  },
    { name: "Prisão",   img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/delegacia_prisao.webp"   }
  ],
  cafe: [
    { name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cafe_exterior.webp" },
    { name: "Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cafe_interior.webp" }
  ],
  praca: [
    { name: "Praça", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/praca_central.webp" }
  ],
  Frigorifico: [
    { name: "Frigorífico", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/frigorifico.webp" }
  ],
  armazem: [
    { name: "Armazém", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/Armazem.webp" }
  ],
  vicolo: [
    { name: "Vicolo", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/vicolo_del_muschio.webp" }
  ],
  farmacia: [
    { name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/farmacia_weiss_exterior.webp" },
    { name: "Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/farmacia_weiss.webp"          }
  ],
  prefeitura: [
    { name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/prefeitura_exterior.webp" },
    { name: "Interior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/prefeitura_interior.webp" }
  ],
  cemiterio: [
    { name: "Exterior", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cemiterio_exterior.webp"  },
    { name: "Covas",    img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cemiterio_covas.webp"     },
    { name: "Coveiro",  img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cemiterio_coveiro.webp"  },
    { name: "Sessão F", img: "https://rltosysjdtsfrvntfgvz.supabase.co/storage/v1/object/public/rpg_assets/maps/cemiterio_familiar.webp" }
  ]
};

// ─────────────────────────────────────────
// FERRAMENTA ATIVA (MESTRE)
// ─────────────────────────────────────────

function setVttTool(tool) {
  currentTool   = tool;
  selectedNpcId = null;

  // Remove seleção visual de todos os tokens
  clearNpcSelection();

  // Ferramentas que disparam efeito imediato
  if (tool === "fog") {
    masterEvent("fog");
    currentTool = "move";
    return;
  }
  if (tool === "shake") {
    masterEvent("shake");
    currentTool = "move";
    return;
  }

  // Feedback visual no painel do mestre
  document.querySelectorAll(".master-panel button").forEach(btn => {
    btn.style.outline = "";
  });
  const activeBtn = document.querySelector(`.master-panel button[onclick="setVttTool('${tool}')"]`);
  if (activeBtn) activeBtn.style.outline = "2px solid #c8a84a";

  console.log("Ferramenta ativa:", currentTool);
}

// Remove destaque de todos os tokens de monstro
function clearNpcSelection() {
  document.querySelectorAll(".monster-token").forEach(t => {
    t.style.outline = "";
    t.style.filter  = "";
  });
}

// ─────────────────────────────────────────
// CLIQUE NO MAPA LOCAL  ← FIX PRINCIPAL
// ─────────────────────────────────────────

const localStage = document.getElementById("localStage");

localStage.onclick = async (e) => {
  if (currentMap === "city") return;

  const rect = localStage.getBoundingClientRect();
  let x = ((e.clientX - rect.left)  / rect.width)  * 100;
  let y = ((e.clientY - rect.top)   / rect.height) * 100;
  x = Math.max(0, Math.min(100, x));
  y = Math.max(0, Math.min(100, y));

  // ── 1. MOVER NPC SELECIONADO (mestre) ──────────────────────────────
  // Precisa vir ANTES de qualquer guard clause de token,
  // para que o clique mova mesmo que caia perto de outro token.
  if (IS_MASTER && currentTool === "move" && selectedNpcId) {
    await fetch(`/api/monsters/move/${selectedNpcId}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ pos_x: x, pos_y: y })
    });

    // Limpa seleção visual e variável
    clearNpcSelection();
    selectedNpcId = null;
    return;
  }

  // ── 2. Guard: clique direto em token sem NPC selecionado → ignora ──
  if (e.target.closest(".token")) return;

  // ── 3. PING ────────────────────────────────────────────────────────
  if (IS_MASTER && currentTool === "ping") {
    createPing(x, y);
    socket.emit("vtt_ping", { x, y, currentMap, currentRoom });
    return;
  }

  // ── 4. MARCADOR DE PERIGO ──────────────────────────────────────────
  if (IS_MASTER && currentTool === "danger") {
    createDangerMarker(x, y);
    socket.emit("vtt_danger", { x, y, currentMap, currentRoom });
    return;
  }

  // ── 5. MOVER PLAYER (não-mestre) ───────────────────────────────────
  if (!IS_MASTER && character && currentTool === "move") {
    await moveMyToken(x, y);
  }
};

// ─────────────────────────────────────────
// PAINEL DO MESTRE — PLAYERS ONLINE
// ─────────────────────────────────────────

async function loadMasterPlayers() {
  if (!IS_MASTER) return;

  const res  = await fetch("/api/online_players");
  const data = await res.json();
  const grid = document.getElementById("masterPlayersGrid");
  if (!grid) return;

  grid.innerHTML = "";

  data.characters.forEach(p => {
    const card = document.createElement("div");
    card.className = "player-card";
    card.innerHTML = `
      <img src="${p.image_url || "/static/images/default_character.png"}"
           onerror="this.src='/static/images/default_character.png'">
      <div class="player-info">
        <strong>${p.name}</strong>
        <small>${p.current_map || "cidade"}</small>
        <div class="player-status">
          ❤️
          <button class="stat-mini" onclick="masterChangePlayerStat('${p.id}','hp',${p.hp},-1)">−</button>
          ${p.hp ?? "--"}/${p.hp_max ?? "--"}
          <button class="stat-mini" onclick="masterChangePlayerStat('${p.id}','hp',${p.hp},1)">+</button>
          <br>
          🧠
          <button class="stat-mini" onclick="masterChangePlayerStat('${p.id}','sanity',${p.sanity},-1)">−</button>
          ${p.sanity ?? "--"}/${p.sanity_max ?? "--"}
          <button class="stat-mini" onclick="masterChangePlayerStat('${p.id}','sanity',${p.sanity},1)">+</button>
          <br>
          📖
          <button class="stat-mini" onclick="masterChangePlayerStat('${p.id}','mp',${p.mp},-1)">−</button>
          ${p.mp ?? "--"}/${p.mp_max ?? "--"}
          <button class="stat-mini" onclick="masterChangePlayerStat('${p.id}','mp',${p.mp},1)">+</button>
        </div>
        <button class="kick-btn" onclick="kickPlayer('${p.user_id}')">Deslogar</button>
      </div>`;
    grid.appendChild(card);
  });
}

async function kickPlayer(userId) {
  await fetch(`/api/master/kick/${userId}`, { method: "POST" });
  await loadMasterPlayers();
}

async function masterChangePlayerStat(charId, stat, currentValue, delta) {
  const newValue = Math.max(0, Number(currentValue) + delta);
  await fetch(`/api/master/character/${charId}/update`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ [stat]: newValue })
  });
  await loadMasterPlayers();
}

// ─────────────────────────────────────────
// MÚSICA (MESTRE)
// ─────────────────────────────────────────

function masterPlayMusic() {
  const audio  = document.getElementById("bgMusic");
  const select = document.getElementById("musicSelect");
  const vol    = document.getElementById("musicVolume");
  audio.src    = select.value;
  audio.volume = Number(vol.value);
  audio.play();
  socket.emit("music_control", { action: "play", src: select.value, volume: Number(vol.value) });
}

function masterStopMusic() {
  const audio = document.getElementById("bgMusic");
  audio.pause();
  audio.currentTime = 0;
  socket.emit("music_control", { action: "stop" });
}

function masterMuteMusic() {
  const audio = document.getElementById("bgMusic");
  audio.muted = !audio.muted;
  socket.emit("music_control", { action: "mute", muted: audio.muted });
}

function masterChangeVolume() {
  const audio = document.getElementById("bgMusic");
  const vol   = document.getElementById("musicVolume");
  audio.volume = Number(vol.value);
  socket.emit("music_control", { action: "volume", volume: Number(vol.value) });
}

// ─────────────────────────────────────────
// CARREGAR PERSONAGEM (PLAYER)
// ─────────────────────────────────────────

async function loadCharacter() {
  const res  = await fetch("/api/character");
  const data = await res.json();

  character = data.character;
  skills    = data.skills || [];

  // HUD
  document.getElementById("charName").innerText  = character.name;
  const img = document.getElementById("charImage");
  img.src = character.image_url || "/static/images/default_character.png";
  img.onerror = () => { img.src = "/static/images/default_character.png"; };

  updateHUD();

  // Perícias na sidebar
  const skillsList = document.getElementById("skillsList");
  skillsList.innerHTML = "";
  skills.forEach(skill => {
    const div = document.createElement("div");
    div.className = "skill";
    div.innerHTML = `<span>${skill.name}</span><strong>${skill.current_value}%</strong>`;
    div.onclick = () => rollDice("d100", skill.name, skill.current_value);
    skillsList.appendChild(div);
  });

  // Inventário
  const invEl = document.getElementById("inventory");
  invEl.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const slot = document.createElement("div");
    slot.className    = "inv-slot";
    slot.dataset.slot = i;
    slot.innerHTML    = `<button class="inv-add" onclick="openItemModal(${i})">+</button>`;
    invEl.appendChild(slot);
  }

  fillSheetModal();
  loadNotes();
  setupTokenSizeControl();
  await refreshCityMarkers();
}

function updateHUD() {
  if (!character) return;
  document.getElementById("sanity").innerText = character.sanity;
  document.getElementById("hp").innerText     = `${character.hp}/${character.hp_max}`;
  document.getElementById("credit").innerText = character.credit_rating;
  document.getElementById("mp").innerText     = `${character.mp}/${character.mp_max}`;
  document.getElementById("mov").innerText    = character.movement;
}

function fillSheetModal() {
  document.getElementById("modalCharName").innerText = character.name;
  document.getElementById("modalSheet").innerHTML = `
    <p><b>Sanidade:</b> ${character.sanity}/${character.sanity_max}</p>
    <p><b>Vida:</b>     ${character.hp}/${character.hp_max}</p>
    <p><b>Magia:</b>    ${character.mp}/${character.mp_max}</p>
    <p><b>Crédito:</b>  ${character.credit_rating}</p>
    <p><b>MOV:</b>      ${character.movement}</p>
    <hr>
    <p><b>FOR:</b>  ${character.strength}</p>
    <p><b>CON:</b>  ${character.constitution}</p>
    <p><b>TAM:</b>  ${character.size}</p>
    <p><b>DES:</b>  ${character.dexterity}</p>
    <p><b>APA:</b>  ${character.appearance}</p>
    <p><b>INT:</b>  ${character.intelligence}</p>
    <p><b>POD:</b>  ${character.power}</p>
    <p><b>EDU:</b>  ${character.education}</p>
    <p><b>SORTE:</b>${character.luck}</p>
    <hr>
    ${skills.map(s => `<p>${s.name}: <b>${s.current_value}%</b></p>`).join("")}
  `;
}

// ─────────────────────────────────────────
// HOTSPOTS DO MAPA DA CIDADE
// ─────────────────────────────────────────

document.querySelectorAll(".hotspot").forEach(btn => {
  btn.addEventListener("click", async () => {
    await openLocalMap(btn.dataset.map);
  });
});

async function openLocalMap(mapName) {
  currentMap       = mapName;
  currentPartIndex = 0;

  openCurrentPart();
  document.getElementById("tokensLayer").innerHTML = "";

  if (!IS_MASTER) await moveMyToken(50, 70);

  await loadAllCharacters();
  await loadMonsters();
  await refreshCityMarkers();
}

function openCurrentPart() {
  const parts = LOCAL_PARTS[currentMap] || [];
  const part  = parts[currentPartIndex];
  if (!part) return;

  currentRoom = `${currentMap}_${part.name}`;

  const localMap = document.getElementById("localMap");
  localMap.src = part.img;
  localMap.classList.remove("hidden");

  document.getElementById("localTitle").innerText = `${currentMap.toUpperCase()} — ${part.name}`;
  const partNameEl = document.getElementById("partName");
  if (partNameEl) partNameEl.innerText = part.name;
}

async function changeMapPart(direction) {
  const parts = LOCAL_PARTS[currentMap] || [];
  if (!parts.length) return;

  currentPartIndex = (currentPartIndex + direction + parts.length) % parts.length;

  openCurrentPart();
  document.getElementById("tokensLayer").innerHTML = "";

  await loadAllCharacters();
  await loadMonsters();

  socket.emit("map_part_changed", { currentMap, currentPartIndex });
}

// ─────────────────────────────────────────
// MOVER TOKEN DO PLAYER
// ─────────────────────────────────────────

async function moveMyToken(x, y) {
  if (!character || currentMap === "city") return;

  character.pos_x        = x;
  character.pos_y        = y;
  character.current_map  = currentMap;
  character.current_room = currentRoom;

  renderToken(character.id, character.name, character.image_url, x, y);

  await fetch("/api/character/move", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      current_map:  currentMap,
      current_room: currentRoom,
      pos_x:        x,
      pos_y:        y,
      char_name:    character.name,
      image_url:    character.image_url
    })
  });
}

// ─────────────────────────────────────────
// CARREGAR TODOS OS PERSONAGENS / MONSTROS
// ─────────────────────────────────────────

async function loadAllCharacters() {
  const res  = await fetch(`/api/all_characters?map=${currentMap}&room=${currentRoom}`);
  const data = await res.json();
  const layer = document.getElementById("tokensLayer");
  layer.innerHTML = "";
  data.characters.forEach(c => renderToken(c.id, c.name, c.image_url, c.pos_x, c.pos_y));
}

async function loadMonsters() {
  const res  = await fetch(`/api/monsters?map=${currentMap}&room=${currentRoom}`);
  const data = await res.json();
  data.monsters.forEach(m => renderMonster(m));
}

// ─────────────────────────────────────────
// RENDERIZAR TOKEN DE PLAYER
// ─────────────────────────────────────────

function renderToken(id, name, image, x, y) {
  const layer = document.getElementById("tokensLayer");
  let token   = layer.querySelector(`[data-token="${id}"]`);

  if (!token) {
    token = document.createElement("div");
    token.className   = "token player-token";
    token.dataset.token = id;
    token.title       = name;
    token.innerHTML   = `
      <img src="${image || "/static/images/default_character.png"}"
           onerror="this.src='/static/images/default_character.png'">
      <span class="token-label">${name}</span>`;

    token.onclick = async (e) => {
      e.stopPropagation();
      if (!IS_MASTER) return;

      // Mestre pode remover token de player com ferramenta "danger"
      if (currentTool === "danger") {
        if (confirm(`Remover token de ${name}?`)) {
          await fetch(`/api/character/hide/${id}`, { method: "POST" });
        }
      }
    };

    layer.appendChild(token);
  }

  token.style.left   = `${x}%`;
  token.style.top    = `${y}%`;
  token.style.height = `${playerTokenSize}px`;
  token.style.width  = `${Math.floor(playerTokenSize * 0.72)}px`;
}

// ─────────────────────────────────────────
// RENDERIZAR TOKEN DE MONSTRO / NPC  ← FIX
// ─────────────────────────────────────────

function renderMonster(monster) {
  const layer = document.getElementById("tokensLayer");
  let token   = layer.querySelector(`[data-monster="${monster.id}"]`);

  if (!token) {
    token = document.createElement("div");
    token.className       = "token monster-token npc-token";
    token.dataset.monster = monster.id;
    token.title           = monster.name;
    token.innerHTML       = `
      <img src="${monster.image_url || "/static/images/default_monster.png"}"
           onerror="this.src='/static/images/default_monster.png'">
      <span class="token-label">${monster.name}</span>`;

    // ── Clique no token de monstro ──────────────────────────────────
    token.onclick = async (e) => {
      e.stopPropagation(); // impede que o clique chegue ao localStage

      if (!IS_MASTER) return;

      // Ferramenta DANGER → remove o monstro
      if (currentTool === "danger") {
        if (confirm(`Remover ${monster.name}?`)) {
          await fetch(`/api/monsters/${monster.id}`, { method: "DELETE" });
        }
        return;
      }

      // Ferramenta MOVE → seleciona / deseleciona o NPC
      if (currentTool === "move") {
        const jaEstavaSelecionado = selectedNpcId === monster.id;

        // Limpa seleção anterior
        clearNpcSelection();

        if (jaEstavaSelecionado) {
          // Clicou no mesmo: deseleciona
          selectedNpcId = null;
          console.log("🔲 NPC deselecionado");
        } else {
          // Seleciona este NPC
          selectedNpcId = monster.id;
          token.style.outline = "3px solid #f1d88d";
          token.style.filter  = "drop-shadow(0 0 14px #f1d88d)";
          console.log("✅ NPC selecionado:", selectedNpcId, monster.name);
        }
      }
    };

    layer.appendChild(token);
  }

  // Atualiza posição e tamanho
  token.style.left   = `${monster.pos_x}%`;
  token.style.top    = `${monster.pos_y}%`;
  token.style.height = `${npcTokenSize}px`;
  token.style.width  = `${Math.floor(npcTokenSize * 0.72)}px`;
}

// ─────────────────────────────────────────
// TAMANHO DOS TOKENS
// ─────────────────────────────────────────

function applyTokenSize() {
  document.querySelectorAll(".player-token").forEach(t => {
    t.style.height = `${playerTokenSize}px`;
    t.style.width  = `${Math.floor(playerTokenSize * 0.72)}px`;
  });
  document.querySelectorAll(".monster-token").forEach(t => {
    t.style.height = `${npcTokenSize}px`;
    t.style.width  = `${Math.floor(npcTokenSize * 0.72)}px`;
  });
}

function setupTokenSizeControl() {
  const input = document.getElementById("tokenSizeInput");
  const label = document.querySelector(".token-size-control label");
  if (!input) return;

  if (IS_MASTER) {
    if (label) label.innerText = "Tamanho NPC";
    input.value  = npcTokenSize;
    input.oninput = () => {
      npcTokenSize = Number(input.value);
      localStorage.setItem("cthulhu_npc_token_size", npcTokenSize);
      applyTokenSize();
    };
  } else {
    if (label) label.innerText = "Meu Tamanho";
    input.value  = playerTokenSize;
    input.oninput = () => {
      playerTokenSize = Number(input.value);
      localStorage.setItem("cthulhu_player_token_size", playerTokenSize);
      applyTokenSize();
    };
  }
}

// ─────────────────────────────────────────
// MARCADORES NA CIDADE
// ─────────────────────────────────────────

async function refreshCityMarkers() {
  const res  = await fetch("/api/all_characters");
  const data = await res.json();
  const layer = document.getElementById("cityMarkersLayer");
  if (!layer) return;
  layer.innerHTML = "";

  data.characters.forEach(c => {
    if (c.current_map && c.current_map !== "city") {
      renderCityLocationMarker(c.current_map, c.image_url, c.name);
    }
  });
}

function renderCityLocationMarker(mapName, imageUrl, name = "") {
  const hotspot = document.querySelector(`.hotspot[data-map="${mapName}"]`);
  if (!hotspot) return;
  const layer   = document.getElementById("cityMarkersLayer");

  const marker  = document.createElement("div");
  marker.className  = "city-char-marker-box";
  marker.style.left = hotspot.style.left;
  marker.style.top  = `calc(${hotspot.style.top} + 24px)`;
  marker.innerHTML  = `
    <img src="${imageUrl || "/static/images/default_character.png"}"
         onerror="this.src='/static/images/default_character.png'">
    <span>${name}</span>`;
  layer.appendChild(marker);
}

// ─────────────────────────────────────────
// INVENTÁRIO
// ─────────────────────────────────────────

function openItemModal(slot) {
  selectedSlot = slot;
  document.getElementById("itemName").value        = "";
  document.getElementById("itemDescription").value = "";
  openModal("itemModal");
}

function saveItem() {
  const name = document.getElementById("itemName").value.trim();
  const desc = document.getElementById("itemDescription").value.trim();
  if (!name || selectedSlot === null) return;

  const slot = document.querySelector(`.inv-slot[data-slot="${selectedSlot}"]`);
  slot.innerHTML = `
    <div class="inventory-item">
      <span>${name}</span>
      <div class="inventory-hover">
        <h4>${name}</h4>
        <p>${desc}</p>
      </div>
    </div>
    <button class="inv-add" onclick="openItemModal(${selectedSlot})">+</button>`;

  closeModal("itemModal");
}

// ─────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────

async function sendChat() {
  const input = document.getElementById("chatInput");
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = "";

  await fetch("/api/chat/send", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ message: msg })
  });
}

function appendChatMessage(data) {
  const messages = document.getElementById("chatMessages");
  const line = document.createElement("div");
  line.innerHTML = `<b>${data.username}</b> <small>${data.timestamp}</small>: ${data.message}`;
  messages.appendChild(line);
  messages.scrollTop = messages.scrollHeight;
}

// ─────────────────────────────────────────
// EFEITOS VISUAIS NO MAPA
// ─────────────────────────────────────────

function createPing(x, y) {
  const layer = document.getElementById("tokensLayer");
  const ping  = document.createElement("div");
  ping.className = "vtt-ping";
  ping.style.left = `${x}%`;
  ping.style.top  = `${y}%`;
  layer.appendChild(ping);
  setTimeout(() => ping.remove(), 1500);
}

function createDangerMarker(x, y) {
  const layer  = document.getElementById("tokensLayer");
  const marker = document.createElement("div");
  marker.className  = "danger-marker";
  marker.style.left = `${x}%`;
  marker.style.top  = `${y}%`;
  marker.innerText  = "!";
  layer.appendChild(marker);
}

// ─────────────────────────────────────────
// STATS DO PLAYER (HUD)
// ─────────────────────────────────────────

async function changeStat(stat, delta) {
  if (!character) return;

  const caps = { sanity: 99, hp: character.hp_max, mp: character.mp_max };
  character[stat] = Math.max(0, Math.min(caps[stat] ?? 999, Number(character[stat]) + delta));

  updateHUD();

  // Efeito visual na sanidade baixa
  if (stat === "sanity" && character.sanity <= 10) {
    document.body.style.filter = `saturate(${character.sanity / 10})`;
  } else if (stat === "sanity") {
    document.body.style.filter = "";
  }

  await fetch("/api/character/update", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ [stat]: character[stat] })
  });
}

// ─────────────────────────────────────────
// DADOS
// ─────────────────────────────────────────

async function rollDice(dice, purpose = "", skillValue = null) {
  animateDice(dice);

  await fetch("/api/dice/roll", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      dice,
      purpose,
      skill_value: skillValue,
      char_name: character ? character.name : "Desconhecido"
    })
  });
}

function animateDice(dice) {
  const el = document.getElementById("diceAnim");
  if (!el) return;

  const faces = {
    d4:   ["1","2","3","4"],
    d6:   ["⚀","⚁","⚂","⚃","⚄","⚅"],
    d8:   ["1","2","3","4","5","6","7","8"],
    d10:  ["1","2","3","4","5","6","7","8","9","10"],
    d20:  Array.from({ length: 20 }, (_, i) => String(i + 1)),
    d100: ["10","20","30","40","50","60","70","80","90","00"]
  };

  const list = faces[dice] || ["🎲"];
  let i = 0;
  const interval = setInterval(() => {
    el.textContent      = list[Math.floor(Math.random() * list.length)];
    el.style.transform  = "scale(1.3)";
    setTimeout(() => { el.style.transform = "scale(1)"; }, 100);
    if (++i > 10) clearInterval(interval);
  }, 60);
}

function formatRoll(data) {
  let text = `${data.char_name}: ${data.dice_type} = ${data.result}`;
  if (data.purpose)                                      text += ` | ${data.purpose}`;
  if (data.skill_value !== null && data.skill_value !== undefined) text += ` (${data.skill_value}%)`;
  if (data.success_level)                                text += ` — ${data.success_level}`;
  return text;
}

function addRollLog(text, isSuccess) {
  const rollLog = document.getElementById("rollLog");
  const line    = document.createElement("div");
  line.textContent  = text;
  line.style.color  = isSuccess === false ? "#c84a4a"
                    : isSuccess === true  ? "#4ac84a"
                    : "#d4c090";
  rollLog.prepend(line);

  // Limita o log a 50 entradas
  while (rollLog.children.length > 50) rollLog.lastChild.remove();
}

// ─────────────────────────────────────────
// CRIAR NPC (MESTRE)
// ─────────────────────────────────────────

async function createNPC() {
  const name = document.getElementById("npcName").value.trim() || "NPC";
  const file = document.getElementById("npcImage").files[0];

  let imageUrl = "/static/images/default_character.png";

  if (file) {
    const fd  = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) imageUrl = data.url;
  }

  await fetch("/api/monsters/spawn", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      name,
      type:         "npc",
      current_map:  currentMap,
      current_room: currentRoom,
      pos_x:        50,
      pos_y:        50,
      image_url:    imageUrl,
      hp:           1
    })
  });

  document.getElementById("npcName").value  = "";
  document.getElementById("npcImage").value = "";
  closeModal("npcModal");
}

function openNpcModal() { openModal("npcModal"); }

async function masterEvent(effect) {
  await fetch("/api/master/broadcast", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      message: effect === "fog" ? "A névoa toma o lugar..." : "Algo observa vocês.",
      effect
    })
  });
}

// ─────────────────────────────────────────
// MODAIS
// ─────────────────────────────────────────

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("active");
}

// Fecha modal clicando fora
document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", e => {
    if (e.target === modal) closeModal(modal.id);
  });
});

// ─────────────────────────────────────────
// NOTAS DO PLAYER
// ─────────────────────────────────────────

function loadNotes() {
  const ta = document.getElementById("playerNotes");
  if (!ta) return;
  ta.value    = localStorage.getItem("cthulhu_notes") || "";
  ta.oninput  = () => localStorage.setItem("cthulhu_notes", ta.value);
}

// ─────────────────────────────────────────
// PAINÉIS MINIMIZÁVEIS
// ─────────────────────────────────────────

function togglePanel(id) {
  const panel = document.getElementById(id);
  if (panel) panel.classList.toggle("minimized");
}

// ─────────────────────────────────────────
// SOCKET — RECEBER EVENTOS
// ─────────────────────────────────────────

socket.on("online_players_updated", () => {
  if (IS_MASTER) loadMasterPlayers();
});

socket.on("force_logout", data => {
  if (character && character.user_id === data.user_id) {
    window.location.href = "/logout";
  }
});

socket.on("music_control", data => {
  const audio = document.getElementById("bgMusic");
  if (!audio) return;
  if (data.action === "play")   { audio.src = data.src; audio.volume = data.volume ?? 0.5; audio.play(); }
  if (data.action === "stop")   { audio.pause(); audio.currentTime = 0; }
  if (data.action === "mute")   { audio.muted  = data.muted; }
  if (data.action === "volume") { audio.volume = data.volume; }
});

socket.on("character_moved", async data => {
  if (data.current_map === currentMap && data.current_room === currentRoom) {
    renderToken(
      data.user_id,
      data.char_name,
      data.image_url || "/static/images/default_character.png",
      data.pos_x,
      data.pos_y
    );
  }
  await refreshCityMarkers();
});

socket.on("character_updated", data => {
  // Atualiza HUD se for o próprio personagem
  if (character && (data.user_id === character.user_id || data.char_id === character.id)) {
    Object.assign(character, data.updates || {});
    updateHUD();
  }
  // Mestre recarrega o grid de players
  if (IS_MASTER) loadMasterPlayers();
});

socket.on("character_hidden", data => {
  const token = document.querySelector(`[data-token="${data.id}"]`);
  if (token) token.remove();
});

socket.on("monster_spawned", monster => {
  if (monster.current_map === currentMap && monster.current_room === currentRoom) {
    renderMonster(monster);
  }
});

// ── FIX: atualiza posição visual do token em tempo real ──
socket.on("monster_moved", data => {
  const token = document.querySelector(`[data-monster="${data.id}"]`);
  if (token) {
    token.style.left = `${data.pos_x}%`;
    token.style.top  = `${data.pos_y}%`;
  }
});

socket.on("monster_removed", data => {
  const token = document.querySelector(`[data-monster="${data.id}"]`);
  if (token) token.remove();
  // Se era o NPC selecionado, limpa
  if (selectedNpcId === data.id) selectedNpcId = null;
});

socket.on("dice_rolled", data => {
  animateDice(data.dice_type);
  const isSuccess = data.success_level
    ? !data.success_level.includes("Falha")
    : null;
  addRollLog(formatRoll(data), isSuccess);
});

socket.on("chat_message", data => {
  appendChatMessage(data);
});

socket.on("vtt_ping", data => {
  if (data.currentMap === currentMap && data.currentRoom === currentRoom) {
    createPing(data.x, data.y);
  }
});

socket.on("vtt_danger", data => {
  if (data.currentMap === currentMap && data.currentRoom === currentRoom) {
    createDangerMarker(data.x, data.y);
  }
});

socket.on("sanity_changed", data => {
  if (character && data.char_id === character.id) {
    character.sanity = data.sanity;
    updateHUD();
  }
});

socket.on("map_part_changed", async data => {
  currentMap       = data.currentMap;
  currentPartIndex = data.currentPartIndex;
  openCurrentPart();
  document.getElementById("tokensLayer").innerHTML = "";
  await loadAllCharacters();
  await loadMonsters();
});

socket.on("master_event", data => {
  const fogIntro = document.getElementById("fogIntro");

  if (data.effect === "fog" && fogIntro) {
    fogIntro.style.animation = "none";
    void fogIntro.offsetWidth;
    fogIntro.style.animation = "fogReveal 4s forwards";
  }

  if (data.effect === "shake") {
    document.body.animate([
      { transform: "translate(0,0)"   },
      { transform: "translate(8px,0)" },
      { transform: "translate(-8px,0)"},
      { transform: "translate(5px,0)" },
      { transform: "translate(0,0)"   }
    ], { duration: 500 });
  }

  if (data.message) {
    // Notificação flutuante em vez de alert() (não bloqueia)
    showToast(data.message);
  }
});

// ─────────────────────────────────────────
// TOAST — notificação não-bloqueante
// ─────────────────────────────────────────

function showToast(message) {
  let toast = document.getElementById("masterToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "masterToast";
    toast.style.cssText = `
      position:fixed; bottom:120px; left:50%; transform:translateX(-50%);
      background:rgba(10,8,5,0.95); border:1px solid #8b2a1a; color:#c8a84a;
      font-family:'Cinzel',serif; font-size:13px; letter-spacing:2px;
      padding:14px 28px; z-index:9999; pointer-events:none;
      box-shadow:0 0 30px rgba(139,42,26,0.4); text-align:center;
      max-width:400px; opacity:0; transition:opacity 0.4s;
    `;
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.style.opacity = "1";
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.opacity = "0"; }, 4000);
}

// ─────────────────────────────────────────
// CHAT — ENTER para enviar
// ─────────────────────────────────────────

const chatInputEl = document.getElementById("chatInput");
if (chatInputEl) {
  chatInputEl.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); sendChat(); }
  });
}

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────

async function initGame() {
  setupTokenSizeControl();
  await refreshCityMarkers();

  if (IS_MASTER) {
    await loadMasterPlayers();
    setInterval(loadMasterPlayers, 3000);
  } else {
    await loadCharacter();
  }
}

initGame();