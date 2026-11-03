import { useCallback, useEffect, useRef, useState, type PointerEvent, type CSSProperties } from 'react';
import { blank, clone, deposit, push, raster, step, W, H, type InkState } from './inkEngine';

const WIDTH=1200, HEIGHT=760;
const CANVAS_SIZES=[{label:'Small',width:600,height:380},{label:'Medium',width:900,height:570},{label:'Large',width:1200,height:760}] as const;
const PALETTE=['#315e9b','#16a6a0','#db6d8e','#e5a147','#8e6bb8','#242d42'];
const BACKGROUNDS=['#faf8f5','#ffffff','#121b2b','#e6f2ee','#f9e9de','#dce9f8'];
type Tool='ink'|'brush'|'stir'|'vortex';
type Point={x:number;y:number};
export default function App(){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const layerRef=useRef<HTMLCanvasElement|null>(null);
  const stateRef=useRef<InkState>(blank());
  const historyRef=useRef<InkState[]>([]);
  const drawingRef=useRef(false), previousRef=useRef<Point|null>(null);
  const latestDropRef=useRef<Point|null>(null);
  const configRef=useRef({background:'#faf8f5',speed:50,saturation:135,density:125});
  const [color,setColor]=useState(PALETTE[0]);
  const [background,setBackground]=useState('#faf8f5');
  const [brushSize,setBrushSize]=useState(45);
  const [flowSpeed,setFlowSpeed]=useState(50);
  const [strength,setStrength]=useState(55);
  const [tool,setTool]=useState<Tool>('ink');
  const [vortexDirection,setVortexDirection]=useState<'left'|'right'>('right');
  const [historyCount,setHistoryCount]=useState(0);
  const [canvasSize,setCanvasSize]=useState(2);
  const [saturation,setSaturation]=useState(135);
  const [density,setDensity]=useState(125);
  const [showInfo,setShowInfo]=useState(false);
  const [zoom,setZoom]=useState(1);
  const [viewportSize,setViewportSize]=useState({width:1200,height:760});
  const viewportRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const viewport=viewportRef.current;
    if(!viewport)return;
    const observe=()=>setViewportSize({width:viewport.clientWidth,height:viewport.clientHeight});
    observe();
    const ro=new ResizeObserver(observe);ro.observe(viewport);
    return ()=>ro.disconnect();
  },[]);
  const selectedSize=CANVAS_SIZES[canvasSize];
  const fit=Math.min(1,Math.max(1,viewportSize.width-24)/selectedSize.width,Math.max(1,viewportSize.height-24)/selectedSize.height);
  const displayedWidth=Math.max(1,Math.round(selectedSize.width*fit*zoom));
  useEffect(()=>{ configRef.current={background,speed:flowSpeed,saturation,density}; },[background,flowSpeed,saturation,density]);
  const render=useCallback(()=>{
    const canvas=canvasRef.current,layer=layerRef.current;
    if(!canvas||!layer)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const lctx=layer.getContext('2d');if(!lctx)return;
    raster(stateRef.current,lctx,configRef.current.saturation,configRef.current.density);
    ctx.fillStyle=configRef.current.background;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(layer,0,0,canvas.width,canvas.height);
  },[]);
  useEffect(()=>{
    const l=document.createElement('canvas');l.width=W;l.height=H;layerRef.current=l;
    render();
    let id=0,last=0;
    const tick=(t:number)=>{
      if(t-last>32){
        step(stateRef.current,configRef.current.speed);
        render();last=t;
      }
      id=requestAnimationFrame(tick);
    };
    id=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(id);
  },[render]);
  const coords=(e:PointerEvent<HTMLCanvasElement>):Point=>{
    const b=e.currentTarget.getBoundingClientRect();
    return {x:(e.clientX-b.left)*WIDTH/b.width,y:(e.clientY-b.top)*HEIGHT/b.height};
  };
  const save=()=>{
    historyRef.current.push(clone(stateRef.current));
    if(historyRef.current.length>12)historyRef.current.shift();
    setHistoryCount(historyRef.current.length);
  };
  const ink=(p:Point,brush=false)=>deposit(stateRef.current,p.x,p.y,brushSize,color,brush);
  const manipulate=(p:Point,dx:number,dy:number,vortex:boolean)=>{
    push(stateRef.current,p.x,p.y,dx,dy,Math.max(35,brushSize*(vortex?3.2:2.4)),strength/100,vortex,vortexDirection==='right'?1:-1);
  };
  const down=(e:PointerEvent<HTMLCanvasElement>)=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.currentTarget.setPointerCapture(e.pointerId);
    save();drawingRef.current=true;
    const p=coords(e);previousRef.current=p;latestDropRef.current=p;
    if(tool==='ink'||tool==='brush')ink(p,tool==='brush');
    if(tool==='vortex')manipulate(p,0,0,true);
    render();
  };
  const move=(e:PointerEvent<HTMLCanvasElement>)=>{
    if(!drawingRef.current||!previousRef.current)return;
    const p=coords(e),prev=previousRef.current;
    const dx=p.x-prev.x,dy=p.y-prev.y,dist=Math.hypot(dx,dy);
    if(tool==='ink'){
      const last=latestDropRef.current??prev;
      const dd=Math.hypot(p.x-last.x,p.y-last.y),spacing=Math.max(18,brushSize*0.72);
      if(dd>=spacing){const n=Math.floor(dd/spacing);for(let j=1;j<=n;j++)ink({x:last.x+(p.x-last.x)*j/n,y:last.y+(p.y-last.y)*j/n});latestDropRef.current=p;}
    }else if(tool==='brush'){
      const n=Math.max(1,Math.ceil(dist/Math.max(3,brushSize*0.13)));
      for(let j=1;j<=n;j++)ink({x:prev.x+dx*j/n,y:prev.y+dy*j/n},true);
    }else{
      const n=Math.max(1,Math.ceil(dist/10));
      for(let j=1;j<=n;j++)manipulate({x:prev.x+dx*j/n,y:prev.y+dy*j/n},dx/n,dy/n,tool==='vortex');
    }
    previousRef.current=p;render();
  };
  const stop=()=>{drawingRef.current=false;previousRef.current=null;latestDropRef.current=null;};
  const undo=()=>{const old=historyRef.current.pop();if(!old)return;stop();stateRef.current=old;setHistoryCount(historyRef.current.length);render();};
  const clear=()=>{save();stateRef.current=blank();render();};
  const resizeCanvas=(index:number)=>{
    // Resize the actual canvas and its on-screen representation without clearing pigment.
    setCanvasSize(index);
  };
  useEffect(()=>{render();},[canvasSize,render]);
  const exportPng=()=>{
    render();const url=canvasRef.current?.toDataURL('image/png');if(!url)return;
    const a=document.createElement('a');a.href=url;a.download='fluid-ink-art.png';a.click();
  };
  const chooseBackground=(value:string)=>{configRef.current.background=value;setBackground(value);render();};
  return <div className="app">
    <header className="topbar"><div className="brand"><span className="brand-icon">◉</span> FLUID INK STUDIO <small className="version-mark">v1.7</small></div>
      <div className="top-actions"><button className="info-button" type="button" aria-label="About the app" title="About the app" aria-haspopup="dialog" aria-expanded={showInfo} onClick={()=>setShowInfo(v=>!v)}>ⓘ Info</button><button disabled={!historyCount} onClick={undo}>↶ Undo</button><button onClick={clear}>Clear</button><button className="primary" onClick={exportPng}>↓ Export PNG</button></div>
    </header>
    {showInfo && <div className="info-backdrop" onClick={()=>setShowInfo(false)}>
      <div className="info-dialog" role="dialog" aria-modal="true" aria-labelledby="info-heading" onClick={e=>e.stopPropagation()}>
        <div className="info-heading"><h2 id="info-heading">About Fluid Ink Studio</h2><button type="button" aria-label="Close information" onClick={()=>setShowInfo(false)}>✕</button></div>
        <p>Fluid Ink Studio is an interactive digital art workspace for creating abstract paintings inspired by ink flowing through water.</p>
        <p>Choose a color and a tool: <strong>Ink Drop</strong> adds pigment, <strong>Brush</strong> paints continuous strokes, <strong>Stir</strong> moves pigment and <strong>Vortex</strong> creates swirls. Select <strong>Left</strong> or <strong>Right</strong> to choose the vortex rotation direction.</p>
        <p>Use the left panel to adjust colors, background and ink properties. Select the canvas size above the artwork; use + and − to zoom without changing the export resolution. Undo, clear or export your painting from the top bar.</p>
        <p className="info-note">This is an artistic pixel-based simulation, not a physically accurate fluid model.</p>
      </div>
    </div>}
    <main className="workspace"><aside className="sidebar"><h1>Ink on Water</h1>
      <section className="panel"><h2>Tools</h2><div className="tool-options">
        {([['ink','◉ Ink Drop'],['brush','✎ Brush'],['stir','〰 Stir Ink'],['vortex','◌ Vortex']] as const).map(([value,label])=><button key={value} className={tool===value?'active':''} onClick={()=>setTool(value)}>{label}</button>)}
      </div>
        {tool==='vortex' && <div className="vortex-direction">
          <span className="vortex-direction-label">Direction</span>
          <div className="direction-options" role="group" aria-label="Vortex direction">
            <button type="button" className={vortexDirection==='left'?'active':''} aria-pressed={vortexDirection==='left'} onClick={()=>setVortexDirection('left')}>↶ Left</button>
            <button type="button" className={vortexDirection==='right'?'active':''} aria-pressed={vortexDirection==='right'} onClick={()=>setVortexDirection('right')}>↷ Right</button>
          </div>
        </div>}
      </section>
      <section className="panel"><h2>Ink Color</h2><div className="palette">{PALETTE.map(c=><button key={c} className={'swatch '+(c===color?'selected':'')} style={{background:c}} onClick={()=>setColor(c)} aria-label={'Color '+c}/>)}</div><label className="custom-color">Custom color <input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label></section>
      <section className="panel"><h2>Canvas Background</h2><div className="palette">{BACKGROUNDS.map(c=><button key={c} className={'swatch '+(c===background?'selected':'')} style={{background:c}} onClick={()=>chooseBackground(c)} aria-label={'Background '+c}/>)}</div><label className="custom-color">Custom background <input type="color" value={background} onChange={e=>chooseBackground(e.target.value)}/></label></section>
      <section className="panel"><h2>Settings</h2>
        <label className="setting-line">Brush size <strong>{brushSize} px</strong></label><input className="range" type="range" min="10" max="120" value={brushSize} onChange={e=>setBrushSize(Number(e.target.value))}/>
        <label className="setting-line">Flow speed <strong>{flowSpeed} %</strong></label><input className="range" type="range" min="0" max="100" value={flowSpeed} onChange={e=>setFlowSpeed(Number(e.target.value))}/>
        <label className="setting-line">Stir strength <strong>{strength} %</strong></label><input className="range" type="range" min="0" max="100" value={strength} onChange={e=>setStrength(Number(e.target.value))}/>
        <label className="setting-line">Color saturation <strong>{saturation} %</strong></label><input className="range" type="range" min="70" max="200" value={saturation} onChange={e=>{const v=Number(e.target.value); configRef.current.saturation=v;setSaturation(v);render();}}/>
        <label className="setting-line">Pigment density <strong>{density} %</strong></label><input className="range" type="range" min="50" max="220" value={density} onChange={e=>{const v=Number(e.target.value); configRef.current.density=v;setDensity(v);render();}}/>
        <div className="brush-preview"><span style={{width:brushSize,height:brushSize,background:color,opacity:0.55}}/></div>
      </section>
    </aside><section className="stage">
      <div className="stage-header">
        
        <label className="canvas-size-control" htmlFor="canvas-size">Canvas size
          <select id="canvas-size" value={canvasSize} onChange={e=>resizeCanvas(Number(e.target.value))} aria-label="Canvas size">
            {CANVAS_SIZES.map((s,i)=><option key={s.label} value={i}>{s.label} — {s.width} × {s.height} px</option>)}
          </select>
        </label>
      </div>
      <div className="canvas-viewport" ref={viewportRef}>
        <div className="canvas-center">
          <div className="canvas-frame" style={{width:`${displayedWidth}px`,aspectRatio:`${selectedSize.width} / ${selectedSize.height}`} as CSSProperties}>
            <canvas ref={canvasRef} width={selectedSize.width} height={selectedSize.height} onPointerDown={down} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}/>
          </div>
        </div>
      </div>
      <div className="zoom-controls" role="group" aria-label="Canvas zoom">
        <button type="button" onClick={()=>setZoom(z=>Math.max(0.5,Math.round((z-0.25)*100)/100))} disabled={zoom<=0.5} aria-label="Zoom out" title="Zoom out">−</button>
        <span className="zoom-value">{Math.round(zoom*100)}%</span>
        <button type="button" onClick={()=>setZoom(z=>Math.min(3,Math.round((z+0.25)*100)/100))} disabled={zoom>=3} aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" className="zoom-reset" onClick={()=>setZoom(1)} title="Fit to view" aria-label="Reset zoom">Fit</button>
      </div>
    </section></main>
  </div>;
}
