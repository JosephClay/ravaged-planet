import {H, PROJECTILE_ITERATIONS_PER_FRAME, PROJECTILE_ITERATION_PROGRESS, PROJECTILE_MAX_SOUND_FREQUENCY, PROJECTILE_MIN_SOUND_FREQUENCY, PROJECTILE_POWER_REDUCTION_FACTOR, PROJECTILE_WIND_REDUCTION_FACTOR, WEAPON_TYPES} from './constants.js';
import {drawLineVirtual} from './gfx.js';
import {isTank, createParticles} from './main.js';
import {deg2rad, parable} from './math.js';
import {audio, createOsc} from './sound.js';
import {isTerrain} from './terrain.js';
import {EXPLOSION_TYPES} from './weapons.js';


export const PROJECTILE_TYPES = {
  normal: {
    create(spec, player, weapon, ox, oy, a, p, wind) {
      const osc = createOsc('sine');
      osc.start();

      return [{
        type: 'normal',
        player, weapon,
        x:ox, y:oy, ox, oy, a, p,
        t: 0, osc, wind,
      }];
    },
    stop(projectile) {
      projectile.osc.stop(0);
    },
    update(projectile, terrain, projectiles, trajectories, explosions) {
      const prevProjectile = {...projectile};
      const {weapon, player, wind} = projectile;
      const weaponType = WEAPON_TYPES[weapon.type];
      let exploded = false;

      for (let i=0; i<PROJECTILE_ITERATIONS_PER_FRAME; i++) {
        const {ox, oy, a, p, t} = projectile;

        const [x, y] = parable(
          t, ox, oy, deg2rad(180+a),
          p / PROJECTILE_POWER_REDUCTION_FACTOR,
          wind / PROJECTILE_WIND_REDUCTION_FACTOR,
        );
        projectile.x = x;
        projectile.y = y;
        projectile.t += PROJECTILE_ITERATION_PROGRESS;

        const f = (
          (1 - (1 / H * y)) *
          (PROJECTILE_MAX_SOUND_FREQUENCY - PROJECTILE_MIN_SOUND_FREQUENCY) +
          PROJECTILE_MIN_SOUND_FREQUENCY
        );
        projectile.osc.frequency.setValueAtTime(f, audio.currentTime);

        if (
          y > H ||
          isTank(x, y) ||
          isTerrain(terrain, x, y)
        ) {
          const explosionSpec = weaponType.explosion;
          const explosionType = EXPLOSION_TYPES[explosionSpec.type];
          explosions.push(explosionType.create(explosionSpec, x, y));
          // @ts-ignore: canvas color hack
          createParticles(x, y, p, terrain.color);
          exploded = true;
          break;
        }
      }

      let trajectory = drawLineVirtual(
        prevProjectile.x, prevProjectile.y,
        projectile.x, projectile.y, player.c,
      );

      trajectory
        .slice(0, trajectory.length-1) // Cut last pixel to prevent overlap
        .map(x => ({...x, a:255}))     // Add alpha to all lines
        .forEach(x => trajectories.push(x));

      return !exploded;
    },
  },

  mirv: {
    create(spec, player, weapon, ox, oy, a, p, wind) {
      const {n, s} = spec;
      const projectiles = [];
      const normalType = PROJECTILE_TYPES.normal;

      for (let i=0; i<n; i++) {
        projectiles.push(
          normalType.create(
            {}, player, weapon, ox, oy, a, p, wind-s*i
          )[0]
        );
      }

      return projectiles;
    },
    stop() {},
    update() {},
  },

  leapfrog: {
    create(spec, player, weapon, ox, oy, a, p, wind) {
      const {n, s} = spec;

      return [{
        type:'leapfrog',
        n, s, payload:null,
        player, weapon, ox, oy, a, p, wind,
      }];
    },
    stop() {},
    update(projectile, terrain, projectiles, trajectories, explosions) {
      const {player, weapon, ox, oy, a, p, wind, n, s} = projectile;
      const projectileType = PROJECTILE_TYPES.normal;

      // FIXME: Ugly
      if (!projectile.payload) {
        projectile.n--;
        projectile.payload = projectileType.create(
          {}, player, weapon, ox, oy, a, p, wind,
        )[0];
      }

      const alive = projectileType.update(
        projectile.payload, terrain, projectiles, trajectories, explosions
      );

      if (!alive) {
        projectileType.stop(projectile.payload)
        if (n <= 0) return;

        projectile.n--;
        projectile.payload = projectileType.create(
          {}, player, weapon, projectile.payload.x, projectile.payload.y-2, a, p-s*n, wind, // FIXME: Y Hack
        )[0];
      }

      return true;
    },
  },
}
