const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

const universes = {
  "Mushoku Tensei": [
    "Rudeus Greyrat",
    "Sylphiette",
    "Eris Boreas Greyrat",
    "Roxy Migurdia"
  ],

  "Tensura Slime": [
    "Rimuru Tempest",
    "Milim Nava",
    "Benimaru",
    "Shion"
  ],

  "Re:Zero": [
    "Subaru Natsuki",
    "Emilia",
    "Rem",
    "Ram"
  ],

  "Hunter x Hunter": [
    "Gon Freecss",
    "Killua Zoldyck",
    "Kurapika",
    "Hisoka"
  ],

  "JoJo (Parties 1-6)": [
    "Jonathan Joestar",
    "Joseph Joestar",
    "Jotaro Kujo",
    "Josuke Higashikata",
    "Giorno Giovanna",
    "Jolyne Cujoh"
  ],

  "Chainsaw Man": [
    "Denji",
    "Power",
    "Makima",
    "Aki Hayakawa"
  ],

  "Jujutsu Kaisen": [
    "Yuji Itadori",
    "Megumi Fushiguro",
    "Nobara Kugisaki",
    "Satoru Gojo"
  ],

  "Undertale / Deltarune": [
    "Frisk",
    "Sans",
    "Papyrus",
    "Kris",
    "Susie",
    "Ralsei"
  ],

  "Genshin Impact": [
    "Lumine",
    "Aether",
    "Paimon",
    "Raiden Shogun"
  ],

  "Honkai: Star Rail": [
    "Trailblazer",
    "March 7th",
    "Dan Heng",
    "Kafka"
  ],

  "Zenless Zone Zero": [
    "Wise",
    "Belle",
    "Anby Demara",
    "Ellen Joe"
  ],

  "Demon Slayer": [
    "Tanjiro Kamado",
    "Nezuko Kamado",
    "Zenitsu Agatsuma",
    "Inosuke Hashibira"
  ],

  "SNK / Attack on Titan": [
    "Eren Yeager",
    "Mikasa Ackerman",
    "Armin Arlert",
    "Levi Ackerman"
  ],

  "Seven Deadly Sins": [
    "Meliodas",
    "Elizabeth Liones",
    "Ban",
    "King"
  ],

  "Death Note": [
    "Light Yagami",
    "L",
    "Misa Amane",
    "Ryuk"
  ],

  "Bleach": [
    "Ichigo Kurosaki",
    "Rukia Kuchiki",
    "Orihime Inoue",
    "Byakuya Kuchiki"
  ],

  "KonoSuba": [
    "Kazuma Satou",
    "Aqua",
    "Megumin",
    "Darkness"
  ]
};

const skillSets = {
  "Mushoku Tensei": [
    "Incantation silencieuse",
    "Détection magique",
    "Lame de mana",
    "Magie de pierre"
  ],

  "Tensura Slime": [
    "Gluttony",
    "Barrière multicouche",
    "Aura de domination",
    "Prédation"
  ],

  "Re:Zero": [
    "Retour par la mort",
    "Magie Yin",
    "Autorité mystérieuse",
    "Renforcement spirituel"
  ],

  "Hunter x Hunter": [
    "Renforcement du Nen",
    "Bungee Gum",
    "Jajanken",
    "Godspeed"
  ],

  "JoJo (Parties 1-6)": [
    "Hamon",
    "Star Platinum",
    "Crazy Diamond",
    "Golden Experience",
    "Stone Free"
  ],

  "Chainsaw Man": [
    "Transformation démoniaque",
    "Contrat démoniaque",
    "Tranchage brutal",
    "Régénération sanguine"
  ],

  "Jujutsu Kaisen": [
    "Énergie occulte",
    "Extension de territoire",
    "Technique innée",
    "Black Flash"
  ],

  "Undertale / Deltarune": [
    "Garde",
    "Âme déterminée",
    "Gaster Blaster",
    "Magie de l'âme"
  ],

  "Genshin Impact": [
    "Vision élémentaire",
    "Réaction élémentaire",
    "Déchaînement élémentaire",
    "Compétence élémentaire"
  ],

  "Honkai: Star Rail": [
    "Technique de voie",
    "Ultime de voie",
    "Frappe de rupture",
    "Effet de faiblesse"
  ],

  "Zenless Zone Zero": [
    "Esquive parfaite",
    "Chaîne d'attaque",
    "Attribut anomalie",
    "Ultime d'agent"
  ],

  "Demon Slayer": [
    "Souffle de l'eau",
    "Souffle du tonnerre",
    "Danse du dieu du feu",
    "Respiration de la bête"
  ],

  "SNK / Attack on Titan": [
    "Manœuvre tridimensionnelle",
    "Lame anti-titan",
    "Transformation titan",
    "Frappe ciblée"
  ],

  "Seven Deadly Sins": [
    "Full Counter",
    "Chastiefol",
    "Snatch",
    "Pouvoir sacré"
  ],

  "Death Note": [
    "Nom dans le Death Note",
    "Observation",
    "Manipulation psychologique",
    "Œil du shinigami"
  ],

  "Bleach": [
    "Shunpo",
    "Zanpakutō",
    "Bankai",
    "Getsuga Tenshō"
  ],

  "KonoSuba": [
    "Explosion",
    "Steal",
    "Soin divin",
    "Darkness — provocation"
  ]
};

const passives = [
  "Berserker : plus les PV baissent, plus les dégâts augmentent",
  "Gardien : la première attaque reçue est réduite de moitié",
  "Instinct : une chance d'esquiver une attaque",
  "Dernier souffle : une fois par combat, survit à 1 PV",
  "Régénération : récupère quelques PV au début de son tour",
  "Adaptation : après avoir subi une compétence, gagne un bonus temporaire",
  "Précognition : le premier tour adverse inflige moins de dégâts",
  "Malédiction : la dernière attaque peut appliquer des dégâts bonus"
];

const chars = Object.entries(universes).flatMap(
  ([u, cs]) => cs.map(name => ({
    name,
    universe: u
  }))
);

const rooms = new Map();

function rand(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function code() {
  let c;

  do {
    c = Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase();
  } while (rooms.has(c));

  return c;
}

function send(ws, msg) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

function playersView(room) {
  return room.players.map(p => ({
    id: p.id,
    name: p.name
  }));
}

function broadcast(room, msg) {
  room.players.forEach(p => send(p.ws, msg));
}

function selectedPool(list) {
  const selected =
    list && list.length
      ? list
      : Object.keys(skillSets);

  return selected.flatMap(
    universe => skillSets[universe] || []
  );
}

/* =========================
   COMBAT
========================= */

function battleStateFor(room, viewer) {
  return {
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      hp: p.hp,
      power: p.power,

      skills:
        p.id === viewer
          ? [...p.skills]
          : [],

      passive:
        p.id === viewer
          ? p.passive
          : "Passif secret"
    })),

    turn: room.game.turn,
    over: room.game.over,
    log: room.game.log
  };
}

function sendBattle(room) {
  room.players.forEach(p => {
    send(p.ws, {
      type: "battle_state",
      state: battleStateFor(room, p.id)
    });
  });
}

function startBattle(room, selected) {
  const pool = selectedPool(selected);

  room.game = {
    type: "battle",
    turn: room.players[0].id,
    over: false,
    log: "⚔️ Le combat commence !"
  };

  room.players.forEach(p => {
    p.hp = 100;

    p.power =
      65 +
      Math.floor(Math.random() * 31);

    p.skills = [...pool]
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);

    p.passive = rand(passives);
    p.usedPassive = false;
    p.guard = false;
  });

  room.started = true;

  sendBattle(room);
}

function alive(room) {
  return room.players.filter(
    p => p.hp > 0
  );
}

function nextTurn(room, currentId) {
  const currentIndex =
    room.players.findIndex(
      p => p.id === currentId
    );

  if (currentIndex === -1) return;

  let next =
    (currentIndex + 1) %
    room.players.length;

  let count = 0;

  while (
    room.players[next].hp <= 0 &&
    count < room.players.length
  ) {
    next =
      (next + 1) %
      room.players.length;

    count++;
  }

  if (room.players[next].hp > 0) {
    room.game.turn =
      room.players[next].id;
  }
}

function battleAction(room, player, skillIndex) {
  if (
    room.game.over ||
    room.game.turn !== player.id ||
    player.hp <= 0
  ) {
    return;
  }

  const targets = alive(room).filter(
    p => p.id !== player.id
  );

  const target = rand(targets);

  if (!target) return;

  const skill = player.skills[skillIndex];

  if (!skill) return;

  let damage = Math.max(
    8,
    Math.min(
      58,
      Math.round(
        player.power * 0.42 +
        Math.random() * 24
      )
    )
  );

  /* Berserker */
  if (
    player.passive.startsWith("Berserker") &&
    player.hp < 50
  ) {
    damage += 10;
  }

  /* Gardien */
  if (target.guard) {
    damage = Math.round(
      damage * 0.5
    );

    target.guard = false;
  }

  /* Instinct */
  if (
    !player.usedPassive &&
    player.passive.startsWith("Instinct") &&
    Math.random() < 0.12
  ) {
    player.usedPassive = true;
    damage = 0;
  }

  /* Dernier souffle */
  if (
    !player.usedPassive &&
    player.passive.startsWith("Dernier souffle") &&
    target.hp - damage <= 0
  ) {
    damage = Math.max(
      0,
      target.hp - 1
    );

    player.usedPassive = true;
  }

  /* Précognition */
  if (
    !target.usedPassive &&
    target.passive.startsWith("Précognition")
  ) {
    damage = Math.round(
      damage * 0.75
    );

    target.usedPassive = true;
  }

  target.hp = Math.max(
    0,
    target.hp - damage
  );

  let log =
    `🎯 ${player.name} utilise « ${skill} » ` +
    `sur ${target.name} : ${damage} dégâts.`;

  /* Régénération */
  if (
    player.passive.startsWith("Régénération")
  ) {
    player.hp = Math.min(
      100,
      player.hp + 8
    );
  }

  /* Adaptation */
  if (
    target.passive.startsWith("Adaptation") &&
    !target.usedPassive
  ) {
    target.power += 5;
    target.usedPassive = true;

    log +=
      ` 🧬 ${target.name} s'adapte !`;
  }

  /* Malédiction */
  if (
    player.passive.startsWith("Malédiction") &&
    Math.random() < 0.25
  ) {
    const bonus = 8;

    target.hp = Math.max(
      0,
      target.hp - bonus
    );

    log +=
      ` ☠️ Malédiction : +${bonus} dégâts.`;
  }

  if (target.hp === 0) {
    log +=
      ` 💥 ${target.name} est K.O.`;
  }

  room.game.log +=
    `\nTour — ${log}`;

  if (alive(room).length <= 1) {
    room.game.over = true;

    const winner = alive(room)[0];

    if (winner) {
      room.game.log +=
        `\n\n🏆 ${winner.name} remporte le combat !`;
    } else {
      room.game.log +=
        "\n\n💀 Égalité.";
    }
  } else {
    nextTurn(
      room,
      player.id
    );
  }

  sendBattle(room);
}

/* =========================
   QUI EST-CE ?
========================= */

function startGuess(room) {
  room.game = {
    type: "guess",
    turn: room.players[0].id,
    over: false,
    scores: {},
    questions: []
  };

  room.players.forEach(p => {
    room.game.scores[p.id] = 0;

    p.secret = rand(chars);
  });

  room.players.forEach(p => {
    send(p.ws, {
      type: "guess_start",
      myCharacter: p.secret.name,
      turn: room.game.turn
    });
  });
}

function other(room, id) {
  return room.players.find(
    p => p.id !== id
  );
}

/* =========================
   ROUTEUR
========================= */

function route(ws, message) {
  const p = ws.player;

  /* CRÉER UNE SALLE */
  if (message.type === "create_room") {
    if (p.room) {
      return send(ws, {
        type: "error",
        message:
          "Tu es déjà dans une salle."
      });
    }

    const roomCode = code();

    const room = {
      code: roomCode,
      mode: message.mode,
      hostId: p.id,
      players: [],
      started: false,
      game: null
    };

    rooms.set(
      roomCode,
      room
    );

    p.room = room;

    p.name = String(
      message.name || "Joueur"
    ).slice(0, 24);

    room.players.push(p);

    send(ws, {
      type: "room_created",
      code: roomCode,
      playerId: p.id,
      host: true,
      mode: room.mode,
      players: playersView(room)
    });

    return;
  }

  /* REJOINDRE UNE SALLE */
  if (message.type === "join_room") {
    const room = rooms.get(
      String(
        message.code || ""
      ).toUpperCase()
    );

    if (!room) {
      return send(ws, {
        type: "error",
        message:
          "Salle introuvable."
      });
    }

    if (room.started) {
      return send(ws, {
        type: "error",
        message:
          "La partie a déjà commencé."
      });
    }

    if (
      room.mode === "guess" &&
      room.players.length >= 2
    ) {
      return send(ws, {
        type: "error",
        message:
          "Qui est-ce ? est limité à 2 joueurs."
      });
    }

    if (
      room.mode === "battle" &&
      room.players.length >= 4
    ) {
      return send(ws, {
        type: "error",
        message:
          "Combat limité à 4 joueurs."
      });
    }

    p.room = room;

    p.name = String(
      message.name || "Joueur"
    ).slice(0, 24);

    room.players.push(p);

    send(ws, {
      type: "room_joined",
      code: room.code,
      playerId: p.id,
      host: false,
      mode: room.mode,
      players: playersView(room)
    });

    broadcast(room, {
      type: "room_update",
      players: playersView(room)
    });

    return;
  }

  const room = p.room;

  if (!room) {
    return send(ws, {
      type: "error",
      message:
        "Rejoins ou crée une salle."
    });
  }

  /* QUITTER */
  if (message.type === "leave_room") {
    leave(p);
    return;
  }

  /* LANCER COMBAT */
  if (message.type === "start_battle") {
    if (
      room.hostId !== p.id ||
      room.mode !== "battle"
    ) {
      return;
    }

    if (room.players.length < 2) {
      return send(ws, {
        type: "error",
        message:
          "Il faut au moins 2 joueurs."
      });
    }

    startBattle(
      room,
      message.universes
    );

    return;
  }

  /* LANCER QUI EST-CE */
  if (message.type === "start_guess") {
    if (
      room.hostId !== p.id ||
      room.mode !== "guess"
    ) {
      return;
    }

    if (room.players.length !== 2) {
      return send(ws, {
        type: "error",
        message:
          "Il faut exactement 2 joueurs."
      });
    }

    startGuess(room);

    return;
  }

  /* ACTION DE COMBAT */
  if (
    message.type === "battle_action" &&
    room.mode === "battle" &&
    room.game?.type === "battle"
  ) {
    battleAction(
      room,
      p,
      Number(message.skillIndex)
    );

    return;
  }

  /* QUESTION QUI EST-CE */
  if (
    message.type === "guess_question" &&
    room.mode === "guess" &&
    room.game?.type === "guess"
  ) {
    if (
      room.game.over ||
      room.game.turn !== p.id
    ) {
      return;
    }

    const question =
      String(
        message.question || ""
      ).slice(0, 180);

    const opponent =
      other(room, p.id);

    if (!opponent) return;

    room.game.questions.push({
      from: p.id,
      text: question
    });

    send(opponent.ws, {
      type: "guess_question",
      question
    });

    send(ws, {
      type: "guess_state",
      turn: room.game.turn,
      log:
        "💬 Question envoyée."
    });

    return;
  }

  /* RÉPONSE QUI EST-CE */
  if (
    message.type === "guess_answer" &&
    room.mode === "guess" &&
    room.game?.type === "guess"
  ) {
    const answer =
      [
        "Oui",
        "Non",
        "Je ne sais pas"
      ].includes(message.answer)
        ? message.answer
        : "Je ne sais pas";

    const opponent =
      other(room, p.id);

    if (!opponent) return;

    send(opponent.ws, {
      type: "guess_answer",
      answer
    });

    room.game.turn =
      opponent.id;

    broadcast(room, {
      type: "guess_state",
      turn: room.game.turn,
      log:
        `🗣️ ${p.name} répond : ${answer}`
    });

    return;
  }

  /* DEVINER QUI EST LE PERSONNAGE */
  if (
    message.type === "guess_guess" &&
    room.mode === "guess" &&
    room.game?.type === "guess"
  ) {
    if (
      room.game.over ||
      room.game.turn !== p.id
    ) {
      return;
    }

    const guess =
      String(
        message.guess || ""
      )
        .trim()
        .toLowerCase();

    const opponent =
      other(room, p.id);

    if (!opponent) return;

    const target =
      opponent.secret;

    if (
      guess ===
      target.name.toLowerCase()
    ) {
      room.game.over = true;

      room.game.scores[p.id] =
        (room.game.scores[p.id] || 0) + 1;

      broadcast(room, {
        type: "guess_end",
        message:
          `${p.name} a trouvé ` +
          `${target.name} ! 🏆`
      });
    } else {
      room.game.turn =
        opponent.id;

      broadcast(room, {
        type: "guess_state",
        turn: room.game.turn,
        log:
          `❌ ${p.name} se trompe. ` +
          `Tour de ${opponent.name}.`
      });
    }

    return;
  }
}

/* =========================
   QUITTER UNE SALLE
========================= */

function leave(player) {
  const room = player.room;

  if (!room) return;

  const index =
    room.players.indexOf(player);

  if (index >= 0) {
    room.players.splice(
      index,
      1
    );
  }

  player.room = null;

  if (!room.players.length) {
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === player.id) {
    room.hostId =
      room.players[0].id;
  }

  broadcast(room, {
    type: "room_update",
    players: playersView(room)
  });
}

/* =========================
   SERVEUR HTTP
========================= */

const server = http.createServer(
  (req, res) => {
    let file =
      req.url === "/"
        ? "/index.html"
        : req.url;

    file =
      file.split("?")[0];

    if (
      file === "/server.js" ||
      file === "/package.json"
    ) {
      return res
        .writeHead(403)
        .end();
    }

    const filePath =
      path.join(
        __dirname,
        file
      );

    if (
      !filePath.startsWith(
        __dirname
      ) ||
      !fs.existsSync(filePath)
    ) {
      return res
        .writeHead(404)
        .end("Not found");
    }

    const ext =
      path.extname(filePath);

    let contentType =
      "application/octet-stream";

    if (ext === ".html") {
      contentType =
        "text/html; charset=utf-8";
    } else if (ext === ".js") {
      contentType =
        "text/javascript; charset=utf-8";
    } else if (ext === ".css") {
      contentType =
        "text/css; charset=utf-8";
    } else if (ext === ".json") {
      contentType =
        "application/json; charset=utf-8";
    }

    res.writeHead(200, {
      "Content-Type":
        contentType
    });

    fs.createReadStream(
      filePath
    ).pipe(res);
  }
);

/* =========================
   WEBSOCKET
========================= */

const wss =
  new WebSocket.Server({
    server
  });

let nextId = 0;

wss.on(
  "connection",
  ws => {
    const player = {
      id: nextId++,
      ws,
      name: "Joueur",
      room: null
    };

    ws.player = player;

    send(ws, {
      type: "hello",
      playerId: player.id
    });

    ws.on(
      "message",
      buffer => {
        try {
          const message =
            JSON.parse(
              buffer.toString()
            );

          route(
            ws,
            message
          );
        } catch (error) {
          send(ws, {
            type: "error",
            message:
              "Erreur serveur."
          });
        }
      }
    );

    ws.on(
      "close",
      () => {
        if (player.room) {
          leave(player);
        }
      }
    );
  }
);

/* =========================
   DÉMARRAGE RENDER
========================= */

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Anime Multiverse lancé sur le port ${PORT}`
    );
  }
);
