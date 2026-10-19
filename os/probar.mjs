// Uso: node probar.mjs [archivo.html] [modo...]   → recorre todas las vistas en escritorio y celular, junta errores y capturas.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "fs"; import path from "path";
const dir=path.dirname(new URL(import.meta.url).pathname);
const file=path.resolve(process.argv[2]||path.join(dir,"dist.html"));
const modos=process.argv.slice(3).length?process.argv.slice(3):["sinpro","completo"];
const mock=fs.readFileSync(path.join(dir,"mock.js"),"utf8");
const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"}).catch(()=>chromium.launch());
let fallas=0;
for(const modo of modos){for(const [vp,w,h] of [["escritorio",1280,900],["celular",390,844]]){
  const ctx=await browser.newContext({viewport:{width:w,height:h}});const page=await ctx.newPage();const errs=[];
  page.on("pageerror",e=>errs.push("pageerror: "+e.message));page.on("console",m=>{if(m.type()==="error"&&!/fonts\.g|cdnjs|ERR_|net::/.test(m.text()))errs.push("console: "+m.text())});
  await page.route(/^https?:\/\//,r=>r.abort());
  await page.addInitScript(mock);
  await page.goto("file://"+file+"?modo="+modo);await page.waitForTimeout(400);
  const vistas=await page.evaluate(()=>typeof VIEWS!=="undefined"?VIEWS.map(v=>v[0]):[]);
  for(const v of vistas){await page.evaluate(x=>location.hash="#"+x,v);await page.waitForTimeout(220);
    const ov=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    if(ov>2)errs.push(`overflow horizontal ${ov}px en #${v}`);
    await page.screenshot({path:path.join(dir,"out",`${path.basename(file,".html")}-${modo}-${vp}-${v}.png`),fullPage:false});}
  console.log(`[${modo} · ${vp}] vistas: ${vistas.join(", ")} · errores: ${errs.length}`);errs.slice(0,15).forEach(e=>console.log("   - "+e));fallas+=errs.length;await ctx.close()}}
await browser.close();process.exit(fallas?1:0);
