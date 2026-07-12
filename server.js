const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const questions = require("./questions");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const QUIZ_CODE = process.env.QUIZ_CODE || "482917";
const QUESTION_TIME = 20;
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

const publicPlayers = () =>
  [...players.values()].map(({ socketId, ...p }) => p);

const leaderboard = () =>
  publicPlayers().sort(
    (a, b) =>
      b.score - a.score ||
      b.correct - a.correct ||
      a.name.localeCompare(b.name)
  );

const currentPayload = () => {
  if (quiz.index < 0 || quiz.index >= questions.length) {
    return null;
  }

  const q = questions[quiz.index];

  return {
    index: quiz.index,
    total: questions.length,
    question: q.question,
    options: q.options,
    duration: QUESTION_TIME,
    startedAt: quiz.startedAt
  };
};

function broadcastLobby() {
  io.emit("lobby:update", {
    count: players.size,
    players: publicPlayers()
  });
}

function startQuestion() {
  clearTimeout(quiz.timer);

  quiz.answers = new Map();
  quiz.startedAt = Date.now();

  io.emit("question", currentPayload());

  quiz.timer = setTimeout(
    revealQuestion,
    QUESTION_TIME * 1000 + 250
  );
}

function revealQuestion() {
  clearTimeout(quiz.timer);

  if (
    !quiz.started ||
    quiz.finished ||
    quiz.index < 0
  ) {
    return;
  }

  const q = questions[quiz.index];

  io.emit("reveal", {
    answer: q.answer,
    leaderboard: leaderboard().slice(0, 5)
  });
}

function finishQuiz() {
  clearTimeout(quiz.timer);

  quiz.finished = true;
  quiz.started = false;

  io.emit("quiz:finished", {
    leaderboard: leaderboard()
  });
}

io.on("connection", socket => {

  // PLAYER JOIN
  socket.on(
    "player:join",
    ({ name, registerNo, code }, ack) => {

      name = String(name || "")
        .trim()
        .slice(0, 40);

      registerNo = String(registerNo || "")
        .trim()
        .slice(0, 30);

      if (String(code || "").trim() !== QUIZ_CODE) {
        return ack({
          ok: false,
          error: "Wrong quiz code"
        });
      }

      if (!name || !registerNo) {
        return ack({
          ok: false,
          error: "Enter name and roll number"
        });
      }

      if (quiz.started || quiz.finished) {
        return ack({
          ok: false,
          error: "Quiz already started"
        });
      }

      const duplicate = [...players.values()].some(
        p =>
          p.registerNo.toLowerCase() ===
          registerNo.toLowerCase()
      );

      if (duplicate) {
        return ack({
          ok: false,
          error: "Roll number already joined"
        });
      }

      players.set(socket.id, {
        id: socket.id,
        name,
        registerNo,
        score: 0,
        correct: 0,
        answered: 0,
        violations: {},
        socketId: socket.id
      });

      socket.data.role = "player";
      socket.data.playerId = socket.id;

      ack({
        ok: true,
        player: players.get(socket.id)
      });

      broadcastLobby();
    }
  );

  // HOST LOGIN
  socket.on("host:auth", ({ code }, ack) => {

    if (String(code || "") !== QUIZ_CODE) {
      return ack({ ok: false });
    }

    socket.data.role = "host";

    ack({
      ok: true,
      state: {
        started: quiz.started,
        finished: quiz.finished,
        index: quiz.index,
        count: players.size,
        leaderboard: leaderboard()
      }
    });
  });

  // START QUIZ
  socket.on("host:start", () => {

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

    io.emit("quiz:started");

    startQuestion();
  });

  // NEXT QUESTION
  socket.on("host:next", () => {

    if (
      socket.data.role !== "host" ||
      !quiz.started
    ) {
      return;
    }

    if (quiz.index >= questions.length - 1) {
      return finishQuiz();
    }

    quiz.index++;

    startQuestion();
  });

  // REVEAL ANSWER
  socket.on("host:reveal", () => {

    if (socket.data.role === "host") {
      revealQuestion();
    }
  });

  // RESET QUIZ
  socket.on("host:reset", () => {

    if (socket.data.role !== "host") {
      return;
    }

    clearTimeout(quiz.timer);

    players.clear();

    quiz = {
      started: false,
      finished: false,
      index: -1,
      startedAt: 0,
      timer: null,
      answers: new Map()
    };

    io.emit("quiz:reset");

    broadcastLobby();
  });

  // APP SWITCH / TAB SWITCH DETECTION
  socket.on(
    "player:visibilityViolation",
    ({ index }, ack) => {

      const p = players.get(socket.id);

      if (
        !p ||
        socket.data.role !== "player" ||
        !quiz.started ||
        quiz.finished ||
        index !== quiz.index ||
        quiz.answers.has(socket.id)
      ) {
        return ack?.({ ok: false });
      }

      if (!p.violations) {
        p.violations = {};
      }

      p.violations[index] =
        (p.violations[index] || 0) + 1;

      const warningCount =
        p.violations[index];

      players.set(socket.id, p);

      io.to(socket.id).emit(
        "player:violation",
        {
          warnings: warningCount,
          blocked: warningCount >= 2
        }
      );

      io.emit("host:violation", {
        name: p.name,
        registerNo: p.registerNo,
        index: quiz.index,
        warnings: warningCount
      });

      ack?.({
        ok: true,
        warnings: warningCount,
        blocked: warningCount >= 2
      });
    }
  );

  // PLAYER ANSWER
  socket.on(
    "answer",
    ({ index, option }, ack) => {

      const p = players.get(socket.id);

      if (
        !p ||
        !quiz.started ||
        quiz.finished ||
        index !== quiz.index ||
        quiz.answers.has(socket.id)
      ) {
        return ack?.({ ok: false });
      }

      // BLOCK AFTER 2 APP SWITCHES
      if (p.violations?.[quiz.index] >= 2) {
        return ack?.({
          ok: false,
          error:
            "Answer blocked: app switching detected"
        });
      }

      const elapsed =
        (Date.now() - quiz.startedAt) / 1000;

      if (elapsed > QUESTION_TIME + 0.5) {
        return ack?.({
          ok: false,
          error: "Time over"
        });
      }

      option = Number(option);

      if (
        !Number.isInteger(option) ||
        option < 0 ||
        option >= questions[quiz.index].options.length
      ) {
        return ack?.({
          ok: false,
          error: "Invalid answer"
        });
      }

      quiz.answers.set(
        socket.id,
        option
      );

      p.answered++;

      const correct =
        option ===
        questions[quiz.index].answer;

      let points = 0;

      if (correct) {

        const remaining = Math.max(
          0,
          QUESTION_TIME - elapsed
        );

        points = Math.round(
          MIN_CORRECT +
          SPEED_BONUS *
          (remaining / QUESTION_TIME)
        );

        p.score += points;
        p.correct++;
      }

      players.set(socket.id, p);

      ack?.({
        ok: true,
        correct,
        points,
        score: p.score
      });

      io.to(socket.id).emit(
        "answer:result",
        {
          correct,
          points,
          score: p.score
        }
      );
    }
  );

  // PLAYER DISCONNECT
  socket.on("disconnect", () => {

    if (
      !quiz.started &&
      players.has(socket.id)
    ) {
      players.delete(socket.id);

      broadcastLobby();
    }
  });

});

const PORT =
  process.env.PORT || 3000;

server.listen(PORT, () =>
  console.log(
    `Quiz running on port ${PORT}`
  )
);