'use client';

import { useEffect, useRef } from 'react';
import styles from './HeroMark.module.css';

/* ─────────────────────────────────────────
   The Flitrr mark, Direction 02 "Mass", in 3D.

   Eight deep rounded amber blocks tumble in and
   lock into the F; the real "Flitrr" wordmark,
   extruded into dimensional letters, rises in
   beneath it. The whole lockup is lit, leans to
   the cursor, sways, and carries an amber pulse
   through the F. The eight modules are the eight
   lifecycle stages, separate parts locked into
   one structure.

   three.js on mount (no SSR WebGL). When the tab
   is hidden (rAF is paused) or reduced motion is
   set, one locked frame is rendered so the mark
   is never blank; with no WebGL the flat SVG
   lockup stands in. The loop idles off-screen.
───────────────────────────────────────── */

const VW = 98;
const VH = 166;
const MOD = 30;
const MODULES = [
  { x: 0, y: 0 },
  { x: 34, y: 0 },
  { x: 68, y: 0 },
  { x: 0, y: 34 },
  { x: 0, y: 68 },
  { x: 34, y: 68 },
  { x: 0, y: 102 },
  { x: 0, y: 136 },
];
const AMBER = 0xf4c031;
const CREAM = 0xece6da;
const WORD_Y = -3.7;
const easeOut = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);

// The real wordmark (Archivo ExtraBold) from the identity, as an SVG the
// loader can extrude. Verbatim path data; the scale(1,-1) is the doc's.
const WORDMARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="79.5 -724.3 2554.9 736.3"><g transform="scale(1,-1)">' +
  '<path transform="translate(0.0,0)" d="M79.51485180854797 0V687.3060457706451H678.551676273346V541.8881661891937H270.5724070072174V398.222398519516H631.5964295864105V254.78277683258057H270.5724070072174V0Z"/>' +
  '<path transform="translate(716.0,0)" d="M63.59750509262085 0V724.3060457706451H237.47102284431458V0Z"/>' +
  '<path transform="translate(1017.0,0)" d="M63.59750509262085 599.0760207176208V724.3060457706451H237.47102284431458V599.0760207176208ZM63.59750509262085 0V527.3060457706451H237.47102284431458V0Z"/>' +
  '<path transform="translate(1318.0,0)" d="M286.5323951244354 -12Q228.1476469039917 -12 188.31901133060455 3.320112943649292Q148.4903757572174 18.640225887298584 128.3407175540924 52.380544543266296Q108.19105935096741 86.12086319923401 108.19105935096741 140.69929814338684V405.18603515625H22.799715518951416V527.3060457706451H114.38832497596741L149.37656164169312 682.9049091339111H282.06457710266113V527.3060457706451H406.045125246048V405.18603515625H282.06457710266113V177.62970447540283Q282.06457710266113 144.75441193580627 295.438347697258 127.43721127510071Q308.81211829185486 110.12001061439514 347.50717306137085 110.12001061439514H406.045125246048V5.56689453125Q392.4295537471771 0.8043057918548584 370.5915478467941 -3.3487170934677124Q348.75354194641113 -7.501739978790283 326.1890045404434 -9.750869989395142Q303.6244671344757 -12 286.5323951244354 -12Z"/>' +
  '<path transform="translate(1759.0,0)" d="M63.59750509262085 0V527.3060457706451H205.67669582366943L217.82876443862915 442.1800072193146H225.569593667984Q238.9841890335083 471.8589313030243 259.8648042678833 493.895880818367Q280.7454195022583 515.9328303337097 308.82526218891144 527.8911665678024Q336.9051048755646 539.8495028018951 370.0695044994354 539.8495028018951Q389.2032935619354 539.8495028018951 405.59058487415314 536.6764603853226Q421.97787618637085 533.50341796875 433.3811345100403 528.7391512393951V384.42544412612915H364.5224783420563Q331.26768469810486 384.42544412612915 307.18548488616943 374.5689368247986Q283.103285074234 364.712429523468 267.73281717300415 346.4319565296173Q252.3623492717743 328.1514835357666 244.91668605804443 303.2048660516739Q237.47102284431458 278.2582485675812 237.47102284431458 247.83545899391174V0Z"/>' +
  '<path transform="translate(2201.0,0)" d="M63.59750509262085 0V527.3060457706451H205.67669582366943L217.82876443862915 442.1800072193146H225.569593667984Q238.9841890335083 471.8589313030243 259.8648042678833 493.895880818367Q280.7454195022583 515.9328303337097 308.82526218891144 527.8911665678024Q336.9051048755646 539.8495028018951 370.0695044994354 539.8495028018951Q389.2032935619354 539.8495028018951 405.59058487415314 536.6764603853226Q421.97787618637085 533.50341796875 433.3811345100403 528.7391512393951V384.42544412612915H364.5224783420563Q331.26768469810486 384.42544412612915 307.18548488616943 374.5689368247986Q283.103285074234 364.712429523468 267.73281717300415 346.4319565296173Q252.3623492717743 328.1514835357666 244.91668605804443 303.2048660516739Q237.47102284431458 278.2582485675812 237.47102284431458 247.83545899391174V0Z"/>' +
  '</g></svg>';

export default function HeroMark({ className }) {
  const markRef = useRef(null);
  const canvasRef = useRef(null);
  const fallbackRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let disposed = false;
    let cleanup = () => {};

    Promise.all([
      import('three'),
      import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
      import('three/examples/jsm/loaders/SVGLoader.js'),
    ])
      .then(([THREE, { RoundedBoxGeometry }, { SVGLoader }]) => {
        if (disposed) return;

        let renderer;
        try {
          renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        } catch (e) {
          return; // no WebGL: the flat SVG lockup stays
        }

        const sizeOf = () => ({ w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 });
        let { w, h } = sizeOf();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
        camera.position.set(0, -0.7, 12.5);
        camera.lookAt(0, -0.7, 0);

        // Punchy lighting: low ambient, strong key, warm fill, cool rim, so
        // the block faces and letter sides shade hard and depth reads.
        scene.add(new THREE.AmbientLight(0x4a5564, 0.7));
        const key = new THREE.DirectionalLight(0xfff4e2, 3.1);
        key.position.set(-3.5, 5, 7);
        scene.add(key);
        const fillL = new THREE.DirectionalLight(0xffd9a0, 0.8);
        fillL.position.set(5, -2, 3);
        scene.add(fillL);
        const rim = new THREE.DirectionalLight(0x9fb6d6, 0.5);
        rim.position.set(2, 3, -6);
        scene.add(rim);

        const group = new THREE.Group();
        group.rotation.set(0.16, -0.28, 0);
        scene.add(group);

        // ── The F: eight deep rounded blocks ──
        const geo = new RoundedBoxGeometry(1, 1, 0.95, 3, 0.12);
        const CX = VW / MOD / 2;
        const CY = VH / MOD / 2;
        const identity = new THREE.Quaternion();
        const blocks = MODULES.map((m, i) => {
          const target = new THREE.Vector3((m.x + 15) / MOD - CX, CY - (m.y + 15) / MOD, 0);
          const ang = (i / MODULES.length) * Math.PI * 2 + 0.6;
          const start = new THREE.Vector3(
            target.x + Math.cos(ang) * 7,
            target.y + Math.sin(ang) * 6,
            5 + (i % 3) * 2.4
          );
          const startQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler((i * 1.3) % Math.PI, (i * 0.9) % Math.PI, (i * 1.7) % Math.PI)
          );
          const mat = new THREE.MeshStandardMaterial({
            color: AMBER,
            roughness: 0.42,
            metalness: 0.22,
            emissive: AMBER,
            emissiveIntensity: 0.08,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.copy(start);
          mesh.quaternion.copy(startQuat);
          group.add(mesh);
          return { mesh, mat, target, start, startQuat, delay: i * 0.05 };
        });

        // ── The wordmark: extruded "Flitrr" ──
        const wordMat = new THREE.MeshStandardMaterial({
          color: CREAM,
          roughness: 0.5,
          metalness: 0.12,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
        });
        const wordGeos = [];
        const word = new THREE.Group();
        try {
          const inner = new THREE.Group();
          const data = new SVGLoader().parse(WORDMARK_SVG);
          data.paths.forEach((path) => {
            SVGLoader.createShapes(path).forEach((shape) => {
              const g = new THREE.ExtrudeGeometry(shape, {
                depth: 300,
                bevelEnabled: true,
                bevelThickness: 18,
                bevelSize: 12,
                bevelSegments: 1,
                curveSegments: 4,
              });
              wordGeos.push(g);
              inner.add(new THREE.Mesh(g, wordMat));
            });
          });
          inner.scale.y = -1; // SVG y-down -> three y-up
          const box = new THREE.Box3().setFromObject(inner);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          inner.position.set(-center.x, -center.y, -center.z);
          word.add(inner);
          word.scale.setScalar(3.3 / size.x);
        } catch (e) {
          /* wordmark optional: F still stands */
        }
        word.position.y = WORD_Y;
        group.add(word);

        const reveal = () => {
          canvas.style.opacity = '1';
          if (fallbackRef.current) fallbackRef.current.style.opacity = '0';
          if (markRef.current) markRef.current.classList.add(styles.ready);
        };
        const lockAll = () => {
          blocks.forEach((b) => {
            b.mesh.position.copy(b.target);
            b.mesh.quaternion.copy(identity);
            b.mat.emissiveIntensity = 0.14;
          });
          wordMat.opacity = 1;
          word.position.y = WORD_Y;
        };

        const targetV = new THREE.Vector2(0, 0);
        const curV = new THREE.Vector2(0, 0);
        const onMove = (e) => {
          targetV.x = (e.clientX / window.innerWidth) * 2 - 1;
          targetV.y = (e.clientY / window.innerHeight) * 2 - 1;
        };
        window.addEventListener('pointermove', onMove, { passive: true });

        const onResize = () => {
          ({ w, h } = sizeOf());
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h, false);
        };
        window.addEventListener('resize', onResize);

        let inView = true;
        let visible = document.visibilityState === 'visible';
        let animating = false;
        let raf = 0;
        let last = 0;
        let started = false;
        let faded = false;
        let t = 0;
        let relockAt = -100;
        const tmp = new THREE.Vector3();

        const render = (ts) => {
          raf = 0;
          const prev = started ? last : ts;
          started = true;
          last = ts;
          t += Math.min((ts - prev) / 1000, 0.05);

          const pulse = (t * 1.1) % 10;
          blocks.forEach((b, i) => {
            const p = easeOut((t - b.delay) / 0.55);
            tmp.lerpVectors(b.start, b.target, p);
            const age = t - relockAt - b.delay * 0.6;
            if (age > 0 && age < 0.7) tmp.y += 0.14 * Math.sin((age / 0.7) * Math.PI);
            b.mesh.position.copy(tmp);
            b.mesh.quaternion.slerpQuaternions(b.startQuat, identity, p);
            const d = i - (pulse - 1);
            b.mat.emissiveIntensity = 0.1 + 0.5 * Math.exp(-(d * d) / 0.8);
          });

          const wp = easeOut((t - 0.45) / 0.5);
          wordMat.opacity = wp;
          word.position.y = WORD_Y - 0.55 * (1 - wp);

          curV.x += (targetV.x - curV.x) * 0.06;
          curV.y += (targetV.y - curV.y) * 0.06;
          group.rotation.y = -0.28 + Math.sin(t * 0.22) * 0.14 + curV.x * 0.36;
          group.rotation.x = 0.16 - curV.y * 0.2;

          renderer.render(scene, camera);
          if (!faded) {
            faded = true;
            reveal();
          }
          if (visible && inView) raf = requestAnimationFrame(render);
        };
        const loop = () => {
          if (!raf && visible && inView) raf = requestAnimationFrame(render);
        };

        const io = new IntersectionObserver(
          ([entry]) => {
            inView = entry.isIntersecting;
            if (animating) loop();
          },
          { threshold: 0 }
        );
        io.observe(canvas);
        const onVis = () => {
          visible = document.visibilityState === 'visible';
          if (animating) loop();
        };
        document.addEventListener('visibilitychange', onVis);

        const interval = setInterval(() => {
          relockAt = t;
        }, 15000);

        // Paint the finished mark once, synchronously, then fade it in: never
        // blank, and screenshot-able even where rAF never fires. On a visible
        // tab we then scatter the pieces and animate the assembly under the
        // same fade, so there is no flash of the locked mark.
        faded = true;
        if (!reduce && !document.hidden) {
          // Visible: start scattered, paint one frame so it is never blank,
          // then animate the assembly in.
          blocks.forEach((b) => {
            b.mesh.position.copy(b.start);
            b.mesh.quaternion.copy(b.startQuat);
          });
          wordMat.opacity = 0;
          word.position.y = WORD_Y - 0.55;
          renderer.render(scene, camera);
          reveal();
          animating = true;
          loop();
        } else {
          // Hidden / reduced motion: one locked frame, held static.
          lockAll();
          renderer.render(scene, camera);
          reveal();
        }

        cleanup = () => {
          cancelAnimationFrame(raf);
          clearInterval(interval);
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('resize', onResize);
          document.removeEventListener('visibilitychange', onVis);
          io.disconnect();
          geo.dispose();
          blocks.forEach((b) => b.mat.dispose());
          wordGeos.forEach((g) => g.dispose());
          wordMat.dispose();
          renderer.dispose();
        };
      })
      .catch((e) => {
        if (typeof console !== 'undefined') console.error('HeroMark scene failed', e);
      });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div ref={markRef} className={`${className || ''} ${styles.mark}`} role="img" aria-label="Flitrr">
      <div ref={fallbackRef} className={styles.fallback} aria-hidden="true">
        <svg className={styles.fallbackF} viewBox="0 0 98 166" fill="#f4c031" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="30" height="30" rx="3" />
          <rect x="34" y="0" width="30" height="30" rx="3" />
          <rect x="68" y="0" width="30" height="30" rx="3" />
          <rect x="0" y="34" width="30" height="30" rx="3" />
          <rect x="0" y="68" width="30" height="30" rx="3" />
          <rect x="34" y="68" width="30" height="30" rx="3" />
          <rect x="0" y="102" width="30" height="30" rx="3" />
          <rect x="0" y="136" width="30" height="30" rx="3" />
        </svg>
        <svg className={styles.fallbackWord} viewBox="79.5 -724.3 2554.9 736.3" fill="#ece6da" xmlns="http://www.w3.org/2000/svg">
          <g transform="scale(1,-1)">
            <path transform="translate(0.0,0)" d="M79.51485180854797 0V687.3060457706451H678.551676273346V541.8881661891937H270.5724070072174V398.222398519516H631.5964295864105V254.78277683258057H270.5724070072174V0Z" />
            <path transform="translate(716.0,0)" d="M63.59750509262085 0V724.3060457706451H237.47102284431458V0Z" />
            <path transform="translate(1017.0,0)" d="M63.59750509262085 599.0760207176208V724.3060457706451H237.47102284431458V599.0760207176208ZM63.59750509262085 0V527.3060457706451H237.47102284431458V0Z" />
            <path transform="translate(1318.0,0)" d="M286.5323951244354 -12Q228.1476469039917 -12 188.31901133060455 3.320112943649292Q148.4903757572174 18.640225887298584 128.3407175540924 52.380544543266296Q108.19105935096741 86.12086319923401 108.19105935096741 140.69929814338684V405.18603515625H22.799715518951416V527.3060457706451H114.38832497596741L149.37656164169312 682.9049091339111H282.06457710266113V527.3060457706451H406.045125246048V405.18603515625H282.06457710266113V177.62970447540283Q282.06457710266113 144.75441193580627 295.438347697258 127.43721127510071Q308.81211829185486 110.12001061439514 347.50717306137085 110.12001061439514H406.045125246048V5.56689453125Q392.4295537471771 0.8043057918548584 370.5915478467941 -3.3487170934677124Q348.75354194641113 -7.501739978790283 326.1890045404434 -9.750869989395142Q303.6244671344757 -12 286.5323951244354 -12Z" />
            <path transform="translate(1759.0,0)" d="M63.59750509262085 0V527.3060457706451H205.67669582366943L217.82876443862915 442.1800072193146H225.569593667984Q238.9841890335083 471.8589313030243 259.8648042678833 493.895880818367Q280.7454195022583 515.9328303337097 308.82526218891144 527.8911665678024Q336.9051048755646 539.8495028018951 370.0695044994354 539.8495028018951Q389.2032935619354 539.8495028018951 405.59058487415314 536.6764603853226Q421.97787618637085 533.50341796875 433.3811345100403 528.7391512393951V384.42544412612915H364.5224783420563Q331.26768469810486 384.42544412612915 307.18548488616943 374.5689368247986Q283.103285074234 364.712429523468 267.73281717300415 346.4319565296173Q252.3623492717743 328.1514835357666 244.91668605804443 303.2048660516739Q237.47102284431458 278.2582485675812 237.47102284431458 247.83545899391174V0Z" />
            <path transform="translate(2201.0,0)" d="M63.59750509262085 0V527.3060457706451H205.67669582366943L217.82876443862915 442.1800072193146H225.569593667984Q238.9841890335083 471.8589313030243 259.8648042678833 493.895880818367Q280.7454195022583 515.9328303337097 308.82526218891144 527.8911665678024Q336.9051048755646 539.8495028018951 370.0695044994354 539.8495028018951Q389.2032935619354 539.8495028018951 405.59058487415314 536.6764603853226Q421.97787618637085 533.50341796875 433.3811345100403 528.7391512393951V384.42544412612915H364.5224783420563Q331.26768469810486 384.42544412612915 307.18548488616943 374.5689368247986Q283.103285074234 364.712429523468 267.73281717300415 346.4319565296173Q252.3623492717743 328.1514835357666 244.91668605804443 303.2048660516739Q237.47102284431458 278.2582485675812 237.47102284431458 247.83545899391174V0Z" />
          </g>
        </svg>
      </div>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </div>
  );
}
