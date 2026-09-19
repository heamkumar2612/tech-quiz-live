const socket = io();

const $ = id =>
  document.getElementById(id);


let me = null;

let current = null;

let answered = false;

let tick = null;

let playerState = "";


// BLOCK IS ONLY FOR CURRENT QUESTION

let questionBlocked = false;


// PREVENT MULTIPLE VISIBILITY REPORTS

let visibilityReporting = false;


// ============================================================
// SHOW SECTION
// ============================================================

function show(id) {

  [
    "join",
    "lobby",
    "game",
    "final"
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
// CHECK QUESTION TYPE
// ============================================================

function isScrambledQuestion() {

  return (
    current &&
    current.type === "scrambled"
  );

}

function renderPlayerIdentity() {
  if (!me) return;
  [
    ["lobbyIdentityName", "lobbyIdentityRoll"],
    ["gameIdentityName", "gameIdentityRoll"],
    ["finalIdentityName", "finalIdentityRoll"]
  ].forEach(([nameId, rollId]) => {
    const name = $(nameId);
    const roll = $(rollId);
    if (name) name.textContent = `👤 ${me.name}`;
    if (roll) roll.textContent = `Roll No: ${me.registerNo}`;
  });
}


// ============================================================
// PLAYER JOIN
// ============================================================

$("joinBtn").onclick = () => {

  socket.emit(
    "player:join",

    {
      code:
        $("code").value,

      name:
        $("name").value,

      registerNo:
        $("reg").value
    },

    r => {

      if (!r?.ok) {

        $("joinMsg").textContent =
          r?.error ||
          "Could not join";

        return;

      }


      me = r.player;


      $("playerName").textContent =
        me.name;

      renderPlayerIdentity();


      $("joinMsg").textContent =
        "";


      show("lobby");

      playerState = r.state || "LOBBY";
      $("lobbyStatus").textContent = playerState === "WAITING"
        ? "Waiting for host approval..."
        : "Waiting for the host to start...";

    }
  );

};


// ============================================================
// LOBBY UPDATE
// ============================================================

socket.on(
  "lobby:update",

  d => {

    $("lobbyCount").textContent =
      d.count;

  }
);


// ============================================================
// QUIZ STARTED
// ============================================================

socket.on(
  "quiz:started",

  () => {

    if (playerState === "WAITING" || playerState === "REJECTED") {
      return;
    }

    $("status").textContent =
      "Get ready...";


    show("game");

  }
);


// ============================================================
// DISABLE ANSWER CONTROLS
// ============================================================

function disableOptions() {

  document
    .querySelectorAll(".option")
    .forEach(
      b => {

        b.disabled = true;

      }
    );


  const input =
    $("scrambledInput");


  const button =
    $("scrambledSubmit");


  if (input) {

    input.disabled = true;

  }


  if (button) {

    button.disabled = true;

  }

}


// ============================================================
// ENABLE ANSWER CONTROLS
// ============================================================

function enableAnswerControls() {

  if (
    answered ||
    questionBlocked
  ) {

    return;

  }


  if (isScrambledQuestion()) {

    const input =
      $("scrambledInput");


    const button =
      $("scrambledSubmit");


    if (input) {

      input.disabled = false;

    }


    if (button) {

      button.disabled = false;

    }


    $("status").textContent =
      "Type the unscrambled word";

  }

  else {

    document
      .querySelectorAll(".option")
      .forEach(
        b => {

          b.disabled = false;

        }
      );


    $("status").textContent =
      "Choose your answer";

  }

}


// ============================================================
// TIMER + 5 SECOND READING TIME
// ============================================================

function runTimer(payload) {

  clearInterval(tick);


  const answerStart =
    payload.startedAt;


  const answerEnd =
    answerStart +
    payload.duration * 1000;


  disableOptions();


  tick = setInterval(
    () => {

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
            (
              answerStart -
              now
            ) / 1000
          );


        $("timer").textContent =
          readingLeft;


        $("timerBar").style.transform =
          `scaleX(${
            readingLeft /
            payload.readingTime
          })`;


        $("status").textContent =
          `📖 READ QUESTION - ${readingLeft}`;


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


      $("timer").textContent =
        Math.ceil(left);


      $("timerBar").style.transform =
        `scaleX(${
          left /
          payload.duration
        })`;


      if (!answered) {

        enableAnswerControls();

      }


      // TIME OVER

      if (left <= 0) {

        clearInterval(tick);


        disableOptions();


        $("status").textContent =
          answered
            ? "Answer locked!"
            : "TIME UP!";

      }

    },

    50
  );

}


// ============================================================
// SUBMIT SCRAMBLED ANSWER
// ============================================================

function submitScrambledAnswer(q) {

  if (
    answered ||
    questionBlocked
  ) {

    return;

  }


  const input =
    $("scrambledInput");


  if (!input) {

    return;

  }


  const textAnswer =
    input.value.trim();


  if (!textAnswer) {

    $("status").textContent =
      "Enter your answer";

    input.focus();

    return;

  }


  // DO NOT SET ANSWERED TRUE YET.
  // WAIT UNTIL SERVER ACCEPTS ANSWER.

  disableOptions();


  $("status").textContent =
    "Submitting answer...";


  socket.emit(
    "answer",

    {
      index:
        q.index,

      textAnswer:
        textAnswer
    },

    r => {

      if (!r?.ok) {

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


        return;

      }


      answered = true;


      disableOptions();


      input.classList.add(
        "selected"
      );


      $("status").textContent =
        "Answer locked!";

    }
  );

}


// ============================================================
// RENDER MCQ QUESTION
// ============================================================

function renderMCQ(q) {

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
    .forEach(
      b => {

        b.onclick = () => {

          if (
            answered ||
            questionBlocked
          ) {

            return;

          }


          // DO NOT SET ANSWERED TRUE
          // UNTIL SERVER ACCEPTS ANSWER


          disableOptions();


          b.classList.add(
            "selected"
          );


          $("status").textContent =
            "Submitting answer...";


          socket.emit(
            "answer",

            {
              index:
                q.index,

              option:
                +b.dataset.i
            },

            r => {

              if (!r?.ok) {

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


                return;

              }


              answered = true;


              disableOptions();


              $("status").textContent =
                "Answer locked!";

            }
          );

        };

      }
    );

}


// ============================================================
// RENDER SCRAMBLED WORD QUESTION
// ============================================================

function renderScrambled(q) {

  $("options").innerHTML = `

    <div class="scrambledRound">

      <div class="scrambledLabel">
        🔀 SCRAMBLED WORD
      </div>


      <div class="scrambledWord">
        ${q.scrambled}
      </div>


      <input
        id="scrambledInput"
        class="scrambledInput"
        type="text"
        placeholder="Type your answer"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        disabled
      >


      <button
        id="scrambledSubmit"
        class="scrambledSubmit"
        disabled
      >
        SUBMIT ANSWER
      </button>


      <div
        id="scrambledReveal"
        class="scrambledReveal hidden"
      ></div>

    </div>

  `;


  const input =
    $("scrambledInput");


  const submit =
    $("scrambledSubmit");


  submit.onclick = () => {

    submitScrambledAnswer(q);

  };


  input.addEventListener(
    "keydown",

    e => {

      if (e.key === "Enter") {

        e.preventDefault();


        submitScrambledAnswer(q);

      }

    }
  );

}


// ============================================================
// QUESTION
// ============================================================

socket.on(
  "question",

  q => {

    current = q;


    answered = false;


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


    // SCRAMBLED QUESTION

    if (
      q.type === "scrambled"
    ) {

      renderScrambled(q);

    }


    // MCQ QUESTION

    else {

      renderMCQ(q);

    }


    runTimer(q);

  }
);


// ============================================================
// ANSWER RESULT
// ============================================================

socket.on(
  "answer:result",

  r => {

    $("score").textContent =
      r.score;


    $("status").textContent =
      r.correct

        ? `CORRECT! +${r.points} POINTS`

        : "WRONG ANSWER";

  }
);


// ============================================================
// PLAYER VIOLATION
// ============================================================

socket.on(
  "player:violation",

  d => {

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

  }
);

socket.on("player:blocked", d => {
  if (!current || d.index !== current.index) return;
  questionBlocked = true;
  disableOptions();
  $("status").textContent = d.message || "Your answer is blocked for this question.";
});


// ============================================================
// REVEAL ANSWER
// ============================================================

socket.on(
  "reveal",

  d => {

    clearInterval(tick);


    disableOptions();


    // ========================================================
    // SCRAMBLED WORD REVEAL
    // ========================================================

    if (
      current &&
      current.type === "scrambled"
    ) {

      const reveal =
        $("scrambledReveal");


      const input =
        $("scrambledInput");


      if (reveal) {

        reveal.classList.remove(
          "hidden"
        );


        reveal.textContent =
          `CORRECT ANSWER: ${d.answerText}`;

      }


      if (input) {

        const playerAnswer =
          input.value
            .trim()
            .replace(/\s+/g, " ")
            .toUpperCase();


        const correctAnswer =
          String(
            d.answerText || ""
          )
            .trim()
            .replace(/\s+/g, " ")
            .toUpperCase();


        if (
          playerAnswer &&
          playerAnswer === correctAnswer
        ) {

          input.classList.add(
            "correct"
          );

        }

        else if (playerAnswer) {

          input.classList.add(
            "wrong"
          );

        }

      }


      $("status").textContent =
        `ANSWER: ${d.answerText}`;


      return;

    }


    // ========================================================
    // MCQ REVEAL
    // ========================================================

    document
      .querySelectorAll(".option")
      .forEach(
        (b, i) => {

          b.disabled = true;


          if (
            i === d.answer
          ) {

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

        }
      );

  }
);


// ============================================================
// FINAL RANKING
// ============================================================

function renderRanks(
  list,
  target
) {

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


// ============================================================
// FINAL PODIUM
// ============================================================

function renderPodium(
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


// ============================================================
// QUIZ FINISHED
// ============================================================

socket.on(
  "quiz:finished",

  d => {

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
// REPORT CURRENT QUESTION VIOLATION
// ============================================================

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
      index:
        current.index
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


// ============================================================
// APP / TAB SWITCH DETECTION
// ============================================================

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


// ============================================================
// CIRCLE TO SEARCH / SCREEN SEARCH DETECTION
// ============================================================

window.addEventListener(
  "blur",

  () => {

    reportViolation(
      "screen"
    );

  }
);


// ============================================================
// PLAYER REMOVED BY HOST
// ============================================================

socket.on(
  "player:removed",

  d => {

    clearInterval(tick);


    me = null;


    current = null;


    answered = false;


    questionBlocked = false;


    visibilityReporting = false;


    show("join");


    $("joinMsg").textContent =
      d?.message ||
      "You were removed by the host";

  }
);

socket.on("player:lobby", () => {
  playerState = "LOBBY";
  show("lobby");
});

socket.on("player:waiting", d => {
  playerState = "WAITING";
  show("lobby");
  $("lobbyStatus").textContent = d?.message || "Waiting for host approval...";
});

socket.on("player:approved", d => {
  playerState = "ACTIVE";
  show("lobby");
  $("lobbyStatus").textContent = d?.message || "Approved. You will join from the next question.";
});

socket.on("player:rejected", d => {
  playerState = "REJECTED";
  clearInterval(tick);
  show("lobby");
  $("lobbyStatus").textContent = d?.message || "Your request was rejected by the host.";
});