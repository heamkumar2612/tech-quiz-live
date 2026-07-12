const socket = io();
const $ = id => document.getElementById(id);

let me = null;
let current = null;
let answered = false;
let tick = null;

// BLOCK IS ONLY FOR CURRENT QUESTION
let questionBlocked = false;

let visibilityReporting = false;


// SHOW SECTION

function show(id) {

  ["join", "lobby", "game", "final"].forEach(
    x => $(x).classList.toggle(
      "hidden",
      x !== id
    )
  );

}


// PLAYER JOIN

$("joinBtn").onclick = () => socket.emit(
  "player:join",
  {
    code: $("code").value,
    name: $("name").value,
    registerNo: $("reg").value
  },
  r => {

    if (!r?.ok) {

      $("joinMsg").textContent =
        r?.error || "Could not join";

      return;

    }


    me = r.player;


    $("playerName").textContent =
      me.name;


    $("joinMsg").textContent =
      "";


    show("lobby");

  }
);


// LOBBY UPDATE

socket.on("lobby:update", d => {

  $("lobbyCount").textContent =
    d.count;

});


// QUIZ STARTED

socket.on("quiz:started", () => {

  $("status").textContent =
    "Get ready...";


  show("game");

});


// TIMER + 5 SECOND READING TIME

function runTimer(payload) {

  clearInterval(tick);


  const answerStart =
    payload.startedAt;


  const answerEnd =
    answerStart +
    payload.duration * 1000;


  disableOptions();


  tick = setInterval(() => {

    const now =
      Date.now();


    // CURRENT QUESTION BLOCKED

    if (questionBlocked) {

      disableOptions();

      return;

    }


    // 5 SECOND READING TIME

    if (now < answerStart) {

      const readingLeft =
        Math.ceil(
          (answerStart - now) / 1000
        );


      $("timer").textContent =
        readingLeft;


      $("timerBar").style.transform =
        `scaleX(${readingLeft / payload.readingTime})`;


      $("status").textContent =
        `📖 READ QUESTION - ${readingLeft}`;


      return;

    }


    // 20 SECOND ANSWERING TIME

    const left =
      Math.max(
        0,
        (answerEnd - now) / 1000
      );


    $("timer").textContent =
      Math.ceil(left);


    $("timerBar").style.transform =
      `scaleX(${left / payload.duration})`;


    if (!answered) {

      document
        .querySelectorAll(".option")
        .forEach(
          b => b.disabled = false
        );


      $("status").textContent =
        "Choose your answer";

    }


    if (left <= 0) {

      clearInterval(tick);


      disableOptions();


      $("status").textContent =
        answered
          ? "Answer locked!"
          : "TIME UP!";

    }

  }, 50);

}


// DISABLE OPTIONS

function disableOptions() {

  document
    .querySelectorAll(".option")
    .forEach(
      b => b.disabled = true
    );

}


// QUESTION

socket.on("question", q => {

  current = q;


  answered = false;


  // IMPORTANT:
  // NEXT QUESTION IS UNBLOCKED

  questionBlocked = false;


  visibilityReporting = false;


  show("game");


  $("qnum").textContent =
    `${q.index + 1} / ${q.total}`;


  $("question").textContent =
    q.question;


  $("status").textContent =
    "📖 READ QUESTION";


  $("options").innerHTML =
    q.options.map(
      (o, i) =>

        `<button
          class="option"
          data-i="${i}"
        >

          <span class="letter">
            ${"ABCD"[i]}
          </span>

          ${o}

        </button>`

    ).join("");


  document
    .querySelectorAll(".option")
    .forEach(b => {

      b.onclick = () => {

        if (
          answered ||
          questionBlocked
        ) {

          return;

        }


        answered = true;


        disableOptions();


        b.classList.add(
          "selected"
        );


        $("status").textContent =
          "Answer locked!";


        socket.emit(
          "answer",
          {
            index: q.index,
            option: +b.dataset.i
          },
          r => {

            if (!r?.ok) {

              // SERVER SAYS CURRENT
              // QUESTION IS BLOCKED

              if (
                String(
                  r?.error || ""
                )
                  .toLowerCase()
                  .includes("blocked")
              ) {

                questionBlocked = true;

              }


              disableOptions();


              $("status").textContent =
                r?.error ||
                "Could not submit";

            }

          }
        );

      };

    });


  runTimer(q);

});


// ANSWER RESULT

socket.on("answer:result", r => {

  $("score").textContent =
    r.score;


  $("status").textContent =
    r.correct

      ? `CORRECT! +${r.points} POINTS`

      : "WRONG ANSWER";

});


// PLAYER VIOLATION

socket.on("player:violation", d => {

  if (
    !current ||
    d.index !== current.index
  ) {

    return;

  }


  if (d.blocked) {

    questionBlocked = true;


    disableOptions();


    $("status").textContent =
      `🚫 QUESTION ${d.questionNumber} BLOCKED - APP/SCREEN SWITCH DETECTED`;

  }

});


// REVEAL ANSWER

socket.on("reveal", d => {

  clearInterval(tick);


  document
    .querySelectorAll(".option")
    .forEach((b, i) => {

      b.disabled = true;


      if (i === d.answer) {

        b.classList.add(
          "correct"
        );

      }

      else if (
        b.classList.contains(
          "selected"
        )
      ) {

        b.classList.add(
          "wrong"
        );

      }

      else {

        b.classList.add(
          "dim"
        );

      }

    });

});


// FINAL RANKING

function renderRanks(list, target) {

  $(target).innerHTML =
    list.map(
      (p, i) =>

        `<div class="rankRow">

          <b>
            #${i + 1}
          </b>

          <span>

            ${p.name}

            <small>
              · ${p.registerNo}
            </small>

          </span>

          <strong>
            ${p.score}
          </strong>

        </div>`

    ).join("");

}


// FINAL PODIUM

function renderPodium(list, target) {

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
      (p, i) => p

        ? `<div
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
              ${p.name}
            </strong>

            <span>
              ${p.score}
            </span>

          </div>`

        : ""

    ).join("");

}


// QUIZ FINISHED

socket.on("quiz:finished", d => {

  clearInterval(tick);


  show("final");


  renderPodium(
    d.leaderboard,
    $("podium").id
  );


  renderRanks(
    d.leaderboard,
    "ranking"
  );

});


// QUIZ RESET

socket.on(
  "quiz:reset",
  () => location.reload()
);


// REPORT CURRENT QUESTION VIOLATION

function reportViolation(type) {

  if (
    !me ||
    !current ||
    answered ||
    questionBlocked ||
    visibilityReporting
  ) {

    return;

  }


  visibilityReporting = true;


  socket.emit(
    "player:visibilityViolation",
    {
      index: current.index
    },
    r => {

      visibilityReporting = false;


      if (!r?.ok) {

        return;

      }


      if (r.blocked) {

        questionBlocked = true;


        disableOptions();


        const reason =
          type === "screen"

            ? "SCREEN SEARCH DETECTED"

            : "APP SWITCHING DETECTED";


        $("status").textContent =
          `🚫 QUESTION ${r.questionNumber} BLOCKED - ${reason}`;

      }

    }
  );

}


// APP / TAB SWITCH DETECTION

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState !== "hidden"
    ) {

      return;

    }


    reportViolation(
      "app"
    );

  }
);


// CIRCLE TO SEARCH / SCREEN SEARCH DETECTION

window.addEventListener(
  "blur",
  () => {

    reportViolation(
      "screen"
    );

  }
);


// PLAYER REMOVED BY HOST

socket.on(
  "player:removed",
  () => {

    clearInterval(tick);


    me = null;


    current = null;


    answered = false;


    questionBlocked = false;


    visibilityReporting = false;


    show("join");


    $("joinMsg").textContent =
      "🚫 You were removed by the host";

  }
);