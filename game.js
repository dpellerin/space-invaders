'use strict';
(() => {
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const overlay = document.getElementById('overlay'), startButton = document.getElementById('start');
  const scoreEl = document.getElementById('score'), highEl = document.getElementById('high-score'), livesEl = document.getElementById('lives'), waveEl = document.getElementById('wave');
  const keys = new Set();
  const sprites = [
    ['00100000100','00010001000','00111111100','01101110110','11111111111','10111111101','10100000101','00011011000'],
    ['00011011000','01111111110','11101110111','11111111111','00110101100','01100000110','11000000011','00100000100'],
    ['00001110000','00111111100','01101110110','11111111111','10111111101','00100000100','01010001010','10100000101']
  ];
  const shipSprite = ['00000100000','00001110000','00001110000','01111111110','11111111111','11111111111','11111111111'];
  const ufoSprite = ['0000011111110000','0001111111111100','0011111111111110','0110110110110111','1111111111111111','0011100110011100','0001000000001000'];
  let ufo = null, ufoTimer = 0, ufoDirection = 1, ufoBonus = null, ufoSound = null;
  let state = 'start', player, invaders, playerShot, enemyShots, shields, direction, stepTimer, fireTimer, shotCooldown, score = 0, lives = 3, frame = 0, last = 0, invulnerable = 0, muted = false, gamepadStartHeld = false, wave = 1, waveTimer = 0;
  let high = 0;
  try { high = Number(localStorage.getItem('invadersHighScore')) || 0; } catch (_) {}
  function updateHud() { scoreEl.textContent = String(score).padStart(4,'0'); highEl.textContent = String(high).padStart(4,'0'); livesEl.textContent = String(lives); waveEl.textContent = String(wave); }
  // Keep one preloaded element per sample; clones let effects overlap.
  const samples = Object.fromEntries(
    ['shoot', 'invaderkilled', 'explosion', 'fastinvader1', 'fastinvader2', 'fastinvader3', 'fastinvader4', 'ufo_lowpitch', 'ufo_highpitch']
      .map(name => {
        const sample = new Audio(`sounds/${name}.wav`);
        sample.preload = 'auto';
        return [name, sample];
      })
  );
  const playingSounds = new Set();
  function sound(kind) {
    if (muted || kind === 'win') return;
    const name = kind === 'step' ? `fastinvader${(frame - 1) % 4 + 1}` :
      ({ shoot: 'shoot', hit: 'invaderkilled', death: 'explosion', ufoHit: 'ufo_highpitch' })[kind];
    if (!name) return;
    const sample = samples[name].cloneNode();
    sample.volume = 0.3;
    playingSounds.add(sample);
    const release = () => playingSounds.delete(sample);
    sample.addEventListener('ended', release, { once: true });
    sample.addEventListener('error', release, { once: true });
    const playback = sample.play();
    if (playback) playback.catch(release);
  }
  function stopUfoSound() {
    if (ufoSound) { ufoSound.pause(); ufoSound = null; }
  }
  function startUfoSound() {
    if (muted || state !== 'playing' || !ufo || ufoSound) return;
    ufoSound = samples.ufo_lowpitch.cloneNode();
    ufoSound.volume = 0.3;
    ufoSound.loop = true;
    const playing = ufoSound;
    const playback = playing.play();
    if (playback) playback.catch(() => { if (ufoSound === playing) ufoSound = null; });
  }
  function addScore(points) {
    score += points;
    if (score > high) {
      high = score;
      try { localStorage.setItem('invadersHighScore', String(high)); } catch (_) {}
    }
    updateHud();
  }
  // The arcade game's starting heights repeat after wave nine. Scale its 8-pixel steps to this field.
  function startWave() {
    const offsets = [36, 60, 72, 72, 72, 84, 84, 84];
    const offset = wave === 1 ? 0 : offsets[(wave - 2) % offsets.length];
    invaders=[];
    for(let row=0;row<5;row++) for(let col=0;col<11;col++) invaders.push({x:74+col*47,y:70+offset+row*38,w:33,h:24,row,col,alive:true});
    playerShot=null; enemyShots=[]; direction=1; stepTimer=0; fireTimer=0; shotCooldown=0; frame=0;
    stopUfoSound(); ufo=null; ufoBonus=null; ufoTimer=18; ufoDirection=1;
    waveTimer = wave === 1 ? 0 : 2;
    updateHud();
  }
  function reset() {
    stopUfoSound(); ufo=null; ufoBonus=null; ufoTimer=18; ufoDirection=1;
    score=0; lives=3; wave=1; player={x:W/2-18,y:507,w:36,h:21}; invulnerable=0;
    startWave();
    shields=[];
    for(let b=0;b<4;b++) for(let y=0;y<6;y++) for(let x=0;x<12;x++) {
      if ((y===0 && (x<2 || x>9)) || (y===1 && (x===0 || x===11)) || (y>=4 && x>=4 && x<=7)) continue;
      shields.push({x:84+b*147+x*5,y:431+y*5,w:5,h:5,alive:true});
    }
    keys.clear(); state='playing'; overlay.hidden=true; updateHud();
  }
  function togglePause() {
    if (state === 'playing') {
      state = 'paused'; keys.clear(); stopUfoSound();
      document.getElementById('overline').textContent = 'TRANSMISSION PAUSED';
      document.getElementById('message').textContent = 'PAUSED';
      document.getElementById('description').textContent = 'Take your time, defender.';
      startButton.innerHTML = 'RESUME GAME <span>▶</span>';
      overlay.hidden = false;
    } else if (state === 'paused') {
      state = 'playing'; keys.clear(); overlay.hidden = true; startUfoSound();
    } else {
      reset();
    }
  }
  function end(result) {
    if(state !== 'playing') return;
    state=result; playerShot=null; enemyShots=[]; ufo=null; stopUfoSound();
    document.getElementById('overline').textContent=result==='win'?'MISSION COMPLETE':'TRANSMISSION ENDED';
    document.getElementById('message').innerHTML=result==='win'?'EARTH<br>DEFENDED':'GAME<br>OVER';
    document.getElementById('description').textContent=result==='win'?`All invaders eliminated. Final score: ${score}.`:`The invasion got through. Final score: ${score}.`;
    startButton.innerHTML='PLAY AGAIN <span>▶</span>'; overlay.hidden=false;
    if(result==='win') sound('win');
  }
  function box(a,b) { return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
  function damageShield(shot) {
    const block=shields.find(s=>s.alive && box(shot,s));
    if(!block) return false;
    for(const s of shields) if(s.alive && Math.abs((s.x+2.5)-(shot.x+shot.w/2))<9 && Math.abs((s.y+2.5)-(shot.y+shot.h/2))<9) s.alive=false;
    return true;
  }
  function gamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.from(pads).find(p=>p && p.connected && p.mapping==='standard');
  }
  function update(dt) {
    const pad=gamepad(), startPressed=!!(pad && pad.buttons[9]?.pressed);
    if(startPressed && !gamepadStartHeld) togglePause();
    gamepadStartHeld=startPressed;
    if(state!=='playing') return;
    if (waveTimer > 0) { waveTimer = Math.max(0, waveTimer - dt); return; }
    const axis=pad ? (Math.abs(pad.axes[0] || 0)>.18 ? pad.axes[0] : 0) + (pad.buttons[15]?.pressed?1:0) - (pad.buttons[14]?.pressed?1:0) : 0;
    const move=Math.max(-1,Math.min(1,axis + (keys.has('ArrowRight')||keys.has('KeyD')?1:0) - (keys.has('ArrowLeft')||keys.has('KeyA')?1:0)));
    player.x=Math.max(10,Math.min(W-player.w-10,player.x+move*270*dt));
    shotCooldown=Math.max(0,shotCooldown-dt); invulnerable=Math.max(0,invulnerable-dt);
    if((keys.has('Space') || (pad && (pad.buttons[0]?.pressed || pad.buttons[7]?.pressed))) && !playerShot && shotCooldown<=0) {playerShot={x:player.x+player.w/2-2,y:player.y-12,w:4,h:13}; shotCooldown=.22; sound('shoot');}
    if (ufoBonus && (ufoBonus.time -= dt) <= 0) ufoBonus = null;
    if (ufo) {
      ufo.x += ufoDirection * 90 * dt;
      if ((ufoDirection > 0 && ufo.x > W) || (ufoDirection < 0 && ufo.x + ufo.w < 0)) {
        ufo = null; stopUfoSound(); ufoDirection *= -1; ufoTimer = 20 + Math.random() * 10;
      }
    } else if ((ufoTimer -= dt) <= 0) {
      ufo = {x: ufoDirection > 0 ? -48 : W, y: 25, w: 48, h: 21};
      startUfoSound();
    }
    const alive=invaders.filter(i=>i.alive);
    stepTimer+=dt;
    const interval=.075+.62*(alive.length/55);
    if(stepTimer>=interval){stepTimer=0;frame++;const edge=alive.some(i=>i.x+direction*12<12 || i.x+i.w+direction*12>W-12);if(edge){direction*=-1;alive.forEach(i=>i.y+=18);}else alive.forEach(i=>i.x+=direction*12); for(const i of alive) for(const s of shields) if(s.alive && box(i,s)) s.alive=false; sound('step');}
    if(alive.some(i=>i.y+i.h>=player.y)) { sound('death'); end('loss'); return; }
    fireTimer+=dt;
    if(fireTimer>=Math.max(.35,1.15-alive.length/100)){fireTimer=0;const bottom=alive.filter(i=>!alive.some(j=>j.col===i.col && j.y>i.y));if(bottom.length && enemyShots.length<3){const shooter=bottom[Math.floor(Math.random()*bottom.length)];enemyShots.push({x:shooter.x+shooter.w/2-2,y:shooter.y+shooter.h,w:4,h:12});}}
    if(playerShot){playerShot.y-=410*dt; if(playerShot.y+playerShot.h<0 || damageShield(playerShot)) playerShot=null; else {const hit=alive.find(i=>box(playerShot,i));if(hit){hit.alive=false;playerShot=null;addScore(hit.row===0?30:hit.row<3?20:10); sound('hit');if(!invaders.some(i=>i.alive)){wave++;startWave();return;}} else if(ufo && box(playerShot,ufo)){const points=[50,100,150,300][Math.floor(Math.random()*4)];ufoBonus={x:ufo.x,y:ufo.y,time:1,points};playerShot=null;ufo=null;stopUfoSound();ufoDirection*=-1;ufoTimer=20+Math.random()*10;addScore(points);sound('ufoHit');}}}
    for(const shot of enemyShots){shot.y+=210*dt;if(damageShield(shot)){shot.dead=true;continue;}if(invulnerable<=0 && box(shot,player)){shot.dead=true;lives--;invulnerable=1.4;sound('death');updateHud();if(lives<=0){end('loss');return;}}if(shot.y>H)shot.dead=true;}
    enemyShots=enemyShots.filter(s=>!s.dead);
  }
  // Rasterize each sprite once instead of issuing thousands of canvas calls per frame.
  const spriteCache = new Map();
  function pixelSprite(sprite,x,y,scale,color,flip=false){
    const key = `${sprites.indexOf(sprite)}:${sprite === shipSprite ? 'ship' : sprite === ufoSprite ? 'ufo' : 'invader'}:${scale}:${color}:${flip}`;
    if (!spriteCache.has(key)) {
      const image = document.createElement('canvas');
      image.width = Math.ceil(sprite[0].length * scale); image.height = Math.ceil(sprite.length * scale);
      const target = image.getContext('2d'); target.fillStyle = color;
      sprite.forEach((line,yy)=>[...line].forEach((pixel,xx)=>{
        if(pixel==='1') { const col=flip?line.length-1-xx:xx; const left=Math.round(col*scale), top=Math.round(yy*scale); target.fillRect(left,top,Math.round((col+1)*scale)-left,Math.round((yy+1)*scale)-top); }
      }));
      spriteCache.set(key,image);
    }
    ctx.drawImage(spriteCache.get(key),Math.round(x),Math.round(y));
  }
  function draw(){ctx.fillStyle='#050806';ctx.fillRect(0,0,W,H);ctx.fillStyle='#18301c';for(let i=0;i<35;i++)ctx.fillRect((i*179+31)%W,(i*97+23)%395,1,1);
    if(ufo) pixelSprite(ufoSprite,ufo.x,ufo.y,3,'#ff6d65');
    if(ufoBonus){ctx.fillStyle='#ff8b7f';ctx.font='bold 16px monospace';ctx.fillText(String(ufoBonus.points),ufoBonus.x,ufoBonus.y+16);}
    if(player){for(const s of shields)if(s.alive){ctx.fillStyle='#94ef62';ctx.fillRect(s.x,s.y,s.w,s.h);}for(const i of invaders)if(i.alive)pixelSprite(sprites[i.row===0?2:i.row<3?1:0],i.x,i.y,3,i.row===0?'#f0f0df':i.row<3?'#d6f7b7':'#9ff36c',frame%2===1);if(invulnerable<=0||Math.floor(invulnerable*8)%2===0)pixelSprite(shipSprite,player.x,player.y,3.25,'#a8ff60');if(playerShot){ctx.fillStyle='#f5f7df';ctx.fillRect(playerShot.x,playerShot.y,playerShot.w,playerShot.h);}for(const s of enemyShots){ctx.fillStyle='#f1f3df';ctx.fillRect(s.x,s.y,s.w,s.h);}}
    if (waveTimer > 0) {ctx.fillStyle='#f1f3de';ctx.font='bold 24px monospace';ctx.textAlign='center';ctx.fillText(`WAVE ${wave}`,W/2,390);ctx.textAlign='left';}
    ctx.fillStyle='#8feb60';ctx.fillRect(0,542,W,2);ctx.fillStyle='#52734c';ctx.font='10px monospace';ctx.fillText('DEFEND EARTH',12,555);ctx.textAlign='right';ctx.fillText('CREDIT 01',W-12,555);ctx.textAlign='left';}
  function loop(t){const dt=Math.min((t-last)/1000||0,.05);last=t;update(dt);draw();requestAnimationFrame(loop);}
  window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Space','Enter'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Enter' && !e.repeat)togglePause();});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
  startButton.addEventListener('click',togglePause);
  document.getElementById('sound').addEventListener('click',e=>{muted=!muted;if(muted){for(const sample of playingSounds) sample.pause();playingSounds.clear();stopUfoSound();}else startUfoSound();e.currentTarget.textContent=muted?'SOUND OFF':'SOUND ON';e.currentTarget.setAttribute('aria-label',muted?'Unmute sound':'Mute sound');e.currentTarget.setAttribute('aria-pressed',String(muted));});
  updateHud();requestAnimationFrame(loop);
})();
