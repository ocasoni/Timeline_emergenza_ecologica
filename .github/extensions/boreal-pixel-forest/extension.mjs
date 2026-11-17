import { createCanvas, CanvasError, joinSession } from "@github/copilot-sdk/extension";
import http from "node:http";

const instances = new Map();
const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Foresta</title>
<style>
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; overflow: hidden; background: #fff; }
  body { display:flex; align-items:center; justify-content:center; }
  #scene { display:block; width:100vw; height:100vh; border:0; outline:0; cursor:grab; image-rendering:pixelated; }
  #scene.dragging { cursor:grabbing; }
  @media (max-width: 600px) { #scene { width:100vw; height:100vh; } }
</style>
</head>
<body>
<canvas id="scene" aria-label="Foresta tridimensionale pixel-art"></canvas>
<script type="module">
import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const canvas = document.querySelector("#scene");
const renderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:false});
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const camera = new THREE.PerspectiveCamera(54, 1, .1, 180);
const clock = new THREE.Clock();
let yaw = .785, pitch = .9, distance = 125, seed = 7, dragging = false, lastX = 0, lastY = 0;
const forest = new THREE.Group();
scene.add(forest);

const palette = {
  ground: 0x5d714f, moss: 0x71855b, soil: 0x55483b, snow: 0xcbd6d0,
  spruce: [0x193b32, 0x28513b, 0x376044], pine: [0x244634, 0x31583a, 0x4a6a43],
  larch: [0x496044, 0x657653, 0x7d855d], birch: 0xe1dfc8, bark: 0x4a4037
};
const material = (color) => new THREE.MeshLambertMaterial({color, flatShading:true});
const box = (w,h,d,color) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material(color));
const cylinder = (top,bottom,height,color) => new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,6), material(color));
const cone = (radius,height,color) => new THREE.Mesh(new THREE.ConeGeometry(radius,height,7), material(color));
function tree(x, z, kind, scale, index) {
  const group = new THREE.Group();
  group.position.set(x, 0, z); group.scale.setScalar(scale);
  const trunk = cylinder(kind === "birch" ? .26 : .18, kind === "birch" ? .38 : .27, 4.7, kind === "birch" ? palette.birch : palette.bark);
  trunk.position.y = 2.35; trunk.castShadow = true; group.add(trunk);
  if (kind === "birch") {
    for (let i=0; i<5; i++) {
      const mark = box(.08,.35,.72, i%2 ? 0x302f2b : 0x6a6860);
      mark.position.set((i%2 ? -.33 : .33), 1.15 + i*.72, 0); mark.rotation.y = (i%3)*.6; group.add(mark);
    }
  }
  const colors = kind === "spruce" ? palette.spruce : kind === "larch" ? palette.larch : palette.pine;
  const tiers = kind === "birch" ? 3 : kind === "larch" ? 6 : 5;
  for (let i=0; i<tiers; i++) {
    const y = 3.55 + i*(kind === "larch" ? .86 : 1.08);
    const radius = kind === "birch" ? 1.15 - i*.08 : 2.55 - i*.32;
    const foliage = cone(radius, kind === "birch" ? 1.55 : 1.9, colors[(i+index)%colors.length]);
    foliage.position.set((i%2 ? -.12 : .12), y, (index%3 === 0 ? .08 : -.08));
    foliage.rotation.y = (index%2)*.12; foliage.castShadow = true; group.add(foliage);
  }
  if (kind === "birch") {
    const crown = cone(1.35, 1.7, colors[index%colors.length]); crown.position.y=7.15; crown.castShadow=true; group.add(crown);
  }
  forest.add(group);
}
function makeForest() {
  while (forest.children.length) forest.remove(forest.children[0]);
  const rng = () => { const x = Math.sin(seed++ * 12.9898) * 43758.5453; return x - Math.floor(x); };
  for (let x=-34; x<=34; x+=5.2) for (let z=-34; z<=34; z+=5.2) {
    if (rng() < .18) continue;
    const edge = Math.abs(x) > 27 || Math.abs(z) > 27;
    const kinds = edge ? ["spruce","spruce","larch"] : ["spruce","birch","pine","spruce"];
    const kind = kinds[Math.floor(rng()*kinds.length)];
    tree(x+(rng()-.5)*3, z+(rng()-.5)*3, kind, .65+rng()*.52, Math.floor(rng()*9));
  }
}
const hemi = new THREE.HemisphereLight(0xd8ebff, 0x25372d, 2.2); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe6bd, 3.1); sun.position.set(-25,40,18); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);
makeForest();
function resize() { const w=canvas.clientWidth,h=canvas.clientHeight; renderer.setSize(Math.floor(w*.62),Math.floor(h*.62),false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
function animate() {
  requestAnimationFrame(animate);
  const target = new THREE.Vector3(0, 3.5, 0);
  camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance, Math.sin(pitch)*distance+5, Math.cos(yaw)*Math.cos(pitch)*distance);
  camera.lookAt(target); renderer.render(scene,camera);
}
addEventListener("resize", resize); resize(); animate();
canvas.addEventListener("pointerdown", e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.classList.add("dragging");canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener("pointerup", ()=>{dragging=false;canvas.classList.remove("dragging")});
canvas.addEventListener("pointermove", e=>{if(!dragging)return;yaw-=(e.clientX-lastX)*.006;pitch=Math.max(.18,Math.min(1.35,pitch+(e.clientY-lastY)*.006));lastX=e.clientX;lastY=e.clientY});
canvas.addEventListener("wheel", e=>{e.preventDefault();distance=Math.max(9,Math.min(80,distance+e.deltaY*.035))},{passive:false});
addEventListener("keydown", e=>{if(e.key.toLowerCase()==="r"){seed=Math.floor(Math.random()*10000);makeForest()}});
</script>
</body>
</html>`;

function startServer(instanceId) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      if (request.url === "/" || request.url === "/index.html") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(html);
        return;
      }
      response.writeHead(404);
      response.end("Not found");
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to determine canvas server address"));
        return;
      }
      instances.set(instanceId, server);
      resolve({ url: "http://127.0.0.1:" + address.port + "/", title: "Taiga boreale", status: "Foresta pronta" });
    });
  });
}

const borealForest = createCanvas({
  id: "boreal-pixel-forest",
  displayName: "Taiga boreale",
  description: "Foresta tridimensionale esplorabile della taiga boreale in stile pixel-art.",
  actions: [{
    name: "reload_forest",
    description: "Ricarica la scena della foresta.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async ({ instanceId }) => {
      if (!instances.has(instanceId)) throw new CanvasError("not_open", "La foresta non è aperta.");
      return { refreshed: true };
    }
  }],
  open: async ({ instanceId }) => {
    const current = instances.get(instanceId);
    if (current) {
      const address = current.address();
      if (address && typeof address !== "string") return { url: "http://127.0.0.1:" + address.port + "/", title: "Taiga boreale", status: "Foresta pronta" };
    }
    try { return await startServer(instanceId); }
    catch (error) { throw new CanvasError("server_start_failed", error.message); }
  },
  onClose: async ({ instanceId }) => {
    const server = instances.get(instanceId);
    if (server) { await new Promise(resolve => server.close(resolve)); instances.delete(instanceId); }
  }
});

await joinSession({ canvases: [borealForest] });
