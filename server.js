const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

const rooms = new Map();
const battleSkillFallback = [
  'Technique spéciale','Frappe renforcée','Défense ultime','Attaque élémentaire'
];
const passives = [
  '🩸 Berserker : plus les PV baissent, plus les dégâts augmentent',
  '🛡️ Gardien : la première attaque reçue est réduite de moitié',
  '⚡ Instinct : une chance d’esquiver une attaque',
  '🔥 Dernier souffle : une fois par combat, survit à 1 PV',
  '💚 Régénération : récupère quelques PV au début de son tour',
  '🎭 Adaptation : après avoir subi une compétence, gagne un bonus temporaire',
  '👁️ Précognition : le premier tour adverse inflige moins de dégâts',
  '☠️ Malédiction secrète : la dernière attaque peut appliquer des dégâts bonus'
];

const universeSkills = {
  "Mushoku Tensei":["Incantation silencieuse","Détection magique","Lame de mana","Magie de pierre"],
  "Tensura Slime":["Gluttony","Barrière multicouche","Aura de domination","Prédation"],
  "Re:Zero":["Retour par la mort","Magie Yin","Autorité mystérieuse","Renforcement spirituel"],
  "Hunter x Hunter":["Renforcement du Nen","Bungee Gum","Jajanken","Godspeed"],
  "JoJo (Parties 1-6)":["Hamon","Star Platinum","Crazy Diamond","Golden Experience","Stone Free"],
  "Chainsaw Man":["Transformation démoniaque","Contrat démoniaque","Tranchage brutal","Régénération sanguine"],
  "Jujutsu Kaisen":["Énergie occulte","Extension de territoire","Technique innée","Black Flash"],
  "Undertale / Deltarune":["Garde","Âme déterminée","Gaster Blaster","Magie de l’âme"],
  "Genshin Impact":["Vision élémentaire","Réaction élémentaire","Déchaînement élémentaire","Compétence élémentaire"],
  "Honkai: Star Rail":["Technique de voie","Ultime de voie","Frappe de rupture","Effet de faiblesse"],
  "Zenless Zone Zero":["Esquive parfaite","Chaîne d’attaque","Attribut anomalie","Ultime d’agent"],
  "Demon Slayer":["Souffle de l’eau","Souffle du tonnerre","Danse du dieu du feu","Respiration de la bête"],
  "SNK / Attack on Titan":["Manœuvre tridimensionnelle","Lame anti-titan","Transformation titan","Frappe ciblée"],
  "Seven Deadly Sins":["Full Counter","Chastiefol","Snatch","Pouvoir sacré"],
  "Death Note":["Nom dans le Death Note","Observation","Manipulation psychologique","Œil du shinigami"],
  "Bleach":["Shunpo","Zanpakutō","Bankai","Getsuga Tenshō"],
  "KonoSuba":["Explosion","Steal","Soin divin","Darkness — provocation"]
};

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function makeRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).slice(2, 7).toUpperCase();
  } while (rooms.has(code));
  return code;
}
function send(ws, type, data = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}
function broadcast(room, type, data = {}) {
  for (const p of room.players) send(p.ws, type, data);
}
function publicPlayers(room) {
  return room.players.map(p => ({ id:p.id, name:p.name }));
}
function findPlayer(room, ws) {
  return room.players.find(p => p.ws === ws);
}
function getRoom(ws) {
  const p = [...rooms.values()].flatMap(r => r.players).find(x => x.ws === ws);
  if (!p) return null;
  return rooms.get(p.roomCode) || null;
}
function cleanRoomIfEmpty(room) {
  if (room && room.players.length === 0) rooms.delete(room.code);
}
function nextAliveIndex(players, currentId) {
  const start = players.findIndex(p => p.id === currentId);
  for (let step = 1; step <= players.length; step++) {
    const p = players[(start + step) % players.length];
    if (p && p.hp > 0) return p.id;
  }
  return currentId;
}

function battlePublicState(room) {
  return {
    players: room.players.map(p => ({
      id:p.id, name:p.name, hp:p.hp, maxHp:p.maxHp,
      skills:p.id === room._viewerId ? p.skills : [],
      passive:p.id === room._viewerId ? p.passive : 'Passif secret'
    })),
    turn: room.game.turn,
    over: room.game.over,
    log: room.game.log
  };
}
function sendBattleState(room) {
  for (const viewer of room.players) {
    room._viewerId = viewer.id;
    send(viewer.ws, 'battle_state', battlePublicState(room));
  }
  delete room._viewerId;
}

function startBattle(room, selectedUniverses) {
  let pool = [];
  for (const u of (Array.isArray(selectedUniverses) ? selectedUniverses : [])) {
    if (universeSkills[u]) pool.push(...universeSkills[u]);
  }
  if (!pool.length) pool = Object.values(universeSkills).flat();

  room.players.forEach(p => {
    p.maxHp = 100;
    p.hp = 100;
    p.power = rand([65,70,75,80,85,90,95]);
    p.skills = shuffle(pool).slice(0, 4);
    while (p.skills.length < 4) p.skills.push(rand(battleSkillFallback));
    p.passive = rand(passives);
    p.usedPassive = false;
    p.guard = false;
  });

  room.game = {
    turn: room.players[0].id,
    over: false,
    log: 'Le combat commence !'
  };
  room.mode = 'battle';
  sendBattleState(room);
}

function handleBattleAction(room, p, msg) {
  if (!room.game || room.game.over) return;
  if (room.game.turn !== p.id) return send(p.ws, 'error', {message:'Ce n’est pas ton tour.'});
  if (p.hp <= 0) return;

  const skillIndex = Number(msg.skillIndex);
  if (!Number.isInteger(skillIndex) || skillIndex < 0 || skillIndex >= p.skills.length) {
    return send(p.ws, 'error', {message:'Compétence invalide.'});
  }

  const targets = room.players.filter(x => x.hp > 0 && x.id !== p.id);
  if (!targets.length) return;

  const target = rand(targets);
  const skill = p.skills[skillIndex];
  let damage = clamp(Math.round(p.power * 0.42 + Math.random() * 24), 8, 58);

  if (p.hp < 35) damage += 10;
  if (target.guard) {
    damage = Math.round(damage * 0.5);
    target.guard = false;
  }

  if (!p.usedPassive && p.passive.includes('Instinct') && Math.random() < 0.12) {
    p.usedPassive = true;
    damage = 0;
  }
  if (!p.usedPassive && p.passive.includes('Dernier souffle') && target.hp - damage <= 0) {
    damage = Math.max(0, target.hp - 1);
    p.usedPassive = true;
  }

  target.hp = clamp(target.hp - damage, 0, 100);

  let log = `Tour de ${p.name} — ${p.name} utilise « ${skill} » et inflige ${damage} dégâts à ${target.name}.`;
  if (!p.usedPassive && p.passive.includes('Régénération')) {
    p.hp = clamp(p.hp + 8, 0, 100);
    log += ` ${p.name} récupère 8 PV.`;
  }
  room.game.log += `\n${log}`;

  if (target.hp <= 0) room.game.log += `\n💥 ${target.name} est K.O.`;

  const alive = room.players.filter(x => x.hp > 0);
  if (alive.length <= 1) {
    room.game.over = true;
    room.game.log += alive.length ? `\n\n🏆 ${alive[0].name} remporte le combat !` : '\n\n💀 Tout le monde est K.O.';
  } else {
    room.game.turn = nextAliveIndex(room.players, p.id);
  }

  sendBattleState(room);
}

function startGuess(room) {
  if (room.players.length !== 2) {
    return broadcast(room, 'error', {message:'Il faut exactement 2 joueurs pour Qui est-ce ?'});
  }

  const pool = Object.entries(universeSkills)
    .flatMap(([u]) => [{name:u, universe:u}]);
  // A compact server-side character list, independent from the client.
  const names = [
    ['Rudeus Greyrat','Mushoku Tensei'],['Rimuru Tempest','Tensura Slime'],
    ['Subaru Natsuki','Re:Zero'],['Gon Freecss','Hunter x Hunter'],
    ['Jotaro Kujo','JoJo (Parties 1-6)'],['Denji','Chainsaw Man'],
    ['Yuji Itadori','Jujutsu Kaisen'],['Sans','Undertale / Deltarune'],
    ['Raiden Shogun','Genshin Impact'],['Kafka','Honkai: Star Rail'],
    ['Ellen Joe','Zenless Zone Zero'],['Tanjiro Kamado','Demon Slayer'],
    ['Levi Ackerman','SNK / Attack on Titan'],['Meliodas','Seven Deadly Sins'],
    ['L','Death Note'],['Ichigo Kurosaki','Bleach'],['Megumin','KonoSuba']
  ].map(([name,universe]) => ({name,universe}));

  room.game = {
    turn: room.players[0].id,
    characters: [rand(names), rand(names)],
    log: '🎲 Partie commencée.'
  };
  room.mode = 'guess';

  room.players.forEach((p, i) => {
    send(p.ws, 'guess_start', {
      myCharacter: room.game.characters[i].name,
      turn: room.game.turn
    });
  });
}

function handleGuessQuestion(room, p, question) {
  if (!room.game || room.mode !== 'guess') return;
  if (room.game.turn !== p.id) return send(p.ws, 'error', {message:'Ce n’est pas ton tour.'});
  const other = room.players.find(x => x.id !== p.id);
  if (!other) return;
  send(other.ws, 'guess_question', {question:String(question || '').slice(0,300)});
}
function handleGuessAnswer(room, p, answer) {
  if (!room.game || room.mode !== 'guess') return;
  const other = room.players.find(x => x.id !== p.id);
  if (!other) return;
  send(other.ws, 'guess_answer', {answer:String(answer || '').slice(0,50)});
  room.game.turn = other.id;
  room.game.log = `🗣️ ${p.name} répond : ${answer}`;
  broadcastGuessState(room);
}
function broadcastGuessState(room) {
  for (const viewer of room.players) {
    send(viewer.ws, 'guess_state', {
      turn: room.game.turn,
      log: room.game.log
    });
  }
}
function handleGuess(room, p, guess) {
  if (!room.game || room.mode !== 'guess') return;
  if (room.game.turn !== p.id) return send(p.ws, 'error', {message:'Ce n’est pas ton tour.'});

  const idx = room.players.findIndex(x => x.id === p.id);
  const opponentIndex = idx === 0 ? 1 : 0;
  const target = room.game.characters[opponentIndex];
  const ok = String(guess || '').trim().toLowerCase() === target.name.toLowerCase();

  if (ok) {
    room.game.log = `🎉 ${p.name} a trouvé : ${target.name}.`;
    for (const viewer of room.players) {
      send(viewer.ws, 'guess_end', {message:room.game.log});
    }
  } else {
    room.game.log = `❌ ${p.name} se trompe.`;
    room.game.turn = room.players[opponentIndex].id;
    broadcastGuessState(room);
  }
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    pathname = '/';
  }

  if (pathname === '/') pathname = '/index.html';

  const file = path.join(__dirname, pathname);
  if (!file.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
      return res.end('Not Found');
    }
    const ext = path.extname(file).toLowerCase();
    const types = {
      '.html':'text/html; charset=utf-8',
      '.js':'text/javascript; charset=utf-8',
      '.json':'application/json; charset=utf-8',
      '.css':'text/css; charset=utf-8'
    };
    res.writeHead(200, {'Content-Type':types[ext] || 'application/octet-stream'});
    res.end(data);
  });
});

const wss = new WebSocket.Server({server});

wss.on('connection', ws => {
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch { return send(ws, 'error', {message:'Message JSON invalide.'}); }

    const type = msg.type;

    if (type === 'create_room') {
      const mode = msg.mode === 'guess' ? 'guess' : 'battle';
      const roomCode = makeRoomCode();
      const player = {
        ws, id:1, name:String(msg.name || 'Joueur').slice(0,30),
        roomCode
      };
      const room = {
        code:roomCode, mode, hostId:1, nextId:2,
        players:[player], game:null
      };
      rooms.set(roomCode, room);
      send(ws, 'room_created', {
        code:roomCode, playerId:1, host:true, mode, players:publicPlayers(room)
      });
      return;
    }

    if (type === 'join_room') {
      const code = String(msg.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return send(ws, 'error', {message:'Salle introuvable.'});
      const max = room.mode === 'guess' ? 2 : 4;
      if (room.players.length >= max) return send(ws, 'error', {message:'La salle est pleine.'});
      if (room.game) return send(ws, 'error', {message:'La partie a déjà commencé.'});

      const id = room.nextId++;
      const player = {
        ws, id, name:String(msg.name || 'Joueur').slice(0,30),
        roomCode:code
      };
      room.players.push(player);

      send(ws, 'room_joined', {
        code, playerId:id, host:false, mode:room.mode, players:publicPlayers(room)
      });
      broadcast(room, 'room_update', {players:publicPlayers(room)});
      return;
    }

    const room = getRoom(ws);
    const player = room && findPlayer(room, ws);

    if (type === 'leave_room') {
      if (!room || !player) return;
      room.players = room.players.filter(p => p !== player);
      if (room.players.length) {
        if (room.hostId === player.id) room.hostId = room.players[0].id;
        broadcast(room, 'room_update', {players:publicPlayers(room)});
      }
      cleanRoomIfEmpty(room);
      return;
    }

    if (!room || !player) return send(ws, 'error', {message:'Tu n’es dans aucune salle.'});

    if (type === 'start_battle') {
      if (player.id !== room.hostId) return send(ws, 'error', {message:'Seul l’hôte peut lancer la partie.'});
      if (room.players.length < 2) return send(ws, 'error', {message:'Il faut au moins 2 joueurs.'});
      startBattle(room, msg.universes);
      return;
    }

    if (type === 'battle_action') {
      handleBattleAction(room, player, msg);
      return;
    }

    if (type === 'start_guess') {
      if (player.id !== room.hostId) return send(ws, 'error', {message:'Seul l’hôte peut lancer la partie.'});
      startGuess(room);
      return;
    }

    if (type === 'guess_question') {
      handleGuessQuestion(room, player, msg.question);
      return;
    }

    if (type === 'guess_answer') {
      handleGuessAnswer(room, player, msg.answer);
      return;
    }

    if (type === 'guess_guess') {
      handleGuess(room, player, msg.guess);
      return;
    }

    send(ws, 'error', {message:'Commande inconnue.'});
  });

  ws.on('close', () => {
    const room = getRoom(ws);
    const player = room && findPlayer(room, ws);
    if (!room || !player) return;

    room.players = room.players.filter(p => p !== player);
    if (room.players.length) {
      if (room.hostId === player.id) room.hostId = room.players[0].id;
      broadcast(room, 'room_update', {players:publicPlayers(room)});
    }
    cleanRoomIfEmpty(room);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Anime Multiverse server listening on ${HOST}:${PORT}`);
});
