const socket = io();
const $ = id => document.getElementById(id);

let current = null;
let tick = null;

let violationPlayers = new Map();
let joinedPlayers = [];


// ESCAPE PLAYER TEXT

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// SHOW HOST SECTION

function show(id) {

  ["auth", "host", "hostFinal"].forEach(
    x => $(x).classList.toggle(
      "hidden",
      x !== id
    )
  );

}


// HOST LOGIN

$("authBtn").onclick = () => socket.emit(
  "host:auth",
  {
    code: $("hostCode").value
  },
  r => {

    if (!r?.ok) {

      $("authMsg").textContent =
        "Wrong host code";

      return;

    }


    show("host");


    $("hostCount").textContent =
      r.state.count;


    renderTop(
      r.state.leaderboard.slice(0, 5)
    );


    joinedPlayers =
      r.state.players || [];


    renderPlayers();

  }
);


// HOST CONTROLS

$("startBtn").onclick = () =>
  socket.emit("host:start");


$("nextBtn").onclick = () =>
  socket.emit("host:next");


$("revealBtn").onclick = () =>
  socket.emit("host:reveal");


$("resetBtn").onclick = () => {

  if (
    confirm(
      "Reset quiz and remove all players?"
    )
  ) {

    socket.emit("host:reset");

  }

};


// LOBBY UPDATE

socket.on("lobby:update", d => {

  $("hostCount").textContent =
    d.count;


  joinedPlayers =
    d.players || [];


  renderPlayers();

});


// SHOW JOINED PLAYERS

function renderPlayers() {

  if (!$("hostPlayers")) {
    return;
  }


  if (joinedPlayers.length === 0) {

    $("hostPlayers").innerHTML =
      "<p>No players joined</p>";

    return;

  }


  $("hostPlayers").innerHTML =
    joinedPlayers.map(p => {

      const safeName =
        escapeHTML(p.name);

      const safeRegisterNo =
        escapeHTML(p.registerNo);

      const safeId =
        escapeHTML(p.id);


      return `
        <div class="rankRow">

          <span>

            <strong>
              ${safeName}
            </strong>

            <small>
              · ${safeRegisterNo}
            </small>

          </span>

          <button
            class="danger removePlayerBtn"
            data-id="${safeId}"
          >
            REMOVE
          </button>

        </div>
      `;

    }).join("");


  document
    .querySelectorAll(".removePlayerBtn")
    .forEach(btn => {

      btn.onclick = () => {

        const playerId =
          btn.dataset.id;


        const player =
          joinedPlayers.find(
            p => p.id === playerId
          );


        if (!player) {
          return;
        }


        if (
          !confirm(
            `Remove ${player.name} from quiz?`
          )
        ) {

          return;

        }


        removePlayer(player);

      };

    });

}


// REMOVE PLAYER

function removePlayer(player) {

  socket.emit(
    "host:removePlayer",
    {
      playerId: player.id
    },
    r => {

      if (!r?.ok) {

        alert(
          r?.error ||
          "Could not remove player"
        );

        return;

      }


      // REMOVE ALL ALERTS
      // FOR REMOVED PLAYER

      for (
        const [key, alertPlayer]
        of violationPlayers
      ) {

        if (
          alertPlayer.playerId === player.id
        ) {

          violationPlayers.delete(key);

        }

      }


      renderViolationPlayers();

    }
  );

}


// TOP 5

function renderTop(list) {

  $("top5").innerHTML =
    list.length

      ? list.map((p, i) => {

          const safeName =
            escapeHTML(p.name);


          return `
            <div class="leader">

              <b>
                ${i + 1}
              </b>

              <span>
                ${safeName}
              </span>

              <span>
                ${p.score}
              </span>

            </div>
          `;

        }).join("")

      : "<p>No scores yet</p>";

}


// HOST TIMER + 5 SECOND READING TIME

function runTimer(q) {

  clearInterval(tick);


  const answerStart =
    q.startedAt;


  const answerEnd =
    answerStart +
    q.duration * 1000;


  tick = setInterval(() => {

    const now =
      Date.now();


    const hasCurrentAlerts =
      [...violationPlayers.values()]
        .some(
          p => p.index === q.index
        );


    // 5 SECOND READING TIME

    if (now < answerStart) {

      const readingLeft =
        Math.ceil(
          (answerStart - now) / 1000
        );


      $("hostTimer").textContent =
        readingLeft;


      $("hostTimerBar").style.transform =
        `scaleX(${readingLeft / q.readingTime})`;


      if (!hasCurrentAlerts) {

        $("hostStatus").textContent =
          `📖 READING TIME - ${readingLeft}`;

      }


      return;

    }


    // 20 SECOND ANSWER TIME

    const left =
      Math.max(
        0,
        (answerEnd - now) / 1000
      );


    $("hostTimer").textContent =
      Math.ceil(left);


    $("hostTimerBar").style.transform =
      `scaleX(${left / q.duration})`;


    if (!hasCurrentAlerts) {

      $("hostStatus").textContent =
        "Students are answering...";

    }


    if (left <= 0) {

      clearInterval(tick);

    }

  }, 50);

}


// QUESTION

socket.on("question", q => {

  current = q;


  // CLEAR OLD QUESTION ALERTS

  violationPlayers.clear();


  show("host");


  // HIDE NORMAL PLAYER REMOVE LIST
  // AFTER QUIZ STARTS

  if ($("playerManage")) {

    $("playerManage")
      .classList
      .add("hidden");

  }


  $("hostQnum").textContent =
    `QUESTION ${q.index + 1} / ${q.total}`;


  $("hostQuestion").textContent =
    q.question;


  $("hostStatus").textContent =
    "📖 READING TIME";


  $("hostOptions").innerHTML =
    q.options.map(
      (o, i) => {

        const safeOption =
          escapeHTML(o);


        return `
          <div
            class="option"
            data-i="${i}"
          >

            <span class="letter">
              ${"ABCD"[i]}
            </span>

            ${safeOption}

          </div>
        `;

      }
    ).join("");


  runTimer(q);

});


// REVEAL ANSWER

socket.on("reveal", d => {

  clearInterval(tick);


  document
    .querySelectorAll(
      "#hostOptions .option"
    )
    .forEach((b, i) => {

      if (i === d.answer) {

        b.classList.add(
          "correct"
        );

      }
      else {

        b.classList.add(
          "dim"
        );

      }

    });


  $("hostStatus").textContent =
    `Correct answer: ${"ABCD"[d.answer]}`;


  renderTop(
    d.leaderboard
  );

});


// FINAL RANKING

function ranks(list, target) {

  $(target).innerHTML =
    list.map((p, i) => {

      const safeName =
        escapeHTML(p.name);

      const safeRegisterNo =
        escapeHTML(p.registerNo);


      return `
        <div class="rankRow">

          <b>
            #${i + 1}
          </b>

          <span>

            ${safeName}

            <small>
              · ${safeRegisterNo}
              · ${p.correct} correct
            </small>

          </span>

          <strong>
            ${p.score}
          </strong>

        </div>
      `;

    }).join("");

}


// FINAL PODIUM

function podium(list, target) {

  const order = [
    list[1],
    list[0],
    list[2]
  ];


  const medals = [
    "🥈",
    "🥇",
    "🥉"
  ];


  $(target).innerHTML =
    order.map((p, i) => {

      if (!p) {
        return "";
      }


      const safeName =
        escapeHTML(p.name);


      return `
        <div
          class="podiumItem ${
            i === 1 ? "first" : ""
          }"
        >

          <div>
            ${medals[i]}
          </div>

          <strong>
            ${safeName}
          </strong>

          <span>
            ${p.score}
          </span>

        </div>
      `;

    }).join("");

}


// QUIZ FINISHED

socket.on("quiz:finished", d => {

  clearInterval(tick);


  show("hostFinal");


  podium(
    d.leaderboard,
    "hostPodium"
  );


  ranks(
    d.leaderboard,
    "hostRanking"
  );

});


// QUIZ RESET

socket.on(
  "quiz:reset",
  () => location.reload()
);


// ANTI-CHEAT HOST WARNING

socket.on("host:violation", d => {

  // IGNORE OLD QUESTION EVENT

  if (
    !current ||
    d.index !== current.index
  ) {

    return;

  }


  // PLAYER + CURRENT QUESTION KEY

  const key =
    `${d.playerId || d.id}:${d.index}`;


  violationPlayers.set(
    key,
    {
      playerId:
        d.playerId || d.id,

      name:
        d.name,

      registerNo:
        d.registerNo,

      index:
        d.index,

      questionNumber:
        d.questionNumber ||
        d.index + 1,

      blocked:
        true
    }
  );


  renderViolationPlayers();

});


// RENDER CURRENT QUESTION
// ANTI-CHEAT ALERTS

function renderViolationPlayers() {

  const alerts = [
    ...violationPlayers.values()
  ].filter(
    p =>
      current &&
      p.index === current.index
  );


  if (alerts.length === 0) {

    $("hostStatus").textContent =
      "Students are answering...";

    return;

  }


  $("hostStatus").innerHTML =
    "🚨 ANTI-CHEAT ALERTS<br>" +

    alerts.map(p => {

      const safeName =
        escapeHTML(p.name);

      const safeRegisterNo =
        escapeHTML(p.registerNo);

      const safePlayerId =
        escapeHTML(p.playerId);


      return `
        🚫 ${safeName}
        | Roll ${safeRegisterNo}
        | QUESTION ${p.questionNumber} BLOCKED

        <button
          class="danger removeBlockedBtn"
          data-id="${safePlayerId}"
        >
          REMOVE
        </button>
      `;

    }).join("<br>");


  document
    .querySelectorAll(
      ".removeBlockedBtn"
    )
    .forEach(btn => {

      btn.onclick = () => {

        const playerId =
          btn.dataset.id;


        const player =
          joinedPlayers.find(
            p => p.id === playerId
          );


        if (!player) {

          alert(
            "Player not found"
          );

          return;

        }


        if (
          !confirm(
            `Remove ${player.name} from quiz?`
          )
        ) {

          return;

        }


        removePlayer(player);

      };

    });

}