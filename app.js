import React,{useState,useEffect,useLayoutEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
const h=React.createElement;
const fmt=(value,digits=2)=>value==null?'—':Number(value).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const INITIAL={shape:'normal',sample_size:5,statistic:'mean',seed:42,comparison_statistic:'none',comparison_size:25};
const STATS=[['mean','Mean','means'],['median','Median','medians'],['sd','Standard deviation (N)','standard deviations'],['variance','Variance (N)','variances'],['variance_unbiased','Variance (N − 1)','unbiased variances'],['mad','Mean absolute deviation','mean absolute deviations'],['range','Range','ranges']];
const statLabel=id=>STATS.find(s=>s[0]===id)?.[1]||'None';
const statPlural=id=>STATS.find(s=>s[0]===id)?.[2]||'statistics';
const SHAPES=[
{id:'normal',name:'Normal',hint:'Symmetric & bell-shaped',path:'M2 27 C12 27 12 4 22 4 S32 27 42 27'},
{id:'uniform',name:'Uniform',hint:'Every value, equal chance',path:'M2 27 L5 27 L5 6 L39 6 L39 27 L42 27'},
{id:'skewed',name:'Right-skewed',hint:'A long tail to the right',path:'M2 27 L5 4 C12 4 10 23 25 25 S36 27 42 27'},
{id:'bimodal',name:'Bimodal',hint:'Two distinct peaks',path:'M2 27 C7 27 6 5 12 5 S17 25 22 25 S26 5 32 5 S36 27 42 27'},
];
const PATHS={sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',moon:'M20.5 13a8.5 8.5 0 1 1-9.5-9.5A6.5 6.5 0 0 0 20.5 13Z',monitor:'M3 4h18v12H3V4Zm9 12v4m-5 0h10',play:'m9 5 11 7-11 7V5Z',reset:'M3 10a9 9 0 1 1 1 8M3 4v6h6',code:'m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18',close:'m6 6 12 12M6 18 18 6',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',info:'M12 11v6m0-10v.1',check:'m5 12 4 4L19 6',plus:'M12 5v14M5 12h14',chevron:'m9 5 7 7-7 7',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',pencil:'m14 5 5 5M4 20l4-1L21 6a2 2 0 0 0-3-3L5 16l-1 4Z'};
function Icon({name,size=18,...props}){return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,...props},h('path',{d:PATHS[name]||PATHS.info}));}
function ShapeIcon({shape}){return h('svg',{viewBox:'0 0 44 32',width:44,height:32,fill:'none','aria-hidden':true},h('path',{d:shape.path,stroke:'currentColor',strokeWidth:2.1,strokeLinecap:'round',strokeLinejoin:'round'}));}
function Toggle({checked,onChange,label,disabled=false}){return h('label',{className:'toggle-label'},h('input',{type:'checkbox',checked,onChange:e=>onChange(e.target.checked),disabled}),h('span',{className:'switch','aria-hidden':true}),h('span',null,label));}


// Graph geometry animates with native transforms; Python results remain exact.
function MotionRect({motion=true,...props}){
  const element=useRef(null),previous=useRef(null),animation=useRef(null);
  useLayoutEffect(()=>{
    const node=element.current,old=previous.current;
    previous.current={y:props.y,height:props.height};
    if(!motion||props.className?.includes('dropping')||matchMedia('(prefers-reduced-motion: reduce)').matches){animation.current?.cancel();return}
    if(props.height<=0||old&&old.y===props.y&&old.height===props.height)return;
    let origin=old||{y:props.y+props.height,height:0};
    if(animation.current?.playState==='running'&&old){
      const transform=new DOMMatrix(getComputedStyle(node).transform);
      origin={y:old.y+transform.f,height:old.height*transform.d};
    }
    animation.current?.cancel();
    animation.current=node.animate([
      {transform:'translateY('+(origin.y-props.y)+'px) scaleY('+Math.max(.001,origin.height/props.height)+')'},
      {transform:'translateY(0) scaleY(1)'}
    ],{duration:480,easing:'cubic-bezier(.22,1,.36,1)'});
  },[props.y,props.height,motion,props.className?.includes('dropping')]);
  useEffect(()=>()=>animation.current?.cancel(),[]);
  return h('rect',{...props,ref:element});
}
function glassPointer(event){
  if(event.pointerType==='touch')return;
  const surface=event.target.closest?.('.chart-card,.controls');
  if(!surface)return;
  const bounds=surface.getBoundingClientRect();
  surface.style.setProperty('--glass-x',((event.clientX-bounds.left)/bounds.width*100).toFixed(1)+'%');
  surface.style.setProperty('--glass-y',((event.clientY-bounds.top)/bounds.height*100).toFixed(1)+'%');
}

function BlockHistogram({counts,maximum=100,color='blue',height=160,ceiling=null,label,empty,curve=null,marker=null,fallingBin=null,editable=false,onPointerDown,onPointerMove,onPointerUp,onKeyDown}){
  const W=900,H=height,L=42,R=18,T=23,B=27,PW=W-L-R,PH=H-T-B;
  const curvePoints=[];
  const total=counts.reduce((a,b)=>a+b,0);
  if(curve&&curve.sd>0&&total)for(let i=0;i<=400;i++){
    const value=i/400*maximum;
    const density=Math.exp(-.5*((value-curve.mean)/curve.sd)**2)/(curve.sd*Math.sqrt(2*Math.PI));
    curvePoints.push([value,density*(maximum/counts.length)*total]);
  }
  const ymax=ceiling||Math.max(6,...counts,...curvePoints.map(p=>p[1]))*1.14;
  const x=value=>L+value/maximum*PW,y=count=>H-B-count/ymax*PH;
  const cell=PH/ymax,barWidth=PW/counts.length;
  const blocks=counts.flatMap((count,i)=>{
    if(cell>=2&&Number.isInteger(count)&&count<=150){
      return Array.from({length:count},(_,row)=>h(MotionRect,{motion:!ceiling,key:i+'-'+row,x:L+i*barWidth+1.1,y:y(row+1)+.65,width:barWidth-2.2,height:Math.max(.5,cell-1.3),rx:1.2,className:`hist-block ${color}${fallingBin===i&&row===count-1?' dropping':''}`}));
    }
    return [h(MotionRect,{motion:!ceiling,key:'bar'+i,x:L+i*barWidth+1.1,y:y(count),width:barWidth-2.2,height:Math.max(0,count/ymax*PH),rx:1.3,className:`hist-block aggregate ${color}`}),fallingBin===i&&count>0?h('rect',{key:'fall'+i,x:L+i*barWidth+1.1,y:y(count),width:barWidth-2.2,height:Math.max(.5,cell),rx:.5,className:`hist-block ${color} dropping`}):null];
  });
  const path=curvePoints.map(([value,count],i)=>`${i?'L':'M'}${x(value).toFixed(2)},${y(count).toFixed(2)}`).join(' ');
  const tickValues=ceiling?[0,10,20]:[0,Math.floor(ymax/2),Math.floor(ymax)];
  return h('div',{className:'block-chart'+(editable?' editable':''),style:{'--drop-distance':(-PH)+'px'}},
    h('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':label,className:'block-svg',onPointerDown,onPointerMove,onPointerUp,onPointerCancel:onPointerUp},h('title',null,label),
      tickValues.map((tick,i)=>h('g',{key:'g'+i},h('line',{x1:L,y1:y(tick),x2:W-R,y2:y(tick),className:'grid-line'}),h('text',{x:L-10,y:y(tick)+4,textAnchor:'end',className:'axis-text'},tick.toLocaleString()))),
      blocks,
      curve&&total>0&&h('path',{d:path,className:'normal-curve'}),
      marker!=null&&h('g',null,h('line',{x1:x(marker),x2:x(marker),y1:T-3,y2:H-B,className:'mean-line'}),h('text',{x:x(marker),y:T-9,textAnchor:'middle',className:'mean-label'},'μ '+fmt(marker,1))),
      [0,.25,.5,.75,1].map(f=>h('text',{key:f,x:x(maximum*f),y:H-8,textAnchor:'middle',className:'axis-text'},fmt(maximum*f,maximum%4?1:0))),
      h('line',{x1:L,y1:H-B,x2:W-R,y2:H-B,className:'baseline'}),
      editable&&counts.map((value,i)=>h('rect',{key:'edit'+i,x:L+i*barWidth,y:T,width:barWidth,height:PH,fill:'transparent',role:'slider',tabIndex:0,'aria-label':`Population bar at ${fmt(1.25+2.5*i,2)}`,'aria-valuemin':0,'aria-valuemax':20,'aria-valuenow':value,onKeyDown:e=>onKeyDown?.(e,i)}))
    ),
    empty&&h('div',{className:'chart-empty'},h('span',null,empty))
  );
}
function PopulationEditor({population,customWeights,disabled,onStart,onCommit}){
  const fromPopulation=()=>customWeights||(()=>{const p=population?.probabilities||Array(40).fill(0),max=Math.max(...p,1e-12);return p.map(w=>Math.round(w/max*15))})();
  const [draft,setDraft]=useState(fromPopulation);
  const painting=useRef(false),weights=useRef(draft),last=useRef(null);
  useEffect(()=>{if(!painting.current){const next=fromPopulation();weights.current=next;setDraft(next)}},[population,customWeights]);
  function paint(e){
    const rect=e.currentTarget.getBoundingClientRect();
    const sx=(e.clientX-rect.left)/rect.width*900,sy=(e.clientY-rect.top)/rect.height*174;
    const index=Math.max(0,Math.min(39,Math.floor((sx-42)/(840/40))));
    const value=Math.max(0,Math.min(20,Math.round((147-sy)/124*20)));
    const next=[...weights.current];
    if(last.current){const [priorIndex,priorValue]=last.current;const start=Math.min(index,priorIndex),end=Math.max(index,priorIndex);for(let i=start;i<=end;i++)next[i]=index===priorIndex?value:Math.round(priorValue+(value-priorValue)*(i-priorIndex)/(index-priorIndex))}
    next[index]=value;last.current=[index,value];weights.current=next;setDraft(next);
  }
  function end(e){if(!painting.current)return;painting.current=false;last.current=null;if(e.currentTarget.hasPointerCapture?.(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);onCommit([...weights.current]);}
  function key(e,index){if(disabled||!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const next=[...draft];next[index]=e.key==='Home'?0:e.key==='End'?20:Math.max(0,Math.min(20,next[index]+(e.key==='ArrowUp'?1:-1)));setDraft(next);weights.current=next;onCommit(next);}
  return h(BlockHistogram,{counts:draft,color:'blue',height:174,ceiling:20,label:'Editable parent population. Drag to change bar heights, or focus a bar and use the arrow keys.',marker:painting.current?null:population?.mean,editable:!disabled,
    onPointerDown:e=>{if(disabled||e.button!==0)return;e.preventDefault();painting.current=true;last.current=null;e.currentTarget.setPointerCapture(e.pointerId);onStart();paint(e)},
    onPointerMove:e=>{if(painting.current)paint(e)},onPointerUp:end,onKeyDown:key});
}
function countSample(sample){const counts=Array(40).fill(0);for(const value of sample)counts[Math.min(39,Math.floor(value/2.5))]++;return counts;}
function SummaryStrip({summary,observations=null,showHigher=false}){
  return h('div',{className:'summary-strip'},observations!=null&&h('span',null,'Observations ',h('b',null,observations)),[['Mean',summary?.mean],['Median',summary?.median],['SD',summary?.sd],...(showHigher?[['Skew',summary?.skew],['Excess kurtosis',summary?.kurtosis]]:[])].map(([label,value])=>h('span',{key:label},label+' ',h('b',null,fmt(value)))));
}
function DistributionCard({distribution,population,secondary=false,curveVisible,onCurveChange,fallingBin=null,enabled=true,busy=false,onEnable}){
  const meanMode=distribution?.statistic==='mean';
  const plural=statPlural(distribution?.statistic);
  const theoretical=meanMode&&population?{mean:population.mean,sd:distribution.theoretical_se}:null;
  return h('article',{className:'chart-card stacked-card distribution-card'+(secondary?' comparison-card':'')},
    h('div',{className:'card-heading'},h('h2',null,enabled?'Distribution of '+plural:'Comparison'),
      enabled?h('div',{className:'distribution-heading-right'},h('span',{className:'chart-badge '+(secondary?'mint':'indigo')},'n = '+distribution.sample_size),h('div',{className:'sample-counter','aria-live':'polite'},h('strong',null,(distribution.repetitions||0).toLocaleString()),h('span',null,'samples'))):h('span',{className:'chart-badge neutral'},'Off')
    ),
    enabled?h(React.Fragment,null,
      h(BlockHistogram,{counts:distribution?.histogram||Array(50).fill(0),maximum:distribution?.maximum||100,color:secondary?'mint':'indigo',height:175,curve:curveVisible?theoretical:null,marker:meanMode?population?.mean:null,fallingBin,label:`${secondary?'Comparison':'Primary'} distribution of ${plural} from ${distribution?.repetitions||0} samples`,empty:!distribution?.repetitions?'No samples':null}),
      h('div',{className:'distribution-lower'},h('div',{className:'distribution-summary'},h('span',null,'Center ',h('b',null,fmt(distribution?.center))),h('span',null,meanMode?'Observed SE ':'Observed SD ',h('b',null,fmt(distribution?.spread))),meanMode&&h('span',null,'σ / √n ',h('b',null,fmt(distribution?.theoretical_se)))),
        meanMode&&h(Toggle,{checked:curveVisible,onChange:onCurveChange,label:'Normal reference'})),
      h('span',{className:'sr-only'},'Vertical axis: sample count. Large counts merge blocks into bars.')
    ):h('div',{className:'comparison-empty'},h('button',{onClick:onEnable,disabled:busy},h(Icon,{name:'plus',size:16}),'Add comparison'))
  );
}

function App(){
  const [config,setConfig]=useState(INITIAL),[sizeDraft,setSizeDraft]=useState(INITIAL.sample_size);
  const [data,setData]=useState(null),[ready,setReady]=useState(false),[loadingText,setLoadingText]=useState('Loading engine…');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[painting,setPainting]=useState(false),[phase,setPhase]=useState('idle');
  const [animate,setAnimate]=useState(true),[showCurve,setShowCurve]=useState(false),[comparisonCurve,setComparisonCurve]=useState(false);
  const [batch,setBatch]=useState(1000),[toast,setToast]=useState(''),[retry,setRetry]=useState(0);
  const [visibleSample,setVisibleSample]=useState([]),[sampleSummary,setSampleSummary]=useState(null),[sampleFor,setSampleFor]=useState('primary'),[falling,setFalling]=useState(null);
  const worker=useRef(null),pending=useRef(new Map()),nextId=useRef(0),epoch=useRef(0),lock=useRef(false),toastTimer=useRef(null);
  const [themeMode,setThemeMode]=useState(()=>{try{return localStorage.getItem('examplesample-theme')||'system'}catch{return 'system'}});
  useEffect(()=>{
    const preference=matchMedia('(prefers-color-scheme: dark)');
    const apply=()=>{const resolved=themeMode==='system'?(preference.matches?'dark':'light'):themeMode;document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved};
    apply();try{localStorage.setItem('examplesample-theme',themeMode)}catch{}
    preference.addEventListener('change',apply);return()=>preference.removeEventListener('change',apply);
  },[themeMode]);
  const themeTransition=useRef(null);
  function changeTheme(mode){
    const apply=()=>{const resolved=mode==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):mode;document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved;setThemeMode(mode)};
    themeTransition.current?.skipTransition();
    if(document.startViewTransition&&!matchMedia('(prefers-reduced-motion: reduce)').matches)themeTransition.current=document.startViewTransition(apply);
    else apply();
  }
  function notify(text){setToast(text);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),4000)}
  function request(request){return new Promise((resolve,reject)=>{const id=++nextId.current;const timer=setTimeout(()=>{pending.current.delete(id);reject(Error('Python took too long to respond. Reload the engine and try again.'))},60000);pending.current.set(id,{resolve,reject,timer});worker.current.postMessage({id,request})})}
  useEffect(()=>{
    setError('');setReady(false);setLoadingText('Loading engine…');
    const instance=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});worker.current=instance;
    const loadTimer=setTimeout(()=>setError('Python could not finish loading. Check your connection, then retry.'),90000);
    instance.onmessage=({data:message})=>{
      if(message.type==='status')setLoadingText('Loading engine…');
      if(message.type==='ready'){clearTimeout(loadTimer);setError('');setReady(true)}
      if(message.type==='fatal'){clearTimeout(loadTimer);setError(message.message)}
      if(message.id){const task=pending.current.get(message.id);if(task){clearTimeout(task.timer);pending.current.delete(message.id);message.type==='error'?task.reject(Error(message.message)):task.resolve(message.result)}}
    };
    instance.onerror=e=>{clearTimeout(loadTimer);setError(e.message||'The Python engine could not load. Check your connection.')};
    return()=>{clearTimeout(loadTimer);instance.terminate();for(const task of pending.current.values()){clearTimeout(task.timer);task.reject(Error('Engine restarted'))}pending.current.clear()};
  },[retry]);
  useEffect(()=>{
    if(!ready)return;let current=true;epoch.current++;lock.current=true;setBusy(true);setData(null);setVisibleSample([]);setSampleSummary(null);setSampleFor('primary');setFalling(null);setPhase('idle');
    request({action:'reset',config}).then(result=>{if(current){setData(result);setError('')}}).catch(e=>{if(current)setError(e.message)}).finally(()=>{if(current){setBusy(false);lock.current=false}});
    return()=>{current=false};
  },[ready,config]);
  useEffect(()=>{setSizeDraft(config.sample_size)},[config.sample_size]);
  useEffect(()=>()=>clearTimeout(toastTimer.current),[]);
  function changeConfig(patch){if(lock.current)return;setConfig(old=>({...old,...patch}))}
  function commitPopulation(weights){
    lock.current=false;setPainting(false);
    if(!weights.some(w=>w>0)){notify('Keep at least one bar above zero. Your previous population has been restored.');setConfig(old=>({...old}));return}
    setConfig(old=>({...old,shape:'custom',custom_weights:weights}));
  }
  async function draw(repetitions=1){
    if(lock.current||!ready||!data)return;
    if(repetitions>data.remaining){notify('That batch exceeds the 100,000-sample limit. Choose a smaller batch or clear the samples.');return}
    lock.current=true;setBusy(true);setError('');const token=epoch.current;
    try{
      const result=await request({action:'run',repetitions});if(token!==epoch.current)return;
      const shouldAnimate=animate&&repetitions===1&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(shouldAnimate){
        const displaySample=async(snapshot,which)=>{
          setSampleFor(which);setVisibleSample([]);setSampleSummary(null);setPhase('drawing');setFalling(null);
          const values=snapshot.latest_sample,delay=values.length<=10?300:Math.max(30,Math.min(100,1800/values.length));
          for(let i=0;i<values.length;i++){if(token!==epoch.current)return false;setVisibleSample(values.slice(0,i+1));setFalling({chart:'sample',bin:Math.min(39,Math.floor(values[i]/2.5))});await wait(delay)}
          await wait(300);if(token!==epoch.current)return false;
          setSampleSummary(snapshot.sample_summary);setPhase('collecting');
          setFalling({chart:which,bin:Math.min(49,Math.floor(snapshot.latest_statistic/snapshot.maximum*50))});return true;
        };
        if(!await displaySample(result,'primary'))return;
        setData({...result,comparison:data.comparison});await wait(550);
        if(config.comparison_statistic!=='none'){
          if(!await displaySample(result.comparison,'comparison'))return;
          setData(result);await wait(550);
        }
      }else{
        const last=config.comparison_statistic!=='none'?result.comparison:result;
        setSampleFor(config.comparison_statistic!=='none'?'comparison':'primary');setVisibleSample(last.latest_sample);setSampleSummary(last.sample_summary);
      }
      if(token===epoch.current){setData(result);setFalling(null);setPhase('idle')}
    }catch(e){setError(e.message)}finally{if(token===epoch.current){lock.current=false;setBusy(false);setPhase('idle')}}
  }
  async function exportCSV(){
    if(lock.current||!data?.repetitions)return;lock.current=true;setBusy(true);
    try{const result=await request({action:'export'});const url=URL.createObjectURL(new Blob([result.csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`examplesample-${config.shape}-n${config.sample_size}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('CSV exported')}
    catch(e){setError(e.message)}finally{lock.current=false;setBusy(false)}
  }
  function reset(){if(lock.current)return;setConfig(old=>({...old}));notify('Samples cleared')}
  const disabled=!ready||busy||painting||!data;
  const population=data?.population;
  const shapeName=SHAPES.find(shape=>shape.id===config.shape)?.name||'Hand-drawn';
  const shownN=sampleFor==='comparison'?config.comparison_size:config.sample_size;
  const statusText=error?'Engine needs attention':!ready?loadingText:painting?'Editing population…':busy?(phase==='drawing'?'Dropping observations…':phase==='collecting'?'Dropping the statistic…':'Calculating…'):'Ready';
  return h(React.Fragment,null,
    h('a',{href:'#simulator',className:'skip-link'},'Skip to graphs'),
    h('header',{className:'site-header'},h('div',{className:'nav-inner'},
      h('a',{className:'brand',href:'#','aria-label':'examplesample home'},'examplesample'),
      h('div',{className:'theme-control',role:'group','aria-label':'Appearance',style:{'--theme-index':['system','light','dark'].indexOf(themeMode)}},
        [['system','monitor','Use system theme'],['light','sun','Use light theme'],['dark','moon','Use dark theme']].map(([mode,icon,label])=>h('button',{key:mode,'aria-label':label,'aria-pressed':themeMode===mode,title:label,onClick:()=>changeTheme(mode)},h(Icon,{name:icon,size:17})))
      )
    )),
    h('main',{className:'page-shell',onPointerMove:glassPointer},
      h('div',{className:'page-heading'},h('h1',null,'Sampling Distributions'),h('div',{className:'utility-actions'},
        h('button',{onClick:reset,disabled},h(Icon,{name:'reset',size:16}),'Clear samples'),
        h('button',{onClick:exportCSV,disabled:disabled||!data?.repetitions},h(Icon,{name:'download',size:16}),'Export CSV')
      )),
      h('section',{id:'simulator',className:'studio','aria-label':'Sampling distribution simulator'},
        h('aside',{className:'controls'},
          h('div',{className:'controls-heading'},h('h2',null,'Parameters')),
          h('fieldset',{disabled:busy||painting,className:'control-group'},h('legend',null,'Population'),h('div',{className:'shape-grid'},SHAPES.map(shape=>h('button',{key:shape.id,type:'button',className:'shape-button'+(config.shape===shape.id?' selected':''),'aria-pressed':config.shape===shape.id,onClick:()=>changeConfig({shape:shape.id,custom_weights:undefined}),title:shape.hint},h(ShapeIcon,{shape}),h('span',null,shape.name))))),
          h('fieldset',{disabled:busy||painting,className:'control-group size-group'},h('legend',null,'Sample size',h('output',{htmlFor:'sample-size'},sizeDraft)),
            h('input',{id:'sample-size',type:'range',min:2,max:100,value:sizeDraft,'aria-label':'Primary sample size',onChange:e=>setSizeDraft(Number(e.target.value)),onPointerUp:e=>changeConfig({sample_size:Number(e.currentTarget.value)}),onKeyUp:e=>changeConfig({sample_size:Number(e.currentTarget.value)}),onBlur:e=>{if(Number(e.currentTarget.value)!==config.sample_size)changeConfig({sample_size:Number(e.currentTarget.value)})},style:{'--range-fill':((sizeDraft-2)/98*100)+'%'}}),
            h('div',{className:'presets'},[2,5,10,25,50].map(n=>h('button',{key:n,className:config.sample_size===n?'active':'',onClick:()=>changeConfig({sample_size:n}),'aria-label':`Sample size ${n}`},n)))
          ),
          h('fieldset',{disabled:busy||painting,className:'control-group statistic-group'},h('legend',null,'Statistic'),h('div',{className:'select-wrap'},h('select',{'aria-label':'Primary statistic',value:config.statistic,onChange:e=>changeConfig({statistic:e.target.value})},STATS.map(([id,label])=>h('option',{key:id,value:id},label))))),
          h('fieldset',{disabled:busy||painting,className:'control-group comparison-controls'},h('legend',null,'Comparison'),h('div',{className:'select-wrap'},h('select',{'aria-label':'Comparison statistic',value:config.comparison_statistic,onChange:e=>changeConfig({comparison_statistic:e.target.value})},h('option',{value:'none'},'None'),STATS.map(([id,label])=>h('option',{key:id,value:id},label)))),config.comparison_statistic!=='none'&&h('label',{className:'comparison-size'},'Sample size',h('input',{type:'number',min:2,max:100,value:config.comparison_size,'aria-label':'Comparison sample size',onChange:e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=2&&n<=100)changeConfig({comparison_size:n})}}))),
          h('div',{className:'run-controls'},
            h('button',{className:'primary-button',disabled:disabled||!data?.remaining,onClick:()=>draw(1)},h(Icon,{name:'play',size:17}),phase!=='idle'?'Sampling…':'Draw a sample'),
            h('div',{className:'batch-row'},h('button',{className:'batch-button',disabled:disabled||!data?.remaining,onClick:()=>draw(batch)},h(Icon,{name:'plus',size:16}),'Run batch'),h('label',{className:'batch-select'},h('span',{className:'sr-only'},'Batch repetitions'),h('select',{value:batch,onChange:e=>setBatch(Number(e.target.value)),disabled:busy},[5,100,1000,10000,100000].map(n=>h('option',{key:n,value:n},n.toLocaleString()))))),
            h(Toggle,{checked:animate,onChange:setAnimate,label:'Animate samples',disabled:busy||painting})
          ),
          h('details',{className:'advanced'},h('summary',null,'Random seed',h('span',null,config.seed)),h('label',{htmlFor:'seed-input',className:'sr-only'},'Random seed'),h('input',{id:'seed-input',type:'number',min:0,max:999999,value:config.seed,disabled:busy||painting,onChange:e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=999999)changeConfig({seed:n})}})),
          h('div',{className:'engine-status'+(error?' has-error':''),role:'status'},h('span',{className:ready&&!error?'status-light':'status-spinner'}),h('span',null,statusText)),
          error&&h('div',{className:'error-box',role:'alert'},h('p',null,error),h('button',{onClick:()=>{epoch.current++;lock.current=false;setBusy(false);setRetry(v=>v+1)}},'Reload engine'))
        ),
        h('div',{className:'workspace graph-stack'},
          h('article',{className:'chart-card stacked-card parent-card'},
            h('div',{className:'card-heading'},h('h2',null,'Parent population'),h('div',{className:'parent-tools'},h('span',{className:'edit-instruction'},h(Icon,{name:'pencil',size:14}),'Drag to edit'),h('span',{className:'chart-badge blue'},painting?'Editing…':shapeName))),
            h(PopulationEditor,{population,customWeights:config.shape==='custom'?config.custom_weights:null,disabled:busy||!ready,onStart:()=>{lock.current=true;setPainting(true)},onCommit:commitPopulation}),
            h(SummaryStrip,{summary:population,showHigher:true})
          ),
          h('article',{className:'chart-card stacked-card sample-data-card'+(phase==='drawing'?' is-drawing':'')},
            h('div',{className:'card-heading'},h('h2',null,'Sample data'),h('div',{className:'sample-source'},h('span',{className:'sample-source-label'},sampleFor==='comparison'?'Comparison':'Primary'),h('span',{className:'chart-badge amber'},'n = '+shownN))),
            h(BlockHistogram,{counts:countSample(visibleSample),color:'amber',height:145,fallingBin:falling?.chart==='sample'?falling.bin:null,label:`Sample data histogram: ${visibleSample.length} observations`,empty:!visibleSample.length?'No sample':null}),
            h(SummaryStrip,{summary:sampleSummary,observations:visibleSample.length})
          ),
          h(DistributionCard,{distribution:data||{statistic:config.statistic,sample_size:config.sample_size},population,curveVisible:showCurve,onCurveChange:setShowCurve,fallingBin:falling?.chart==='primary'?falling.bin:null}),
          h(DistributionCard,{distribution:data?.comparison||{statistic:config.comparison_statistic,sample_size:config.comparison_size},population,secondary:true,enabled:config.comparison_statistic!=='none',curveVisible:comparisonCurve,onCurveChange:setComparisonCurve,fallingBin:falling?.chart==='comparison'?falling.bin:null,busy:busy||painting,onEnable:()=>changeConfig({comparison_statistic:'mean',comparison_size:25})})
        )
      ),
      h('footer',{className:'site-footer'},h('span',null,'Independent sampling · With replacement'),h('a',{href:'https://onlinestatbook.com/stat_sim/sampling_dist/index.html',target:'_blank',rel:'noreferrer'},'Original simulator'))
    ),
    toast&&h('div',{className:'toast',role:'status'},h(Icon,{name:'check',size:17}),toast)
  );
}

class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return {error}}
  render(){return this.state.error?h('main',{className:'fatal-error'},h('h1',null,'Reload examplesample'),h('p',null,this.state.error.message),h('button',{onClick:()=>location.reload()},'Reload')):this.props.children}
}
createRoot(document.getElementById('root')).render(h(ErrorBoundary,null,h(App)));


