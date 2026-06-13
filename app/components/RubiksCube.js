'use client';

import { useEffect, useRef } from 'react';

/* ─────────────────────────────────────────
   Band 2: the Flitrr Framework, as order resolving.

   A cube of separate parts is gently disturbed,
   then solves itself, the layers turning back
   into one ordered whole. The six faces are the
   site's own slate ramp; amber is the single
   accent that means "the thing that matters", and
   it gathers onto the crown face each time the
   cube locks solved, with a soft amber bloom. A
   framework drawn as what the word means: many
   parts held in one structure.

   Raw three.js + RoundedBoxGeometry on mount (no
   SSR WebGL). One frame paints synchronously so
   the canvas is never blank (hidden / headless
   tabs pause rAF); the loop idles off-screen; a
   static SVG cube stands in for reduced motion or
   absent WebGL.
───────────────────────────────────────── */

// Five steps of the site's slate ramp + amber as the crown.
// Tunable: this single map sets the whole cube's colour.
const FACE = {
  px: '#E9EEF3', // right  — cream
  nx: '#5C7A94', // left   — mid slate
  py: '#F4C031', // top    — amber (the thing that matters)
  ny: '#16242F', // bottom — graphite
  pz: '#9CB2C5', // front  — light slate
  nz: '#2E4A5C', // back   — deep slate
};
const BODY = '#0E1822';
const AMBER = '#F4C031';

export default function RubiksCube({ className }) {
  const canvasRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let disposed = false;
    let cleanup = () => {};

    Promise.all([
      import('three'),
      import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
    ])
      .then(([THREE, { RoundedBoxGeometry }]) => {
        if (disposed) return;
        let renderer;
        try {
          renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        } catch (e) {
          return; // no WebGL: the SVG fallback stays
        }

        const sizeOf = () => ({ w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 });
        let { w, h } = sizeOf();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(33, w / h, 0.1, 100);
        camera.position.set(0, 0, 8.6);
        camera.lookAt(0, 0, 0);

        // Light: low cool ambient, a warm key, a cool fill, and an amber
        // rim that carries the brand glow and blooms when the cube locks.
        scene.add(new THREE.AmbientLight(0x2a3a4a, 0.55));
        const key = new THREE.DirectionalLight(0xfff3df, 1.5);
        key.position.set(4.5, 6, 7);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x9fb6cc, 0.5);
        fill.position.set(-6, -1.5, 3);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(AMBER, 0);
        rim.position.set(-3, 4, -6);
        scene.add(rim);

        const cubeGroup = new THREE.Group();
        scene.add(cubeGroup);

        // ── Build 26 cubies, each a dark rounded body with coloured tiles
        //    on its outward faces. ──────────────────────────────────────
        const S = 1.02; // cubie pitch
        const bodyGeo = new RoundedBoxGeometry(0.92, 0.92, 0.92, 4, 0.09);
        const tileGeo = new RoundedBoxGeometry(0.72, 0.72, 0.06, 3, 0.05);

        const bodyMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(BODY),
          roughness: 0.62,
          metalness: 0.18,
        });
        const mkTile = (hex, isAmber = false) =>
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(hex),
            roughness: isAmber ? 0.34 : 0.42,
            metalness: isAmber ? 0.2 : 0.12,
            emissive: new THREE.Color(isAmber ? AMBER : 0x000000),
            emissiveIntensity: isAmber ? 0.18 : 0,
          });
        const tileMats = {
          px: mkTile(FACE.px),
          nx: mkTile(FACE.nx),
          py: mkTile(FACE.py, true),
          ny: mkTile(FACE.ny),
          pz: mkTile(FACE.pz),
          nz: mkTile(FACE.nz),
        };
        const amberMat = tileMats.py; // the crown we bloom on lock

        const Z = new THREE.Vector3(0, 0, 1);
        const faces = [
          { k: 'px', n: new THREE.Vector3(1, 0, 0) },
          { k: 'nx', n: new THREE.Vector3(-1, 0, 0) },
          { k: 'py', n: new THREE.Vector3(0, 1, 0) },
          { k: 'ny', n: new THREE.Vector3(0, -1, 0) },
          { k: 'pz', n: new THREE.Vector3(0, 0, 1) },
          { k: 'nz', n: new THREE.Vector3(0, 0, -1) },
        ];

        const cubies = [];
        for (let xi = -1; xi <= 1; xi++)
          for (let yi = -1; yi <= 1; yi++)
            for (let zi = -1; zi <= 1; zi++) {
              if (xi === 0 && yi === 0 && zi === 0) continue;
              const c = new THREE.Group();
              c.position.set(xi * S, yi * S, zi * S);
              c.add(new THREE.Mesh(bodyGeo, bodyMat));
              for (const f of faces) {
                const on =
                  (f.n.x && f.n.x === xi) ||
                  (f.n.y && f.n.y === yi) ||
                  (f.n.z && f.n.z === zi);
                if (!on) continue;
                const tile = new THREE.Mesh(tileGeo, tileMats[f.k]);
                tile.position.copy(f.n).multiplyScalar(0.47);
                tile.quaternion.setFromUnitVectors(Z, f.n);
                c.add(tile);
              }
              c.userData.lpos = c.position.clone(); // exact logical position
              c.userData.lquat = c.quaternion.clone(); // exact logical orientation
              cubeGroup.add(c);
              cubies.push(c);
            }

        // A pleasing 3/4 rest pose: the amber crown plus two bright faces
        // to camera. The idle drift and cursor-lean ride on top of this.
        const BASE_X = 0.46;
        const BASE_Y = -0.62;
        cubeGroup.rotation.set(BASE_X, BASE_Y, 0);

        // ── Turn machinery ───────────────────────────────────────────
        // A move = { axis 0|1|2, layer -1|1, dir +1|-1 }. The visible turn
        // runs on a pivot; on completion the cubies' exact logical state is
        // advanced and written back, so float drift never accumulates.
        const axisVec = [
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 1),
        ];
        const axisKey = ['x', 'y', 'z'];
        const snap = (v) =>
          v.set(Math.round(v.x / S) * S, Math.round(v.y / S) * S, Math.round(v.z / S) * S);

        let pivot = null;
        let active = null; // { move, layer, t }
        const queue = [];
        let history = []; // scramble moves, replayed in reverse to solve

        const startTurn = (move) => {
          cubeGroup.updateMatrixWorld(true);
          pivot = new THREE.Group();
          cubeGroup.add(pivot);
          const layer = cubies.filter(
            (c) => Math.round(c.userData.lpos.getComponent(move.axis) / S) === move.layer
          );
          for (const c of layer) pivot.attach(c);
          active = { move, layer, t: 0, to: move.dir * (Math.PI / 2) };
        };

        const finishTurn = () => {
          const { move, layer, to } = active;
          pivot.rotation[axisKey[move.axis]] = to; // land exactly
          cubeGroup.updateMatrixWorld(true);
          const q = new THREE.Quaternion().setFromAxisAngle(axisVec[move.axis], to);
          for (const c of layer) {
            cubeGroup.attach(c);
            c.userData.lpos.applyQuaternion(q);
            snap(c.userData.lpos);
            c.userData.lquat.premultiply(q);
            c.position.copy(c.userData.lpos);
            c.quaternion.copy(c.userData.lquat);
          }
          cubeGroup.remove(pivot);
          pivot = null;
          active = null;
        };

        const randInt = (n) => Math.floor(Math.random() * n);
        const planScramble = () => {
          const N = 8;
          history = [];
          let lastAxis = -1;
          for (let i = 0; i < N; i++) {
            let axis;
            do {
              axis = randInt(3);
            } while (axis === lastAxis);
            lastAxis = axis;
            const move = { axis, layer: [-1, 1][randInt(2)], dir: [-1, 1][randInt(2)] };
            history.push(move);
            queue.push(move);
          }
        };
        const planSolve = () => {
          for (let i = history.length - 1; i >= 0; i--) {
            const m = history[i];
            queue.push({ axis: m.axis, layer: m.layer, dir: -m.dir });
          }
          history = [];
        };

        // ── Interaction + resize ─────────────────────────────────────
        const targetV = new THREE.Vector2(0, 0);
        const curV = new THREE.Vector2(0, 0);
        const onMove = (e) => {
          targetV.x = (e.clientX / window.innerWidth) * 2 - 1;
          targetV.y = (e.clientY / window.innerHeight) * 2 - 1;
        };
        window.addEventListener('pointermove', onMove, { passive: true });

        const renderFrame = () => renderer.render(scene, camera);
        const onResize = () => {
          ({ w, h } = sizeOf());
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h, false);
          renderFrame();
        };
        window.addEventListener('resize', onResize);

        // Instant reveal (force off the CSS transition) so a hidden /
        // headless tab, where transitions and rAF are paused, is still
        // painted rather than stuck transparent over the fallback.
        const reveal = () => {
          canvas.style.transition = 'none';
          canvas.style.opacity = '1';
          if (svgRef.current) {
            svgRef.current.style.transition = 'none';
            svgRef.current.style.opacity = '0';
          }
        };

        let bloom = 0; // amber lock pulse, 0..1
        const applyBloom = () => {
          amberMat.emissiveIntensity = 0.18 + 0.95 * bloom;
          rim.intensity = 0.6 * bloom;
        };

        const disposeAll = () => {
          bodyGeo.dispose();
          tileGeo.dispose();
          bodyMat.dispose();
          Object.values(tileMats).forEach((m) => m.dispose());
          renderer.dispose();
        };

        // ── One synchronous solved frame: never blank ────────────────
        applyBloom();
        renderFrame();
        reveal();

        if (reduce) {
          cleanup = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('resize', onResize);
            disposeAll();
          };
          return;
        }

        // ── Animated loop ────────────────────────────────────────────
        const easeInOut = (x) => x * x * x * (x * (x * 6 - 15) + 10); // smootherstep
        const TURN_MS = { scramble: 360, solve: 430 };
        const GAP_MS = 70;
        const HOLD_SOLVED = 2600;
        const HOLD_SCRAMBLED = 520;

        let state = 'holdSolved';
        let holdUntil = HOLD_SOLVED;
        let mode = 'solve';
        let gapUntil = 0;
        let nowMs = 0;

        let inView = true;
        let visible = true;
        let raf = 0;
        let started = false;
        let last = 0;
        let introT = 0;

        const step = (ts) => {
          raf = 0;
          const prev = started ? last : ts;
          started = true;
          last = ts;
          const dt = Math.min(ts - prev, 50);
          nowMs += dt;
          const tt = nowMs / 1000;
          introT = Math.min(introT + dt / 1000, 1);

          // Idle compose: gentle drift + cursor lean over the rest pose.
          curV.x += (targetV.x - curV.x) * 0.045;
          curV.y += (targetV.y - curV.y) * 0.045;
          cubeGroup.rotation.y = BASE_Y + Math.sin(tt * 0.18) * 0.28 + curV.x * 0.35;
          cubeGroup.rotation.x = BASE_X + Math.sin(tt * 0.13) * 0.05 - curV.y * 0.18;
          cubeGroup.scale.setScalar(0.9 + 0.1 * (1 - Math.pow(2, -10 * introT)));

          // Bloom eases back down between locks.
          bloom += (0 - bloom) * Math.min((dt / 1000) * 1.4, 1);
          applyBloom();

          // Advance the active turn, else pull the next move / step the phase.
          if (active) {
            active.t += dt / TURN_MS[mode];
            if (active.t >= 1) {
              finishTurn();
              gapUntil = nowMs + GAP_MS;
            } else {
              pivot.rotation[axisKey[active.move.axis]] = active.to * easeInOut(active.t);
            }
          } else if (nowMs >= gapUntil) {
            if (queue.length) {
              startTurn(queue.shift());
            } else if (state === 'scrambling') {
              state = 'holdScrambled';
              holdUntil = nowMs + HOLD_SCRAMBLED;
            } else if (state === 'solving') {
              state = 'holdSolved';
              holdUntil = nowMs + HOLD_SOLVED;
              bloom = 1; // lock: amber gathers and blooms
            } else if (state === 'holdSolved' && nowMs >= holdUntil) {
              mode = 'scramble';
              planScramble();
              state = 'scrambling';
            } else if (state === 'holdScrambled' && nowMs >= holdUntil) {
              mode = 'solve';
              planSolve();
              state = 'solving';
            }
          }

          renderFrame();
          if (visible && inView) raf = requestAnimationFrame(step);
        };
        const loop = () => {
          if (!raf && visible && inView) raf = requestAnimationFrame(step);
        };

        const io = new IntersectionObserver(
          ([entry]) => {
            inView = entry.isIntersecting;
            loop();
          },
          { threshold: 0 }
        );
        io.observe(canvas);
        const onVis = () => {
          visible = document.visibilityState === 'visible';
          loop();
        };
        document.addEventListener('visibilitychange', onVis);

        loop();

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('resize', onResize);
          document.removeEventListener('visibilitychange', onVis);
          io.disconnect();
          disposeAll();
        };
      })
      .catch(() => {});

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  const fill = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

  return (
    <span className={className} aria-hidden="true">
      {/* Static fallback: an isometric cube, amber-crowned, for reduced
          motion or absent WebGL. Fades out the instant the canvas paints. */}
      <svg
        ref={svgRef}
        viewBox="0 0 120 132"
        fill="none"
        style={{ ...fill, opacity: 0.9, transition: 'opacity 500ms ease' }}
      >
        <polygon points="60,16 102,40 60,64 18,40" fill="rgba(244,192,49,0.92)" />
        <polygon points="18,40 18,92 60,116 60,64" fill="rgba(92,122,148,0.92)" />
        <polygon points="102,40 102,92 60,116 60,64" fill="rgba(156,178,197,0.92)" />
      </svg>
      <canvas ref={canvasRef} style={{ ...fill, opacity: 0, transition: 'opacity 600ms ease' }} />
    </span>
  );
}
