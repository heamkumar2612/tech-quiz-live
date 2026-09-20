const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const questions = require("./questions");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const QUIZ_CODE = process.env.QUIZ_CODE || "482917";
const MCQ_TIME = 5;
const SCRAMBLED_TIME = 5;
const MCQ_READING_TIME = 5;
const SCRAMBLED_READING_TIME = 5;
const STATES = Object.freeze({ LOBBY: "LOBBY", WAITING: "WAITING", ACTIVE: "ACTIVE", REJECTED: "REJECTED", REMOVED: "REMOVED" });
let players = new Map();
let quiz = createQuiz();

function createQuiz() { return { started: false, finished: false, index: -1, startedAt: 0, deadline: 0, timer: null, answers: new Map() }; }
function isScrambledQuestion(question) { return question && question.type === "scrambled"; }
function questionDuration(question) { return isScrambledQuestion(question) ? SCRAMBLED_TIME : MCQ_TIME; }
function questionReadingTime(question) { return isScrambledQuestion(question) ? SCRAMBLED_READING_TIME : MCQ_READING_TIME; }
function normalizeAnswer(value) { return String(value || "").trim().replace(/\s+/g, " ").toUpperCase(); }
function currentQuestion() { return questions[quiz.index] || null; }
function currentAnswered(player) { return quiz.answers.has(player.id); }
function publicPlayer(player) {
  return { id: player.id, name: player.name, registerNo: player.registerNo, score: player.score, correct: player.correct, answered: currentAnswered(player), answeredCount: player.answered, state: player.state, blocked: player.blockedQuestions.has(quiz.index), currentQuestion: quiz.index >= 0 ? quiz.index + 1 : null };
}
function publicPlayers() { return [...players.values()].filter(p => p.state !== STATES.WAITING && p.state !== STATES.REJECTED && p.state !== STATES.REMOVED).map(publicPlayer); }
function pendingPlayers() { return [...players.values()].filter(p => p.state === STATES.WAITING).map(publicPlayer); }
function leaderboard() { return publicPlayers().sort((a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name)); }
function broadcastLobby() { io.emit("lobby:update", { count: publicPlayers().length, players: publicPlayers(), pending: pendingPlayers() }); }
function questionPayload() {
  const question = currentQuestion();
  if (!question) return null;
  const scrambled = isScrambledQuestion(question);
  return { index: quiz.index, total: questions.length, type: scrambled ? "scrambled" : "mcq", question: question.question, options: scrambled ? null : question.options, scrambled: scrambled ? question.scrambled : null, duration: questionDuration(question), readingTime: questionReadingTime(question), startedAt: quiz.startedAt, deadline: quiz.deadline };
}
function emitToActive(event, payload) {
  for (const player of players.values()) if (player.state === STATES.ACTIVE) io.to(player.id).emit(event, payload);
  for (const connectedSocket of io.sockets.sockets.values()) if (connectedSocket.data.role === "host") connectedSocket.emit(event, payload);
}
function startQuestion() {
  clearTimeout(quiz.timer);
  quiz.answers = new Map();
  quiz.startedAt = Date.now() + questionReadingTime(currentQuestion()) * 1000;
  quiz.deadline = quiz.startedAt + questionDuration(currentQuestion()) * 1000;
  emitToActive("question", questionPayload());
  quiz.timer = setTimeout(revealQuestion, (questionReadingTime(currentQuestion()) + questionDuration(currentQuestion())) * 1000 + 50);
  broadcastLobby();
}
function revealQuestion() {
  clearTimeout(quiz.timer);
  if (!quiz.started || quiz.finished || quiz.index < 0) return;
  const question = currentQuestion();
  emitToActive("reveal", { type: isScrambledQuestion(question) ? "scrambled" : "mcq", answer: question.answer, answerText: isScrambledQuestion(question) ? question.answer : question.options[question.answer], leaderboard: leaderboard().slice(0, 5) });
}
function finishQuiz() { clearTimeout(quiz.timer); quiz.finished = true; quiz.started = false; io.emit("quiz:finished", { leaderboard: leaderboard() }); }
function rejectAck(ack, error) { ack?.({ ok: false, error }); }
function validHost(socket, ack) { if (socket.data.role === "host") return true; rejectAck(ack, "Host access required"); return false; }
function scoreFor(question, elapsed) { if (elapsed >= questionDuration(question)) return 0; if (isScrambledQuestion(question)) return Math.max(1, 10 - Math.floor(elapsed)); return [10, 8, 6, 4, 2][Math.floor(elapsed)] || 0; }

io.on("connection", socket => {
  socket.on("player:join", ({ name, registerNo, code } = {}, ack) => {
    name = String(name || "").trim().slice(0, 40); registerNo = String(registerNo || "").trim().slice(0, 30);
    if (String(code || "").trim() !== QUIZ_CODE) return rejectAck(ack, "Wrong quiz code");
    if (!name || !registerNo) return rejectAck(ack, "Enter name and roll number");
    if ([...players.values()].some(p => p.registerNo.toLowerCase() === registerNo.toLowerCase() && p.state !== STATES.REMOVED)) return rejectAck(ack, "Roll number already joined");
    const state = quiz.started ? STATES.WAITING : STATES.LOBBY;
    const player = { id: socket.id, name, registerNo, score: 0, correct: 0, answered: 0, state, blockedQuestions: new Set() };
    players.set(socket.id, player); socket.data.role = "player"; socket.data.playerId = socket.id;
    ack?.({ ok: true, player: publicPlayer(player), state });
    socket.emit(state === STATES.WAITING ? "player:waiting" : "player:lobby", { message: state === STATES.WAITING ? "Waiting for host approval..." : "" });
    broadcastLobby();
  });

  socket.on("host:auth", ({ code } = {}, ack) => {
    if (String(code || "") !== QUIZ_CODE) return ack?.({ ok: false });
    socket.data.role = "host";
    ack?.({ ok: true, state: { started: quiz.started, finished: quiz.finished, index: quiz.index, count: publicPlayers().length, players: publicPlayers(), pending: pendingPlayers(), leaderboard: leaderboard() } });
    if (quiz.started && quiz.index >= 0) socket.emit("question", questionPayload());
  });

  socket.on("host:allowPlayer", ({ playerId } = {}, ack) => {
    if (!validHost(socket, ack)) return;
    const player = players.get(playerId);
    if (!player || player.state !== STATES.WAITING) return rejectAck(ack, "Participant is no longer pending");
    player.state = STATES.ACTIVE;
    io.to(player.id).emit("player:approved", { message: "Approved. You will join from the next question." });
    ack?.({ ok: true }); broadcastLobby();
  });

  socket.on("host:rejectPlayer", ({ playerId } = {}, ack) => {
    if (!validHost(socket, ack)) return;
    const player = players.get(playerId);
    if (!player || player.state !== STATES.WAITING) return rejectAck(ack, "Participant is no longer pending");
    player.state = STATES.REJECTED;
    io.to(player.id).emit("player:rejected", { message: "Your request was rejected by the host." });
    ack?.({ ok: true }); broadcastLobby();
  });

  socket.on("host:blockPlayer", ({ playerId } = {}, ack) => {
    if (!validHost(socket, ack)) return;
    const player = players.get(playerId);
    if (!player || player.state !== STATES.ACTIVE) return rejectAck(ack, "Participant is not active");
    if (!quiz.started || quiz.finished || quiz.index < 0 || Date.now() >= quiz.deadline) return rejectAck(ack, "No active question");
    if (player.blockedQuestions.has(quiz.index)) return rejectAck(ack, "Participant is already blocked for this question");
    player.blockedQuestions.add(quiz.index); quiz.answers.set(player.id, { blocked: true, submittedAt: Date.now() });
    io.to(player.id).emit("player:blocked", { index: quiz.index, questionNumber: quiz.index + 1, message: "Your answer is blocked for this question." });
    ack?.({ ok: true }); broadcastLobby();
  });

  socket.on("host:removePlayer", ({ playerId } = {}, ack) => {
    if (!validHost(socket, ack)) return;
    const player = players.get(playerId);
    if (!player || player.state === STATES.REMOVED) return rejectAck(ack, "Participant not found");
    player.state = STATES.REMOVED; quiz.answers.delete(player.id); io.to(player.id).emit("player:removed", { message: "You have been removed from the quiz." });
    const playerSocket = io.sockets.sockets.get(player.id); if (playerSocket) playerSocket.disconnect(true);
    players.delete(player.id); ack?.({ ok: true, player: { name: player.name, registerNo: player.registerNo } }); broadcastLobby();
  });

  socket.on("host:start", () => {
    if (socket.data.role !== "host" || quiz.started || quiz.finished || publicPlayers().length === 0) return;
    for (const player of players.values()) if (player.state === STATES.LOBBY) player.state = STATES.ACTIVE;
    quiz.started = true; quiz.index = 0; io.emit("quiz:started"); startQuestion();
  });
  socket.on("host:next", () => { if (socket.data.role !== "host" || !quiz.started) return; if (quiz.index >= questions.length - 1) return finishQuiz(); quiz.index++; startQuestion(); });
  socket.on("host:reveal", () => { if (socket.data.role === "host") revealQuestion(); });

  socket.on("host:reset", () => {
    if (socket.data.role !== "host") return;
    clearTimeout(quiz.timer); for (const player of players.values()) io.to(player.id).emit("quiz:reset");
    players.clear(); quiz = createQuiz(); io.emit("quiz:reset"); broadcastLobby();
  });

  socket.on("player:visibilityViolation", ({ index } = {}, ack) => {
    const player = players.get(socket.id);
    if (!player || player.state !== STATES.ACTIVE || !quiz.started || quiz.finished || index !== quiz.index || quiz.answers.has(socket.id) || Date.now() >= quiz.deadline) return ack?.({ ok: false });
    player.blockedQuestions.add(quiz.index); quiz.answers.set(player.id, { blocked: true, submittedAt: Date.now() });
    socket.emit("player:violation", { blocked: true, index: quiz.index, questionNumber: quiz.index + 1 });
    io.emit("host:violation", { id: player.id, playerId: player.id, name: player.name, registerNo: player.registerNo, index: quiz.index, questionNumber: quiz.index + 1, blocked: true });
    ack?.({ ok: true, blocked: true, index: quiz.index, questionNumber: quiz.index + 1 }); broadcastLobby();
  });

  socket.on("answer", ({ index, option, textAnswer } = {}, ack) => {
    const player = players.get(socket.id);
    if (!player || player.state !== STATES.ACTIVE) return rejectAck(ack, "You are not an active participant");
    if (!quiz.started || quiz.finished || index !== quiz.index) return rejectAck(ack, "This question is no longer active");
    if (quiz.answers.has(socket.id)) return rejectAck(ack, "Answer already submitted");
    if (player.blockedQuestions.has(quiz.index)) return rejectAck(ack, "Your answer is blocked for this question");
    const submittedAt = Date.now(); if (submittedAt >= quiz.deadline) return rejectAck(ack, "Time over");
    const question = currentQuestion(); const scrambled = isScrambledQuestion(question); let playerAnswer; let correct = false;
    if (scrambled) { playerAnswer = normalizeAnswer(textAnswer); if (!playerAnswer) return rejectAck(ack, "Enter your answer"); correct = playerAnswer === normalizeAnswer(question.answer); }
    else { option = Number(option); if (!Number.isInteger(option) || option < 0 || option >= question.options.length) return rejectAck(ack, "Invalid answer"); playerAnswer = option; correct = option === question.answer; }
    quiz.answers.set(socket.id, { answer: playerAnswer, submittedAt }); const elapsed = (submittedAt - quiz.startedAt) / 1000; const points = correct ? scoreFor(question, elapsed) : 0;
    player.answered++; if (correct) { player.score += points; player.correct++; }
    const result = { correct, points, score: player.score, type: scrambled ? "scrambled" : "mcq" }; ack?.({ ok: true, ...result }); socket.emit("answer:result", result); broadcastLobby();
  });

  socket.on("disconnect", () => { if (players.delete(socket.id)) { quiz.answers.delete(socket.id); broadcastLobby(); } });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Quiz running on port ${PORT}`); console.log(`Total questions: ${questions.length}`); });
