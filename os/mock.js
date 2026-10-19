// Simula window.claude para probar la app fuera de claude.ai.
// Modos (window.__MODO, por query ?modo=): "sinpro" (sin sample ni mcp), "completo" (sample y mcp falsos), "solo" (sin db: vista pública)
(()=>{const modo=(new URLSearchParams(location.search).get("modo"))||"sinpro";
const store=new Map();const subs=new Set();
const now=Date.now();
const seed={"config/main":{igUser:"clausuladigitall",brandId:"7462145"},
 "posts/p1":{id:"p1",title:"Qué revisar antes de firmar un alquiler",format:"carrusel",stage:"revision",slides:[{titulo:"Antes de firmar",texto:"Leé el plazo y el índice"}],caption:"Ejemplo",hashtags:"#ClausulaLegal",cta:"Guardalo",scheduledAt:"",createdAt:now-86400000},
 "posts/p2":{id:"p2",title:"Depósito en garantía",format:"post",stage:"idea",createdAt:now-3600000},
 "reels/r1":{id:"r1",titulo:"¿Un apretón de manos es un contrato?",formato:"personajes",estado:"revision",episodio:"7",articulos:"957 y 1015",orden:3,gancho:"¿Un apretón de manos… es un contrato?",bloques:[{tiempo:"0-3 s",pantalla:"Apretón",voz:"¿Un apretón de manos es un contrato?"}],video:{url:"about:blank",dur:58},caption:"Inciso le vende su bici",hashtags:"#ClausulaLegal",createdAt:now-7200000},
 "reels/r2":{id:"r2",titulo:"La seña",formato:"articulo",estado:"guion",episodio:"9",articulos:"1059 y 1060",orden:9,createdAt:now-9000000},
 "historias/h1":{id:"h1",fecha:new Date().toISOString().slice(0,10),objetivo:"post",estado:"borrador",frames:[{tipo:"encuesta",titulo:"¿Firmaste sin leer?",opciones:"Sí / No"}],createdAt:now},
 "tasks/t1":{id:"t1",texto:"Grabar ep. 9",fecha:new Date().toISOString().slice(0,10),hecho:false,createdAt:now},
 "alertas/a1":{id:"a1",tipo:"recomendacion",titulo:"Faltan reels esta semana",detalle:"Ejemplo",prioridad:"media",origen:"analisis",leida:false,createdAt:now}};
if(modo!=="solo")for(const[k,v]of Object.entries(seed))store.set(k,JSON.parse(JSON.stringify(v)));
const colOf=p=>p.split("/").slice(0,-1).join("/");
const snapDocs=col=>[...store.entries()].filter(([k])=>colOf(k)===col).map(([k,v])=>({id:k.split("/").pop(),data:()=>JSON.parse(JSON.stringify(v)),exists:true}));
const notify=()=>queueMicrotask(()=>subs.forEach(f=>f()));
const query=(col,o={})=>({orderBy:(f,d)=>query(col,{...o,f,d}),limit:n=>query(col,{...o,n}),where:()=>query(col,o),
  get:async()=>({docs:snapDocs(col)}),onSnapshot(cb,err){const run=()=>{let d=snapDocs(col);if(o.f)d.sort((a,b)=>((b.data()[o.f]||0)-(a.data()[o.f]||0))*(o.d==="desc"?1:-1));if(o.n)d=d.slice(0,o.n);cb({docs:d,size:d.length,empty:!d.length})};subs.add(run);setTimeout(run,5);return()=>subs.delete(run)},
  doc:id=>docRef(col+"/"+id)});
const docRef=p=>({id:p.split("/").pop(),get:async()=>({exists:store.has(p),id:p.split("/").pop(),data:()=>store.get(p)}),
  set:async v=>{if(JSON.stringify(v).length>900000)throw{code:"invalid_argument"};store.set(p,JSON.parse(JSON.stringify(v)));window.__writes=(window.__writes||0)+1;notify()},
  update:async v=>{if(!store.has(p))throw{code:"not_found"};store.set(p,{...store.get(p),...JSON.parse(JSON.stringify(v))});window.__writes=(window.__writes||0)+1;notify()},
  delete:async()=>{store.delete(p);notify()},
  onSnapshot(cb){const run=()=>cb({exists:store.has(p),id:p.split("/").pop(),data:()=>JSON.parse(JSON.stringify(store.get(p)||{}))});subs.add(run);setTimeout(run,5);return()=>subs.delete(run)}});
const db=modo==="solo"?null:{doc:docRef,collection:c=>query(c)};
const fakeSample=async(input)=>({text:"Respuesta de prueba",truncated:false});
fakeSample.json=async(input)=>{const s=String(typeof input==="string"?input:JSON.stringify(input));
  if(/array JSON de 5/.test(s))return[{titulo:"Idea 1",formato:"carrusel",slides:[{titulo:"a",texto:"b"}],caption:"c",hashtags:"#a",cta:"x",afirmaciones_a_verificar:[]}];
  if(/frames/.test(s))return{frames:[{tipo:"texto",titulo:"Hola"}],afirmaciones_a_verificar:[]};
  if(/bloques/.test(s))return{titulo:"Guion",gancho:"Gancho",bloques:[{tiempo:"0-3 s",pantalla:"x",voz:"y"}],afirmaciones_a_verificar:[]};
  return{resumen:"ok",alertas:[],observado:[],recomendaciones:[]}};
fakeSample.limits=async()=>({images:false});
const ns={db,user:{id:async()=>"u1",me:async()=>({id:"u1"}),isOwner:()=>true,canEdit:()=>true,can:()=>true,profiles:async()=>({})},
  sample:modo==="completo"?fakeSample:null,
  mcp:modo==="completo"?{listTools:async()=>({servers:[{server:"Metricool Social Media Management",tools:[{name:"x"}],authStatus:"ok"}]}),callTool:async(s,t,a)=>{window.__mcpCalls=(window.__mcpCalls||[]).concat([t]);if(t==="createScheduledPost")throw{code:"tool_error",message:"simulado: no programar en pruebas"};return{payload:{rows:[],data:[]},cache:{storedAt:Date.now()}}},watchTool:()=>()=>{}}:null,
  assets:null,downloads:null,artifact:null,comments:null,room:null,files:null,
  permissions:{state:async()=>({}),request:async()=>({}),manage:async()=>{}}};
window.claude={use:n=>new Promise(r=>setTimeout(()=>r(ns[n]??null),20))};
window.__store=store;})();
