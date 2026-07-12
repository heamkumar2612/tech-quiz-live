const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const questions = require("./questions");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});


const QUIZ_CODE =
  process.env.QUIZ_CODE || "482917";

const QUESTION_TIME = 20;
const READING_TIME = 5;

const MIN_CORRECT = 500;
const SPEED_BONUS = 500;


let players = new Map();


let quiz = {
  started: false,
  finished: false,
  index: -1,
  startedAt: 0,
  timer: null,
  answers: new Map()
};


// ============================================================
// HELPER - CHECK SCRAMBLED QUESTION
// ============================================================

function isScrambledQuestion(q) {
  return q && q.type === "scrambled";
}


// ============================================================
// HELPER - NORMALIZE TYPED ANSWER
// ============================================================

function normalizeAnswer(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}


// ============================================================
// PUBLIC PLAYER DATA
// ============================================================

const publicPlayers = () =>
  [...players.values()].map(
    ({ socketId, blockedQuestions, ...p }) => p
  );


// ============================================================
// LEADERBOARD
// ============================================================

const leaderboard = () =>
  publicPlayers().sort(
    (a, b) =>
      b.score - a.score ||
      b.correct - a.correct ||
      a.name.localeCompare(b.name)
  );


// ============================================================
// CURRENT QUESTION
// ============================================================

const currentPayload = () => {

  if (
    quiz.index < 0 ||
    quiz.index >= questions.length
  ) {
    return null;
  }


  const q = questions[quiz.index];

  const scrambled =
    isScrambledQuestion(q);


  return {
    index: quiz.index,

    total: questions.length,

    type:
      scrambled
        ? "scrambled"
        : "mcq",

    question: q.question,

    options:
      scrambled
        ? null
        : q.options,

    scrambled:
      scrambled
        ? q.scrambled
        : null,

    duration: QUESTION_TIME,

    readingTime: READING_TIME,

    startedAt: quiz.startedAt
  };

};


// ============================================================
// BROADCAST PLAYER LIST
// ============================================================

function broadcastLobby() {

  io.emit(
    "lobby:update",
    {
      count: players.size,
      players: publicPlayers()
    }
  );

}


// ============================================================
// START QUESTION
// ============================================================

function startQuestion() {

  clearTimeout(
    quiz.timer
  );


  quiz.answers =
    new Map();


  // 5 SECOND READING TIME

  quiz.startedAt =
    Date.now() +
    READING_TIME * 1000;


  io.emit(
    "question",
    currentPayload()
  );


  quiz.timer =
    setTimeout(
      revealQuestion,

      (
        READING_TIME +
        QUESTION_TIME
      ) * 1000 + 250
    );

}


// ============================================================
// REVEAL QUESTION
// ============================================================

function revealQuestion() {

  clearTimeout(
    quiz.timer
  );


  if (
    !quiz.started ||
    quiz.finished ||
    quiz.index < 0
  ) {
    return;
  }


  const q =
    questions[quiz.index];


  const scrambled =
    isScrambledQuestion(q);


  let revealedAnswer;


  if (scrambled) {

    revealedAnswer =
      q.answer;

  } else {

    revealedAnswer =
      q.answer;

  }


  io.emit(
    "reveal",
    {
      type:
        scrambled
          ? "scrambled"
          : "mcq",

      answer:
        revealedAnswer,

      answerText:
        scrambled
          ? q.answer
          : q.options[q.answer],

      leaderboard:
        leaderboard().slice(0, 5)
    }
  );

}


// ============================================================
// FINISH QUIZ
// ============================================================

function finishQuiz() {

  clearTimeout(
    quiz.timer
  );


  quiz.finished = true;

  quiz.started = false;


  io.emit(
    "quiz:finished",
    {
      leaderboard:
        leaderboard()
    }
  );

}


// ============================================================
// SOCKET CONNECTION
// ============================================================

io.on(
  "connection",
  socket => {


    // ========================================================
    // PLAYER JOIN
    // ========================================================

    socket.on(
      "player:join",
      (
        {
          name,
          registerNo,
          code
        },
        ack
      ) => {


        name =
          String(name || "")
            .trim()
            .slice(0, 40);


        registerNo =
          String(registerNo || "")
            .trim()
            .slice(0, 30);


        if (
          String(code || "").trim()
          !== QUIZ_CODE
        ) {

          return ack?.({
            ok: false,
            error:
              "Wrong quiz code"
          });

        }


        if (
          !name ||
          !registerNo
        ) {

          return ack?.({
            ok: false,
            error:
              "Enter name and roll number"
          });

        }


        if (
          quiz.started ||
          quiz.finished
        ) {

          return ack?.({
            ok: false,
            error:
              "Quiz already started"
          });

        }


        const duplicate =
          [...players.values()].some(
            p =>
              p.registerNo
                .toLowerCase()
              ===
              registerNo
                .toLowerCase()
          );


        if (duplicate) {

          return ack?.({
            ok: false,
            error:
              "Roll number already joined"
          });

        }


        players.set(
          socket.id,
          {
            id: socket.id,

            name,

            registerNo,

            score: 0,

            correct: 0,

            answered: 0,

            blockedQuestions:
              new Set(),

            socketId:
              socket.id
          }
        );


        socket.data.role =
          "player";


        socket.data.playerId =
          socket.id;


        ack?.({
          ok: true,

          player:
            players.get(socket.id)
        });


        broadcastLobby();

      }
    );


    // ========================================================
    // HOST LOGIN
    // ========================================================

    socket.on(
      "host:auth",
      ({ code }, ack) => {


        if (
          String(code || "")
          !== QUIZ_CODE
        ) {

          return ack?.({
            ok: false
          });

        }


        socket.data.role =
          "host";


        ack?.({
          ok: true,

          state: {
            started:
              quiz.started,

            finished:
              quiz.finished,

            index:
              quiz.index,

            count:
              players.size,

            players:
              publicPlayers(),

            leaderboard:
              leaderboard()
          }
        });

      }
    );


    // ========================================================
    // HOST MANUALLY REMOVE PLAYER
    // ========================================================

    socket.on(
      "host:removePlayer",
      ({ playerId }, ack) => {


        if (
          socket.data.role !== "host"
        ) {

          return ack?.({
            ok: false,

            error:
              "Host access required"
          });

        }


        const player =
          players.get(playerId);


        if (!player) {

          return ack?.({
            ok: false,

            error:
              "Player not found"
          });

        }


        // INFORM PLAYER

        io.to(playerId).emit(
          "player:removed"
        );


        // REMOVE PLAYER

        players.delete(
          playerId
        );


        // REMOVE CURRENT ANSWER

        quiz.answers.delete(
          playerId
        );


        // UPDATE PLAYER LIST

        broadcastLobby();


        ack?.({
          ok: true,

          player: {
            name:
              player.name,

            registerNo:
              player.registerNo
          }
        });

      }
    );


    // ========================================================
    // START QUIZ
    // ========================================================

    socket.on(
      "host:start",
      () => {


        if (
          socket.data.role !== "host" ||
          quiz.started ||
          quiz.finished ||
          players.size === 0
        ) {
          return;
        }


        quiz.started = true;

        quiz.index = 0;


        io.emit(
          "quiz:started"
        );


        startQuestion();

      }
    );


    // ========================================================
    // NEXT QUESTION
    // ========================================================

    socket.on(
      "host:next",
      () => {


        if (
          socket.data.role !== "host" ||
          !quiz.started
        ) {
          return;
        }


        if (
          quiz.index >=
          questions.length - 1
        ) {

          return finishQuiz();

        }


        quiz.index++;


        startQuestion();

      }
    );


    // ========================================================
    // REVEAL ANSWER
    // ========================================================

    socket.on(
      "host:reveal",
      () => {


        if (
          socket.data.role === "host"
        ) {

          revealQuestion();

        }

      }
    );


    // ========================================================
    // RESET QUIZ
    // ========================================================

    socket.on(
      "host:reset",
      () => {


        if (
          socket.data.role !== "host"
        ) {
          return;
        }


        clearTimeout(
          quiz.timer
        );


        players.clear();


        quiz = {
          started: false,

          finished: false,

          index: -1,

          startedAt: 0,

          timer: null,

          answers:
            new Map()
        };


        io.emit(
          "quiz:reset"
        );


        broadcastLobby();

      }
    );


    // ========================================================
    // APP SWITCH / CIRCLE TO SEARCH DETECTION
    // ========================================================

    socket.on(
      "player:visibilityViolation",
      ({ index }, ack) => {


        const p =
          players.get(socket.id);


        if (
          !p ||
          socket.data.role !== "player" ||
          !quiz.started ||
          quiz.finished ||
          index !== quiz.index ||
          quiz.answers.has(socket.id)
        ) {

          return ack?.({
            ok: false
          });

        }


        if (
          !(p.blockedQuestions instanceof Set)
        ) {

          p.blockedQuestions =
            new Set();

        }


        // CURRENT QUESTION ALREADY BLOCKED

        if (
          p.blockedQuestions.has(
            quiz.index
          )
        ) {

          return ack?.({
            ok: true,

            blocked: true,

            index:
              quiz.index,

            questionNumber:
              quiz.index + 1
          });

        }


        // BLOCK ONLY CURRENT QUESTION

        p.blockedQuestions.add(
          quiz.index
        );


        players.set(
          socket.id,
          p
        );


        // INFORM PLAYER

        io.to(socket.id).emit(
          "player:violation",
          {
            blocked: true,

            index:
              quiz.index,

            questionNumber:
              quiz.index + 1
          }
        );


        // INFORM HOST

        io.emit(
          "host:violation",
          {
            id:
              p.id,

            playerId:
              p.id,

            name:
              p.name,

            registerNo:
              p.registerNo,

            index:
              quiz.index,

            questionNumber:
              quiz.index + 1,

            blocked: true
          }
        );


        ack?.({
          ok: true,

          blocked: true,

          index:
            quiz.index,

          questionNumber:
            quiz.index + 1
        });

      }
    );


    // ========================================================
    // PLAYER ANSWER
    // SUPPORTS MCQ + SCRAMBLED WORD
    // ========================================================

    socket.on(
      "answer",
      (
        {
          index,
          option,
          textAnswer
        },
        ack
      ) => {


        const p =
          players.get(socket.id);


        if (
          !p ||
          !quiz.started ||
          quiz.finished ||
          index !== quiz.index ||
          quiz.answers.has(socket.id)
        ) {

          return ack?.({
            ok: false
          });

        }


        // BLOCK ONLY CURRENT QUESTION

        if (
          p.blockedQuestions instanceof Set &&
          p.blockedQuestions.has(
            quiz.index
          )
        ) {

          return ack?.({
            ok: false,

            error:
              `Question ${quiz.index + 1} blocked: app switching detected`
          });

        }


        // BLOCK DURING READING TIME

        if (
          Date.now() <
          quiz.startedAt
        ) {

          return ack?.({
            ok: false,

            error:
              "Reading time - wait before answering"
          });

        }


        const elapsed =
          (
            Date.now() -
            quiz.startedAt
          ) / 1000;


        if (
          elapsed >
          QUESTION_TIME + 0.5
        ) {

          return ack?.({
            ok: false,

            error:
              "Time over"
          });

        }


        const q =
          questions[quiz.index];


        const scrambled =
          isScrambledQuestion(q);


        let playerAnswer;

        let correct = false;


        // ====================================================
        // SCRAMBLED WORD ANSWER CHECK
        // ====================================================

        if (scrambled) {

          playerAnswer =
            normalizeAnswer(
              textAnswer
            );


          if (!playerAnswer) {

            return ack?.({
              ok: false,

              error:
                "Enter your answer"
            });

          }


          const correctAnswer =
            normalizeAnswer(
              q.answer
            );


          correct =
            playerAnswer ===
            correctAnswer;


          quiz.answers.set(
            socket.id,
            playerAnswer
          );

        }


        // ====================================================
        // MCQ ANSWER CHECK
        // ====================================================

        else {

          option =
            Number(option);


          if (
            !Number.isInteger(option) ||
            option < 0 ||
            option >=
              q.options.length
          ) {

            return ack?.({
              ok: false,

              error:
                "Invalid answer"
            });

          }


          playerAnswer =
            option;


          correct =
            option ===
            q.answer;


          quiz.answers.set(
            socket.id,
            option
          );

        }


        // ====================================================
        // UPDATE PLAYER STATS
        // ====================================================

        p.answered++;


        let points = 0;


        if (correct) {


          const remaining =
            Math.max(
              0,

              QUESTION_TIME -
              elapsed
            );


          points =
            Math.round(
              MIN_CORRECT +

              SPEED_BONUS *

              (
                remaining /
                QUESTION_TIME
              )
            );


          p.score +=
            points;


          p.correct++;

        }


        players.set(
          socket.id,
          p
        );


        // ====================================================
        // ACKNOWLEDGE ANSWER
        // ====================================================

        ack?.({
          ok: true,

          correct,

          points,

          score:
            p.score,

          type:
            scrambled
              ? "scrambled"
              : "mcq"
        });


        // ====================================================
        // SEND RESULT TO PLAYER
        // ====================================================

        io.to(socket.id).emit(
          "answer:result",
          {
            correct,

            points,

            score:
              p.score,

            type:
              scrambled
                ? "scrambled"
                : "mcq"
          }
        );

      }
    );


    // ========================================================
    // PLAYER DISCONNECT
    // ========================================================

    socket.on(
      "disconnect",
      () => {


        if (
          !quiz.started &&
          players.has(socket.id)
        ) {


          players.delete(
            socket.id
          );


          broadcastLobby();

        }

      }
    );


  }
);


// ============================================================
// SERVER PORT
// ============================================================

const PORT =
  process.env.PORT || 3000;


server.listen(
  PORT,
  () => {

    console.log(
      `Quiz running on port ${PORT}`
    );

    console.log(
      `Total questions: ${questions.length}`
    );

    console.log(
      "Q1-Q65: MCQ"
    );

    console.log(
      "Q66-Q95: Scrambled Word Round"
    );

  }
);