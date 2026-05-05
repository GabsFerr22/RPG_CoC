const socket = io();

let currentTool = "move";
let character = null;
let currentPartIndex = 0;
let skills = [];
let currentMap = "city";
let currentRoom = "city";
let tokenSize = Number(localStorage.getItem("cthulhu_token_size")) || 140;

function setVttTool(tool) {
  currentTool = tool;
}

const LOCAL_PARTS = {
  hotel: [
    { name: "Térreo", img: "/static/images/maps/hotel_terreo.png" },
    { name: "1º Andar", img: "/static/images/maps/hotel_1andar.png" },
    { name: "2º Andar", img: "/static/images/maps/hotel_2andar.png" }
  ],
  mansao: [
    { name: "Exterior", img: "/static/images/maps/mansao_valdris.png" },
    { name: "Interior", img: "/static/images/maps/mansao_valdris_terreo.png" },
    { name: "1º Andar", img: "/static/images/maps/mansao_valdris_1andar.png" },
    { name: "2º Andar", img: "/static/images/maps/mansao_valdris_2andar.png" },
    { name: "Porão", img: "/static/images/maps/mansao_valdris_porao.png" }
  ],
  igreja: [
    { name: "Exterior", img: "/static/images/maps/igreja_exterior.png" },
    { name: "Interior", img: "/static/images/maps/igreja_principal.png" },
    { name: "Subsolo", img: "/static/images/maps/igreja_subsolo.png" }
  ],
  mirante: [{ name: "Mirante", img: "/static/images/maps/mirante_esquecido.png" }],
  esgotos: [{ name: "Esgoto", img: "/static/images/maps/esgotos_trieste.png" }],
  cais: [
    { name: "Cais Exterior", img: "/static/images/maps/cais_exterior.png" },
    { name: "Cais Interior", img: "/static/images/maps/cais_interior.png" }
  ],
  delegacia: [{ name: "Delegacia", img: "/static/images/maps/delegacia_central.png" }],
  cafe: [{ name: "Café", img: "/static/images/maps/cafe_imperiale.png" }],
  praca: [{ name: "Praça", img: "/static/images/maps/praca_central.png" }],
  vicolo: [{ name: "Vicolo", img: "/static/images/maps/vicolo_del_muschio.png" }],
  farmacia: [
    { name: "Exterior", img: "/static/images/maps/farmacia_weiss_exterior.png" },
    { name: "Interior", img: "/static/images/maps/farmacia_weiss.png" }
  ],
  prefeitura: [
    { name: "Exterior", img: "/static/images/maps/prefeitura_exterior.png" },
    { name: "Interior", img: "/static/images/maps/prefeitura_interior.png" }
  ],
  cemiterio: [
    { name: "Exterior", img: "/static/images/maps/cemiterio_exterior.png" },
    { name: "Covas", img: "/static/images/maps/cemiterio_covas.png" },
    { name: "Coveiro", img: "/static/images/maps/cemiterio_coveiro.png" },
    { name: "Sessão F", img: "/static/images/maps/cemiterio_familiar.png" }
  ]
};

async function createNPC() {
  const name = document.getElementById("npcName").value || "NPC";
  const file = document.getElementById("npcImage").files[0];

  let imageUrl = "/static/images/default_character.png";

  if (file) {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    imageUrl = data.url;
  }

  await fetch("/api/monsters/spawn", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      name,
      type: "npc",
      current_map: currentMap,
      current_room: currentRoom,
      pos_x: 50,
      pos_y: 50,
      image_url: imageUrl,
      hp: 1
    })
  });

  closeModal("npcModal");
}

function openNpcModal() {
  openModal("npcModal");
}

async function loadCharacter() {
  const res = await fetch("/api/character");
  const data = await res.json();

  character = data.character;
  skills = data.skills || [];

  charName.innerText = character.name;
  charImage.src = character.image_url;

  sanity.innerText = character.sanity;
  hp.innerText = `${character.hp}/${character.hp_max}`;
  credit.innerText = character.credit_rating;
  mp.innerText = `${character.mp}/${character.mp_max}`;
  mov.innerText = character.movement;

  skillsList.innerHTML = "";
  skills.forEach(skill => {
    const div = document.createElement("div");
    div.className = "skill";
    div.innerHTML = `<span>${skill.name}</span><strong>${skill.current_value}</strong>`;
    div.onclick = () => rollDice("d100", skill.name, skill.current_value);
    skillsList.appendChild(div);
  });

  inventory.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const slot = document.createElement("div");
    slot.className = "inv-slot";
    inventory.appendChild(slot);
  }

  fillSheetModal();
  loadNotes();
  setupTokenSizeControl();
  await refreshCityMarkers();
}

function fillSheetModal() {
  modalCharName.innerText = character.name;

  modalSheet.innerHTML = `
    <p><b>Sanidade:</b> ${character.sanity}/${character.sanity_max}</p>
    <p><b>Vida:</b> ${character.hp}/${character.hp_max}</p>
    <p><b>Magia:</b> ${character.mp}/${character.mp_max}</p>
    <p><b>Crédito:</b> ${character.credit_rating}</p>
    <p><b>MOV:</b> ${character.movement}</p>
    <hr>
    <p><b>FOR:</b> ${character.strength}</p>
    <p><b>CON:</b> ${character.constitution}</p>
    <p><b>TAM:</b> ${character.size}</p>
    <p><b>DES:</b> ${character.dexterity}</p>
    <p><b>APA:</b> ${character.appearance}</p>
    <p><b>INT:</b> ${character.intelligence}</p>
    <p><b>POD:</b> ${character.power}</p>
    <p><b>EDU:</b> ${character.education}</p>
    <p><b>SORTE:</b> ${character.luck}</p>
    <hr>
    ${skills.map(s => `<p>${s.name}: <b>${s.current_value}</b></p>`).join("")}
  `;
}

document.querySelectorAll(".hotspot").forEach(btn => {
  btn.addEventListener("click", async () => {
    await openLocalMap(btn.dataset.map);
  });
});

async function openLocalMap(mapName) {
  currentMap = mapName;
  currentPartIndex = 0;

  openCurrentPart();

  tokensLayer.innerHTML = "";

  await moveMyToken(50, 70);
  await loadAllCharacters();
  await loadMonsters();
  await refreshCityMarkers();
}

function openCurrentPart() {
  const parts = LOCAL_PARTS[currentMap] || [];
  const part = parts[currentPartIndex];

  if (!part) return;

  currentRoom = `${currentMap}_${part.name}`;

  localMap.src = part.img;
  localMap.classList.remove("hidden");
  localTitle.innerText = `${currentMap.toUpperCase()} — ${part.name}`;

  const partName = document.getElementById("partName");
  if (partName) partName.innerText = part.name;
}

async function changeMapPart(direction) {
  if (!IS_MASTER) return;

  const parts = LOCAL_PARTS[currentMap] || [];
  if (!parts.length) return;

  currentPartIndex += direction;

  if (currentPartIndex < 0) currentPartIndex = parts.length - 1;
  if (currentPartIndex >= parts.length) currentPartIndex = 0;

  openCurrentPart();

  tokensLayer.innerHTML = "";
  await loadAllCharacters();
  await loadMonsters();

  socket.emit("map_part_changed", { currentMap, currentPartIndex });
}

async function moveMyToken(x, y) {
  if (!character || currentMap === "city") return;

  character.pos_x = x;
  character.pos_y = y;
  character.current_map = currentMap;
  character.current_room = currentRoom;

  renderToken(character.id, character.name, character.image_url, x, y);

  await fetch("/api/character/move", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      current_map: currentMap,
      current_room: currentRoom,
      pos_x: x,
      pos_y: y,
      char_name: character.name,
      image_url: character.image_url
    })
  });
}

localStage.onclick = async (e) => {
  if (e.target.closest(".token")) return;
  if (!character || currentMap === "city") return;

  const rect = localStage.getBoundingClientRect();
  let x = ((e.clientX - rect.left) / rect.width) * 100;
  let y = ((e.clientY - rect.top) / rect.height) * 100;

  x = Math.max(0, Math.min(100, x));
  y = Math.max(0, Math.min(100, y));

  if (IS_MASTER && currentTool === "ping") {
    createPing(x, y);
    socket.emit("vtt_ping", { x, y, currentMap, currentRoom });
    return;
  }

  if (IS_MASTER && currentTool === "danger") {
    createDangerMarker(x, y);
    socket.emit("vtt_danger", { x, y, currentMap, currentRoom });
    return;
  }

  if (currentTool === "move") {
    await moveMyToken(x, y);
  }
};

async function loadAllCharacters() {
  const res = await fetch(`/api/all_characters?map=${currentMap}&room=${currentRoom}`);
  const data = await res.json();

  tokensLayer.innerHTML = "";
  data.characters.forEach(c => {
    renderToken(c.id, c.name, c.image_url, c.pos_x, c.pos_y);
  });
}

async function loadMonsters() {
  const res = await fetch(`/api/monsters?map=${currentMap}&room=${currentRoom}`);
  const data = await res.json();
  data.monsters.forEach(m => renderMonster(m));
}

function applyTokenSize() {
  document.querySelectorAll(".token[data-token]").forEach(token => {
    token.style.height = `${tokenSize}px`;
    token.style.width = `${Math.floor(tokenSize * 0.72)}px`;
  });

  document.querySelectorAll(".token[data-monster]").forEach(token => {
    token.style.height = `${tokenSize}px`;
    token.style.width = `${Math.floor(tokenSize * 0.72)}px`;
  });
}

function renderToken(id, name, image, x, y) {
  let token = document.querySelector(`[data-token="${id}"]`);

  if (!token) {
    token = document.createElement("div");
    token.className = "token player-token";
    token.dataset.token = id;
    token.title = name;
    token.innerHTML = `<img src="${image || "/static/images/default_character.png"}">`;
    tokensLayer.appendChild(token);
  }

  token.style.left = `${x}%`;
  token.style.top = `${y}%`;
  token.style.height = `${tokenSize}px`;
  token.style.width = `${Math.floor(tokenSize * 0.72)}px`;
}

function renderMonster(monster) {
  let token = document.querySelector(`[data-monster="${monster.id}"]`);

  if (!token) {
    token = document.createElement("div");
    token.className = `token monster-token ${monster.type === "npc" ? "npc-token" : ""}`;
    token.dataset.monster = monster.id || Date.now();
    token.title = monster.name;
    token.innerHTML = `<img src="${monster.image_url || "/static/images/default_monster.png"}">`;
    tokensLayer.appendChild(token);

    token.onclick = async (e) => {
      e.stopPropagation();
      if (!IS_MASTER || currentTool !== "move") return;

      const rect = localStage.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;

      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      await fetch(`/api/monsters/move/${monster.id}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ pos_x: x, pos_y: y })
      });
    };
  }

  token.style.left = `${monster.pos_x}%`;
  token.style.top = `${monster.pos_y}%`;
  token.style.height = `${tokenSize}px`;
  token.style.width = `${Math.floor(tokenSize * 0.72)}px`;
}

async function refreshCityMarkers() {
  const res = await fetch(`/api/all_characters`);
  const data = await res.json();

  cityMarkersLayer.innerHTML = "";

  data.characters.forEach(c => {
    if (c.current_map && c.current_map !== "city") {
      renderCityLocationMarker(c.current_map, c.image_url, c.name);
    }
  });
}

function renderCityLocationMarker(mapName, imageUrl, name = "") {
  const hotspot = document.querySelector(`.hotspot[data-map="${mapName}"]`);
  if (!hotspot) return;

  const marker = document.createElement("div");
  marker.className = "city-char-marker-box";
  marker.style.left = hotspot.style.left;
  marker.style.top = `calc(${hotspot.style.top} + 30px)`;

  marker.innerHTML = `
    <img src="${imageUrl || "/static/images/default_character.png"}">
    <span>${name}</span>
  `;

  cityMarkersLayer.appendChild(marker);
}

function createPing(x, y) {
  const ping = document.createElement("div");
  ping.className = "vtt-ping";
  ping.style.left = `${x}%`;
  ping.style.top = `${y}%`;
  tokensLayer.appendChild(ping);
  setTimeout(() => ping.remove(), 1500);
}

function createDangerMarker(x, y) {
  const marker = document.createElement("div");
  marker.className = "danger-marker";
  marker.style.left = `${x}%`;
  marker.style.top = `${y}%`;
  marker.innerText = "!";
  tokensLayer.appendChild(marker);
}

async function changeStat(stat, delta) {
  if (!character) return;

  character[stat] = Math.max(0, character[stat] + delta);
  if (stat === "sanity") character[stat] = Math.min(99, character[stat]);

  sanity.innerText = character.sanity;

  await fetch("/api/character/update", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      [stat]: character[stat],
      char_name: character.name
    })
  });
}

async function rollDice(dice, purpose = "", skillValue = null) {
  await fetch("/api/dice/roll", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
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
    d6: ["⚀","⚁","⚂","⚃","⚄","⚅"],
    d10: ["1","2","3","4","5","6","7","8","9","10"],
    d20: Array.from({length:20},(_,i)=>i+1),
    d100: ["10","20","30","40","50","60","70","80","90","00"]
  };

  const list = faces[dice] || ["🎲"];

  let i = 0;
  const interval = setInterval(() => {
    el.textContent = list[Math.floor(Math.random()*list.length)];
    el.style.transform = "scale(1.3)";
    setTimeout(() => el.style.transform = "scale(1)", 100);
    i++;
    if (i > 10) clearInterval(interval);
  }, 60);
}

function formatRoll(data) {
  let text = `${data.char_name}: ${data.dice_type} = ${data.result}`;
  if (data.purpose) text += ` (${data.purpose})`;
  if (data.is_success !== null) text += data.is_success ? " — Sucesso" : " — Falha";
  return text;
}

function addRollLog(text) {
  const line = document.createElement("div");
  line.textContent = text;
  rollLog.prepend(line);
}

async function spawnMonster() {
  const name = monsterName.value || "Cultista";

  await fetch("/api/monsters/spawn", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      name,
      current_map: currentMap,
      current_room: currentRoom,
      pos_x: 50,
      pos_y: 50,
      hp: 10,
      image_url: "/static/images/default_monster.png"
    })
  });
}

async function masterEvent(effect) {
  await fetch("/api/master/broadcast", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      message: effect === "fog" ? "A névoa toma a cidade..." : "Algo observa vocês.",
      effect
    })
  });
}

function openModal(id) {
  document.getElementById(id).classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

function loadNotes() {
  playerNotes.value = localStorage.getItem("cthulhu_notes") || "";
  playerNotes.oninput = () => {
    localStorage.setItem("cthulhu_notes", playerNotes.value);
  };
}

function setupTokenSizeControl() {
  const input = document.getElementById("tokenSizeInput");
  if (!input) return;

  input.value = tokenSize;

  input.oninput = () => {
    tokenSize = Number(input.value);
    localStorage.setItem("cthulhu_token_size", tokenSize);
    applyTokenSize();
  };
}

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

socket.on("monster_moved", data => {
  const token = document.querySelector(`[data-monster="${data.id}"]`);
  if (token) {
    token.style.left = `${data.pos_x}%`;
    token.style.top = `${data.pos_y}%`;
  }
});

socket.on("monster_spawned", monster => {
  if (monster.current_map === currentMap && monster.current_room === currentRoom) {
    renderMonster(monster);
  }
});

socket.on("monster_removed", data => {
  const token = document.querySelector(`[data-monster="${data.id}"]`);
  if (token) token.remove();
});

socket.on("dice_rolled", data => {
  animateDice(data.dice_type);
  addRollLog(formatRoll(data));
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
    sanity.innerText = data.sanity;
  }
});

socket.on("master_event", data => {
  if (data.effect === "fog") {
    fogIntro.style.animation = "none";
    void fogIntro.offsetWidth;
    fogIntro.style.animation = "fogReveal 4s forwards";
  }

  if (data.effect === "shake") {
    document.body.animate([
      { transform: "translate(0,0)" },
      { transform: "translate(8px,0)" },
      { transform: "translate(-8px,0)" },
      { transform: "translate(0,0)" }
    ], { duration: 450 });
  }

  alert(data.message);
});

socket.on("map_part_changed", async data => {
  if (IS_MASTER) return;

  currentMap = data.currentMap;
  currentPartIndex = data.currentPartIndex;

  openCurrentPart();

  tokensLayer.innerHTML = "";
  await loadAllCharacters();
  await loadMonsters();
});

loadCharacter();