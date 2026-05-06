import { CENTROIDS, FLOW_COLORS, GEO_NAME_MAP } from './config.js';
import { getDepth, getSideColor, getTI, getTopColor, getTransformationNet, state } from './dataService.js';
import { fmtQty, hexToInt, makeShape, project, ringToPoints } from './utils.js';

const SCENE_COLORS = {
  background: 0xE2D8C3,
  fog: 0xE2D8C3
};

const LIGHT_COLORS = {
  ambient: 0xF5ECD7,
  directional: 0xFFFAF0,
  fill: 0xC8A96E
};

const COUNTRY_COLORS = {
  topEmissiveDefault: 0x000000,
  sideEmissiveDefault: 0x000000,
  topEmissiveSelected: 0x4A3A2A,
  sideEmissiveSelected: 0x000000,
  topEmissiveHover: 0x4A3A2A,
  sideEmissiveHover: 0x4A3A2A,
  border: 0x8B6040
};

const UI_COLORS = {
  mapLoadErrorText: '#C8A96E'
};

let scene, camera, renderer, controls;
let countryMeshes = [];
let arcMeshes = [];

let selectedMesh = null;
let selectedMeshes = null;
let hoveredMesh = null;
let hoveredGroup = null;

const raycaster = new window.THREE.Raycaster();
const mouse = new window.THREE.Vector2(-9999, -9999);
let mouseDidMove = false;

// Callback to trigger UI updates in app.js when a country is clicked
let onCountrySelectGlobal = null;

export function initThreeMap(onCountrySelectCallback) {
  onCountrySelectGlobal = onCountrySelectCallback;

  const container = document.getElementById('map-container');
  const W = container.clientWidth;
  const H = container.clientHeight;

  scene = new window.THREE.Scene();
  scene.background = new window.THREE.Color(SCENE_COLORS.background);
  scene.fog = new window.THREE.Fog(SCENE_COLORS.fog, 600, 1200);

  // Rotate scene so XY plane becomes XZ (standard top-down map view)
  scene.rotation.x = -Math.PI / 2;

  camera = new window.THREE.PerspectiveCamera(38, W / H, 1, 1500);
  camera.position.set(0, 420, 0);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);

  renderer = new window.THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Lights
  const ambient = new window.THREE.AmbientLight(LIGHT_COLORS.ambient, 0.55);
  scene.add(ambient);

  const dirLight = new window.THREE.DirectionalLight(LIGHT_COLORS.directional, 0.95);
  dirLight.position.set(50, 400, 80);
  scene.add(dirLight);

  const fillLight = new window.THREE.DirectionalLight(LIGHT_COLORS.fill, 0.25);
  fillLight.position.set(-80, 200, -60);
  scene.add(fillLight);

  // Controls
  controls = new window.THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 80;
  controls.maxDistance = 900;
  controls.enablePan = true;
  controls.target.set(0, 0, 0);

  const TILT_MAX = Math.PI / 3;
  const ROT_MAX = Math.PI / 6;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = TILT_MAX;
  controls.minAzimuthAngle = -ROT_MAX;
  controls.maxAzimuthAngle = ROT_MAX;
  controls.update();

  // Custom handler to allow trackpad users to pan the map by "scrolling" in any direction, without triggering the zoom behavior in OrbitControls.
  renderer.domElement.addEventListener('wheel', (e) => {
    // 1. Determine if this is a trackpad pan vs. a zoom action
    const isPinch = e.ctrlKey; // Browsers flag trackpad pinches with ctrlKey
    const isSmoothScroll = Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) < 50 || !Number.isInteger(e.deltaY);
    const isTrackpadPan = !isPinch && isSmoothScroll;

    // If it's a pinch or a standard physical mouse wheel, let OrbitControls zoom normally
    if (!isTrackpadPan) return;

    // 2. Intercept the event so OrbitControls doesn't zoom
    e.preventDefault();
    e.stopPropagation();

    // 3. Calculate pan speed relative to how far zoomed in the camera is
    const distance = camera.position.distanceTo(controls.target);
    const panSpeed = distance * 0.0015;

    // 4. Get the camera's local Right and Up vectors, flattened to the XZ map plane
    const right = new window.THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    const up = new window.THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    up.y = 0;
    up.normalize();

    // 5. Apply the physical movement to the camera and its orbit target
    const panVector = new window.THREE.Vector3();
    panVector.addScaledVector(right, e.deltaX * panSpeed);
    panVector.addScaledVector(up, -e.deltaY * panSpeed);

    camera.position.add(panVector);
    controls.target.add(panVector);
  }, { passive: false, capture: true }); // 'capture: true' is required to intercept before OrbitControls

  // Events
  window.addEventListener('resize', () => {
    const W2 = container.clientWidth;
    const H2 = container.clientHeight;
    camera.aspect = W2 / H2;
    camera.updateProjectionMatrix();
    renderer.setSize(W2, H2);
  });

  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onMapClick);

  animate();
}

function getMeshGroup(meshName) {
  const key = GEO_NAME_MAP[meshName] || meshName;
  return countryMeshes.filter(m => (GEO_NAME_MAP[m.userData.name] || m.userData.name) === key);
}

function onMouseMove(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  mouseDidMove = true;

  const tooltip = document.getElementById('map-tooltip');
  tooltip.style.left = (e.clientX + 14) + 'px';
  tooltip.style.top = (e.clientY - 34) + 'px';
}

function onMapClick() {
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(countryMeshes, false);

  if (!hits.length) {
    clearArrows();
    if (selectedMeshes) {
      selectedMeshes.forEach(sm => {
        sm.material[1].emissive.setHex(COUNTRY_COLORS.topEmissiveDefault);
        sm.material[0].emissive.setHex(COUNTRY_COLORS.sideEmissiveDefault);
      });
      selectedMesh = null;
      selectedMeshes = null;
      state.selectedCountry = null;
    }
    return;
  }

  const m = hits[0].object;

  if (selectedMeshes) {
    selectedMeshes.forEach(sm => {
      sm.material[0].emissive.setHex(COUNTRY_COLORS.topEmissiveDefault);
      sm.material[1].emissive.setHex(COUNTRY_COLORS.sideEmissiveDefault);
    });
  }

  selectedMesh = m;
  selectedMeshes = getMeshGroup(m.userData.name);
  selectedMeshes.forEach(sm => {
    sm.material[0].emissive.setHex(COUNTRY_COLORS.topEmissiveSelected);
    sm.material[1].emissive.setHex(COUNTRY_COLORS.sideEmissiveSelected);
  });

  state.selectedCountry = m.userData.name;

  if (onCountrySelectGlobal) {
    onCountrySelectGlobal(m.userData.name);
  }

  drawArcs(m.userData.name, state.currentYear);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  const tooltip = document.getElementById('map-tooltip');

  if (mouseDidMove) {
    mouseDidMove = false;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(countryMeshes, false);

    if (hits.length > 0) {
      const m = hits[0].object;
      if (m !== hoveredMesh) {
        if (hoveredGroup) {
          hoveredGroup.forEach(hm => {
            if (!selectedMeshes || !selectedMeshes.includes(hm)) {
              hm.material[1].emissive.setHex(COUNTRY_COLORS.topEmissiveDefault);
              hm.material[0].emissive.setHex(COUNTRY_COLORS.sideEmissiveDefault);
            }
          });
        }
        hoveredMesh = m;
        hoveredGroup = getMeshGroup(m.userData.name);
        hoveredGroup.forEach(hm => {
          if (!selectedMeshes || !selectedMeshes.includes(hm)) {
            hm.material[1].emissive.setHex(COUNTRY_COLORS.topEmissiveHover);
            hm.material[0].emissive.setHex(COUNTRY_COLORS.sideEmissiveHover);
          }
        });
      }

      const name = m.userData.name;
      const ti = m.userData.ti;
      const _ttKey = GEO_NAME_MAP[name] || name;
      const qtySnap = state.data.TRADE_QUANTITY_BY_YEAR[state.currentYear] || state.data.TRADE_QUANTITY || {};

      tooltip.textContent = qtySnap[_ttKey]
        ? `${name} · TI: ${(ti < 0 ? '-' : '+')}${fmtQty(Math.abs(ti))}t net`
        : `${name}`;
      tooltip.classList.add('show');
    } else {
      if (hoveredGroup) {
        hoveredGroup.forEach(hm => {
          if (!selectedMeshes || !selectedMeshes.includes(hm)) {
            hm.material[1].emissive.setHex(COUNTRY_COLORS.topEmissiveDefault);
            hm.material[0].emissive.setHex(COUNTRY_COLORS.sideEmissiveDefault);
          }
        });
      }
      hoveredMesh = null;
      hoveredGroup = null;
      tooltip.classList.remove('show');
    }
  }

  // Fade-in arc meshes
  const now = Date.now();
  arcMeshes.forEach(m => {
    if (m.userData.fadeStart !== undefined) {
      const t = Math.min((now - m.userData.fadeStart) / 500, 1);
      m.material.opacity = t * m.userData.targetOpacity;
      if (t >= 1) delete m.userData.fadeStart;
    }
  });

  renderer.render(scene, camera);
}

export function loadMap() {
  const GEOJSON_URL = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';

  fetch(GEOJSON_URL)
    .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json(); })
    .then(data => {
      data.features.forEach(f => {
        if (!f.geometry) return;
        const geoName = f.properties?.name;
        const canonKey = GEO_NAME_MAP[geoName] || geoName;
        if (!canonKey || canonKey in CENTROIDS) return;

        const allCoords = [];
        (function collect(c) {
          if (typeof c[0] === 'number') allCoords.push(c);
          else c.forEach(collect);
        })(f.geometry.coordinates);

        if (allCoords.length === 0) return;

        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const c of allCoords) {
          if (c[1] < minLat) minLat = c[1]; if (c[1] > maxLat) maxLat = c[1];
          if (c[0] < minLng) minLng = c[0]; if (c[0] > maxLng) maxLng = c[0];
        }

        const lat = (minLat + maxLat) / 2;
        const lng = (minLng + maxLng) / 2;
        CENTROIDS[canonKey] = [lat, lng];
        if (geoName !== canonKey) CENTROIDS[geoName] = [lat, lng];
      });

      data.features.forEach(f => {
        if (f.geometry) buildCountry(f);
      });

      document.getElementById('map-loading').classList.add('hidden');
    })
    .catch(err => {
      const el = document.getElementById('map-loading');
      el.innerHTML = `<span style="color:${UI_COLORS.mapLoadErrorText};font-size:11px;">⚠ Could not load map.<br>Requires internet access.</span>`;
      el.style.flexDirection = 'column';
      console.error('GeoJSON load error:', err);
    });
}

function buildCountry(feature) {
  const name = feature.properties.name;
  const key = GEO_NAME_MAP[name] || name;
  const tiVisual = getTI(name);
  const tiRaw = getTransformationNet(name);
  const depth = getDepth(tiVisual, key);
  const topCol = getTopColor(tiVisual, key);
  const sideCol = getSideColor(tiVisual, key);

  const geomType = feature.geometry.type;
  const polys = geomType === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;

  polys.forEach(rings => {
    try {
      const outer = rings[0];
      if (!outer || outer.length < 4) return;

      const step = outer.length > 400 ? 4 : outer.length > 150 ? 3 : outer.length > 60 ? 2 : 1;
      const shape = makeShape(outer, step);
      if (!shape) return;

      for (let h = 1; h < rings.length; h++) {
        const hole = rings[h];
        if (!hole || hole.length < 4) continue;
        const hstep = Math.max(1, Math.floor(step * 1.5));
        const hpts = ringToPoints(hole, hstep);
        if (hpts.length < 3) continue;
        const path = new window.THREE.Path();
        path.moveTo(hpts[0].x, hpts[0].y);
        for (let i = 1; i < hpts.length; i++) path.lineTo(hpts[i].x, hpts[i].y);
        path.closePath();
        shape.holes.push(path);
      }

      const extOpts = { depth, bevelEnabled: false, steps: 1 };
      const geo = new window.THREE.ExtrudeGeometry(shape, extOpts);

      const mats = [
        new window.THREE.MeshLambertMaterial({ color: sideCol }),
        new window.THREE.MeshLambertMaterial({ color: topCol })
      ];

      const mesh = new window.THREE.Mesh(geo, mats);
      mesh.userData = { name, ti: tiRaw, tiVisual, baseDepth: depth };
      countryMeshes.push(mesh);
      scene.add(mesh);

      const lineGeo = new window.THREE.BufferGeometry();
      const pts3 = ringToPoints(outer, step).map(p => new window.THREE.Vector3(p.x, p.y, 0.1));
      lineGeo.setFromPoints(pts3);
      const lineMat = new window.THREE.LineBasicMaterial({ color: COUNTRY_COLORS.border, opacity: 0.35, transparent: true });
      scene.add(new window.THREE.LineLoop(lineGeo, lineMat));

    } catch (_) { /* skip malformed geometries */ }
  });
}

function clearArrows() {
  arcMeshes.forEach(m => scene.remove(m));
  arcMeshes = [];
}

export function drawArcs(countryName, year) {
  if (year === undefined) year = state.currentYear;
  clearArrows();

  const key = GEO_NAME_MAP[countryName] || countryName;
  const srcCent = CENTROIDS[key] || CENTROIDS[countryName];
  if (!srcCent) return;

  const qtySnap = state.data.TRADE_QUANTITY_BY_YEAR[year] || state.data.TRADE_QUANTITY_BY_YEAR[2023] || state.data.TRADE_QUANTITY;
  const rawSnap = state.data.TRADE_QTY_RAW_BY_YEAR[year] || state.data.TRADE_QTY_RAW_BY_YEAR[2023] || {};
  const procSnap = state.data.TRADE_QTY_PROC_BY_YEAR[year] || state.data.TRADE_QTY_PROC_BY_YEAR[2023] || {};

  const srcProj = project(srcCent[1], srcCent[0]);
  const srcPos = { x: srcProj.x, y: srcProj.y, z: topZ(key) };

  function topZ(k) {
    const mesh = countryMeshes.find(m => {
      const mapKey = GEO_NAME_MAP[m.userData.name] || m.userData.name;
      return mapKey === k || m.userData.name === k;
    });
    if (!mesh) return 1;
    return (mesh.userData.baseDepth || 0.5) * mesh.scale.z;
  }

  function flowExportColor(reporter, partner) {
    const r = (rawSnap[reporter] || {})[partner] || 0;
    const p = (procSnap[reporter] || {})[partner] || 0;
    return hexToInt(p > r ? FLOW_COLORS.exportProcessed : FLOW_COLORS.exportRaw);
  }

  function flowImportColor(reporter, partner) {
    const r = (rawSnap[reporter] || {})[partner] || 0;
    const p = (procSnap[reporter] || {})[partner] || 0;
    return hexToInt(p > r ? FLOW_COLORS.importProcessed : FLOW_COLORS.importRaw);
  }

  const arrows = [];

  // EXPORTS
  const qtyRow = qtySnap[key];
  if (qtyRow) {
    Object.entries(qtyRow).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([dest, qty]) => {
      const c = CENTROIDS[dest]; if (!c) return;
      const dstProj = project(c[1], c[0]);
      arrows.push({
        src: srcPos,
        dst: { x: dstProj.x, y: dstProj.y, z: topZ(dest) },
        qty,
        color: flowExportColor(key, dest),
        opacity: 0.90
      });
    });
  }

  // IMPORTS
  const importSrcs = [];
  Object.entries(qtySnap).forEach(([reporter, row]) => {
    if (reporter === key) return;
    const qty = row[key] || row[countryName];
    if (qty) importSrcs.push([reporter, qty]);
  });

  importSrcs.sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([src, qty]) => {
    const c = CENTROIDS[src]; if (!c) return;
    const srcProj2 = project(c[1], c[0]);
    arrows.push({
      src: { x: srcProj2.x, y: srcProj2.y, z: topZ(src) },
      dst: srcPos,
      qty,
      color: flowImportColor(src, key),
      opacity: 0.90
    });
  });

  const maxQty = Math.max(1, ...arrows.map(a => a.qty));
  arrows.forEach(({ src, dst, qty, color, opacity }) => {
    buildFlowArrow(src, dst, qty / maxQty * 100, color, opacity);
  });
}

function buildFlowArrow(srcPos, dstPos, pct, hexColor, opacity) {
  const midX = (srcPos.x + dstPos.x) / 2;
  const midY = (srcPos.y + dstPos.y) / 2;
  const dist = Math.sqrt(
    (dstPos.x - srcPos.x) ** 2 +
    (dstPos.y - srcPos.y) ** 2 +
    (dstPos.z - srcPos.z) ** 2
  );
  if (dist < 1) return;

  // 1. Define the Master Curve
  const peakZ = Math.max(srcPos.z, dstPos.z) + 18 + dist * 0.12;
  const p0 = new window.THREE.Vector3(srcPos.x, srcPos.y, srcPos.z);
  const p1 = new window.THREE.Vector3(midX, midY, peakZ);
  const p2 = new window.THREE.Vector3(dstPos.x, dstPos.y, dstPos.z);
  const curve = new window.THREE.QuadraticBezierCurve3(p0, p1, p2);

  // 2. Sizing and Materials
  const shaftR = Math.max(0.25, 0.25 + (pct / 100) * 1.0);
  const headR = shaftR * 2.8;
  const headH = shaftR * 9;

  const mat = new window.THREE.MeshPhongMaterial({
    color: hexColor,
    emissive: hexColor,
    emissiveIntensity: 0.18,
    shininess: 0,
    transparent: true,
    opacity: 0
  });

  function addMesh(mesh) {
    mesh.userData.fadeStart = Date.now();
    mesh.userData.targetOpacity = opacity;
    scene.add(mesh);
    arcMeshes.push(mesh);
  }

  // 3. Arrowhead Placement
  const tipPos = curve.getPoint(1);
  const tangent = curve.getTangent(1).normalize();

  const headGeo = new window.THREE.ConeGeometry(headR, headH, 8);
  const headMesh = new window.THREE.Mesh(headGeo, mat.clone());

  // Shift cone back so its absolute tip touches the destination
  headMesh.position.copy(tipPos).sub(tangent.clone().multiplyScalar(headH / 2));

  // Point the cone along the tangent
  const up = new window.THREE.Vector3(0, 1, 0);
  headMesh.quaternion.setFromUnitVectors(up, tangent);
  addMesh(headMesh);

  // 4. The Shaft: Shorten the tube so it stops exactly at the cone's base
  // The base of the cone is headH distance away from the tip along the tangent
  const coneBase = tipPos.clone().sub(tangent.clone().multiplyScalar(headH));

  const L = curve.getLength();
  // Calculate how far along the curve to stop (0.0 to 1.0) to avoid the cone
  const uStop = Math.max(0, (L - headH) / L);
  const tStop = curve.getUtoTmapping(uStop);

  const shaftPts = [];
  const segments = 20;

  // Sample points along the curve only up to the tStop limit
  for (let i = 0; i < segments; i++) {
    shaftPts.push(curve.getPoint(i * tStop / segments));
  }
  // Guarantee the final point connects seamlessly to the center of the cone's base
  shaftPts.push(coneBase);

  // Extrude the tube along this newly shortened path
  const shaftCurve = new window.THREE.CatmullRomCurve3(shaftPts);
  const tubeGeo = new window.THREE.TubeGeometry(shaftCurve, segments, shaftR, 8, false);
  addMesh(new window.THREE.Mesh(tubeGeo, mat.clone()));
}

export function onYearChangeMap(year) {
  const tiSnap = state.data.TRANSFORMATION_INDEX_BY_YEAR[year] || state.data.TRANSFORMATION_INDEX_BY_YEAR[2023] || {};
  const qtySnapYear = state.data.TRADE_QUANTITY_BY_YEAR[year] || state.data.TRADE_QUANTITY_BY_YEAR[2023] || state.data.TRADE_QUANTITY || {};
  const inboundByKey = {};

  Object.values(qtySnapYear).forEach(row => {
    Object.entries(row).forEach(([dest, q]) => {
      inboundByKey[dest] = (inboundByKey[dest] || 0) + q;
    });
  });

  countryMeshes.forEach(mesh => {
    const name = mesh.userData.name;
    const key = GEO_NAME_MAP[name] || name;
    const hasData = key in tiSnap;
    const ti = hasData ? tiSnap[key] : 0;

    mesh.userData.ti = ti;

    if (Array.isArray(mesh.material)) {
      mesh.material[1].color.setHex(getTopColor(ti, key, year));
      mesh.material[0].color.setHex(getSideColor(ti, key, year));
    }

    let targetDepth;
    if (hasData) {
      targetDepth = getDepth(ti, key);
    } else {
      const inbound = inboundByKey[key] || 0;
      const tiShare = Math.max(0, inbound) / state.maxTINet;
      targetDepth = 0.5 + tiShare * 45;
    }

    const baseDepth = mesh.userData.baseDepth || 0.5;
    mesh.scale.z = targetDepth / baseDepth;
  });

  if (state.selectedCountry) {
    drawArcs(state.selectedCountry, year);
  }
}