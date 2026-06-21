/* ═══════════════════════════════════════════════════════════════
   APP.JS — HAMRO AFNAI Smart Study Hub
   ───────────────────────────────────────────────────────────────
   Depends on chapters-data.js being loaded first (CH_NAMES / DRIVE
   / ChapterData). Contains no chapter names or Drive file IDs of
   its own — see chapters-data.js for that, and Code.gs for the
   server (also separated: Auth API vs Content API).

   SECTIONS:
     1. Config & constants        7. UI (routing/sidebar/theme)
     2. App state (S)             8. SB / ON / LOC / PSY (start quiz)
     3. Utility functions         9. REV (bookmarks/flagged/wrong)
     4. AUTH (offline-first)     10. QUIZ engine
     5. ADMIN panel              11. HOME/PROG/DATA/CACHE/TT
     6. PWA                      12. APP boot
═══════════════════════════════════════════════════════════════ */

/* ═══════════════ 1. CONFIG & CONSTANTS ═══════════════ */
const APP_CONFIG = {
  // Paste your Apps Script Web App URL here (see Code.gs setup notes).
  APPS_URL: "https://script.google.com/macros/s/AKfycbxHYl7q0fGYroKHGkGGTC2O4QQDLD_8l-VItmeHzsO10Ve_G8nqok_3EWH92QOWUOAw5w/exec",
  SESSION_DAYS: 30
};
const APPS = APP_CONFIG.APPS_URL;

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const LS = {
  SES:'ha_ses', CRED:'ha_cred', THEME:'ha_theme',
  PROG:'ha_prog', BK:'ha_bk', FL:'ha_fl', WR:'ha_wr',
  QC:'ha_qc_', TT:'ha_tt', STK:'ha_stk', ADMIN_SES:'ha_admin_ses'
};

/* ═══════════════ 2. APP STATE ═══════════════ */
const S = {
  user: null,
  isAdmin: false,
  online: navigator.onLine,
  bk: _load(LS.BK, []),
  fl: _load(LS.FL, []),
  wr: _load(LS.WR, []),
  prog: _load(LS.PROG, {total:0,correct:0,sessions:[]}),
  tt: _load(LS.TT, {sessions:[]}),
  stk: _load(LS.STK, {days:[],last:''}),
  dpi: null,
  localQs: null,
  quiz: {qs:[],ans:[],mode:'',idx:0,timer:null,elapsed:0,left:0,active:false,ch:''}
};

/* ═══════════════ 3. UTILITIES ═══════════════ */
function _load(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}}
function _save(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{toast('⚠️ Storage full — some data not saved');return false}}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function shuf(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
function fmt(s){if(s<0)s=0;return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function today(){return new Date().toISOString().slice(0,10)}
function isOk(sel,cor){
  if(sel===null||sel===undefined||cor===null||cor===undefined)return false;
  const s=String(sel).trim(),c=String(cor).trim();
  return(!isNaN(s)&&!isNaN(c)&&s!==''&&c!=='')?Number(s)===Number(c):s.toLowerCase()===c.toLowerCase();
}
function normQ(raw,fid){
  const a=Array.isArray(raw)?raw:(raw?.questions||raw?.data||[]);
  if(!Array.isArray(a))return [];
  return a.filter(q=>q&&(q.q||q.question)&&Array.isArray(q.options)&&q.options.length).map((q,i)=>({
    q:q.q||q.question||'',
    options:q.options||[],
    correct:q.correct!==undefined?q.correct:q.answer,
    explanation:q.explanation||q.explain||'',
    fileId:fid||'local',
    uid:`${fid||'local'}_${i}`
  }));
}
function toast(msg,dur=2800){
  const c=document.getElementById('toasts');
  if(!c)return;
  const t=document.createElement('div');t.className='toast';t.textContent=msg;
  c.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300)},dur);
}
function openMod(title,html){
  document.getElementById('mtitle').textContent=title;
  document.getElementById('mbody').innerHTML=html;
  document.getElementById('mbg').classList.add('show');
}
function closeMod(){document.getElementById('mbg').classList.remove('show')}
function qs(params){return Object.entries(params).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}
async function netFetch(url, opts){
  if(!S.online) throw new Error('OFFLINE');
  return fetch(url, opts);
}

/* ═══════════════ 4. AUTH ═══════════════
   Offline-first session model (like Facebook/WhatsApp): once a
   user logs in successfully online, a long-lived local session is
   stored. Every later app launch — even fully offline — restores
   that session straight into the app with no re-login. The server
   is only contacted for: first login on a device, explicit logout,
   or a genuinely expired session while online. Signup needs
   connectivity because admin approval lives on the server. */
const AUTH = {
  mode: 'login',

  switchMode(mode){
    AUTH.mode = mode;
    document.getElementById('lerr').style.display = 'none';
    const isSignup = mode === 'signup';
    document.getElementById('signup-fields').style.display = isSignup ? '' : 'none';
    document.getElementById('lbtn').textContent = isSignup ? 'Create Account →' : 'Sign In →';
    document.getElementById('auth-toggle-text').textContent = isSignup ? 'Already have an account?' : 'New here?';
    document.getElementById('auth-toggle-btn').textContent = isSignup ? 'Sign In' : 'Create Account';
    if(isSignup && !S.online) AUTH._err('Signup needs an internet connection (an admin must approve new accounts).');
  },

  async login(){
    if(AUTH.mode === 'signup') return AUTH.signup();
    const u=document.getElementById('lu').value.trim();
    const p=document.getElementById('lp').value;
    const btn=document.getElementById('lbtn');
    const err=document.getElementById('lerr');
    err.style.display='none';
    if(!u||!p){AUTH._err('Enter username and password');return}
    btn.disabled=true;btn.innerHTML='<span class="spin"></span> Verifying…';
    try{
      let res;
      if(S.online){
        try{ res = await AUTH._online(u,p); }
        catch{ res = await AUTH._offline(u,p); res._fb = true; }
      } else {
        res = await AUTH._offline(u,p);
      }
      if(res.success){
        if(S.online && !res._fb){
          const h = await AUTH._hash(u+':'+p);
          _save(LS.CRED, {u, h, user: res.user, at: Date.now()});
        }
        _save(LS.SES, {user: res.user || {name:u, username:u}, at: Date.now()});
        AUTH._enter(res.user || {name:u, username:u}, res._fb || res.offline);
      } else {
        AUTH._err(res.error || 'Login failed. Check your credentials.');
      }
    } catch {
      AUTH._err('Connection error. Please try again.');
    }
    btn.disabled=false;btn.innerHTML=AUTH.mode==='signup'?'Create Account →':'Sign In →';
  },

  async signup(){
    if(!S.online){ AUTH._err('Signup needs an internet connection.'); return; }
    const u = document.getElementById('lu').value.trim();
    const p = document.getElementById('lp').value;
    const name = document.getElementById('su-name').value.trim();
    const contact = document.getElementById('su-contact').value.trim();
    const contactType = document.getElementById('su-contact-type').value;
    const btn = document.getElementById('lbtn');
    document.getElementById('lerr').style.display = 'none';
    if(!u || !p || !contact){ AUTH._err('Username, password, and contact are required.'); return; }
    if(p.length < 4){ AUTH._err('Password must be at least 4 characters.'); return; }
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Creating account…';
    try{
      const r = await netFetch(`${APPS}?${qs({action:'signup', username:u, password:p, name, contact, contactType})}`, {redirect:'follow'});
      const res = await r.json();
      if(res.success){
        openMod('🎉 Account Created', `
          <p style="font-size:.85rem;line-height:1.6;color:var(--t2)">
            Your account <b>${esc(u)}</b> has been created and is now <b style="color:var(--warn)">pending admin approval</b>.
            You'll be able to sign in as soon as an admin approves it.
          </p>
          <button class="btn btn-c btn-blk btn-lg" style="margin-top:.9rem" onclick="closeMod();AUTH.switchMode('login')">Got it — back to Sign In</button>
        `);
        document.getElementById('lp').value='';
      } else {
        AUTH._err(res.error || 'Signup failed.');
      }
    } catch {
      AUTH._err('Connection error. Please try again.');
    }
    btn.disabled = false; btn.innerHTML = 'Create Account →';
  },

  async _online(u,p){
    const r = await netFetch(`${APPS}?${qs({action:'login', username:u, password:p})}`, {redirect:'follow'});
    return r.json();
  },
  async _offline(u,p){
    const c=_load(LS.CRED,null);
    if(!c)return{success:false,error:'No saved credentials on this device. Connect to the internet to log in for the first time.'};
    const h=await AUTH._hash(u+':'+p);
    return(c.h===h&&c.u===u)?{success:true,user:c.user,offline:true}:{success:false,error:'Wrong credentials. Internet is needed to verify a new device/login.'};
  },
  async _hash(s){
    if(window.crypto?.subtle){
      const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
      return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
    }
    let h=0;for(let i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return h.toString(16);
  },
  _err(m){const e=document.getElementById('lerr');e.textContent=m;e.style.display='block'},
  _enter(user,isOff){
    S.user=user;
    document.getElementById('lw').style.display='none';
    document.getElementById('app').style.display='flex';
    document.getElementById('uchip').textContent='👤 '+(user?.name||user?.username||'Student');
    if(isOff) toast('⚠️ Offline login (using saved session)');
    else toast('✅ Welcome back, '+(user?.name||user?.username||'Student')+'!');
    if(!S.online) document.getElementById('offbar').classList.add('show');
    APP.init();
  },
  logout(){
    if(!confirm('Log out?'))return;
    localStorage.removeItem(LS.SES);
    localStorage.removeItem(LS.ADMIN_SES);
    location.reload();
  },
  restore(){
    const s=_load(LS.SES,null);
    if(!s) return false;
    const expired = Date.now()-s.at > 86400000*APP_CONFIG.SESSION_DAYS;
    if(expired && S.online) return false; // stale + reachable → require fresh login
    AUTH._enter(s.user, !S.online);
    return true;
  }
};

/* ═══════════════ 5. ADMIN PANEL ═══════════════
   Separate login path, authenticates against ADMIN_USERNAME/
   ADMIN_PASSWORD in Code.gs (not the Users sheet). Requires
   connectivity — moderation actions shouldn't happen offline. */
const ADMIN = {
  creds: null,

  openLogin(){
    openMod('🛡️ Admin Sign In', `
      <div class="lf"><label>Admin Username</label><input type="text" id="adm-u" placeholder="admin"></div>
      <div class="lf"><label>Admin Password</label><input type="password" id="adm-p" placeholder="••••••••"></div>
      <div class="l-err" id="adm-err"></div>
      <button class="btn btn-solid btn-blk btn-lg" onclick="ADMIN.login()">Sign In as Admin →</button>
    `);
  },
  async login(){
    if(!S.online){ ADMIN._err('Admin panel needs an internet connection.'); return; }
    const u = document.getElementById('adm-u').value.trim();
    const p = document.getElementById('adm-p').value;
    if(!u||!p){ ADMIN._err('Enter admin username and password.'); return; }
    try{
      const r = await netFetch(`${APPS}?${qs({action:'adminLogin', username:u, password:p})}`, {redirect:'follow'});
      const res = await r.json();
      if(res.success){
        ADMIN.creds = {adminUser:u, adminPass:p};
        _save(LS.ADMIN_SES, ADMIN.creds);
        S.isAdmin = true;
        closeMod();
        toast('🛡️ Admin mode active');
        ADMIN.openPanel();
      } else {
        ADMIN._err(res.error || 'Invalid admin credentials.');
      }
    } catch {
      ADMIN._err('Connection error.');
    }
  },
  _err(m){const e=document.getElementById('adm-err');if(e){e.textContent=m;e.style.display='block'}},
  async openPanel(){
    if(!ADMIN.creds){
      const saved = _load(LS.ADMIN_SES, null);
      if(saved){ ADMIN.creds = saved; S.isAdmin = true; }
      else { ADMIN.openLogin(); return; }
    }
    openMod('🛡️ Admin Panel', `<div id="admin-body" style="font-size:.8rem;color:var(--t3)">Loading users…</div>`);
    await ADMIN.refresh();
  },
  async refresh(){
    const body = document.getElementById('admin-body');
    if(!S.online){ if(body) body.innerHTML = '<div class="empty"><div class="empty-i">📡</div><p>Admin panel needs internet.</p></div>'; return; }
    try{
      const r = await netFetch(`${APPS}?${qs({action:'adminListUsers', ...ADMIN.creds})}`, {redirect:'follow'});
      const res = await r.json();
      if(!res.success){ if(body) body.innerHTML = `<div class="l-err" style="display:block">${esc(res.error||'Failed to load users')}</div>`; return; }
      const users = res.users || [];
      const pending = users.filter(u=>u.status==='pending');
      const active = users.filter(u=>u.status==='active');
      const rejected = users.filter(u=>u.status==='rejected');
      body.innerHTML = `
        <div class="bg" style="margin-bottom:.8rem">
          <span class="ctag ta">⏳ ${pending.length} pending</span>
          <span class="ctag tg">✅ ${active.length} active</span>
          <span class="ctag tr">🚫 ${rejected.length} rejected</span>
        </div>
        ${pending.length ? `<p style="font-weight:700;font-size:.78rem;margin-bottom:.4rem">Pending Approval</p>${pending.map(ADMIN._row).join('')}<hr>` : ''}
        <p style="font-weight:700;font-size:.78rem;margin-bottom:.4rem">All Users</p>
        ${users.length ? users.map(ADMIN._row).join('') : '<div class="empty"><div class="empty-i">👤</div><p>No users yet</p></div>'}
      `;
    } catch {
      if(body) body.innerHTML = '<div class="l-err" style="display:block">Connection error loading users.</div>';
    }
  },
  _row(u){
    const statusTag = u.status==='pending' ? '<span class="ctag ta">pending</span>' : u.status==='active' ? '<span class="ctag tg">active</span>' : '<span class="ctag tr">rejected</span>';
    return `<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .2rem;border-bottom:1px solid var(--bd)">
      <div style="flex:1">
        <div style="font-weight:700;font-size:.8rem">${esc(u.name||u.username)} <span style="color:var(--t3);font-weight:500">@${esc(u.username)}</span></div>
        <div style="font-size:.68rem;color:var(--t3)">${esc(u.contactType||'')}: ${esc(u.contact||'—')} · ${statusTag}</div>
      </div>
      <div class="bg">
        ${u.status!=='active'?`<button class="btn btn-sm btn-g" onclick="ADMIN.act('${esc(u.username)}','adminApprove')">✓</button>`:''}
        ${u.status!=='rejected'?`<button class="btn btn-sm btn-r" onclick="ADMIN.act('${esc(u.username)}','adminReject')">✕</button>`:''}
        ${u.status==='active'?`<button class="btn btn-sm btn-a" onclick="ADMIN.act('${esc(u.username)}','adminRevoke')">↩</button>`:''}
        <button class="btn btn-sm" onclick="ADMIN.del('${esc(u.username)}')">🗑</button>
      </div>
    </div>`;
  },
  async act(username, action){
    try{
      const r = await netFetch(`${APPS}?${qs({action, username, ...ADMIN.creds})}`, {redirect:'follow'});
      const res = await r.json();
      if(res.success){ toast('✅ Updated'); ADMIN.refresh(); }
      else toast('❌ '+(res.error||'Failed'));
    } catch { toast('❌ Connection error'); }
  },
  async del(username){
    if(!confirm(`Permanently delete user "${username}"?`))return;
    try{
      const r = await netFetch(`${APPS}?${qs({action:'adminDelete', username, ...ADMIN.creds})}`, {redirect:'follow'});
      const res = await r.json();
      if(res.success){ toast('🗑 Deleted'); ADMIN.refresh(); }
      else toast('❌ '+(res.error||'Failed'));
    } catch { toast('❌ Connection error'); }
  },
  logout(){
    ADMIN.creds = null; S.isAdmin = false;
    localStorage.removeItem(LS.ADMIN_SES);
    closeMod(); toast('Admin mode ended');
  }
};

/* ═══════════════ 6. PWA ═══════════════ */
const PWA = {
  init(){
    window.addEventListener('beforeinstallprompt', e=>{
      e.preventDefault(); S.dpi=e;
      const btn=document.getElementById('installBtn');
      if(btn) btn.style.display='';
    });
    window.addEventListener('appinstalled', ()=>{
      toast('📲 App installed!');
      const btn=document.getElementById('installBtn');
      if(btn) btn.style.display='none';
    });
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./sw.js', {scope:'./'}).catch(()=>{});
    }
  },
  install(){
    if(S.dpi){ S.dpi.prompt(); S.dpi=null; const b=document.getElementById('installBtn'); if(b) b.style.display='none'; }
    else toast('Install option not available — try your browser\'s "Add to Home Screen" menu.');
  },
  toggleFullscreen(){
    if(!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(()=>toast('Fullscreen not supported here'));
    else document.exitFullscreen?.();
  }
};

/* ═══════════════ 7. UI ═══════════════ */
const UI = {
  cur: 'home',
  go(v){
    document.getElementById('quiz-wrap').style.display='none';
    document.querySelectorAll('.view').forEach(e=>e.classList.remove('on'));
    const el=document.getElementById('view-'+v);
    if(el)el.classList.add('on');
    document.querySelectorAll('.sb-item').forEach(e=>e.classList.remove('active'));
    const ni=document.getElementById('nav-'+v);
    if(ni)ni.classList.add('active');
    UI.cur=v;UI.sidebarClose();window.scrollTo(0,0);
    ({
      home:()=>HOME.render(),
      progress:()=>PROG.render(),
      offline:()=>CACHE.render(),
      bookmarks:()=>REV.renderList('bk'),
      flagged:()=>REV.renderList('fl'),
      wrong:()=>REV.renderList('wr'),
      timetable:()=>TT.render(),
      psycho:()=>PSY.init()
    })[v]?.();
  },
  sidebarToggle(){
    document.getElementById('sb').classList.toggle('open');
    document.getElementById('ov').classList.toggle('show');
  },
  sidebarClose(){
    document.getElementById('sb').classList.remove('open');
    document.getElementById('ov').classList.remove('show');
  },
  theme(){
    document.body.classList.toggle('light');
    _save(LS.THEME, document.body.classList.contains('light')?'light':'dark');
  }
};

/* ═══════════════ 8a. SIDEBAR QUICK QUIZ ═══════════════ */
const SB = {
  onLv(){
    const lv=document.getElementById('sb-lv').value;
    const cs=document.getElementById('sb-ch');
    cs.innerHTML='<option>Chapter…</option>';cs.disabled=!lv;
    const ts=document.getElementById('sb-to');ts.innerHTML='<option>Subtopic…</option>';ts.disabled=true;
    if(!lv)return;
    Object.entries(ChapterData.chapters(lv)).forEach(([k,n])=>{
      const o=document.createElement('option');o.value=k;o.textContent=`Ch${k}: ${n}`;cs.appendChild(o);
    });
  },
  onCh(){
    const lv=document.getElementById('sb-lv').value;
    const ch=document.getElementById('sb-ch').value;
    const ts=document.getElementById('sb-to');
    ts.innerHTML='<option>Subtopic…</option>';ts.disabled=true;
    const files=ChapterData.files(lv,ch);
    if(!Object.keys(files).length){
      ts.innerHTML='<option>No files yet</option>';
      return;
    }
    Object.entries(files).forEach(([n,id])=>{
      if(!id)return;
      const o=document.createElement('option');o.value=id;o.dataset.key=`${lv}_${ch}_${n}`;o.textContent=n;ts.appendChild(o);
    });
    ts.disabled=false;
  },
  go(mode){
    const ts=document.getElementById('sb-to');
    const fid=ts.value,key=ts.options[ts.selectedIndex]?.dataset?.key;
    if(!fid||!key){toast('Select a subtopic first');return}
    QUIZ.load(fid,key,mode,'Sidebar');
  }
};

/* ═══════════════ 8b. ONLINE STUDY ═══════════════ */
const ON = {
  onLv(){
    const lv=document.getElementById('on-lv').value;
    const cs=document.getElementById('on-ch');
    cs.innerHTML='<option>📘 Select Chapter…</option>';cs.disabled=!lv;
    const ts=document.getElementById('on-to');ts.innerHTML='<option>📑 Select Subtopic…</option>';ts.disabled=true;
    if(!lv)return;
    Object.entries(ChapterData.chapters(lv)).forEach(([k,n])=>{
      const fc=ChapterData.fileCount(lv,k);
      const o=document.createElement('option');o.value=k;o.textContent=`Ch${k}: ${n}${fc?'':' (coming soon)'}`;cs.appendChild(o);
    });
  },
  onCh(){
    const lv=document.getElementById('on-lv').value,ch=document.getElementById('on-ch').value;
    const ts=document.getElementById('on-to');
    ts.innerHTML='<option>📑 Select Subtopic…</option>';ts.disabled=true;
    if(!lv||!ch)return;
    const files=ChapterData.files(lv,ch);
    if(!Object.keys(files).length){
      ts.innerHTML='<option>No files yet for this chapter</option>';
      toast('ℹ️ This chapter has no question files yet');
      return;
    }
    Object.entries(files).forEach(([n,id])=>{
      if(!id)return;
      const o=document.createElement('option');o.value=id;o.dataset.key=`${lv}_${ch}_${n}`;o.textContent=n;ts.appendChild(o);
    });
    ts.disabled=false;
  },
  start(mode){
    const ts=document.getElementById('on-to');
    const fid=ts.value,key=ts.options[ts.selectedIndex]?.dataset?.key;
    const ch=document.getElementById('on-ch').value,lv=document.getElementById('on-lv').value;
    if(!fid||!key){toast('Select a subtopic');return}
    const name=ChapterData.chapterName(lv,ch);
    QUIZ.load(fid,key,mode,name);
  }
};

/* ═══════════════ 8c. LOCAL FILE ═══════════════ */
const LOC = {
  onFile(){
    const f=document.getElementById('loc-file').files[0];if(!f)return;
    const r=new FileReader();
    r.onload=e=>{
      try{
        const qs2=normQ(JSON.parse(e.target.result),'local');
        if(!qs2.length){toast('❌ No valid questions found in file');return}
        S.localQs=qs2;
        const info=document.getElementById('loc-info');
        info.style.display='';info.textContent=`✅ ${qs2.length} questions loaded from "${f.name}"`;
        document.getElementById('loc-pr').disabled=false;
        document.getElementById('loc-ex').disabled=false;
        toast(`✅ ${qs2.length} questions ready`);
      }catch{toast('❌ Invalid JSON file')}
    };
    r.onerror=()=>toast('❌ Could not read file');
    r.readAsText(f);
  },
  start(mode){
    if(!S.localQs){toast('Load a JSON file first');return}
    QUIZ.startWith([...S.localQs],mode,'Local File');
  }
};

/* ═══════════════ 8d. PSYCHO MODE ═══════════════ */
const PSY = {
  LEVELS:[['level5','Level 5'],['level7','Level 7'],['gk','General Knowledge']],
  init(){
    const box=document.getElementById('psy-levels');
    box.innerHTML = PSY.LEVELS.map(([lv,label])=>{
      const names=ChapterData.chapters(lv);
      const items=Object.entries(names).map(([k,n])=>{
        const fc=ChapterData.fileCount(lv,k);
        return `<div class="ch-item" onclick="this.querySelector('input').click()">
          <input type="checkbox" value="${k}" data-lv="${lv}" ${fc?'':'disabled'} onclick="event.stopPropagation();PSY._info()">
          <div class="ch-num">${k}</div>
          <div class="ch-name">${n}${fc?'':' <span style=\"color:var(--t3)\">(no files)</span>'}</div>
          <div class="ch-cnt">${fc}f</div>
        </div>`;
      }).join('');
      return `<div class="sb-lbl" style="margin-top:.7rem;display:flex;align-items:center;justify-content:space-between;padding-right:.2rem">
          <span>${label}</span>
          <span style="display:flex;gap:.3rem">
            <button class="btn btn-sm btn-c" style="font-size:.56rem;padding:.15rem .4rem" onclick="PSY.allLv('${lv}')">✅ All</button>
            <button class="btn btn-sm btn-r" style="font-size:.56rem;padding:.15rem .4rem" onclick="PSY.noneLv('${lv}')">✕</button>
          </span>
        </div>
        <div class="ch-list" id="psy-lv-${lv}">${items || '<div class="empty"><div class="empty-i">📚</div><p>No chapters yet</p></div>'}</div>`;
    }).join('');
    PSY._info();
  },
  all(){document.querySelectorAll('#psy-levels input:not(:disabled)').forEach(c=>c.checked=true);PSY._info()},
  none(){document.querySelectorAll('#psy-levels input').forEach(c=>c.checked=false);PSY._info()},
  allLv(lv){document.querySelectorAll(`#psy-lv-${lv} input:not(:disabled)`).forEach(c=>c.checked=true);PSY._info()},
  noneLv(lv){document.querySelectorAll(`#psy-lv-${lv} input`).forEach(c=>c.checked=false);PSY._info()},
  _info(){
    const n=document.querySelectorAll('#psy-levels input:checked').length;
    document.getElementById('psy-info').textContent=n?`${n} chapter${n>1?'s':''} selected — ready to load`:'Select at least 1 chapter to continue';
  },
  async start(type){
    const cbs=[...document.querySelectorAll('#psy-levels input:checked')];
    if(!cbs.length){toast('Select at least one chapter');return}
    toast(`⏳ Loading ${cbs.length} chapter${cbs.length>1?'s':''}…`);
    const all=[];
    for(const cb of cbs){
      const lv=cb.dataset.lv;
      const ch=cb.value;
      for(const[name,fid] of Object.entries(ChapterData.files(lv,ch))){
        if(!fid)continue;
        try{const raw=await QUIZ._fetch(fid,`${lv}_${ch}_${name}`);all.push(...normQ(raw,fid))}catch{}
      }
    }
    if(!all.length){toast('❌ No questions loaded. Cache data first if you are offline.');return}
    let qsArr=shuf(all);
    if(type==='exam')qsArr=qsArr.slice(0,100);
    if(type==='weak'){
      const wu=new Set(S.wr.map(w=>w.uid));
      const weak=qsArr.filter(q=>wu.has(q.uid));
      qsArr=weak.length?weak:qsArr.slice(0,50);
      if(!weak.length)toast('ℹ️ No wrong answers yet — showing 50 random instead');
    }
    QUIZ.startWith(qsArr,type==='exam'?'exam':'flashcard','⚡ Psycho Mode');
  }
};

/* ═══════════════ 9. REVIEW LISTS (bookmarks / flagged / wrong) ═══════════════ */
const REV = {
  _store(kind){ return kind==='bk'?S.bk : kind==='fl'?S.fl : S.wr; },
  _lsKey(kind){ return kind==='bk'?LS.BK : kind==='fl'?LS.FL : LS.WR; },
  _listEl(kind){ return kind==='bk'?'bk-list' : kind==='fl'?'fl-list' : 'wr-list'; },

  toggle(kind, question){
    const arr = REV._store(kind);
    const i = arr.findIndex(x=>x.uid===question.uid);
    if(i>-1){ arr.splice(i,1); toast(kind==='bk'?'⭐ Removed bookmark':'🚩 Removed flag'); }
    else { arr.push(question); toast(kind==='bk'?'⭐ Bookmarked':'🚩 Flagged'); }
    _save(REV._lsKey(kind), arr);
    HOME.updateBadges();
    return i===-1; // true if now active
  },
  has(kind, uid){ return REV._store(kind).some(x=>x.uid===uid); },

  addWrong(question){
    if(S.wr.some(x=>x.uid===question.uid))return;
    S.wr.push(question);
    _save(LS.WR, S.wr);
    HOME.updateBadges();
  },
  removeWrong(uid){
    const i=S.wr.findIndex(x=>x.uid===uid);
    if(i>-1){ S.wr.splice(i,1); _save(LS.WR, S.wr); HOME.updateBadges(); }
  },

  renderList(kind){
    const arr = REV._store(kind);
    const el = document.getElementById(REV._listEl(kind));
    if(!el)return;
    if(!arr.length){
      el.innerHTML = `<div class="empty"><div class="empty-i">${kind==='bk'?'⭐':kind==='fl'?'🚩':'❌'}</div><p>Nothing here yet</p></div>`;
      return;
    }
    el.innerHTML = arr.map((q,i)=>`
      <div class="qcard" style="margin-bottom:.6rem">
        <div class="qm"><span class="qn mono">#${i+1}</span>
          <button class="ib" onclick="REV._removeOne('${kind}','${esc(q.uid)}')">🗑</button>
        </div>
        <div class="qt" style="font-size:.82rem">${esc(q.q)}</div>
      </div>
    `).join('');
  },
  _removeOne(kind, uid){
    const arr=REV._store(kind);
    const i=arr.findIndex(x=>x.uid===uid);
    if(i>-1){arr.splice(i,1);_save(REV._lsKey(kind),arr);REV.renderList(kind);HOME.updateBadges();}
  },
  clearAll(kind){
    if(!confirm('Clear this whole list?'))return;
    if(kind==='bk'){S.bk=[];_save(LS.BK,[]);}
    else if(kind==='fl'){S.fl=[];_save(LS.FL,[]);}
    else {S.wr=[];_save(LS.WR,[]);}
    REV.renderList(kind); HOME.updateBadges();
    toast('🗑 Cleared');
  },
  start(kind, mode){
    const arr=[...REV._store(kind)];
    if(!arr.length){toast('Nothing to study here yet');return}
    QUIZ.startWith(shuf(arr), mode, kind==='bk'?'⭐ Bookmarks':kind==='fl'?'🚩 Flagged':'❌ Wrong Bank');
  }
};

/* ═══════════════ 10. QUIZ ENGINE ═══════════════ */
const QUIZ = {
  async _fetch(fileId, cacheKey){
    const ck = LS.QC + cacheKey;
    if(!S.online){
      const cached = _load(ck, null);
      if(cached) return cached;
      throw new Error('No internet and no cached copy for this file.');
    }
    try{
      const r = await netFetch(`${APPS}?${qs({action:'getFile', fileId})}`, {redirect:'follow'});
      const data = await r.json();
      if(data && data.success===false) throw new Error(data.error||'Server error');
      _save(ck, data);
      return data;
    } catch(err){
      const cached = _load(ck, null);
      if(cached){ toast('📦 Loaded from offline cache'); return cached; }
      throw err;
    }
  },

  async load(fileId, cacheKey, mode, chapterName){
    toast('⏳ Loading questions…');
    try{
      const raw = await QUIZ._fetch(fileId, cacheKey);
      const qsArr = normQ(raw, fileId);
      if(!qsArr.length){ toast('❌ No questions found in this file'); return; }
      QUIZ.startWith(qsArr, mode, chapterName);
    } catch(err){
      toast('❌ ' + (err.message==='OFFLINE' ? 'You are offline and this set is not cached yet.' : err.message));
    }
  },

  startWith(qsArr, mode, chapterName){
    if(!qsArr || !qsArr.length){ toast('No questions to study'); return; }
    QUIZ._stopTimer();
    S.quiz = {
      qs: shuf(qsArr), ans: new Array(qsArr.length).fill(null),
      mode, idx:0, timer:null, elapsed:0,
      left: mode==='exam' ? qsArr.length*90 : 0,
      active:true, ch: chapterName||'Study', skipped:new Set(), shown:new Set()
    };
    document.getElementById('quiz-wrap').style.display='';
    document.querySelectorAll('.view').forEach(e=>e.classList.remove('on'));
    if(mode==='exam'){
      document.getElementById('fc-wrap').style.display='none';
      document.getElementById('ex-wrap').style.display='';
      document.getElementById('res-wrap').style.display='none';
      QUIZ._renderExam();
    } else {
      document.getElementById('ex-wrap').style.display='none';
      document.getElementById('fc-wrap').style.display='';
      document.getElementById('res-wrap').style.display='none';
      QUIZ._renderFlashcard();
    }
    QUIZ._startTimer();
  },

  daily(){
    const refs = ChapterData.allFileRefs();
    if(!refs.length){ toast('No content configured yet'); return; }
    toast('⏳ Building today\'s challenge…');
    (async()=>{
      const seedDate = today();
      const picks = shuf(refs).slice(0, Math.min(10, refs.length));
      const all = [];
      for(const ref of picks){
        try{ const raw = await QUIZ._fetch(ref.fid, ref.key); all.push(...normQ(raw, ref.fid)); }catch{}
      }
      if(!all.length){ toast('❌ Could not load daily challenge — try caching data first'); return; }
      const qsArr = shuf(all).slice(0,30);
      QUIZ.startWith(qsArr, 'flashcard', '🌟 Daily Challenge');
      STREAK.markToday();
    })();
  },

  _startTimer(){
    QUIZ._stopTimer();
    S.quiz.timer = setInterval(()=>{
      if(!S.quiz.active)return;
      if(S.quiz.mode==='exam'){
        S.quiz.left--;
        const tEl=document.getElementById('ex-tmr'); if(tEl) tEl.textContent=fmt(S.quiz.left);
        if(S.quiz.left<=0){ toast('⏰ Time\'s up!'); QUIZ.submitExam(); }
      } else {
        S.quiz.elapsed++;
        const tEl=document.getElementById('fc-tmr'); if(tEl) tEl.textContent=fmt(S.quiz.elapsed);
      }
    },1000);
  },
  _stopTimer(){ if(S.quiz.timer){ clearInterval(S.quiz.timer); S.quiz.timer=null; } },

  quit(){
    if(!confirm('Quit this session? Progress on this attempt will be lost.'))return;
    QUIZ._stopTimer();
    S.quiz.active=false;
    document.getElementById('quiz-wrap').style.display='none';
    UI.go('home');
  },

  /* ── FLASHCARD MODE ── */
  _renderFlashcard(){
    const q = S.quiz.qs[S.quiz.idx];
    if(!q)return;
    document.getElementById('fc-chip').textContent = '⚡ ' + S.quiz.ch;
    document.getElementById('fc-ctr').textContent = `${S.quiz.idx+1}/${S.quiz.qs.length}`;
    document.getElementById('fc-pf').style.width = `${((S.quiz.idx)/S.quiz.qs.length)*100}%`;
    document.getElementById('fc-qn').textContent = 'Q'+(S.quiz.idx+1);
    document.getElementById('fc-qt').textContent = q.q;

    const isStarred = REV.has('bk', q.uid), isFlagged = REV.has('fl', q.uid);
    const gq = encodeURIComponent(q.q.slice(0,120));
    document.getElementById('fc-acts').innerHTML = `
      <button class="ib ${isStarred?'starred':''}" onclick="QUIZ._star()" title="Bookmark">⭐</button>
      <button class="ib ${isFlagged?'flagged':''}" onclick="QUIZ._flag()" title="Flag">🚩</button>
      <a class="ib" href="https://www.google.com/search?q=${gq}" target="_blank" rel="noopener" title="Search on Google" style="text-decoration:none">🔍</a>
    `;

    const ansIdx = S.quiz.ans[S.quiz.idx];
    const answered = ansIdx !== null;
    const optsEl = document.getElementById('fc-opts');
    optsEl.innerHTML = q.options.map((opt,i)=>{
      let cls='opt';
      if(answered){
        cls += (i===Number(q.correct)||String(i)===String(q.correct)) ? ' shc' : (i===ansIdx ? ' bad2' : '');
        if(i===ansIdx && isOk(ansIdx,q.correct)) cls = 'opt shc';
      }
      return `<div class="${cls} ${answered?'locked':''}" onclick="${answered?'':'QUIZ.fcAnswer('+i+')'}">
        <div class="ok">${String.fromCharCode(65+i)}</div><div>${esc(opt)}</div>
      </div>`;
    }).join('');

    const expl = document.getElementById('fc-expl');
    if(answered && q.explanation){ expl.textContent = q.explanation; expl.classList.add('show'); }
    else { expl.classList.remove('show'); expl.textContent=''; }

    document.getElementById('fc-hint').textContent = answered ? 'Use Next →' : 'Tap an option to answer';
    document.getElementById('fc-prev').disabled = S.quiz.idx===0;
    document.getElementById('fc-next').textContent = S.quiz.idx===S.quiz.qs.length-1 ? 'Finish ✔' : 'Next →';

    QUIZ._updateFcCounts();
  },
  _updateFcCounts(){
    let ok=0,bad=0,skip=0;
    S.quiz.ans.forEach((a,i)=>{
      if(a===null){ if(S.quiz.shown?.has(i)) skip++; return; }
      if(isOk(a, S.quiz.qs[i].correct)) ok++; else bad++;
    });
    document.getElementById('fc-ok').textContent='✅ '+ok;
    document.getElementById('fc-bad').textContent='❌ '+bad;
    document.getElementById('fc-skip').textContent='⏭ '+skip;
    const total=S.quiz.qs.length;
    const gp = total ? (ok/total)*100 : 0, rp = total ? (bad/total)*100 : 0;
    document.getElementById('rg').style.flex = gp;
    document.getElementById('rr').style.flex = rp;
    document.getElementById('rs').style.flex = Math.max(0, 100-gp-rp);
  },
  fcAnswer(i){
    if(S.quiz.ans[S.quiz.idx]!==null)return;
    S.quiz.ans[S.quiz.idx]=i;
    const q=S.quiz.qs[S.quiz.idx];
    const correct=isOk(i,q.correct);
    if(correct){ PROG.track(true); REV.removeWrong(q.uid); }
    else { PROG.track(false); REV.addWrong(q); }
    QUIZ._renderFlashcard();
  },
  fcNav(dir){
    if(!S.quiz.shown) S.quiz.shown=new Set();
    S.quiz.shown.add(S.quiz.idx);
    const next = S.quiz.idx+dir;
    if(next<0)return;
    if(next>=S.quiz.qs.length){ QUIZ.fcFinish(); return; }
    S.quiz.idx=next;
    QUIZ._renderFlashcard();
  },
  _star(){
    const q=S.quiz.qs[S.quiz.idx];
    REV.toggle('bk', q);
    QUIZ._renderFlashcard();
  },
  _flag(){
    const q=S.quiz.qs[S.quiz.idx];
    REV.toggle('fl', q);
    QUIZ._renderFlashcard();
  },
  fcFinish(){
    QUIZ._stopTimer();
    S.quiz.active=false;
    QUIZ._showResults();
  },

  /* ── EXAM MODE ── */
  _renderExam(){
    document.getElementById('ex-chip').textContent = '📝 ' + S.quiz.ch;
    document.getElementById('ex-ctr').textContent = `0/${S.quiz.qs.length}`;
    document.getElementById('ex-tmr').textContent = fmt(S.quiz.left);
    const el = document.getElementById('ex-qs');
    el.innerHTML = S.quiz.qs.map((q,qi)=>{
      const gq = encodeURIComponent(q.q.slice(0,120));
      return `
      <div class="eqc" id="eqc-${qi}">
        <div class="qm"><span class="qn mono">Q${qi+1}</span><a class="ib" href="https://www.google.com/search?q=${gq}" target="_blank" rel="noopener" title="Search on Google" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px">🔍</a></div>
        <div class="qt" style="font-size:.85rem">${esc(q.q)}</div>
        ${q.options.map((opt,oi)=>`
          <div class="eo" onclick="QUIZ.exAnswer(${qi},${oi})" id="eo-${qi}-${oi}">
            <div class="ok">${String.fromCharCode(65+oi)}</div><div>${esc(opt)}</div>
          </div>
        `).join('')}
      </div>
    `}).join('');
  },
  exAnswer(qi, oi){
    if(!S.quiz.active)return;
    S.quiz.ans[qi]=oi;
    document.querySelectorAll(`#eqc-${qi} .eo`).forEach((e,i)=>e.classList.toggle('sel', i===oi));
    document.getElementById(`eqc-${qi}`).classList.add('answered');
    const answered = S.quiz.ans.filter(a=>a!==null).length;
    document.getElementById('ex-ctr').textContent = `${answered}/${S.quiz.qs.length}`;
    document.getElementById('ex-ans').textContent = '✓ '+answered;
    document.getElementById('ex-pf').style.width = `${(answered/S.quiz.qs.length)*100}%`;
  },
  submitExam(){
    if(!S.quiz.active)return; // guard against double-submit
    const unanswered = S.quiz.ans.filter(a=>a===null).length;
    if(unanswered>0 && S.quiz.left>0 && !confirm(`${unanswered} question(s) unanswered. Submit anyway?`))return;
    QUIZ._stopTimer();
    S.quiz.active=false;
    // reveal correctness on exam screen
    S.quiz.qs.forEach((q,qi)=>{
      document.querySelectorAll(`#eqc-${qi} .eo`).forEach((e,oi2)=>{
        e.style.pointerEvents='none';
        const correct = isOk(oi2,q.correct);
        if(correct) e.classList.add('shc');
        else if(oi2===S.quiz.ans[qi]) e.classList.add('bad2');
      });
      const correctPick = isOk(S.quiz.ans[qi], q.correct);
      PROG.track(correctPick);
      if(correctPick) REV.removeWrong(q.uid); else REV.addWrong(q);
    });
    QUIZ._showResults();
  },

  /* ── RETRY ── */
  retryWrong(){
    const wrongIdx = S.quiz.qs.map((q,i)=>({q,i})).filter(({i})=>!isOk(S.quiz.ans[i], S.quiz.qs[i].correct));
    if(!wrongIdx.length){ toast('🎉 Nothing to retry — all correct!'); UI.go('home'); return; }
    QUIZ.startWith(wrongIdx.map(x=>x.q), 'flashcard', S.quiz.ch + ' (Retry)');
  },

  /* ── RESULTS ── */
  _showResults(){
    document.getElementById('fc-wrap').style.display='none';
    document.getElementById('ex-wrap').style.display='none';
    document.getElementById('res-wrap').style.display='';
    const total = S.quiz.qs.length;
    let correct=0;
    S.quiz.qs.forEach((q,i)=>{ if(isOk(S.quiz.ans[i], q.correct)) correct++; });
    const wrong = S.quiz.ans.filter((a,i)=> a!==null && !isOk(a,S.quiz.qs[i].correct)).length;
    const skipped = S.quiz.ans.filter(a=>a===null).length;
    const pct = total ? Math.round((correct/total)*100) : 0;

    document.getElementById('res-ring').style.setProperty('--p', pct+'%');
    document.getElementById('res-pct').textContent = pct+'%';
    document.getElementById('res-chap').textContent = S.quiz.ch;
    const grade = pct>=90?'🏆 Outstanding!':pct>=75?'🎯 Great job!':pct>=50?'👍 Keep practicing':'📚 Needs more review';
    document.getElementById('res-grade').textContent = grade;

    document.getElementById('res-stats').innerHTML = `
      <div class="sc"><div class="sv tcy">${total}</div><div class="sl">Total</div></div>
      <div class="sc"><div class="sv tc2">${correct}</div><div class="sl">Correct</div></div>
      <div class="sc"><div class="sv tb2">${wrong}</div><div class="sl">Wrong</div></div>
      <div class="sc"><div class="sv ta2">${skipped}</div><div class="sl">Skipped</div></div>
    `;

    document.getElementById('res-review').innerHTML = S.quiz.qs.map((q,i)=>{
      const a = S.quiz.ans[i];
      const correctPick = isOk(a,q.correct);
      return `<div class="qcard" style="border-left-color:${correctPick?'var(--ok)':'var(--bad)'}">
        <div class="qm"><span class="qn mono">Q${i+1}</span><span class="ctag ${correctPick?'tg':'tr'}">${correctPick?'Correct':a===null?'Skipped':'Wrong'}</span></div>
        <div class="qt" style="font-size:.82rem">${esc(q.q)}</div>
        ${q.options.map((opt,oi)=>{
          let cls='opt';
          if(isOk(oi,q.correct)) cls+=' shc';
          else if(oi===a) cls+=' bad2';
          return `<div class="${cls}"><div class="ok">${String.fromCharCode(65+oi)}</div><div>${esc(opt)}</div></div>`;
        }).join('')}
        ${q.explanation?`<div class="expl show">${esc(q.explanation)}</div>`:''}
      </div>`;
    }).join('');

    if(pct>=70 && window.confetti){ confetti({particleCount:90,spread:75,origin:{y:0.6}}); }
    PROG.recordSession({chapter:S.quiz.ch, mode:S.quiz.mode, total, correct, wrong, skipped, pct, at:Date.now()});
  }
};

/* keyboard support during quizzes: arrows to navigate flashcards, ESC to quit */
document.addEventListener('keydown', e=>{
  if(!S.quiz.active) return;
  if(document.getElementById('quiz-wrap').style.display==='none') return;
  if(e.key==='Escape'){ QUIZ.quit(); }
  if(S.quiz.mode!=='exam'){
    if(e.key==='ArrowRight') QUIZ.fcNav(1);
    if(e.key==='ArrowLeft') QUIZ.fcNav(-1);
    if(['1','2','3','4','5'].includes(e.key)){
      const i=Number(e.key)-1;
      if(S.quiz.qs[S.quiz.idx]?.options[i]!==undefined) QUIZ.fcAnswer(i);
    }
  }
});

/* ═══════════════ 11a. PROGRESS TRACKING ═══════════════ */
const PROG = {
  track(correct){
    S.prog.total++;
    if(correct) S.prog.correct++;
    _save(LS.PROG, S.prog);
    HOME.updateStats();
  },
  recordSession(sess){
    S.prog.sessions.unshift(sess);
    S.prog.sessions = S.prog.sessions.slice(0,50); // cap history
    _save(LS.PROG, S.prog);
    HOME.render();
  },
  render(){
    const total=S.prog.total, correct=S.prog.correct, wrong=total-correct;
    const pct = total ? Math.round((correct/total)*100) : 0;
    document.getElementById('prog-stats').innerHTML = `
      <div class="sc"><div class="sv tcy">${total}</div><div class="sl">Answered</div></div>
      <div class="sc"><div class="sv tc2">${correct}</div><div class="sl">Correct</div></div>
      <div class="sc"><div class="sv tb2">${wrong}</div><div class="sl">Wrong</div></div>
      <div class="sc"><div class="sv ta2">${pct}%</div><div class="sl">Accuracy</div></div>
    `;
    // Per-chapter accuracy from session history
    const byChap = {};
    S.prog.sessions.forEach(s=>{
      const k=s.chapter||'Unknown';
      if(!byChap[k]) byChap[k]={correct:0,total:0};
      byChap[k].correct+=s.correct; byChap[k].total+=s.total;
    });
    const chapEl = document.getElementById('chap-acc');
    const entries = Object.entries(byChap);
    if(!entries.length){
      chapEl.innerHTML = '<div class="empty"><div class="empty-i">📊</div><p>Complete a quiz to see chapter breakdowns</p></div>';
    } else {
      chapEl.innerHTML = entries.map(([name,d])=>{
        const p = d.total ? Math.round((d.correct/d.total)*100) : 0;
        return `<div class="pb-w"><div class="pb-l"><span>${esc(name)}</span><span class="mono">${p}%</span></div>
          <div class="pb"><div class="pb-f" style="width:${p}%"></div></div></div>`;
      }).join('');
    }
  }
};
/* ═══════════════ 11b. STREAK ═══════════════ */
const STREAK = {
  markToday(){
    const t = today();
    if(!S.stk.days.includes(t)) S.stk.days.push(t);
    S.stk.last = t;
    S.stk.days = S.stk.days.slice(-60);
    _save(LS.STK, S.stk);
    HOME.render();
  },
  currentStreak(){
    let n=0; let d=new Date();
    while(true){
      const ds=d.toISOString().slice(0,10);
      if(S.stk.days.includes(ds)){ n++; d.setDate(d.getDate()-1); }
      else break;
    }
    return n;
  },
  renderBar(){
    const el = document.getElementById('sk-bar');
    if(!el)return;
    const days=[];
    const d=new Date();
    for(let i=6;i>=0;i--){
      const dd=new Date(d); dd.setDate(d.getDate()-i);
      days.push(dd.toISOString().slice(0,10));
    }
    el.innerHTML = days.map(ds=>{
      const done = S.stk.days.includes(ds);
      const isToday = ds===today();
      const label = new Date(ds).toLocaleDateString(undefined,{weekday:'short'})[0];
      return `<div class="sk-d ${done?'done':''} ${isToday?'today':''}">${label}</div>`;
    }).join('');
    document.getElementById('stk-tag').textContent = `🔥 ${STREAK.currentStreak()} day streak`;
  }
};

/* ═══════════════ 11c. HOME / DASHBOARD ═══════════════ */
const HOME = {
  render(){
    const h=new Date().getHours();
    const greet = h<5?'Burning the midnight oil? 🌙':h<12?'Good morning ☀️':h<17?'Good afternoon 🌤️':h<21?'Good evening 🌆':'Working late? 🌙';
    document.getElementById('greeting').textContent = `${greet} — ${S.user?.name||S.user?.username||'Student'}, let's get studying.`;
    HOME.updateStats();
    HOME.updateBadges();
    STREAK.renderBar();
    HOME.renderRecent();
    HOME.tickClock();
  },
  updateStats(){
    const total=S.prog.total, correct=S.prog.correct, wrong=total-correct;
    const pct = total ? Math.round((correct/total)*100) : 0;
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('hs-tot', total); set('hs-cor', correct); set('hs-wrg', wrong); set('hs-pct', pct+'%');
  },
  updateBadges(){
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('bkc', S.bk.length); set('flc', S.fl.length);
  },
  renderRecent(){
    const el = document.getElementById('recent-sessions');
    if(!el)return;
    const sessions = S.prog.sessions.slice(0,5);
    if(!sessions.length){ el.innerHTML='<div class="empty"><div class="empty-i">📈</div><p>No sessions yet — start a quiz!</p></div>'; return; }
    el.innerHTML = sessions.map(s=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--bd);font-size:.78rem">
        <div><div style="font-weight:700">${esc(s.chapter)}</div><div style="color:var(--t3);font-size:.68rem">${new Date(s.at).toLocaleString()}</div></div>
        <span class="ctag ${s.pct>=70?'tg':s.pct>=40?'ta':'tr'}">${s.pct}%</span>
      </div>
    `).join('');
  },
  _clockTimer:null,
  tickClock(){
    if(HOME._clockTimer) clearInterval(HOME._clockTimer);
    const tick=()=>{
      const now=new Date();
      const cl=document.getElementById('hclock'); if(cl) cl.textContent=now.toLocaleTimeString();
      const dt=document.getElementById('hdate'); if(dt) dt.textContent=now.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
      TT.renderCurrentSessionWidget('h-session');
    };
    tick();
    HOME._clockTimer=setInterval(tick,1000);
  }
};

/* ═══════════════ 11d. TIMETABLE ═══════════════ */
const TT = {
  add(){
    const day=Number(document.getElementById('tt-day').value);
    const name=document.getElementById('tt-name').value.trim();
    const start=document.getElementById('tt-s').value;
    const end=document.getElementById('tt-e').value;
    if(!name||!start||!end){ toast('Fill in all fields'); return; }
    S.tt.sessions.push({id:Date.now()+'', day, name, start, end});
    _save(LS.TT, S.tt);
    document.getElementById('tt-name').value='';
    TT.render();
    toast('✅ Session added');
  },
  remove(id){
    S.tt.sessions = S.tt.sessions.filter(s=>s.id!==id);
    _save(LS.TT, S.tt);
    TT.render();
  },
  _clockTimer:null,
  render(){
    if(TT._clockTimer) clearInterval(TT._clockTimer);
    const tick=()=>{
      const now=new Date();
      const cl=document.getElementById('tt-clock'); if(cl) cl.textContent=now.toLocaleTimeString();
      const dt=document.getElementById('tt-date'); if(dt) dt.textContent=now.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
      TT.renderCurrentSessionWidget('tt-now');
    };
    tick();
    TT._clockTimer=setInterval(tick,1000);

    // Today's sessions
    const todayDay = new Date().getDay();
    const todaySessions = S.tt.sessions.filter(s=>s.day===todayDay).sort((a,b)=>a.start.localeCompare(b.start));
    const todayEl = document.getElementById('tt-today');
    todayEl.innerHTML = todaySessions.length ? todaySessions.map(s=>`
      <div class="tt-row">
        <div class="tt-ti">${s.start}–${s.end}</div>
        <div class="tt-na">${esc(s.name)}</div>
        <button class="ib" onclick="TT.remove('${s.id}')">🗑</button>
      </div>
    `).join('') : '<div class="empty"><div class="empty-i">📅</div><p>Nothing scheduled today</p></div>';

    // Full week calendar grid
    const weekEl = document.getElementById('tt-week');
    const today = new Date().getDay();
    weekEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:.5rem">
        ${DAYS.map((d,i)=>`
          <div style="text-align:center;font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.6px;
            color:${i===today?'var(--neon)':'var(--t3)'};
            padding:.3rem .2rem;
            border-bottom:2px solid ${i===today?'var(--neon)':'var(--bd)'}">
            ${d.slice(0,3)}
          </div>
        `).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;align-items:start">
        ${DAYS.map((d,di)=>{
          const sess = S.tt.sessions.filter(s=>s.day===di).sort((a,b)=>a.start.localeCompare(b.start));
          const isToday = di===today;
          return `<div style="min-height:60px;background:${isToday?'rgba(0,229,255,.04)':'var(--bg1)'};border-radius:var(--r1);border:1px solid ${isToday?'rgba(0,229,255,.18)':'var(--bd)'};padding:.3rem .25rem">
            ${sess.length ? sess.map(s=>`
              <div style="background:${isToday?'rgba(0,229,255,.1)':'var(--surf2)'};border:1px solid ${isToday?'rgba(0,229,255,.25)':'var(--bd)'};border-radius:6px;padding:.28rem .35rem;margin-bottom:3px;cursor:default"
                title="${esc(s.name)} ${s.start}–${s.end}">
                <div style="font-size:.6rem;font-weight:700;color:${isToday?'var(--neon)':'var(--t3)'}">${s.start}</div>
                <div style="font-size:.65rem;font-weight:600;color:var(--t1);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(s.name)}</div>
                <button onclick="TT.remove('${s.id}')" style="background:none;border:none;color:var(--t3);font-size:.65rem;cursor:pointer;padding:0;float:right">✕</button>
              </div>
            `).join('') : `<div style="text-align:center;color:var(--t3);font-size:.6rem;margin-top:.5rem">—</div>`}
          </div>`;
        }).join('')}
      </div>
    `;
  },
  renderCurrentSessionWidget(elId){
    const el=document.getElementById(elId);
    if(!el)return;
    const now=new Date();
    const hhmm = now.toTimeString().slice(0,5);
    const todayDay = now.getDay();
    const active = S.tt.sessions.find(s=>s.day===todayDay && s.start<=hhmm && hhmm<s.end);
    const next = S.tt.sessions.filter(s=>s.day===todayDay && s.start>hhmm).sort((a,b)=>a.start.localeCompare(b.start))[0];
    if(active){
      el.innerHTML = `<div class="tt-now"><div class="tt-nl">Now</div><div class="tt-nn">${esc(active.name)}</div><div class="tt-nt">until ${active.end}</div></div>`;
    } else if(next){
      el.innerHTML = `<div class="tt-now"><div class="tt-nl">Next</div><div class="tt-nn">${esc(next.name)}</div><div class="tt-nt">starts ${next.start}</div></div>`;
    } else {
      el.innerHTML = `<div style="font-size:.74rem;color:var(--t3);text-align:center;padding:.4rem 0">No more sessions today</div>`;
    }
  },
  exportJ(){
    const blob=new Blob([JSON.stringify(S.tt,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='timetable.json';a.click();
  },
  importJ(){
    const inp=document.createElement('input');inp.type='file';inp.accept='.json';
    inp.onchange=()=>{
      const f=inp.files[0]; if(!f)return;
      const r=new FileReader();
      r.onload=e=>{
        try{
          const data=JSON.parse(e.target.result);
          if(data && Array.isArray(data.sessions)){ S.tt=data; _save(LS.TT,S.tt); TT.render(); toast('✅ Timetable imported'); }
          else toast('❌ Invalid timetable file');
        }catch{toast('❌ Invalid JSON')}
      };
      r.readAsText(f);
    };
    inp.click();
  },
  async notif(){
    if(!('Notification' in window)){ toast('Notifications not supported on this browser'); return; }
    const perm = await Notification.requestPermission();
    if(perm==='granted'){
      toast('🔔 Notifications enabled');
      TT._scheduleChecks();
    } else {
      toast('Notifications blocked');
    }
  },
  _checkTimer:null,
  _scheduleChecks(){
    if(TT._checkTimer) clearInterval(TT._checkTimer);
    let lastFired = '';
    TT._checkTimer = setInterval(()=>{
      const now=new Date();
      const hhmm = now.toTimeString().slice(0,5);
      const todayDay = now.getDay();
      const starting = S.tt.sessions.find(s=>s.day===todayDay && s.start===hhmm);
      if(starting && lastFired!==starting.id+hhmm){
        lastFired = starting.id+hhmm;
        if(Notification.permission==='granted'){
          new Notification('📚 Study session starting', {body:starting.name});
        }
      }
    },20000);
  }
};

/* ═══════════════ 11e. OFFLINE CACHE ═══════════════ */
const CACHE = {
  render(){
    const refs = ChapterData.allFileRefs();
    let cachedCount=0;
    refs.forEach(r=>{ if(_load(LS.QC+r.key,null)) cachedCount++; });
    const tag=document.getElementById('cache-tag');
    tag.textContent = cachedCount===refs.length && refs.length ? 'Fully cached' : cachedCount>0 ? 'Partially cached' : 'Not cached';
    tag.className = 'ctag ' + (cachedCount===refs.length && refs.length ? 'tg' : cachedCount>0 ? 'ta' : 'tr');
    document.getElementById('cache-txt').textContent = `${cachedCount} of ${refs.length} question sets cached on this device for offline use.`;

    const grid=document.getElementById('cache-grid');
    const levels = ChapterData.levels();
    grid.innerHTML = levels.map(lv=>{
      const lvRefs = refs.filter(r=>r.lv===lv);
      const lvCached = lvRefs.filter(r=>_load(LS.QC+r.key,null)).length;
      return `<div class="ci"><div class="ci-n">${esc(ChapterData.levelLabel(lv))}</div>
        <div class="ci-s"><div class="cd ${lvCached===lvRefs.length&&lvRefs.length?'y':'n'}"></div>${lvCached}/${lvRefs.length} cached</div></div>`;
    }).join('');
  },
  async dl(){
    const refs = ChapterData.allFileRefs();
    if(!refs.length){ toast('No content configured to cache'); return; }
    if(!S.online){ toast('❌ You need to be online to download the cache'); return; }
    const pb=document.getElementById('cpb'), pf=document.getElementById('cpf'), txt=document.getElementById('cptxt');
    pb.style.display='';
    let done=0;
    for(const ref of refs){
      txt.textContent = `Caching: ${ref.name} (${done+1}/${refs.length})`;
      try{ await QUIZ._fetch(ref.fid, ref.key); }catch{}
      done++;
      pf.style.width = `${(done/refs.length)*100}%`;
    }
    txt.textContent = `✅ Cached ${done}/${refs.length} sets`;
    toast('✅ Offline cache updated');
    CACHE.render();
  },
  clr(){
    if(!confirm('Clear all cached question data? You will need internet to reload it.'))return;
    Object.keys(localStorage).filter(k=>k.startsWith(LS.QC)).forEach(k=>localStorage.removeItem(k));
    toast('🗑 Cache cleared');
    CACHE.render();
  }
};

/* ═══════════════ 11f. DATA MANAGEMENT ═══════════════ */
const DATA = {
  exp(){
    const payload = { prog:S.prog, bk:S.bk, fl:S.fl, wr:S.wr, tt:S.tt, stk:S.stk, exportedAt:new Date().toISOString() };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='hamro-afnai-backup.json';a.click();
    toast('📤 Exported');
  },
  imp(){
    const inp=document.createElement('input');inp.type='file';inp.accept='.json';
    inp.onchange=()=>{
      const f=inp.files[0]; if(!f)return;
      const r=new FileReader();
      r.onload=e=>{
        try{
          const data=JSON.parse(e.target.result);
          if(data.prog){ S.prog=data.prog; _save(LS.PROG,S.prog); }
          if(data.bk){ S.bk=data.bk; _save(LS.BK,S.bk); }
          if(data.fl){ S.fl=data.fl; _save(LS.FL,S.fl); }
          if(data.wr){ S.wr=data.wr; _save(LS.WR,S.wr); }
          if(data.tt){ S.tt=data.tt; _save(LS.TT,S.tt); }
          if(data.stk){ S.stk=data.stk; _save(LS.STK,S.stk); }
          toast('✅ Data imported');
          HOME.render(); PROG.render();
        }catch{ toast('❌ Invalid backup file'); }
      };
      r.readAsText(f);
    };
    inp.click();
  },
  clearQ(){
    if(!confirm('Clear cached question downloads? Your progress/bookmarks stay intact.'))return;
    Object.keys(localStorage).filter(k=>k.startsWith(LS.QC)).forEach(k=>localStorage.removeItem(k));
    toast('🧹 Question cache cleared');
  },
  reset(){
    if(!confirm('⚠️ This deletes ALL progress, bookmarks, flags, wrong answers, and timetable on this device. Continue?'))return;
    if(!confirm('Are you absolutely sure? This cannot be undone.'))return;
    [LS.PROG,LS.BK,LS.FL,LS.WR,LS.TT,LS.STK].forEach(k=>localStorage.removeItem(k));
    toast('⚠️ All data reset');
    location.reload();
  }
};

/* ═══════════════ 12. APP BOOT ═══════════════ */
const APP = {
  init(){
    document.getElementById('sb-lv').value='';
    if(_load(LS.THEME,'dark')==='light') document.body.classList.add('light');
    UI.go('home');
    CACHE.render();
    if('Notification' in window && Notification.permission==='granted') TT._scheduleChecks();
  }
};

/* ── network status wiring ── */
window.addEventListener('online', ()=>{
  S.online=true;
  document.getElementById('offbar')?.classList.remove('show');
  toast('🌐 Back online');
});
window.addEventListener('offline', ()=>{
  S.online=false;
  document.getElementById('offbar')?.classList.add('show');
  toast('📡 You are offline — cached data will be used');
});

/* ── login screen connectivity indicator ── */
function _updateLoginNetStatus(){
  const dot=document.getElementById('ndot'), stat=document.getElementById('nstat');
  if(!dot||!stat)return;
  if(navigator.onLine){ dot.classList.remove('off'); stat.textContent='Online — ready to sign in'; }
  else { dot.classList.add('off'); stat.textContent='Offline — using saved session if available'; }
}
window.addEventListener('online', _updateLoginNetStatus);
window.addEventListener('offline', _updateLoginNetStatus);

/* ── boot sequence ── */
document.addEventListener('DOMContentLoaded', ()=>{
  if(_load(LS.THEME,'dark')==='light') document.body.classList.add('light');
  _updateLoginNetStatus();
  PWA.init();
  // Offline-first: try to restore an existing session before anything else.
  // This is what makes the app behave like Facebook/WhatsApp — already
  // logged-in users go straight to the dashboard, online or offline.
  const restored = AUTH.restore();
  if(!restored){
    // No usable session — show login screen (already visible by default).
  }
  document.getElementById('lu')?.addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('lp').focus(); });
  document.getElementById('lp')?.addEventListener('keydown', e=>{ if(e.key==='Enter') AUTH.login(); });
});

/* ═══════════════ EXPLICIT GLOBAL EXPOSURE ═══════════════
   index.html calls these via inline onclick="X.method()" attributes.
   Top-level `const X = {...}` does NOT reliably attach X to `window`
   in all execution contexts — this caused inline onclick handlers to
   silently fail to find X (e.g. "ADMIN is not defined" at click-time)
   even though typing X directly in the console worked fine. Explicitly
   assigning each object to window guarantees inline onclick attributes
   can always resolve them. */
window.AUTH = AUTH;
window.ADMIN = ADMIN;
window.UI = UI;
window.SB = SB;
window.ON = ON;
window.LOC = LOC;
window.PSY = PSY;
window.REV = REV;
window.QUIZ = QUIZ;
window.PWA = PWA;
window.PROG = PROG;
window.HOME = HOME;
window.TT = TT;
window.CACHE = CACHE;
window.DATA = DATA;
