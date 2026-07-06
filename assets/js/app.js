/* Habit Tracker — full engine (v12 functionality) with a restyled UI.
   Storage/backup uses the File System Access API (connect a local JSON file,
   e.g. inside a Google Drive / OneDrive / iCloud synced folder) — no OAuth. */
(()=>{
  const $=s=>document.querySelector(s); const $$=s=>Array.from(document.querySelectorAll(s));
  const STORAGE='habitTrackerProductionV7';
  const hkNow=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date()).reduce((a,x)=>{a[x.type]=x.value;return a},{});return new Date(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour||0),Number(p.minute||0),Number(p.second||0));};
  const todayKey=()=>dateKey(hkNow());
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseDate=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
  const fmtDate=d=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const trackerStart=()=>state?.settings?.startDate||todayKey();
  const afterStart=k=>!trackerStart()||k>=trackerStart();
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const COLOURS=['#4f46e5','#7c3aed','#2563eb','#0ea5e9','#059669','#16a34a','#ca8a04','#ea580c','#dc2626','#db2777','#9333ea','#0d9488'];
  const EMOJIS=['📖','🏃','📝','💻','🍽️','🌙','🎯','🙏','📚','💪','🧹','💧','🛌','🎨','💬','🚶'];
  const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MOODS=['😊','🥰','🤩','😴','😢','😡','🤒'];
  const identities=[
    {level:1,xp:0,icon:'🌱',name:'Seed Planter',desc:'Starting with small faithful actions.'},
    {level:2,xp:250,icon:'🪴',name:'Routine Builder',desc:'You show up even when it is not exciting.'},
    {level:3,xp:700,icon:'🧭',name:'Focus Scout',desc:'You begin to protect your attention.'},
    {level:4,xp:1300,icon:'🔥',name:'Streak Keeper',desc:'Consistency is becoming visible.'},
    {level:5,xp:2200,icon:'⚔️',name:'Deep Work Warrior',desc:'You turn time into meaningful output.'},
    {level:6,xp:3400,icon:'🏗️',name:'System Builder',desc:'You rely on systems, not mood.'},
    {level:7,xp:5000,icon:'🛡️',name:'Discipline Guardian',desc:'Your routines defend your priorities.'},
    {level:8,xp:7200,icon:'🚀',name:'Momentum Master',desc:'Your progress compounds quickly.'},
    {level:9,xp:10000,icon:'👑',name:'Identity Anchor',desc:'Discipline is part of your identity.'},
    {level:10,xp:14000,icon:'🏆',name:'Freedom Operator',desc:'A one-year standard of strong completion.'}
  ];
  let fileHandle=null;
  let reminderTimer=null;
  let reportCursor=hkNow();
  let reportMode='month';
  let trendDays=7;
  let rewardActiveTab='credit';
  let weekOffset=0;
  let trendCursor=hkNow();
  let state=load(); normalizeState();

  const ICON_EDIT='<svg viewBox="0 0 24 24" class="ai"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
  const ICON_DEL='<svg viewBox="0 0 24 24" class="ai"><path fill="currentColor" d="M6 7h12l-1 13.1A2 2 0 0 1 16 22H8a2 2 0 0 1-2-1.9L5 7h1zm3-3h6l1 2h4v2H2V6h4l1-2z"/></svg>';
  const PREVIEW=5;
  const iconBtn=(cls,svg,title)=>{const b=document.createElement('button'); b.className='act-btn '+cls; b.innerHTML=svg; b.title=title; b.setAttribute('aria-label',title); return b;};

  function defaults(){
    const habits=[
      {id:uid(),name:'Bible Time & Prayer',emoji:'📖',color:'#7c3aed',target:1,frequency:{mode:'daily',days:[0,1,2,3,4,5,6]},reminder:{enabled:false,time:'07:15'}},
      {id:uid(),name:'Morning Movement',emoji:'🏃',color:'#059669',target:1,frequency:{mode:'daily',days:[1,2,3,4,5]},reminder:{enabled:false,time:'07:35'}},
      {id:uid(),name:'Plan the Day',emoji:'📝',color:'#ea580c',target:1,frequency:{mode:'daily',days:[1,2,3,4,5]},reminder:{enabled:false,time:'08:00'}},
      {id:uid(),name:'Drink Water',emoji:'💧',color:'#0ea5e9',target:6,frequency:{mode:'daily',days:[0,1,2,3,4,5,6]},reminder:{enabled:false,time:'12:00'}},
      {id:uid(),name:'After-work Learning',emoji:'💻',color:'#2563eb',target:1,frequency:{mode:'daily',days:[1,2,3,4]},reminder:{enabled:false,time:'20:30'}},
      {id:uid(),name:'Weekend Deep Work',emoji:'🎯',color:'#4f46e5',target:1,frequency:{mode:'daily',days:[6,0]},reminder:{enabled:false,time:'09:30'}},
      {id:uid(),name:'Quarterly Review',emoji:'📚',color:'#9333ea',target:1,frequency:{mode:'custom',period:'quarter',times:1,schedule:{type:'weekday',monthInPeriod:1,ordinal:1,weekday:3}},reminder:{enabled:false,time:'10:00'}}
    ];
    // Seed ~40 days of history so reports, streaks and rewards are meaningful.
    const startD=new Date(hkNow()); startD.setDate(startD.getDate()-40);
    const records=[]; const journals={};
    for(let d=new Date(startD); d<=hkNow(); d.setDate(d.getDate()+1)){
      const k=dateKey(d), dow=d.getDay();
      habits.forEach(h=>{const f=h.frequency; if(f.mode!=='daily')return; if(!(f.days||[]).includes(dow))return;
        const target=Number(h.target||1); const chance=0.82-(dow===0||dow===6?0.12:0);
        for(let t=0;t<target;t++){ if(Math.random()<chance){ records.push({id:uid(),habitId:h.id,date:k,at:new Date(d.getFullYear(),d.getMonth(),d.getDate(),7+Math.floor(Math.random()*13),Math.floor(Math.random()*60)).toISOString(),note:''}); } }
      });
      if(k!==todayKey() && Math.random()<0.6){ journals[k]={mood:MOODS[Math.floor(Math.random()*MOODS.length)],energy:4+Math.floor(Math.random()*7),text:'',updatedAt:new Date().toISOString()}; }
    }
    return {
      habits, records, journals, redemptions:[],
      settings:{autoSync:false,fileConnected:false,reminders:false,globalReminderTime:'20:30',startDate:dateKey(startD),profileIcon:'',
        rewards:{creditRules:[{id:uid(),pct:50,amount:2},{id:uid(),pct:100,amount:10}], giftRules:[{id:uid(),gift:'Buffet',icon:'🍽️',pct:80,days:30}], penaltyCredit:5,penaltyXp:20,penaltyZeroDays:2}
      }
    };
  }
  function load(){try{const raw=localStorage.getItem(STORAGE);return raw?JSON.parse(raw):defaults()}catch(e){return defaults()}}
  function normalizeState(){
    state.settings=state.settings||{};
    if(!state.settings.startDate) state.settings.startDate=todayKey();
    if(state.settings.profileIcon===undefined) state.settings.profileIcon='';
    state.habits=state.habits||[]; state.records=state.records||[]; state.journals=state.journals||{}; state.redemptions=state.redemptions||[];
    state.habits.forEach(h=>{h.target=Number(h.target||1); h.frequency=h.frequency||{mode:'daily',days:[0,1,2,3,4,5,6]}; if(!h.frequency.schedule&&h.frequency.mode!=='daily') h.frequency.schedule={type:'any'};});
    ensureRewardShape(); localStorage.setItem(STORAGE,JSON.stringify(state));
  }
  async function save(skipSync=false){localStorage.setItem(STORAGE,JSON.stringify(state)); if(!skipSync) await autoSync(); renderAll();}
  function toast(msg){const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1600)}
  async function autoSync(){ updateStatus(); if(!state.settings.autoSync||!fileHandle) return; try{const w=await fileHandle.createWritable(); await w.write(JSON.stringify(state,null,2)); await w.close(); state.settings.fileConnected=true; localStorage.setItem(STORAGE,JSON.stringify(state)); updateStatus();}catch(e){toast('Backup sync needs reconnection'); state.settings.fileConnected=false; updateStatus();}}

  function monthKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;}
  function quarterKey(date){return `${date.getFullYear()}-Q${Math.floor(date.getMonth()/3)+1}`;}
  function yearKey(date){return `${date.getFullYear()}`;}
  function daysInMonth(y,m){return new Date(y,m+1,0).getDate();}
  function ordinalOfWeekday(date){
    const d=date.getDate(), w=date.getDay();
    let count=0; for(let i=1;i<=d;i++){ if(new Date(date.getFullYear(),date.getMonth(),i).getDay()===w) count++; }
    const nextSame=new Date(date.getFullYear(),date.getMonth(),d+7);
    const isLast=nextSame.getMonth()!==date.getMonth();
    return isLast?'last':count;
  }
  function periodMonthAllowed(f,date){
    if(!f || f.mode==='monthly') return true;
    const s=f.schedule||{};
    if(!s.type || s.type==='any') return true;
    if(f.mode==='custom' && f.period==='quarter'){
      if(String(s.monthInPeriod||'1')==='any') return true;
      return (date.getMonth()%3)+1 === Number(s.monthInPeriod||1);
    }
    if(f.mode==='custom' && f.period==='year'){
      if(String(s.monthInYear||'1')==='any') return true;
      return date.getMonth()+1 === Number(s.monthInYear||1);
    }
    return true;
  }
  function matchesScheduleRule(f,date){
    if(!f || f.mode==='daily') return true;
    const s=f.schedule||{};
    if(!periodMonthAllowed(f,date)) return false;
    if(!s.type || s.type==='any') return true;
    if(s.type==='date'){
      const last=daysInMonth(date.getFullYear(),date.getMonth());
      const due=Math.min(Number(s.day||1),last);
      return date.getDate()===due;
    }
    if(s.type==='weekday'){
      const ord=ordinalOfWeekday(date);
      const wanted=s.ordinal==='last'?'last':Number(s.ordinal||1);
      return date.getDay()===Number(s.weekday||1) && ord===wanted;
    }
    return true;
  }
  function scheduleLabel(f){
    if(!f || f.mode==='daily') return '';
    const s=f.schedule||{};
    if(!s.type || s.type==='any') return ' · not specified';
    let monthPart='';
    if(f.mode==='custom'&&f.period==='quarter') monthPart = String(s.monthInPeriod||'1')==='any' ? ' · every month in quarter' : ` · month ${Number(s.monthInPeriod||1)} of quarter`;
    if(f.mode==='custom'&&f.period==='year') monthPart = String(s.monthInYear||'1')==='any' ? ' · every month' : ` · ${new Date(2026,Number(s.monthInYear||1)-1,1).toLocaleDateString([], {month:'short'})}`;
    if(s.type==='date') return `${monthPart} · day ${Number(s.day||1)}`;
    const ord=s.ordinal==='last'?'last':['','1st','2nd','3rd','4th'][Number(s.ordinal||1)]||`${s.ordinal}th`;
    return `${monthPart} · ${ord} ${DOW[Number(s.weekday||1)]}`;
  }
  function currentPeriodKey(habit,date=hkNow()){
    const f=habit.frequency||{mode:'daily',days:[0,1,2,3,4,5,6]};
    if(f.mode==='daily') return dateKey(date);
    if(f.mode==='monthly'||(f.mode==='custom'&&f.period==='month')) return monthKey(date);
    if(f.mode==='custom'&&f.period==='quarter') return quarterKey(date);
    if(f.mode==='custom'&&f.period==='year') return yearKey(date);
    return dateKey(date);
  }
  function periodTarget(habit){const f=habit.frequency||{}; return Number(habit.target||f.times||1);}
  function frequencyLabel(habit){
    const f=habit.frequency||{};
    if(f.mode==='daily')return `Daily · ${periodTarget(habit)}x/day`;
    if(f.mode==='monthly')return `Monthly · ${periodTarget(habit)}x${scheduleLabel(f)}`;
    if(f.mode==='custom')return `${(f.period||'period').replace(/^./,c=>c.toUpperCase())} · ${periodTarget(habit)}x${scheduleLabel(f)}`;
    return 'Daily';
  }
  function isFlexibleHabit(habit,date=hkNow()){const f=habit.frequency||{}; return f.mode!=='daily' && (!f.schedule || f.schedule.type==='any') && periodMonthAllowed(f,date) && periodCount(habit,date)<periodTarget(habit);}
  function isScheduledToday(habit,date=hkNow()){
    if(!afterStart(dateKey(date))) return false;
    const f=habit.frequency||{};
    if(f.mode==='daily') return (f.days||[0,1,2,3,4,5,6]).includes(date.getDay());
    if(!f.schedule || f.schedule.type==='any') return false;
    return matchesScheduleRule(f,date) && periodCount(habit,date)<periodTarget(habit);
  }
  function periodCount(habit,date=hkNow()){const key=currentPeriodKey(habit,date); return state.records.filter(r=>r.habitId===habit.id && currentPeriodKey(habit,parseDate(r.date))===key).length}
  function todayHabitCount(habit,date=hkNow()){const k=dateKey(date); return state.records.filter(r=>r.habitId===habit.id && r.date===k).length}
  function dayScheduledHabits(date){if(!afterStart(dateKey(date))) return []; return state.habits.filter(h=>{const f=h.frequency||{}; if(f.mode==='daily') return (f.days||[]).includes(date.getDay()); if(!f.schedule || f.schedule.type==='any') return false; return matchesScheduleRule(f,date);});}
  function dayPct(date){const scheduled=dayScheduledHabits(date); if(!scheduled.length) return null; let points=0,total=0; scheduled.forEach(h=>{const target=(h.frequency.mode==='daily')?periodTarget(h):1; const count=(h.frequency.mode==='daily')?todayHabitCount(h,date):(periodCount(h,date)>0?1:0); points+=Math.min(count,target); total+=target;}); return total?Math.round(points/total*100):null;}
  function completionOfHabit(habit,date=hkNow()){const target=periodTarget(habit); const count=habit.frequency.mode==='daily'?todayHabitCount(habit,date):periodCount(habit,date); return {count,target,pct:Math.min(100,Math.round(count/target*100)),done:count>=target};}
  function recordXp(r){const h=state.habits.find(x=>x.id===r.habitId); if(!h)return 5; const f=h.frequency||{}; const target=Math.max(1,Number(h.target||1)); if(f.mode==='daily') return Math.round(Math.max(1,Math.min(5,5/target))*10)/10; if(f.mode==='monthly' && target<=1) return 15; if(f.mode==='custom' && ['month','quarter','year'].includes(f.period||'') && target<=1) return 15; return Math.round(Math.max(1,Math.min(5,5/target))*10)/10;}
  function fmtXp(x){return Number.isInteger(Number(x))?String(Math.round(Number(x))):Number(x).toFixed(1).replace(/\.0$/,'');}
  function ensureRewardShape(){
    const r=state.settings.rewards=state.settings.rewards||{};
    if(!Array.isArray(r.creditRules)){
      if(r.creditRule) r.creditRules=[{id:uid(),pct:Number(r.creditRule.pct||100),amount:Number(r.creditRule.amount||10)}];
      else r.creditRules=[{id:uid(),pct:Number(r.primaryPct||50),amount:Number(r.primaryAmount||2)},{id:uid(),pct:100,amount:10}];
    }
    r.creditRules.forEach(c=>{if(!c.id)c.id=uid(); c.pct=Number(c.pct||100); c.amount=Number(c.amount||0);});
    if(!Array.isArray(r.giftRules)) r.giftRules=[{id:uid(),gift:r.streakGift||'Buffet',icon:'🍽️',pct:r.streakPct||80,days:r.streakDays||30}];
    r.giftRules.forEach(g=>{if(!g.id)g.id=uid(); if(!g.icon)g.icon=(g.gift==='Buffet'?'🍽️':'🎁');});
    if(r.penaltyCredit===undefined) r.penaltyCredit=5; if(r.penaltyXp===undefined) r.penaltyXp=20; if(r.penaltyZeroDays===undefined) r.penaltyZeroDays=2;
  }
  function autoLedger(){
    ensureRewardShape(); const rewards=state.settings.rewards; const entries=[];
    const dates=[...new Set(state.records.map(r=>r.date).concat(Object.keys(state.journals)))].filter(afterStart).sort();
    dates.forEach(d=>{const p=dayPct(parseDate(d)); if(p===null)return; (rewards.creditRules||[]).forEach(rule=>{if(p>=Number(rule.pct||100)){entries.push({id:`auto-credit-${rule.id}-${d}`,date:d,type:'credit',amount:Number(rule.amount||0),gift:'',desc:`${rule.pct}% daily completion`,credit:Number(rule.amount||0),xp:rule.pct>=100?30:12});}});});
    const start=parseDate(trackerStart()), end=hkNow();
    for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){
      const p=dayPct(d); if(p!==0) continue;
      const zero=zeroStreakAt(d); const every=Math.max(1,Number(rewards.penaltyZeroDays||2));
      if(zero>=every && zero%every===0){
        entries.push({id:'auto-penalty-'+dateKey(d),date:dateKey(d),type:'penalty',desc:`${zero} consecutive 0% days`,credit:-Math.abs(Number(rewards.penaltyCredit||0)),xp:-Math.abs(Number(rewards.penaltyXp||0))});
      }
    }
    (rewards.giftRules||[]).forEach(rule=>{dates.forEach(d=>{const streak=streakAt(parseDate(d),Number(rule.pct||80)); if(streak>0 && streak%Number(rule.days||30)===0){entries.push({id:`auto-gift-${rule.id}-${d}`,date:d,type:'gift',amount:1,gift:rule.gift||'Gift',giftIcon:rule.icon||'🎁',giftRuleId:rule.id,desc:`${rule.days} days at ${rule.pct}%+ · ${rule.gift||'Gift'}`,credit:0,xp:120});}})});
    return entries;
  }
  function zeroStreakAt(date){let s=0; const d=new Date(date); for(let i=0;i<366;i++){const p=dayPct(d); if(p===0){s++; d.setDate(d.getDate()-1)} else break;} return s;}
  function ledger(){return autoLedger().concat(state.redemptions||[]).sort((a,b)=>b.date.localeCompare(a.date));}
  function xpTotal(){return Math.max(0,state.records.filter(r=>afterStart(r.date)).reduce((s,r)=>s+recordXp(r),0)+ledger().reduce((s,l)=>s+(l.xp||0),0));}
  function creditTotal(){return Math.max(0,ledger().reduce((s,l)=>s+(l.credit||0),0));}
  function giftCount(rule){const id=typeof rule==='object'?rule.id:rule; const name=typeof rule==='object'?rule.gift:rule; return Math.max(0,ledger().filter(l=>l.type==='gift'&&((l.giftRuleId&&l.giftRuleId===id)||(!l.giftRuleId&&l.gift===name))).length - ledger().filter(l=>l.type==='redeemGift'&&((l.giftRuleId&&l.giftRuleId===id)||(!l.giftRuleId&&l.gift===name))).length)}
  function levelInfo(){const xp=xpTotal(); let cur=identities[0], next=identities[identities.length-1]; identities.forEach((l,i)=>{if(xp>=l.xp){cur=l; next=identities[i+1]||l;}}); const span=Math.max(1,next.xp-cur.xp); return {cur,next,xp,pct:cur===next?100:Math.min(100,Math.round((xp-cur.xp)/span*100))};}
  function streakAt(date,threshold=100){let s=0; const d=new Date(date); for(let i=0;i<366;i++){const p=dayPct(d); if(p!==null && p>=threshold){s++; d.setDate(d.getDate()-1)} else break;} return s;}
  function longestPerfectStreak(){let max=0,cur=0; const start=parseDate(trackerStart()), end=hkNow(); for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){const p=dayPct(d); if(p!==null&&p>=100){cur++; max=Math.max(max,cur)}else if(p!==null) cur=0;} return max;}

  function pctClass(p){if(p>=100)return 'perfect'; if(p>=80)return 'good'; if(p>=50)return 'partial'; if(p>0)return 'low'; return 'zero';}
  function updateStatus(){const sync=$('#syncStatus'), file=$('#fileStatus'), rem=$('#reminderStatus'); if(!sync)return; const connected=!!fileHandle; if(!connected && state.settings.autoSync){state.settings.autoSync=false; localStorage.setItem(STORAGE,JSON.stringify(state));} sync.className='status-pill '+(state.settings.autoSync&&connected?'on':''); sync.querySelector('span:last-child').textContent=(state.settings.autoSync&&connected)?'Auto Sync On':'Sync Off'; file.className='status-pill '+(connected?'on':(state.settings.fileConnected?'warn':'')); file.querySelector('span:last-child').textContent=connected?'File Connected':(state.settings.fileConnected?'Reconnect File':'No File'); rem.className='status-pill '+(state.settings.reminders?'on':''); rem.querySelector('span:last-child').textContent=state.settings.reminders?'Reminders On':'Reminders Off';}

  /* ---------- HOME ---------- */
  function renderHome(){
    const now=hkNow(); const scheduled=state.habits.filter(h=>isScheduledToday(h,now));
    let completed=0,total=0; scheduled.forEach(h=>{const c=completionOfHabit(h,now); completed+=Math.min(c.count,c.target); total+=c.target;});
    $('#greeting').textContent='Today'; $('#todayEntryStamp').textContent=fmtDate(now); const todayPct=total?Math.round(completed/total*100):0; const badge=$('#todayPctBadge'); if(badge){badge.textContent=todayPct+'%'; badge.className='chip band-'+pctClass(todayPct);}
    $('#homeCreditValue').textContent='HK$'+creditTotal(); $('#homeCreditSub').textContent='available to redeem';
    const cur100=streakAt(now,100), best=longestPerfectStreak(); $('#homeStreakValue').textContent=`${cur100} / ${best}`; $('#homeStreakSub').textContent='current / best 100% streak';
    const ng=nextGiftInfo(); $('#homeNextGiftIcon').textContent=ng.icon; $('#homeNextGiftSub').textContent=ng.label; $('#homeNextGiftFill').style.width=ng.pct+'%';
    const list=$('#todayHabitList'); list.innerHTML=''; if(!scheduled.length) list.innerHTML='<div class="empty">No date-specific habits scheduled for today.</div>';
    scheduled.forEach(h=>list.appendChild(todayHabitRow(h,now)));
    renderWeekStrip(); renderFlexibleHabits(now); renderHomeJournal(); renderQuote(); renderTopProfile();
  }
  function renderWeekStrip(){
    const strip=$('#weekStrip'); if(!strip)return;
    const base=hkNow(); base.setDate(base.getDate()+weekOffset*7);
    const start=new Date(base); start.setDate(start.getDate()-start.getDay());
    const tKey=todayKey(); strip.innerHTML='';
    for(let i=0;i<7;i++){
      const d=new Date(start); d.setDate(start.getDate()+i); const k=dateKey(d); const p=dayPct(d); const j=state.journals[k];
      const future=k>tKey; const band = future?'band-future':(p===null?'band-none':'band-'+pctClass(p));
      const cell=document.createElement('button'); cell.className='wcell'+(k===tKey?' today':'');
      cell.innerHTML=`<span class="wdow">${DOW[d.getDay()][0]}</span><span class="wnum ${band}">${d.getDate()}</span><span class="wmeta"><span class="wmood">${j&&j.mood?j.mood:''}</span><span class="wscore">${j&&j.energy!==undefined&&j.energy!==''?j.energy:''}</span></span>`;
      cell.onclick=()=>openDayDetail(k);
      strip.appendChild(cell);
    }
    const label=$('#weekLabel'); if(label){const endd=new Date(start); endd.setDate(start.getDate()+6); label.textContent = weekOffset===0?'This week':`${start.getMonth()+1}/${start.getDate()} – ${endd.getMonth()+1}/${endd.getDate()}`;}
  }
  function todayHabitRow(h,now=hkNow(),after=null){
    const k=dateKey(now); const c=completionOfHabit(h,now); const row=document.createElement('div'); row.className='habit-row '+(c.done?'done':'');
    row.innerHTML=`<div class="habit-icon" style="background:${h.color}22;color:${h.color}">${h.emoji}</div><div class="habit-main"><div class="habit-name"></div><div class="habit-meta"><span>${c.count}/${c.target}</span><span class="mini-dot"></span><span>${frequencyLabel(h)}</span>${c.count?'<span class="mini-dot"></span><span class="entry-stamp">recorded</span>':''}</div><div class="progress-mini"><span style="width:${c.pct}%;background:${h.color}"></span></div></div><button class="check-btn ${c.done?'done':''}" ${c.done?'disabled':''}>${c.done?'✓':'+1'}</button>${c.count?'<button class="icon-btn red" data-reset title="Reset">↺</button>':''}`;
    row.querySelector('.habit-name').textContent=h.name;
    if(!c.done) row.onclick=async(e)=>{if(e.target.closest('button[data-reset]'))return; await addRecord(h.id,'',k); after&&after();};
    const reset=row.querySelector('[data-reset]'); if(reset) reset.onclick=async(e)=>{e.stopPropagation(); await resetHabitForDate(h.id,k); after&&after();};
    return row;
  }
  function renderFlexibleHabits(now=hkNow()){
    const card=$('#flexHabitCard'), list=$('#flexHabitList'); if(!card||!list)return;
    const flex=state.habits.filter(h=>isFlexibleHabit(h,now));
    if(!flex.length){card.style.display='none'; return;}
    card.style.display='block'; const unfinished=flex.reduce((s,h)=>s+Math.max(0,periodTarget(h)-completionOfHabit(h,now).count),0); $('#flexHabitSummary').textContent=`${unfinished} unfinished target${unfinished===1?'':'s'} this period`; list.innerHTML=''; flex.forEach(h=>list.appendChild(todayHabitRow(h,now)));
    $('#flexHabitToggle').onclick=()=>card.classList.toggle('collapsed');
  }
  function nextGiftInfo(){
    ensureRewardShape(); const rules=state.settings.rewards.giftRules||[]; if(!rules.length) return {icon:'🎁',label:'No gift rule yet',pct:0};
    let best=null; rules.forEach(g=>{const gp=giftProgress(g); const item={icon:g.icon||'🎁',label:`${g.gift||'Gift'} · ${gp.current}/${gp.target} days`,pct:gp.pct,remaining:gp.target-gp.current}; if(!best || item.remaining<best.remaining) best=item;}); return best||{icon:'🎁',label:'No gift rule yet',pct:0};
  }
  async function addRecord(habitId,note='',date=todayKey()){const habit=state.habits.find(h=>h.id===habitId); if(!habit)return; const dt=parseDate(date); const c=completionOfHabit(habit,dt); if(c.count>=c.target){toast('Target already completed'); return;} const r={id:uid(),habitId,date,at:new Date().toISOString(),note}; state.records.push(r); await save(); showXpPop('+'+fmtXp(recordXp(r))+' XP'); toast('Recorded');}
  async function removeRecord(id){state.records=state.records.filter(r=>r.id!==id); await save(); toast('Record removed')}
  async function removeRedemption(id){state.redemptions=state.redemptions.filter(r=>r.id!==id); await save(); toast('Redemption removed')}
  async function resetTodayRecords(){if(!confirm('Reset all habit records for today?'))return; const k=todayKey(); state.records=state.records.filter(r=>r.date!==k); await save(); toast('Today reset')}
  async function resetHabitForDate(habitId,k){state.records=state.records.filter(r=>!(r.date===k&&r.habitId===habitId)); await save(); toast('Habit reset')}

  /* Shared: preview 5 + "More" with a date-range filter (default last 3 days). */
  function renderPreview(box,items,itemFn,moreTitle){
    if(!box)return; box.innerHTML=''; if(!items.length){box.innerHTML='<div class="empty">Nothing here yet.</div>'; return;}
    items.slice(0,PREVIEW).forEach(x=>box.appendChild(itemFn(x)));
    if(items.length>PREVIEW){const more=document.createElement('button'); more.className='btn-secondary more-btn'; more.textContent=`View all ${items.length}`; more.onclick=()=>openLedgerModal(moreTitle,items,itemFn); box.appendChild(more);}
  }
  function openLedgerModal(title,items,itemFn){
    const to=todayKey(); const fromD=hkNow(); fromD.setDate(fromD.getDate()-2); const from=dateKey(fromD);
    openModal(title,`<div class="log-filter-grid"><div class="field"><label>From</label><input type="date" id="lfFrom" value="${from}"></div><div class="field"><label>To</label><input type="date" id="lfTo" value="${to}"></div><button class="btn-inline pink" id="lfApply">Apply</button></div><div class="filtered-list" id="lfList" style="margin-top:12px"></div>`);
    const draw=()=>{const f=$('#lfFrom').value||from,t=$('#lfTo').value||to; const box=$('#lfList'); const l=items.filter(x=>x.date>=f&&x.date<=t); box.innerHTML=l.length?'':'<div class="empty">No records in this period.</div>'; l.forEach(x=>box.appendChild(itemFn(x)));};
    $('#lfApply').onclick=draw; draw();
  }
  function ledgerNode(x){const div=document.createElement('div'); div.className='ledger-item';
    const amt=x.credit?('HK$'+x.credit):((x.type==='gift'||x.type==='redeemGift')?((x.giftIcon||'🎁')+' '+(x.gift||'')):'');
    div.innerHTML=`<div class="lg-main"><div class="ledger-head"><span>${escapeHtml(x.desc||'')}</span><span>${amt}</span></div><div class="ledger-sub">${x.date} · XP ${fmtXp(x.xp||0)}</div></div>`;
    if(x.type==='redeemCredit'||x.type==='redeemGift'){const acts=document.createElement('div'); acts.className='row-actions'; const d=iconBtn('del',ICON_DEL,'Remove'); d.onclick=()=>confirm('Remove this redemption?')&&removeRedemption(x.id); acts.appendChild(d); div.appendChild(acts);}
    return div;}
  function xpNode(x){const div=document.createElement('div'); div.className='ledger-item'; div.innerHTML=`<div class="lg-main"><div class="ledger-head"><span>${escapeHtml(x.desc)}</span><span>${x.xp>0?'+':''}${fmtXp(x.xp)} XP</span></div><div class="ledger-sub">${x.date}</div></div>`; return div;}
  function journalNode(k,after){const j=state.journals[k]||{}; const div=document.createElement('div'); div.className='journal-item';
    div.innerHTML=`<div class="j-main"><div class="journal-date"><span>${k}</span><span>${j.mood||''} ${j.energy}/10</span></div><div class="journal-text clamp2">${escapeHtml(j.text||'No reflection written.')}</div></div>`;
    const acts=document.createElement('div'); acts.className='row-actions';
    const e=iconBtn('edit',ICON_EDIT,'Edit'); e.onclick=()=>{if(after)closeModal(); openJournalEditor(k);};
    const d=iconBtn('del',ICON_DEL,'Delete'); d.onclick=async()=>{if(confirm('Delete this journal?')){delete state.journals[k]; await save(); if(after)after();}};
    acts.appendChild(e); acts.appendChild(d); div.appendChild(acts); return div;}
  function editRecord(id){const r=state.records.find(x=>x.id===id); if(!r)return; openModal('Edit Record Note',`<div class="note-area"><textarea id="recordNoteInput" placeholder="Add note for this completion">${escapeHtml(r.note||'')}</textarea></div><div class="modal-actions"><button class="btn-secondary" data-close>Cancel</button><button class="btn-primary" id="saveRecordNote">Save</button></div>`); $('#saveRecordNote').onclick=async()=>{r.note=$('#recordNoteInput').value.trim(); await save(); closeModal(); toast('Record updated')}; }
  function renderRecentActivity(){const box=$('#recentActivityLog'); if(!box)return; const logs=state.records.filter(r=>afterStart(r.date)).slice().sort((a,b)=>b.at.localeCompare(a.at)).slice(0,5); box.innerHTML=''; if(!logs.length){box.innerHTML='<div class="empty">No records yet.</div>';return;} logs.forEach(r=>box.appendChild(activityItem(r))); const btn=$('#viewFullLogBtn'); if(btn)btn.onclick=openFullLog;}
  function openFullLog(){const now=hkNow(); const start=new Date(now); start.setDate(start.getDate()-2); openModal('Full Habit Log',`<div class="log-filter-grid"><div class="field"><label>From</label><input type="date" id="logFrom" value="${dateKey(start)}"></div><div class="field"><label>To</label><input type="date" id="logTo" value="${todayKey()}"></div><button class="btn-inline pink" id="applyLogFilter">Apply</button></div><div class="activity-log" id="fullActivityLog" style="margin-top:12px"></div>`); const render=()=>{const from=$('#logFrom').value||trackerStart(), to=$('#logTo').value||todayKey(); const logs=state.records.filter(r=>afterStart(r.date)&&r.date>=from&&r.date<=to).slice().sort((a,b)=>b.at.localeCompare(a.at)); const box=$('#fullActivityLog'); box.innerHTML=logs.length?'':'<div class="empty">No records in this period.</div>'; logs.forEach(r=>box.appendChild(activityItem(r)));}; $('#applyLogFilter').onclick=render; render();}
  function activityItem(r){const h=state.habits.find(x=>x.id===r.habitId)||{}; const div=document.createElement('div'); div.className='activity'; div.innerHTML=`<div class="activity-emoji" style="background:${(h.color||'#4f46e5')}22">${h.emoji||'✓'}</div><div class="a-main"><div class="activity-title"></div><div class="activity-sub">${r.date} · ${new Date(r.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})}${r.note?' · '+escapeHtml(r.note):''}</div></div>`; div.querySelector('.activity-title').textContent=h.name||'Habit'; const acts=document.createElement('div'); acts.className='row-actions'; const e=iconBtn('edit',ICON_EDIT,'Edit'); e.onclick=()=>editRecord(r.id); const d=iconBtn('del',ICON_DEL,'Remove'); d.onclick=()=>confirm('Remove this record?')&&removeRecord(r.id); acts.appendChild(e); acts.appendChild(d); div.appendChild(acts); return div;}
  function renderHomeJournal(){const k=todayKey(), j=state.journals[k]||{mood:'',energy:5,text:''}; const el=$('#homeJournalForm'); el.innerHTML=`<div class="field"><label>Mood</label><div class="mood-row">${MOODS.map(m=>`<button class="mood ${j.mood===m?'active':''}" data-mood="${m}">${m}</button>`).join('')}</div></div><div class="field"><label>Energy Score</label><div class="energy-panel"><div class="range-value" id="homeEnergyValue">${j.energy}</div><div class="energy-scale"><input type="range" min="0" max="10" value="${j.energy}" id="homeEnergy"><div class="ticks">${Array.from({length:11},(_,i)=>`<span style="left:calc(10px + ${i}/10*(100% - 20px))">${i}</span>`).join('')}</div></div></div></div><div class="field journal-area"><label>Reflection</label><textarea id="homeJournalText" placeholder="What went well? What needs adjustment?">${escapeHtml(j.text)}</textarea></div><button class="btn-primary" id="saveJournalHome">Save Journal</button>`;
    $$('.mood').forEach(b=>b.onclick=()=>{$$('.mood').forEach(x=>x.classList.remove('active')); b.classList.add('active')}); $('#homeEnergy').oninput=e=>$('#homeEnergyValue').textContent=e.target.value; $('#saveJournalHome').onclick=async()=>{const mood=$('#homeJournalForm .mood.active')?.dataset.mood||''; state.journals[k]={mood,energy:Number($('#homeEnergy').value),text:$('#homeJournalText').value.trim(),updatedAt:new Date().toISOString()}; await save(); toast('Journal saved')};}
  function renderQuote(){const el=$('#dailyQuote'); if(!el)return; const q=[['Commit to the LORD whatever you do, and he will establish your plans.','Proverbs 16:3'],['Small actions become identity when repeated.','Habit principle'],['Discipline today, freedom tomorrow.','Reminder']][hkNow().getDate()%3]; el.innerHTML=`<div class="quote-text">${q[0]}</div><div class="quote-ref">${q[1]}</div>`;}

  /* ---------- HABITS ---------- */
  function renderHabits(){const list=$('#allHabitList'); if(!list)return; list.innerHTML=''; $('#habitCountChip').textContent=state.habits.length+' habits'; if(!state.habits.length){list.innerHTML='<div class="empty">No habits yet.</div>'} state.habits.forEach(h=>{const row=document.createElement('div'); row.className='habit-row'; row.style.cursor='default'; row.innerHTML=`<div class="habit-icon" style="background:${h.color}22;color:${h.color}">${h.emoji}</div><div class="habit-main"><div class="habit-name"></div><div class="habit-meta"><span>${frequencyLabel(h)}</span><span class="mini-dot"></span><span class="count-pill">Target ${periodTarget(h)}</span>${h.reminder?.enabled?'<span class="mini-dot"></span><span>Reminder '+h.reminder.time+'</span>':''}</div></div>`; row.querySelector('.habit-name').textContent=h.name; const actions=document.createElement('div'); actions.className='habit-actions'; actions.innerHTML='<button class="icon-btn" data-edit>✎</button><button class="icon-btn red" data-del>×</button>'; actions.querySelector('[data-edit]').onclick=()=>openHabitModal(h); actions.querySelector('[data-del]').onclick=async()=>{if(confirm('Delete this habit? Existing records will remain in history.')){state.habits=state.habits.filter(x=>x.id!==h.id); await save(); toast('Habit deleted')}}; row.appendChild(actions); list.appendChild(row);}); renderRecentActivity();}

  function openHabitModal(habit=null){
    const isEdit=!!habit;
    const h=habit||{name:'',emoji:'📖',color:COLOURS[0],target:1,frequency:{mode:'daily',days:[1,2,3,4,5]},reminder:{enabled:false,time:state.settings.globalReminderTime||'20:30'}};
    openModal(isEdit?'Edit Habit':'Add Habit',`<div class="form-grid"><div class="field"><label>Habit Name</label><input id="habitName" value="${escapeAttr(h.name)}" placeholder="e.g. Bible Time"></div><div class="field"><label>Icon</label><div class="emoji-row">${EMOJIS.map(e=>`<button class="emoji-swatch ${h.emoji===e?'active':''}" data-emoji="${e}">${e}</button>`).join('')}</div><input id="habitEmoji" value="${escapeAttr(h.emoji||'📖')}" maxlength="4" placeholder="📖" style="margin-top:8px"></div><div class="field"><label>Colour</label><div class="color-row">${COLOURS.map(c=>`<button class="color-swatch ${h.color===c?'active':''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div></div><div class="field"><label>Target Count</label><select id="habitTarget">${Array.from({length:10},(_,i)=>i+1).map(n=>`<option value="${n}" ${Number(h.target||1)===n?'selected':''}>${n} time${n>1?'s':''}</option>`).join('')}</select></div><div class="field"><label>Frequency</label><select id="freqMode"><option value="daily">Daily</option><option value="monthly">Monthly</option><option value="custom">Custom</option></select></div><div class="dynamic-fields" id="freqFields"></div><div class="dynamic-fields"><div class="switch-row"><div><strong>Habit Reminder</strong><div class="small-note" id="habitReminderHint"></div></div><button class="switch" id="habitReminderToggle"></button></div><div class="field" style="margin-top:10px"><label>Reminder Time</label><input type="time" id="habitReminderTime" value="${h.reminder?.time||'20:30'}"></div></div><div class="modal-actions"><button class="btn-secondary" data-close>Cancel</button><button class="btn-primary" id="saveHabitBtn">Save</button></div></div>`);
    const f=h.frequency||{mode:'daily',days:[1,2,3,4,5]}; $('#freqMode').value=f.mode||'daily'; let selectedColor=h.color;
    $$('.color-swatch').forEach(b=>b.onclick=()=>{$$('.color-swatch').forEach(x=>x.classList.remove('active')); b.classList.add('active'); selectedColor=b.dataset.color});
    $$('.emoji-swatch').forEach(b=>b.onclick=()=>{$$('.emoji-swatch').forEach(x=>x.classList.remove('active')); b.classList.add('active'); $('#habitEmoji').value=b.dataset.emoji});
    function ordinalOptions(v){return [[1,'1st'],[2,'2nd'],[3,'3rd'],[4,'4th'],['last','Last']].map(([val,txt])=>`<option value="${val}" ${String(v)===String(val)?'selected':''}>${txt}</option>`).join('')}
    function weekdayOptions(v){return DOW.map((d,i)=>`<option value="${i}" ${Number(v)===i?'selected':''}>${d}</option>`).join('')}
    function dayOptions(v){return Array.from({length:31},(_,i)=>i+1).map(n=>`<option value="${n}" ${Number(v)===n?'selected':''}>${n}</option>`).join('')}
    function monthOptions(v){return Array.from({length:12},(_,i)=>i+1).map(n=>`<option value="${n}" ${Number(v)===n?'selected':''}>${new Date(2026,n-1,1).toLocaleDateString([], {month:'long'})}</option>`).join('')}
    function scheduleFields(freq,mode){
      const s=freq.schedule||{};
      return `<div class="field"><label>Schedule Type</label><select id="scheduleType"><option value="any" ${!s.type||s.type==='any'?'selected':''}>Not specified</option><option value="date" ${s.type==='date'?'selected':''}>Specific date</option><option value="weekday" ${s.type==='weekday'?'selected':''}>Specific weekday</option></select></div><div id="scheduleFieldsInner"></div><div class="hint">Use not specified for flexible timing across the period. Select a date or weekday only if this habit must appear on a fixed schedule.</div>`;
    }
    function drawScheduleInner(){
      const type=$('#scheduleType')?.value||'any'; const s=f.schedule||{}; const inner=$('#scheduleFieldsInner'); if(!inner)return;
      if(type==='any') { inner.innerHTML=`<div class="hint">No fixed date. This goal can be completed any time within the selected month, quarter, or year.</div>`; return; }
      let periodExtra='';
      const period=$('#customPeriod')?.value || f.period || 'quarter';
      if($('#freqMode')?.value==='custom' && period==='quarter') periodExtra = `<div class="field"><label>Month in Quarter</label><select id="monthInPeriod"><option value="any" ${String(s.monthInPeriod)==='any'?'selected':''}>Every month in quarter</option><option value="1" ${String(s.monthInPeriod||1)==='1'?'selected':''}>1st month</option><option value="2" ${String(s.monthInPeriod)==='2'?'selected':''}>2nd month</option><option value="3" ${String(s.monthInPeriod)==='3'?'selected':''}>3rd month</option></select></div>`;
      if($('#freqMode')?.value==='custom' && period==='year') periodExtra = `<div class="field"><label>Month</label><select id="monthInYear"><option value="any" ${String(s.monthInYear)==='any'?'selected':''}>Every month</option>${monthOptions(s.monthInYear||1)}</select></div>`;
      if(type==='date') inner.innerHTML=`${periodExtra}<div class="field"><label>Due Date</label><select id="scheduleDay">${dayOptions(s.day||1)}</select></div>`;
      else inner.innerHTML=`${periodExtra}<div class="schedule-grid"><div class="field"><label>Week</label><select id="scheduleOrdinal">${ordinalOptions(s.ordinal||1)}</select></div><div class="field"><label>Weekday</label><select id="scheduleWeekday">${weekdayOptions(s.weekday||3)}</select></div></div>`;
    }
    function drawFreq(){
      const mode=$('#freqMode').value; const box=$('#freqFields');
      if(mode==='daily'){
        box.innerHTML=`<div class="sub-field field"><label>Active Days</label><div class="day-row">${DOW.map((d,i)=>`<button class="day-pill ${(f.days||[]).includes(i)?'active':''}" data-day="${i}">${d[0]}</button>`).join('')}</div><div class="hint">Tap the days when this habit should appear on the Home page.</div></div>`;
        $$('.day-pill').forEach(b=>b.onclick=()=>b.classList.toggle('active'));
      }else if(mode==='monthly'){
        box.innerHTML=`<div class="sub-field field"><label>Monthly Setup</label><div class="hint">The target count applies once per month. Choose when the habit should appear.</div></div>${scheduleFields(f,'monthly')}`;
        $('#scheduleType').onchange=drawScheduleInner; drawScheduleInner();
      }else{
        box.innerHTML=`<div class="sub-field field"><label>Custom Period</label><select id="customPeriod"><option value="quarter">Quarterly</option><option value="year">Yearly</option></select><div class="hint">Use custom for lower-frequency commitments. The target count applies once per selected period.</div></div><div id="customScheduleBox"></div>`;
        $('#customPeriod').value=f.period||'quarter';
        function drawCustomSchedule(){ const cf={...f,period:$('#customPeriod').value,schedule:f.schedule||{type:'any'}}; $('#customScheduleBox').innerHTML=scheduleFields(cf,'custom'); $('#scheduleType').onchange=drawScheduleInner; drawScheduleInner(); }
        $('#customPeriod').onchange=drawCustomSchedule; drawCustomSchedule();
      }
    }
    $('#freqMode').onchange=drawFreq; drawFreq();
    const reminderEnabled=!!state.settings.reminders; const t=$('#habitReminderToggle'); const time=$('#habitReminderTime');
    function syncReminderUi(){t.classList.toggle('on',!!h.reminder?.enabled&&reminderEnabled); t.disabled=!reminderEnabled; time.disabled=!reminderEnabled||!t.classList.contains('on'); $('#habitReminderHint').textContent=reminderEnabled?'Optional habit-level reminder.':'Global reminders are off in Settings.';} syncReminderUi();
    t.onclick=()=>{if(!reminderEnabled)return; t.classList.toggle('on'); syncReminderUi();};
    $('#saveHabitBtn').onclick=async()=>{
      const mode=$('#freqMode').value; let freq={mode};
      if(mode==='daily'){
        freq.days=$$('.day-pill.active').map(x=>Number(x.dataset.day)); if(!freq.days.length){toast('Select at least one day'); return;}
      }else{
        let schedule={type:$('#scheduleType')?.value||'any'};
        if(mode==='custom'){
          freq.period=$('#customPeriod').value;
          if(schedule.type!=='any'){
            if(freq.period==='quarter'){const mp=$('#monthInPeriod')?.value||'1'; schedule.monthInPeriod=mp==='any'?'any':Number(mp);}
            if(freq.period==='year'){const my=$('#monthInYear')?.value||'1'; schedule.monthInYear=my==='any'?'any':Number(my);}
          }
        }
        if(schedule.type==='date') schedule.day=Number($('#scheduleDay')?.value||1); else if(schedule.type==='weekday') {schedule.ordinal=$('#scheduleOrdinal')?.value||1; schedule.weekday=Number($('#scheduleWeekday')?.value||1);}
        freq.schedule=schedule;
      }
      const item={id:h.id||uid(),name:$('#habitName').value.trim()||'Untitled Habit',emoji:$('#habitEmoji').value,color:selectedColor,target:Number($('#habitTarget').value),frequency:freq,reminder:{enabled:t.classList.contains('on')&&reminderEnabled,time:$('#habitReminderTime').value}};
      if(isEdit){state.habits=state.habits.map(x=>x.id===h.id?item:x)}else state.habits.push(item); await save(); closeModal(); toast('Habit saved')
    };
  }

  /* ---------- REPORT ---------- */
  function renderReport(){drawTrend(); renderCalendar();}
  function trendEndDate(){const c=trendCursor, now=hkNow(); if(c.getFullYear()===now.getFullYear()&&c.getMonth()===now.getMonth()) return now; return new Date(c.getFullYear(),c.getMonth()+1,0);}
  function updateTrendTitle(){const t=$('#trendTitle'); if(!t)return; const now=hkNow(); const cur=trendCursor.getFullYear()===now.getFullYear()&&trendCursor.getMonth()===now.getMonth(); t.textContent=trendCursor.toLocaleDateString([], {month:'short',year:'numeric'})+(cur?' · to today':'');}
  function drawTrend(){
    const c=$('#trendCanvas'); if(!c)return; updateTrendTitle(); const ctx=c.getContext('2d'),ratio=devicePixelRatio||1; c.width=c.offsetWidth*ratio; c.height=c.offsetHeight*ratio; ctx.setTransform(ratio,0,0,ratio,0,0); const W=c.offsetWidth,H=c.offsetHeight; ctx.clearRect(0,0,W,H);
    const labels=[]; const pctVals=[]; const energy=[]; const end=trendEndDate();
    for(let i=trendDays-1;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);const k=dateKey(d); labels.push(`${d.getMonth()+1}/${d.getDate()}`); pctVals.push(dayPct(d)); energy.push(state.journals[k]?.energy??null);}
    $('#trendNote').textContent='Bars show daily habit completion. The line shows your journal energy. Use ‹ › to review other months.';
    const left=34,right=12,top=18,bottom=42,plotW=W-left-right,plotH=H-top-bottom,bw=plotW/trendDays;
    ctx.strokeStyle='#eeeeF6'; ctx.lineWidth=1; ctx.fillStyle='#7c8199'; ctx.font='10px Inter,Arial'; for(let i=0;i<=4;i++){const y=top+plotH*i/4; ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(W-right,y);ctx.stroke(); ctx.fillText((100-i*25)+'%',4,y+3);}
    pctVals.forEach((v,i)=>{ if(v===null||v===undefined) return; const x=left+i*bw+bw*.24; const bh=plotH*(v/100); ctx.fillStyle=v>=100?'rgba(22,163,74,.9)':v>=80?'rgba(134,239,172,.95)':v>=50?'rgba(253,230,138,.95)':v>0?'rgba(254,202,202,.95)':'rgba(248,113,113,.85)'; roundRect(ctx,x,top+plotH-bh,Math.max(5,bw*.52),Math.max(2,bh),6,true);});
    ctx.strokeStyle='#4f46e5';ctx.lineWidth=3;ctx.beginPath(); let started=false; energy.forEach((e,i)=>{if(e==null)return; const x=left+i*bw+bw/2, y=top+plotH-plotH*(e/10); if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y)}); if(started) ctx.stroke(); energy.forEach((e,i)=>{if(e==null)return; const x=left+i*bw+bw/2, y=top+plotH-plotH*(e/10); ctx.fillStyle='#4f46e5'; ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();});
    const labelStep=trendDays<=7?1:trendDays<=14?3:6; ctx.fillStyle='#7c8199';ctx.font='10px Inter,Arial'; ctx.textAlign='center'; labels.forEach((l,i)=>{if(i%labelStep!==0&&i!==labels.length-1)return; const x=left+i*bw+bw/2; ctx.fillText(l,x,H-16);}); ctx.textAlign='left';}
  function roundRect(ctx,x,y,w,h,r,fill){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r); if(fill)ctx.fill();}
  function renderCalendar(){const title=$('#reportTitle'); const m=$('#monthReport'), q=$('#quarterReport'); if(!title)return; m.style.display=reportMode==='month'?'block':'none'; q.style.display=reportMode==='quarter'?'grid':'none'; if(reportMode==='month'){title.textContent=reportCursor.toLocaleDateString([], {month:'long',year:'numeric'}); renderMonth(reportCursor,$('#calendarGrid'),$('#calendarWeekdays'));} else {const y=reportCursor.getFullYear(), qi=Math.floor(reportCursor.getMonth()/3); title.textContent=`Q${qi+1} ${y}`; q.innerHTML=''; [0,1,2].forEach(i=>{const d=new Date(y,qi*3+i,1); const wrap=document.createElement('div'); wrap.className='month-mini'; wrap.innerHTML=`<h4>${d.toLocaleDateString([], {month:'long'})}</h4><div class="calendar-weekdays"></div><div class="calendar-grid"></div>`; q.appendChild(wrap); renderMonth(d,wrap.querySelector('.calendar-grid'),wrap.querySelector('.calendar-weekdays'),true);});}}
  function renderMonth(date,grid,weekdays,mini=false){weekdays.innerHTML=DOW.map(x=>`<div>${x[0]}</div>`).join(''); grid.innerHTML=''; const y=date.getFullYear(),m=date.getMonth(), first=new Date(y,m,1), days=new Date(y,m+1,0).getDate(); const today=todayKey(); for(let i=0;i<first.getDay();i++){const e=document.createElement('div');e.className='day-cell empty';grid.appendChild(e)} for(let d=1;d<=days;d++){const dt=new Date(y,m,d),k=dateKey(dt),p=dayPct(dt),j=state.journals[k]; const cell=document.createElement('div'); let cls='day-cell'; if(k>today){cls+=' future'} else if(p!==null){cls+=' '+pctClass(p);} if(k===today)cls+=' today'; cell.className=cls; cell.innerHTML=`<span>${d}</span>${j?.mood?`<span class="mood-mark">${j.mood}</span>`:''}${j?.energy!==undefined?`<span class="energy-mark">${j.energy}</span>`:''}`; cell.onclick=()=>openDayDetail(k); grid.appendChild(cell);} }
  function openDayDetail(k){const d=parseDate(k); const scheduled=dayScheduledHabits(d); const p=dayPct(d);
    openModal(`Day Detail · ${fmtDate(d)}`,`<div class="small-note">Completion <strong>${p??0}%</strong> · tap +1 to record, ↺ to reset a habit</div><div class="habit-list" id="dayHabitList" style="margin-top:12px"></div><div id="dayJournalBox" style="margin-top:16px"></div>`);
    const list=$('#dayHabitList'); if(!scheduled.length) list.innerHTML='<div class="empty">No habits scheduled on this day.</div>';
    scheduled.forEach(h=>list.appendChild(todayHabitRow(h,d,()=>openDayDetail(k))));
    renderDayJournalBox(k);
  }
  function renderDayJournalBox(k){const box=$('#dayJournalBox'); if(!box)return; const j=state.journals[k];
    if(j){ box.innerHTML='<div class="dj-title">Journal</div>'; box.appendChild(journalNode(k,()=>openDayDetail(k))); }
    else { box.innerHTML=`<button class="btn-inline pink" id="addDayJournal">+ Add Journal</button>`; $('#addDayJournal').onclick=()=>{closeModal(); openJournalEditor(k);}; }
  }
  function renderJournals(){const box=$('#journalHistory'); if(!box)return; const items=Object.keys(state.journals).sort((a,b)=>b.localeCompare(a)).map(k=>({date:k})); renderPreview(box,items,x=>journalNode(x.date),'Journal History');}
  function openJournalEditor(k=todayKey()){const j=state.journals[k]||{mood:'',energy:5,text:''}; openModal('Edit Journal',`<div class="form-grid journal-area"><div class="field"><label>Date</label><input type="date" id="journalDate" value="${k}"></div><div class="field"><label>Mood</label><div class="mood-row">${MOODS.map(m=>`<button class="mood ${j.mood===m?'active':''}" data-mood="${m}">${m}</button>`).join('')}</div></div><div class="field"><label>Energy Score</label><div class="energy-panel"><div class="range-value" id="modalEnergyValue">${j.energy}</div><div class="energy-scale"><input type="range" min="0" max="10" value="${j.energy}" id="modalEnergy"><div class="ticks">${Array.from({length:11},(_,i)=>`<span style="left:calc(10px + ${i}/10*(100% - 20px))">${i}</span>`).join('')}</div></div></div></div><div class="field"><label>Reflection</label><textarea id="modalJournalText">${escapeHtml(j.text||'')}</textarea></div><div class="modal-actions"><button class="btn-secondary" data-close>Cancel</button><button class="btn-primary" id="saveJournalModal">Save</button></div></div>`); $$('.mood').forEach(b=>b.onclick=()=>{$$('.mood').forEach(x=>x.classList.remove('active')); b.classList.add('active')}); $('#modalEnergy').oninput=e=>$('#modalEnergyValue').textContent=e.target.value; $('#saveJournalModal').onclick=async()=>{const nk=$('#journalDate').value||k; if(nk!==k) delete state.journals[k]; state.journals[nk]={mood:$('#modalBody .mood.active')?.dataset.mood||'',energy:Number($('#modalEnergy').value),text:$('#modalJournalText').value.trim(),updatedAt:new Date().toISOString()}; await save(); closeModal(); toast('Journal saved')};}

  /* ---------- GIFT / LEVEL ---------- */
  function giftProgress(rule){
    const target=Number(rule.days||30);
    const streak=streakAt(hkNow(),Number(rule.pct||80));
    const earned=giftCount(rule);
    const remainder=streak%target;
    const current=earned>0 && remainder===0 ? target : remainder;
    return {current,target,pct:target?Math.min(100,Math.round(current/target*100)):0};
  }
  function renderTopProfile(){
    const li=levelInfo(); const icon=state.settings.profileIcon||''; const avatarEls=['#topProfileAvatar','#levelProfileAvatar','#settingsProfileAvatar']; avatarEls.forEach(sel=>{const el=$(sel); if(!el)return; if(icon){el.style.backgroundImage=`url(${icon})`; el.textContent='';}else{el.style.backgroundImage=''; el.textContent=li.cur.icon||'🌱';}});
    $('#topLevel').textContent='Lv '+li.cur.level; $('#topIdentity').textContent=li.cur.name; $('#topXp').textContent=fmtXp(li.xp)+' XP'; $('#topLevelFill').style.width=li.pct+'%'; const badge=$('#topGiftBadge'); if(badge) badge.textContent=(state.settings.rewards.giftRules||[]).reduce((s,g)=>s+giftCount(g),0);
  }
  function renderLevel(){
    ensureRewardShape(); const li=levelInfo(); renderTopProfile();
    if(!$('#levelPageValue'))return;
    $('#levelPageValue').textContent='Lv '+li.cur.level; $('#levelPageIdentity').textContent=(li.cur.icon||'🌱')+' '+li.cur.name; $('#levelPageFill').style.width=li.pct+'%'; $('#levelPageXp').textContent=`${fmtXp(li.xp)} XP · next: ${li.next.level===li.cur.level?'max tier':fmtXp(li.next.xp-li.xp)+' XP left'}`;
    $('#identityPath').innerHTML=identities.map(x=>`<div class="tier-card ${x.level===li.cur.level?'current':''}"><div class="tier-icon">${x.icon}</div><div><div class="tier-name">Lv ${x.level} · ${x.name}</div><div class="tier-sub">${x.xp} XP · ${x.desc}</div></div><span class="chip ${li.xp>=x.xp?'band-good':'band-none'}">${li.xp>=x.xp?'Unlocked':'Locked'}</span></div>`).join('');
    const xpItems=[]; state.records.filter(r=>afterStart(r.date)).forEach(r=>{const h=state.habits.find(x=>x.id===r.habitId)||{}; xpItems.push({date:r.date,at:r.at,desc:`${h.emoji||'✓'} ${h.name||'Habit'} completed`,xp:recordXp(r)});}); ledger().forEach(l=>{if(l.xp) xpItems.push({date:l.date,at:l.date,desc:l.desc,xp:l.xp});}); xpItems.sort((a,b)=>String(b.at).localeCompare(String(a.at))); renderPreview($('#xpHistory'),xpItems,xpNode,'XP History');
    renderGift();
  }
  function renderGift(){
    ensureRewardShape(); if(!$('#creditValue'))return; $('#creditValue').textContent='HK$'+creditTotal(); $('#streak80Value').textContent=streakAt(hkNow(),80);
    const totalGifts=(state.settings.rewards.giftRules||[]).reduce((s,g)=>s+giftCount(g),0); $('#giftUnlockValue').textContent=totalGifts; $('#giftUnlockSub').textContent='available gifts';
    const rules=state.settings.rewards.giftRules||[]; const bal=creditTotal();
    $('#redeemGrid').innerHTML=`<div class="gift-card credit-spend" style="grid-column:1/-1"><div class="card-head"><h3>Credit Spend</h3><span class="chip orange">HK$${bal} available</span></div><div class="redeem-form"><div class="field"><label>Redeemed For</label><input id="creditSpendText" placeholder="e.g. headphone, game, coffee"></div><div class="field"><label>Credit Amount</label><input id="creditSpendAmount" type="number" min="0" max="${bal}" step="1" value="${Math.min(10,bal)}"><input id="creditSpendSlider" type="range" min="0" max="${bal}" step="1" value="${Math.min(10,bal)}"><div class="inline-hint">Use the number box or slider. The maximum follows your current balance.</div></div><button class="btn-primary" id="spendCreditBtn" ${bal<=0?'disabled':''}>Redeem Credit</button></div></div>` + rules.map(g=>{const available=giftCount(g); const gp=giftProgress(g); return `<div class="gift-card"><div class="gift-icon">${g.icon||'🎁'}</div><div class="gift-title">${escapeHtml(g.gift||'Gift')}</div><div class="gift-sub">Balance: ${available} · Rule: ${g.days} days at ${g.pct}%+</div><div class="progress-mini" style="margin-top:10px"><span style="width:${gp.pct}%"></span></div><div class="gift-sub">Next gift progress: ${gp.current}/${gp.target} days</div><button class="btn-inline pink" style="margin-top:10px" data-redeem-gift="${g.id}" ${available<=0?'disabled':''}>Redeem Gift</button></div>`}).join('') + `<button class="btn-secondary" style="grid-column:1/-1" id="editGiftRulesBtn">Edit reward rules</button>`;
    const slider=$('#creditSpendSlider'), amount=$('#creditSpendAmount'); if(slider&&amount){slider.oninput=()=>amount.value=slider.value; amount.oninput=()=>{let v=Math.max(0,Math.min(bal,Number(amount.value||0))); amount.value=v; slider.value=v;};}
    $('#spendCreditBtn').onclick=async()=>{const amount=Number($('#creditSpendAmount').value); const what=$('#creditSpendText').value.trim(); if(!what){toast('Enter what you redeemed');return;} if(amount<=0){toast('Enter credit amount');return;} if(creditTotal()<amount){toast('Not enough credits');return;} state.redemptions.push({id:uid(),date:todayKey(),type:'redeemCredit',desc:'Credit spend · '+what,credit:-amount,xp:0,what}); await save(); toast('Credit redeemed')};
    $$('[data-redeem-gift]').forEach(b=>b.onclick=async()=>{const g=rules.find(x=>x.id===b.dataset.redeemGift); if(!g)return; if(giftCount(g)<=0){toast('Gift not unlocked yet');return;} state.redemptions.push({id:uid(),date:todayKey(),type:'redeemGift',desc:'Redeemed '+(g.gift||'Gift'),gift:g.gift||'Gift',giftIcon:g.icon||'🎁',giftRuleId:g.id,credit:0,xp:0}); await save(); toast('Gift redeemed')});
    $('#editGiftRulesBtn').onclick=()=>{rewardActiveTab='gift'; showView('settingsView'); setTimeout(renderSettings,0);};
    renderPreview($('#ledgerList'),ledger(),ledgerNode,'Reward Ledger');
  }

  /* ---------- SETTINGS ---------- */
  function renderSettings(){
    ensureRewardShape(); if(!$('#rewardSettings'))return; const r=state.settings.rewards;
    $('#rewardSettings').innerHTML=`<div class="segmented" id="rewardTabs" style="width:max-content"><button data-tab="credit" class="${rewardActiveTab==='credit'?'active':''}">Credit</button><button data-tab="gift" class="${rewardActiveTab==='gift'?'active':''}">Gift</button></div><div id="rewardPanel" class="form-grid" style="margin-top:12px"></div>`;
    function drawRewardPanel(tab=rewardActiveTab){
      rewardActiveTab=tab; const p=$('#rewardPanel');
      if(tab==='credit'){
        p.innerHTML=`<div class="field"><label>Credit Rules</label><div class="small-note">Each completion level can be used once. A 100% day also earns every lower level's reward.</div></div><div id="creditRulesBox"></div><button class="btn-secondary" id="addCreditRule">+ Add Credit Rule</button>`;
        const box=$('#creditRulesBox'); box.innerHTML='';
        (r.creditRules||[]).forEach((rule,idx)=>{const div=document.createElement('div'); div.className='rule-card'; div.innerHTML=`<div class="rule-card-head"><div class="rule-card-title">Credit Rule</div><span class="gift-rule-chip">HK$${rule.amount||0}</span></div><div class="rule-grid"><div class="field"><label>Completion</label><select data-pct>${[50,60,70,80,90,100].map(n=>`<option value="${n}">${n}%+</option>`).join('')}</select></div><div class="field"><label>Credit Amount</label><select data-amount>${[1,2,5,10,20,30,50,100].map(n=>`<option value="${n}">HK$${n}</option>`).join('')}</select></div></div><div class="rule-actions"><button class="btn-inline pink" data-save>Save</button><button class="btn-inline red" data-remove>Remove</button></div>`; div.querySelector('[data-pct]').value=rule.pct||100; div.querySelector('[data-amount]').value=rule.amount||10; div.querySelector('[data-save]').onclick=async()=>{const pct=Number(div.querySelector('[data-pct]').value); const dup=(r.creditRules||[]).some((x,i)=>i!==idx&&Number(x.pct)===pct); if(dup){toast('Duplicate completion %');return;} rule.pct=pct; rule.amount=Number(div.querySelector('[data-amount]').value); await save(); toast('Credit rule saved')}; div.querySelector('[data-remove]').onclick=async()=>{r.creditRules.splice(idx,1); await save(); toast('Credit rule removed')}; box.appendChild(div);});
        $('#addCreditRule').onclick=async()=>{const used=new Set((r.creditRules||[]).map(x=>Number(x.pct))); const pct=[50,60,70,80,90,100].find(x=>!used.has(x)); if(!pct){toast('All completion rules already used');return;} r.creditRules.push({id:uid(),pct,amount:pct>=100?10:2}); await save(); toast('Credit rule added')};
      } else {
        p.innerHTML=`<div class="field"><label>Gift Rules</label><div class="small-note">Unlock a gift for keeping a streak. Earned gifts appear on the Gift page.</div></div><div id="giftRulesBox"></div><button class="btn-secondary" id="addGiftRule">+ Add Gift Rule</button>`;
        const box=$('#giftRulesBox'); box.innerHTML='';
        (r.giftRules||[]).forEach((g,idx)=>{const div=document.createElement('div'); div.className='rule-card'; div.innerHTML=`<div class="rule-card-head"><div class="rule-card-title">Gift Rule</div><span class="gift-rule-chip">${g.icon||'🎁'} ${escapeHtml(g.gift||'Gift')}</span></div><div class="rule-grid"><div class="schedule-grid"><div class="field"><label>Icon</label><input data-icon value="${escapeAttr(g.icon||'🎁')}" maxlength="4" placeholder="🍽️"></div><div class="field"><label>Gift Name</label><input data-gift value="${escapeAttr(g.gift||'Buffet')}" placeholder="Buffet"></div></div><div class="schedule-grid"><div class="field"><label>Completion</label><select data-pct>${[50,60,70,80,90,100].map(n=>`<option value="${n}">${n}%+</option>`).join('')}</select></div><div class="field"><label>Consecutive Days</label><select data-days>${[7,14,21,30,45,60,90,120].map(n=>`<option value="${n}">${n} days</option>`).join('')}</select></div></div></div><div class="rule-actions"><button class="btn-inline pink" data-save>Save</button><button class="btn-inline red" data-remove>Remove</button></div>`; div.querySelector('[data-pct]').value=g.pct||80; div.querySelector('[data-days]').value=g.days||30; div.querySelector('[data-save]').onclick=async()=>{g.icon=div.querySelector('[data-icon]').value.trim()||'🎁'; g.gift=div.querySelector('[data-gift]').value.trim()||'Gift'; g.pct=Number(div.querySelector('[data-pct]').value); g.days=Number(div.querySelector('[data-days]').value); await save(); toast('Gift rule saved')}; div.querySelector('[data-remove]').onclick=async()=>{r.giftRules.splice(idx,1); await save(); toast('Gift rule removed')}; box.appendChild(div);});
        $('#addGiftRule').onclick=async()=>{r.giftRules=r.giftRules||[]; r.giftRules.push({id:uid(),gift:'Buffet',icon:'🍽️',pct:80,days:30}); await save(); toast('Gift rule added')};
      }
    }
    $('#rewardTabs').onclick=e=>{if(e.target.tagName!=='BUTTON')return; rewardActiveTab=e.target.dataset.tab; $$('#rewardTabs button').forEach(b=>b.classList.remove('active')); e.target.classList.add('active'); drawRewardPanel(rewardActiveTab);};
    drawRewardPanel(rewardActiveTab);

    renderPenaltySettings();

    $('#trackerStartDate').value=state.settings.startDate||todayKey(); $('#startDateDisplay').textContent=state.settings.startDate||todayKey(); $('#trackerStartDate').onchange=async()=>{state.settings.startDate=$('#trackerStartDate').value||todayKey(); await save(); toast('Start date updated')};
    renderTopProfile(); const upload=$('#profileIconInput'); if(upload){upload.onchange=e=>{const file=e.target.files&&e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=async()=>{state.settings.profileIcon=reader.result; await save(); toast('Profile icon updated')}; reader.readAsDataURL(file);};}
    $('#backupStatus').textContent=fileHandle?'Backup file connected. Edits will sync automatically when Auto Sync is on.':(state.settings.fileConnected?'A file was connected before. Reconnect if the browser asks for access.':'No backup file connected.'); if(!fileHandle) state.settings.autoSync=false; $('#autoSyncSwitch').classList.toggle('on',state.settings.autoSync); $('#autoSyncSwitch').disabled=!fileHandle; $('#reminderSwitch').classList.toggle('on',state.settings.reminders); $('#reminderSettings').innerHTML=`<div class="field"><label>Default Reminder Time</label><input type="time" id="globalReminderTime" value="${state.settings.globalReminderTime||'20:30'}"></div><div class="small-note">Habit-level reminder setup is ${state.settings.reminders?'available':'disabled'}.</div>`; $('#globalReminderTime').onchange=async()=>{state.settings.globalReminderTime=$('#globalReminderTime').value; await save(); setupReminderLoop();};
  }
  function renderPenaltySettings(){
    ensureRewardShape(); const r=state.settings.rewards; const box=$('#penaltySettings'); if(!box)return;
    box.innerHTML=`<div class="field"><label>Trigger</label><select id="penaltyZeroDays">${[1,2,3,4,5,7].map(n=>`<option value="${n}">${n} missed day${n>1?'s':''} in a row</option>`).join('')}</select></div><div class="schedule-grid"><div class="field"><label>Deduct Credit</label><select id="penaltyCredit">${[0,2,5,10,20,30,50].map(n=>`<option value="${n}">HK$${n}</option>`).join('')}</select></div><div class="field"><label>Deduct XP</label><select id="penaltyXp">${[0,10,20,30,50,100].map(n=>`<option value="${n}">${n} XP</option>`).join('')}</select></div></div><div class="small-note">Charged once each time you hit that many 0% days in a row.</div><button class="btn-primary" id="savePenaltyRules">Save Penalty Rules</button>`;
    $('#penaltyZeroDays').value=r.penaltyZeroDays||2; $('#penaltyCredit').value=r.penaltyCredit||5; $('#penaltyXp').value=r.penaltyXp||20;
    $('#savePenaltyRules').onclick=async()=>{r.penaltyZeroDays=Number($('#penaltyZeroDays').value); r.penaltyCredit=Number($('#penaltyCredit').value); r.penaltyXp=Number($('#penaltyXp').value); await save(); toast('Penalty rules saved')};
  }

  /* ---------- FILE SYNC ---------- */
  async function connectFile(){if(!window.showOpenFilePicker){toast('File connection needs Chrome/Edge on desktop. Use Export/Import instead.');return;} try{[fileHandle]=await window.showOpenFilePicker({types:[{description:'JSON Backup',accept:{'application/json':['.json']}}]}); const file=await fileHandle.getFile(); const txt=await file.text(); if(txt.trim()){state=JSON.parse(txt); normalizeState();} state.settings.fileConnected=true; await save(true); updateStatus(); renderAll(); toast('File connected');}catch(e){}}
  async function createFile(){if(!window.showSaveFilePicker){toast('Create file needs Chrome/Edge on desktop. Use Export instead.');return;} try{fileHandle=await window.showSaveFilePicker({suggestedName:'habit-tracker-backup.json',types:[{description:'JSON Backup',accept:{'application/json':['.json']}}]}); state.settings.fileConnected=true; state.settings.autoSync=true; await save(); toast('Backup file created');}catch(e){}}
  function exportJson(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='habit-tracker-backup.json'; a.click(); URL.revokeObjectURL(a.href)}
  function importJson(file){const r=new FileReader(); r.onload=async()=>{try{state=JSON.parse(r.result); normalizeState(); await save(true); renderAll(); toast('Imported')}catch(e){toast('Invalid JSON')}}; r.readAsText(file)}
  async function toggleReminders(){state.settings.reminders=!state.settings.reminders; if(state.settings.reminders && 'Notification' in window && Notification.permission==='default'){await Notification.requestPermission();} await save(); setupReminderLoop();}
  function setupReminderLoop(){if(reminderTimer)clearInterval(reminderTimer); if(!state.settings.reminders)return; reminderTimer=setInterval(()=>{const now=hkNow(); const hm=String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0"); state.habits.forEach(h=>{if(!h.reminder?.enabled||h.reminder.time!==hm||!isScheduledToday(h,now))return; const last=`${h.id}-${todayKey()}-${hm}`; if(sessionStorage.getItem(last))return; sessionStorage.setItem(last,'1'); if('Notification' in window && Notification.permission==='granted') new Notification('Habit Tracker',{body:`Reminder: ${h.name}`}); else toast(`Reminder: ${h.name}`);});},30000)}

  /* ---------- SHELL ---------- */
  function renderAll(){updateStatus(); renderHome(); renderHabits(); renderReport(); renderJournals(); renderLevel(); renderGift(); renderSettings();}
  function showXpPop(t){const p=document.createElement('div');p.className='xp-pop';p.textContent=t;document.body.appendChild(p);setTimeout(()=>p.remove(),1200)}
  function openModal(title,html){$('#modalTitle').textContent=title; $('#modalBody').innerHTML=html; $('#modalBackdrop').classList.add('show'); $$('[data-close]').forEach(b=>b.onclick=closeModal)}
  function closeModal(){$('#modalBackdrop').classList.remove('show')}
  function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
  function escapeAttr(s=''){return escapeHtml(s).replace(/'/g,'&#39;')}

  function showView(view){$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view)); $$('.view').forEach(v=>v.classList.remove('active')); const el=$('#'+view); if(el)el.classList.add('active'); const host=$('.view-host'); if(host)host.scrollTop=0; if(view==='reportView')renderReport(); if(view==='levelView')renderLevel(); if(view==='giftView')renderGift(); if(view==='settingsView')renderSettings();}
  $$('.nav-item').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  const fab=$('#fabAdd'); if(fab) fab.onclick=()=>openHabitModal();
  $('#profileQuick').onclick=()=>showView('levelView'); $('#topGiftBtn').onclick=()=>showView('giftView'); $('#topSettingsBtn').onclick=()=>showView('settingsView');
  $$('[data-open-habit]').forEach(b=>b.onclick=()=>openHabitModal()); $('#modalClose').onclick=closeModal; $('#modalBackdrop').onclick=e=>{if(e.target.id==='modalBackdrop')closeModal()};
  $('#resetTodayBtn').onclick=resetTodayRecords;
  const wp=$('#weekPrev'); if(wp)wp.onclick=()=>{weekOffset--; renderWeekStrip();}; const wn=$('#weekNext'); if(wn)wn.onclick=()=>{weekOffset++; renderWeekStrip();}; const wt=$('#weekToday'); if(wt)wt.onclick=()=>{weekOffset=0; renderWeekStrip();};
  $('#rangeTabs').onclick=e=>{if(e.target.tagName!=='BUTTON')return; trendDays=Number(e.target.dataset.days); $$('#rangeTabs button').forEach(b=>b.classList.remove('active')); e.target.classList.add('active'); drawTrend();};
  {const tp=$('#trendPrev'); if(tp)tp.onclick=()=>{trendCursor.setMonth(trendCursor.getMonth()-1); drawTrend();}; const tn=$('#trendNext'); if(tn)tn.onclick=()=>{const now=hkNow(); const c=new Date(trendCursor); c.setMonth(c.getMonth()+1); if(c.getFullYear()>now.getFullYear()||(c.getFullYear()===now.getFullYear()&&c.getMonth()>now.getMonth())){toast('Already at the latest month');return;} trendCursor=c; drawTrend();};}
  $('#reportMode').onclick=e=>{if(e.target.tagName!=='BUTTON')return; reportMode=e.target.dataset.mode; $$('#reportMode button').forEach(b=>b.classList.remove('active')); e.target.classList.add('active'); renderCalendar();};
  $('#reportPrev').onclick=()=>{reportCursor.setMonth(reportCursor.getMonth()-(reportMode==='month'?1:3)); renderCalendar();}; $('#reportNext').onclick=()=>{reportCursor.setMonth(reportCursor.getMonth()+(reportMode==='month'?1:3)); renderCalendar();};
  $('#connectFileBtn').onclick=connectFile; $('#createFileBtn').onclick=createFile; $('#disconnectFileBtn').onclick=async()=>{fileHandle=null; state.settings.fileConnected=false; state.settings.autoSync=false; await save(true); updateStatus(); renderSettings(); toast('Disconnected')}; $('#exportBtn').onclick=exportJson; $('#importInput').onchange=e=>e.target.files[0]&&importJson(e.target.files[0]); $('#autoSyncSwitch').onclick=async()=>{if(!fileHandle){state.settings.autoSync=false; toast('Connect a backup file first'); renderSettings(); return;} state.settings.autoSync=!state.settings.autoSync; await save();}; $('#reminderSwitch').onclick=toggleReminders;
  $('#resetAllBtn').onclick=()=>{if($('#confirmDeleteInput').value!=='Confirm'){toast('Type Confirm first');return;} if(confirm('Erase all Habit Tracker data?')){state=defaults(); localStorage.setItem(STORAGE,JSON.stringify(state)); fileHandle=null; renderAll(); toast('Data erased')}};
  document.body.addEventListener('click',e=>{const h=e.target.closest('[data-help]'); if(!h)return; const key=h.dataset.help; const content={rewardRules:`<div class="sheet-text"><h4>Reward rules</h4><p>Use this to turn discipline into a clear personal reward system.</p><ul><li><strong>Credit rules</strong>: reward when a day reaches configured completion percentages.</li><li><strong>Gift rules</strong>: unlock a configured gift after a chosen number of consecutive days above the selected percentage.</li><li><strong>Penalty</strong>: reduces credits and XP when zero-completion days repeat.</li></ul></div>`,fileSync:`<div class="sheet-text"><h4>Backup & sync (no account needed)</h4><p>Records are always saved in this browser first. File connection creates a JSON backup that can live in a cloud-synced folder — this is how the app syncs, with no Google login.</p><ol><li>Choose <strong>Create New File</strong> or <strong>Connect File</strong>.</li><li>Place or choose the backup file inside your <strong>Google Drive</strong>, OneDrive or iCloud desktop-synced folder.</li><li>Turn on <strong>Auto Sync</strong>.</li><li>Every edit writes to the connected file while permission remains active, and the cloud app syncs it across devices.</li></ol><p>File connection needs Chrome or Edge on desktop. On phones, use <strong>Export / Import JSON</strong> as the reliable backup path.</p></div>`,reminders:`<div class="sheet-text"><h4>Reminders</h4><p>Turn on reminders to enable habit-level reminder setup. Browser reminders work best when the page is open or installed to the home screen.</p></div>`,homeScreen:`<div class="sheet-text"><h4>Add to phone home screen</h4><h4>iPhone / Safari</h4><ol><li>Open this page in Safari.</li><li>Tap <strong>Share</strong>.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>.</li></ol><h4>Android / Chrome</h4><ol><li>Open this page in Chrome.</li><li>Tap the <strong>⋮</strong> menu.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li></ol></div>`}; openModal(h.textContent.trim()==='?'?'Help':'Setup Steps',content[key]||'');});
  setupReminderLoop(); renderAll();
})();
