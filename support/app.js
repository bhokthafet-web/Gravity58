const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const app=$('#app'),api=window.Gravity58Ads;
const now=()=>new Date().toISOString();
const html=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const TICKET_KIND='support_tickets';
const SOURCE_LABELS={digit58:'Refills',digitalMenu:'Digital Menu','digital-menu':'Digital Menu',pos:'POS'};
const SOURCE_HOME={digit58:'/digit58/','digital-menu':'/digital-menu/',digitalMenu:'/digital-menu/',pos:'/pos/'};
function toast(message){const target=$('#toast');if(!target)return alert(message);target.textContent=message;target.classList.add('show');setTimeout(()=>target.classList.remove('show'),2400)}
function sourceLabel(source){return SOURCE_LABELS[source]||'G58'}

let session=null,tickets=[],source='';

async function boot(){
  if(!api?.configured)return renderConfigError();
  source=new URLSearchParams(location.search).get('from')||'';
  session=await api.currentUser().catch(()=>null);
  if(!session)return renderSignedOut();
  await loadTickets();
  renderApp();
}
function renderConfigError(){
  app.innerHTML=`<main class="screen"><section class="auth-card"><h2>G58 Support</h2><p class="muted">Support is temporarily unavailable. Please try again shortly.</p></section></main>`;
}
function renderSignedOut(){
  const home=SOURCE_HOME[source]||'/';
  app.innerHTML=`<main class="screen"><section class="auth-card"><div class="brand"><div class="brand-mark">S</div><div><h2>G58 Support</h2><p class="tagline">Sign in to raise or view support tickets</p></div></div><p class="muted">Please sign in to your ${html(sourceLabel(source))} account first, then come back to Support.</p><a class="btn full" href="${html(home)}" style="margin-top:14px;display:block;text-align:center;text-decoration:none">Go to ${html(sourceLabel(source))}</a></section></main>`;
}
async function loadTickets(){
  tickets=await api.list(TICKET_KIND).catch(()=>[]);
  tickets.sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
}
function statusChipClass(status){return status==='Resolved'?'delivered':status==='In Progress'?'due':''}
function ticketMarkup(ticket){
  const messages=(ticket.messages||[]);
  return `<article class="card ticket-card"><div class="section-head"><h3>${html(ticket.subject)}</h3><span class="chip ${statusChipClass(ticket.status)}">${html(ticket.status)}</span></div><p class="muted" style="margin:0 0 10px">${html(sourceLabel(ticket.source))} · ${new Date(ticket.createdAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</p><div class="ticket-thread">${messages.map(message=>`<div class="ticket-message ${message.senderRole==='requester'?'mine':''}"><strong>${html(message.senderRole==='admin'?'G58 Support':message.senderName||'You')}</strong><span>${html(message.text)}</span></div>`).join('')}</div>${ticket.status!=='Resolved'?`<form class="ticket-reply-form" data-ticket-reply="${html(ticket.id)}"><input name="message" maxlength="1000" placeholder="Add a reply…"><button class="btn small" type="submit">Send</button></form>`:''}</article>`;
}
function renderApp(){
  app.innerHTML=`<main class="support-shell"><header class="support-header"><div class="brand"><div class="brand-mark">S</div><div><h2>G58 Support</h2><p class="tagline">Signed in as ${html(session.email||'')}</p></div></div><button class="btn secondary small" id="supportLogout">Sign out</button></header>
  <section class="card" style="max-width:640px;margin:0 auto 24px"><h3 style="margin-top:0">Raise a Ticket</h3>${source?`<p class="muted">Regarding: <strong>${html(sourceLabel(source))}</strong></p>`:''}<form id="raiseTicketForm"><div class="field"><label>Subject</label><input name="subject" maxlength="160" required></div><div class="field"><label>Message</label><textarea name="message" maxlength="2000" required></textarea></div><button class="btn full" type="submit">Submit Ticket</button></form></section>
  <div class="section-head" style="max-width:640px;margin:0 auto"><h3>Your Tickets</h3></div>
  <div class="grid" style="max-width:640px;margin:0 auto;gap:14px">${tickets.map(ticketMarkup).join('')||'<div class="empty">No tickets yet.</div>'}</div>
  </main>`;
  $('#supportLogout').onclick=async()=>{await api.logout();session=null;renderSignedOut()};
  $('#raiseTicketForm').onsubmit=async event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.target)),button=event.submitter;
    button.disabled=true;
    try{
      await api.executeFunction(api.config.digitalOrderFunctionId,{action:'raise-support-ticket',subject:values.subject.trim(),message:values.message.trim(),source,requesterName:session.name||session.email.split('@')[0],requesterEmail:session.email});
      await loadTickets();renderApp();toast('Ticket submitted — the G58 team will reply here');
    }catch(error){button.disabled=false;toast(error.message||'Could not submit ticket')}
  };
  $$('[data-ticket-reply]').forEach(form=>{
    form.onsubmit=async event=>{
      event.preventDefault();
      const ticketId=form.dataset.ticketReply,ticket=tickets.find(row=>row.id===ticketId),input=form.querySelector('input[name="message"]'),text=input.value.trim();
      if(!text||!ticket)return;
      input.value='';
      const message={senderRole:'requester',senderName:session.name||session.email.split('@')[0],text,createdAt:now()};
      const messages=[...(ticket.messages||[]),message];
      try{
        await api.update(TICKET_KIND,ticket.id,{messages,updatedAt:now(),status:ticket.status==='Resolved'?'Resolved':'Open'});
        ticket.messages=messages;ticket.updatedAt=now();
        renderApp();
      }catch(error){toast(error.message||'Could not send reply')}
    };
  });
}

boot();
