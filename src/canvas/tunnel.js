import {
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  TextureLoader,
  Timer,
  Vector3,
  WebGLRenderer,
} from "three";

/**
 * Infinite wireframe corridor the camera flies through, with images tiled onto
 * the floor, ceiling and walls.
 *
 * DOM contract (all set in the Webflow Designer):
 *   [data-tunnel-init]    the mount — an empty div with an explicit size in CSS.
 *   [data-tunnel-images]  optional, inside the mount: a container of <img> tags
 *                         that acts as the texture manifest. Webflow owns these
 *                         assets; the script reads each img's `currentSrc` so it
 *                         inherits whatever srcset variant the browser picked.
 *                         With no images the corridor still renders as bare
 *                         wireframe, so the component can ship before the art does.
 *
 * Tunables (CSS custom properties on the mount, so the Designer/CSS owner can
 * adjust them without touching this repo):
 *   --tunnel-bg             background color, or `transparent` (default) to let
 *                           the Webflow section's own background show through
 *   --tunnel-line-color     wireframe color            (default #b0b0b0)
 *   --tunnel-line-opacity   wireframe opacity          (default 0.5)
 *   --tunnel-image-opacity  slab opacity               (default 0.85)
 *   --tunnel-speed          world units per second     (default 3.5)
 *   --tunnel-fill-rate      floor/wall slab density    (default 0.2)
 *   --tunnel-ceiling-rate   ceiling slab density       (default 0.12)
 *   --tunnel-fov            camera field of view       (default 70)
 */

// Corridor dimensions are fixed geometry, not design tunables — changing them
// changes what the tunnel *is*, not how it's tuned.
const CORRIDOR_W = 24;
const CORRIDOR_H = 16;
const SEG_DEPTH = 6;
const SEG_COUNT = 14;
const COLS = 6;
const ROWS = 4;

const CELL_W = CORRIDOR_W / COLS;
const CELL_H = CORRIDOR_H / ROWS;
const HALF_W = CORRIDOR_W / 2;
const HALF_H = CORRIDOR_H / 2;
const GAP = 0.4; // shrinks each slab so the wireframe cell stays visible around it

const CAMERA_LERP = 0.06;
const FADE_LERP = 0.06;

// The two slab shapes, as width/height. Walls run with the corridor so they're
// landscape; floor and ceiling run across it so they're portrait.
const WALL_ASPECT = (SEG_DEPTH - GAP) / (CELL_H - GAP); // 5.6 / 3.6
const FLOOR_ASPECT = (CELL_W - GAP) / (SEG_DEPTH - GAP); // 3.6 / 5.6

const DEFAULTS = {
  bg: "transparent",
  lineColor: "#b0b0b0",
  lineOpacity: 0.5,
  imageOpacity: 0.85,
  speed: 3.5,
  fillRate: 0.2,
  ceilingRate: 0.12,
  fov: 70,
};

/** Reads a CSS custom property off the mount, falling back to the default. */
function readVars(container) {
  const style = getComputedStyle(container);
  const str = (name, fallback) => {
    const v = style.getPropertyValue(name).trim();
    return v || fallback;
  };
  const num = (name, fallback) => {
    const v = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };

  return {
    bg: str("--tunnel-bg", DEFAULTS.bg),
    lineColor: str("--tunnel-line-color", DEFAULTS.lineColor),
    lineOpacity: num("--tunnel-line-opacity", DEFAULTS.lineOpacity),
    imageOpacity: num("--tunnel-image-opacity", DEFAULTS.imageOpacity),
    speed: num("--tunnel-speed", DEFAULTS.speed),
    fillRate: num("--tunnel-fill-rate", DEFAULTS.fillRate),
    ceilingRate: num("--tunnel-ceiling-rate", DEFAULTS.ceilingRate),
    fov: num("--tunnel-fov", DEFAULTS.fov),
  };
}

/**
 * Collects texture URLs from the manifest, waiting on any <img> that hasn't
 * resolved its srcset yet. The manifest is hidden (but never `display: none` —
 * that would stop Webflow's lazy-loaded images from ever picking a source).
 */
function collectSources(imgBox, done) {
  if (!imgBox) {
    done([]);
    return;
  }

  imgBox.setAttribute("aria-hidden", "true");
  imgBox.style.cssText =
    "position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";

  const imgs = Array.from(imgBox.querySelectorAll("img"));
  if (!imgs.length) {
    done([]);
    return;
  }

  const urls = [];
  let pending = imgs.length;
  const settle = (img) => {
    // Reading img.src turns an empty src attribute into the current page URL.
    const url = img.currentSrc || img.getAttribute("src")?.trim() || "";
    if (url) urls.push(url);
    if (--pending === 0) done(urls);
  };

  imgs.forEach((img) => {
    img.loading = "eager";
    if (img.complete || img.currentSrc) {
      settle(img);
    } else {
      const onSettle = () => {
        img.removeEventListener("load", onSettle);
        img.removeEventListener("error", onSettle);
        settle(img);
      };
      img.addEventListener("load", onSettle);
      img.addEventListener("error", onSettle);
    }
  });
}

/**
 * Crops a texture to fill a slab rather than stretching to it: shrinks the UV
 * window to the slab's aspect and centres it — the texture equivalent of CSS
 * `object-fit: cover`. Source images can then be any shape or mix of shapes.
 *
 * Returns a clone, because repeat/offset live on the texture and the two slab
 * orientations need different ones. Clones share their `source`, so three
 * uploads the pixels once and refcounts them.
 */
function coverFit(tex, targetAspect) {
  const fitted = tex.clone();
  const img = tex.image;
  const imgAspect = img && img.height ? img.width / img.height : 1;

  if (imgAspect > targetAspect) {
    fitted.repeat.set(targetAspect / imgAspect, 1); // too wide — crop the sides
  } else {
    fitted.repeat.set(1, imgAspect / targetAspect); // too tall — crop top/bottom
  }
  fitted.offset.set((1 - fitted.repeat.x) / 2, (1 - fitted.repeat.y) / 2);
  fitted.needsUpdate = true;
  return fitted;
}

/** Frees a pool built by preload(). */
function disposePool(pool) {
  pool.forEach((entry) => {
    entry.landscape.dispose();
    entry.portrait.dispose();
    entry.source.dispose();
  });
}

/**
 * Loads every URL, skipping any that fail, and pre-fits each one to both slab
 * orientations so slab creation stays allocation-free.
 */
function preload(urls, done) {
  if (!urls.length) {
    done([]);
    return;
  }

  const loader = new TextureLoader();
  loader.setCrossOrigin("anonymous"); // WebGL refuses cross-origin textures without it
  const pool = new Array(urls.length);
  let pending = urls.length;

  const settle = () => {
    if (--pending > 0) return;
    done(
      pool.filter(Boolean).map((tex) => ({
        source: tex,
        landscape: coverFit(tex, WALL_ASPECT),
        portrait: coverFit(tex, FLOOR_ASPECT),
      }))
    );
  };

  urls.forEach((url, i) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = SRGBColorSpace;
        tex.minFilter = LinearFilter;
        pool[i] = tex;
        settle();
      },
      undefined,
      settle
    );
  });
}

/** Builds one instance. Returns a handle with a `destroy()` for teardown. */
function setupInstance(container, pool) {
  const vars = readVars(container);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  container.appendChild(canvas);

  const measure = () => {
    const r = container.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  };
  let dim = measure();

  const scene = new Scene();
  if (vars.bg !== "transparent" && vars.bg !== "none") {
    scene.background = new Color(vars.bg);
  }

  const camera = new PerspectiveCamera(vars.fov, dim.w / dim.h, 0.1, 1000);
  camera.position.set(0, 0, 0);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(dim.w, dim.h, false);

  const lineMaterial = new LineBasicMaterial({
    color: new Color(vars.lineColor),
    transparent: true,
    opacity: vars.lineOpacity,
  });

  /* ---------- geometry ---------- */

  function addSlab(group, position, rotation, w, h) {
    if (!pool.length) return;

    const entry = pool[Math.floor(Math.random() * pool.length)];
    const material = new MeshBasicMaterial({
      map: w >= h ? entry.landscape : entry.portrait,
      transparent: true,
      opacity: reduce ? vars.imageOpacity : 0,
      side: DoubleSide,
    });
    material.userData.fadeIn = !reduce;

    const mesh = new Mesh(new PlaneGeometry(w - GAP, h - GAP), material);
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    mesh.name = "slab";
    group.add(mesh);
  }

  // Scatters slabs across one segment's four surfaces, never two in a row on
  // the same surface — the gaps are what read as a corridor rather than a box.
  function populate(group) {
    const zc = -SEG_DEPTH / 2;
    let last;

    last = -9; // floor
    for (let i = 0; i < COLS; i++) {
      if (i > last + 1 && Math.random() < vars.fillRate) {
        addSlab(
          group,
          new Vector3(-HALF_W + i * CELL_W + CELL_W / 2, -HALF_H, zc),
          new Euler(-Math.PI / 2, 0, 0),
          CELL_W,
          SEG_DEPTH
        );
        last = i;
      }
    }

    last = -9; // ceiling, deliberately sparser so the corridor reads as open above
    for (let i = 0; i < COLS; i++) {
      if (i > last + 1 && Math.random() < vars.ceilingRate) {
        addSlab(
          group,
          new Vector3(-HALF_W + i * CELL_W + CELL_W / 2, HALF_H, zc),
          new Euler(Math.PI / 2, 0, 0),
          CELL_W,
          SEG_DEPTH
        );
        last = i;
      }
    }

    last = -9; // left wall
    for (let i = 0; i < ROWS; i++) {
      if (i > last + 1 && Math.random() < vars.fillRate) {
        addSlab(
          group,
          new Vector3(-HALF_W, -HALF_H + i * CELL_H + CELL_H / 2, zc),
          new Euler(0, Math.PI / 2, 0),
          SEG_DEPTH,
          CELL_H
        );
        last = i;
      }
    }

    last = -9; // right wall
    for (let i = 0; i < ROWS; i++) {
      if (i > last + 1 && Math.random() < vars.fillRate) {
        addSlab(
          group,
          new Vector3(HALF_W, -HALF_H + i * CELL_H + CELL_H / 2, zc),
          new Euler(0, -Math.PI / 2, 0),
          SEG_DEPTH,
          CELL_H
        );
        last = i;
      }
    }
  }

  function clearSlabs(group) {
    group.children
      .filter((o) => o.name === "slab")
      .forEach((o) => {
        group.remove(o);
        o.geometry.dispose();
        o.material.dispose(); // never dispose .map — the pool owns the textures
      });
  }

  function buildSegment(z) {
    const group = new Group();
    group.position.z = z;

    const pts = [];
    for (let i = 0; i <= COLS; i++) {
      const x = -HALF_W + i * CELL_W;
      pts.push(x, -HALF_H, 0, x, -HALF_H, -SEG_DEPTH);
      pts.push(x, HALF_H, 0, x, HALF_H, -SEG_DEPTH);
    }
    for (let i = 1; i < ROWS; i++) {
      const y = -HALF_H + i * CELL_H;
      pts.push(-HALF_W, y, 0, -HALF_W, y, -SEG_DEPTH);
      pts.push(HALF_W, y, 0, HALF_W, y, -SEG_DEPTH);
    }
    pts.push(-HALF_W, -HALF_H, 0, HALF_W, -HALF_H, 0);
    pts.push(-HALF_W, HALF_H, 0, HALF_W, HALF_H, 0);
    pts.push(-HALF_W, -HALF_H, 0, -HALF_W, HALF_H, 0);
    pts.push(HALF_W, -HALF_H, 0, HALF_W, HALF_H, 0);

    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(pts, 3));
    group.add(new LineSegments(geo, lineMaterial));

    populate(group);
    return group;
  }

  const segments = [];
  for (let i = 0; i < SEG_COUNT; i++) {
    const seg = buildSegment(-i * SEG_DEPTH);
    scene.add(seg);
    segments.push(seg);
  }

  /* ---------- loop ---------- */

  // Timer over Clock (deprecated): connect() uses the Page Visibility API so a
  // backgrounded tab reports a zero delta instead of one huge catch-up frame.
  const timer = new Timer();
  timer.connect(document);

  let travel = 0;
  let visible = true;
  let contextLost = false;

  const tick = (timestamp) => {
    container._tunnelRaf = requestAnimationFrame(tick);
    timer.update(timestamp);
    // Still clamped: page visibility doesn't cover scrolling off-screen, or a
    // long first frame while the GPU warms up.
    const dt = Math.min(timer.getDelta(), 0.1);
    if (!visible || contextLost) return;

    travel += vars.speed * dt;
    camera.position.z += (-travel - camera.position.z) * CAMERA_LERP;
    const camZ = camera.position.z;

    segments.forEach((seg) => {
      // Recycle any segment the camera has passed to the far end of the tunnel.
      if (seg.position.z > camZ + SEG_DEPTH) {
        const min = segments.reduce((m, o) => Math.min(m, o.position.z), 0);
        seg.position.z = min - SEG_DEPTH;
        clearSlabs(seg);
        populate(seg);
      }

      seg.children.forEach((o) => {
        if (o.name !== "slab" || !o.material.userData.fadeIn) return;
        const mat = o.material;
        mat.opacity += (vars.imageOpacity - mat.opacity) * FADE_LERP;
        if (mat.opacity > vars.imageOpacity - 0.005) {
          mat.opacity = vars.imageOpacity;
          mat.userData.fadeIn = false;
        }
      });
    });

    renderer.render(scene, camera);
  };

  const renderOnce = () => renderer.render(scene, camera);

  if (reduce) {
    renderOnce(); // decorative motion — one static frame instead of a loop
  } else {
    timer.reset(); // discard time spent loading textures
    tick();
  }

  /* ---------- responsive + visibility ---------- */

  const resize = () => {
    dim = measure();
    camera.aspect = dim.w / dim.h;
    camera.updateProjectionMatrix();
    renderer.setSize(dim.w, dim.h, false);
    if (reduce) renderOnce();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  // Canvases are the most expensive thing on the page — don't render offscreen.
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      timer.reset(); // don't let time spent hidden jump the camera forward
    },
    { threshold: 0 }
  );
  intersectionObserver.observe(container);

  const onContextLost = (e) => {
    e.preventDefault();
    contextLost = true;
  };
  // A lost context leaves a permanently blank canvas unless the scene is rebuilt.
  // Textures are reloaded rather than reused: they come back from the HTTP cache,
  // and it keeps pool ownership simple — an instance always frees its own pool.
  const onContextRestored = () => {
    contextLost = false;
    destroy();
    container._tunnel = null;
    container._tunnelGen = (container._tunnelGen || 0) + 1;
    mount(container);
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  /* ---------- teardown ---------- */

  function destroy() {
    cancelAnimationFrame(container._tunnelRaf);
    container._tunnelRaf = null;
    timer.dispose(); // detaches the document visibilitychange listener
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);

    segments.forEach((seg) => {
      clearSlabs(seg);
      seg.children.forEach((o) => o.geometry.dispose());
      scene.remove(seg);
    });
    segments.length = 0;
    lineMaterial.dispose();
    disposePool(pool);
    renderer.dispose();
    canvas.remove();
  }

  return { destroy };
}

/**
 * Loads one container's textures, then mounts an instance on it. Split from
 * initTunnel so the WebGL context-restore path can reuse it for a single
 * element without touching every other tunnel on the page.
 */
function mount(container) {
  const gen = container._tunnelGen;
  // Loading is async, so a later init can overtake this one. The generation
  // token lets the newest call win and older ones bow out.
  const stale = () => !container.isConnected || container._tunnelGen !== gen;

  // Webflow can leave an empty placeholder image block beside the authored
  // manifest. Use the first block that actually contains an image source.
  const imgBox = Array.from(
    container.querySelectorAll("[data-tunnel-images]")
  ).find((box) =>
    Array.from(box.querySelectorAll("img")).some(
      (img) => img.currentSrc || img.getAttribute("src")?.trim()
    )
  );

  collectSources(imgBox, (urls) => {
    if (stale()) return;
    preload(urls, (pool) => {
      if (stale()) {
        disposePool(pool);
        return;
      }
      container._tunnel = setupInstance(container, pool);
    });
  });
}

/**
 * Mounts the tunnel on every [data-tunnel-init] element on the page.
 * Safe to call more than once — each instance tears itself down first.
 */
export function initTunnel() {
  document.querySelectorAll("[data-tunnel-init]").forEach((container) => {
    container._tunnel?.destroy();
    container._tunnel = null;
    container._tunnelGen = (container._tunnelGen || 0) + 1;
    mount(container);
  });
}
