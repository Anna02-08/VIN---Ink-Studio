/** Pixel-based wet ink simulation. The grid is smaller than the output canvas.
 *  Pigment (concentration and RGB totals) is advected with the water.
 *  This stable, simplified model is an artistic approximation, not a Navier–Stokes solver.
 */
export const W = 360, H = 228, N = W * H;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const IX = (x: number, y: number) => y * W + x;
export type InkState = {
  mass: Float32Array; red: Float32Array; green: Float32Array; blue: Float32Array;
  wet: Float32Array; vx: Float32Array; vy: Float32Array;
};
export function blank(): InkState {
  const field = () => new Float32Array(N);
  return { mass: field(), red: field(), green: field(), blue: field(), wet: field(), vx: field(), vy: field() };
}
export const clone = (s: InkState): InkState => ({
  mass: s.mass.slice(), red: s.red.slice(), green: s.green.slice(), blue: s.blue.slice(),
  wet: s.wet.slice(), vx: s.vx.slice(), vy: s.vy.slice(),
});
const hexRGB = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
let randomSeed = 41;
function rand() { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) | 0; return (randomSeed >>> 0) / 4294967296; }

/** Layered irregular pigment deposits with paper-like grain. */
export function deposit(s: InkState, px: number, py: number, radiusPx: number, hex: string, brush = false) {
  const [r, g, b] = hexRGB(hex);
  const cx = px * W / 1200, cy = py * H / 760;
  const radius = clamp(radiusPx * W / 1200, 2, 55);
  const phase = rand() * Math.PI * 2;
  const left = Math.max(1, Math.floor(cx - radius * 1.45)), right = Math.min(W-2, Math.ceil(cx + radius * 1.45));
  const top = Math.max(1, Math.floor(cy - radius * 1.45)), bottom = Math.min(H-2, Math.ceil(cy + radius * 1.45));
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const dx = x-cx, dy = y-cy, a = Math.atan2(dy,dx);
    const wav = 1 + 0.15*Math.sin(a*5+phase) + 0.10*Math.sin(a*9-phase*1.4) + 0.065*Math.sin(a*17+phase*2.2);
    const d = Math.hypot(dx, dy) / (radius * wav);
    if (d > 1.14) continue;
    const grain = 0.75 + rand()*0.5;
    const bloom = Math.exp(-Math.pow(d / 0.82, 4));
    const irregular = Math.max(0, 1 - d * 0.95);
    const amt = (brush ? 0.065 : 0.15) * bloom * (0.65 + 0.35 * irregular) * grain;
    const i = IX(x,y);
    s.mass[i] += amt;
    s.red[i] += amt * r; s.green[i] += amt * g; s.blue[i] += amt * b;
    s.wet[i] = Math.min(3, s.wet[i] + (brush ? 0.14 : 0.6) * Math.max(0,1 - d*d));
  }
}

/** Pointer strokes create a local velocity field. */
export function push(s: InkState, px: number, py: number, dxPx: number, dyPx: number, radiusPx: number, strength: number, vortex: boolean, vortexDirection: 1 | -1 = 1) {
  const cx = px * W / 1200, cy = py * H / 760;
  const radius = clamp(radiusPx * W / 1200, 5, 90);
  for (let y = Math.max(1,Math.floor(cy-radius*2));y < Math.min(H-1,cy+radius*2);y++) {
    for(let x=Math.max(1,Math.floor(cx-radius*2));x < Math.min(W-1,cx+radius*2);x++) {
      const ox=x-cx, oy=y-cy, d2=(ox*ox+oy*oy)/(radius*radius);
      if(d2>4) continue;
      const k=Math.exp(-1.8*d2)*strength;
      const i=IX(x,y);
      if(vortex) { s.vx[i] += -oy * k * 0.14 * vortexDirection; s.vy[i] += ox * k * 0.14 * vortexDirection; }
      else { s.vx[i] += dxPx * W/1200 * k * 0.85; s.vy[i] += dyPx * H/760 * k * 0.85; }
      s.wet[i]=Math.min(3,s.wet[i]+0.05*k);
    }
  }
}
function sample(field: Float32Array, x: number, y: number) {
  x=clamp(x,0,W-1.001);y=clamp(y,0,H-1.001);
  const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,i=IX(x0,y0);
  return field[i]*(1-fx)*(1-fy)+field[i+1]*fx*(1-fy)+field[i+W]*(1-fx)*fy+field[i+W+1]*fx*fy;
}
function evolve(field: Float32Array, vx: Float32Array, vy: Float32Array, wet: Float32Array, diffusion: number) {
  const out = new Float32Array(N);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++) {
    const i=IX(x,y), xx=x-vx[i], yy=y-vy[i];
    const center=sample(field,xx,yy);
    const lap=(field[i-1]+field[i+1]+field[i-W]+field[i+W])*0.25-field[i];
    out[i]=Math.max(0,center+lap*diffusion*(0.1+Math.min(1,wet[i])));
  }
  return out;
}
/** One step of advection, capillary diffusion, and slow drying. */
export function step(s: InkState, speed: number) {
  const adv = clamp(speed/100,0,1);
  const vxs=s.vx.slice(), vys=s.vy.slice(), wet=s.wet.slice();
  // Small local variations approximate pigment dispersion on a wet surface.
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++) {
    const i=IX(x,y);
    const wetGradientX=(wet[i-1]-wet[i+1])*0.015;
    const wetGradientY=(wet[i-W]-wet[i+W])*0.015;
    vxs[i]=s.vx[i]+wetGradientX*adv;
    vys[i]=s.vy[i]+wetGradientY*adv;
  }
  const d=0.018+adv*0.065;
  s.mass=evolve(s.mass,vxs,vys,wet,d);
  s.red=evolve(s.red,vxs,vys,wet,d);
  s.green=evolve(s.green,vxs,vys,wet,d);
  s.blue=evolve(s.blue,vxs,vys,wet,d);
  s.wet=evolve(wet,vxs,vys,wet,0.12+adv*0.10);
  for(let i=0;i<N;i++) {
    s.wet[i]*=0.995;
    // Rotation and movement decay after the pointer is released.
    s.vx[i]*=0.89; s.vy[i]*=0.89;
  }
}

/** Paper-like texture and optical pigment blending, separate from the background. */
export function raster(s: InkState, ctx: CanvasRenderingContext2D, saturation = 135, density = 125) {
  const image=ctx.createImageData(W,H), data=image.data;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
    const i=IX(x,y),p=i*4,m=s.mass[i];
    if(m<0.001) continue;
    const c=Math.min(m,3);
    const edge=Math.abs(m-s.mass[i>0?i-1:i])+Math.abs(m-s.mass[i+1<N?i+1:i])+
      Math.abs(m-s.mass[i>=W?i-W:i])+Math.abs(m-s.mass[i+W<N?i+W:i]);
    const gran=(Math.sin(x*37.1+y*91.7)*Math.sin(x*17.8-y*57.2))*0.075;
    const alpha=Math.min(0.96,(1-Math.exp(-c*0.67*density/100))*(0.93+gran)+Math.min(0.19,edge*0.15));
    const scale=1/Math.max(m,0.0001);
    const darken=Math.min(0.26,edge*0.10);
    // Saturation is adjusted when rendering, not in the pigment simulation.
    // This preserves smooth advection and diffusion while allowing adjustments at any time.
    const r=s.red[i]*scale, g=s.green[i]*scale, b=s.blue[i]*scale;
    const gray=0.2126*r+0.7152*g+0.0722*b;
    const sat=saturation/100;
    data[p]=clamp((gray+(r-gray)*sat)*(1-darken),0,255);
    data[p+1]=clamp((gray+(g-gray)*sat)*(1-darken),0,255);
    data[p+2]=clamp((gray+(b-gray)*sat)*(1-darken),0,255);
    data[p+3]=Math.round(alpha*255);
  }
  ctx.putImageData(image,0,0);
}
