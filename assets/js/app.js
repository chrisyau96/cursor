/* Habit & Journal — habits, journal, rewards. Google Drive is the backup. */
(()=>{
  const $=s=>document.querySelector(s); const $$=s=>Array.from(document.querySelectorAll(s));
  const STORAGE='habitTrackerProductionV7';
  const BACKUP_MIRROR='momentumBackupMirror';
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
    {level:3,xp:500,icon:'🌳',name:'Rooted Tree',desc:'Your routine has taken root and started to branch.'},
    {level:4,xp:700,icon:'🧭',name:'Focus Scout',desc:'You begin to protect your attention.'},
    {level:5,xp:1300,icon:'🔥',name:'Streak Keeper',desc:'Consistency is becoming visible.'},
    {level:6,xp:2200,icon:'⚔️',name:'Deep Work Warrior',desc:'You turn time into meaningful output.'},
    {level:7,xp:3400,icon:'🏗️',name:'System Builder',desc:'You rely on systems, not mood.'},
    {level:8,xp:5000,icon:'🛡️',name:'Discipline Guardian',desc:'Your routines defend your priorities.'},
    {level:9,xp:7200,icon:'🚀',name:'Momentum Master',desc:'Your progress compounds quickly.'},
    {level:10,xp:10000,icon:'👑',name:'Identity Anchor',desc:'Discipline is part of your identity.'},
    {level:11,xp:14000,icon:'🏆',name:'Freedom Operator',desc:'A one-year standard of strong completion.'}
  ];
  const ACCENTS=[
    {id:'indigo',brand:'#4f46e5',brand2:'#7c3aed'},
    {id:'violet',brand:'#8b5cf6',brand2:'#6d28d9'},
    {id:'sky',brand:'#0ea5e9',brand2:'#0284c7'},
    {id:'emerald',brand:'#10b981',brand2:'#059669'},
    {id:'teal',brand:'#14b8a6',brand2:'#0d9488'},
    {id:'amber',brand:'#f59e0b',brand2:'#d97706'},
    {id:'rose',brand:'#f43f5e',brand2:'#e11d48'}
  ];
  let fileHandle=null;
  let pauseModalDone=null;
  let settingsDraft=null;
  let rewardsDraft=null;
  let settingsPendingProfile=null;
  let habitModalSave=null;
  let lastTapKey='', lastTapAt=0;
  const FILE_HANDLE_DB='momentumFileHandles';
  const FILE_HANDLE_KEY='backup';
  let reminderTimer=null;
  let backupDebounceTimer=null;
  let backupSyncInFlight=false;
  let backupSyncQueued=false;
  const BACKUP_DEBOUNCE_MS=2000;
  let backupSyncState='idle';
  let backupTimestampPending=null;
  function currentReportMonth(){const n=hkNow(); return new Date(n.getFullYear(),n.getMonth(),1);}
  let reportCursor=currentReportMonth();
  let trendDays=7;
  let rewardActiveTab='credit';
  let weekOffset=0;
  let onboardStep=0;
  let lastLevel=1;
  let lastMainView='homeView';
  let lastRenderedTodayKey=todayKey();
  let dayRolloverTimer=null;
  const MAIN_VIEWS=new Set(['homeView','habitsView','reportView','rewardsView']);
  let state=load(); normalizeState();
  const ONBOARD_STEPS=[
    {title:'Welcome to Habit & Journal',body:'Build habits, reflect daily, and grow your identity. Connect Google Drive when you want a backup file in your Drive.',view:'homeView',layout:'fullscreen',label:'👋 Let\'s take a quick tour'},
    {title:'Today\'s progress',body:'The ring shows how much of today\'s scheduled habits you\'ve completed.',view:'homeView',target:'#todayRing',placement:'below',cardAnchor:'below',label:'Completion ring'},
    {title:'Log habits here',body:'Tap +1 on each habit. Swipe a row for undo or edit.',view:'homeView',target:'#todayHabitGroups',placement:'spotlight',cardAnchor:'top',label:'Today\'s habits'},
    {title:'Group setup',body:'Set up groups like Morning, Afternoon, or Evening before adding habits.',view:'habitsView',target:'#addGroupBtn',placement:'spotlight',cardAnchor:'near-bottom',label:'Group setup'},
    {title:'Habits tab',body:'Manage group setup, habit schedules, EXP rewards, and order.',view:'habitsView',target:'.tabbar .nav-item[data-view="habitsView"]',placement:'spotlight',cardAnchor:'near-bottom',highlightNav:'habitsView',label:'Habits'},
    {title:'Quick add',body:'Tap + anytime to create a new habit without leaving your current screen.',view:'homeView',target:'#fabAdd .fab-plus',placement:'spotlight',cardAnchor:'near-bottom',highlightFab:true,spotlightRound:true,label:'Add habit'},
    {title:'Reports',body:'Review trends, compare periods, and browse your calendar history.',view:'reportView',target:'.tabbar .nav-item[data-view="reportView"]',placement:'spotlight',cardAnchor:'near-bottom',highlightNav:'reportView',label:'Report'},
    {title:'Rewards',body:'Earn credits and unlock gifts from your completion rules.',view:'rewardsView',target:'.tabbar .nav-item[data-view="rewardsView"]',placement:'spotlight',cardAnchor:'near-bottom',highlightNav:'rewardsView',label:'Rewards'},
    {title:'Settings',body:'Reward rules, week start, Drive backup, and look and feel. You\'re ready!',view:'homeView',target:'#topSettingsBtn',placement:'spotlight',cardAnchor:'near-bottom',highlightSettings:true,label:'Settings',final:true}
  ];

  const ICON_EDIT='<svg viewBox="0 0 24 24" class="ai"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
  const ICON_DEL='<svg viewBox="0 0 24 24" class="ai"><path fill="currentColor" d="M6 7h12l-1 13.1A2 2 0 0 1 16 22H8a2 2 0 0 1-2-1.9L5 7h1zm3-3h6l1 2h4v2H2V6h4l1-2z"/></svg>';
  let habitModalDeleteId=null;
  const PREVIEW=3;
  const LAZY_CHUNK=10;
  const REMINDER_MSG_LIMIT=80;
  const APP_VERSION='v60';
  const WIDGET_HABIT_MAX=5;
  const iconBtn=(cls,svg,title)=>{const b=document.createElement('button'); b.className='act-btn '+cls; b.innerHTML=svg; b.title=title; b.setAttribute('aria-label',title); return b;};

  const USER_NAME_MAX=12;
  function rewardDefaults(includeGifts=false){return{creditRules:[{id:uid(),pct:50,amount:2},{id:uid(),pct:100,amount:10}],giftRules:includeGifts?[{id:uid(),gift:'Buffet',icon:'🍽️',pct:80,days:30}]:[],penaltyCredit:5,penaltyXp:20,penaltyZeroDays:1,penaltyMissPct:0};}
  function pickSettings(overrides={}){const gifts=overrides.includeGifts===true; const {includeGifts,...rest}=overrides; return{autoSync:false,autoBackup:false,dailyBackup:false,fileConnected:false,backupFileName:'',reminders:false,colorMode:'system',styleTheme:'vivid',accentColor:'indigo',weekStart:'mon',globalReminderTime:'20:30',profileIcon:'',userName:'',onboardingComplete:false,statusRowOpen:false,lastExportAt:'',lastBackupAt:'',lastScheduledBackupAt:'',vacations:[],dataMode:'real',defaultReminderMessage:'Time for {habit}!',driveConnected:false,driveEmail:'',driveBackupFreq:'daily',lastDriveBackupAt:'',driveFileId:'',driveFileName:'',googleClientId:'',googleAndroidClientId:'',adsRemoved:false,adsRemovedAt:'',admobAppId:'',admobBannerId:'',widget:{mode:'today',habitIds:[],layout:3},rewards:rewardDefaults(gifts),...rest};}
  function defaultGroups(){return[{id:uid(),name:'Morning',emoji:'🌅',color:'#ea580c',sortOrder:0},{id:uid(),name:'Afternoon',emoji:'☀️',color:'#ca8a04',sortOrder:1},{id:uid(),name:'Evening',emoji:'🌙',color:'#4f46e5',sortOrder:2}];}
  function hexToRgb(hex){const h=String(hex||'').replace('#',''); if(h.length!==6) return [79,70,229]; return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function mixHex(a,b,t){const A=hexToRgb(a), B=hexToRgb(b); const m=A.map((v,i)=>Math.round(v+(B[i]-v)*t)); return '#'+m.map(x=>x.toString(16).padStart(2,'0')).join('');}
  function freshState(opts={}){const keep=opts.keep||{}; return{habits:[],records:[],journals:{},redemptions:[],groups:defaultGroups(),settings:pickSettings({dataMode:'real',includeGifts:false,startDate:todayKey(),onboardingComplete:opts.onboardingComplete??true,colorMode:keep.colorMode||'system',styleTheme:keep.styleTheme||'vivid',userName:keep.userName||'',profileIcon:keep.profileIcon||'',adsRemoved:!!keep.adsRemoved,adsRemovedAt:keep.adsRemovedAt||'',googleClientId:keep.googleClientId||''})};}
  function demoState(opts={}){const keep=opts.keep||{};
    const habits=[
      {id:uid(),name:'Bible Time & Prayer',emoji:'📖',color:'#7c3aed',target:1,xpReward:5,frequency:{mode:'daily',days:[0,1,2,3,4,5,6]},reminder:{enabled:false,time:'07:15',message:''}},
      {id:uid(),name:'Morning Movement',emoji:'🏃',color:'#059669',target:1,xpReward:5,frequency:{mode:'daily',days:[1,2,3,4,5]},reminder:{enabled:false,time:'07:35',message:''}},
      {id:uid(),name:'Plan the Day',emoji:'📝',color:'#ea580c',target:1,xpReward:5,frequency:{mode:'daily',days:[1,2,3,4,5]},reminder:{enabled:false,time:'08:00',message:''}},
      {id:uid(),name:'Drink Water',emoji:'💧',color:'#0ea5e9',target:6,xpReward:10,frequency:{mode:'daily',days:[0,1,2,3,4,5,6]},reminder:{enabled:false,time:'12:00',message:''}},
      {id:uid(),name:'After-work Learning',emoji:'💻',color:'#2563eb',target:1,xpReward:5,frequency:{mode:'daily',days:[1,2,3,4]},reminder:{enabled:false,time:'20:30',message:''}},
      {id:uid(),name:'Weekend Deep Work',emoji:'🎯',color:'#4f46e5',target:1,xpReward:5,frequency:{mode:'daily',days:[6,0]},reminder:{enabled:false,time:'09:30',message:''}},
      {id:uid(),name:'Quarterly Review',emoji:'📚',color:'#9333ea',target:1,xpReward:5,frequency:{mode:'custom',period:'quarter',times:1,schedule:{type:'weekday',monthInPeriod:1,ordinal:1,weekday:3}},reminder:{enabled:false,time:'10:00',message:''}}
    ];
    const morningId=uid(); habits[0].groupId=morningId; habits[0].sortOrder=0; habits[1].groupId=morningId; habits[1].sortOrder=1; habits[2].groupId=morningId; habits[2].sortOrder=2;
    const groups=[{id:morningId,name:'Morning block',emoji:'🌅',color:'#ea580c',sortOrder:0}];
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
    return{habits,records,journals,redemptions:[],groups,settings:pickSettings({dataMode:'demo',includeGifts:true,startDate:dateKey(startD),onboardingComplete:opts.onboardingComplete??false,colorMode:keep.colorMode||'system',styleTheme:keep.styleTheme||'vivid',userName:keep.userName||'',profileIcon:keep.profileIcon||'',adsRemoved:!!keep.adsRemoved,adsRemovedAt:keep.adsRemovedAt||'',googleClientId:keep.googleClientId||''})};
  }
  function defaults(){return freshState({onboardingComplete:false});}
  function stateForMode(mode,opts={}){return mode==='real'?freshState(opts):demoState(opts);}
  function load(){try{const raw=localStorage.getItem(STORAGE);return raw?JSON.parse(raw):defaults()}catch(e){return defaults()}}
  function normalizeState(){
    state.settings=state.settings||{};
    if(!state.settings.startDate) state.settings.startDate=todayKey();
    if(state.settings.profileIcon===undefined) state.settings.profileIcon='';
    if(!state.settings.colorMode) state.settings.colorMode=state.settings.theme||'system';
    if(!state.settings.styleTheme) state.settings.styleTheme='vivid';
    state.settings.styleTheme='vivid';
    if(state.settings.userName===undefined) state.settings.userName='';
    if(!state.settings.weekStart) state.settings.weekStart='mon';
    if(!state.settings.accentColor) state.settings.accentColor='indigo';
    if(state.settings.driveFileName===undefined) state.settings.driveFileName='';
    if(state.settings.onboardingComplete===undefined) state.settings.onboardingComplete=state.habits.length>2;
    if(!state.settings.dataMode) state.settings.dataMode='real';
    if(state.settings.lastBackupAt===undefined) state.settings.lastBackupAt='';
    if(state.settings.lastScheduledBackupAt===undefined) state.settings.lastScheduledBackupAt='';
    if(state.settings.backupFileName===undefined) state.settings.backupFileName='';
    if(state.settings.autoBackup===undefined){
      state.settings.autoBackup=state.settings.dailyBackup!==false||!!state.settings.fileConnected;
      if(state.settings.autoSync){ state.settings.autoBackup=true; state.settings.autoSync=false; }
    }
    state.settings.dailyBackup=!!state.settings.autoBackup;
    if(state.settings.statusRowOpen===undefined) state.settings.statusRowOpen=false;
    if(!Array.isArray(state.settings.vacations)) state.settings.vacations=[];
    state.groups=state.groups||[];
    state.habits=state.habits||[]; state.records=state.records||[]; state.journals=state.journals||{}; state.redemptions=state.redemptions||[];
    state.habits.forEach((h,i)=>{h.target=Number(h.target||1); h.xpReward=Math.max(1,Math.round(Number(h.xpReward)||5)); h.frequency=h.frequency||{mode:'daily',days:[0,1,2,3,4,5,6]}; if(!h.frequency.schedule&&h.frequency.mode!=='daily') h.frequency.schedule={type:'any'}; if(h.frequency.mode==='daily'&&!h.frequency.schedule) h.frequency.schedule={type:'days'}; if(h.sortOrder===undefined) h.sortOrder=i; if(h.paused===undefined) h.paused=false; if(h.archived===undefined) h.archived=false; if(h.groupId===undefined) h.groupId=null; h.reminder=h.reminder||{enabled:false,time:state.settings.globalReminderTime||'20:30',message:'',daysBeforeDue:1}; if(h.reminder.message===undefined) h.reminder.message='';     if(h.reminder.daysBeforeDue===undefined) h.reminder.daysBeforeDue=1;});
    if(!state.settings.defaultReminderMessage) state.settings.defaultReminderMessage='Time for {habit}!';
    if(state.settings.driveConnected===undefined) state.settings.driveConnected=false;
    if(state.settings.driveEmail===undefined) state.settings.driveEmail='';
    if(!state.settings.driveBackupFreq) state.settings.driveBackupFreq='daily';
    if(state.settings.lastDriveBackupAt===undefined) state.settings.lastDriveBackupAt='';
    if(state.settings.driveFileId===undefined) state.settings.driveFileId='';
    if(state.settings.googleClientId===undefined) state.settings.googleClientId='';
    if(state.settings.googleAndroidClientId===undefined) state.settings.googleAndroidClientId='';
    if(!state.settings.widget) state.settings.widget={mode:'today',habitIds:[],layout:3};
    state.settings.widget=window.MomentumLaunchCore?window.MomentumLaunchCore.normalizeWidgetConfig(state.settings.widget):state.settings.widget;
    if(state.settings.adsRemoved===undefined) state.settings.adsRemoved=false;
    if(state.settings.adsRemovedAt===undefined) state.settings.adsRemovedAt='';
    if(state.settings.admobAppId===undefined) state.settings.admobAppId='';
    if(state.settings.admobBannerId===undefined) state.settings.admobBannerId='';
    delete state.settings.appIcon;
    delete state.settings.appIconCustom;
    state.groups.forEach((g,i)=>{if(!g.id)g.id=uid(); if(g.sortOrder===undefined) g.sortOrder=i; if(!g.emoji)g.emoji='📋'; if(!g.color)g.color='#4f46e5';});
    ensureRewardShape(); localStorage.setItem(STORAGE,JSON.stringify(state));
  }
  function isVacationDay(k){return (state.settings.vacations||[]).some(v=>k>=v.from&&k<=v.to);}
  function activeHabits(){return state.habits.filter(h=>!h.archived);}
  function haptic(){try{navigator.vibrate?.(12);}catch(e){}}
  function greetName(){return '';}
  function timeGreeting(){const h=new Date().getHours(); if(h<12) return 'Good morning'; if(h<18) return 'Good afternoon'; return 'Good evening';}
  function accentOf(id){return ACCENTS.find(a=>a.id===id)||ACCENTS[0];}
  function sortedGroups(){return [...state.groups].sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));}
  function habitsInGroup(gid){return activeHabits().filter(h=>h.groupId===gid&&!h.paused).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));}
  function ungroupedHabits(){return activeHabits().filter(h=>!h.groupId&&!h.paused).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));}
  function applyAppearance(){
    const mode=state.settings.colorMode||'system';
    const dark=mode==='dark'||(mode==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);
    const accent=accentOf(state.settings.accentColor||'indigo');
    const root=document.documentElement;
    const brand=accent.brand, brand2=accent.brand2;
    const soft=dark?mixHex(brand,'#0b1120',0.78):mixHex(brand,'#ffffff',0.88);
    const soft2=dark?mixHex(brand2,'#0b1120',0.78):mixHex(brand2,'#ffffff',0.90);
    const bg=dark?mixHex(brand,'#0b1120',0.88):mixHex(brand,'#f4f6fb',0.55);
    const bg1=dark?mixHex(brand,'#0b1120',0.70):mixHex(brand,'#f4f6fb',0.62);
    const bg2=dark?mixHex(brand2,'#0b1120',0.66):mixHex(brand2,'#f4f6fb',0.68);
    const wash=dark?mixHex(brand,'#0b1120',0.82):mixHex(brand,'#ffffff',0.93);
    root.setAttribute('data-theme',dark?'dark':'light');
    root.setAttribute('data-style','vivid');
    root.setAttribute('data-accent',accent.id);
    root.style.setProperty('--brand',brand);
    root.style.setProperty('--brand2',brand2);
    root.style.setProperty('--pink',brand);
    root.style.setProperty('--purple',brand2);
    root.style.setProperty('--brand-soft',soft);
    root.style.setProperty('--soft-pink',soft);
    root.style.setProperty('--soft-purple',soft2);
    root.style.setProperty('--bg',bg);
    root.style.setProperty('--bg1',bg1);
    root.style.setProperty('--bg2',bg2);
    root.style.setProperty('--wash',wash);
    root.style.setProperty('--brand-text',dark?'#e8edf7':brand);
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content',brand);
  }
  function applyTheme(){applyAppearance();}
  function resetDefaultAppIcons(){
    const manifestLink=document.querySelector('link[rel="manifest"]');
    if(manifestLink && !manifestLink.getAttribute('href')?.includes('manifest.webmanifest')) manifestLink.href='manifest.webmanifest';
    [['#appFavicon','assets/icon.svg'],['#appFavicon192','assets/icon-192.png'],['#appAppleIcon','assets/icon-180.png']].forEach(([sel,href])=>{const el=$(sel); if(el) el.href=href;});
  }
  async function save(skipSync=false, options={}){
    localStorage.setItem(STORAGE,JSON.stringify(state));
    localStorage.setItem(BACKUP_MIRROR,JSON.stringify(state));
    if(options.celebrate!==false) checkCelebrations();
    const mode=options.render ?? 'none';
    if(mode==='all') renderAll();
    else if(mode==='active') renderAfterSave(null);
    else if(mode!=='none') renderAfterSave(mode);
    else { updateStatus(); renderTopProfile(); refreshEconomyDisplays(); }
    if(!skipSync) queueBackupSync();
    if(window.MomentumLaunch?.onStateSaved) void window.MomentumLaunch.onStateSaved();
  }
  function toast(msg,duration=1600){const t=$('#toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); clearTimeout(toast._timer); toast._timer=setTimeout(()=>t.classList.remove('show'),duration);}
  function showHelpSheet(title,text){
    const bd=$('#helpSheetBackdrop'), body=$('#helpSheetBody'), titleEl=$('#helpSheetTitle');
    if(!bd||!body||!text) return;
    if(titleEl){
      if(title){ titleEl.textContent=title; titleEl.hidden=false; }
      else titleEl.hidden=true;
    }
    body.textContent=text;
    bd.classList.add('show');
    bd.setAttribute('aria-hidden','false');
    document.body.classList.add('help-sheet-open');
  }
  function closeHelpSheet(){
    const bd=$('#helpSheetBackdrop');
    if(!bd) return;
    bd.classList.remove('show');
    bd.setAttribute('aria-hidden','true');
    document.body.classList.remove('help-sheet-open');
  }
  function backupEnabled(){return !!state.settings.driveConnected;}
  function maybeRenderBackupStatus(){ if($('#settingsView')?.classList.contains('active')) renderBackupStatus(); }
  function backupPayload(){
    if(settingsDirty()){
      const raw=localStorage.getItem(STORAGE);
      const payload=raw?JSON.parse(raw):JSON.parse(JSON.stringify(state));
      payload.settings=payload.settings||{};
      payload.settings.fileConnected=!!state.settings.fileConnected;
      payload.settings.autoBackup=!!state.settings.autoBackup;
      payload.settings.dailyBackup=!!state.settings.dailyBackup;
      if(state.settings.backupFileName) payload.settings.backupFileName=state.settings.backupFileName;
      if(state.settings.lastBackupAt) payload.settings.lastBackupAt=state.settings.lastBackupAt;
      return payload;
    }
    return state;
  }
  async function ensureBackupConnection(){
    if(!fileHandle && state.settings.fileConnected){
      const stored=await loadStoredFileHandle();
      if(stored) applyStoredFileHandle(stored);
    }
    if(fileHandle && await canWriteBackup()) return true;
    if(!state.settings.fileConnected) return false;
    return reconnectStoredFile(true);
  }
  function queueBackupSync(){
    if(window.MomentumLaunch?.queueDriveBackup) window.MomentumLaunch.queueDriveBackup();
  }
  function backupSyncDebounceHint(){
    if(!state.settings.autoBackup) return;
    backupSyncState='queued';
    updateStatus();
  }
  async function flushBackupSync(){
    if(!state.settings.autoBackup) return;
    if(backupSyncInFlight){ backupSyncQueued=true; return; }
    backupSyncInFlight=true;
    backupSyncQueued=false;
    backupSyncState='syncing';
    updateStatus();
    try{
      const ready=await ensureBackupConnection();
      if(!ready){
        backupSyncState=state.settings.fileConnected?'pending':'idle';
        updateStatus();
        return;
      }
      let ok=await writeBackupFile(true);
      if(!ok){
        await new Promise(r=>setTimeout(r,800));
        ok=await writeBackupFile(true);
      }
      backupSyncState=ok?'ok':'error';
      updateStatus();
      maybeRenderBackupStatus();
    }finally{
      backupSyncInFlight=false;
      if(backupSyncQueued) void flushBackupSync();
    }
  }
  async function canWriteBackup(){
    if(!fileHandle) return false;
    if(fileHandle.queryPermission) return (await fileHandle.queryPermission({mode:'readwrite'}))==='granted';
    return true;
  }
  async function writeBackupFile(silent=true){
    if(!fileHandle) return false;
    if(!(await canWriteBackup())) return false;
    try{
      const payload=backupPayload();
      const syncedAt=new Date().toISOString();
      payload.settings=payload.settings||{};
      payload.settings.lastBackupAt=syncedAt;
      payload.settings.fileConnected=true;
      payload.settings.autoBackup=!!state.settings.autoBackup;
      payload.settings.dailyBackup=!!state.settings.dailyBackup;
      if(state.settings.backupFileName) payload.settings.backupFileName=state.settings.backupFileName;
      const w=await fileHandle.createWritable();
      await w.write(JSON.stringify(payload,null,2));
      backupTimestampPending=syncedAt;
      persistBackupTimestamp(syncedAt);
      await w.close();
      backupSyncState='ok';
      updateStatus();
      maybeRenderBackupStatus();
      if(!silent) refreshSettingsChrome();
      return true;
    }catch(e){
      backupSyncState='error';
      if(!silent){ toast('Backup sync needs reconnection'); state.settings.fileConnected=false; updateStatus(); }
      return false;
    }
  }
  function weekStartDow(){const v=state.settings.weekStart||'mon'; if(v==='sat') return 6; if(v==='sun') return 0; return 1;}
  function dowOrder(){const start=weekStartDow(); return [0,1,2,3,4,5,6].map(i=>(start+i)%7);}
  function weekdayOffset(dow){return (Number(dow)-weekStartDow()+7)%7;}
  function weekStart(date){const d=new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate()-((d.getDay()-weekStartDow()+7)%7)); return d;}
  function weekKey(date){return dateKey(weekStart(date));}
  function fmtDueShort(k){const d=parseDate(k); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});}
  function daysUntilDue(dueKey,now=hkNow()){
    const today=parseDate(dateKey(now));
    const due=parseDate(dueKey);
    return Math.round((due-today)/86400000);
  }
  function fmtDueRelative(dueKey,now=hkNow()){
    const diff=daysUntilDue(dueKey,now);
    if(diff<=0) return 'today';
    if(diff===1) return 'tmr';
    return `in ${diff+1} days`;
  }
  function isNotSpecific(habit){const f=habit.frequency||{}; if(f.mode==='daily') return f.schedule?.type==='any'; return !f.schedule||f.schedule.type==='any';}
  function touchBackupTimestamp(){return persistBackupTimestamp();}
  function persistBackupTimestamp(iso){
    const ts=iso||new Date().toISOString();
    state.settings.lastBackupAt=ts;
    state.settings.fileConnected=true;
    try{
      const stored=JSON.parse(localStorage.getItem(STORAGE)||'{}');
      stored.settings=stored.settings||{};
      stored.settings.lastBackupAt=ts;
      stored.settings.fileConnected=true;
      localStorage.setItem(STORAGE,JSON.stringify(stored));
      localStorage.setItem(BACKUP_MIRROR,JSON.stringify(stored));
    }catch(e){
      localStorage.setItem(STORAGE,JSON.stringify(state));
      localStorage.setItem(BACKUP_MIRROR,JSON.stringify(state));
    }
    backupTimestampPending=null;
    return ts;
  }
  async function reconcileBackupTimestampFromFile(){
    if(!fileHandle) return;
    try{
      const data=JSON.parse(await (await fileHandle.getFile()).text());
      const fileTs=data?.settings?.lastBackupAt||'';
      const localTs=state.settings.lastBackupAt||'';
      if(fileTs && (!localTs || fileTs>localTs)) persistBackupTimestamp(fileTs);
    }catch(e){}
  }
  function formatBackupTime(iso){if(!iso)return'—'; try{const d=new Date(iso); return d.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return'—';}}
  function habitDueDate(habit,date=hkNow()){
    const f=habit.frequency||{};
    if(f.mode==='daily'){
      const ws=weekStart(date);
      if(f.schedule?.type==='any'){
        const due=new Date(ws); due.setDate(ws.getDate()+6);
        return dateKey(due);
      }
      const days=(f.days||[]).length?f.days:[0,1,2,3,4,5,6];
      const todayOff=weekdayOffset(date.getDay());
      const offsets=days.map(weekdayOffset).sort((a,b)=>a-b);
      const future=offsets.filter(o=>o>=todayOff);
      const off=future.length?Math.max(...future):Math.max(...offsets);
      const due=new Date(ws); due.setDate(ws.getDate()+off);
      return dateKey(due);
    }
    if(f.mode==='monthly'||(f.mode==='custom'&&f.period==='month')){
      const y=date.getFullYear(), m=date.getMonth();
      if(!f.schedule||f.schedule.type==='any') return dateKey(new Date(y,m+1,0));
      if(f.schedule.type==='date'){const last=daysInMonth(y,m); const day=Math.min(Number(f.schedule.day||1),last); return dateKey(new Date(y,m,day));}
      const ord=f.schedule.ordinal==='last'?'last':Number(f.schedule.ordinal||1);
      const wd=Number(f.schedule.weekday||1);
      for(let d=daysInMonth(y,m);d>=1;d--){const dt=new Date(y,m,d); const o=ordinalOfWeekday(dt); if(dt.getDay()===wd&&(ord==='last'?o==='last':o===ord)) return dateKey(dt);}
      return dateKey(new Date(y,m+1,0));
    }
    if(f.mode==='custom'&&f.period==='quarter'){
      const qi=Math.floor(date.getMonth()/3), y=date.getFullYear();
      if(!f.schedule||f.schedule.type==='any') return dateKey(new Date(y,qi*3+3,0));
      return dateKey(new Date(y,date.getMonth(),Math.min(Number(f.schedule.day||1),daysInMonth(y,date.getMonth()))));
    }
    if(f.mode==='custom'&&f.period==='year'){
      if(!f.schedule||f.schedule.type==='any') return `${date.getFullYear()}-12-31`;
      return dateKey(new Date(date.getFullYear(),11,31));
    }
    return dateKey(date);
  }
  function ensureFlexPeriod(habit,date=hkNow()){
    if(!isNotSpecific(habit)) return false;
    const today=dateKey(date);
    if(!habit.flexPeriodStart) habit.flexPeriodStart=dateKey(weekStart(date));
    let changed=false;
    while(true){
      const start=habit.flexPeriodStart;
      const end=habitDueDate(habit,parseDate(start));
      if(today<=end) break;
      const next=new Date(parseDate(end));
      next.setDate(next.getDate()+1);
      habit.flexPeriodStart=dateKey(next);
      changed=true;
    }
    return changed;
  }
  function flexWindow(habit,date=hkNow()){ensureFlexPeriod(habit,date); const start=habit.flexPeriodStart||dateKey(weekStart(date)); return {start,end:habitDueDate(habit,parseDate(start))};}
  function reportDayRange(){
    const end=hkNow();
    const start=new Date(end);
    start.setDate(start.getDate()-(trendDays-1));
    return {from:dateKey(start),to:dateKey(end),label:`Last ${trendDays} days`};
  }
  function habitChartRange(){
    return reportDayRange();
  }
  function habitCompletionStats(habit,fromK,toK){
    const f=habit.frequency||{};
    let completed=0,total=0;
    const a=parseDate(fromK), b=parseDate(toK);
    if(f.mode==='daily' && !isNotSpecific(habit)){
      for(let d=new Date(a); d<=b; d.setDate(d.getDate()+1)){
        const k=dateKey(d);
        if(!afterStart(k)||isVacationDay(k)) continue;
        if(!(f.days||[]).includes(d.getDay())) continue;
        total++;
        if(todayHabitCount(habit,d)>=periodTarget(habit)) completed++;
      }
    } else if(isNotSpecific(habit)){
      const seen=new Set();
      let cursor=new Date(a);
      while(cursor<=b){
        ensureFlexPeriod(habit,cursor);
        const {start,end}=flexWindow(habit,cursor);
        const key=start+'|'+end;
        if(!seen.has(key) && end>=fromK && start<=toK){
          seen.add(key);
          total++;
          const cnt=state.records.filter(r=>r.habitId===habit.id&&r.date>=start&&r.date<=end).length;
          if(cnt>=periodTarget(habit)) completed++;
        }
        const next=parseDate(end); next.setDate(next.getDate()+1);
        cursor=next;
      }
    } else {
      const seen=new Set();
      for(let d=new Date(a); d<=b; d.setDate(d.getDate()+1)){
        const k=dateKey(d);
        if(!afterStart(k)||isVacationDay(k)) continue;
        if(!periodMonthAllowed(f,d)) continue;
        if(f.schedule && f.schedule.type!=='any' && !matchesScheduleRule(f,d)) continue;
        const pk=currentPeriodKey(habit,d);
        if(seen.has(pk)) continue;
        seen.add(pk);
        total++;
        if(periodCount(habit,d)>=periodTarget(habit)) completed++;
      }
    }
    return {completed,total,rate:total?Math.round(completed/total*100):0};
  }
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
    if(!s.type || s.type==='any') return ' · Not Specific';
    let monthPart='';
    if(f.mode==='custom'&&f.period==='quarter') monthPart = String(s.monthInPeriod||'1')==='any' ? ' · every month in quarter' : ` · month ${Number(s.monthInPeriod||1)} of quarter`;
    if(f.mode==='custom'&&f.period==='year') monthPart = String(s.monthInYear||'1')==='any' ? ' · every month' : ` · ${new Date(2026,Number(s.monthInYear||1)-1,1).toLocaleDateString([], {month:'short'})}`;
    if(s.type==='date') return `${monthPart} · day ${Number(s.day||1)}`;
    const ord=s.ordinal==='last'?'last':['','1st','2nd','3rd','4th'][Number(s.ordinal||1)]||`${s.ordinal}th`;
    return `${monthPart} · ${ord} ${DOW[Number(s.weekday||1)]}`;
  }
  function currentPeriodKey(habit,date=hkNow()){
    const f=habit.frequency||{mode:'daily',days:[0,1,2,3,4,5,6]};
    if(f.mode==='daily') return weekKey(date);
    if(f.mode==='monthly'||(f.mode==='custom'&&f.period==='month')) return monthKey(date);
    if(f.mode==='custom'&&f.period==='quarter') return quarterKey(date);
    if(f.mode==='custom'&&f.period==='year') return yearKey(date);
    return dateKey(date);
  }
  function periodTarget(habit){const f=habit.frequency||{}; return Number(habit.target||f.times||1);}
  function frequencyLabel(habit){
    const f=habit.frequency||{};
    const dueTxt=isNotSpecific(habit)?` · Due ${fmtDueRelative(habitDueDate(habit))}`:'';
    if(f.mode==='daily'){
      if(f.schedule?.type==='any') return `Weekly · Not Specific${dueTxt}`;
      return `Weekly · ${periodTarget(habit)}x/week`;
    }
    if(f.mode==='monthly')return `Monthly · ${periodTarget(habit)}x${scheduleLabel(f)}${dueTxt}`;
    if(f.mode==='custom')return `${(f.period||'period').replace(/^./,c=>c.toUpperCase())} · ${periodTarget(habit)}x${scheduleLabel(f)}${dueTxt}`;
    return 'Weekly';
  }
  function habitDueMarkup(h,now=hkNow()){return isNotSpecific(h)?`<span class="mini-dot"></span><span class="due-tag">Due ${fmtDueRelative(habitDueDate(h,now),now)}</span>`:'';}
  function isFlexibleHabit(habit,date=hkNow()){if(habit.paused||habit.archived||!afterStart(dateKey(date))) return false; if(!isNotSpecific(habit)) return false; ensureFlexPeriod(habit,date); if(!periodMonthAllowed(habit.frequency,date)) return false; return periodCount(habit,date)<periodTarget(habit);}
  function showsOnHomeToday(habit,date=hkNow()){if(habit.paused||habit.archived)return false;
    if(!afterStart(dateKey(date))) return false;
    if(isNotSpecific(habit)) return false;
    const f=habit.frequency||{};
    if(f.mode==='daily') return (f.days||[]).includes(date.getDay());
    if(!f.schedule || f.schedule.type==='any') return false;
    return matchesScheduleRule(f,date);
  }
  function isScheduledToday(habit,date=hkNow()){return showsOnHomeToday(habit,date)&&periodCount(habit,date)<periodTarget(habit);}
  function periodCount(habit,date=hkNow()){if(isNotSpecific(habit)){const {start,end}=flexWindow(habit,date); return state.records.filter(r=>r.habitId===habit.id&&r.date>=start&&r.date<=end).length;} const key=currentPeriodKey(habit,date); return state.records.filter(r=>r.habitId===habit.id && currentPeriodKey(habit,parseDate(r.date))===key).length}
  function todayHabitCount(habit,date=hkNow()){const k=dateKey(date); return state.records.filter(r=>r.habitId===habit.id && r.date===k).length}
  function dayScheduledHabits(date){
    if(!afterStart(dateKey(date))) return [];
    return activeHabits().filter(h=>showsOnHomeToday(h,date));
  }
  function dayPct(date){
    const scheduled=dayScheduledHabits(date);
    if(!scheduled.length) return null;
    let points=0,total=0;
    scheduled.forEach(h=>{
      const c=todayViewCompletion(h,date);
      points+=Math.min(c.count,c.target);
      total+=c.target;
    });
    return total?Math.round(points/total*100):null;
  }
  function completionOfHabit(habit,date=hkNow()){const target=periodTarget(habit); const count=periodCount(habit,date); return {count,target,pct:Math.min(100,Math.round(count/target*100)),done:count>=target};}
  function todayViewCompletion(habit,date=hkNow()){
    if(isNotSpecific(habit)) return completionOfHabit(habit,date);
    const f=habit.frequency||{};
    if(f.mode==='daily'){
      const count=todayHabitCount(habit,date);
      const target=periodTarget(habit);
      return {count,target,pct:target?Math.min(100,Math.round(count/target*100)):0,done:count>=target};
    }
    return completionOfHabit(habit,date);
  }
  function scheduleDayRolloverCheck(){
    clearTimeout(dayRolloverTimer);
    const now=hkNow();
    const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,1);
    dayRolloverTimer=setTimeout(()=>{ refreshForDayChange(true); scheduleDayRolloverCheck(); },Math.max(1000,next-now));
  }
  function refreshForDayChange(force=false){
    const today=todayKey();
    if(!force && today===lastRenderedTodayKey) return false;
    lastRenderedTodayKey=today;
    invalidateHomeCaches();
    weekOffset=0;
    const active=$('.view.active')?.id||'homeView';
    if(active==='homeView') renderHome();
    else if(active==='reportView') renderReport();
    else if(active==='rewardsView'){ renderRewards(); refreshEconomyDisplays(); }
    else if(active==='habitsView') renderHabits();
    else if(active==='levelView') renderLevel();
    else renderHome();
    updateStatus();
    return true;
  }
  function habitXpKey(habit,date){
    const f=habit.frequency||{};
    if(f.mode==='daily') return habit.id+'|'+dateKey(date);
    return habit.id+'|'+currentPeriodKey(habit,date);
  }
  function habitXpPerTap(habit){const total=Math.max(1,Math.round(Number(habit.xpReward)||5)); const target=Math.max(1,periodTarget(habit)); return Math.max(1,Math.round(total/target));}
  function habitPeriodXp(habit,date){
    const k=dateKey(date);
    if(isVacationDay(k)) return 0;
    const f=habit.frequency||{};
    if(f.mode==='daily'){
      const count=state.records.filter(r=>r.habitId===habit.id&&r.date===k&&afterStart(r.date)).length;
      if(!count) return 0;
      const target=Math.max(1,periodTarget(habit));
      const total=Math.max(1,Math.round(Number(habit.xpReward)||5));
      return Math.min(total, count*habitXpPerTap(habit));
    }
    const pk=currentPeriodKey(habit,date);
    const count=state.records.filter(r=>r.habitId===habit.id&&currentPeriodKey(habit,parseDate(r.date))===pk&&afterStart(r.date)).length;
    if(!count) return 0;
    const target=Math.max(1,periodTarget(habit));
    const total=Math.max(1,Math.round(Number(habit.xpReward)||5));
    return Math.min(total, count*habitXpPerTap(habit));
  }
  function recordsXpTotal(){
    const keys=new Set();
    state.records.filter(r=>afterStart(r.date)).forEach(r=>{
      const h=state.habits.find(x=>x.id===r.habitId); if(!h)return;
      keys.add(habitXpKey(h,parseDate(r.date)));
    });
    let total=0;
    keys.forEach(key=>{
      const hid=key.split('|')[0];
      const h=state.habits.find(x=>x.id===hid); if(!h)return;
      const sample=state.records.find(r=>r.habitId===hid&&habitXpKey(h,parseDate(r.date))===key);
      if(sample) total+=habitPeriodXp(h,parseDate(sample.date));
    });
    return total;
  }
  function journalXpTotal(){return Object.keys(state.journals).filter(k=>afterStart(k)&&!isVacationDay(k)).length*5;}
  function fmtXp(x){return String(Math.round(Number(x)||0));}
  function ensureRewardShape(){
    const r=state.settings.rewards=state.settings.rewards||{};
    if(!Array.isArray(r.creditRules)){
      if(r.creditRule) r.creditRules=[{id:uid(),pct:Number(r.creditRule.pct||100),amount:Number(r.creditRule.amount||10)}];
      else r.creditRules=[{id:uid(),pct:Number(r.primaryPct||50),amount:Number(r.primaryAmount||2)},{id:uid(),pct:100,amount:10}];
    }
    r.creditRules.forEach(c=>{if(!c.id)c.id=uid(); c.pct=Number(c.pct||100); c.amount=Number(c.amount||0);});
    if(!Array.isArray(r.giftRules)){
      if(r.streakGift) r.giftRules=[{id:uid(),gift:r.streakGift||'Gift',icon:'🍽️',pct:r.streakPct||80,days:r.streakDays||30}];
      else r.giftRules=[];
    }
    r.giftRules.forEach(g=>{if(!g.id)g.id=uid(); if(!g.icon)g.icon=(g.gift==='Buffet'?'🍽️':'🎁');});
    if(!r.activeGiftId || !r.giftRules.some(g=>g.id===r.activeGiftId)) r.activeGiftId=r.giftRules[0]?.id||null;
    if(r.penaltyCredit===undefined) r.penaltyCredit=5; if(r.penaltyXp===undefined) r.penaltyXp=20; if(r.penaltyZeroDays===undefined) r.penaltyZeroDays=1; if(r.penaltyMissPct===undefined) r.penaltyMissPct=0;
  }
  function autoLedger(){
    ensureRewardShape(); const rewards=state.settings.rewards; const entries=[];
    const redemptions=state.redemptions||[];
    const dates=[...new Set(state.records.map(r=>r.date).concat(Object.keys(state.journals)))].filter(afterStart).sort();
    dates.forEach(d=>{if(isVacationDay(d))return; const p=dayPct(parseDate(d)); if(p===null)return; (rewards.creditRules||[]).forEach(rule=>{if(p>=Number(rule.pct||100)){entries.push({id:`auto-credit-${rule.id}-${d}`,date:d,type:'credit',amount:Number(rule.amount||0),gift:'',desc:`${rule.pct}% daily completion`,credit:Number(rule.amount||0),xp:0});}});});
    (rewards.giftRules||[]).forEach(rule=>{dates.forEach(d=>{if(isVacationDay(d))return; const streak=streakAt(parseDate(d),Number(rule.pct||80)); if(streak>0 && streak%Number(rule.days||30)===0){entries.push({id:`auto-gift-${rule.id}-${d}`,date:d,type:'gift',amount:1,gift:rule.gift||'Gift',giftIcon:rule.icon||'🎁',giftRuleId:rule.id,desc:`${rule.days} days at ${rule.pct}%+ · ${rule.gift||'Gift'}`,credit:0,xp:120});}});});
    const ledgerCreditAt=(dk)=>Math.max(0,[...entries,...redemptions].filter(e=>e.date<=dk).reduce((s,e)=>s+(e.credit||0),0));
    const ledgerXpAt=(dk)=>Math.max(0,recordsXpTotal()+journalXpTotal()+[...entries,...redemptions].filter(e=>e.date<=dk).reduce((s,e)=>s+(e.xp||0),0));
    const start=parseDate(trackerStart()), end=hkNow();
    for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){
      if(isVacationDay(dateKey(d))) continue;
      const p=dayPct(d); if(!isMissDay(p,rewards.penaltyMissPct)) continue;
      const creditPen=Math.abs(Number(rewards.penaltyCredit||0));
      const xpPen=Math.abs(Number(rewards.penaltyXp||0));
      if(creditPen===0 && xpPen===0) continue;
      const dk=dateKey(d);
      const creditBal=ledgerCreditAt(dk);
      const xpBal=ledgerXpAt(dk);
      const creditDeduct=creditPen>0 && creditBal>0 ? -Math.min(creditPen,creditBal) : 0;
      const xpDeduct=xpPen>0 && xpBal>0 ? -Math.min(xpPen,xpBal) : 0;
      if(creditDeduct===0 && xpDeduct===0) continue;
      const miss=Number(rewards.penaltyMissPct||0);
      const why=miss>0?`Below ${miss}%`:`0% day`;
      entries.push({id:'auto-penalty-'+dk,date:dk,type:'penalty',desc:why,credit:creditDeduct,xp:xpDeduct});
    }
    return entries;
  }
  function activeGiftRule(){ensureRewardShape(); const r=state.settings.rewards; return (r.giftRules||[]).find(g=>g.id===r.activeGiftId)||null;}
  function ledger(){return autoLedger().concat(state.redemptions||[]).sort((a,b)=>b.date.localeCompare(a.date));}
  function xpTotal(){return Math.max(0,recordsXpTotal()+journalXpTotal()+ledger().reduce((s,l)=>s+(l.xp||0),0));}
  function creditTotal(){return Math.max(0,ledger().reduce((s,l)=>s+(l.credit||0),0));}
  function giftCount(rule){const id=typeof rule==='object'?rule.id:rule; const name=typeof rule==='object'?rule.gift:rule; return Math.max(0,ledger().filter(l=>l.type==='gift'&&((l.giftRuleId&&l.giftRuleId===id)||(!l.giftRuleId&&l.gift===name))).length - ledger().filter(l=>l.type==='redeemGift'&&((l.giftRuleId&&l.giftRuleId===id)||(!l.giftRuleId&&l.gift===name))).length)}
  function levelInfo(){const xp=xpTotal(); let cur=identities[0], next=identities[identities.length-1]; identities.forEach((l,i)=>{if(xp>=l.xp){cur=l; next=identities[i+1]||l;}}); const span=Math.max(1,next.xp-cur.xp); return {cur,next,xp,pct:cur===next?100:Math.min(100,Math.round((xp-cur.xp)/span*100))};}
  function streakAt(date,threshold=100){let s=0; const d=new Date(date); for(let i=0;i<366;i++){const k=dateKey(d); if(isVacationDay(k)){d.setDate(d.getDate()-1);continue;} const p=dayPct(d); if(p!==null && p>=threshold){s++; d.setDate(d.getDate()-1)} else break;} return s;}
  function longestPerfectStreak(){let max=0,cur=0; const start=parseDate(trackerStart()), end=hkNow(); for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){if(isVacationDay(dateKey(d))) continue; const p=dayPct(d); if(p!==null&&p>=100){cur++; max=Math.max(max,cur)}else if(p!==null) cur=0;} return max;}
  function isMissDay(p,missPct){if(p===null||p===undefined) return false; const t=Number(missPct); if(!Number.isFinite(t)||t<=0) return p===0; return p<t;}
  function zeroStreakAt(date){const missPct=Number(state.settings.rewards?.penaltyMissPct||0); let s=0; const d=new Date(date); for(let i=0;i<366;i++){const k=dateKey(d); if(isVacationDay(k)){d.setDate(d.getDate()-1);continue;} const p=dayPct(d); if(isMissDay(p,missPct)){s++; d.setDate(d.getDate()-1)} else break;} return s;}

  function pctClass(p){if(p>=100)return 'perfect'; if(p>=50)return 'partial'; return 'zero';}
  function updateStatus(){const sync=$('#syncStatus'), file=$('#fileStatus'), rem=$('#reminderStatus'); if(!sync)return; const connected=!!state.settings.driveConnected; const last=state.settings.lastDriveBackupAt||state.settings.lastBackupAt; sync.className='status-pill '+(connected?'on':''); sync.querySelector('span:last-child').textContent=connected?(last?'Drive synced':'Drive connected'):'Drive Off'; file.className='status-pill '+(connected?'on':''); file.querySelector('span:last-child').textContent=connected?(state.settings.driveFileName||'Drive file'):'No Drive file'; file.style.cursor='pointer'; rem.className='status-pill '+(state.settings.reminders?'on':''); rem.querySelector('span:last-child').textContent=state.settings.reminders?'Reminders On':'Reminders Off'; const wrap=$('#statusRowWrap'); if(wrap) wrap.classList.toggle('open',!!state.settings.statusRowOpen);}

  function refreshEconomyDisplays(){
    const bal=creditTotal();
    const li=levelInfo();
    const homeCredit=$('#homeCreditValue'); if(homeCredit) homeCredit.textContent='HK$'+bal;
    const creditVal=$('#creditValue'); if(creditVal) creditVal.textContent='HK$'+bal;
    const active=activeGiftRule();
    const activeAvail=active?giftCount(active):0;
    const giftVal=$('#giftUnlockValue'); if(giftVal) giftVal.textContent=activeAvail;
    const giftSub=$('#giftUnlockSub'); if(giftSub) giftSub.textContent=active?('of '+(active.gift||'Gift')):'no gift goal';
    const levelXp=$('#levelPageXp'); if(levelXp) levelXp.textContent=li.next.level===li.cur.level?`${fmtXp(li.xp)} EXP · Max tier reached`:`${fmtXp(li.xp)} / ${fmtXp(li.next.xp)} EXP · Next: ${li.next.icon} ${li.next.name}`;
    renderTopProfile();
    if($('#rewardsView')?.classList.contains('active')){
      const chip=$('#redeemGrid .chip.orange'); if(chip) chip.textContent='HK$'+bal+' available';
      const spend=$('#creditSpendAmount'), slider=$('#creditSpendSlider');
      if(spend && slider){ const v=Math.max(0,Math.min(bal,Number(spend.value||0))); spend.max=bal; slider.max=bal; spend.value=v; slider.value=v; }
      const spendBtn=$('#spendCreditBtn'); if(spendBtn){ spendBtn.disabled=bal<=0; spendBtn.classList.toggle('btn-dim',bal<=0); }
    }
  }
  function notifyEconomyGains(beforeCredit,beforeXp,habitXpGain=0){
    const afterCredit=creditTotal();
    const afterXp=xpTotal();
    const creditGain=afterCredit-beforeCredit;
    const ledgerXpGain=afterXp-beforeXp-habitXpGain;
    if(creditGain>0) toast(`+HK$${creditGain} credit earned`);
    if(ledgerXpGain>0) showXpPop('+'+fmtXp(ledgerXpGain)+' EXP');
    refreshEconomyDisplays();
  }

  function updateHomeSummary(now, scheduled){
    const paused=isVacationDay(dateKey(now));
    let completed=0,total=0; scheduled.forEach(h=>{const c=todayViewCompletion(h,now); completed+=Math.min(c.count,c.target); total+=c.target;});
    const todayPctVal=total?Math.round(completed/total*100):0;
    const ring=$('#todayRingFill'), ringText=$('#todayRingText');
    if(ring){
      const circ=97.4;
      if(paused){ ring.style.strokeDashoffset=String(circ); ring.style.stroke='var(--b-vacation)'; }
      else { ring.style.strokeDashoffset=String(circ-(circ*todayPctVal/100)); ring.style.stroke=todayPctVal>=100?'var(--green)':todayPctVal>=50?'var(--brand)':'var(--orange)'; }
    }
    if(ringText) ringText.textContent=paused?'⏸':todayPctVal+'%';
    $('#homeCreditValue').textContent='HK$'+creditTotal(); $('#homeCreditSub').textContent='available to redeem';
    const cur100=streakAt(now,100), best=longestPerfectStreak(); $('#homeStreakValue').textContent=`${cur100} / ${best}`; $('#homeStreakSub').textContent='current / best 100% streak';
    const ng=nextGiftInfo(); $('#homeNextGiftIcon').textContent=ng.icon; $('#homeNextGiftSub').textContent=ng.label; $('#homeNextGiftFill').style.width=ng.pct+'%';
  }
  function renderTodayPauseBanner(now=hkNow()){
    const banner=$('#todayPauseBanner'); if(!banner) return;
    const k=dateKey(now);
    const vac=isVacationDay(k);
    if(!vac){ banner.hidden=true; return; }
    const v=(state.settings.vacations||[]).find(x=>k>=x.from&&k<=x.to);
    banner.hidden=false;
    const sub=$('#todayPauseSub');
    if(sub) sub.textContent=v?`${v.label||'Pause'} · ${v.from} → ${v.to}`:'Tracking is frozen for today.';
  }
  function refreshGroupProgress(groupEl, groupId, scheduled, now){
    if(!groupEl)return;
    const hs=groupId==='_ungrouped'?scheduled.filter(h=>!h.groupId):scheduled.filter(h=>h.groupId===groupId);
    let done=0,tot=0; hs.forEach(h=>{const c=todayViewCompletion(h,now); done+=Math.min(c.count,c.target); tot+=c.target;});
    const prog=groupEl.querySelector('.group-progress'); if(prog) prog.textContent=`${done}/${tot}`;
  }
  function invalidateHomeCaches(){
    const box=$('#todayHabitGroups'); if(box) delete box.dataset.sig;
    const strip=$('#weekStrip'); if(strip) delete strip.dataset.sig;
  }
  function isDateInVisibleWeek(k){
    const base=hkNow();
    base.setDate(base.getDate()+weekOffset*7);
    const start=weekStart(base);
    const end=new Date(start);
    end.setDate(start.getDate()+6);
    const d=parseDate(k);
    return d>=start && d<=end;
  }
  function weekStripSig(){
    const base=hkNow();
    base.setDate(base.getDate()+weekOffset*7);
    const start=weekStart(base);
    const parts=[];
    for(let i=0;i<7;i++){
      const d=new Date(start);
      d.setDate(start.getDate()+i);
      parts.push(dayPct(d)??'x');
    }
    return weekOffset+'|'+todayKey()+'|'+parts.join(',');
  }
  function refreshCompletionViews(changedDate=todayKey()){
    const strip=$('#weekStrip');
    if(strip && isDateInVisibleWeek(changedDate)){
      delete strip.dataset.sig;
      renderWeekStrip();
      strip.dataset.sig=weekStripSig();
    }
    if($('#calendarGrid')) renderCalendar();
    if($('.view.active')?.id==='reportView') drawTrend();
    const modal=$('#modalBackdrop');
    if(modal?.classList.contains('show') && $('#dayHabitList')) openDayDetail(changedDate);
  }
  function habitRowWrap(habitId,date){
    const sel=`[data-habit-id="${habitId}"][data-date="${date}"]`;
    return document.querySelector(`button.check-btn${sel}`)?.closest('.swipe-wrap')
      || document.querySelector(`button.reset-habit-btn${sel}`)?.closest('.swipe-wrap')
      || document.querySelector(`.habit-row[data-habit-tap="${habitId}"][data-date="${date}"]`)?.closest('.swipe-wrap');
  }
  function refreshHomeAfterRecord(habitId, date=todayKey()){
    const recordDate=parseDate(date);
    const todayNow=hkNow();
    const todayHabits=activeHabits().filter(h=>showsOnHomeToday(h,todayNow));
    invalidateHomeCaches();
    updateHomeSummary(todayNow, todayHabits);
    refreshEconomyDisplays();
    const habit=state.habits.find(h=>h.id===habitId);
    if(habit && !isNotSpecific(habit)){
      const wrap=habitRowWrap(habitId,date);
      if(wrap){
        const after=wrap.dataset.afterKey?()=>openDayDetail(wrap.dataset.afterKey):null;
        const fresh=todayHabitRow(habit,recordDate,after);
        const groupEl=wrap.closest('.habit-group');
        wrap.replaceWith(fresh);
        const gid=habit.groupId||'_ungrouped';
        refreshGroupProgress(groupEl||fresh.closest('.habit-group'), gid, todayHabits, todayNow);
      }else if(date===todayKey()){
        renderTodayHabitGroups(todayNow, todayHabits);
      }
    }else if(date===todayKey()){
      renderTodayHabitGroups(todayNow, todayHabits);
    }
    renderFlexibleHabits(todayNow);
    refreshCompletionViews(date);
  }
  function homeTodaySig(now, homeHabits){
    const groupSig=sortedGroups().map(g=>g.id+':'+(g.sortOrder||0)+':'+(g.name||'')).join('|');
    const habitSig=homeHabits.map(h=>`${h.id}:${h.groupId||''}:${h.sortOrder||0}:${todayViewCompletion(h,now).count}`).join(',');
    return dateKey(now)+'|'+groupSig+'|'+habitSig;
  }
  function renderHome(){
    const now=hkNow(); const homeHabits=activeHabits().filter(h=>showsOnHomeToday(h,now));
    lastRenderedTodayKey=dateKey(now);
    $('#greeting').textContent=timeGreeting()+greetName();
    $('#todayEntryStamp').textContent=fmtDate(now);
    updateHomeSummary(now, homeHabits);
    const box=$('#todayHabitGroups');
    const sig=homeTodaySig(now, homeHabits);
    if(box && box.dataset.sig!==sig){box.dataset.sig=sig; renderTodayHabitGroups(now, homeHabits);}
    const strip=$('#weekStrip');
    const weekSig=weekStripSig();
    if(strip && strip.dataset.sig!==weekSig){strip.dataset.sig=weekSig; renderWeekStrip();}
    renderFlexibleHabits(now); renderHomeJournal(); renderQuote(); renderTopProfile(); renderTodayPauseBanner(now);
    const wt=$('#weekToday'); if(wt) wt.style.display=weekOffset===0?'none':'inline-grid';
  }
  function renderTodayHabitGroups(now, homeHabits){
    const box=$('#todayHabitGroups'); if(!box)return;
    box.innerHTML='';
    if(!homeHabits.length){box.innerHTML='<div class="empty"><div class="empty-icon">✨</div>No habits scheduled today.<button class="btn-primary empty-cta" data-open-habit>Add your first habit</button></div>'; $$('[data-open-habit]',box).forEach(b=>b.onclick=()=>openHabitModal()); return;}
    const used=new Set(); const groups=sortedGroups();
    groups.forEach(g=>{const hs=homeHabits.filter(h=>h.groupId===g.id); if(!hs.length)return; hs.forEach(h=>used.add(h.id)); box.appendChild(renderHabitGroupBlock(g,hs,now));});
    const rest=homeHabits.filter(h=>!used.has(h.id));
    if(rest.length) box.appendChild(renderHabitGroupBlock({id:'_ungrouped',name:'Ungrouped',emoji:'📌',color:'#66758c'},rest,now));
  }
  function renderHabitGroupBlock(group, habits, now){
    const wrap=document.createElement('div'); wrap.className='habit-group';
    let done=0,tot=0; habits.forEach(h=>{const c=todayViewCompletion(h,now); done+=Math.min(c.count,c.target); tot+=c.target;});
    const head=document.createElement('div'); head.className='group-head';
    head.innerHTML=`<div class="group-icon" style="background:${group.color}22;color:${group.color}">${group.emoji||'📋'}</div><div class="group-name">${escapeHtml(group.name||'Group')}</div><div class="group-progress">${done}/${tot}</div>`;
    wrap.classList.add('habit-group-block');
    wrap.appendChild(head);
    const list=document.createElement('div'); list.className='habit-list';
    habits.forEach(h=>list.appendChild(todayHabitRow(h,now)));
    wrap.appendChild(list); return wrap;
  }
  function attachSwipeRow(wrap,habit,dateKeyStr,after){
    let sx=0;
    wrap.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;},{passive:true});
    wrap.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx; if(dx<-40) wrap.classList.add('open'); else if(dx>40) wrap.classList.remove('open');},{passive:true});
    wrap.querySelector('[data-swipe-edit]');
    wrap.querySelector('[data-swipe-undo]');
  }
  async function undoLastTap(habitId,k){const recs=state.records.filter(r=>r.habitId===habitId&&r.date===k).sort((a,b)=>b.at.localeCompare(a.at)); if(!recs.length){toast('Nothing to undo');return;} state.records=state.records.filter(r=>r.id!==recs[0].id); await save(false,{render:'none'}); refreshHomeAfterRecord(habitId,k); toast('Undone last tap'); haptic();}
  function renderWeekStrip(){
    const strip=$('#weekStrip'); if(!strip)return;
    const base=hkNow(); base.setDate(base.getDate()+weekOffset*7);
    const start=weekStart(base);
    const tKey=todayKey(); strip.innerHTML='';
    for(let i=0;i<7;i++){
      const d=new Date(start); d.setDate(start.getDate()+i); const k=dateKey(d); const p=dayPct(d); const j=state.journals[k];
      const future=k>tKey; const vac=isVacationDay(k);
      const band = future?'band-future':vac?'band-vacation':(p===null?'band-none':'band-'+pctClass(p));
      const cell=document.createElement('button'); cell.className='wcell'+(k===tKey?' today':'');
      cell.innerHTML=`<span class="wdow">${DOW[d.getDay()][0]}</span><span class="wnum ${band}">${d.getDate()}</span><span class="wmeta"><span class="wmood">${j&&j.mood?j.mood:''}</span><span class="wscore">${j&&j.energy!==undefined&&j.energy!==''?j.energy:''}</span></span>`;
      cell.onclick=()=>openDayDetail(k);
      let holdTimer=null;
      cell.addEventListener('touchstart',()=>{holdTimer=setTimeout(()=>openDaySummary(k),500);},{passive:true});
      cell.addEventListener('touchend',()=>clearTimeout(holdTimer));
      cell.addEventListener('mousedown',()=>{holdTimer=setTimeout(()=>openDaySummary(k),500);});
      cell.addEventListener('mouseup',()=>clearTimeout(holdTimer));
      strip.appendChild(cell);
    }
    const label=$('#weekLabel'); if(label){const endd=new Date(start); endd.setDate(start.getDate()+6); label.textContent = weekOffset===0?'This week':`${start.getMonth()+1}/${start.getDate()} – ${endd.getMonth()+1}/${endd.getDate()}`;}
  }
  function todayHabitRow(h,now=hkNow(),after=null){
    const k=dateKey(now); const c=todayViewCompletion(h,now);
    const wrap=document.createElement('div'); wrap.className='swipe-wrap';
    const actions=document.createElement('div'); actions.className='swipe-actions';
    actions.innerHTML=`<button class="swipe-act undo" data-swipe-undo type="button">Undo</button><button class="swipe-act edit" data-swipe-edit type="button">Edit</button>`;
    const row=document.createElement('div'); row.className='habit-row '+(c.done?'done':'')+(h.paused?' paused-habit':'');
    row.innerHTML=`<div class="habit-icon" style="background:${h.color}22;color:${h.color}">${h.emoji}</div><div class="habit-main"><div class="habit-name"></div><div class="habit-meta"><span>${c.count}/${c.target}</span>${habitDueMarkup(h,now)}</div><div class="progress-mini"><span style="width:${c.pct}%;background:${h.color}"></span></div></div><button type="button" class="check-btn ${c.done?'done':''}" data-habit-id="${h.id}" data-date="${k}" ${c.done?'disabled':''} aria-label="Record ${escapeAttr(h.name)}">${c.done?'✓':'+1'}</button>${c.count?'<button type="button" class="icon-btn muted reset-habit-btn" data-reset="1" data-habit-id="'+h.id+'" data-date="'+k+'" title="Reset" aria-label="Reset habit">↺</button>':''}`;
    row.querySelector('.habit-name').textContent=h.name;
    row.dataset.habitTap=h.id;
    row.dataset.date=k;
    wrap.appendChild(actions); wrap.appendChild(row);
    const resetBtn=row.querySelector('.reset-habit-btn');
    if(resetBtn){
      resetBtn.addEventListener('click',e=>{
        e.preventDefault(); e.stopPropagation();
        resetHabitForDate(h.id,k);
        if(wrap.dataset.afterKey) openDayDetail(wrap.dataset.afterKey);
      });
    }
    if(after) wrap.dataset.afterKey=k;
    attachSwipeRow(wrap,h,k,after);
    return wrap;
  }
  function openDaySummary(k){const d=parseDate(k); const p=dayPct(d); const j=state.journals[k]; toast(`${fmtDate(d)} · ${isVacationDay(k)?'Paused':(p??'—')+'%'}${j?` · ${j.mood} ${j.energy}/10`:''}`);}
  function flexHabitsForHome(now=hkNow()){
    return activeHabits().filter(h=>{
      if(h.paused||h.archived||!isNotSpecific(h)) return false;
      if(!afterStart(dateKey(now))) return false;
      ensureFlexPeriod(h,now);
      return periodMonthAllowed(h.frequency,now);
    });
  }
  function renderFlexibleHabits(now=hkNow()){
    const card=$('#flexHabitCard'), list=$('#flexHabitGroups'); if(!card||!list)return;
    let rolled=false;
    activeHabits().forEach(h=>{if(ensureFlexPeriod(h,now)) rolled=true;});
    if(rolled) void save(true,{render:'none'});
    const flex=flexHabitsForHome(now);
    if(!flex.length){card.style.display='none'; return;}
    card.style.display='block';
    const unfinished=flex.reduce((s,h)=>s+Math.max(0,periodTarget(h)-completionOfHabit(h,now).count),0);
    $('#flexHabitSummary').textContent=`${unfinished} unfinished target${unfinished===1?'':'s'} this period`;
    list.innerHTML=''; flex.forEach(h=>list.appendChild(todayHabitRow(h,now)));
  }
  function nextGiftInfo(){
    const g=activeGiftRule(); if(!g) return {icon:'🎁',label:'No gift goal set',pct:0};
    const gp=giftProgress(g); return {icon:g.icon||'🎁',label:`${g.gift||'Gift'} · ${gp.current}/${gp.target} days`,pct:gp.pct};
  }
  async function addRecord(habitId,note='',date=todayKey()){
    const habit=state.habits.find(h=>h.id===habitId); if(!habit)return;
    const dt=parseDate(date);
    const c=todayViewCompletion(habit,dt);
    if(c.count>=c.target){toast('Target already completed'); return;}
    const beforeCredit=creditTotal();
    const beforeXp=xpTotal();
    const before=habitPeriodXp(habit,dt);
    state.records.push({id:uid(),habitId,date,at:new Date().toISOString(),note});
    const gained=habitPeriodXp(habit,dt)-before;
    haptic();
    refreshHomeAfterRecord(habitId, date);
    if(gained>0) showXpPop('+'+fmtXp(gained)+' EXP');
    notifyEconomyGains(beforeCredit,beforeXp,gained);
    const pct=dayPct(dt);
    void save(false,{render:'none'});
    if(pct===100) celebrate('Perfect day! 🎉');
    toast('Recorded');
  }
  async function removeRecord(id){const rec=state.records.find(r=>r.id===id); state.records=state.records.filter(r=>r.id!==id); await save(false,{render:'none'}); if(rec) refreshHomeAfterRecord(rec.habitId,rec.date); toast('Record removed')}
  async function removeRedemption(id){state.redemptions=state.redemptions.filter(r=>r.id!==id); await save(false,{render:'none'}); toast('Redemption removed')}
  function flashRuleCard(box){
    const cards=box?.querySelectorAll('.rule-card');
    const card=cards?.[cards.length-1];
    if(card){ card.classList.add('rule-flash'); card.scrollIntoView({block:'nearest',behavior:'smooth'}); setTimeout(()=>card.classList.remove('rule-flash'),900); }
  }
  function addCreditRule(){
    ensureRewardShape(); const r=state.settings.rewards;
    const used=new Set((r.creditRules||[]).map(x=>Number(x.pct)));
    const pct=[50,60,70,80,90,100].find(x=>!used.has(x));
    if(!pct){toast('All completion rules already used');return;}
    r.creditRules.push({id:uid(),pct,amount:pct>=100?10:2});
    drawRewardPanel('credit');
    flashRuleCard($('#creditRulesBox'));
    markSettingsDirty();
  }
  function addGiftRule(){
    ensureRewardShape(); const r=state.settings.rewards;
    r.giftRules=r.giftRules||[];
    r.giftRules.push({id:uid(),gift:'Buffet',icon:'🍽️',pct:80,days:30});
    drawRewardPanel('gift');
    flashRuleCard($('#giftRulesBox'));
    markSettingsDirty();
  }
  function removeCreditRule(idx){
    const r=state.settings.rewards;
    if(!r.creditRules?.[idx]) return;
    r.creditRules.splice(idx,1);
    drawRewardPanel('credit');
    markSettingsDirty();
  }
  function removeGiftRule(idx){
    const r=state.settings.rewards;
    if(!r.giftRules?.[idx]) return;
    r.giftRules.splice(idx,1);
    drawRewardPanel('gift');
    markSettingsDirty();
  }
  function resetHabitForDate(habitId,k){
    const beforeCredit=creditTotal();
    const beforeXp=xpTotal();
    state.records=state.records.filter(r=>!(r.date===k&&r.habitId===habitId));
    haptic();
    refreshHomeAfterRecord(habitId,k);
    notifyEconomyGains(beforeCredit,beforeXp,0);
    toast('Habit reset');
    void save(false,{render:'none'});
  }

  /* Shared: preview N rows + "View all" modal with lazy loading (10 at a time). */
  function renderPreview(box,items,itemFn,moreTitle,limit=PREVIEW){
    if(!box)return; box.innerHTML=''; if(!items.length){box.innerHTML='<div class="empty">Nothing here yet.</div>'; return;}
    items.slice(0,limit).forEach(x=>box.appendChild(itemFn(x)));
    const more=document.createElement('button'); more.className='view-all-btn'; more.textContent='View all'; more.onclick=()=>openLazyModal(moreTitle,items,itemFn); box.appendChild(more);
  }
  function openLazyModal(title,items,itemFn){
    const to=todayKey(); const from=trackerStart();
    openModal(title,`<div class="log-filter-grid"><div class="field"><label>From</label><input type="date" id="lfFrom" value="${from}"></div><div class="field"><label>To</label><input type="date" id="lfTo" value="${to}"></div><button class="btn-inline pink" id="lfApply">Apply</button></div><div class="filtered-list" id="lfList" style="margin-top:12px"></div><button class="btn-secondary load-more-btn" id="lfMore" style="display:none">Load more</button>`);
    let filtered=[], shown=0;
    const draw=(reset=true)=>{
      const f=$('#lfFrom').value||from,t=$('#lfTo').value||to; const box=$('#lfList');
      if(reset){filtered=items.filter(x=>x.date>=f&&x.date<=t); shown=0; box.innerHTML='';}
      if(!filtered.length){box.innerHTML='<div class="empty">No records in this period.</div>'; $('#lfMore').style.display='none'; return;}
      const chunk=filtered.slice(shown,shown+LAZY_CHUNK);
      chunk.forEach(x=>box.appendChild(itemFn(x)));
      shown+=chunk.length;
      const moreBtn=$('#lfMore');
      if(moreBtn) moreBtn.style.display=shown<filtered.length?'block':'none';
    };
    $('#lfApply').onclick=()=>draw(true);
    $('#lfMore').onclick=()=>draw(false);
    draw(true);
  }
  function openLedgerModal(title,items,itemFn){openLazyModal(title,items,itemFn);}
  function ledgerNode(x){const div=document.createElement('div'); div.className='ledger-item';
    const amt=x.credit?((x.credit>0?'+':'')+'HK$'+x.credit):((x.type==='gift'||x.type==='redeemGift')?((x.giftIcon||'🎁')+' '+(x.gift||'')):(x.xp?((x.xp>0?'+':'')+fmtXp(x.xp)+' EXP'):''));
    div.innerHTML=`<span class="led-date">${x.date}</span><span class="led-note">${escapeHtml(x.desc||'')}</span><span class="led-amt">${amt}</span>`;
    if(x.type==='redeemCredit'||x.type==='redeemGift'){const acts=document.createElement('div'); acts.className='row-actions'; const d=iconBtn('del',ICON_DEL,'Remove'); d.onclick=()=>confirm('Remove this redemption?')&&removeRedemption(x.id); acts.appendChild(d); div.appendChild(acts);}
    return div;}
  function xpNode(x){const div=document.createElement('div'); div.className='ledger-item'; div.innerHTML=`<div class="lg-main"><div class="ledger-head"><span>${escapeHtml(x.desc)}</span><span>${x.xp>0?'+':''}${fmtXp(x.xp)} EXP</span></div><div class="ledger-sub">${x.date}</div></div>`; return div;}
  function journalNode(k,after){const j=state.journals[k]||{}; const div=document.createElement('div'); div.className='journal-item';
    div.innerHTML=`<div class="j-main"><div class="journal-date"><span>${k}</span><span>${j.mood||''} ${j.energy}/10</span></div><div class="journal-text clamp2">${escapeHtml(j.text||'No reflection written.')}</div></div>`;
    const acts=document.createElement('div'); acts.className='row-actions';
    const e=iconBtn('edit',ICON_EDIT,'Edit'); e.onclick=()=>{if(after)closeModal(); openJournalEditor(k);};
    const d=iconBtn('del',ICON_DEL,'Delete'); d.onclick=async()=>{if(confirm('Delete this journal?')){delete state.journals[k]; await save(false,{render:'none'}); if(after)after();}};
    acts.appendChild(e); acts.appendChild(d); div.appendChild(acts); return div;}
  function editRecord(id){const r=state.records.find(x=>x.id===id); if(!r)return; openModal('Edit Record Note',`<div class="note-area"><textarea id="recordNoteInput" placeholder="Add note for this completion">${escapeHtml(r.note||'')}</textarea></div><div class="modal-actions"><button class="btn-secondary" data-close>Cancel</button><button class="btn-primary" id="saveRecordNote">Save</button></div>`); $('#saveRecordNote').onclick=async()=>{r.note=$('#recordNoteInput').value.trim(); await save(false,{render:'none'}); closeModal(); toast('Record updated')}; }
  function renderRecentActivity(){const box=$('#recentActivityLog'); if(!box)return; const logs=state.records.filter(r=>afterStart(r.date)).slice().sort((a,b)=>b.at.localeCompare(a.at)); renderPreview(box,logs,r=>activityItem(r),'Habit Records');}
  function openFullLog(){const logs=state.records.filter(r=>afterStart(r.date)).slice().sort((a,b)=>b.at.localeCompare(a.at)); openLazyModal('Habit Records',logs,r=>activityItem(r));}
  function activityItem(r){const h=state.habits.find(x=>x.id===r.habitId)||{}; const div=document.createElement('div'); div.className='activity'; div.innerHTML=`<div class="activity-emoji" style="background:${(h.color||'#4f46e5')}22">${h.emoji||'✓'}</div><div class="a-main"><div class="activity-title"></div><div class="activity-sub">${r.date} · ${new Date(r.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})}</div></div>`; div.querySelector('.activity-title').textContent=h.name||'Habit'; const acts=document.createElement('div'); acts.className='row-actions'; const d=iconBtn('del',ICON_DEL,'Remove'); d.onclick=()=>confirm('Remove this record?')&&removeRecord(r.id); acts.appendChild(d); div.appendChild(acts); return div;}
  function energyScaleHtml(inputId,valueId,value){
    const v=Math.max(0,Math.min(10,Number(value??5)));
    const ticks=Array.from({length:11},(_,i)=>`<button type="button" class="energy-tick" data-tick="${i}" style="--i:${i}" aria-label="Energy ${i}"><span class="tick-n">${i}</span><span class="tick-dot"></span></button>`).join('');
    return `<div class="energy-panel"><div class="range-value" id="${valueId}">${v}</div><div class="energy-scale" data-energy-scale style="--val:${v}"><div class="energy-rail">${ticks}</div><input type="range" min="0" max="10" step="1" value="${v}" id="${inputId}"></div></div>`;
  }
  function bindEnergyScale(input,valueEl){
    if(!input) return;
    const scale=input.closest('.energy-scale');
    const paint=()=>{
      const val=Number(input.value);
      if(scale){
        scale.style.setProperty('--val',val);
        scale.querySelectorAll('[data-tick]').forEach(el=>{
          const i=Number(el.dataset.tick);
          const tilt=Math.max(-36,Math.min(36,(val-i)*6));
          el.style.setProperty('--tilt',tilt+'deg');
          el.classList.toggle('is-current',i===val);
        });
      }
      if(valueEl) valueEl.textContent=String(val);
    };
    scale?.querySelectorAll('[data-tick]').forEach(el=>{
      el.addEventListener('click',()=>{
        input.value=String(el.dataset.tick);
        input.dispatchEvent(new Event('input',{bubbles:true}));
      });
    });
    input.addEventListener('input',paint);
    paint();
  }
  function renderHomeJournal(){
    const k=todayKey(), j=state.journals[k]||{mood:'',energy:5,text:''};
    const el=$('#homeJournalForm');
    if(!el)return;
    if(el.dataset.built===k && el.querySelector('#homeJournalText')) return;
    el.dataset.built=k;
    el.innerHTML=`<div class="field"><label>Mood</label><div class="mood-row">${MOODS.map(m=>`<button class="mood ${j.mood===m?'active':''}" data-mood="${m}">${m}</button>`).join('')}</div></div><div class="field"><label>Energy Score</label>${energyScaleHtml('homeEnergy','homeEnergyValue',j.energy)}</div><div class="field journal-area"><label>Reflection</label><textarea id="homeJournalText" placeholder="What went well? What needs adjustment?">${escapeHtml(j.text)}</textarea></div><button class="btn-primary" id="saveJournalHome">Save Journal</button>`;
    $$('.mood',el).forEach(b=>b.onclick=()=>{$$('.mood',el).forEach(x=>x.classList.remove('active')); b.classList.add('active')});
    bindEnergyScale($('#homeEnergy'),$('#homeEnergyValue'));
    $('#saveJournalHome').onclick=async()=>{const mood=$('#homeJournalForm .mood.active')?.dataset.mood||''; const wasNew=!state.journals[k]; state.journals[k]={mood,energy:Number($('#homeEnergy').value),text:$('#homeJournalText').value.trim(),updatedAt:new Date().toISOString()}; if(wasNew) showXpPop('+5 EXP'); await save(false,{render:'none'}); toast('Journal saved');};
    const viewBtn=$('#homeJournalViewAll'); if(viewBtn) viewBtn.onclick=()=>openJournalListModal();
  }
  function openJournalListModal(){
    const items=Object.keys(state.journals).sort((a,b)=>b.localeCompare(a)).map(k=>({date:k}));
    openLazyModal('Journal',items,x=>journalNode(x.date,()=>openJournalListModal()));
    setTimeout(()=>{
      const body=$('#modalBody');
      if(body && !body.querySelector('#addJournalFromModal')){
        const add=document.createElement('button'); add.className='btn-primary'; add.id='addJournalFromModal'; add.style.marginTop='12px'; add.textContent='+ Log today'; add.onclick=()=>{closeModal(); openJournalEditor(todayKey());};
        body.appendChild(add);
      }
    },0);
  }
  function renderQuote(){const el=$('#dailyQuote'); if(!el)return; const qs=[['Commit to the LORD whatever you do, and he will establish your plans.','Proverbs 16:3'],['Small actions become identity when repeated.','Habit principle'],['Discipline today, freedom tomorrow.','Reminder'],['You do not rise to the level of your goals. You fall to the level of your systems.','James Clear'],['We are what we repeatedly do. Excellence, then, is not an act, but a habit.','Will Durant'],['A journey of a thousand miles begins with a single step.','Lao Tzu'],['The secret of your future is hidden in your daily routine.','Mike Murdock'],['Motivation gets you going. Habit gets you there.','Zig Ziglar'],['Don\'t count the days. Make the days count.','Muhammad Ali'],['Tiny gains compound. Show up again tomorrow.','Atomic habits'],['Protect the streak, then protect the rest.','Habit & Journal'],['The best time to plant a tree was twenty years ago. The second best time is now.','Proverb'],['Progress is built in ordinary days.','Journey note'],['Miss once if you must. Don\'t miss twice.','Streak wisdom'],['Habits are the compound interest of self-improvement.','Atomic habits'],['Show up for the person you are becoming.','Identity'],['A good day is one you did not skip.','Journey'],['The path is made by walking it again tomorrow.','Practice'],['Your future self is watching this choice.','Reminder'],['Consistency beats intensity when both cannot win.','Habit craft'],['Keep the chain, then keep the rest.','Streak'],['Journal the day so the week can teach you.','Habit & Journal']]; const q=qs[hkNow().getDate()%qs.length]; el.innerHTML=`<div class="quote-text">${q[0]}</div><div class="quote-ref">${q[1]}</div>`;}

  /* ---------- HABITS ---------- */
  function moveGroup(groupId,delta){
    const sorted=sortedGroups();
    const gi=sorted.findIndex(g=>g.id===groupId);
    if(gi<0) return;
    const nj=gi+delta;
    if(nj<0||nj>=sorted.length) return;
    const g=sorted[gi], o=sorted[nj];
    const t=g.sortOrder??gi;
    g.sortOrder=o.sortOrder??nj;
    o.sortOrder=t;
    void save(false,{render:'habitsView'});
    renderHome();
    haptic();
  }
  function deleteGroup(groupId){
    if(!groupId||!confirm('Delete this group? Habits will move to Ungrouped.')) return;
    state.habits.forEach(h=>{if(h.groupId===groupId) h.groupId=null;});
    state.groups=state.groups.filter(x=>x.id!==groupId);
    void save(false,{render:'habitsView'});
    renderHome();
    toast('Group deleted');
    haptic();
  }
  function moveHabit(habitId,delta){
    const habits=activeHabits().sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
    const idx=habits.findIndex(h=>h.id===habitId);
    if(idx<0) return;
    const nj=idx+delta;
    if(nj<0||nj>=habits.length) return;
    const h=habits[idx], o=habits[nj];
    const t=h.sortOrder??idx;
    h.sortOrder=o.sortOrder??nj;
    o.sortOrder=t;
    void save(false,{render:'habitsView'});
    renderHome();
    haptic();
  }
  function bindSortableList(list,rowSelector,idAttr,applyOrder){
    if(!list) return;
    list.querySelectorAll(rowSelector).forEach(row=>{
      const handle=row.querySelector('.drag-handle');
      if(!handle) return;
      handle.addEventListener('pointerdown',e=>{
        if(e.button && e.button!==0) return;
        e.preventDefault();
        e.stopPropagation();
        const startY=e.clientY;
        let dragged=false;
        row.classList.add('dragging');
        handle.classList.add('dragging');
        const prevSelect=document.body.style.userSelect;
        document.body.style.userSelect='none';
        try{handle.setPointerCapture(e.pointerId);}catch(err){}
        const onMove=ev=>{
          if(Math.abs(ev.clientY-startY)>4) dragged=true;
          const others=[...list.querySelectorAll(rowSelector)].filter(r=>r!==row);
          const over=others.find(r=>{
            const b=r.getBoundingClientRect();
            return ev.clientY>=b.top && ev.clientY<=b.bottom;
          });
          if(!over) return;
          const rows=[...list.querySelectorAll(rowSelector)];
          const from=rows.indexOf(row);
          const to=rows.indexOf(over);
          if(from<0||to<0||from===to) return;
          dragged=true;
          if(from<to) list.insertBefore(row, over.nextSibling);
          else list.insertBefore(row, over);
        };
        const onUp=()=>{
          row.classList.remove('dragging');
          handle.classList.remove('dragging');
          document.body.style.userSelect=prevSelect;
          window.removeEventListener('pointermove',onMove);
          window.removeEventListener('pointerup',onUp);
          window.removeEventListener('pointercancel',onUp);
          try{handle.releasePointerCapture(e.pointerId);}catch(err){}
          if(!dragged) return;
          const ids=[...list.querySelectorAll(rowSelector)].map(r=>r.dataset[idAttr]).filter(Boolean);
          applyOrder(ids);
        };
        window.addEventListener('pointermove',onMove);
        window.addEventListener('pointerup',onUp);
        window.addEventListener('pointercancel',onUp);
      });
    });
  }
  function applyHabitOrder(ids){
    ids.forEach((id,i)=>{const h=state.habits.find(x=>x.id===id); if(h) h.sortOrder=i;});
    void save(false,{render:'none'});
    renderHome();
    haptic();
  }
  function applyGroupOrder(ids){
    ids.forEach((id,i)=>{const g=state.groups.find(x=>x.id===id); if(g) g.sortOrder=i;});
    void save(false,{render:'none'});
    renderHome();
    haptic();
  }
  function renderGroupManager(){
    const box=$('#groupManager'); if(!box)return;
    if(!state.groups.length){box.innerHTML='<div class="empty">No groups yet. Add a group like Morning, Afternoon, or Evening before creating habits.</div>'; return;}
    box.innerHTML='';
    sortedGroups().forEach(g=>{
      const div=document.createElement('div'); div.className='group-manage-item'; div.dataset.groupId=g.id;
      div.innerHTML=`<button type="button" class="drag-handle" aria-label="Drag to reorder" data-drag-group="${g.id}"><span></span><span></span><span></span></button><button type="button" class="group-icon-btn" data-gicon data-group-id="${g.id}" title="Change icon">${g.emoji||'📋'}</button><input value="${escapeAttr(g.name)}" data-gname data-group-id="${g.id}" aria-label="Group name"><button class="group-del-btn" type="button" data-gdel data-group-id="${g.id}" aria-label="Delete group">×</button>`;
      div.querySelector('[data-gname]').onchange=e=>{const grp=state.groups.find(x=>x.id===g.id); if(grp){grp.name=e.target.value.trim()||'Group'; invalidateHomeCaches(); renderHome(); void save(false,{render:'none'});}};
      box.appendChild(div);
    });
    bindSortableList(box,'.group-manage-item','groupId',applyGroupOrder);
  }
  function openGroupIconPicker(group){
    openModal('Group Icon',`<div class="emoji-row">${EMOJIS.map(e=>`<button type="button" class="emoji-swatch ${group.emoji===e?'active':''}" data-emoji="${e}">${e}</button>`).join('')}</div><div class="field" style="margin-top:12px"><label>Custom emoji</label><input id="groupEmojiInput" data-group-id="${group.id}" value="${escapeAttr(group.emoji||'📋')}" maxlength="4"></div><div class="modal-actions"><button class="btn-secondary" data-close>Cancel</button><button class="btn-primary" id="saveGroupIcon">Save</button></div>`);
    $$('.emoji-swatch').forEach(b=>b.onclick=()=>{$$('.emoji-swatch').forEach(x=>x.classList.remove('active')); b.classList.add('active'); $('#groupEmojiInput').value=b.dataset.emoji;});
  }
  function renderHabits(){
    renderGroupManager();
    const list=$('#allHabitList'); if(!list)return; list.innerHTML='';
    const habits=activeHabits().sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
    if(!habits.length){list.innerHTML='<div class="empty"><div class="empty-icon">🎯</div>No habits yet.<button class="btn-primary empty-cta" data-open-habit>Add habit</button></div>'; $$('[data-open-habit]',list).forEach(b=>b.onclick=()=>openHabitModal()); return;}
    habits.forEach((h,idx)=>{
      const grp=state.groups.find(g=>g.id===h.groupId);
      const row=document.createElement('div'); row.className='habit-row'+(h.paused?' paused-habit':''); row.style.cursor='default';
      row.dataset.habitId=h.id;
      row.innerHTML=`<button type="button" class="drag-handle" aria-label="Drag to reorder" data-drag-habit="${h.id}"><span></span><span></span><span></span></button><div class="habit-icon" style="background:${h.color}22;color:${h.color}">${h.emoji}</div><div class="habit-main"><div class="habit-name"></div><div class="habit-meta"><span>${frequencyLabel(h)}</span>${grp?`<span class="mini-dot"></span><span>${escapeHtml(grp.name)}</span>`:''}<span class="mini-dot"></span><span>${fmtXp(h.xpReward||5)} EXP</span>${h.paused?'<span class="chip gray">Paused</span>':''}</div></div>`;
      row.querySelector('.habit-name').textContent=h.name;
      const actions=document.createElement('div'); actions.className='habit-actions';
      actions.innerHTML=`<button class="icon-btn" data-edit data-habit-id="${h.id}" aria-label="Edit">✎</button><button class="icon-btn" data-pause data-habit-id="${h.id}" aria-label="Pause">${h.paused?'▶':'⏸'}</button>`;
      row.appendChild(actions); list.appendChild(row);
    });
    bindSortableList(list,'.habit-row','habitId',applyHabitOrder);
  }
  function renderHabitCompletionChart(){
    const table=$('#habitCompletionTable'), note=$('#habitChartRangeNote'); if(!table)return;
    const range=habitChartRange();
    if(note) note.textContent=`Completion rate by frequency target · ${range.label}`;
    const habits=activeHabits().sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
    if(!habits.length){table.innerHTML='<div class="empty">Add habits to see completion rates.</div>'; return;}
    table.innerHTML='';
    habits.forEach(h=>{
      const stats=habitCompletionStats(h,range.from,range.to);
      const row=document.createElement('div'); row.className='habit-completion-row';
      const barColor=stats.rate>=100?'var(--green)':stats.rate>=80?'var(--brand)':stats.rate>=50?'var(--orange)':'var(--red)';
      row.innerHTML=`<div class="habit-completion-label"><span>${h.emoji}</span><span>${escapeHtml(h.name)}</span></div><div class="habit-completion-pct">${stats.rate}%</div><div class="habit-completion-bar"><span style="width:${stats.rate}%;background:${barColor}"></span></div><div class="habit-completion-sub">${stats.completed}/${stats.total} periods completed · ${frequencyLabel(h)}</div>`;
      table.appendChild(row);
    });
  }

  function deleteHabit(habitId){
    if(!habitId||!confirm('Delete this habit? Records stay in history.')) return;
    state.habits=state.habits.filter(x=>x.id!==habitId);
    habitModalSave=null;
    habitModalDeleteId=null;
    closeModal();
    renderHabits();
    renderHome();
    toast('Habit deleted');
    void save(false,{render:'none'});
  }
  function openHabitModal(habit=null){
    const isEdit=!!habit;
    const h=habit||{name:'',emoji:'📖',color:COLOURS[0],target:1,xpReward:5,frequency:{mode:'daily',days:[1,2,3,4,5]},reminder:{enabled:false,time:state.settings.globalReminderTime||'20:30',message:''}};
    const xpPer=habitXpPerTap(h);
    openModal(isEdit?'Edit Habit':'Add Habit',`<div class="form-grid"><div class="field"><label>Habit Name</label><input id="habitName" value="${escapeAttr(h.name)}" placeholder="e.g. Bible Time"></div><div class="field"><label>Group</label><select id="habitGroup"><option value="">Ungrouped</option>${sortedGroups().map(g=>`<option value="${g.id}" ${h.groupId===g.id?'selected':''}>${escapeHtml(g.name)}</option>`).join('')}</select></div><div class="field"><label>Icon</label><div class="emoji-row">${EMOJIS.map(e=>`<button type="button" class="emoji-swatch ${h.emoji===e?'active':''}" data-emoji="${e}">${e}</button>`).join('')}</div><input id="habitEmoji" value="${escapeAttr(h.emoji||'📖')}" maxlength="4" placeholder="📖" style="margin-top:8px"></div><div class="field"><label>Colour</label><div class="color-row">${COLOURS.map(c=>`<button type="button" class="color-swatch ${h.color===c?'active':''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div></div><div class="field"><label>Target Count</label><select id="habitTarget">${Array.from({length:10},(_,i)=>i+1).map(n=>`<option value="${n}" ${Number(h.target||1)===n?'selected':''}>${n} time${n>1?'s':''}</option>`).join('')}</select></div><div class="field"><label>EXP per period ${infoTip('Total EXP for the period is split across each completion at your target count.')}</label><input id="habitXpReward" type="number" min="1" max="100" step="1" value="${Math.round(Number(h.xpReward)||5)}"><div class="inline-hint" id="habitXpHint">${xpPer} EXP per completion</div></div><div class="field"><label>Frequency</label><select id="freqMode"><option value="daily">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom</option></select></div><div class="dynamic-fields" id="freqFields"></div><div class="dynamic-fields" id="habitReminderBlock"><div class="switch-row"><div><strong>Habit Reminder ${infoTip('Optional alert for this habit at the set time.')}</strong></div><button type="button" class="switch" id="habitReminderToggle" aria-label="Habit reminder toggle"></button></div><div class="field" style="margin-top:10px"><label>Reminder Time</label><input type="time" id="habitReminderTime" value="${h.reminder?.time||'20:30'}"></div><div class="field" id="daysBeforeDueField" style="display:none"><label>Remind days before due ${infoTip('For Not Specific habits, notification fires this many days before the due date.')}</label><input type="number" id="habitDaysBeforeDue" min="0" max="14" step="1" value="${Number(h.reminder?.daysBeforeDue??1)}"></div><div class="field"><label>Notification message ${infoTip('{habit} is replaced with this habit\'s name when sent.')}</label><input id="habitReminderMsg" maxlength="${REMINDER_MSG_LIMIT}" value="${escapeAttr(h.reminder?.message||state.settings.defaultReminderMessage||'Time for {habit}!')}" placeholder="Time for {habit}!"><div class="inline-hint"><span id="habitMsgCount">0</span>/${REMINDER_MSG_LIMIT}</div></div></div><div class="modal-actions"><button class="btn-secondary" data-close>Cancel</button><button class="btn-primary" id="saveHabitBtn">Save</button></div>${isEdit?'<button class="btn-danger settings-save" id="deleteHabitBtn" type="button">Delete habit</button>':''}</div>`);
    function updateXpHint(){const t=Math.max(1,Number($('#habitTarget')?.value||1)); const total=Math.max(1,Math.round(Number($('#habitXpReward')?.value||5))); const hint=$('#habitXpHint'); if(hint) hint.textContent=`${Math.max(1,Math.round(total/t))} EXP per completion`;}
    $('#habitTarget')?.addEventListener('change',updateXpHint);
    $('#habitXpReward')?.addEventListener('input',updateXpHint);
    const msgInput=$('#habitReminderMsg'), msgCount=$('#habitMsgCount');
    function syncMsgCount(){if(msgCount&&msgInput) msgCount.textContent=String((msgInput.value||'').length);}
    msgInput?.addEventListener('input',syncMsgCount); syncMsgCount();
    const f=h.frequency||{mode:'daily',days:[1,2,3,4,5]}; $('#freqMode').value=f.mode||'daily'; let selectedColor=h.color;
    $$('.color-swatch').forEach(b=>b.onclick=()=>{$$('.color-swatch').forEach(x=>x.classList.remove('active')); b.classList.add('active'); selectedColor=b.dataset.color});
    $$('.emoji-swatch').forEach(b=>b.onclick=()=>{$$('.emoji-swatch').forEach(x=>x.classList.remove('active')); b.classList.add('active'); $('#habitEmoji').value=b.dataset.emoji});
    function ordinalOptions(v){return [[1,'1st'],[2,'2nd'],[3,'3rd'],[4,'4th'],['last','Last']].map(([val,txt])=>`<option value="${val}" ${String(v)===String(val)?'selected':''}>${txt}</option>`).join('')}
    function weekdayOptions(v){return dowOrder().map(i=>`<option value="${i}" ${Number(v)===i?'selected':''}>${DOW[i]}</option>`).join('')}
    function dayOptions(v){return Array.from({length:31},(_,i)=>i+1).map(n=>`<option value="${n}" ${Number(v)===n?'selected':''}>${n}</option>`).join('')}
    function monthOptions(v){return Array.from({length:12},(_,i)=>i+1).map(n=>`<option value="${n}" ${Number(v)===n?'selected':''}>${new Date(2026,n-1,1).toLocaleDateString([], {month:'long'})}</option>`).join('')}
    function scheduleFields(freq,mode){
      const s=freq.schedule||{};
      return `<div class="field"><label>Schedule Type</label><select id="scheduleType"><option value="any" ${!s.type||s.type==='any'?'selected':''}>Not Specific</option><option value="date" ${s.type==='date'?'selected':''}>Specific date</option><option value="weekday" ${s.type==='weekday'?'selected':''}>Specific weekday</option></select></div><div id="scheduleFieldsInner"></div>`;
    }
    function drawScheduleInner(){
      const type=$('#scheduleType')?.value||'any'; const s=f.schedule||{}; const inner=$('#scheduleFieldsInner'); if(!inner)return;
      if(type==='any') { inner.innerHTML=''; return; }
      let periodExtra='';
      const period=$('#customPeriod')?.value || f.period || 'quarter';
      if($('#freqMode')?.value==='custom' && period==='quarter') periodExtra = `<div class="field"><label>Month in Quarter</label><select id="monthInPeriod"><option value="any" ${String(s.monthInPeriod)==='any'?'selected':''}>Every month in quarter</option><option value="1" ${String(s.monthInPeriod||1)==='1'?'selected':''}>1st month</option><option value="2" ${String(s.monthInPeriod)==='2'?'selected':''}>2nd month</option><option value="3" ${String(s.monthInPeriod)==='3'?'selected':''}>3rd month</option></select></div>`;
      if($('#freqMode')?.value==='custom' && period==='year') periodExtra = `<div class="field"><label>Month</label><select id="monthInYear"><option value="any" ${String(s.monthInYear)==='any'?'selected':''}>Every month</option>${monthOptions(s.monthInYear||1)}</select></div>`;
      if(type==='date') inner.innerHTML=`${periodExtra}<div class="field"><label>Due Date</label><select id="scheduleDay">${dayOptions(s.day||1)}</select></div>`;
      else inner.innerHTML=`${periodExtra}<div class="schedule-grid"><div class="field"><label>Week</label><select id="scheduleOrdinal">${ordinalOptions(s.ordinal||1)}</select></div><div class="field"><label>Weekday</label><select id="scheduleWeekday">${weekdayOptions(s.weekday??weekStartDow())}</select></div></div>`;
    }
    function drawFreq(){
      const mode=$('#freqMode').value; const box=$('#freqFields');
      if(mode==='daily'){
        const weeklyType=(f.schedule?.type==='any')?'any':'days';
        box.innerHTML=`<div class="sub-field field"><label>Weekly Setup</label><select id="weeklySetupType"><option value="days" ${weeklyType==='days'?'selected':''}>Specific days</option><option value="any" ${weeklyType==='any'?'selected':''}>Not Specific</option></select></div><div id="weeklyFieldsInner"></div>`;
        function drawWeeklyInner(){
          const setup=$('#weeklySetupType')?.value||'days';
          const inner=$('#weeklyFieldsInner'); if(!inner)return;
          if(setup==='any'){
            inner.innerHTML='<div class="small-note">Flexible weekly habit — complete anytime this week. No fixed due day.</div>';
          } else {
            inner.innerHTML=`<div class="sub-field field"><label>Active days ${infoTip('Tap the days when this habit should appear on the Home page.')}</label><div class="day-row">${dowOrder().map(i=>`<button type="button" class="day-pill ${(f.days||[]).includes(i)?'active':''}" data-day="${i}">${DOW[i][0]}</button>`).join('')}</div></div>`;
            $$('.day-pill').forEach(b=>b.onclick=()=>b.classList.toggle('active'));
          }
          const daysBefore=$('#daysBeforeDueField');
          const weeklyAny=setup==='any';
          if(daysBefore) daysBefore.style.display=weeklyAny?'none':(isNotSpecific(h)?'block':'none');
          syncReminderUi();
        }
        $('#weeklySetupType').onchange=drawWeeklyInner; drawWeeklyInner();
      }else if(mode==='monthly'){
        box.innerHTML=`<div class="sub-field field"><label>Monthly Setup ${infoTip('The target count applies once per month. Choose when the habit should appear.')}</label></div>${scheduleFields(f,'monthly')}`;
        $('#scheduleType').onchange=()=>{drawScheduleInner(); syncReminderUi();}; drawScheduleInner(); syncReminderUi();
      }else{
        box.innerHTML=`<div class="sub-field field"><label>Custom Period</label><select id="customPeriod"><option value="quarter">Quarterly</option><option value="year">Yearly</option></select></div><div id="customScheduleBox"></div>`;
        $('#customPeriod').value=f.period||'quarter';
        function drawCustomSchedule(){ const cf={...f,period:$('#customPeriod').value,schedule:f.schedule||{type:'any'}}; $('#customScheduleBox').innerHTML=scheduleFields(cf,'custom'); $('#scheduleType').onchange=()=>{drawScheduleInner(); syncReminderUi();}; drawScheduleInner(); syncReminderUi(); }
        $('#customPeriod').onchange=drawCustomSchedule; drawCustomSchedule();
      }
    }
    const t=$('#habitReminderToggle'), time=$('#habitReminderTime'), daysBefore=$('#habitDaysBeforeDue');
    if(t) t.classList.toggle('on',!!h.reminder?.enabled);
    if(daysBefore) daysBefore.value=String(h.reminder?.daysBeforeDue??1);
    function reminderHidden(){
      const mode=$('#freqMode')?.value;
      if(mode==='daily') return ($('#weeklySetupType')?.value||'days')==='any';
      return ($('#scheduleType')?.value||'any')==='any';
    }
    function syncReminderUi(){
      const hide=reminderHidden();
      const block=$('#habitReminderBlock');
      if(block) block.style.display=hide?'none':'';
      if(hide && t) t.classList.remove('on');
      if(!t) return;
      t.disabled=hide;
      if(time) time.disabled=hide;
      if(daysBefore) daysBefore.disabled=hide;
      const daysBeforeField=$('#daysBeforeDueField');
      if(daysBeforeField) daysBeforeField.style.display='none';
    }
    $('#freqMode').onchange=()=>{drawFreq(); syncReminderUi();}; drawFreq();
    syncReminderUi();
    const bindHabitReminder=()=>{
      const toggle=$('#habitReminderToggle');
      if(!toggle||toggle.dataset.bound) return;
      toggle.dataset.bound='1';
      toggle.addEventListener('click',e=>{
        e.preventDefault(); e.stopPropagation();
        const turningOn=!toggle.classList.contains('on');
        if(turningOn && 'Notification' in window && Notification.permission==='denied'){
          toast('Browser notifications blocked — reminders will use in-app alerts');
        }
        toggle.classList.toggle('on',turningOn);
        if(turningOn && !state.settings.reminders){
          state.settings.reminders=true;
          setupReminderLoop();
          refreshSettingsChrome();
        }
        syncReminderUi();
        toast(turningOn?'Reminder on for this habit':'Reminder off for this habit');
      });
    };
    bindHabitReminder();
    habitModalSave=async()=>{
      const mode=$('#freqMode').value; let freq={mode};
      if(mode==='daily'){
        const setup=$('#weeklySetupType')?.value||'days';
        if(setup==='any'){
          freq.schedule={type:'any'};
          freq.days=[];
        } else {
          freq.days=$$('.day-pill.active').map(x=>Number(x.dataset.day));
          if(!freq.days.length){toast('Select at least one day'); return;}
          freq.schedule={type:'days'};
        }
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
      const t=$('#habitReminderToggle');
      const item={id:h.id||uid(),name:$('#habitName').value.trim()||'Untitled Habit',emoji:$('#habitEmoji').value,color:selectedColor,target:Number($('#habitTarget').value),xpReward:Math.max(1,Math.round(Number($('#habitXpReward').value)||5)),frequency:freq,groupId:$('#habitGroup')?.value||null,sortOrder:h.sortOrder??state.habits.length,paused:!!h.paused,archived:false,flexPeriodStart:h.flexPeriodStart||null,reminder:{enabled:reminderHidden()?false:!!t?.classList.contains('on'),time:$('#habitReminderTime').value,message:($('#habitReminderMsg')?.value||state.settings.defaultReminderMessage||'Time for {habit}!').slice(0,REMINDER_MSG_LIMIT),daysBeforeDue:Number($('#habitDaysBeforeDue')?.value||1)}};
      if(isEdit){state.habits=state.habits.map(x=>x.id===h.id?item:x)}else state.habits.push(item);
      invalidateHomeCaches();
      renderHabits();
      renderHome();
      closeModal();
      habitModalSave=null;
      toast('Habit saved');
      void save(false,{render:'none'});
    };
    if(isEdit){
      habitModalDeleteId=h.id;
      $('#deleteHabitBtn')?.addEventListener('click',e=>{e.preventDefault(); e.stopPropagation(); deleteHabit(h.id);});
    } else habitModalDeleteId=null;
    $('#saveHabitBtn')?.addEventListener('click',e=>{e.preventDefault(); e.stopPropagation(); if(habitModalSave) void habitModalSave();});
  }

  /* ---------- REPORT ---------- */
  function syncReportRangeTabs(){
    $$('#reportRangeTabs button').forEach(b=>b.classList.toggle('active',Number(b.dataset.days)===trendDays));
  }
  function renderReport(){syncReportRangeTabs(); renderComparePeriods(); renderCorrelationInsights(); renderHabitCompletionChart(); drawTrend(); renderCalendar();}
  function drawTrend(){
    const c=$('#trendCanvas'); if(!c)return; const ctx=c.getContext('2d'),ratio=devicePixelRatio||1; c.width=c.offsetWidth*ratio; c.height=c.offsetHeight*ratio; ctx.setTransform(ratio,0,0,ratio,0,0); const W=c.offsetWidth,H=c.offsetHeight; ctx.clearRect(0,0,W,H);
    const labels=[]; const pctVals=[]; const energy=[]; const end=hkNow();
    for(let i=trendDays-1;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);const k=dateKey(d); if(isVacationDay(k)){labels.push(`${d.getMonth()+1}/${d.getDate()}`); pctVals.push(null); energy.push(null); continue;} labels.push(`${d.getMonth()+1}/${d.getDate()}`); pctVals.push(dayPct(d)); energy.push(state.journals[k]?.energy??null);}
    const note=$('#trendNote'); if(note) note.textContent='';
    const cs=getComputedStyle(document.documentElement); const gridCol=(cs.getPropertyValue('--line')||'#eeeeF6').trim(); const axisCol=(cs.getPropertyValue('--faint')||'#7c8199').trim(); const lineCol=(cs.getPropertyValue('--brand')||'#4f46e5').trim();
    const left=34,right=12,top=18,bottom=42,plotW=W-left-right,plotH=H-top-bottom,bw=plotW/trendDays;
    ctx.strokeStyle=gridCol; ctx.lineWidth=1; ctx.fillStyle=axisCol; ctx.font='10px Inter,Arial'; for(let i=0;i<=4;i++){const y=top+plotH*i/4; ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(W-right,y);ctx.stroke(); ctx.fillText((100-i*25)+'%',4,y+3);}
    const barW=Math.max(2,Math.min(bw*0.62,26)); const radius=Math.min(6,barW/2);
    pctVals.forEach((v,i)=>{ if(v===null||v===undefined) return; const x=left+i*bw+(bw-barW)/2; const bh=plotH*(v/100); ctx.fillStyle=v>=100?'rgba(22,163,74,.9)':v>=50?'rgba(253,230,138,.95)':'rgba(248,113,113,.85)'; roundRect(ctx,x,top+plotH-bh,barW,Math.max(2,bh),radius,true);});
    ctx.strokeStyle=lineCol;ctx.lineWidth=3;ctx.beginPath(); let started=false; energy.forEach((e,i)=>{if(e==null)return; const x=left+i*bw+bw/2, y=top+plotH-plotH*(e/10); if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y)}); if(started) ctx.stroke(); energy.forEach((e,i)=>{if(e==null)return; const x=left+i*bw+bw/2, y=top+plotH-plotH*(e/10); ctx.fillStyle=lineCol; ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();});
    const labelStep=trendDays<=7?1:trendDays<=14?3:6; ctx.fillStyle=axisCol;ctx.font='10px Inter,Arial'; ctx.textAlign='center'; labels.forEach((l,i)=>{if(i%labelStep!==0&&i!==labels.length-1)return; const x=left+i*bw+bw/2; ctx.fillText(l,x,H-16);}); ctx.textAlign='left';}
  function roundRect(ctx,x,y,w,h,r,fill){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r); if(fill)ctx.fill();}
  function renderCalendar(){
    const title=$('#reportTitle');
    const m=$('#monthReport');
    if(!title||!m) return;
    title.textContent=reportCursor.toLocaleDateString([], {month:'long',year:'numeric'});
    renderMonth(reportCursor,$('#calendarGrid'),$('#calendarWeekdays'));
  }
  function renderMonth(date,grid,weekdays,mini=false){weekdays.innerHTML=dowOrder().map(i=>`<div>${DOW[i][0]}</div>`).join(''); grid.innerHTML=''; const y=date.getFullYear(),m=date.getMonth(), first=new Date(y,m,1), days=new Date(y,m+1,0).getDate(); const today=todayKey(); const pad=(first.getDay()-weekStartDow()+7)%7; for(let i=0;i<pad;i++){const e=document.createElement('div');e.className='day-cell empty';grid.appendChild(e)} for(let d=1;d<=days;d++){const dt=new Date(y,m,d),k=dateKey(dt),vac=isVacationDay(k); let p=dayPct(dt); const j=state.journals[k]; const cell=document.createElement('div'); let cls='day-cell'; if(k>today){cls+=' future'} else if(vac){cls+=' vacation';} else if(p!==null){cls+=' '+pctClass(p);} if(k===today)cls+=' today'; cell.className=cls; cell.innerHTML=`<span>${d}</span>${vac?'<span class="mood-mark pause-mark">⏸</span>':''}${!vac&&j?.mood?`<span class="mood-mark">${j.mood}</span>`:''}${!vac&&j?.energy!==undefined?`<span class="energy-mark">${j.energy}</span>`:''}`; cell.onclick=()=>openDayDetail(k); grid.appendChild(cell);} }
  function openDayDetail(k){const d=parseDate(k); const scheduled=dayScheduledHabits(d); const p=dayPct(d);
    openModal(`Day Detail · ${fmtDate(d)}`,`<div class="small-note">Completion <strong>${p??0}%</strong> · tap +1 to record, ↺ to reset a habit</div><div class="habit-list" id="dayHabitList" style="margin-top:12px"></div><div id="dayJournalBox" style="margin-top:16px"></div>`);
    const list=$('#dayHabitList'); if(!scheduled.length) list.innerHTML='<div class="empty">No habits scheduled on this day.</div>';
    scheduled.forEach(h=>list.appendChild(todayHabitRow(h,d,()=>openDayDetail(k))));
    renderDayJournalBox(k);
  }
  function renderDayJournalBox(k){const box=$('#dayJournalBox'); if(!box)return; const j=state.journals[k];
    if(j){ box.innerHTML='<div class="dj-title">Journal</div>'; box.appendChild(journalNode(k,()=>openDayDetail(k))); }
    else { box.innerHTML=`<button class="btn-inline pink" id="addDayJournal" data-journal-date="${k}">+ Add Journal</button>`; }
  }
  function renderJournals(){const box=$('#journalHistory'); if(!box)return; const items=Object.keys(state.journals).sort((a,b)=>b.localeCompare(a)).map(k=>({date:k})); renderPreview(box,items,x=>journalNode(x.date),'Journal History');}
  function openJournalEditor(k=todayKey()){const j=state.journals[k]||{mood:'',energy:5,text:''}; openModal('Edit Journal',`<div class="form-grid journal-area"><div class="field"><label>Date</label><input type="date" id="journalDate" value="${k}"></div><div class="field"><label>Mood</label><div class="mood-row">${MOODS.map(m=>`<button class="mood ${j.mood===m?'active':''}" data-mood="${m}">${m}</button>`).join('')}</div></div><div class="field"><label>Energy Score</label>${energyScaleHtml('modalEnergy','modalEnergyValue',j.energy)}</div><div class="field"><label>Reflection</label><textarea id="modalJournalText">${escapeHtml(j.text||'')}</textarea></div><div class="modal-actions"><button class="btn-secondary" data-close>Cancel</button><button class="btn-primary" id="saveJournalModal">Save</button></div></div>`); $$('.mood').forEach(b=>b.onclick=()=>{$$('.mood').forEach(x=>x.classList.remove('active')); b.classList.add('active')}); bindEnergyScale($('#modalEnergy'),$('#modalEnergyValue')); $('#saveJournalModal').onclick=async()=>{const nk=$('#journalDate').value||k; const wasNew=!state.journals[k]&&!state.journals[nk]; if(nk!==k) delete state.journals[k]; state.journals[nk]={mood:$('#modalBody .mood.active')?.dataset.mood||'',energy:Number($('#modalEnergy').value),text:$('#modalJournalText').value.trim(),updatedAt:new Date().toISOString()}; await save(false,{render:'none'}); if(wasNew) showXpPop('+5 EXP'); closeModal(); toast('Journal saved')};}

  /* ---------- INSIGHTS / CELEBRATE ---------- */
  function periodAvgPct(fromK,toK){let sum=0,n=0; const a=parseDate(fromK), b=parseDate(toK); for(let d=new Date(a); d<=b; d.setDate(d.getDate()+1)){const k=dateKey(d); if(isVacationDay(k)||!afterStart(k)) continue; const p=dayPct(d); if(p===null) continue; sum+=p; n++;} return n?Math.round(sum/n):0;}
  function renderCorrelationInsights(){
    const box=$('#correlationInsights'); if(!box)return;
    const range=reportDayRange();
    const days=[];
    const a=parseDate(range.from), b=parseDate(range.to);
    for(let d=new Date(a); d<=b; d.setDate(d.getDate()+1)){
      const k=dateKey(d); if(!afterStart(k)||isVacationDay(k)) continue;
      const p=dayPct(d); if(p===null) continue;
      days.push({k,d:new Date(d),p,j:state.journals[k]||null,dow:d.getDay()});
    }
    const nCls=v=>{const n=Number(v); if(!Number.isFinite(n)) return 'ins-n'; return n>=80?'ins-n hi':n>=50?'ins-n mid':'ins-n lo';};
    const pct=(v)=>`<span class="${nCls(v)}">${v}%</span>`;
    const num=(v,cls)=>{const n=Number(v); const c=cls||(n>0?'hi':n<0?'lo':'mid'); return `<span class="ins-n ${c}">${n}</span>`;};
    const pts=(v)=>{const n=Number(v); const cls=n>0?'ins-n hi':n<0?'ins-n lo':'ins-n mid'; return `<span class="${cls}">${n>0?'+':''}${n}</span>`;};
    const rows=[];
    const push=(ico,title,html,priority)=>{rows.push({priority,html:`<div class="insight-row"><div class="insight-ico">${ico}</div><div class="insight-text"><strong>${title}</strong>${html}</div></div>`});};
    if(!days.length){box.innerHTML='<div class="empty">Track a few days to see progress insights.</div>'; return;}
    const avg=Math.round(days.reduce((s,x)=>s+x.p,0)/days.length);
    const perfect=days.filter(x=>x.p>=100).length;
    const misses=days.filter(x=>x.p===0).length;
    push('📈','This range',`Average completion ${pct(avg)} · ${num(perfect,perfect?'hi':'mid')} perfect day${perfect===1?'':'s'} · ${num(misses,misses?'lo':'hi')} empty day${misses===1?'':'s'}.`,10);
    const byDow={};
    days.forEach(x=>{byDow[x.dow]=byDow[x.dow]||{s:0,n:0}; byDow[x.dow].s+=x.p; byDow[x.dow].n++;});
    const ranked=Object.entries(byDow).map(([dow,v])=>({dow:Number(dow),avg:Math.round(v.s/v.n),n:v.n})).sort((a,b)=>b.avg-a.avg);
    if(ranked.length>=2){
      const best=ranked[0], worst=ranked[ranked.length-1];
      if(best.avg!==worst.avg) push('📅','Best weekday',`${DOW[best.dow]} averages ${pct(best.avg)} vs ${DOW[worst.dow]} at ${pct(worst.avg)}.`,8);
    }
    const weekend=days.filter(x=>x.dow===0||x.dow===6);
    const weekday=days.filter(x=>x.dow!==0&&x.dow!==6);
    if(weekend.length>=2 && weekday.length>=2){
      const wAvg=Math.round(weekday.reduce((s,x)=>s+x.p,0)/weekday.length);
      const eAvg=Math.round(weekend.reduce((s,x)=>s+x.p,0)/weekend.length);
      const better=wAvg===eAvg?'Weekdays and weekends are even':(wAvg>eAvg?`Weekdays outperform weekends ${pct(wAvg)} vs ${pct(eAvg)}`:`Weekends outperform weekdays ${pct(eAvg)} vs ${pct(wAvg)}`);
      push('⚖️','Weekday vs weekend',`${better}.`,6);
    }
    const mid=Math.floor(days.length/2);
    if(days.length>=6){
      const first=days.slice(0,mid), second=days.slice(mid);
      const a1=Math.round(first.reduce((s,x)=>s+x.p,0)/first.length);
      const a2=Math.round(second.reduce((s,x)=>s+x.p,0)/second.length);
      const delta=a2-a1;
      push('🔁','First half vs second',`${pct(a1)} → ${pct(a2)} (${pts(delta)} pts). ${delta>0?'You are trending up.':delta<0?'A little slip — one strong day can turn it.':'Holding steady.'}`,7);
    }
    const last3=days.slice(-3);
    if(last3.length===3){
      const recent=Math.round(last3.reduce((s,x)=>s+x.p,0)/3);
      push('🔥','Last 3 days',`${pct(recent)} average. ${recent>=80?'Keep that pace.':recent>=50?'Solid — one more complete day would lift this.':'A reset day would help the next streak.'}`,5);
    }
    const habitStats=activeHabits().map(h=>{
      const st=habitCompletionStats(h,range.from,range.to);
      return {h,...st};
    }).filter(x=>x.total>0).sort((a,b)=>b.rate-a.rate);
    if(habitStats.length>=2){
      const top=habitStats[0], low=habitStats[habitStats.length-1];
      push(top.h.emoji||'🏆','Most consistent',`${escapeHtml(top.h.name)} at ${pct(top.rate)} (${top.completed}/${top.total}).`,4);
      if(low.rate<top.rate) push(low.h.emoji||'🎯','Needs a lift',`${escapeHtml(low.h.name)} is at ${pct(low.rate)}. A smaller target or a clearer cue can help.`,2);
    } else if(habitStats.length===1){
      push(habitStats[0].h.emoji||'🏆','Habit pace',`${escapeHtml(habitStats[0].h.name)} is at ${pct(habitStats[0].rate)} this range.`,4);
    }
    const journals=days.filter(x=>x.j && (x.j.energy!==undefined||x.j.mood||x.j.text));
    if(journals.length>=3){
      let hiE=0,loE=0,hiN=0,loN=0; const moodMap={};
      journals.forEach(x=>{const j=x.j; if(j.energy>=7){hiE+=x.p; hiN++;} else if(j.energy<=4){loE+=x.p; loN++;} if(j.mood){moodMap[j.mood]=moodMap[j.mood]||{s:0,n:0}; moodMap[j.mood].s+=x.p; moodMap[j.mood].n++;}});
      if(hiN&&loN){
        const hiAvg=Math.round(hiE/hiN), loAvg=Math.round(loE/loN);
        const better=hiAvg>=loAvg?'High-energy days win':'Low-energy days still deliver';
        push('⚡','Energy correlation',`${better}: ${pct(hiAvg)} on 7–10 energy vs ${pct(loAvg)} on 0–4.`,9);
      }
      let topMood=null,topV=-1,lowMood=null,lowV=101; Object.entries(moodMap).forEach(([m,v])=>{const av=v.s/v.n; if(av>topV){topV=av; topMood=m;} if(av<lowV){lowV=av; lowMood=m;}});
      if(topMood) push(topMood,'Mood pattern',`${topMood} days average ${pct(Math.round(topV))} completion.`,3);
    }
    rows.sort((a,b)=>b.priority-a.priority);
    box.innerHTML=rows.slice(0,3).map(r=>r.html).join('')||'<div class="empty">Keep tracking — patterns will appear soon.</div>';
  }
  function renderComparePeriods(){
    const box=$('#comparePeriodBox'); if(!box)return;
    const now=hkNow();
    const curEnd=now;
    const curStart=new Date(now); curStart.setDate(curStart.getDate()-(trendDays-1));
    const prevEnd=new Date(curStart); prevEnd.setDate(prevEnd.getDate()-1);
    const prevStart=new Date(prevEnd); prevStart.setDate(prevStart.getDate()-(trendDays-1));
    const curLabel=`Last ${trendDays} days`;
    const prevLabel=`Previous ${trendDays} days`;
    const cur=periodAvgPct(dateKey(curStart),dateKey(curEnd)); const prev=periodAvgPct(dateKey(prevStart),dateKey(prevEnd));
    const delta=cur-prev; const cls=delta>0?'up':delta<0?'down':'flat';
    box.innerHTML=`<div class="compare-grid"><div class="compare-box"><div class="compare-val">${cur}%</div><div class="compare-label">${curLabel}</div></div><div class="compare-box"><div class="compare-val">${prev}%</div><div class="compare-label">${prevLabel}</div></div></div><div class="compare-delta ${cls}">${delta>0?`▲ +${delta} pts`:delta<0?`▼ ${delta} pts`:'— No change'}</div>`;
  }
  function celebrate(msg){if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){toast(msg);return;} const layer=$('#celebrateLayer'); if(!layer)return; layer.innerHTML=''; const banner=document.createElement('div'); banner.className='celebrate-banner'; banner.textContent=msg; layer.appendChild(banner); for(let i=0;i<24;i++){const p=document.createElement('div'); p.className='confetti'; p.style.left=Math.random()*100+'%'; p.style.background=['#4f46e5','#059669','#f59e0b','#ea580c','#7c3aed'][i%5]; p.style.animationDelay=(Math.random()*.4)+'s'; layer.appendChild(p);} setTimeout(()=>{layer.innerHTML='';},1600); haptic();}
  function checkCelebrations(){const li=levelInfo(); if(li.cur.level>lastLevel){lastLevel=li.cur.level; celebrate(`Level up! ${li.cur.icon} ${li.cur.name}`);} else lastLevel=li.cur.level;}
  function renderOnboarding(){if(state.settings.onboardingComplete)return; onboardStep=0; showOnboardStep();}
  function clearOnboardHighlights(){
    $$('.nav-item').forEach(n=>n.classList.remove('onboard-highlight'));
    $('#fabAdd')?.classList.remove('onboard-highlight');
    $('#topSettingsBtn')?.classList.remove('onboard-highlight');
  }
  function positionOnboardCallout(step, remeasure=false){
    const shell=$('.app-shell'), card=$('#onboardCard'), spot=$('#onboardSpotlight'), bd=$('#onboardBackdrop');
    if(!shell||!card)return;
    const shellRect=shell.getBoundingClientRect();
    const cardW=Math.min(300,shellRect.width-28);
    const tabbarH=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tabbar-h'))||62;
    const adH=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ad-banner-h'))||0;
    const bottomReserve=tabbarH+adH;
    const bottomGap=14;
    bd?.classList.toggle('onboard-fullscreen',step.layout==='fullscreen');
    card.classList.toggle('onboard-center',step.layout==='fullscreen');
    if(step.layout==='fullscreen'){
      if(spot){spot.hidden=true; spot.style.cssText='';}
      card.style.top='50%'; card.style.left='50%'; card.style.width=Math.min(320,shellRect.width-32)+'px'; card.style.transform='translate(-50%,-50%)';
      return;
    }
    card.style.transform='none';
    const el=step.target?$(step.target):null;
    if(!el){if(spot)spot.hidden=true; card.classList.add('onboard-center'); card.style.top='50%'; card.style.left='50%'; card.style.width=cardW+'px'; card.style.transform='translate(-50%,-50%)'; return;}
    const rect=el.getBoundingClientRect();
    const pad=step.spotlightRound?3:5;
    const top=rect.top-shellRect.top-pad;
    const left=rect.left-shellRect.left-pad;
    const width=rect.width+pad*2;
    const height=rect.height+pad*2;
    if(spot){
      spot.hidden=false;
      if(step.spotlightRound){
        const size=Math.max(width,height)+4;
        const cx=left+width/2, cy=top+height/2;
        spot.style.borderRadius='50%';
        spot.style.top=Math.max(6,cy-size/2)+'px';
        spot.style.left=Math.max(6,Math.min(cx-size/2,shellRect.width-size-6))+'px';
        spot.style.width=Math.min(size,shellRect.width-12)+'px';
        spot.style.height=Math.min(size,shellRect.height-12)+'px';
      }else{
        spot.style.borderRadius=step.highlightNav?'12px':'14px';
        spot.style.top=Math.max(6,top)+'px';
        spot.style.left=Math.max(6,left)+'px';
        spot.style.width=Math.min(width,shellRect.width-12)+'px';
        spot.style.height=Math.min(height,shellRect.height-12)+'px';
      }
    }
    const anchor=step.cardAnchor||step.placement||'below';
    let cardTop,cardLeft;
    const cardH=card.offsetHeight||170;
    if(anchor==='near-bottom'||anchor==='above-tabbar'){
      cardTop=shellRect.height-bottomReserve-cardH-bottomGap;
      cardLeft=(shellRect.width-cardW)/2;
    }else if(anchor==='top'){
      cardTop=68; cardLeft=(shellRect.width-cardW)/2;
    }else if(anchor==='below-header'){
      cardTop=Math.min(shellRect.height-bottomReserve-cardH-bottomGap, top+height+14);
      cardLeft=14;
    }else if(anchor==='below'){
      cardTop=Math.min(shellRect.height-bottomReserve-cardH-bottomGap, top+height+12);
      cardLeft=Math.max(14, Math.min(left, shellRect.width-cardW-14));
    }else{
      cardTop=Math.max(68, top-150);
      cardLeft=Math.max(14, Math.min(left, shellRect.width-cardW-14));
    }
    const maxTop=shellRect.height-bottomReserve-cardH-bottomGap;
    cardTop=Math.min(cardTop, maxTop);
    card.style.top=Math.max(12,cardTop)+'px';
    card.style.left=Math.max(14,cardLeft)+'px';
    card.style.width=cardW+'px';
    if(!remeasure && (anchor==='near-bottom'||anchor==='above-tabbar'||anchor==='below-header')){
      requestAnimationFrame(()=>positionOnboardCallout(step,true));
    }
  }
  function showOnboardStep(){
    const bd=$('#onboardBackdrop'), body=$('#onboardBody'); if(!bd)return;
    const step=ONBOARD_STEPS[onboardStep];
    $('#onboardStepLabel').textContent=`Step ${onboardStep+1} of ${ONBOARD_STEPS.length}`;
    $('#onboardBarFill').style.width=((onboardStep+1)/ONBOARD_STEPS.length*100)+'%';
    const label=step.label?`<div class="onboard-spotlight-label">${escapeHtml(step.label)}</div>`:'';
    body.innerHTML=`<div class="onboard-body"><h3>${step.title}</h3><p>${step.body}</p>${label}</div>`;
    const back=$('#onboardBack'); if(back) back.disabled=onboardStep===0;
    const next=$('#onboardNext'); if(next) next.textContent=step.final?'Get started':'Next';
    clearOnboardHighlights();
    if(step.highlightNav) $$(`.nav-item[data-view="${step.highlightNav}"]`).forEach(n=>n.classList.add('onboard-highlight'));
    if(step.highlightFab) $('#fabAdd')?.classList.add('onboard-highlight');
    if(step.highlightSettings) $('#topSettingsBtn')?.classList.add('onboard-highlight');
    if(step.view){showView(step.view); const host=$('.view-host'); if(host) host.scrollTop=0;}
    requestAnimationFrame(()=>positionOnboardCallout(step));
    bd.classList.add('show'); bd.setAttribute('aria-hidden','false');
  }
  function finishOnboarding(){
    clearOnboardHighlights();
    state.settings.onboardingComplete=true;
    localStorage.setItem(STORAGE,JSON.stringify(state));
    $('#onboardBackdrop')?.classList.remove('show','onboard-fullscreen');
    $('#onboardBackdrop')?.setAttribute('aria-hidden','true');
    const spot=$('#onboardSpotlight'); if(spot) spot.hidden=true;
    celebrate('You\'re all set! 🎉');
  }
  function giftProgress(rule){
    const target=Number(rule.days||30);
    const streak=streakAt(hkNow(),Number(rule.pct||80));
    const earned=giftCount(rule);
    const remainder=streak%target;
    const current=earned>0 && remainder===0 ? target : remainder;
    return {current,target,pct:target?Math.min(100,Math.round(current/target*100)):0};
  }
  function renderTopProfile(){
    const li=levelInfo();
    const avatarEls=['#topProfileAvatar','#levelProfileAvatar','#settingsProfileAvatar'];
    avatarEls.forEach(sel=>{const el=$(sel); if(!el)return; el.style.backgroundImage=''; el.textContent=li.cur.icon||'🌱';});
    const topLevel=$('#topLevel'); if(topLevel) topLevel.textContent='Lv '+li.cur.level;
    const topName=$('#topIdentityName'); if(topName) topName.textContent=li.cur.name||'';
    const fill=$('#topLevelFill'); if(fill) fill.style.width=li.pct+'%';
    const pctEl=$('#topLevelPct'); if(pctEl) pctEl.textContent=li.pct+'%';
    const xpEl=$('#topLevelXp'); if(xpEl) xpEl.textContent=fmtXp(li.xp)+' EXP';
  }
  function renderAccentRow(){
    const row=$('#accentColorRow'); if(!row) return;
    const cur=state.settings.accentColor||'indigo';
    row.innerHTML=ACCENTS.map(a=>`<button type="button" class="accent-swatch ${a.id===cur?'active':''}" data-accent="${a.id}" style="background:${a.brand}" aria-label="${a.id}"></button>`).join('');
  }
  function openRewardSettings(tab){
    rewardActiveTab=tab||'credit';
    showView('settingsView');
    if(!$('#rewardTabs')) renderSettings(true);
    else {
      drawRewardPanel(rewardActiveTab);
      $$('#rewardTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===rewardActiveTab));
    }
    setTimeout(()=>$('#rewardSettings')?.scrollIntoView({behavior:'smooth',block:'start'}),40);
  }
  function renderLevel(){
    ensureRewardShape(); const li=levelInfo(); renderTopProfile();
    $('#levelPageValue').textContent='Lv '+li.cur.level; $('#levelPageIdentity').textContent=(li.cur.icon||'🌱')+' '+li.cur.name; $('#levelPageFill').style.width=li.pct+'%';
    $('#levelPageXp').textContent=li.next.level===li.cur.level?`${fmtXp(li.xp)} EXP · Max tier reached`:`${fmtXp(li.xp)} / ${fmtXp(li.next.xp)} EXP · Next: ${li.next.icon} ${li.next.name}`;
    $('#identityPath').innerHTML=identities.map(x=>{const unlocked=li.xp>=x.xp; return `<div class="tier-card ${x.level===li.cur.level?'current':''} ${unlocked?'':'locked'}"><div class="tier-icon">${x.icon}</div><div><div class="tier-name">Lv ${x.level} · ${x.name}</div><div class="tier-sub">${fmtXp(x.xp)} EXP · ${x.desc}</div></div><span class="chip ${unlocked?'green':'gray'}">${unlocked?'Unlocked':'Locked'}</span></div>`;}).join('');
    const xpItems=[]; const seen=new Set();
    state.records.filter(r=>afterStart(r.date)).forEach(r=>{const h=state.habits.find(x=>x.id===r.habitId)||{}; if(!h.id)return; const key=habitXpKey(h,parseDate(r.date)); if(seen.has(key))return; seen.add(key); xpItems.push({date:r.date,at:r.at,desc:`${h.emoji||'✓'} ${h.name||'Habit'} completed`,xp:habitPeriodXp(h,parseDate(r.date))});});
    Object.keys(state.journals).filter(k=>afterStart(k)&&!isVacationDay(k)).forEach(k=>xpItems.push({date:k,at:state.journals[k]?.updatedAt||k,desc:'📓 Journal completed',xp:5}));
    ledger().forEach(l=>{if(l.xp) xpItems.push({date:l.date,at:l.date,desc:l.desc,xp:l.xp});}); xpItems.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
    renderPreview($('#xpHistory'),xpItems,xpNode,'EXP History');
  }
  function renderRewards(){
    ensureRewardShape();
    renderGiftRedeem();
  }
  function renderGiftRedeem(){
    ensureRewardShape(); if(!$('#creditValue'))return; const rewards=state.settings.rewards; const rules=rewards.giftRules||[]; const bal=creditTotal();
    $('#creditValue').textContent='HK$'+bal;
    const active=activeGiftRule(); const activeAvail=active?giftCount(active):0;
    $('#giftUnlockValue').textContent=activeAvail; $('#giftUnlockSub').textContent=active?('of '+(active.gift||'Gift')):'no gift goal';

    const goalOptions=rules.map(g=>`<option value="${g.id}" ${g.id===rewards.activeGiftId?'selected':''}>${escapeHtml(g.gift||'Gift')}</option>`).join('');
    const gp=active?giftProgress(active):{current:0,target:0,pct:0};
    const canRedeemGift=activeAvail>0;
    const canRedeemCredit=bal>0;
    const giftCardHtml = active ? `<div class="gift-card gift-goal" style="grid-column:1/-1"><div class="card-head"><h3>Gift Rewards</h3><span class="chip purple">${activeAvail} available</span></div><div class="field"><label>Pursuing</label><select id="activeGiftSelect">${goalOptions}</select></div><div class="goal-hero"><div class="gift-icon">${active.icon||'🎁'}</div><div style="flex:1;min-width:0"><div class="gift-title">${escapeHtml(active.gift||'Gift')}</div><div class="gift-sub">${active.days} days at ${active.pct}%+</div><div class="progress-mini" style="margin-top:8px"><span style="width:${gp.pct}%"></span></div><div class="gift-sub">${gp.current}/${gp.target} days</div></div></div><button class="btn-gold ${canRedeemGift?'redeem-ready':'redeem-locked'}" style="margin-top:12px" id="redeemGiftBtn" ${canRedeemGift?'':'disabled'}">${canRedeemGift?'Redeem '+escapeHtml(active.gift||'Gift'):'Not unlocked yet'}</button></div>` : `<div class="gift-empty" style="grid-column:1/-1">No gift goal yet. Add one in Settings → Reward Rules.</div>`;

    $('#redeemGrid').innerHTML=`<div class="gift-card credit-spend" style="grid-column:1/-1"><div class="card-head"><h3>Credit Rewards</h3><span class="chip orange">HK$${bal} available</span></div><div class="redeem-form"><div class="field"><label>Redeemed For</label><input id="creditSpendText" placeholder="e.g. headphone, game, coffee"></div><div class="field"><label>Credit Amount</label><input id="creditSpendAmount" type="number" min="0" max="${bal}" step="1" value="${Math.min(10,bal)}"><input id="creditSpendSlider" type="range" min="0" max="${bal}" step="1" value="${Math.min(10,bal)}"><div class="inline-hint">Use the number box or slider, up to your balance.</div></div><button class="btn-primary ${canRedeemCredit?'':'btn-dim'}" id="spendCreditBtn" ${canRedeemCredit?'':'disabled'}>Redeem Credit</button></div></div>` + giftCardHtml;

    const slider=$('#creditSpendSlider'), amount=$('#creditSpendAmount'); if(slider&&amount){slider.oninput=()=>amount.value=slider.value; amount.oninput=()=>{let v=Math.max(0,Math.min(bal,Number(amount.value||0))); amount.value=v; slider.value=v;};}
    renderPreview($('#ledgerList'),ledger(),ledgerNode,'Reward Ledger',1);
  }
  async function spendCreditReward(){
    const bal=creditTotal(); if(bal<=0) return;
    const amt=Number($('#creditSpendAmount')?.value||0);
    const what=$('#creditSpendText')?.value.trim()||'';
    if(!what){toast('Enter what you redeemed');return;}
    if(amt<=0){toast('Enter credit amount');return;}
    if(creditTotal()<amt){toast('Not enough credits');return;}
    state.redemptions.push({id:uid(),date:todayKey(),type:'redeemCredit',desc:'Credit spend · '+what,credit:-amt,xp:0,what});
    celebrate('Credit redeemed! HK$'+amt+' · '+what);
    await save(false,{render:'rewardsView'});
    refreshEconomyDisplays();
    toast('Credit redeemed');
  }
  async function redeemGiftReward(){
    const g=activeGiftRule(); if(!g) return;
    if(giftCount(g)<=0){toast('Gift not unlocked yet');return;}
    state.redemptions.push({id:uid(),date:todayKey(),type:'redeemGift',desc:'Redeemed '+(g.gift||'Gift'),gift:g.gift||'Gift',giftIcon:g.icon||'🎁',giftRuleId:g.id,credit:0,xp:0});
    celebrate('Gift redeemed! '+(g.icon||'🎁')+' '+(g.gift||'Gift'));
    await save(false,{render:'rewardsView'});
    toast('Gift redeemed');
  }

  /* ---------- SETTINGS ---------- */
  function renderSyncActions(){
    const grid=$('#syncActionsGrid'); if(!grid)return;
    const connected=!!fileHandle;
    grid.innerHTML='';
    if(connected){
      grid.innerHTML='<button type="button" class="btn-secondary" data-sync-action="export">Export a copy</button><button type="button" class="btn-inline gray" data-sync-action="disconnect">Disconnect file</button>';
    }else{
      grid.innerHTML='<button type="button" class="btn-primary" data-sync-action="create">Create backup file</button><button type="button" class="btn-secondary" data-sync-action="connect">Connect existing file</button><label class="btn-secondary sync-import-label">Import JSON<input type="file" id="importInput" accept="application/json" hidden></label>';
    }
    grid.querySelectorAll('[data-sync-action]').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.preventDefault(); e.stopPropagation();
        void handleSyncAction(btn.dataset.syncAction);
      });
    });
  }
  async function handleSyncAction(action){
    if(action==='export') return exportJson();
    if(action==='create') return createFile();
    if(action==='connect') return connectFile();
    if(action==='disconnect'){
      fileHandle=null; state.settings.fileConnected=false; state.settings.autoBackup=false; state.settings.dailyBackup=false;
      clearTimeout(backupDebounceTimer); await clearStoredFileHandle(); await save(true,{render:'none'});
      updateStatus(); refreshSettingsChrome(); toast('Disconnected');
    }
  }
  function renderBackupStatus(){
    const box=$('#backupStatus'); if(!box)return;
    const connected=!!fileHandle;
    const updated=formatBackupTime(state.settings.lastBackupAt);
    box.className='sync-status-panel'+(connected?' connected':state.settings.fileConnected?' warn':'');
    const stamp=`<div class="small-note" style="margin-top:6px">Last updated: <strong>${updated}</strong></div>`;
    const linked=!!fileHandle;
    const named=state.settings.backupFileName?` · ${escapeHtml(state.settings.backupFileName)}`:'';
    if(linked) box.innerHTML=`<strong>Linked</strong>${named}${stamp}`;
    else if(state.settings.fileConnected) box.innerHTML=(state.settings.autoBackup?`<strong>Linked on this device</strong>${named}${stamp}`:`<strong>Previously linked</strong>${named}${stamp}`);
    else box.innerHTML=`<strong>Not connected</strong>${stamp}`;
  }
  function openImportConnectModal(){
    if(!window.showOpenFilePicker){toast('Connect file needs Chrome/Edge on desktop');return;}
    openModal('Keep syncing?',`<p class="sheet-text">Your data is loaded. Connect the backup file on this device so future edits sync automatically.</p><div class="modal-actions"><button class="btn-secondary" data-close>Not now</button><button class="btn-primary" id="connectAfterImportBtn">Connect file</button></div>`);
    $('#connectAfterImportBtn').onclick=async()=>{closeModal(); await connectFile();};
  }
  function renderVacationSettings(){
    const box=$('#vacationSummary'); if(!box)return;
    const list=state.settings.vacations||[];
    const active=list.filter(v=>v.to>=todayKey());
    const t=todayKey();
    const onPause=list.some(v=>t>=v.from&&t<=v.to);
    if(!list.length) box.innerHTML='<div class="small-note">No pause periods configured.</div>';
    else if(onPause){const v=list.find(x=>t>=x.from&&t<=x.to); box.innerHTML=`<strong>Currently paused</strong><div class="small-note" style="margin-top:4px">${escapeHtml(v?.label||'Pause')} · ${v?.from} → ${v?.to}</div>`;}
    else box.innerHTML=`<strong>${list.length} pause period${list.length===1?'':'s'}</strong><div class="small-note" style="margin-top:4px">${active.length} upcoming · view log for full history</div>`;
  }
  function addGroup(){
    state.groups.push({id:uid(),name:'New Group',emoji:'📋',color:COLOURS[state.groups.length%COLOURS.length],sortOrder:state.groups.length});
    invalidateHomeCaches();
    renderGroupManager();
    renderHome();
    toast('Group added');
    void save(false,{render:'none'});
  }
  async function savePausePeriod(){
    const from=$('#pauseFrom')?.value, to=$('#pauseTo')?.value;
    if(!from||!to){toast('Select dates');return;}
    if(to<from){toast('End date must be on or after start');return;}
    if(!Array.isArray(state.settings.vacations)) state.settings.vacations=[];
    state.settings.vacations.push({id:uid(),from,to,label:($('#pauseLabel')?.value||'Pause').trim()});
    const done=pauseModalDone;
    pauseModalDone=null;
    closeModal();
    renderVacationSettings();
    invalidateHomeCaches();
    renderHome();
    toast('Pause period added');
    void save(false,{render:'none'});
    if(done) done();
  }
  function openAddPauseModal(onDone){
    const t=todayKey(); const e=new Date(hkNow()); e.setDate(e.getDate()+6);
    pauseModalDone=onDone||null;
    openModal('Add Pause Period',`<div class="form-grid"><div class="schedule-grid"><div class="field"><label>From</label><input type="date" id="pauseFrom" value="${t}"></div><div class="field"><label>To</label><input type="date" id="pauseTo" value="${dateKey(e)}"></div></div><div class="field"><label>Label</label><input id="pauseLabel" value="Pause" placeholder="Pause"></div><button class="btn-primary" id="savePauseBtn" type="button">Add pause period</button></div>`);
    $('#savePauseBtn')?.addEventListener('click',e=>{e.preventDefault(); e.stopPropagation(); void savePausePeriod();});
  }
  function openVacationLog(){
    const list=[...(state.settings.vacations||[])].sort((a,b)=>b.from.localeCompare(a.from));
    openModal('Pause periods',`<div id="vacationLogList" style="margin-top:8px"></div><button class="btn-secondary" id="addVacationFromLog" style="margin-top:12px">+ Add pause period</button>`);
    const box=$('#vacationLogList');
    if(!list.length) box.innerHTML='<div class="empty">No pause periods yet.</div>';
    else list.forEach((v,idx)=>{
      const realIdx=state.settings.vacations.indexOf(v);
      const div=document.createElement('div'); div.className='rule-card';
      div.innerHTML=`<div class="schedule-grid"><div class="field"><label>From</label><input type="date" data-from value="${v.from}"></div><div class="field"><label>To</label><input type="date" data-to value="${v.to}"></div></div><div class="field"><label>Label</label><input data-label value="${escapeAttr(v.label||'Pause')}" placeholder="Pause"></div><button class="btn-inline red" data-rm>Remove</button>`;
      div.querySelector('[data-from]').onchange=e=>{v.from=e.target.value; save(false,{render:'none'}); renderVacationSettings();};
      div.querySelector('[data-to]').onchange=e=>{v.to=e.target.value; save(false,{render:'none'}); renderVacationSettings();};
      div.querySelector('[data-label]').onchange=e=>{v.label=e.target.value; save(false,{render:'none'});};
      div.querySelector('[data-rm]').onclick=()=>{state.settings.vacations.splice(realIdx,1); save(false,{render:'none'}); invalidateHomeCaches(); renderHome(); toast('Pause period removed'); openVacationLog();};
      box.appendChild(div);
    });
    $('#addVacationFromLog').onclick=()=>openAddPauseModal(()=>openVacationLog());
  }
  function renderDataModeSettings(){
    const sw=$('#demoModeSwitch');
    if(!sw) return;
    const demo=(state.settings.dataMode||'real')==='demo';
    sw.classList.toggle('on',demo);
  }
  async function toggleDemoMode(){
    const turningOn=(state.settings.dataMode||'real')!=='demo';
    const mode=turningOn?'demo':'real';
    const label=mode==='real'?'real use (clean slate)':'demo data (sample habits and history)';
    if(!confirm(`Replace all habits, records, and journals with ${label}? Profile and appearance settings are kept.`)) return;
    await applyDataMode(mode);
  }
  async function applyDataMode(mode){
    const keep={colorMode:state.settings.colorMode,styleTheme:state.settings.styleTheme,userName:state.settings.userName,profileIcon:state.settings.profileIcon,adsRemoved:!!state.settings.adsRemoved,adsRemovedAt:state.settings.adsRemovedAt||'',googleClientId:state.settings.googleClientId||''};
    localStorage.setItem('momentumDataMode',mode);
    state=stateForMode(mode,{onboardingComplete:true,keep});
    normalizeState();
    invalidateSettings();
    fileHandle=null;
    weekOffset=0; reportCursor=currentReportMonth();
    await save(true,{render:'all'});
    toast(mode==='real'?'Real use mode — start adding habits':'Demo data loaded');
    resetSettingsDraft();
    renderDataModeSettings();
  }
  function refreshSettingsChrome(){
    renderVacationSettings(); renderSyncActions(); renderDataModeSettings(); renderBackupStatus();
    if(!settingsFormDirty()){
      const start=$('#trackerStartDate'); if(start) start.value=state.settings.startDate||todayKey();
      const disp=$('#startDateDisplay'); if(disp) disp.textContent=state.settings.startDate||todayKey();
      $('#reminderSwitch')?.classList.toggle('on',!!state.settings.reminders);
    }
    const autoSw=$('#autoBackupSwitch');
    if(autoSw){
      autoSw.classList.toggle('on',!!state.settings.autoBackup);
      const autoLocked=!fileHandle && !state.settings.fileConnected;
      autoSw.classList.toggle('locked',autoLocked);
      if(autoLocked) autoSw.setAttribute('data-locked','true');
      else autoSw.removeAttribute('data-locked');
    }
    window.MomentumLaunch?.renderDriveUi?.();
    window.MomentumLaunch?.renderWidgetUi?.();
    window.MomentumLaunch?.renderAdsUi?.();
  }
  function refreshBackupChrome(){ updateStatus(); refreshSettingsChrome(); }
  function drawRewardPanel(tab=rewardActiveTab){
    ensureRewardShape(); const r=state.settings.rewards;
    rewardActiveTab=tab; const p=$('#rewardPanel'); if(!p)return;
    if(tab==='credit'){
      p.innerHTML=`<div class="panel-intro"><div class="panel-intro-title">Credit rules ${infoTip('Each completion level can be used once. A 100% day also earns every lower level\'s reward.','Credit rules')}</div></div><div id="creditRulesBox"></div><button class="btn-secondary add-rule-btn" id="addCreditRule" type="button">+ Add credit rule</button>`;
      const box=$('#creditRulesBox'); box.innerHTML='';
      (r.creditRules||[]).forEach((rule,idx)=>{const div=document.createElement('div'); div.className='rule-card'; div.innerHTML=`<div class="rule-card-head"><div class="rule-card-title">Credit rule</div><span class="gift-rule-chip" data-chip>HK$${rule.amount||0}</span></div><div class="rule-grid"><div class="rule-row"><div class="field"><label>Completion</label><select data-pct>${[50,60,70,80,90,100].map(n=>`<option value="${n}">${n}%+</option>`).join('')}</select></div><div class="field"><label>Amount</label><div class="money-input"><span class="money-prefix">$</span><input type="number" data-amount min="0" step="1" inputmode="decimal" value="${rule.amount??2}"></div></div></div></div><div class="rule-actions"><button class="btn-text-danger" data-remove type="button">Remove</button></div>`; const pctSel=div.querySelector('[data-pct]'); const amtSel=div.querySelector('[data-amount]'); const chip=div.querySelector('[data-chip]'); pctSel.value=String(rule.pct??100); amtSel.value=String(rule.amount??2); const syncChip=()=>{if(chip) chip.textContent='HK$'+(Number(amtSel.value)||0);}; syncChip(); const persist=()=>{const rules=state.settings.rewards.creditRules||[]; const cur=rules[idx]; if(!cur)return; const pct=Number(pctSel.value); const dup=rules.some((x,i)=>i!==idx&&Number(x.pct)===pct); if(dup){toast('Duplicate completion %'); pctSel.value=String(cur.pct??100); return;} cur.pct=pct; cur.amount=Math.max(0,Number(amtSel.value)||0); syncChip(); markSettingsDirty();}; pctSel.onchange=persist; amtSel.onchange=persist; amtSel.oninput=persist; div.querySelector('[data-remove]').dataset.ruleRemove='credit'; div.querySelector('[data-remove]').dataset.ruleIdx=String(idx); box.appendChild(div);});
    } else if(tab==='penalty'){
      const missOpts=[50,40,30,20,10,0];
      const curMiss=Number(r.penaltyMissPct??0);
      const missList=missOpts.includes(curMiss)?missOpts:[curMiss,...missOpts].sort((a,b)=>b-a);
      const missLabel=n=>n<=0?'0%':'<'+n+'%';
      p.innerHTML=`<div class="panel-intro"><div class="panel-intro-title">Penalty rules ${infoTip('A miss is a day below the selected completion (0% means only empty days). Each miss day is charged once. No penalty if credit and EXP are already 0.','Penalty rules')}</div></div><div class="rule-card"><div class="rule-grid"><div class="field field-full"><label>Completion trigger</label><select id="penaltyMissPct">${missList.map(n=>`<option value="${n}">${missLabel(n)}</option>`).join('')}</select><div class="inline-hint">0% = only empty days. &lt;50% counts anything under 50% as a miss.</div></div><div class="rule-row"><div class="field"><label>Deduct credit</label><div class="money-input"><span class="money-prefix">$</span><input type="number" id="penaltyCredit" min="0" step="1" inputmode="decimal" value="${Number(r.penaltyCredit??5)}"></div></div><div class="field"><label>Deduct EXP</label><select id="penaltyXp">${[0,10,20,30,50,100].map(n=>`<option value="${n}">${n} EXP</option>`).join('')}</select></div></div></div></div>`;
      $('#penaltyCredit').value=r.penaltyCredit??5; $('#penaltyXp').value=r.penaltyXp||20; $('#penaltyMissPct').value=String(curMiss);
      const persist=()=>{r.penaltyZeroDays=1; r.penaltyCredit=Math.max(0,Number($('#penaltyCredit').value)||0); r.penaltyXp=Number($('#penaltyXp').value); r.penaltyMissPct=Math.max(0,Math.min(100,Number($('#penaltyMissPct').value)||0)); markSettingsDirty();};
      $('#penaltyCredit').onchange=persist; $('#penaltyCredit').oninput=persist; $('#penaltyXp').onchange=persist; $('#penaltyMissPct').onchange=persist;
    } else {
      p.innerHTML=`<div class="panel-intro"><div class="panel-intro-title">Gift rules ${infoTip('Unlock a gift for keeping a streak. Earned gifts appear on the Rewards page.','Gift rules')}</div></div><div id="giftRulesBox"></div><button class="btn-secondary add-rule-btn" id="addGiftRule" type="button">+ Add gift rule</button>`;
      const box=$('#giftRulesBox'); box.innerHTML='';
      (r.giftRules||[]).forEach((g,idx)=>{const div=document.createElement('div'); div.className='rule-card'; div.innerHTML=`<div class="rule-card-head"><div class="rule-card-title">Gift rule</div><span class="gift-rule-chip">${g.icon||'🎁'} ${escapeHtml(g.gift||'Gift')}</span></div><div class="rule-grid"><div class="rule-row icon-name"><div class="field"><label>Icon</label><input class="rule-input-icon" data-icon value="${escapeAttr(g.icon||'🎁')}" maxlength="4" placeholder="🍽️"></div><div class="field"><label>Gift name</label><input data-gift value="${escapeAttr(g.gift||'Buffet')}" placeholder="Buffet"></div></div><div class="rule-row"><div class="field"><label>Completion</label><select data-pct>${[50,60,70,80,90,100].map(n=>`<option value="${n}">${n}%+</option>`).join('')}</select></div><div class="field"><label>Streak days</label><select data-days>${[7,14,21,30,45,60,90,120].map(n=>`<option value="${n}">${n} days</option>`).join('')}</select></div></div></div><div class="rule-actions"><button class="btn-text-danger" data-remove type="button">Remove</button></div>`; div.querySelector('[data-pct]').value=g.pct||80; div.querySelector('[data-days]').value=g.days||30; const persist=()=>{const rules=state.settings.rewards.giftRules||[]; const cur=rules[idx]; if(!cur)return; cur.icon=div.querySelector('[data-icon]').value.trim()||'🎁'; cur.gift=div.querySelector('[data-gift]').value.trim()||'Gift'; cur.pct=Number(div.querySelector('[data-pct]').value); cur.days=Number(div.querySelector('[data-days]').value); markSettingsDirty();}; div.querySelector('[data-icon]').onchange=persist; div.querySelector('[data-gift]').onchange=persist; div.querySelector('[data-pct]').onchange=persist; div.querySelector('[data-days]').onchange=persist; div.querySelector('[data-icon]').oninput=persist; div.querySelector('[data-gift]').oninput=persist; div.querySelector('[data-remove]').dataset.ruleRemove='gift'; div.querySelector('[data-remove]').dataset.ruleIdx=String(idx); box.appendChild(div);});
    }
  }
  function cloneRewards(){ ensureRewardShape(); return JSON.parse(JSON.stringify(state.settings.rewards)); }
  function snapshotRewardsDraft(){ rewardsDraft=cloneRewards(); }
  function rewardsFormDirty(){
    if(!rewardsDraft) return false;
    ensureRewardShape();
    return JSON.stringify(state.settings.rewards)!==JSON.stringify(rewardsDraft);
  }
  function applyRewardsDraft(){
    if(!rewardsDraft) return;
    ensureRewardShape();
    state.settings.rewards=JSON.parse(JSON.stringify(rewardsDraft));
    drawRewardPanel(rewardActiveTab);
    refreshEconomyDisplays();
    if($('#rewardsView')?.classList.contains('active')) renderGiftRedeem();
  }
  function markSettingsDirty(){ updateSettingsSaveBar(); }
  function snapshotSettingsDraft(){
    return{
      userName:(state.settings.userName||'').slice(0,USER_NAME_MAX),
      colorMode:state.settings.colorMode||'system',
      accentColor:state.settings.accentColor||'indigo',
      weekStart:state.settings.weekStart||'mon',
      profileIcon:state.settings.profileIcon||'',
      startDate:state.settings.startDate||todayKey(),
      reminders:!!state.settings.reminders,
      globalReminderTime:state.settings.globalReminderTime||'20:30',
      defaultReminderMessage:state.settings.defaultReminderMessage||'Time for {habit}!'
    };
  }
  function readSettingsForm(){
    return{
      userName:($('#userNameInput')?.value||'').trim().slice(0,USER_NAME_MAX),
      colorMode:$('#colorModeSelect')?.value||'system',
      accentColor:state.settings.accentColor||'indigo',
      weekStart:$('#weekStartSelect')?.value||state.settings.weekStart||'mon',
      profileIcon:settingsPendingProfile??state.settings.profileIcon??'',
      startDate:$('#trackerStartDate')?.value||todayKey(),
      reminders:!!$('#reminderSwitch')?.classList.contains('on'),
      globalReminderTime:$('#globalReminderTime')?.value||'20:30',
      defaultReminderMessage:($('#defaultReminderMessage')?.value||'Time for {habit}!').slice(0,REMINDER_MSG_LIMIT)
    };
  }
  function applySettingsForm(draft){
    const un=$('#userNameInput'); if(un) un.value=draft.userName||'';
    const nameCount=$('#userNameCount'); if(nameCount) nameCount.textContent=String((draft.userName||'').length);
    const cms=$('#colorModeSelect'); if(cms) cms.value=draft.colorMode||'system';
    const ws=$('#weekStartSelect'); if(ws) ws.value=draft.weekStart||'mon';
    const start=$('#trackerStartDate'); if(start) start.value=draft.startDate||todayKey();
    const disp=$('#startDateDisplay'); if(disp) disp.textContent=draft.startDate||todayKey();
    $('#reminderSwitch')?.classList.toggle('on',!!draft.reminders);
    const grt=$('#globalReminderTime'); if(grt) grt.value=draft.globalReminderTime||'20:30';
    const drm=$('#defaultReminderMessage'); if(drm) drm.value=draft.defaultReminderMessage||'Time for {habit}!';
    settingsPendingProfile=null;
    renderTopProfile();
  }
  function settingsFormDirty(){
    if(!settingsDraft) return false;
    const cur=readSettingsForm();
    return Object.keys(settingsDraft).some(k=>settingsDraft[k]!==cur[k]);
  }
  function settingsDirty(){ return settingsFormDirty() || rewardsFormDirty(); }
  function updateSettingsSaveBar(){
    const bar=$('#settingsSaveBar');
    if(!bar) return;
    const dirty=settingsDirty();
    bar.hidden=!dirty;
    document.body.classList.toggle('settings-dirty',dirty);
  }
  function resetSettingsDraft(){
    settingsDraft=snapshotSettingsDraft();
    snapshotRewardsDraft();
    settingsPendingProfile=null;
    applySettingsForm(settingsDraft);
    updateSettingsSaveBar();
  }
  async function saveSettingsForm(){
    const form=readSettingsForm();
    if(form.reminders && !state.settings.reminders){
      if(window.MomentumLaunch?.requestNotifPermission) await window.MomentumLaunch.requestNotifPermission();
      else if('Notification' in window && Notification.permission==='default'){
        const perm=await Notification.requestPermission();
        if(perm==='denied') toast('Browser notifications blocked — reminders will use in-app alerts');
      }
    }
    state.settings.userName=form.userName;
    state.settings.colorMode=form.colorMode;
    state.settings.accentColor=form.accentColor||'indigo';
    state.settings.weekStart=form.weekStart||'mon';
    state.settings.profileIcon=form.profileIcon;
    state.settings.startDate=form.startDate;
    state.settings.reminders=form.reminders;
    state.settings.globalReminderTime=form.globalReminderTime;
    state.settings.defaultReminderMessage=form.defaultReminderMessage;
    settingsPendingProfile=null;
    settingsDraft=snapshotSettingsDraft();
    snapshotRewardsDraft();
    $('#reminderSwitch')?.classList.toggle('on',!!form.reminders);
    applyAppearance();
    $('#greeting').textContent=timeGreeting()+greetName();
    renderTopProfile();
    setupReminderLoop();
    if(window.MomentumLaunch?.scheduleReminders) void window.MomentumLaunch.scheduleReminders();
    updateSettingsSaveBar();
    refreshSettingsChrome();
    refreshEconomyDisplays();
    if($('#rewardsView')?.classList.contains('active')) renderGiftRedeem();
    invalidateHomeCaches();
    renderHome();
    renderReport();
    await save(false,{render:'none'});
    toast('Settings saved');
  }
  function discardSettingsForm(){
    if(settingsDraft) applySettingsForm(settingsDraft);
    if(rewardsDraft) applyRewardsDraft();
    applyAppearance();
    updateSettingsSaveBar();
    toast('Changes discarded');
  }
  function bindSettingsSwitches(){
    const rem=$('#reminderSwitch');
    if(rem && !rem.dataset.bound){
      rem.dataset.bound='1';
      rem.addEventListener('click',e=>{e.preventDefault(); e.stopPropagation(); toggleRemindersDraft();});
    }
    const demo=$('#demoModeSwitch');
    if(demo && !demo.dataset.bound){
      demo.dataset.bound='1';
      demo.addEventListener('click',e=>{e.preventDefault(); e.stopPropagation(); void toggleDemoMode();});
    }
  }
  function bindSettingsFormWatchers(){
    const markDirty=()=>updateSettingsSaveBar();
    const un=$('#userNameInput');
    if(un && !un.dataset.bound){
      un.dataset.bound='1';
      un.oninput=()=>{const c=$('#userNameCount'); if(c)c.textContent=String(un.value.length); markDirty();};
    }
    const cms=$('#colorModeSelect');
    if(cms && !cms.dataset.bound){
      cms.dataset.bound='1';
      cms.onchange=()=>{applyAppearance(); markDirty();};
    }
    const wss=$('#weekStartSelect');
    if(wss && !wss.dataset.bound){
      wss.dataset.bound='1';
      wss.onchange=()=>markDirty();
    }
    const upload=$('#profileIconInput');
    if(upload && !upload.dataset.bound){
      upload.dataset.bound='1';
      upload.onchange=e=>{
        const file=e.target.files&&e.target.files[0];
        if(!file) return;
        const reader=new FileReader();
        reader.onload=()=>{settingsPendingProfile=reader.result; renderTopProfile(); markDirty();};
        reader.readAsDataURL(file);
        e.target.value='';
      };
    }
    const start=$('#trackerStartDate');
    if(start && !start.dataset.bound){
      start.dataset.bound='1';
      start.onchange=()=>{const disp=$('#startDateDisplay'); if(disp) disp.textContent=start.value||todayKey(); markDirty();};
    }
    bindReminderSettings();
    const saveBtn=$('#saveSettingsBtn');
    if(saveBtn && !saveBtn.dataset.bound){
      saveBtn.dataset.bound='1';
      saveBtn.addEventListener('click',e=>{e.preventDefault(); e.stopPropagation(); void saveSettingsForm();});
    }
    const discardBtn=$('#discardSettingsBtn');
    if(discardBtn && !discardBtn.dataset.bound){
      discardBtn.dataset.bound='1';
      discardBtn.addEventListener('click',e=>{e.preventDefault(); e.stopPropagation(); discardSettingsForm();});
    }
  }
  function bindReminderSettings(){
    const markDirty=()=>updateSettingsSaveBar();
    const grt=$('#globalReminderTime');
    if(grt && !grt.dataset.bound){
      grt.dataset.bound='1';
      grt.addEventListener('change',markDirty);
      grt.addEventListener('input',markDirty);
    }
    const drm=$('#defaultReminderMessage');
    if(drm && !drm.dataset.bound){
      drm.dataset.bound='1';
      drm.addEventListener('change',markDirty);
      drm.addEventListener('input',markDirty);
    }
  }
  function renderSettings(force=false){
    ensureRewardShape(); const rs=$('#rewardSettings'); if(!rs)return;
    const built=!force && rs.dataset.built==='1' && rs.querySelector('#rewardTabs');
    if(!built){
      rs.dataset.built='1';
      rs.innerHTML=`<div class="segmented reward-rule-tabs" id="rewardTabs"><button type="button" data-tab="credit" class="${rewardActiveTab==='credit'?'active':''}">Credit</button><button type="button" data-tab="gift" class="${rewardActiveTab==='gift'?'active':''}">Gift</button><button type="button" data-tab="penalty" class="${rewardActiveTab==='penalty'?'active':''}">Penalty</button></div><div id="rewardPanel" class="form-grid"></div>`;
      drawRewardPanel(rewardActiveTab);
      const un=$('#userNameInput'); if(un){un.value=(state.settings.userName||'').slice(0,USER_NAME_MAX); un.maxLength=USER_NAME_MAX;}
      const nameCount=$('#userNameCount'); if(nameCount) nameCount.textContent=String((un?.value||'').length);
      const cms=$('#colorModeSelect'); if(cms) cms.value=state.settings.colorMode||'system';
      const wss=$('#weekStartSelect'); if(wss) wss.value=state.settings.weekStart||'mon';
      renderAccentRow();
      const start=$('#trackerStartDate'); if(start) start.value=state.settings.startDate||todayKey();
      const disp=$('#startDateDisplay'); if(disp) disp.textContent=state.settings.startDate||todayKey();
    } else {
      $$('#rewardTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===rewardActiveTab));
      if(!settingsDirty()) drawRewardPanel(rewardActiveTab);
      renderAccentRow();
    }
    const remBox=$('#reminderSettings');
    if(remBox && !remBox.querySelector('#globalReminderTime')){
      remBox.innerHTML=`<div class="field"><label>Default Reminder Time</label><input type="time" id="globalReminderTime" value="${state.settings.globalReminderTime||'20:30'}"></div><div class="field"><label>Default notification message ${infoTip('{habit} is replaced with each habit\'s name when sent.')}</label><input id="defaultReminderMessage" maxlength="${REMINDER_MSG_LIMIT}" value="${escapeAttr(state.settings.defaultReminderMessage||'Time for {habit}!')}"></div>`;
      bindReminderSettings();
    } else if(remBox){
      const grt=$('#globalReminderTime'); if(grt) grt.value=state.settings.globalReminderTime||'20:30';
      const drm=$('#defaultReminderMessage'); if(drm) drm.value=state.settings.defaultReminderMessage||'Time for {habit}!';
      bindReminderSettings();
    }
    refreshSettingsChrome();
    renderDataModeSettings();
    bindSettingsSwitches();
    bindSettingsFormWatchers();
    if(force || !settingsDraft) resetSettingsDraft();
    else applySettingsForm(settingsDraft);
    renderTopProfile();
    renderSettingsVersion();
    const autoSw=$('#autoBackupSwitch');
    if(autoSw){
      const autoLocked=!fileHandle && !state.settings.fileConnected;
      autoSw.classList.toggle('locked',autoLocked);
      if(autoLocked) autoSw.setAttribute('data-locked','true');
      else autoSw.removeAttribute('data-locked');
    }
    window.MomentumLaunch?.renderDriveUi?.();
    window.MomentumLaunch?.renderWidgetUi?.();
    window.MomentumLaunch?.renderAdsUi?.();
  }
  function renderSettingsVersion(){
    const el=$('#settingsVersion');
    if(el) el.textContent=`Habit & Journal ${APP_VERSION}`;
  }
  /* ---------- FILE SYNC ---------- */
  function openHandleDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(FILE_HANDLE_DB,1);
      req.onupgradeneeded=()=>{req.result.createObjectStore('handles');};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function storeFileHandle(handle){
    if(!handle)return false;
    try{
      const db=await openHandleDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('handles','readwrite');
        tx.objectStore('handles').put(handle,FILE_HANDLE_KEY);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error);
      });
      return true;
    }catch(e){return false;}
  }
  async function loadStoredFileHandle(){
    try{
      const db=await openHandleDb();
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction('handles','readonly');
        const req=tx.objectStore('handles').get(FILE_HANDLE_KEY);
        req.onsuccess=()=>resolve(req.result||null);
        req.onerror=()=>reject(req.error);
      });
    }catch(e){return null;}
  }
  async function clearStoredFileHandle(){
    try{
      const db=await openHandleDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('handles','readwrite');
        tx.objectStore('handles').delete(FILE_HANDLE_KEY);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error);
      });
    }catch(e){}
  }
  function applyStoredFileHandle(stored){
    fileHandle=stored;
    state.settings.fileConnected=true;
    if(state.settings.autoBackup!==false) state.settings.autoBackup=true;
    state.settings.dailyBackup=!!state.settings.autoBackup;
    void stored.getFile().then(f=>{ if(f?.name){ state.settings.backupFileName=f.name; localStorage.setItem(STORAGE,JSON.stringify(state)); } }).catch(()=>{});
    localStorage.setItem(STORAGE,JSON.stringify(state));
  }
  async function verifyStoredHandle(stored){
    if(!stored) return false;
    try{
      if(stored.queryPermission){
        const perm=await stored.queryPermission({mode:'readwrite'});
        if(perm==='granted') return true;
        if(perm==='denied') return false;
      }
      await stored.getFile();
      return true;
    }catch(e){return false;}
  }
  async function restoreFileConnection(){
    const stored=await loadStoredFileHandle();
    if(!stored) return false;
    applyStoredFileHandle(stored);
    return true;
  }
  async function reconnectStoredFile(silent=false){
    const stored=await loadStoredFileHandle();
    if(!stored) return false;
    try{
      if(stored.queryPermission){
        let perm=await stored.queryPermission({mode:'readwrite'});
        if(perm!=='granted'){
          if(silent) return false;
          if(stored.requestPermission) perm=await stored.requestPermission({mode:'readwrite'});
          if(perm!=='granted') return false;
        }
      } else if(!(await verifyStoredHandle(stored))) return false;
      applyStoredFileHandle(stored);
      refreshBackupChrome();
      if(!silent) toast('Backup file linked');
      return true;
    }catch(e){return false;}
  }
  async function connectFile(){
    if(!window.showOpenFilePicker){toast('File connection needs Chrome/Edge on desktop. Use Export/Import instead.');return;}
    if(await reconnectStoredFile(false)){await flushBackupSync(); refreshBackupChrome(); return;}
    try{
      [fileHandle]=await window.showOpenFilePicker({types:[{description:'JSON Backup',accept:{'application/json':['.json']}}]});
      if(fileHandle.requestPermission){
        const perm=await fileHandle.requestPermission({mode:'readwrite'});
        if(perm!=='granted'){toast('Write permission denied'); fileHandle=null; return;}
      }
      const file=await fileHandle.getFile();
      const txt=await file.text();
      if(txt.trim()){state=JSON.parse(txt); normalizeState(); invalidateSettings();}
      state.settings.fileConnected=true;
      state.settings.autoBackup=true;
      state.settings.dailyBackup=true;
      state.settings.backupFileName=file.name||'habit-tracker-backup.json';
      if(!(await storeFileHandle(fileHandle))) toast('Connected, but this browser may not remember the file after refresh');
      await save(true,{render:'none'});
      const ok=await writeBackupFile(false);
      if(!ok){toast('Connected, but could not write backup yet');}
      refreshBackupChrome();
      toast('Backup file linked');
    }catch(e){
      if(e?.name==='AbortError') return;
      toast('Could not connect backup file');
    }
  }
  async function createFile(){
    if(!window.showSaveFilePicker){toast('Create file needs Chrome/Edge on desktop. Use Export instead.');return;}
    toast('Opening file picker…');
    try{
      fileHandle=await window.showSaveFilePicker({suggestedName:'habit-tracker-backup.json',types:[{description:'JSON Backup',accept:{'application/json':['.json']}}]});
      if(fileHandle.requestPermission){
        const perm=await fileHandle.requestPermission({mode:'readwrite'});
        if(perm!=='granted'){toast('Write permission denied'); fileHandle=null; return;}
      }
      state.settings.fileConnected=true;
      state.settings.autoBackup=true;
      state.settings.dailyBackup=true;
      let backupName='habit-tracker-backup.json';
      try{const f=await fileHandle.getFile(); backupName=f.name||backupName;}catch(e){}
      state.settings.backupFileName=backupName;
      if(!(await storeFileHandle(fileHandle))) toast('File created, but this browser may not remember it after refresh');
      await save(true,{render:'none'});
      const ok=await writeBackupFile(false);
      if(!ok){toast('Could not write backup file'); return;}
      refreshBackupChrome();
      toast('Backup file created');
    }catch(e){
      if(e?.name==='AbortError') return;
      toast('Could not create backup file');
    }
  }
  function reminderBody(habit){const tpl=(habit.reminder?.message||state.settings.defaultReminderMessage||'Time for {habit}!').slice(0,REMINDER_MSG_LIMIT); return tpl.replace(/\{habit\}/g,habit.name||'your habit');}
  function toggleRemindersDraft(){
    const sw=$('#reminderSwitch');
    if(!sw) return;
    const turningOn=!sw.classList.contains('on');
    if(turningOn && 'Notification' in window && Notification.permission==='denied'){
      toast('Browser notifications blocked — reminders will use in-app alerts');
    }
    sw.classList.toggle('on',turningOn);
    updateSettingsSaveBar();
  }
  async function toggleAutoBackup(){
    if(!fileHandle){
      if(state.settings.fileConnected && await reconnectStoredFile()){
        state.settings.autoBackup=true;
        state.settings.dailyBackup=true;
        $('#autoBackupSwitch')?.classList.toggle('on',true);
        await flushBackupSync();
        refreshBackupChrome();
        toast('Auto backup restored');
        return;
      }
      toast('Connect a backup file first');
      refreshSettingsChrome();
      return;
    }
    state.settings.autoBackup=!state.settings.autoBackup;
    state.settings.dailyBackup=!!state.settings.autoBackup;
    const on=state.settings.autoBackup;
    $('#autoBackupSwitch')?.classList.toggle('on',on);
    if(!on) clearTimeout(backupDebounceTimer);
    refreshBackupChrome();
    toast(on?'Auto backup on':'Auto backup off');
    void save(false,{render:'none'});
  }
  function shouldRemindHabit(h,now){
    if(!h.reminder?.enabled||h.paused||h.archived) return false;
    if(completionOfHabit(h,now).done) return false;
    const hm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    if(h.reminder.time!==hm) return false;
    if(isNotSpecific(h)) return false;
    return isScheduledToday(h,now)||isFlexibleHabit(h,now);
  }
  function setupReminderLoop(){
    if(reminderTimer)clearInterval(reminderTimer);
    if(window.MomentumLaunch?.scheduleReminders) return;
    if(!state.settings.reminders)return;
    reminderTimer=setInterval(()=>{
      const now=hkNow();
      let fired={};
      try{fired=JSON.parse(localStorage.getItem('momentumReminderFired')||'{}');}catch(e){fired={};}
      state.habits.forEach(h=>{
        if(!shouldRemindHabit(h,now))return;
        const last=`${h.id}|${todayKey()}|${h.reminder.time}`;
        if(fired[last])return;
        Object.keys(fired).forEach(k=>{if(!k.includes(todayKey())) delete fired[k];});
        fired[last]=1;
        localStorage.setItem('momentumReminderFired',JSON.stringify(fired));
        const body=reminderBody(h);
        if(navigator.serviceWorker){
          navigator.serviceWorker.ready.then(reg=>reg.showNotification?.('Habit & Journal',{body,icon:'assets/icon-192.png'})).catch(()=>{});
        }else if('Notification' in window && Notification.permission==='granted') new Notification('Habit & Journal',{body});
        else toast(body);
      });
    },30000);
  }

  async function eraseAllData(){
    if($('#confirmDeleteInput')?.value!=='Confirm'){toast('Type Confirm first');return;}
    if(!confirm('Erase all data and start fresh?'))return;
    const keep={colorMode:state.settings.colorMode,styleTheme:state.settings.styleTheme,userName:state.settings.userName,profileIcon:state.settings.profileIcon,adsRemoved:!!state.settings.adsRemoved,adsRemovedAt:state.settings.adsRemovedAt||'',googleClientId:state.settings.googleClientId||''};
    const linkedBackup=!!state.settings.fileConnected;
    const backupName=state.settings.backupFileName||'';
    clearTimeout(backupDebounceTimer);
    backupSyncQueued=false;
    state=freshState({onboardingComplete:true,keep});
    if(linkedBackup){
      state.settings.fileConnected=true;
      state.settings.autoBackup=true;
      state.settings.dailyBackup=true;
      state.settings.backupFileName=backupName;
    }
    normalizeState();
    invalidateSettings();
    lastLevel=levelInfo().cur.level;
    weekOffset=0;
    reportCursor=currentReportMonth();
    invalidateHomeCaches();
    const confirmInput=$('#confirmDeleteInput'); if(confirmInput) confirmInput.value='';
    await save(false,{render:'all'});
    if(linkedBackup) await flushBackupSync();
    toast('Data erased');
  }
  function exportJson(){state.settings.lastExportAt=todayKey(); touchBackupTimestamp(); localStorage.setItem(STORAGE,JSON.stringify(state)); const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='habit-tracker-backup.json'; a.click(); URL.revokeObjectURL(a.href); updateStatus(); refreshSettingsChrome();}
  function importJson(file){const r=new FileReader(); r.onload=async()=>{try{state=JSON.parse(r.result); normalizeState(); invalidateSettings(); await save(true,{render:'all'}); toast('Imported'); if(!fileHandle) openImportConnectModal();}catch(e){toast('Invalid JSON')}}; r.readAsText(file)}

  /* ---------- SHELL ---------- */
  function renderAfterSave(viewId){
    updateStatus();
    renderTopProfile();
    const v=viewId||$('.view.active')?.id||'homeView';
    if(v==='homeView') renderHome();
    else if(v==='habitsView') renderHabits();
    else if(v==='reportView') renderReport();
    else if(v==='rewardsView'){ renderRewards(); refreshEconomyDisplays(); }
    else if(v==='levelView') renderLevel();
    else if(v==='settingsView') renderSettings();
    else refreshEconomyDisplays();
  }
  function invalidateSettings(){const rs=$('#rewardSettings'); if(rs) delete rs.dataset.built; settingsDraft=null; rewardsDraft=null; settingsPendingProfile=null;}
  function renderAll(){updateStatus(); applyAppearance(); renderHome(); renderHabits(); renderReport(); renderRewards(); renderLevel(); renderSettings(true);}
  function showXpPop(t){
    const shell=$('.app-shell');
    let layer=$('#expPopLayer');
    if(shell){
      if(!layer){layer=document.createElement('div');layer.id='expPopLayer';shell.appendChild(layer);}
      layer.innerHTML=`<div class="xp-pop">${escapeHtml(t)}</div>`;
      clearTimeout(showXpPop._timer);
      showXpPop._timer=setTimeout(()=>{if(layer)layer.innerHTML='';},900);
    }
  }
  let modalDragY=0;
  function openModal(title,html){$('#modalTitle').textContent=title; $('#modalBody').innerHTML=html; $('#modalBackdrop').classList.add('show'); const sheet=$('#modalSheet'); if(sheet) sheet.scrollTop=0; const body=$('#modalBody'); if(body) body.scrollTop=0; $$('[data-close]').forEach(b=>b.onclick=closeModal); const handle=$('#sheetHandle'); if(handle&&sheet){let sy=0; handle.ontouchstart=e=>{sy=e.touches[0].clientY;}; handle.ontouchend=e=>{if(e.changedTouches[0].clientY-sy>80) closeModal();};}}
  function closeModal(){$('#modalBackdrop').classList.remove('show')}
  function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
  function escapeAttr(s=''){return escapeHtml(s).replace(/'/g,'&#39;')}
  function infoTip(text,title=''){const t=title?` data-tip-title="${escapeAttr(title)}"`:''; return `<button type="button" class="info-tip" aria-label="Help"${t} data-tip="${escapeAttr(text)}">ⓘ</button>`;}
  function labelWithTip(label,text){return `${label}${infoTip(text)}`;}

  function showView(view){
    const prev=$('.view.active')?.id;
    if(MAIN_VIEWS.has(view)) lastMainView=view;
    const navHighlight=MAIN_VIEWS.has(view)?view:lastMainView;
    $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===navHighlight));
    $$('.view').forEach(v=>v.classList.remove('active','view-enter'));
    const el=$('#'+view);
    if(el){
      el.classList.add('active');
      if(prev!==view){
        el.classList.add('view-enter');
        el.addEventListener('animationend',()=>el.classList.remove('view-enter'),{once:true});
      }
    }
    const host=$('.view-host');
    if(host && prev!==view) host.scrollTop=0;
    if(view==='homeView') renderHome();
    if(view==='habitsView') renderHabits();
    if(view==='reportView')renderReport();
    if(view==='rewardsView')renderRewards();
    if(view==='levelView')renderLevel();
    if(view==='settingsView') renderSettings();
  }
  function handleSegmentedClick(segBtn){
    const tabs=segBtn.closest('.segmented');
    if(!tabs||segBtn.tagName!=='BUTTON') return false;
    const activate=()=>{tabs.querySelectorAll('button').forEach(b=>b.classList.remove('active')); segBtn.classList.add('active');};
    if(tabs.id==='reportRangeTabs'){trendDays=Number(segBtn.dataset.days); activate(); renderReport(); return true;}
    if(tabs.id==='rewardTabs'){rewardActiveTab=segBtn.dataset.tab; activate(); drawRewardPanel(rewardActiveTab); return true;}
    return false;
  }
  function tapAction(key,e,fn){
    if(e){ e.preventDefault(); e.stopPropagation(); }
    const now=Date.now();
    if(lastTapKey===key && now-lastTapAt<350) return;
    lastTapKey=key; lastTapAt=now;
    fn();
  }
  function routeAppInteraction(e){
    if(e.type==='click' && e.button!==0) return;
    const tipBtn=e.target.closest('.info-tip');
    if(tipBtn){ tapAction('tip',e,()=>showHelpSheet(tipBtn.getAttribute('data-tip-title')||'', tipBtn.getAttribute('data-tip')||'')); return; }
    if(e.target.closest('#helpSheetClose')||(e.target.id==='helpSheetBackdrop'&&!e.target.closest('.help-sheet'))){closeHelpSheet(); return;}
    if(e.target.closest('[data-close]')){closeModal(); closeHelpSheet(); return;}
    if(e.target.closest('#modalClose')||e.target.id==='modalBackdrop'){closeModal(); return;}
    if(e.target.closest('#savePauseBtn')){ tapAction('savePause',e,()=>void savePausePeriod()); return; }
    if(e.target.closest('#saveHabitBtn')){ tapAction('saveHabit',e,()=>{ if(habitModalSave) void habitModalSave(); }); return; }
    if(e.target.closest('#deleteHabitBtn')){ tapAction('deleteHabit',e,()=>{ if(habitModalDeleteId) deleteHabit(habitModalDeleteId); }); return; }
    if(e.target.closest('#saveGroupIcon')){ tapAction('saveGroupIcon',e,()=>{ const inp=$('#groupEmojiInput'); const emoji=inp?.value.trim()||'📋'; const gid=inp?.dataset.groupId; const g=state.groups.find(x=>x.id===gid); if(g){ g.emoji=emoji; closeModal(); toast('Group icon updated'); void save(false,{render:'habitsView'}); } }); return; }
    if(e.target.closest('#saveJournalHome')){ tapAction('saveJournalHome',e,()=>{ const k=todayKey(); const mood=$('#homeJournalForm .mood.active')?.dataset.mood||''; const wasNew=!state.journals[k]; state.journals[k]={mood,energy:Number($('#homeEnergy').value),text:$('#homeJournalText').value.trim(),updatedAt:new Date().toISOString()}; if(wasNew) showXpPop('+5 EXP'); toast('Journal saved'); void save(false,{render:'none'}); }); return; }
    if(e.target.closest('#saveJournalModal')){ tapAction('saveJournalModal',e,()=>{ const k=$('#journalDate')?.value||todayKey(); const wasNew=!state.journals[k]; state.journals[k]={mood:$('#modalBody .mood.active')?.dataset.mood||'',energy:Number($('#modalEnergy').value),text:$('#modalJournalText').value.trim(),updatedAt:new Date().toISOString()}; if(wasNew) showXpPop('+5 EXP'); closeModal(); toast('Journal saved'); void save(false,{render:'none'}); }); return; }
    if(e.target.closest('#addDayJournal')){ tapAction('addDayJournal',e,()=>{ const k=e.target.closest('#addDayJournal')?.dataset.journalDate||todayKey(); closeModal(); openJournalEditor(k); }); return; }
    const moodBtn=e.target.closest('.mood');
    if(moodBtn){ tapAction('mood-'+moodBtn.dataset.mood,e,()=>{ moodBtn.closest('.mood-row')?.querySelectorAll('.mood').forEach(x=>x.classList.remove('active')); moodBtn.classList.add('active'); }); return; }
    const ruleRm=e.target.closest('[data-rule-remove]');
    if(ruleRm){ tapAction('ruleRm',e,()=>{ const idx=Number(ruleRm.dataset.ruleIdx); if(ruleRm.dataset.ruleRemove==='credit') removeCreditRule(idx); else if(ruleRm.dataset.ruleRemove==='gift') removeGiftRule(idx); }); return; }
    const nav=e.target.closest('.nav-item[data-view]');
    if(nav){showView(nav.dataset.view); return;}
    if(e.target.closest('#fabAdd')){openHabitModal(); return;}
    if(e.target.closest('#openLevelBtn')||e.target.closest('#profileQuick')){showView('levelView'); return;}
    if(e.target.closest('#homeCreditCard')){openRewardSettings('credit'); return;}
    if(e.target.closest('#homeGiftCard')){openRewardSettings('gift'); return;}
    const accentBtn=e.target.closest('#accentColorRow [data-accent]');
    if(accentBtn){ state.settings.accentColor=accentBtn.dataset.accent; renderAccentRow(); applyAppearance(); markSettingsDirty(); return; }
    if(e.target.closest('#topSettingsBtn')){showView('settingsView'); return;}
    if(e.target.closest('[data-open-habit]')){openHabitModal(); return;}
    if(e.target.closest('#saveSettingsBtn')){ tapAction('saveSettings',e,()=>void saveSettingsForm()); return; }
    if(e.target.closest('#discardSettingsBtn')){ tapAction('discardSettings',e,discardSettingsForm); return; }
    const autoSwitch=e.target.closest('#autoBackupSwitch');
    if(autoSwitch){ tapAction('autoBackup',e,()=>{ if(autoSwitch.getAttribute('data-locked')==='true'){toast('Connect a backup file first'); return;} void toggleAutoBackup(); }); return; }
    const segBtn=e.target.closest('.segmented button');
    if(segBtn&&handleSegmentedClick(segBtn)) return;
    const syncBtn=e.target.closest('[data-sync-action]');
    if(syncBtn){ tapAction('sync-'+syncBtn.dataset.syncAction,e,()=>void handleSyncAction(syncBtn.dataset.syncAction)); return; }
    if(e.target.closest('#spendCreditBtn')){ tapAction('spendCredit',e,()=>void spendCreditReward()); return; }
    if(e.target.closest('#redeemGiftBtn')){ tapAction('redeemGift',e,()=>void redeemGiftReward()); return; }
    if(e.target.closest('#homeJournalViewAll')){openJournalListModal(); return;}
    if(e.target.closest('#addGroupBtn')){ tapAction('addGroup',e,addGroup); return; }
    const groupDel=e.target.closest('[data-gdel][data-group-id]');
    if(groupDel){ tapAction('gdel-'+groupDel.dataset.groupId,e,()=>deleteGroup(groupDel.dataset.groupId)); return; }
    const groupIcon=e.target.closest('[data-gicon][data-group-id]');
    if(groupIcon){ tapAction('gicon-'+groupIcon.dataset.groupId,e,()=>{ const g=state.groups.find(x=>x.id===groupIcon.dataset.groupId); if(g) openGroupIconPicker(g); }); return; }
    if(e.target.closest('#addHabitBtn')){openHabitModal(); return;}
    if(e.target.closest('#addVacationBtn')){openAddPauseModal(); return;}
    if(e.target.closest('#viewVacationLogBtn')){openVacationLog(); return;}
    if(e.target.closest('#replayOnboardingBtn')){state.settings.onboardingComplete=false; onboardStep=0; renderOnboarding(); return;}
    if(e.target.closest('#flexHabitToggle')){ e.preventDefault(); e.stopPropagation(); $('#flexHabitCard')?.classList.toggle('collapsed'); return; }
    if(e.target.closest('#weekPrev')){weekOffset--; renderWeekStrip(); return;}
    if(e.target.closest('#weekNext')){weekOffset++; renderWeekStrip(); return;}
    if(e.target.closest('#weekToday')){weekOffset=0; renderWeekStrip(); return;}
    if(e.target.closest('#reportPrev')){reportCursor=new Date(reportCursor.getFullYear(),reportCursor.getMonth()-1,1); renderCalendar(); return;}
    if(e.target.closest('#reportNext')){reportCursor=new Date(reportCursor.getFullYear(),reportCursor.getMonth()+1,1); renderCalendar(); return;}
    if(e.target.closest('#statusToggle')){state.settings.statusRowOpen=!state.settings.statusRowOpen; localStorage.setItem(STORAGE,JSON.stringify(state)); updateStatus(); return;}
    if(e.target.closest('#onboardNext')){if(onboardStep<ONBOARD_STEPS.length-1){onboardStep++; showOnboardStep();} else finishOnboarding(); return;}
    if(e.target.closest('#onboardBack')){if(onboardStep>0){onboardStep--; showOnboardStep();} return;}
    if(e.target.closest('#onboardClose')){finishOnboarding(); return;}
    if(e.target.closest('#fileStatus')||e.target.closest('#syncStatus')){showView('settingsView'); setTimeout(()=>$('#driveConnectBtn')?.scrollIntoView({behavior:'smooth',block:'center'}),40); return;}
    if(e.target.closest('#resetAllBtn')){ tapAction('eraseAll',e,()=>void eraseAllData()); return; }
    const check=e.target.closest('button.check-btn[data-habit-id]:not(.done):not(:disabled)');
    if(check){
      tapAction('check-'+check.dataset.habitId,e,()=>{
        const wrap=check.closest('.swipe-wrap');
        const id=check.dataset.habitId, date=check.dataset.date||todayKey();
        void addRecord(id,'',date).then(()=>{if(wrap?.dataset.afterKey) openDayDetail(wrap.dataset.afterKey);});
      });
      return;
    }
    const habitRow=e.target.closest('.habit-row[data-habit-tap]:not(.done)');
    if(habitRow&&!e.target.closest('button,.swipe-actions')){
      tapAction('row-'+habitRow.dataset.habitTap,e,()=>{
        const wrap=habitRow.closest('.swipe-wrap');
        const id=habitRow.dataset.habitTap, date=habitRow.dataset.date||todayKey();
        void addRecord(id,'',date).then(()=>{if(wrap?.dataset.afterKey) openDayDetail(wrap.dataset.afterKey);});
      });
      return;
    }
    if(e.target.closest('#addCreditRule')){ tapAction('addCredit',e,addCreditRule); return; }
    if(e.target.closest('#addGiftRule')){ tapAction('addGift',e,addGiftRule); return; }
    const pauseBtn=e.target.closest('[data-pause][data-habit-id]');
    if(pauseBtn){ tapAction('pause-'+pauseBtn.dataset.habitId,e,()=>{ const h=state.habits.find(x=>x.id===pauseBtn.dataset.habitId); if(!h)return; h.paused=!h.paused; renderHabits(); toast(h.paused?'Habit paused':'Habit resumed'); void save(false,{render:'none'}); }); return; }
    const editBtn=e.target.closest('[data-edit][data-habit-id]');
    if(editBtn){ tapAction('edit-'+editBtn.dataset.habitId,e,()=>{ const h=state.habits.find(x=>x.id===editBtn.dataset.habitId); if(h) openHabitModal(h); }); return; }
    if(e.target.closest('[data-swipe-undo]')){ tapAction('swipeUndo',e,()=>{ const wrap=e.target.closest('.swipe-wrap'); const id=wrap?.querySelector('[data-habit-id]')?.dataset.habitId; const date=wrap?.querySelector('[data-habit-id]')?.dataset.date||todayKey(); if(id) void undoLastTap(id,date); wrap?.classList.remove('open'); }); return; }
    if(e.target.closest('[data-swipe-edit]')){ tapAction('swipeEdit',e,()=>{ const wrap=e.target.closest('.swipe-wrap'); const id=wrap?.querySelector('[data-habit-id]')?.dataset.habitId; const h=state.habits.find(x=>x.id===id); wrap?.classList.remove('open'); if(h) openHabitModal(h); }); return; }
    if(!e.target.closest('.swipe-wrap')) $$('.swipe-wrap.open').forEach(w=>w.classList.remove('open'));
  }
  function bindAppEvents(){
    if(bindAppEvents.done) return;
    bindAppEvents.done=true;
    document.addEventListener('click',e=>routeAppInteraction(e),true);
    document.body.addEventListener('change',e=>{
      if(e.target.id==='importInput'&&e.target.files?.[0]){importJson(e.target.files[0]); e.target.value=''; return;}
      if(e.target.id==='activeGiftSelect'){ensureRewardShape(); state.settings.rewards.activeGiftId=e.target.value; void save(false,{render:'none'}); renderGiftRedeem(); toast('Gift goal updated');}
    });
  }
  window.addEventListener('resize',()=>{if($('#onboardBackdrop')?.classList.contains('show')) positionOnboardCallout(ONBOARD_STEPS[onboardStep]);});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){
      clearTimeout(backupDebounceTimer);
      void flushBackupSync();
    }else if(document.visibilityState==='visible'){
      refreshForDayChange();
      void tryReconnectOnReturn();
      if(window.MomentumLaunch?.maybeAutoDriveBackup) void window.MomentumLaunch.maybeAutoDriveBackup();
      if(window.MomentumLaunch?.scheduleReminders) void window.MomentumLaunch.scheduleReminders();
    }
  });
  window.addEventListener('pageshow',()=>{ refreshForDayChange(); });
  window.addEventListener('focus',()=>{ refreshForDayChange(); });
  window.addEventListener('pagehide',()=>{
    clearTimeout(backupDebounceTimer);
    if(backupTimestampPending) persistBackupTimestamp(backupTimestampPending);
    if(state.settings.autoBackup) void flushBackupSync();
  });
  async function tryReconnectOnReturn(){
    if(!state.settings.fileConnected) return;
    if(await ensureBackupConnection()){
      refreshBackupChrome();
      updateStatus();
      if(state.settings.autoBackup) void flushBackupSync();
    }
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if((state.settings.colorMode||'system')==='system') applyAppearance();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#helpSheetBackdrop')?.classList.contains('show')) closeHelpSheet();});
  bindAppEvents();
  resetDefaultAppIcons();
  lastLevel=levelInfo().cur.level;
  applyAppearance();
  setupReminderLoop();
  scheduleDayRolloverCheck();
  setInterval(()=>{ if(document.visibilityState==='visible') refreshForDayChange(); },60000);
  void (async function boot(){
    renderAll();
    renderOnboarding();
    refreshBackupChrome();
    renderSettingsVersion();
    window.Momentum={
      version:APP_VERSION,
      getState:()=>state,
      setState:(s)=>{state=s;},
      save,toast,addRecord,resetHabitForDate,openJournalEditor,showView,
      creditTotal,streakAt,giftProgress,activeGiftRule,longestPerfectStreak,
      completionOfHabit,todayViewCompletion,habitDueDate,fmtDueRelative,periodCount,periodTarget,
      isNotSpecific,showsOnHomeToday,isScheduledToday,isFlexibleHabit,activeHabits,
      hkNow,todayKey,dateKey,parseDate,reminderBody,shouldRemindHabit,uid,
      refreshHomeAfterRecord,renderAll,openModal,closeModal,escapeHtml,escapeAttr,
      normalizeState,setupReminderLoop,haptic
    };
    document.dispatchEvent(new Event('momentum-ready'));
  })();
})();
