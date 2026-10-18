'use strict';
const $ = id => document.getElementById(id);
const galleryBtn = $('galleryBtn'), cameraBtn = $('cameraBtn'), demoBtn = $('demoBtn');
const canvas = $('resultCanvas'), ctx = canvas.getContext('2d');
const queryInput = $('query'), searchBtn = $('searchBtn'), message = $('message');
const resultActions = $('resultActions'), saveBtn = $('saveBtn'), shareBtn = $('shareBtn');
const offlineBtn = $('offlineBtn'), offlineStatus = $('offlineStatus');
const progressWrap = $('progressWrap'), progressBar = $('progressBar'), progressText = $('progressText');
const OCR_FILES = [
  './vendor/tesseract.min.js', './vendor/worker.min.js', './vendor/lang/eng.traineddata.gz',
  './vendor/core/tesseract-core.wasm.js', './vendor/core/tesseract-core-simd.wasm.js',
  './vendor/core/tesseract-core-lstm.wasm.js', './vendor/core/tesseract-core-simd-lstm.wasm.js'
];
let currentImage = null, currentFileName = 'herramienta', busy = false, ocrWorker = null, matchBoxes = [];
const base = new URL('./', document.baseURI);
const asset = relative => new URL(relative, base).href;
function status(text, mode=''){ message.textContent=text;message.className='message' + (mode?` ${mode}`:''); }
function setBusy(yes){busy=yes;searchBtn.disabled=yes||!currentImage;galleryBtn.disabled=yes;cameraBtn.disabled=yes;demoBtn.disabled=yes;offlineBtn.disabled=yes;queryInput.disabled=yes;}
function progress(text, fraction){progressWrap.hidden=false;progressText.textContent=text;progressBar.style.width=`${Math.max(1,Math.min(100,Math.round(fraction*100)))}%`}
function hideProgress(){progressWrap.hidden=true;progressBar.style.width='0%'}
function sourceFileName(name){return String(name||'herramienta').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,55)||'herramienta'}
async function loadImage(src,label){
 const picture = new Image(); picture.decoding='async';picture.src=src;
 await new Promise((resolve,reject)=>{picture.onload=resolve;picture.onerror=()=>reject(new Error('No se pudo abrir la imagen. Intenta con JPG o PNG.'));});
 const maxSide=2600; const factor=Math.min(1,maxSide/Math.max(picture.naturalWidth,picture.naturalHeight));
 canvas.width=Math.max(1,Math.round(picture.naturalWidth*factor));canvas.height=Math.max(1,Math.round(picture.naturalHeight*factor));
 currentImage=picture;currentFileName=sourceFileName(label);matchBoxes=[];
 drawImage();$('previewWrap').classList.remove('empty');$('emptyPreview').hidden=true;canvas.hidden=false;
 $('imageInfo').hidden=false;$('imageInfo').textContent=`${label} · ${picture.naturalWidth} × ${picture.naturalHeight} píxeles`;
 resultActions.hidden=true;searchBtn.disabled=false;
 status('Fotografía cargada. Escribe un número y pulsa Buscar.');
}
function drawImage(){if(!currentImage)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(currentImage,0,0,canvas.width,canvas.height); const W=canvas.width,H=canvas.height;
 for(const box of matchBoxes){const pad=Math.max(7,(box.y1-box.y0)*.18);const rx=(box.x1-box.x0)/2+pad;const ry=(box.y1-box.y0)/2+pad;const x=(box.x0+box.x1)/2,y=(box.y0+box.y1)/2;
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.strokeStyle='#ef2e37';ctx.lineWidth=Math.max(5,Math.min(13,W*.006));ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor='#fff';ctx.shadowBlur=2;ctx.stroke();ctx.shadowBlur=0;
 }
}
async function loadFile(file){if(!file || busy)return;if(file.type && !file.type.startsWith('image/')){status('Debes elegir un archivo de imagen.','warn');return}const url=URL.createObjectURL(file);try{await loadImage(url,file.name||'foto de herramienta')}catch(err){status(err.message,'error')}finally{URL.revokeObjectURL(url)}}
function wordBoxes(data){if(Array.isArray(data?.words))return data.words;const words=[];for(const block of data?.blocks||[])for(const par of block.paragraphs||[])for(const line of par.lines||[])for(const word of line.words||[])words.push(word);return words;}
const normalize=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
function combinedBox(parts){const all=parts.map(x=>x.bbox).filter(b=>b&&Number.isFinite(b.x0)&&Number.isFinite(b.y0)&&Number.isFinite(b.x1)&&Number.isFinite(b.y1)); if(!all.length)return null;return {x0:Math.min(...all.map(b=>b.x0)),y0:Math.min(...all.map(b=>b.y0)),x1:Math.max(...all.map(b=>b.x1)),y1:Math.max(...all.map(b=>b.y1))};}
function locateMatches(data,target){
 const found=[];const words=wordBoxes(data).filter(w=>w.bbox && normalize(w.text));
 for(const w of words){const token=normalize(w.text);if(!token.includes(target))continue;
   // When available, use character boxes to circle only the matching substring.
   const symbols=Array.isArray(w.symbols)?w.symbols:[];
   if(symbols.length && symbols.map(s=>normalize(s.text)).join('')===token){
    const index=token.indexOf(target); const matched=combinedBox(symbols.slice(index,index+target.length));found.push(matched||w.bbox);
   }else found.push(w.bbox);
 }
 // OCR sometimes splits engraved serial numbers into two neighbouring words.
 for(const line of (data?.lines||[])){
   const ln=(line.words||[]).filter(w=>w.bbox && normalize(w.text));
   for(let i=0;i<ln.length;i++)for(let count=2;count<=4&&i+count<=ln.length;count++){
     const group=ln.slice(i,i+count);const joined=group.map(w=>normalize(w.text)).join('');if(!joined.includes(target))continue;
     const near=group.slice(1).every((w,k)=>{const a=group[k].bbox,b=w.bbox;const h=Math.max(a.y1-a.y0,b.y1-b.y0);return (b.x0-a.x1) < h*.8 && Math.abs((a.y0+a.y1-b.y0-b.y1)/2)<h*.65;});
     if(near)found.push(combinedBox(group));
   }
 }
 return found.filter((b,i,arr)=>b&&arr.findIndex(a=>a&&Math.abs(a.x0-b.x0)<4&&Math.abs(a.y0-b.y0)<4&&Math.abs(a.x1-b.x1)<4&&Math.abs(a.y1-b.y1)<4)===i);
}
async function getWorker(){
 if(ocrWorker)return ocrWorker;
 if(!window.Tesseract?.createWorker)throw new Error('No está instalado el motor OCR. En Windows ejecuta preparar_ocr.bat antes de publicar la aplicación.');
 progress('Cargando motor OCR…',.1);
 ocrWorker=await Tesseract.createWorker('eng',1,{
  workerPath:asset('./vendor/worker.min.js'),
  corePath:asset('./vendor/core'),
  langPath:asset('./vendor/lang'),
  workerBlobURL:false,
  logger:m=>{if(m?.status){const p=Number(m.progress||0);progress('OCR: '+m.status.replace(/_/g,' ')+'…', .12+.75*p)}}
 });
 await ocrWorker.setParameters({tessedit_char_whitelist:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-'});
 return ocrWorker;
}
async function search(){
 const target=normalize(queryInput.value);
 if(!currentImage){status('Primero selecciona una fotografía.','warn');return}
 if(!target){status('Escribe el número que quieres localizar.','warn');return}
 if(busy)return;
 setBusy(true);matchBoxes=[];drawImage();resultActions.hidden=true;
 try{progress('Preparando reconocimiento…',.06);status('Analizando la fotografía…');const worker=await getWorker();
  progress('Leyendo los números de la imagen…',.84);
  const res=await worker.recognize(canvas);
  matchBoxes=locateMatches(res.data,target);drawImage();
  if(matchBoxes.length){status(`Encontradas ${matchBoxes.length} coincidencia${matchBoxes.length===1?'':'s'} de “${target}”. Aparecen marcadas en rojo.`,'good');resultActions.hidden=false;}
  else status(`No se encontró “${target}”. Prueba con una fotografía más cerca, bien iluminada y sin reflejos.`,'warn');
 }catch(err){console.error('CoatingScan OCR',err);status('No se pudo iniciar el OCR. Revisa que hayas ejecutado preparar_ocr.bat, publicado todos los archivos y preparado el modo sin conexión. Detalle: '+String(err.message||err),'error')}
 finally{hideProgress();setBusy(false)}
}
function outputBlob(){return new Promise(resolve=>canvas.toBlob(blob=>resolve(blob),'image/png'))}
async function save(){if(!currentImage)return;const blob=await outputBlob();if(!blob){status('No se pudo guardar la imagen.','error');return};const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${currentFileName}_marcada.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);status('Imagen preparada para descargar. En iPhone revisa Descargas o Archivos.','good')}
async function share(){const blob=await outputBlob();if(!blob)return;const file=new File([blob],`${currentFileName}_marcada.png`,{type:'image/png'});try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'CoatingScan – Imagen marcada'});return}await save()}catch(e){if(e.name!=='AbortError')status('No se pudo compartir. Prueba Guardar imagen.','warn')}}
async function getCacheReady(){
 if(!('caches' in window))return false;
 const urls=OCR_FILES.map(asset);
 const matches=await Promise.all(urls.map(u=>caches.match(u)));
 return matches.every(Boolean);
}
async function refreshOffline(){const ready=await getCacheReady().catch(()=>false);offlineStatus.textContent=ready?'Motor OCR guardado. Puedes usarlo sin internet en este iPhone.':'Todavía no se han guardado todos los componentes del OCR.';offlineBtn.textContent=ready?'Actualizar archivos sin conexión':'Preparar modo sin conexión'}
async function prepareOffline(){if(busy)return;if(!('serviceWorker' in navigator)||!('caches' in window)){status('Tu navegador no permite preparar el modo sin conexión. Ábrelo en Safari desde una dirección HTTPS.','warn');return}if(!navigator.serviceWorker.controller){status('Instalando servicio sin conexión. Espera unos segundos y vuelve a pulsar Preparar.','warn');await navigator.serviceWorker.ready;return}
 offlineBtn.disabled=true;try{const cache=await caches.open('coatingscan-ocr-v1');let count=0;
 for(const path of OCR_FILES){const url=asset(path);if(!(await cache.match(url))){progress(`Guardando archivos OCR (${count+1}/${OCR_FILES.length})…`,(count+.2)/OCR_FILES.length);const response=await fetch(url,{cache:'reload'});if(!response.ok)throw new Error(`Falta ${path} (HTTP ${response.status})`);await cache.put(url,response)}count++;progress(`Archivos guardados: ${count} de ${OCR_FILES.length}`,count/OCR_FILES.length)}
 await refreshOffline();status('Archivos del OCR guardados en este dispositivo. Prueba desconectando Wi-Fi y datos móviles.','good');
 }catch(err){status('No se completó la preparación sin conexión: '+err.message,'error')}finally{offlineBtn.disabled=false;hideProgress()}}

galleryBtn.addEventListener('click',()=> $('galleryInput').click());cameraBtn.addEventListener('click',()=> $('cameraInput').click());
$('galleryInput').addEventListener('change',ev=>{const file=ev.target.files?.[0];loadFile(file);ev.target.value=''});
$('cameraInput').addEventListener('change',ev=>{const file=ev.target.files?.[0];loadFile(file);ev.target.value=''});
demoBtn.addEventListener('click',async()=>{if(busy)return;try{await loadImage(asset('./img/demo-0926.png'),'foto_prueba_0926.png');queryInput.value='0926'}catch(e){status('No se cargó la imagen de ejemplo.','error')}});
searchBtn.addEventListener('click',search);queryInput.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!busy){ev.preventDefault();search()}});
queryInput.addEventListener('input',()=>{if(currentImage){matchBoxes=[];drawImage();resultActions.hidden=true}});
saveBtn.addEventListener('click',save);shareBtn.addEventListener('click',share);offlineBtn.addEventListener('click',prepareOffline);
if('serviceWorker' in navigator && ['https:','http:'].includes(location.protocol)){
 navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).then(()=>refreshOffline()).catch(()=>{offlineStatus.textContent='El modo sin conexión requiere HTTPS.'});
 navigator.serviceWorker.addEventListener('controllerchange',refreshOffline);
}else offlineStatus.textContent='Publica la app con HTTPS para instalarla en el iPhone.';
refreshOffline();
