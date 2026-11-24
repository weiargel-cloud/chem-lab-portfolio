// Chemistry lab portfolio — reads data/site.json and data/experiments.json and renders the site.
// To change content, edit those JSON files (see README.md). No build step needed.
(() => {
const GROUPS = {
  acid:{name:"Acids & bases",v:"--g-acid"}, redox:{name:"Redox & electrochem",v:"--g-redox"},
  organic:{name:"Organic",v:"--g-organic"}, stoich:{name:"Stoichiometry & solutions",v:"--g-stoich"},
  thermo:{name:"Thermochem & kinetics",v:"--g-thermo"}, other:{name:"Other",v:"--g-other"}
};
const S = { info:{}, exps:[], loaded:false, err:"", center:0, timer:null };

// ---------- helpers ----------
function h(tag, attrs, ...kids){
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})){
    if (v==null || v===false) continue;
    if (k==="class") e.className=v; else if (k==="style") e.setAttribute("style",v);
    else if (k.startsWith("on")) e.addEventListener(k.slice(2),v); else e.setAttribute(k,v===true?"":v);
  }
  for (const k of kids.flat()){ if (k==null||k===false) continue; e.append(k instanceof Node?k:document.createTextNode(String(k))); }
  return e;
}
function svg(markup){ const t=document.createElement("template"); t.innerHTML=markup.trim(); return t.content.firstChild; }
const FLASK = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6L4.5 18.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/><path d="M7.5 15h9"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const DOC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M10 13h6M10 17h6"/></svg>';
const str = v => typeof v==="string" ? v : (v==null ? "" : String(v));
const pad = n => String(n).padStart(2,"0");
// Only https links or files inside this repo (no "..", no other schemes).
function cleanUrl(u){
  u = str(u).trim(); if (!u) return null;
  if (/^https:\/\//i.test(u)) return u;
  if (/^[A-Za-z0-9_][A-Za-z0-9_./ -]*$/.test(u) && !u.includes("..")) return u;
  return null;
}
function driveId(u){ const m = str(u).match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/); return m ? m[1] : null; }
function ytId(u){ const m = str(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/); return m ? m[1] : null; }
function videoInfo(u){
  const url = cleanUrl(u); if (!url) return null;
  const d = driveId(url); if (d) return {kind:"embed", src:"https://drive.google.com/file/d/"+d+"/preview", thumb:"https://drive.google.com/thumbnail?id="+d+"&sz=w640", open:url};
  const y = ytId(url); if (y) return {kind:"embed", src:"https://www.youtube-nocookie.com/embed/"+y, thumb:"https://i.ytimg.com/vi/"+y+"/hqdefault.jpg", open:url};
  if (/\.(mp4|webm)(\?|$)/i.test(url)) return {kind:"file", src:url, thumb:null, open:url};
  return {kind:"link", src:null, thumb:null, open:url};
}
function imgUrl(u){ const url = cleanUrl(u); if (!url) return null; const d = driveId(url); return d ? "https://drive.google.com/thumbnail?id="+d+"&sz=w1200" : url; }
const photosOf = d => (Array.isArray(d.photos)?d.photos:[]).map(imgUrl).filter(Boolean);
function coverOf(d){ const v=videoInfo(d.video); return (v&&v.thumb) || photosOf(d)[0] || null; }
function symbolFor(e){
  const s = str(e.symbol).trim(); if (s) return s.slice(0,3);
  const t = str(e.title).replace(/[^A-Za-z]/g,""); if (!t) return "?";
  const rest = t.slice(1).toLowerCase().match(/[bcdfghjklmnpqrstvwxz]/);
  return t[0].toUpperCase() + (rest?rest[0]:t[1]?t[1].toLowerCase():"");
}
const gvar = g => "var("+(GROUPS[g]||GROUPS.other).v+")";
function formula(text){
  const out = document.createDocumentFragment();
  const t = str(text).replace(/<->|<=>/g,"⇌").replace(/->/g,"→");
  let i=0, buf="";
  const flush=()=>{ if(buf){out.append(document.createTextNode(buf)); buf="";} };
  while(i<t.length){
    const c=t[i], prev=t[i-1]||"";
    if(/\d/.test(c) && /[A-Za-z)\]]/.test(prev)){ flush(); let d=""; while(i<t.length && /\d/.test(t[i])) d+=t[i++]; out.append(h("sub",{},d)); continue; }
    buf+=c; i++;
  }
  flush(); return out;
}
const paras = text => str(text).split(/\n\s*\n/).filter(p=>p.trim()).map(p=>h("p",{class:"pre"},p.trim()));
function steps(text){
  const lines = (Array.isArray(text)?text:str(text).split("\n")).map(l=>str(l).replace(/^\s*(\d+[.)]|[-*•])\s*/,"").trim()).filter(Boolean);
  return h("ol",{}, lines.map(l=>h("li",{},l)));
}
const lines = v => Array.isArray(v) ? v.map(str).join("\n") : str(v);
function fmtDate(d){ if(!d) return ""; const x=new Date(d+"T12:00:00"); return isNaN(x)?str(d):x.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}); }
const sorted = () => [...S.exps].sort((a,b)=>(Number(a.num)||999)-(Number(b.num)||999));
const ready = d => !!d._ready;
// A lab can list one "video" and/or several "videos" (clips). It counts as ready once it has
// a title, a video or a report; untitled labs show as "Experiment N".
function normalize(d){
  d = Object.assign({}, d);
  const vids = [d.video, ...(Array.isArray(d.videos)?d.videos:[])].filter(v=>videoInfo(v));
  const realTitle = str(d.title).trim();
  d._vids = vids;
  d._ready = !!(realTitle || vids.length || cleanUrl(d.report));
  d.video = vids[0] || "";
  if (!realTitle) d.title = "Experiment "+(str(d.num)||"");
  return d;
}
const total = () => Number(S.info.totalLabs) || Math.max(8, S.exps.length);
const members = () => (Array.isArray(S.info.members)?S.info.members:str(S.info.members).split(/[,\n]/)).map(s=>str(s).trim()).filter(Boolean);
const idOf = d => "lab-"+pad(str(d.num)||"0");

// ---------- lab-monitor background ----------
const ATOM = (x,y,t,c)=>`<text x="${x}" y="${y}" fill="${c}" stroke="#06100C" stroke-width="7" paint-order="stroke" font-family="Geist Mono,monospace" font-size="15" text-anchor="middle" dominant-baseline="central">${t}</text>`;
const CAFFEINE = `<svg class="mol" viewBox="-110 -100 240 200" width="250" height="208" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
<path d="M0 -40 L-34.6 -20 L-34.6 20 L0 40 L34.6 20 L34.6 -20 Z M34.6 -20 L72.6 -32 L96 0 L72.6 32 L34.6 20"/>
<path d="M28 13 L28 -13 M69 25 L88 2 M-3 -40 L-3 -72 M3 -40 L3 -72 M-34.6 20 L-62 36 M-32.6 23.5 L-60 39.5 M-34.6 -20 L-64 -37 M0 40 L0 72 M72.6 -32 L88 -62"/></g>
${ATOM(0,-80,"O","var(--phos-o)")}${ATOM(-34.6,-20,"N","var(--phos-n)")}${ATOM(-82,-44,"CH3","currentColor")}${ATOM(-70,42,"O","var(--phos-o)")}${ATOM(0,40,"N","var(--phos-n)")}${ATOM(0,84,"CH3","currentColor")}${ATOM(72.6,-32,"N","var(--phos-n)")}${ATOM(96,-72,"CH3","currentColor")}${ATOM(72.6,32,"N","var(--phos-n)")}</svg>`;
const ASPIRIN = `<svg class="mol" viewBox="-50 -84 160 184" width="190" height="218" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
<path d="M0 -36 L31 -18 L31 18 L0 36 L-31 18 L-31 -18 Z M3 -27 L24 -15 M24 15 L3 27 M-24 15 L-24 -15"/>
<path d="M31 -18 L58 -34 M55 -34 L55 -66 M61 -34 L61 -66 M58 -34 L82 -20 M31 18 L56 33 M60 36 L60 64 M60 64 L38 77 M62 68 L40 81 M60 64 L82 77"/></g>
${ATOM(58,-74,"O","var(--phos-o)")}${ATOM(90,-16,"OH","var(--phos-o)")}${ATOM(58,34,"O","var(--phos-o)")}${ATOM(32,82,"O","var(--phos-o)")}${ATOM(98,80,"CH3","currentColor")}</svg>`;
function trace(){
  const P=[[110,150,9],[188,118,10],[204,62,6],[262,96,8],[300,80,7],[560,92,9],[610,86,8],[790,68,8],[840,96,8],[890,74,8]];
  const yAt = x => { let y=180; for(const [c,hh,w] of P) y-=hh*Math.exp(-((x-c)**2)/(2*w*w)); return y; };
  let d=""; for(let x=0;x<=1000;x+=3) d+=(x?"L":"M")+x+" "+yAt(x).toFixed(1);
  const marks=[[110,1],[188,2],[262,3],[560,4],[840,5]].map(([x,n])=>`<text x="${x}" y="${yAt(x)-14}" fill="currentColor" font-family="Geist Mono,monospace" font-size="12" text-anchor="middle">${n}</text>`).join("");
  return `<svg viewBox="0 0 1000 190" preserveAspectRatio="none" style="left:0;right:0;bottom:0;width:100%;height:150px;opacity:.5" aria-hidden="true">
<defs><linearGradient id="tr" x1="0" x2="1"><stop offset=".72" stop-color="var(--phos)"/><stop offset=".85" stop-color="var(--phos-o)"/></linearGradient></defs>
<path d="M0 180.5 H1000" stroke="currentColor" stroke-width="1" opacity=".5" vector-effect="non-scaling-stroke"/>
<path d="${d}" fill="none" stroke="url(#tr)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>${marks}</svg>`;
}
function decor(host, full){
  const d=h("div",{class:"decor"});
  if (full){
    const m1=svg(CAFFEINE); m1.style.cssText="left:2%;top:120px"; d.append(m1);
    d.append(h("div",{class:"lbl",style:"left:3%;top:338px"},h("b",{},"CAFFEINE"),"C8H10N4O2 | 194.19 g/mol"));
    const m2=svg(ASPIRIN); m2.style.cssText="right:3%;top:104px"; d.append(m2);
    d.append(h("div",{class:"lbl",style:"right:3%;top:330px;text-align:right"},h("b",{},"ASPIRIN"),"C9H8O4 | m.p. 136 °C"));
  }
  d.append(svg(trace()));
  host.append(d);
}

// ---------- hero ----------
function nav(){
  return h("nav",{class:"nav"},
    h("a",{class:"brand",href:"#"},svg(FLASK),h("span",{},str(S.info.short)||"Chem Lab")),
    h("div",{class:"links"},h("a",{href:"#"},"Home"),h("a",{href:"#experiments"},"Experiments"),h("a",{href:"#about"},"About"),h("a",{href:"#team"},"Team")),
    h("a",{class:"pill lime",href:"#experiments"},"View all labs"));
}
function arcCards(){
  const list = sorted(), n = Math.max(list.length, total()), cards=[];
  for (let k=0;k<n;k++){
    const d = list[k];
    if (!d || !ready(d)){
      cards.push(h("div",{class:"card3d ghost","aria-hidden":"true"},h("div",{class:"ph"},h("b",{},"Lab "+pad(d?str(d.num):k+1)+"\ncoming soon"))));
      continue;
    }
    const cov = coverOf(d), v = videoInfo(d.video);
    cards.push(h("button",{class:"card3d",type:"button","aria-label":"Lab "+(str(d.num)||k+1)+": "+str(d.title),
      onclick:()=>{ S.center=k; location.hash=idOf(d); }},
      cov ? h("img",{src:cov,alt:"",loading:"lazy",referrerpolicy:"no-referrer"}) : h("div",{class:"ph",style:"--c:"+gvar(d.group)},h("b",{},symbolFor(d)),h("i")),
      v ? h("span",{class:"play"},"▶") : null,
      h("span",{class:"tag"},h("small",{},"Lab "+pad(str(d.num)||k+1)),h("span",{},str(d.title)))));
  }
  return cards;
}
function layoutArc(){
  const cards=[...document.querySelectorAll(".card3d")]; const n=cards.length; if(!n) return;
  const sp = Math.min(160, Math.max(82, window.innerWidth*0.12));
  cards.forEach((c,k)=>{
    let o = k - S.center; if (o > n/2) o -= n; if (o < -n/2) o += n;
    const a = Math.abs(o);
    c.style.transform = `translateX(${o*sp}px) translateY(-50%) translateZ(${-a*a*14 - a*30}px) rotateY(${-o*13}deg)`;
    c.style.zIndex = String(100-a);
    c.style.opacity = a>3.5 ? "0" : a>2.5 ? ".55" : "1";
    c.style.pointerEvents = a>3.5 ? "none" : "";
    c.tabIndex = a>3.5 ? -1 : 0;
  });
  const cap=document.getElementById("arc-cap"), d=sorted()[S.center];
  if(cap) cap.textContent = d && ready(d) ? "Lab "+pad(str(d.num))+" · "+str(d.title) : "Lab "+pad(d?str(d.num):S.center+1)+" · coming soon";
}
function step(dir){ const n=document.querySelectorAll(".card3d").length; if(!n) return; S.center=(S.center+dir+n)%n; layoutArc(); }
function restartTimer(){
  clearInterval(S.timer);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  S.timer = setInterval(()=>{ if(!document.hidden && !location.hash.startsWith("#lab-") && !document.querySelector(".stage:hover")) step(1); }, 4500);
}
function hero(){
  const i=S.info, done=S.exps.filter(ready).length;
  const sec = h("header",{class:"hero crt"});
  decor(sec, true);
  sec.append(h("div",{class:"hero-in"},
    nav(),
    h("div",{class:"hero-copy"},
      h("span",{class:"eyebrow",style:"color:rgba(255,255,255,.85)"},str(i.course)||"General Chemistry · Laboratory"),
      h("h1",{},str(i.title)||"Eight experiments,",h("span",{class:"lt"},str(i.title2)||"one semester of chemistry")),
      h("p",{},str(i.intro)||"Videos, data and full write-ups from every laboratory activity we performed this semester."),
      h("div",{class:"cta"},h("a",{class:"pill glass",href:"#about"},"About the report"),
        h("a",{class:"pill lime",href:"#experiments"},"Watch the labs",h("span",{class:"arr"},"↗")))),
    h("div",{class:"stage",id:"stage"},arcCards()),
    h("div",{class:"arc-nav"},
      h("button",{type:"button","aria-label":"Previous experiment",onclick:()=>{step(-1);restartTimer();}},"←"),
      h("span",{id:"arc-cap",class:"mono",style:"min-width:16ch;text-align:center"},""),
      h("button",{type:"button","aria-label":"Next experiment",onclick:()=>{step(1);restartTimer();}},"→")),
    h("p",{class:"arc-nav",style:"margin:10px 0 0"},
      h("span",{},done+" of "+total()+" labs documented"+(str(i.semester)?" · "+i.semester:"")),
      h("span",{class:"stars","aria-hidden":"true"},"★★★★★".slice(0,Math.max(1,Math.round(5*done/total())))))));
  return sec;
}

// ---------- home sections ----------
function strip(){
  const list = sorted().filter(ready);
  const items = list.length ? list.map(d=>[symbolFor(d),str(d.title),d.group]) : Object.entries(GROUPS).map(([k,g])=>[g.name.slice(0,2),g.name,k]);
  const mk = hidden => items.map(([s,t,g])=>h("span",{class:"strip-item",style:"--c:"+gvar(g),"aria-hidden":hidden?"true":null},h("b",{},s),t));
  return h("div",{class:"strip"},h("div",{class:"strip-track"},mk(false),mk(true),items.length<6?[mk(true),mk(true)]:null));
}
function about(){
  const ic = (bg,fg,s)=>{ const x=h("span",{class:"chip-ic",style:`background:${bg};color:${fg}`}); x.append(svg(s)); return x; };
  return h("section",{class:"about inner",id:"about"},
    h("span",{class:"eyebrow"},"About the report"),
    h("h2",{},"A semester of hands-on chemistry, filmed ",ic("var(--sky-2)","#fff",PLAY)," at the bench and written up ",ic("var(--lime)","var(--lime-ink)",DOC),h("span",{class:"lt"}," as complete lab reports")),
    str(S.info.about) ? h("p",{class:"muted pre",style:"max-width:60ch;margin:0"},S.info.about) : null);
}
function bento(){
  const i=S.info, list=S.exps.filter(ready);
  const vids = list.reduce((s,d)=>s+d._vids.length,0);
  const photos = list.reduce((s,d)=>s+photosOf(d).length,0);
  const topics = new Set(list.map(d=>d.group||"other")).size;
  const cover = imgUrl(i.groupPhoto), mem = members();
  const hues = ["--g-acid","--g-redox","--g-organic","--g-stoich","--g-thermo"];
  return h("section",{class:"bento inner",id:"team"},
    h("div",{class:"b-photo crt"}, cover?h("img",{src:cover,alt:"Our lab group",referrerpolicy:"no-referrer"}):null,
      h("div",{class:"w"},h("div",{class:"big-n"},String(list.length)),h("p",{},"Laboratory activities documented, out of "+total()+" this semester."))),
    h("div",{class:"b-gray"},h("span",{class:"lbl"},"Videos recorded"),h("div",{class:"big-n"},String(vids)),
      mem.length?h("div",{class:"avatars"},mem.slice(0,6).map((m,k)=>h("span",{style:"background:var("+hues[k%hues.length]+")",title:m},m.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase()))):null,
      str(i.quote) ? h("blockquote",{},"“"+i.quote+"”",str(i.quoteBy)?h("cite",{},i.quoteBy):null) : h("blockquote",{class:"muted"},mem.join(", "))),
    h("div",{class:"b-lime"},h("span",{class:"lbl"},"Photos captured"),h("div",{},h("div",{class:"big-n"},String(photos)),h("p",{style:"margin-top:8px"},"Stills and photos from the bench, attached to each experiment."))),
    h("div",{class:"b-night"},h("span",{class:"lbl"},"Topics covered"),h("span",{class:"big-n",style:"font-size:44px"},String(topics))));
}
function xcard(d){
  const cov=coverOf(d), v=videoInfo(d.video), done=ready(d);
  const inner=[
    h("div",{class:"thumb"}, cov?h("img",{src:cov,alt:"",loading:"lazy",referrerpolicy:"no-referrer"}):h("div",{class:"ph"},done?symbolFor(d):pad(str(d.num)))),
    h("div",{class:"body"},
      h("div",{class:"meta"},h("span",{},"Lab "+pad(str(d.num)||"0")),h("span",{},fmtDate(d.date))),
      h("h3",{},done?str(d.title):"Coming soon"),
      h("div",{class:"muted",style:"font-size:13px"},h("span",{class:"dot"}),(GROUPS[d.group]||GROUPS.other).name),
      h("div",{class:"badges"},v?h("span",{class:"badge"},"▶ Video"):null,cleanUrl(d.report)?h("span",{class:"badge"},"Report"):null))];
  return done ? h("a",{class:"xcard",href:"#"+idOf(d),style:"--c:"+gvar(d.group)},inner)
              : h("div",{class:"xcard",style:"--c:"+gvar(d.group)+";opacity:.6"},inner);
}
function listSec(){
  const sec = h("section",{class:"inner",id:"experiments"},
    h("div",{class:"sec-h"},h("div",{},h("span",{class:"eyebrow"},"Experiments"),h("h2",{},"All "+total()+" laboratory activities"))));
  if (!S.loaded){ sec.append(h("p",{class:"status"},S.err||"Loading experiments…")); return sec; }
  sec.append(h("div",{class:"list"},sorted().map(xcard)));
  return sec;
}
function footer(){
  const i=S.info;
  const line=[i.section,i.instructor?"Instructor: "+i.instructor:"",i.semester].filter(x=>str(x).trim()).join("\n");
  return h("footer",{class:"foot"},h("div",{class:"inner"},
    h("div",{},h("h3",{},str(i.course)||"General Chemistry · Laboratory"),h("p",{},line||"Semestral laboratory portfolio")),
    h("div",{style:"display:grid;gap:10px;align-content:start;justify-items:start"},
      h("a",{class:"pill lime",href:"#experiments"},"Browse experiments",h("span",{class:"arr"},"↗")))));
}

// ---------- detail ----------
function detail(d){
  const head = h("header",{class:"dhead crt"});
  decor(head, false);
  head.append(h("div",{class:"crumb"},nav()),
    h("div",{class:"row"},
      h("div",{class:"tile",style:"--c:"+gvar(d.group)},h("small",{},pad(str(d.num)||"0")),symbolFor(d)),
      h("div",{style:"min-width:0"},
        h("h1",{},str(d.title)),
        h("div",{class:"sub"},h("span",{},"Lab "+pad(str(d.num)||"0")),h("span",{},(GROUPS[d.group]||GROUPS.other).name),d.date?h("span",{},fmtDate(d.date)):null,str(d.authors).trim()?h("span",{},"By "+d.authors):null),
        str(d.equation).trim()?h("div",{class:"eq"},formula(d.equation)):null)));

  const main=h("div",{style:"min-width:0"}), media=h("div",{class:"media"});
  const clips=d._vids.map(videoInfo).filter(Boolean);
  const stageBox=h("div",{class:"vid"}), openLink=h("a",{class:"vlink",target:"_blank",rel:"noopener"});
  const label=h("b",{}), url=h("small",{class:"muted"});
  const p=h("span",{class:"p"}); p.append(svg('<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'));
  openLink.append(p,h("span",{},label,h("br"),url));
  const tabs=h("div",{class:"clips",role:"tablist","aria-label":"Video clips"});
  function show(ix){
    const v=clips[ix]; stageBox.textContent="";
    if (v.kind==="embed") stageBox.append(h("iframe",{src:v.src,title:"Video clip "+(ix+1)+": "+str(d.title),allow:"autoplay; encrypted-media; picture-in-picture",allowfullscreen:true}));
    if (v.kind==="file") stageBox.append(h("video",{controls:true,preload:"metadata",playsinline:true,src:v.src}));
    stageBox.hidden = v.kind==="link";
    openLink.href=v.open; label.textContent=(clips.length>1?"Clip "+(ix+1)+" of "+clips.length+" · ":"")+(v.kind==="link"?"Watch the experiment video":"Open the video in a new tab"); url.textContent=v.open;
    [...tabs.children].forEach((b,k)=>{ b.setAttribute("aria-selected",String(k===ix)); });
  }
  if (clips.length){
    if (clips.length>1) clips.forEach((v,k)=>{
      const b=h("button",{type:"button",role:"tab",class:"clip",onclick:()=>show(k)});
      if (v.thumb) b.append(h("img",{src:v.thumb,alt:"",loading:"lazy",referrerpolicy:"no-referrer"}));
      b.append(h("span",{},"Clip "+(k+1)));
      tabs.append(b);
    });
    media.append(stageBox, clips.length>1?tabs:null, openLink); show(0);
  } else media.append(h("div",{class:"box"},h("p",{class:"muted",style:"margin:0"},"No video added for this experiment yet.")));
  main.append(media);
  const rep=h("div",{class:"rep"});
  const sec=(k,t,b)=>rep.append(h("h2",{},h("span",{class:"k"},k),t),b);
  const has=f=>lines(d[f]).trim();
  if(has("objective")) sec("01","Objective",paras(d.objective));
  if(has("materials")) sec("02","Materials and reagents",h("p",{class:"pre"},lines(d.materials)));
  if(has("procedure")) sec("03","Procedure",steps(d.procedure));
  if(has("observations")) sec("04","Observations",paras(d.observations));
  if(has("results")) sec("05","Data and results",paras(d.results));
  if(has("conclusion")) sec("06","Conclusion",paras(d.conclusion));
  const photos=photosOf(d);
  if(photos.length) sec("","Photos from the lab",h("div",{class:"photos"},photos.map(p=>h("a",{href:p,target:"_blank",rel:"noopener"},h("img",{src:p,alt:"Lab photo",loading:"lazy",referrerpolicy:"no-referrer"})))));
  if(!rep.childNodes.length) rep.append(h("p",{class:"muted",style:"margin-top:20px"},"The written report for this experiment hasn't been added yet."));
  main.append(rep);

  const side=h("aside",{class:"side"});
  const files=h("div",{class:"box lime"},h("h3",{},"Lab report"));
  const r=cleanUrl(d.report);
  if(r) files.append(h("a",{class:"file",href:r,target:"_blank",rel:"noopener"},h("span",{class:"ic"},/\.pdf(\?|$)/i.test(r)?"PDF":"LINK"),h("span",{},str(d.reportName)||"Open the full report")));
  else files.append(h("p",{style:"margin:0;font-size:14px"},"No report file yet."));
  side.append(files);
  if(has("safety")) side.append(h("div",{class:"box"},h("h3",{},"Safety notes"),h("p",{class:"pre",style:"margin:0;font-size:14px"},lines(d.safety))));
  const list=sorted().filter(ready), ix=list.indexOf(d);
  const nv=h("div",{class:"box"},h("h3",{},"Other labs"));
  [["Previous",list[ix-1]],["Next",list[ix+1]]].forEach(([l,x])=>{ if(x) nv.append(h("a",{class:"file",href:"#"+idOf(x)},h("span",{class:"ic"},symbolFor(x)),h("span",{},l+": "+str(x.title)))); });
  nv.append(h("a",{class:"file",href:"#experiments"},h("span",{class:"ic"},"ALL"),h("span",{},"All experiments")));
  side.append(nv);
  return [head, h("div",{class:"dcols inner"},main,side)];
}

// ---------- render ----------
function render(){
  const root=document.getElementById("root"); root.textContent="";
  const m=location.hash.match(/^#(lab-\d+)$/);
  if (m && S.loaded){
    const d=S.exps.find(x=>idOf(x)===m[1] && ready(x));
    if (d){ document.title=str(d.title)+" · "+(str(S.info.short)||"Chem Lab"); root.append(...detail(d), footer()); return; }
  }
  document.title = str(S.info.short) ? S.info.short+" · Lab Portfolio" : "Chemistry Lab Portfolio";
  if (S.center >= Math.max(S.exps.length,total())) S.center=0;
  root.append(hero(), strip(), about(), bento(), listSec(), footer());
  layoutArc();
}
let lastLab = location.hash.startsWith("#lab-");
window.addEventListener("hashchange",()=>{
  const isLab = location.hash.startsWith("#lab-");
  if (isLab || lastLab || !location.hash) render();
  lastLab = isLab;
  if (isLab || !location.hash) window.scrollTo(0,0);
  else { const el=document.getElementById(location.hash.slice(1)); if(el) el.scrollIntoView(); }
});
let rz; window.addEventListener("resize",()=>{ clearTimeout(rz); rz=setTimeout(layoutArc,120); });
document.addEventListener("keydown",ev=>{
  if(/input|textarea|select/i.test(ev.target.tagName) || !document.getElementById("stage")) return;
  if(ev.key==="ArrowRight"){ step(1); restartTimer(); }
  if(ev.key==="ArrowLeft"){ step(-1); restartTimer(); }
});

// ---------- boot ----------
const started = Date.now();
const loader = document.getElementById("loader");
if (loader && matchMedia("(prefers-reduced-motion: reduce)").matches){ const s=loader.querySelector("svg"); if (s && s.pauseAnimations) s.pauseAnimations(); }
function hideLoader(){
  if (!loader) return;
  setTimeout(()=>{ loader.classList.add("done"); setTimeout(()=>loader.remove(), 600); }, Math.max(0, 1400-(Date.now()-started)));
}
render(); restartTimer();
Promise.all([fetch("data/site.json",{cache:"no-cache"}).then(r=>r.json()), fetch("data/experiments.json",{cache:"no-cache"}).then(r=>r.json())])
  .then(([info, exps])=>{ S.info=info||{}; S.exps=(Array.isArray(exps)?exps:[]).map(normalize); S.loaded=true; render(); hideLoader(); if(location.hash.length>1 && !location.hash.startsWith("#lab-")){ const el=document.getElementById(location.hash.slice(1)); if(el) el.scrollIntoView(); } })
  .catch(err=>{ S.loaded=true; S.err="Couldn't load the content files ("+err.message+"). If you opened index.html directly, run a local server instead (see README)."; render(); hideLoader(); });
})();
