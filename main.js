import {key} from './input.js';
import {createTerrain, clipTerrain, isTerrain, landHeight} from './terrain.js';
import {createCanvas, drawLine, loop, drawText, drawRect} from './gfx.js';
import {wrap, clamp, parable, deg2rad, vec} from './math.js';
import {drawExplosion, WEAPONS} from './weapons.js';
import {createOsc, audio} from './sound.js';

const W = 640; const H = 400; const Z = 2;

let state = 'aim';
const players = [];
let currentPlayer = 0;
let projectile = null;
let prevProjectile = null;

// Init canvas
const fb = createCanvas(W, H);
fb.canvas.style.width = `${W * Z}px`;
fb.canvas.style.height = `${H * Z}px`;
document.body.appendChild(fb.canvas);

// Init terrain
const terrain = createTerrain(W, H);

// Init projectiles
const projectiles = createCanvas(W, H);

// Init players
let i=0;
for (let color of ['tomato', 'royalblue', 'greenyellow', 'gold', 'hotpink', 'orchid']) {
  const x = Math.round(50 + (W-100) / 5 * i);
  const a = x > W/2 ? 45 : 180-45;
  players.push({x, y:landHeight(terrain, x), a, p:300, c:color, weapon:WEAPONS[i%2]});
  i++;
}

function update() {
  if (state === 'aim') {
    const player = players[currentPlayer];
    const {x, y, a, p} = player;

    if (key('ArrowLeft')) {
      player.a = wrap(0, a -1, 180);
    } else if (key('ArrowRight')) {
      player.a = wrap(0, a +1, 180);
    } else if (key('ArrowUp')) {
      player.p = clamp(100, p +5, 1000);
    } else if (key('ArrowDown')) {
      player.p = clamp(100, p -5, 1000);
    } else if (key(' ')) {
      state = 'fire';
      const [px, py] = vec(x, y-3, a+180, 5);
      projectile = prevProjectile = {
        osc: createOsc(),
        player: player,
        weapon: player.weapon,
        ox:px, oy:py, a, p,
        x:px, y:py, t: 0,
      };
      projectile.osc.start();
    }
  }

  else if (state === 'fire') {
    prevProjectile = {...projectile};
    fadeProjectiles(1);
    for (let i=0; i<30; i++) {
      const {weapon, ox, oy, a, p, t} = projectile;
      const [x, y] = parable(t, ox, oy, deg2rad(180+a), p/10, 9.8);
      const f = 200 + 10 * (H-y);
      projectile.t += 0.01;
      projectile.x = Math.ceil(x);
      projectile.y = Math.floor(y);
      projectile.osc.frequency.setValueAtTime(f, audio.currentTime);

      if (y > H || isTerrain(terrain, x, y)) {
        clipTerrain(terrain, (ctx) => drawExplosion(ctx, projectile.x, projectile.y, weapon.xr));
        currentPlayer = wrap(0, currentPlayer+1, players.length);
        projectile.osc.stop();
        projectile = null;
        state = 'land';
        return;
      }
    }
  }

  else if (state === 'land') {
    let stable = true;
    for (let player of players) {
      const y = landHeight(terrain, player.x);
      if (player.y !== y) {
        player.y++;
        stable = false;
      }
    }
    if (stable) state = 'aim';
  }
}

function draw() {
  fb.clearRect(0, 0, W, H);
  fb.drawImage(terrain.canvas, 0, 0);
  if (projectile) drawProjectile();
  fb.drawImage(projectiles.canvas, 0, 0);
  for (let tank of players) drawPlayer(tank);
  drawStatus();
}

function drawPlayer(player) {
  const {x, y, a, c} = player;
  const [px, py] = vec(x, y-3, a+180, 3);
  drawLine(fb, x, y-3, Math.round(px), Math.round(py), c);
  drawRect(fb, x-3, y-2, 6, 3, c);
}

function drawProjectile() {
  const {x, y, player} = projectile;
  drawLine(projectiles, prevProjectile.x, prevProjectile.y, x, y, player.c);
}

function fadeProjectiles(amount) {
  const imageData = projectiles.getImageData(0, 0, W, H);
  for (let i=0; i<imageData.data.length; i+=4) imageData.data[i+3] -= amount;
  projectiles.clearRect(0, 0, W, H);
  projectiles.putImageData(imageData, 0, 0);
}

function drawStatus() {
  const player = players[currentPlayer];
  const {weapon} = player;
  drawText(fb, `AIM=${player.a}  PWR=${player.p}`, 8, 8, player.c, 'left');
  drawText(fb, `${weapon.name}`, W-8, 8, player.c, 'right');
}

loop(() => {
  update();
  draw();
});
