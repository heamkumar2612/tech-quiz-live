const socket=io(); const $=id=>document.getElementById(id);

let me=null,current=null,answered=false,tick=null;
let switchBlocked=false;
let visibilityReporting=false;

function show(id){
 ["join","lobby","game","final"].forEach(
  x=>$(x).classList.toggle("hidden",x!==id)
 );
}

$("joinBtn").onclick=()=>socket.emit(
 "player:join",
 {
  code:$("code").value,
  name:$("name").value,
  registerNo:$("reg").value
 },
 r=>{
  if(!r.ok){
   $("joinMsg").textContent=r.error;
   return;
  }

  me=r.player;
  $("playerName").textContent=me.name;
  show("lobby");
 }
);

socket.on("lobby:update",d=>
 $("lobbyCount").textContent=d.count
);

socket.on("quiz:started",()=>{
 $("status").textContent="Get ready...";
 show("game");
});


// TIMER + 5 SECOND READING TIME

function runTimer(payload){
 clearInterval(tick);

 const answerStart=payload.startedAt;
 const answerEnd=answerStart+payload.duration*1000;

 disableOptions();

 tick=setInterval(()=>{

  const now=Date.now();

  // KEEP BLOCK MESSAGE AND OPTIONS BLOCKED
  if(switchBlocked){
   disableOptions();
   return;
  }

  // 5 SECOND READING TIME
  if(now<answerStart){

   const readingLeft=Math.ceil(
    (answerStart-now)/1000
   );

   $("timer").textContent=readingLeft;

   $("timerBar").style.transform=
    `scaleX(${readingLeft/payload.readingTime})`;

   if(
    !$("status").textContent.includes("WARNING")
   ){
    $("status").textContent=
     `📖 READ QUESTION - ${readingLeft}`;
   }

   return;
  }


  // 20 SECOND ANSWERING TIME

  const left=Math.max(
   0,
   (answerEnd-now)/1000
  );

  $("timer").textContent=Math.ceil(left);

  $("timerBar").style.transform=
   `scaleX(${left/payload.duration})`;

  if(!answered){

   document
    .querySelectorAll(".option")
    .forEach(b=>b.disabled=false);

   if(
    !$("status").textContent.includes("WARNING")
   ){
    $("status").textContent=
     "Choose your answer";
   }
  }

  if(left<=0){

   clearInterval(tick);

   disableOptions();

   $("status").textContent=
    answered
     ?"Answer locked!"
     :"TIME UP!";
  }

 },50);
}


function disableOptions(){
 document
  .querySelectorAll(".option")
  .forEach(b=>b.disabled=true);
}


// QUESTION

socket.on("question",q=>{

 current=q;
 answered=false;
 visibilityReporting=false;

 show("game");

 $("qnum").textContent=
  `${q.index+1} / ${q.total}`;

 $("question").textContent=
  q.question;

 if(!switchBlocked){
  $("status").textContent=
   "📖 READ QUESTION";
 }

 $("options").innerHTML=q.options.map(
  (o,i)=>
   `<button class="option" data-i="${i}">
    <span class="letter">${"ABCD"[i]}</span>${o}
   </button>`
 ).join("");

 document
  .querySelectorAll(".option")
  .forEach(b=>b.onclick=()=>{

   if(answered || switchBlocked)return;

   answered=true;

   disableOptions();

   b.classList.add("selected");

   $("status").textContent=
    "Answer locked!";

   socket.emit(
    "answer",
    {
     index:q.index,
     option:+b.dataset.i
    },
    r=>{

     if(!r?.ok){
      $("status").textContent=
       r?.error||"Could not submit";
     }

    }
   );

  });

 runTimer(q);
});


// ANSWER RESULT

socket.on("answer:result",r=>{

 $("score").textContent=
  r.score;

 $("status").textContent=
  r.correct
   ?`CORRECT! +${r.points} POINTS`
   :"WRONG ANSWER";

});


// REVEAL ANSWER

socket.on("reveal",d=>{

 clearInterval(tick);

 document
  .querySelectorAll(".option")
  .forEach((b,i)=>{

   b.disabled=true;

   if(i===d.answer)
    b.classList.add("correct");

   else if(
    b.classList.contains("selected")
   )
    b.classList.add("wrong");

   else
    b.classList.add("dim");

  });

});


// FINAL RANKING

function renderRanks(list,target){

 $(target).innerHTML=list.map(
  (p,i)=>
   `<div class="rankRow">
    <b>#${i+1}</b>
    <span>
     ${p.name}
     <small> · ${p.registerNo}</small>
    </span>
    <strong>${p.score}</strong>
   </div>`
 ).join("");

}


function renderPodium(list,target){

 const order=[
  list[1],
  list[0],
  list[2]
 ];

 const medals=[
  "🥈",
  "🥇",
  "🥉"
 ];

 $(target).innerHTML=order.map(
  (p,i)=>p
   ?`<div class="podiumItem ${i===1?"first":""}">
     <div>${medals[i]}</div>
     <strong>${p.name}</strong>
     <span>${p.score}</span>
    </div>`
   :""
 ).join("");

}


socket.on("quiz:finished",d=>{

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


socket.on("quiz:reset",()=>
 location.reload()
);


// APP SWITCH DETECTION

document.addEventListener(
 "visibilitychange",
 ()=>{

  if(
   document.visibilityState!=="hidden" ||
   !me ||
   !current ||
   answered ||
   switchBlocked ||
   visibilityReporting
  ){
   return;
  }

  visibilityReporting=true;

  socket.emit(
   "player:visibilityViolation",
   {
    index:current.index
   },
   r=>{

    visibilityReporting=false;

    if(!r?.ok)return;

    if(r.blocked){

     switchBlocked=true;

     disableOptions();

     $("status").textContent=
      "🚫 ANSWER BLOCKED - APP SWITCHING DETECTED";

    }
    else{

     $("status").textContent=
      `⚠️ APP SWITCH WARNING ${r.warnings}/2`;

    }

   }
  );

 }
);


// CIRCLE TO SEARCH / SCREEN SEARCH DETECTION

window.addEventListener(
 "blur",
 ()=>{

  if(
   !me ||
   !current ||
   answered ||
   switchBlocked ||
   visibilityReporting
  ){
   return;
  }

  visibilityReporting=true;

  socket.emit(
   "player:visibilityViolation",
   {
    index:current.index
   },
   r=>{

    visibilityReporting=false;

    if(!r?.ok)return;

    if(r.blocked){

     switchBlocked=true;

     disableOptions();

     $("status").textContent=
      "🚫 ANSWER BLOCKED - SCREEN SEARCH DETECTED";

    }
    else{

     $("status").textContent=
      `⚠️ SCREEN SEARCH WARNING ${r.warnings}/2`;

    }

   }
  );

 }
);