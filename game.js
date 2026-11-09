(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const mini = document.querySelector('#minimap');
  const mctx = mini.getContext('2d');
  const ui = id => document.getElementById(id);
  const W = 2600, H = 1900;
  let vw = 0, vh = 0, dpr = 1, playing = false, ended = false, muted = false;
  let player, bots = [], bullets = [], props = [], particles = [], loot = [], decor = [];
  let keys = {}, mouse = {x: 0, y: 0, down: false}, elapsed = 0, zoneTime = 150, kills = 0, last = 0, toastTimer = 0;
  let joystick = {x: 0, y: 0, active: false, id: null}, touchFire = false, audioCtx = null;
  const rand = (a,b) => a + Math.random() * (b-a);
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  function resize(){ dpr=Math.min(devicePixelRatio||1,2); vw=innerWidth; vh=innerHeight; canvas.width=vw*dpr; canvas.height=vh*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
  addEventListener('resize',resize); resize();
  function makeMap(){
    props=[]; decor=[]; loot=[];
    // Dense, irregular greenery and scrub
    for(let i=0;i<460;i++) decor.push({x:rand(20,W-20),y:rand(20,H-20),r:rand(8,24),type:Math.random()<.77?'tree':'bush',tone:Math.floor(rand(0,4))});
    // Open fields and sandy paths
    for(let i=0;i<90;i++) decor.push({x:rand(30,W-30),y:rand(30,H-30),r:rand(20,90),type:'grass',tone:0});
    const towns=[{x:560,y:470,n:'JAIPUR VILLAGE',count:13},{x:1320,y:410,n:'OLD FORT',count:10},{x:1900,y:690,n:'CHANDNI BAZAAR',count:14},{x:860,y:1260,n:'RIVER CAMP',count:12},{x:1770,y:1430,n:'PALACE GROUNDS',count:11}];
    towns.forEach((town,ti)=>{
      for(let j=0;j<town.count;j++){
        const x=town.x+rand(-210,210), y=town.y+rand(-150,150), w=rand(48,85), h=rand(42,72);
        props.push({x,y,w,h,type:'house',tone:Math.floor(rand(0,4)),town:ti,roof:Math.random()<.5?'flat':'gable'});
      }
      props.push({x:town.x-145,y:town.y-190,label:town.n,type:'label'});
    });
    // A winding paved road composed of broad segments
    const roads=[[[50,1010],[460,950],[890,990],[1290,900],[1670,970],[2150,900],[2550,980]],[[1280,60],[1230,390],[1300,700],[1280,1000],[1350,1320],[1280,1840]],[[450,950],[540,690],[560,460]],[[1670,970],[1840,680],[1900,510]]];
    roads.forEach(path=>{for(let i=0;i<path.length-1;i++)props.push({type:'road',x:path[i][0],y:path[i][1],x2:path[i+1][0],y2:path[i+1][1]})});
    // Landmarks, wells, fences, crates
    for(let i=0;i<65;i++){const x=rand(50,W-50),y=rand(50,H-50); props.push({x,y,w:rand(13,25),h:rand(13,25),type:Math.random()<.6?'crate':'rock',tone:Math.floor(rand(0,3))});}
    for(let i=0;i<20;i++) loot.push({x:rand(80,W-80),y:rand(80,H-80),type:Math.random()<.75?'ammo':'med',active:true});
  }
  function newGame(){
    makeMap(); player={x:1285,y:950,r:14,hp:100,ammo:30,reserve:120,angle:0,speed:210,fire:0,reload:0,alive:true};
    bots=[]; bullets=[]; particles=[]; kills=0; elapsed=0; zoneTime=150; ended=false; playing=true;
    for(let i=0;i<24;i++){let a=rand(0,Math.PI*2),r=rand(230,870);bots.push({x:clamp(player.x+Math.cos(a)*r,40,W-40),y:clamp(player.y+Math.sin(a)*r,40,H-40),r:13,hp:100,angle:rand(0,6.28),speed:rand(75,115),fire:rand(.3,2),wander:rand(0,6.28),alive:true,skin:Math.floor(rand(0,4))});}
    ui('startScreen').style.display='none';ui('endScreen').hidden=true;
    ['hudTop','leftPanel','rightPanel','bottomHud','crosshair','mobileControls','mobileTip'].forEach(id=>ui(id).hidden=false);
    ui('killCount').textContent='0'; ui('ammoCount').innerHTML='30 <i>/ 120</i>'; showToast('DROP COMPLETE · FIND COVER');
  }
  function showToast(text){const el=ui('toast');el.textContent=text;el.classList.add('show');toastTimer=2.2;}
  function drawTerrain(camX,camY){
    ctx.fillStyle='#52623b';ctx.fillRect(0,0,vw,vh);
    // broad painterly color patches
    ctx.save();ctx.translate(-camX,-camY);
    ctx.fillStyle='#596641';ctx.fillRect(0,0,W,H);
    for(let i=0;i<70;i++){let x=(i*397)%W,y=(i*719)%H;ctx.fillStyle=i%3?'rgba(147,143,83,.12)':'rgba(34,63,38,.22)';ctx.beginPath();ctx.ellipse(x,y,90+(i*37)%160,35+(i*23)%85,(i*.37)%3,0,Math.PI*2);ctx.fill();}
    // River, curving along map
    ctx.beginPath();ctx.moveTo(-50,560);ctx.bezierCurveTo(370,680,550,480,890,655);ctx.bezierCurveTo(1170,800,1230,1160,1590,1130);ctx.bezierCurveTo(1910,1100,2110,1420,2650,1280);ctx.lineTo(2650,1405);ctx.bezierCurveTo(2110,1540,1900,1230,1590,1260);ctx.bezierCurveTo(1220,1290,1140,925,850,780);ctx.bezierCurveTo(530,620,340,820,-50,690);ctx.closePath();ctx.fillStyle='#456b64';ctx.fill();ctx.strokeStyle='rgba(173,190,144,.18)';ctx.lineWidth=7;ctx.stroke();
    // subtle shoreline stones
    ctx.strokeStyle='rgba(214,197,135,.20)';ctx.lineWidth=10;ctx.stroke();
    // roads first, under buildings
    props.forEach(p=>{if(p.type==='road'){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x2,p.y2);ctx.strokeStyle='#a19372';ctx.lineWidth=42;ctx.lineCap='round';ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x2,p.y2);ctx.strokeStyle='rgba(218,204,163,.25)';ctx.lineWidth=3;ctx.setLineDash([17,16]);ctx.stroke();ctx.setLineDash([]);}});
    // field grain
    for(let i=0;i<500;i++){let x=(i*173)%W,y=(i*263)%H;ctx.fillStyle=i%2?'rgba(222,212,145,.08)':'rgba(21,35,23,.09)';ctx.fillRect(x,y,rand(2,7),rand(2,5));}
    // vegetation
    decor.forEach(o=>{if(o.x<camX-50||o.x>camX+vw+50||o.y<camY-50||o.y>camY+vh+50)return;
      if(o.type==='grass'){ctx.fillStyle='rgba(185,171,104,.09)';ctx.beginPath();ctx.ellipse(o.x,o.y,o.r,o.r*.45,0,0,6.28);ctx.fill();return;}
      if(o.type==='tree'){ctx.fillStyle='rgba(15,27,17,.24)';ctx.beginPath();ctx.ellipse(o.x+5,o.y+9,o.r*1.05,o.r*.76,0,0,6.28);ctx.fill();ctx.fillStyle=['#354d32','#3d5835','#49613a','#304a31'][o.tone];ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,6.28);ctx.fill();ctx.fillStyle='rgba(155,164,103,.18)';ctx.beginPath();ctx.arc(o.x-o.r*.26,o.y-o.r*.3,o.r*.48,0,6.28);ctx.fill();}
      else{ctx.fillStyle='#4d663a';ctx.beginPath();ctx.ellipse(o.x,o.y,o.r,o.r*.68,0,0,6.28);ctx.fill();}
    });
    // houses and props
    props.forEach(p=>{if(p.type==='house'){
      const colors=['#c69f6b','#ad865c','#d1b783','#947856'];ctx.fillStyle='rgba(12,17,12,.3)';ctx.fillRect(p.x-p.w/2+5,p.y-p.h/2+7,p.w,p.h);
      ctx.fillStyle=colors[p.tone];ctx.fillRect(p.x-p.w/2,p.y-p.h/2,p.w,p.h);
      ctx.strokeStyle='rgba(66,48,32,.8)';ctx.lineWidth=3;ctx.strokeRect(p.x-p.w/2,p.y-p.h/2,p.w,p.h);
      ctx.fillStyle='#594832';ctx.fillRect(p.x-6,p.y+5,12,p.h/2-5);
      ctx.fillStyle='rgba(83,141,148,.65)';ctx.fillRect(p.x-p.w/2+8,p.y-p.h/2+9,9,8);ctx.fillRect(p.x+p.w/2-17,p.y-p.h/2+9,9,8);
      ctx.fillStyle='rgba(240,210,151,.23)';ctx.fillRect(p.x-p.w/2,p.y-p.h/2,p.w,5);
    }else if(p.type==='crate'||p.type==='rock'){
      ctx.fillStyle=p.type==='crate'?['#81603c','#75603e','#9a7043'][p.tone]:'#666b55';ctx.fillRect(p.x-p.w/2,p.y-p.h/2,p.w,p.h);ctx.strokeStyle='rgba(24,28,21,.5)';ctx.lineWidth=2;ctx.strokeRect(p.x-p.w/2,p.y-p.h/2,p.w,p.h);if(p.type==='crate'){ctx.beginPath();ctx.moveTo(p.x-p.w/2,p.y-p.h/2);ctx.lineTo(p.x+p.w/2,p.y+p.h/2);ctx.moveTo(p.x+p.w/2,p.y-p.h/2);ctx.lineTo(p.x-p.w/2,p.y+p.h/2);ctx.stroke();}
    }else if(p.type==='label'){
      ctx.font='bold 11px DM Sans';ctx.textAlign='center';ctx.fillStyle='rgba(235,232,196,.7)';ctx.fillText(p.label,p.x,p.y);
    }});
    // safe ring world marker
    let zr=zoneRadius();ctx.beginPath();ctx.arc(zoneCenter().x,zoneCenter().y,zr,0,6.28);ctx.strokeStyle='rgba(177,223,108,.8)';ctx.lineWidth=3;ctx.setLineDash([11,8]);ctx.stroke();ctx.setLineDash([]);
    ctx.restore();
  }
  function zoneCenter(){return{x:1300,y:950}}
  function zoneRadius(){const p=clamp(elapsed/150,0,1);return 1100-p*790;}
  function drawActor(a,isPlayer=false){if(!a||!a.alive)return;const sx=a.x-camera.x,sy=a.y-camera.y;
    ctx.save();ctx.translate(sx,sy);ctx.rotate(a.angle||0);
    // shadow and body silhouette
    ctx.fillStyle='rgba(7,12,8,.35)';ctx.beginPath();ctx.ellipse(2,5,14,10,0,0,6.28);ctx.fill();
    ctx.fillStyle=isPlayer?'#d8bd7d':['#8eaa6a','#ba8767','#acb4a1','#b69458'][a.skin||0];ctx.beginPath();ctx.ellipse(0,0,11,8,0,0,6.28);ctx.fill();
    ctx.fillStyle=isPlayer?'#384d39':'#485444';ctx.fillRect(-6,-7,11,14);
    ctx.fillStyle=isPlayer?'#d7c58c':'#a98c65';ctx.beginPath();ctx.arc(4,-1,5,0,6.28);ctx.fill();
    ctx.fillStyle='#252a22';ctx.fillRect(6,-2,18,4);ctx.fillStyle='#aaa489';ctx.fillRect(17,-1,8,2);
    ctx.fillStyle=isPlayer?'#d7f77b':'#e6b487';ctx.beginPath();ctx.arc(0,-8,2,0,6.28);ctx.fill();
    ctx.restore();
    if(!isPlayer&&a.hp<100){ctx.fillStyle='rgba(12,16,12,.7)';ctx.fillRect(sx-13,sy-19,26,3);ctx.fillStyle='#e65d42';ctx.fillRect(sx-13,sy-19,26*a.hp/100,3);}
  }
  let camera={x:0,y:0};
  function drawBullet(b){ctx.fillStyle=b.team?'#e7d57a':'#ffeaa0';ctx.beginPath();ctx.arc(b.x-camera.x,b.y-camera.y,3,0,6.28);ctx.fill();ctx.strokeStyle='rgba(255,230,150,.45)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(b.x-camera.x,b.y-camera.y);ctx.lineTo(b.x-camera.x-b.vx*.025,b.y-camera.y-b.vy*.025);ctx.stroke();}
  function draw(){camera.x=clamp((playing?player.x:1285)-vw/2,0,W-vw);camera.y=clamp((playing?player.y:950)-vh/2,0,H-vh);drawTerrain(camera.x,camera.y);
    loot.forEach(l=>{if(!l.active)return;let x=l.x-camera.x,y=l.y-camera.y;if(x<-20||y<-20||x>vw+20||y>vh+20)return;ctx.fillStyle=l.type==='med'?'#d7eee0':'#e9d278';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=10;ctx.fillRect(x-6,y-6,12,12);ctx.shadowBlur=0;ctx.strokeStyle='#172016';ctx.strokeRect(x-6,y-6,12,12);ctx.fillStyle='#1b281b';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText(l.type==='med'?'＋':'•',x,y+3);});
    bots.forEach(b=>drawActor(b));drawActor(player,true);bullets.forEach(drawBullet);
    if(playing)drawMini();
    requestAnimationFrame(draw);
  }
  function drawMini(){const w=mini.width,h=mini.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='#66764c';mctx.fillRect(0,0,w,h);
    mctx.fillStyle='#947e58';props.filter(p=>p.type==='house').forEach(p=>mctx.fillRect(p.x/W*w,p.y/H*h,2,2));
    mctx.strokeStyle='rgba(176,232,119,.9)';mctx.lineWidth=1.5;mctx.beginPath();mctx.arc(zoneCenter().x/W*w,zoneCenter().y/H*h,zoneRadius()/W*w,0,6.28);mctx.stroke();
    bots.forEach(b=>{if(b.alive){mctx.fillStyle='#df705b';mctx.fillRect(b.x/W*w-1,b.y/H*h-1,3,3)}});
    mctx.fillStyle='#e3fa88';mctx.beginPath();mctx.arc(player.x/W*w,player.y/H*h,3,0,6.28);mctx.fill();mctx.strokeStyle='#f8ffe8';mctx.lineWidth=1;mctx.stroke();
  }
  function obstacle(x,y,r){return props.some(p=>p.type==='house'&&x>p.x-p.w/2-r&&x<p.x+p.w/2+r&&y>p.y-p.h/2-r&&y<p.y+p.h/2+r)}
  function shoot(shooter,team,angle){if(shooter.fire>0||shooter.reload>0)return;if(team===1&&shooter.ammo<=0){reload();return}if(team===1)shooter.ammo--;shooter.fire=team===1?.14:rand(.65,1.3);let spread=team===1?.035:.18;let a=angle+rand(-spread,spread);bullets.push({x:shooter.x+Math.cos(a)*23,y:shooter.y+Math.sin(a)*23,vx:Math.cos(a)*720,vy:Math.sin(a)*720,life:1.2,team,damage:team===1?27:10});if(team===1){ui('ammoCount').innerHTML=`${shooter.ammo} <i>/ ${shooter.reserve}</i>`;sound(180,.035)} }
  function sound(freq,dur){if(muted)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='square';o.frequency.value=freq;g.gain.setValueAtTime(.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur)}catch(e){}}
  function reload(){if(!player||player.reload>0||player.ammo===30||player.reserve<=0)return;player.reload=1.25;showToast('RELOADING…')}
  function damage(target,amount,attacker){target.hp-=amount;if(target===player){ui('healthNum').textContent=Math.max(0,Math.ceil(target.hp));ui('healthFill').style.width=`${clamp(target.hp,0,100)}%`;ui('damageFlash').classList.add('hit');setTimeout(()=>ui('damageFlash').classList.remove('hit'),150);}
    if(target.hp<=0){target.alive=false;if(target===player){finish(false);return}if(attacker===player){kills++;ui('killCount').textContent=kills;showToast('ELIMINATION CONFIRMED');sound(460,.09);}}
  }
  function step(dt){if(!playing||ended)return;elapsed+=dt;zoneTime-=dt;if(zoneTime<=0){zoneTime=28;showToast('SAFE ZONE IS SHRINKING');}
    const left=keys.KeyA||keys.ArrowLeft,right=keys.KeyD||keys.ArrowRight,up=keys.KeyW||keys.ArrowUp,down=keys.KeyS||keys.ArrowDown;
    let dx=(right?1:0)-(left?1:0)+joystick.x,dy=(down?1:0)-(up?1:0)+joystick.y;let len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len}let px=player.x+dx*player.speed*dt,py=player.y+dy*player.speed*dt;if(!obstacle(px,player.y,player.r))player.x=clamp(px,20,W-20);if(!obstacle(player.x,py,player.r))player.y=clamp(py,20,H-20);
    if(vw>700)player.angle=Math.atan2(mouse.y-vh/2,mouse.x-vw/2);else if(Math.hypot(dx,dy)>.1)player.angle=Math.atan2(dy,dx);
    player.fire=Math.max(0,player.fire-dt);if(player.reload>0){player.reload-=dt;if(player.reload<=0){let take=Math.min(30-player.ammo,player.reserve);player.ammo+=take;player.reserve-=take;ui('ammoCount').innerHTML=`${player.ammo} <i>/ ${player.reserve}</i>`;showToast('MAGAZINE READY');}}
    if(mouse.down||touchFire)shoot(player,1,player.angle);
    const z=zoneCenter(),outside=dist(player,z)>zoneRadius();if(outside){damage(player,7*dt);if(Math.floor(elapsed*2)%2===0)ui('zoneText').innerHTML='OUTSIDE SAFE ZONE <b>RETURN!</b>';}
    loot.forEach(l=>{if(l.active&&dist(player,l)<29){l.active=false;if(l.type==='med'){player.hp=Math.min(100,player.hp+30);ui('healthNum').textContent=Math.ceil(player.hp);ui('healthFill').style.width=player.hp+'%';showToast('FIRST AID PICKED UP · +30 HP')}else{player.reserve+=30;ui('ammoCount').innerHTML=`${player.ammo} <i>/ ${player.reserve}</i>`;showToast('7.62MM AMMO · +30')}}});
    bots.forEach(b=>{if(!b.alive)return;b.fire=Math.max(0,b.fire-dt);let d=dist(b,player),outsideBot=dist(b,z)>zoneRadius();if(d<470){b.angle=Math.atan2(player.y-b.y,player.x-b.x);if(d>145){let nx=b.x+Math.cos(b.angle)*b.speed*dt,ny=b.y+Math.sin(b.angle)*b.speed*dt;if(!obstacle(nx,b.y,b.r))b.x=nx;if(!obstacle(b.x,ny,b.r))b.y=ny;}if(d<390&&b.fire<=0){shoot(b,0,b.angle);b.fire=rand(.8,1.6);}}
      else{b.wander+=rand(-.4,.4)*dt;let nx=b.x+Math.cos(b.wander)*b.speed*.42*dt,ny=b.y+Math.sin(b.wander)*b.speed*.42*dt;if(!obstacle(nx,b.y,b.r))b.x=clamp(nx,20,W-20);if(!obstacle(b.x,ny,b.r))b.y=clamp(ny,20,H-20);}
      if(outsideBot)damage(b,3*dt,null);
    });
    bullets.forEach(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.x<0||b.x>W||b.y<0||b.y>H||obstacle(b.x,b.y,1))b.life=0;if(b.team===1){for(const bot of bots){if(bot.alive&&dist(b,bot)<bot.r+3){damage(bot,b.damage,player);b.life=0;break}}}else if(dist(b,player)<player.r+3){damage(player,b.damage);b.life=0}});bullets=bullets.filter(b=>b.life>0);
    const alive=bots.filter(b=>b.alive).length+1;ui('aliveCount').textContent=alive;let sec=Math.max(0,Math.ceil(zoneTime));ui('zoneText').innerHTML=`SAFE ZONE SHRINKS IN <b>00:${String(sec%60).padStart(2,'0')}</b>`;
    if(alive===1)finish(true);if(elapsed>390)finish(kills>4);
    toastTimer-=dt;if(toastTimer<=0)ui('toast').classList.remove('show');
  }
  function finish(win){if(ended)return;ended=true;playing=false;ui('endScreen').hidden=false;ui('endTitle').innerHTML=win?'CHICKEN<br/><em>DINNER!</em>':'BETTER<br/><em>LUCK NEXT TIME</em>';ui('endKicker').textContent=win?'WINNER WINNER':'MATCH COMPLETE';ui('endCopy').textContent=win?'The island is yours. What a run.':'The island keeps its secrets. Drop back in?';ui('endKills').textContent=kills;ui('endPlace').textContent=win?'#1':`#${Math.min(25,25-kills)}`;let s=Math.floor(elapsed);ui('endTime').textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
  let then=performance.now();function loop(now){let dt=Math.min(.04,(now-then)/1000);then=now;step(dt);requestAnimationFrame(loop)}requestAnimationFrame(loop);draw();
  ui('playBtn').addEventListener('click',newGame);ui('againBtn').addEventListener('click',newGame);
  ui('soundBtn').addEventListener('click',()=>{muted=!muted;ui('soundBtn').textContent=muted?'♪':'♫';ui('soundBtn').style.color=muted?'#8f998b':'#fff'});
  addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='KeyR'&&playing)reload();if(e.code==='Escape'&&ui('startScreen').style.display==='none'&&!ended){playing=!playing;showToast(playing?'MATCH RESUMED':'MATCH PAUSED · PRESS ESC TO RESUME');}});
  addEventListener('keyup',e=>{keys[e.code]=false});canvas.addEventListener('pointermove',e=>{mouse.x=e.clientX;mouse.y=e.clientY});canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')mouse.down=true});addEventListener('pointerup',e=>{if(e.pointerType==='mouse')mouse.down=false});
  ui('fireBtn').addEventListener('pointerdown',e=>{e.preventDefault();touchFire=true});addEventListener('pointerup',e=>{if(e.target===ui('fireBtn')||e.pointerType==='touch')touchFire=false});ui('reloadBtn').addEventListener('pointerdown',e=>{e.preventDefault();reload()});
  const stick=ui('stick'),knob=stick.querySelector('.stick-knob');stick.addEventListener('pointerdown',e=>{e.preventDefault();stick.setPointerCapture(e.pointerId);joystick.active=true;joystick.id=e.pointerId;moveStick(e)});stick.addEventListener('pointermove',e=>{if(joystick.active&&e.pointerId===joystick.id)moveStick(e)});stick.addEventListener('pointerup',e=>{if(e.pointerId===joystick.id){joystick.active=false;joystick.x=joystick.y=0;knob.style.transform='translate(0,0)'}});function moveStick(e){let r=stick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),l=Math.hypot(dx,dy),max=39;if(l>max){dx=dx/l*max;dy=dy/l*max}joystick.x=dx/max;joystick.y=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`}
})();
