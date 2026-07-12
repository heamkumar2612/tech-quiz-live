const socket=io();
const $=id=>document.getElementById(id);

let current=null,tick=null;

function show(id){
 ["auth","host","hostFinal"].forEach(
  x=>$(x).classList.toggle("hidden",x!==id)
 );
}

$("authBtn").onclick=()=>socket.emit(
 "host:auth",
 {code:$("hostCode").value},
 r=>{
  if(!r.ok){
   $("authMsg").textContent="Wrong host code";
   return;
  }

  show("host");

  $("hostCount").textContent=
   r.state.count;

  renderTop(
   r.state.leaderboard.slice(0,5)
  );
 }
);

$("startBtn").onclick=()=>
 socket.emit("host:start");

$("nextBtn").onclick=()=>
 socket.emit("host:next");

$("revealBtn").onclick=()=>
 socket.emit("host:reveal");

$("resetBtn").onclick=()=>{
 if(
  confirm(
   "Reset quiz and remove all players?"
  )
 ){
  socket.emit("host:reset");
 }
};

socket.on("lobby:update",d=>
 $("hostCount").textContent=d.count
);


function renderTop(list){

 $("top5").innerHTML=
  list.length
   ?list.map(
    (p,i)=>
     `<div class="leader">
      <b>${i+1}</b>
      <span>${p.name}</span>
      <span>${p.score}</span>
     </div>`
   ).join("")
   :"<p>No scores yet</p>";

}


// HOST TIMER + 5 SECOND READING TIME

function runTimer(q){

 clearInterval(tick);

 const answerStart=q.startedAt;

 const answerEnd=
  answerStart+q.duration*1000;

 tick=setInterval(()=>{

  const now=Date.now();

  const hostMessage=
   $("hostStatus").textContent;


  // 5 SECOND READING TIME

  if(now<answerStart){

   const readingLeft=Math.ceil(
    (answerStart-now)/1000
   );

   $("hostTimer").textContent=
    readingLeft;

   $("hostTimerBar").style.transform=
    `scaleX(${readingLeft/q.readingTime})`;

   if(
    !hostMessage.includes("APP SWITCH") &&
    !hostMessage.includes("BLOCKED")
   ){
    $("hostStatus").textContent=
     `📖 READING TIME - ${readingLeft}`;
   }

   return;
  }


  // 20 SECOND ANSWER TIME

  const left=Math.max(
   0,
   (answerEnd-now)/1000
  );

  $("hostTimer").textContent=
   Math.ceil(left);

  $("hostTimerBar").style.transform=
   `scaleX(${left/q.duration})`;

  if(
   !hostMessage.includes("APP SWITCH") &&
   !hostMessage.includes("BLOCKED")
  ){
   $("hostStatus").textContent=
    "Students are answering...";
  }

  if(left<=0){
   clearInterval(tick);
  }

 },50);

}


// QUESTION

socket.on("question",q=>{

 current=q;

 show("host");

 $("hostQnum").textContent=
  `QUESTION ${q.index+1} / ${q.total}`;

 $("hostQuestion").textContent=
  q.question;

 $("hostStatus").textContent=
  "📖 READING TIME";

 $("hostOptions").innerHTML=
  q.options.map(
   (o,i)=>
    `<div class="option" data-i="${i}">
     <span class="letter">${"ABCD"[i]}</span>${o}
    </div>`
  ).join("");

 runTimer(q);

});


// REVEAL ANSWER

socket.on("reveal",d=>{

 clearInterval(tick);

 document
  .querySelectorAll(
   "#hostOptions .option"
  )
  .forEach((b,i)=>{

   if(i===d.answer)
    b.classList.add("correct");

   else
    b.classList.add("dim");

  });

 $("hostStatus").textContent=
  `Correct answer: ${"ABCD"[d.answer]}`;

 renderTop(d.leaderboard);

});


function ranks(list,target){

 $(target).innerHTML=
  list.map(
   (p,i)=>
    `<div class="rankRow">
     <b>#${i+1}</b>
     <span>
      ${p.name}
      <small>
       · ${p.registerNo}
       · ${p.correct} correct
      </small>
     </span>
     <strong>${p.score}</strong>
    </div>`
  ).join("");

}


function podium(list,target){

 const order=[
  list[1],
  list[0],
  list[2]
 ];

 const m=[
  "🥈",
  "🥇",
  "🥉"
 ];

 $(target).innerHTML=
  order.map(
   (p,i)=>p
    ?`<div class="podiumItem ${i===1?"first":""}">
      <div>${m[i]}</div>
      <strong>${p.name}</strong>
      <span>${p.score}</span>
     </div>`
    :""
  ).join("");

}


socket.on("quiz:finished",d=>{

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


socket.on("quiz:reset",()=>
 location.reload()
);


// ANTI-CHEAT HOST WARNING

socket.on("host:violation",d=>{

 if(d.warnings>=2){

  $("hostStatus").textContent=
   `🚫 BLOCKED: ${d.name} | Roll No: ${d.registerNo}`;

 }
 else{

  $("hostStatus").textContent=
   `⚠️ APP SWITCH: ${d.name} | Roll No: ${d.registerNo} | Warning ${d.warnings}/2`;

 }

});