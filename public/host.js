const socket = io();

const $ = id =>
  document.getElementById(id);


let current = null;

let tick = null;


let violationPlayers =
  new Map();


let joinedPlayers = [];

let pendingPlayers = [];

let selectedPlayer = null;


// ============================================================
// ESCAPE PLAYER / QUESTION TEXT
// ============================================================

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// ============================================================
// CHECK SCRAMBLED QUESTION
// ============================================================

function isScrambledQuestion(q) {

  return (
    q &&
    q.type === "scrambled"
  );

}


// ============================================================
// SHOW HOST SECTION
// ============================================================

function show(id) {

  [
    "auth",
    "host",
    "hostFinal"
  ].forEach(
    x => {

      const element = $(x);


      if (element) {

        element.classList.toggle(
          "hidden",
          x !== id
        );

      }

    }
  );

}


// ============================================================
// HOST LOGIN
// ============================================================

$("authBtn").onclick = () => {

  socket.emit(
    "host:auth",

    {
      code:
        $("hostCode").value
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

      pendingPlayers =
        r.state.pending || [];


      renderPlayers();
      renderPendingPlayers();

    }
  );

};


// ============================================================
// HOST CONTROLS
// ============================================================

$("startBtn").onclick = () => {

  socket.emit(
    "host:start"
  );

};


$("nextBtn").onclick = () => {

  socket.emit(
    "host:next"
  );

};


$("revealBtn").onclick = () => {

  socket.emit(
    "host:reveal"
  );

};


$("resetBtn").onclick = () => {

  if (
    confirm(
      "Reset quiz and remove all players?"
    )
  ) {

    socket.emit(
      "host:reset"
    );

  }

};


// ============================================================
// LOBBY UPDATE
// ============================================================

socket.on(
  "lobby:update",

  d => {

    $("hostCount").textContent =
      d.count;


    joinedPlayers =
      d.players || [];

    pendingPlayers =
      d.pending || [];


    renderPlayers();
    renderPendingPlayers();

  }
);


// ============================================================
// SHOW JOINED PLAYERS
// ============================================================

function renderPlayers() {

  if (!$("hostPlayers")) {

    return;

  }


  if (
    joinedPlayers.length === 0
  ) {

    $("hostPlayers").innerHTML =
      "<p>No players joined</p>";

    return;

  }


  $("hostPlayers").innerHTML =
    joinedPlayers.map(
      p => {

        const safeName =
          escapeHTML(p.name);


        const safeRegisterNo =
          escapeHTML(
            p.registerNo
          );


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
              class="secondary participantBtn"
              data-id="${safeId}"
            >
              DETAILS
            </button>

          </div>

        `;

      }
    ).join("");


  document
    .querySelectorAll(
      ".participantBtn"
    )
    .forEach(
      btn => {

        btn.onclick = () => {

          const playerId =
            btn.dataset.id;


          const player =
            joinedPlayers.find(
              p =>
                p.id === playerId
            );


          if (!player) {

            return;

          }


          openParticipantModal(player);

        };

      }
    );

}


// ============================================================
// REMOVE PLAYER
// ============================================================

function removePlayer(player) {

  socket.emit(
    "host:removePlayer",

    {
      playerId:
        player.id
    },

    r => {

      if (!r?.ok) {

        alert(
          r?.error ||
          "Could not remove player"
        );

        return;

      }


      // REMOVE ANTI-CHEAT ALERTS
      // FOR REMOVED PLAYER

      for (
        const [
          key,
          alertPlayer
        ]
        of violationPlayers
      ) {

        if (
          alertPlayer.playerId ===
          player.id
        ) {

          violationPlayers.delete(
            key
          );

        }

      }


      renderViolationPlayers();

    }
  );

}


// ============================================================
// TOP 5 LEADERBOARD
// ============================================================

function renderTop(list) {

  $("top5").innerHTML =
    list.length

      ? list.map(
          (p, i) => {

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

          }
        ).join("")

      : "<p>No scores yet</p>";

}


// ============================================================
// HOST TIMER + 5 SECOND READING TIME
// ============================================================

function runTimer(q) {

  clearInterval(tick);


  const answerStart =
    q.startedAt;


  const answerEnd =
    answerStart +
    q.duration * 1000;


  tick = setInterval(
    () => {

      const now =
        Date.now();


      const hasCurrentAlerts =
        [
          ...violationPlayers.values()
        ].some(
          p =>
            p.index === q.index
        );


      // 5 SECOND READING TIME

      if (
        now < answerStart
      ) {

        const readingLeft =
          Math.ceil(
            (
              answerStart -
              now
            ) / 1000
          );


        $("hostTimer").textContent =
          readingLeft;


        $("hostTimerBar")
          .style
          .transform =
            `scaleX(${
              readingLeft /
              q.readingTime
            })`;


        if (
          !hasCurrentAlerts
        ) {

          $("hostStatus").textContent =
            `📖 READING TIME - ${readingLeft}`;

        }


        return;

      }


      // Server-authoritative answer countdown

      const left =
        Math.max(
          0,

          (
            answerEnd -
            now
          ) / 1000
        );


      $("hostTimer").textContent =
        Math.ceil(left);


      $("hostTimerBar")
        .style
        .transform =
          `scaleX(${
            left /
            q.duration
          })`;


      if (
        !hasCurrentAlerts
      ) {

        $("hostStatus").textContent =
          isScrambledQuestion(q)

            ? "Players are typing answers..."

            : "Students are answering...";

      }


      if (
        left <= 0
      ) {

        clearInterval(tick);

      }

    },

    50
  );

}


// ============================================================
// RENDER MCQ QUESTION
// ============================================================

function renderMCQQuestion(q) {

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

}


// ============================================================
// RENDER SCRAMBLED WORD QUESTION
// ============================================================

function renderScrambledQuestion(q) {

  const safeScrambled =
    escapeHTML(q.scrambled);


  $("hostOptions").innerHTML = `

    <div class="scrambledRound">

      <div class="scrambledLabel">
        🔀 SCRAMBLED WORD ROUND
      </div>


      <div class="scrambledWord">
        ${safeScrambled}
      </div>


      <div
        id="hostScrambledReveal"
        class="scrambledReveal hidden"
      ></div>

    </div>

  `;

}


// ============================================================
// QUESTION
// ============================================================

socket.on(
  "question",

  q => {

    current = q;


    // CLEAR OLD QUESTION ALERTS

    violationPlayers.clear();


    show("host");


    $("hostQnum").textContent =
      `QUESTION ${q.index + 1} / ${q.total}`;


    $("hostQuestion").textContent =
      q.question;


    $("hostStatus").textContent =
      "📖 READING TIME";


    // SCRAMBLED WORD QUESTION

    if (
      isScrambledQuestion(q)
    ) {

      renderScrambledQuestion(q);

    }


    // NORMAL MCQ QUESTION

    else {

      renderMCQQuestion(q);

    }


    runTimer(q);

  }
);


// ============================================================
// REVEAL ANSWER
// ============================================================

socket.on(
  "reveal",

  d => {

    clearInterval(tick);


    // ========================================================
    // SCRAMBLED WORD ANSWER
    // ========================================================

    if (
      current &&
      isScrambledQuestion(current)
    ) {

      const reveal =
        $("hostScrambledReveal");


      if (reveal) {

        reveal.classList.remove(
          "hidden"
        );


        reveal.textContent =
          `CORRECT ANSWER: ${d.answerText}`;

      }


      $("hostStatus").textContent =
        `Correct answer: ${d.answerText}`;


      renderTop(
        d.leaderboard
      );


      return;

    }


    // ========================================================
    // MCQ ANSWER
    // ========================================================

    document
      .querySelectorAll(
        "#hostOptions .option"
      )
      .forEach(
        (b, i) => {

          if (
            i === d.answer
          ) {

            b.classList.add(
              "correct"
            );

          }

          else {

            b.classList.add(
              "dim"
            );

          }

        }
      );


    const answerLetter =
      Number.isInteger(d.answer)

        ? "ABCD"[d.answer]

        : "";


    $("hostStatus").textContent =
      `Correct answer: ${
        answerLetter
      } - ${
        d.answerText || ""
      }`;


    renderTop(
      d.leaderboard
    );

  }
);


// ============================================================
// FINAL RANKING
// ============================================================

function ranks(
  list,
  target
) {

  $(target).innerHTML =
    list.map(
      (p, i) => {

        const safeName =
          escapeHTML(p.name);


        const safeRegisterNo =
          escapeHTML(
            p.registerNo
          );


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

      }
    ).join("");

}


// ============================================================
// FINAL PODIUM
// ============================================================

function podium(
  list,
  target
) {

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
    order.map(
      (p, i) => {

        if (!p) {

          return "";

        }


        const safeName =
          escapeHTML(p.name);


        return `

          <div
            class="podiumItem ${
              i === 1
                ? "first"
                : ""
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

      }
    ).join("");

}


// ============================================================
// EXPORT FINAL RESULTS
// ============================================================

function csvCell(value) {

  return `"${String(value ?? "").replaceAll('"', '""')}"`;

}


function exportResults(list) {

  const header = [
    "Rank",
    "Participant Name",
    "Roll Number",
    "Score",
    "Correct Answers",
    "Answered Questions",
    "Status"
  ];

  const rows = list.map(
    (p, i) => [
      i + 1,
      p.name,
      p.registerNo,
      p.score,
      p.correct,
      p.answeredCount ?? 0,
      p.state
    ]
  );

  const csv = [header, ...rows]
    .map(row => row.map(csvCell).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tech-quiz-results-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

}


$("exportResultsBtn").onclick = () => {

  if (window.finalLeaderboard?.length) {

    exportResults(window.finalLeaderboard);

  }

};


// ============================================================
// QUIZ FINISHED
// ============================================================

socket.on(
  "quiz:finished",

  d => {

    clearInterval(tick);

    window.finalLeaderboard = d.leaderboard || [];


    show(
      "hostFinal"
    );


    podium(
      d.leaderboard,
      "hostPodium"
    );


    ranks(
      d.leaderboard,
      "hostRanking"
    );

  }
);


// ============================================================
// QUIZ RESET
// ============================================================

socket.on(
  "quiz:reset",

  () => {

    location.reload();

  }
);


// ============================================================
// ANTI-CHEAT HOST WARNING
// ============================================================

socket.on(
  "host:violation",

  d => {

    // IGNORE OLD QUESTION EVENT

    if (
      !current ||
      d.index !== current.index
    ) {

      return;

    }


    // PLAYER + CURRENT QUESTION KEY

    const key =
      `${
        d.playerId ||
        d.id
      }:${d.index}`;


    violationPlayers.set(
      key,

      {
        playerId:
          d.playerId ||
          d.id,

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

  }
);


// ============================================================
// RENDER CURRENT QUESTION ANTI-CHEAT ALERTS
// ============================================================

function renderViolationPlayers() {

  const alerts = [
    ...violationPlayers.values()
  ].filter(
    p =>
      current &&
      p.index === current.index
  );


  if (
    alerts.length === 0
  ) {

    $("hostStatus").textContent =
      current &&
      isScrambledQuestion(current)

        ? "Players are typing answers..."

        : "Students are answering...";


    return;

  }


  $("hostStatus").innerHTML =
    "🚨 ANTI-CHEAT ALERTS<br>" +

    alerts.map(
      p => {

        const safeName =
          escapeHTML(p.name);


        const safeRegisterNo =
          escapeHTML(
            p.registerNo
          );


        const safePlayerId =
          escapeHTML(
            p.playerId
          );


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

      }
    ).join("<br>");


  document
    .querySelectorAll(
      ".removeBlockedBtn"
    )
    .forEach(
      btn => {

        btn.onclick = () => {

          const playerId =
            btn.dataset.id;


          const player =
            joinedPlayers.find(
              p =>
                p.id === playerId
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

      }
    );

}

function renderPendingPlayers() {
  const target = $("pendingPlayers");
  if (!target) return;
  target.innerHTML = pendingPlayers.length ? pendingPlayers.map(p => `
    <div class="rankRow">
      <span><strong>${escapeHTML(p.name)}</strong><small> · ${escapeHTML(p.registerNo)}</small></span>
      <span><button class="allowPlayerBtn" data-id="${escapeHTML(p.id)}">ALLOW</button> <button class="danger rejectPlayerBtn" data-id="${escapeHTML(p.id)}">REJECT</button></span>
    </div>`).join("") : "<p>No pending requests</p>";
  target.querySelectorAll(".allowPlayerBtn").forEach(button => button.onclick = () => admission(button.dataset.id, "host:allowPlayer"));
  target.querySelectorAll(".rejectPlayerBtn").forEach(button => button.onclick = () => admission(button.dataset.id, "host:rejectPlayer"));
}

function admission(playerId, event) {
  socket.emit(event, { playerId }, result => {
    if (!result?.ok) alert(result?.error || "Request already handled");
  });
}

function openParticipantModal(player) {
  selectedPlayer = player;
  $("participantDetails").innerHTML = `
    <p><strong>Name:</strong> ${escapeHTML(player.name)}</p>
    <p><strong>Roll No:</strong> ${escapeHTML(player.registerNo)}</p>
    <p><strong>Score:</strong> ${player.score}</p>
    <p><strong>Current Question:</strong> ${player.currentQuestion || "Lobby"}</p>
    <p><strong>Status:</strong> ${escapeHTML(player.state)}${player.answered ? " / Answered" : ""}${player.blocked ? " / Blocked" : ""}</p>`;
  $("blockParticipantBtn").disabled = !current || player.blocked;
  $("participantModal").classList.remove("hidden");
}

$("closeParticipantBtn").onclick = () => $("participantModal").classList.add("hidden");
$("blockParticipantBtn").onclick = () => {
  if (!selectedPlayer) return;
  socket.emit("host:blockPlayer", { playerId: selectedPlayer.id }, result => {
    if (!result?.ok) alert(result?.error || "Could not block participant");
    else $("participantModal").classList.add("hidden");
  });
};
$("removeParticipantBtn").onclick = () => {
  if (!selectedPlayer) return;
  removePlayer(selectedPlayer);
  $("participantModal").classList.add("hidden");
};