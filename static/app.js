async function api(url, options={}) {
  const response = await fetch(url, {credentials:'same-origin', headers:{'Content-Type':'application/json', ...(options.headers||{})}, ...options});
  const data = await response.json().catch(()=>({}));
  if (response.status === 401) { location.href='/login'; throw new Error('Sessão expirada.'); }
  if (!response.ok) throw new Error(data.error || 'Erro ao comunicar com o servidor.');
  return data;
}

const navButtons = document.querySelectorAll('.nav-link[data-view]');
const pages = document.querySelectorAll('.page');
const crumb = document.getElementById('crumb');

function showPage(id){
  pages.forEach(page=>page.classList.toggle('active-page',page.id===id));
  navButtons.forEach(button=>button.classList.toggle('active',button.dataset.view===id));
  const active=document.querySelector(`.nav-link[data-view="${id}"]`);
  if(crumb) crumb.textContent=active ? active.textContent.trim().replace(/\d+$/,'').trim() : id;
  document.getElementById('sidebar').classList.remove('open');
  
  if(id==='kanban') loadKanban();
  if(id==='agenda') loadAgenda5Days();
  if(id==='equipe') loadProfessionalsPage();
  if(id==='servicos') loadServicesPage();
  if(id==='clientes') loadClientsPage();
  if(id==='unidades') loadUnitsPage();
  if(id==='config') loadSettingsPage();

  window.scrollTo({top:0,behavior:'smooth'});
}

navButtons.forEach(button=>button.addEventListener('click',()=>showPage(button.dataset.view)));
document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>showPage(button.dataset.go)));
document.getElementById('mobileMenu').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));

function money(value){return Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});}
function setStat(label, value){const card=[...document.querySelectorAll('.stat-card')].find(c=>c.querySelector('.stat-top')?.innerText.includes(label));if(card)card.querySelector('strong').textContent=value;}

function syncTodayLabels() {
  const now = new Date();
  const topLabel = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  }).toUpperCase();

  const shortDay = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short'
  }).replace('.', '');

  document.querySelectorAll('.today-label').forEach(el => {
    el.textContent = topLabel;
  });

  const kanbanDateEl = document.querySelector('#kanban .date-control b');
  if (kanbanDateEl) {
    kanbanDateEl.textContent = `Hoje, ${shortDay}.`;
  }
}

// Seletor rápido de unidades da empresa ativa na sidebar
const workspaceBox = document.querySelector('.workspace');
const workspaceSwitchBtn = document.querySelector('.workspace-switch');
let unitDropdown = null;

if (workspaceBox && workspaceSwitchBtn) {
  workspaceBox.style.position = 'relative';
  unitDropdown = document.createElement('div');
  unitDropdown.id = 'workspaceUnitMenu';
  unitDropdown.style.cssText = 'display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);background:#fff;border:1px solid #e5e5e5;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.12);padding:6px;z-index:50;';
  workspaceBox.appendChild(unitDropdown);

  async function renderWorkspaceUnitMenu() {
    if (!unitDropdown) return;
    unitDropdown.innerHTML = '<div style="padding:8px 10px;font-size:12px;color:#666;">Carregando unidades...</div>';
    try {
      const units = await api('/api/units');
      if (!units || units.length === 0) {
        unitDropdown.innerHTML = '<div style="padding:8px 10px;font-size:12px;color:#666;">Nenhuma unidade cadastrada.</div>';
        return;
      }

      unitDropdown.innerHTML = `
        <div style="padding:4px 10px 6px;font-size:10px;font-weight:700;letter-spacing:0.06em;color:#888;text-transform:uppercase;">Unidades da empresa</div>
        ${units.map(u => `
          <button type="button" class="ws-unit-option" data-unit-id="${u.id}" style="width:100%;display:flex;justify-content:space-between;align-items:center;text-align:left;background:${u.is_current ? '#f5f5f5' : 'transparent'};border:none;border-radius:7px;padding:8px 10px;cursor:pointer;font-size:13px;color:#171717;margin-bottom:2px;">
            <span>
              <b>${escapeHtml(u.name)}</b>
              ${u.city ? `<br><small style="color:#777;font-size:11px;">${escapeHtml(u.city)}</small>` : ''}
            </span>
            <span style="font-size:11px;font-weight:600;color:${u.is_current ? '#1b5e20' : '#666'};">${u.is_current ? 'Ativa' : 'Trocar'}</span>
          </button>
        `).join('')}
        <div style="border-top:1px solid #eee;margin-top:4px;padding-top:4px;">
          <button type="button" id="wsManageUnitsBtn" style="width:100%;text-align:left;background:transparent;border:none;border-radius:7px;padding:7px 10px;cursor:pointer;font-size:12px;color:#333;font-weight:500;">⚙ Gerenciar unidades</button>
        </div>
      `;

      unitDropdown.querySelectorAll('.ws-unit-option').forEach(opt => {
        opt.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const unitId = opt.dataset.unitId;
          try {
            await api(`/api/units/${unitId}/select`, { method: 'PATCH' });
            unitDropdown.style.display = 'none';
            await refreshActiveViews();
          } catch (err) {
            alert(err.message);
          }
        });
      });

      document.getElementById('wsManageUnitsBtn')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        unitDropdown.style.display = 'none';
        showPage('unidades');
      });
    } catch (err) {
      unitDropdown.innerHTML = `<div style="padding:8px 10px;font-size:12px;color:#b91c1c;">${escapeHtml(err.message)}</div>`;
    }
  }

  workspaceSwitchBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = unitDropdown.style.display === 'block';
    if (isOpen) {
      unitDropdown.style.display = 'none';
    } else {
      unitDropdown.style.display = 'block';
      await renderWorkspaceUnitMenu();
    }
  });

  document.addEventListener('click', (e) => {
    if (unitDropdown && !workspaceBox.contains(e.target)) {
      unitDropdown.style.display = 'none';
    }
  });
}

async function refreshActiveViews() {
  await loadDashboard();
  if (document.getElementById('unidades')?.classList.contains('active-page')) await loadUnitsPage();
  if (document.getElementById('kanban')?.classList.contains('active-page')) await loadKanban();
  if (document.getElementById('agenda')?.classList.contains('active-page')) await loadAgenda5Days();
  if (document.getElementById('equipe')?.classList.contains('active-page')) await loadProfessionalsPage();
  if (document.getElementById('servicos')?.classList.contains('active-page')) await loadServicesPage();
  if (document.getElementById('config')?.classList.contains('active-page')) await loadSettingsPage();
}

// Inicialização segura ao carregar a página
(async () => {
  try {
    syncTodayLabels();
    const user = await api('/api/me');
    if (user && user.name) {
      document.getElementById('user-name').textContent = user.name;
      document.getElementById('welcome-user-name').textContent = user.name.split(' ')[0];
      const initialsText = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      document.getElementById('user-avatar').textContent = initialsText;
      document.getElementById('top-user-avatar').textContent = initialsText;
      document.getElementById('user-role').textContent = user.role === 'manager' ? 'Administrador(a)' : 'Funcionário(a)';
    }

    try {
      const units = await api('/api/units');
      const activeUnit = Array.isArray(units) ? units.find(u => u.is_current) : null;
      const unitEl = document.getElementById('sidebar-unit-name');
      if (activeUnit && unitEl) {
        unitEl.textContent = activeUnit.name;
      }
    } catch (err) {
      console.error('Erro ao carregar unidade ativa:', err);
    }

    await loadDashboard();
  } catch (e) {
    console.error(e);
  }
})();

async function loadDashboard() {
  const data = await api('/api/dashboard');
  setStat('Agendamentos hoje', data.appointments_today);
  setStat('Em atendimento', String(data.in_progress).padStart(2, '0'));
  setStat('Faturamento previsto', money(data.revenue_forecast ?? data.revenue_completed));
  setStat('Confirmações pendentes', String(data.pending).padStart(2, '0'));

  const inProgressCard = [...document.querySelectorAll('.stat-card')].find(c => c.querySelector('.stat-top')?.innerText.includes('Em atendimento'));
  if (inProgressCard) {
    const occ = Number(data.occupied_professionals || 0);
    const cap = Number(data.capacity_percent || 0);
    const occEl = inProgressCard.querySelector('small.muted');
    const barEl = inProgressCard.querySelector('.progress i');
    const capCaptionEl = inProgressCard.querySelector('small.progress-caption');
    if (occEl) occEl.textContent = `${occ} ${occ === 1 ? 'profissional ocupado' : 'profissionais ocupados'}`;
    if (barEl) barEl.style.width = `${cap}%`;
    if (capCaptionEl) capCaptionEl.textContent = `${cap}% da capacidade atual`;
  }

  const pendingCard = [...document.querySelectorAll('.stat-card')].find(c => c.querySelector('.stat-top')?.innerText.includes('Confirmações pendentes'));
  if (pendingCard) {
    const warnEl = pendingCard.querySelector('small.warning-text');
    if (warnEl) {
      warnEl.textContent = Number(data.pending || 0) > 0 ? 'Precisam de atenção' : 'Tudo em dia';
    }
  }

  try {
    const team = await api(`/api/professionals${data.unit_id ? `?unit_id=${data.unit_id}` : ''}`);
    const teamContainer = document.getElementById('team-container');
    if (teamContainer) {
      if (team && team.length > 0) {
        teamContainer.innerHTML = team.map(p => `
          <div class="team-row">
            <div class="avatar team-a">${initials(p.name)}</div>
            <div class="team-info"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.specialty || 'Profissional')}</small></div>
            <span class="availability"><i></i> Ativo</span>
          </div>
        `).join('');
      } else {
        teamContainer.innerHTML = '<p class="subheading">Nenhum profissional cadastrado nesta unidade.</p>';
      }
    }
  } catch (err) {
    console.error('Erro ao carregar equipe:', err);
  }

  if (data.company) {
    const compEl = document.getElementById('sidebar-company-name');
    const topCompEl = document.getElementById('top-company-name');
    if (compEl) compEl.textContent = data.company;
    if (topCompEl) topCompEl.textContent = data.company;
  }

  const weekdayShort = new Date().toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();
  if (data.unit) {
    const unitEl = document.getElementById('sidebar-unit-name');
    const eyebrowEl = document.getElementById('dash-eyebrow');
    if (unitEl) unitEl.textContent = data.unit;
    if (eyebrowEl) eyebrowEl.textContent = `${weekdayShort} · ${data.unit.toUpperCase()}`;
  }

  const bottomGrid = document.querySelector('#dashboard .bottom-grid');
  const servicesPanel = bottomGrid ? bottomGrid.querySelectorAll('.panel')[0] : null;
  if (servicesPanel) {
    const headerHtml = `
      <div class="panel-heading">
        <div>
          <h2>Serviços mais procurados</h2>
          <p>Últimos 7 dias</p>
        </div>
        <span class="muted tiny">7 DIAS</span>
      </div>
    `;
    if (Array.isArray(data.top_services) && data.top_services.length > 0) {
      servicesPanel.innerHTML = headerHtml + data.top_services.map(s => `
        <div class="service-line">
          <span>${escapeHtml(s.name)}</span><b>${s.percent}%</b>
          <div class="service-track"><i style="width:${s.percent}%"></i></div>
        </div>
      `).join('');
    } else {
      servicesPanel.innerHTML = headerHtml + '<p class="subheading">Sem atendimentos registrados nos últimos 7 dias.</p>';
    }
  }

  const noticePanel = document.querySelector('#dashboard .notice-panel');
  if (noticePanel) {
    const pCount = Number(data.pending || 0);
    const h2 = noticePanel.querySelector('h2');
    const p = noticePanel.querySelector('p');
    if (h2) h2.textContent = pCount > 0 ? 'Seu dia está fluindo bem!' : 'Agenda sob controle!';
    if (p) {
      p.textContent = pCount > 0
        ? `Você tem ${pCount} ${pCount === 1 ? 'confirmação pendente' : 'confirmações pendentes'}. Uma rápida revisão ajuda a evitar horários ociosos na agenda.`
        : 'Nenhuma confirmação pendente no momento. Aproveite para acompanhar os atendimentos do dia.';
    }
  }

  const list = document.querySelector('.appointment-list');
  if (list) {
    list.innerHTML = data.appointments.slice(0, 6).map(a => `<div class="appointment-row"><time>${a.start_at.slice(11, 16)}</time><div class="avatar client-a">${initials(a.client)}</div><div class="appointment-info"><b>${escapeHtml(a.client)}</b><small>${escapeHtml(a.service)} · ${escapeHtml(a.professional)}</small></div><span class="status ${statusClass(a.status)}">${statusLabel(a.status)}</span></div>`).join('') || '<p class="subheading">Nenhum agendamento para hoje nesta unidade.</p>';
  }
}

const columns = [
  { status: 'arrived', title: 'Chegaram / Confirmados', dot: 'dot-amber' },
  { status: 'waiting', title: 'Em espera', dot: 'dot-blue' },
  { status: 'in_progress', title: 'Em atendimento', dot: 'dot-green' },
  { status: 'completed', title: 'Finalizados', dot: 'dot-gray' },
];

let kanbanSelectedDate = new Date();
kanbanSelectedDate.setHours(0, 0, 0, 0);

function formatDateParam(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function updateKanbanDateLabel() {
  const el = document.querySelector('#kanban .date-control b');
  if (!el) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const shortDay = kanbanSelectedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short'
  }).replace('.', '');

  el.textContent = kanbanSelectedDate.getTime() === today.getTime()
    ? `Hoje, ${shortDay}.`
    : `${shortDay}.`;
}

async function loadKanban(){
  updateKanbanDateLabel();
  const dateStr = formatDateParam(kanbanSelectedDate);
  const appointments=await api(`/api/appointments?date=${dateStr}`);
  const board=document.querySelector('.kanban-board');
  if(!board)return;
  board.innerHTML=columns.map(col=>{
    const items=appointments.filter(a=>a.status===col.status || (col.status==='arrived' && ['requested','pending','confirmed'].includes(a.status)));
    return `<div class="kanban-column" data-status="${col.status}"><div class="column-heading"><span><i class="dot ${col.dot}"></i>${col.title}</span><b>${items.length}</b></div><div class="kanban-cards">${items.map(a=>`<article class="booking-card" draggable="true" data-id="${a.id}"><div class="card-time">${a.start_at.slice(11,16)} <span>· ${statusLabel(a.status)}</span></div><div class="card-client"><div class="avatar client-a">${initials(a.client)}</div><div><b>${escapeHtml(a.client)}</b><small>${escapeHtml(a.service)}</small></div></div><div class="card-meta"><span>${escapeHtml(a.professional)}</span><b>${money(a.price)}</b></div><div class="card-footer"><span class="tag ${a.status==='completed'?'tag-green':''}">${statusLabel(a.status)}</span><button class="card-menu" type="button" aria-label="Opções">•••</button></div></article>`).join('')}</div><button class="add-card" type="button">＋ Adicionar cartão</button></div>`;
  }).join('');
  board.querySelectorAll('.booking-card').forEach(card=>{
    card.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',card.dataset.id);card.classList.add('dragging');});
    card.addEventListener('dragend',()=>card.classList.remove('dragging'));
  });
  board.querySelectorAll('.kanban-column').forEach(col=>{
    col.addEventListener('dragover',e=>e.preventDefault());
    col.addEventListener('drop',async e=>{
      e.preventDefault();const id=e.dataTransfer.getData('text/plain');if(!id)return;
      try{await api(`/api/appointments/${id}`,{method:'PATCH',body:JSON.stringify({status:col.dataset.status})});await loadKanban();await loadDashboard();}
      catch(err){alert(err.message);}
    });
  });
}

const dateControl = document.querySelector('#kanban .date-control');
if (dateControl) {
  const parts = dateControl.childNodes;
  parts.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      const span = document.createElement('button');
      span.type = 'button';
      span.textContent = node.textContent.trim();
      span.style.cssText = 'background:none;border:none;cursor:pointer;padding:0 6px;font-size:inherit;color:inherit;';
      span.dataset.step = node.textContent.includes('‹') ? '-1' : '1';
      node.replaceWith(span);
    }
  });

  dateControl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-step]');
    if (!btn) return;
    const step = Number(btn.dataset.step);
    kanbanSelectedDate.setDate(kanbanSelectedDate.getDate() + step);
    loadKanban();
  });
}

// Agenda em janela deslizante de 5 dias (Dia 1..5 -> Dia 2..6 ao avançar)
let agendaStartDate = new Date();
agendaStartDate.setHours(0, 0, 0, 0);

const dotPalette = ['dot-amber', 'dot-blue', 'dot-green', 'dot-gray', 'dot-amber'];

function formatAgendaColumnTitle(dateObj, index) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayMonth = dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short'
  }).replace('.', '');

  const weekday = dateObj.toLocaleDateString('pt-BR', {
    weekday: 'short'
  }).replace('.', '');

  const prefix = dateObj.getTime() === today.getTime() ? 'Hoje · ' : `Dia ${index + 1} · `;
  return `${prefix}${dayMonth} (${weekday})`;
}

async function loadAgenda5Days() {
  const board = document.getElementById('agendaBoard');
  const rangeLabel = document.getElementById('agendaRangeLabel');
  const totalLabel = document.getElementById('agendaTotalLabel');
  if (!board) return;

  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(agendaStartDate);
    d.setDate(agendaStartDate.getDate() + i);
    days.push(d);
  }

  if (rangeLabel) {
    const firstStr = days[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
    const lastStr = days[4].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
    rangeLabel.textContent = `${firstStr} — ${lastStr}`;
  }

  const results = await Promise.all(
    days.map(d => api(`/api/appointments?date=${formatDateParam(d)}`))
  );

  const totalCount = results.reduce((acc, list) => acc + (Array.isArray(list) ? list.length : 0), 0);
  if (totalLabel) {
    totalLabel.textContent = `${totalCount} ${totalCount === 1 ? 'agendamento' : 'agendamentos'} nos 5 dias`;
  }

  board.innerHTML = days.map((d, idx) => {
    const dateStr = formatDateParam(d);
    const items = Array.isArray(results[idx]) ? results[idx] : [];
    const colTitle = formatAgendaColumnTitle(d, idx);
    const dotClass = dotPalette[idx % dotPalette.length];

    return `<div class="kanban-column" data-date="${dateStr}"><div class="column-heading"><span><i class="dot ${dotClass}"></i>${escapeHtml(colTitle)}</span><b>${items.length}</b></div><div class="kanban-cards">${items.map(a => `<article class="booking-card" draggable="true" data-id="${a.id}" data-time="${escapeHtml(a.start_at.slice(11, 16))}"><div class="card-time">${a.start_at.slice(11, 16)} <span>· ${statusLabel(a.status)}</span></div><div class="card-client"><div class="avatar client-a">${initials(a.client)}</div><div><b>${escapeHtml(a.client)}</b><small>${escapeHtml(a.service)}</small></div></div><div class="card-meta"><span>${escapeHtml(a.professional)}</span><b>${money(a.price)}</b></div><div class="card-footer"><span class="tag ${a.status==='completed'?'tag-green':''}">${statusLabel(a.status)}</span><button class="card-menu" type="button" aria-label="Opções">•••</button></div></article>`).join('')}</div></div>`;
  }).join('');

  board.querySelectorAll('.booking-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.setData('text/time', card.dataset.time || '14:00');
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  board.querySelectorAll('.kanban-column').forEach(col => {
    col.addEventListener('dragover', e => e.preventDefault());
    col.addEventListener('drop', async e => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      const time = e.dataTransfer.getData('text/time') || '14:00';
      const targetDate = col.dataset.date;
      if (!id || !targetDate) return;

      try {
        await api(`/api/appointments/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ start_at: `${targetDate}T${time}:00` })
        });
        await loadAgenda5Days();
        await loadDashboard();
        if (document.getElementById('kanban')?.classList.contains('active-page')) {
          await loadKanban();
        }
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

document.getElementById('agendaDateControl')?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-agenda-step]');
  if (!btn) return;
  const step = Number(btn.dataset.agendaStep);
  agendaStartDate.setDate(agendaStartDate.getDate() + step);
  loadAgenda5Days();
});

document.getElementById('agendaTodayBtn')?.addEventListener('click', () => {
  agendaStartDate = new Date();
  agendaStartDate.setHours(0, 0, 0, 0);
  loadAgenda5Days();
});

document.addEventListener('click', async (e) => {
  const menuBtn = e.target.closest('.card-menu');
  if (!menuBtn) return;

  const card = menuBtn.closest('.booking-card');
  const id = card?.dataset.id;
  if (!id) return;

  const currentTime = card.querySelector('.card-time')?.textContent.slice(0, 5) || '14:00';
  const todayStr = new Date().toISOString().slice(0, 10);
  const newDate = prompt('Nova data (AAAA-MM-DD):', todayStr);
  if (!newDate) return;

  const newTime = prompt('Novo horário (HH:MM):', currentTime);
  if (!newTime) return;

  try {
    await api(`/api/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ start_at: `${newDate}T${newTime}:00` })
    });
    await loadKanban();
    await loadAgenda5Days();
    await loadDashboard();
    alert('Agendamento remarcado com sucesso!');
  } catch (err) {
    alert(err.message);
  }
});

function initials(name){return String(name||'').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function statusLabel(s){return ({requested:'Solicitado',pending:'Pendente',confirmed:'Confirmado',arrived:'Chegou',in_progress:'Em atendimento',waiting:'Em espera',completed:'Finalizado',cancelled:'Cancelado'})[s]||s;}
function statusClass(s){return ['requested','pending'].includes(s)?'status-pending':s==='in_progress'?'status-progress':'status-confirmed';}

const modal=document.getElementById('modal');
['newBooking','kanbanNew','agendaNew'].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.addEventListener('click', () => {
    populateBookingModal();
    modal.classList.add('open');
  });
});
document.getElementById('closeModal').addEventListener('click',()=>modal.classList.remove('open'));
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});

document.getElementById('bookingForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const form=e.target;
  try{
    const serviceSelect = form.querySelector('#modal-service-select');
    const professionalSelect = form.querySelector('#modal-professional-select');
    
    const service_id = serviceSelect ? Number(serviceSelect.value) : null;
    const professional_id = professionalSelect ? Number(professionalSelect.value) : null;
    
    if (!service_id || !professional_id) {
      alert('Selecione um serviço e um profissional válidos.');
      return;
    }

    const dateInput = form.querySelector('#modal-date-input');
    const date = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().slice(0,10);
    const time = form.querySelector('input[type="time"]').value;
    const clientNameInput = form.querySelector('input[required]') || form.querySelector('input[type="text"]');
    const clientName = clientNameInput ? clientNameInput.value : 'Cliente';

    await api('/api/appointments',{method:'POST',body:JSON.stringify({
      client_name: clientName,
      phone: '34999990099',
      service_id: service_id,
      professional_id: professional_id,
      start_at: `${date}T${time}:00`
    })});
    
    modal.classList.remove('open');
    form.reset();
    await loadDashboard();
    await loadKanban();
    await loadAgenda5Days();
    alert('Agendamento salvo no banco de dados!');
  }catch(err){alert(err.message);}
});

async function populateBookingModal() {
  try {
    const dateInput = document.getElementById('modal-date-input');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }

    const catalog = await api('/api/admin/catalog');
    const serviceSelect = document.getElementById('modal-service-select');
    const professionalSelect = document.getElementById('modal-professional-select');
    
    if (serviceSelect) {
      serviceSelect.innerHTML = catalog.services && catalog.services.length > 0 
        ? catalog.services.map(s => `<option value="${s.id}">${s.name} - R$ ${s.price}</option>`).join('') 
        : '<option value="">Nenhum serviço cadastrado nesta unidade</option>';
    }
    
    if (professionalSelect) {
      professionalSelect.innerHTML = catalog.professionals && catalog.professionals.length > 0 
        ? catalog.professionals.map(p => `<option value="${p.id}">${p.name} (${p.specialty || 'Geral'})</option>`).join('') 
        : '<option value="">Nenhum profissional cadastrado nesta unidade</option>';
    }
  } catch(e) {
    console.error("Erro ao carregar catálogo para o modal:", e);
  }
}

// Carregar Profissionais na aba Gestão
async function loadProfessionalsPage() {
  const container = document.getElementById('professional-list-container');
  if(!container) return;
  try {
    const pros = await api('/api/professionals');
    if(pros.length === 0) {
      container.innerHTML = '<p>Nenhum profissional cadastrado nesta unidade. Clique em "Adicionar profissional".</p>';
      return;
    }
    container.innerHTML = pros.map(p => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;"><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.specialty || 'Geral')}</span></div>`).join('');
  } catch(e) {
    container.innerHTML = '<p>Erro ao carregar profissionais.</p>';
  }
}

// Carregar Serviços na aba Gestão
async function loadServicesPage() {
  const container = document.getElementById('service-list-container');
  if(!container) return;
  try {
    const services = await api('/api/services');
    if(services.length === 0) {
      container.innerHTML = '<p>Nenhum serviço cadastrado nesta unidade. Clique em "Novo serviço".</p>';
      return;
    }
    container.innerHTML = services.map(s => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;"><b>${escapeHtml(s.name)}</b><span>${s.duration_minutes} min — R$ ${s.price}</span></div>`).join('');
  } catch(e) {
    container.innerHTML = '<p>Erro ao carregar serviços.</p>';
  }
}

// Carregar Unidades na aba Gestão
async function loadUnitsPage() {
  const container = document.getElementById('unit-list-container');
  if(!container) return;
  try {
    const units = await api('/api/units');
    if(!units || units.length === 0) {
      container.innerHTML = '<p>Nenhuma unidade cadastrada. Clique em "Nova unidade".</p>';
      return;
    }
    container.innerHTML = units.map(u => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #eee;gap:12px;">
        <div>
          <b>${escapeHtml(u.name)}</b>
          ${u.is_current ? '<span class="tag" style="margin-left:8px;background:#e8f5e9;color:#1b5e20;padding:3px 8px;border-radius:4px;font-size:11px;">Ativa</span>' : ''}
          <br>
          <small style="color:#666;">${u.city ? '📍 ' + escapeHtml(u.city) + ' · ' : ''}Slug: ${escapeHtml(u.slug)}</small>
        </div>
        <div>
          ${u.is_current
            ? '<span style="color:#666;font-size:13px;">Unidade selecionada</span>'
            : `<button type="button" class="subtle-button select-unit-btn" data-unit-id="${u.id}">Usar esta unidade</button>`
          }
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.select-unit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const unitId = btn.dataset.unitId;
        if(!unitId) return;
        try {
          await api(`/api/units/${unitId}/select`, { method: 'PATCH' });
          await refreshActiveViews();
        } catch(err) {
          alert(err.message);
        }
      });
    });
  } catch(e) {
    container.innerHTML = '<p>Erro ao carregar unidades.</p>';
  }
}

// Carregar Configurações na aba Preferências
async function loadSettingsPage() {
  try {
    const data = await api('/api/settings');
    document.getElementById('cfg-company-name').value = data.company.name || '';
    document.getElementById('cfg-company-slug').value = data.company.slug || '';
    document.getElementById('cfg-business-phone').value = data.preferences.business_phone || '';
    document.getElementById('cfg-open-hour').value = data.preferences.open_hour || '08:00';
    document.getElementById('cfg-close-hour').value = data.preferences.close_hour || '20:00';
    document.getElementById('cfg-share-catalog').checked = !!data.preferences.share_catalog_across_units;
    document.getElementById('cfg-allow-overbooking').checked = !!data.preferences.allow_overbooking;
    document.getElementById('cfg-user-name').value = data.user.name || '';
    document.getElementById('cfg-user-email').value = data.user.email || '';
    document.getElementById('cfg-new-password').value = '';

    document.getElementById('cfg-plan-name').textContent = data.subscription.plan_name || 'Assinatura Base';
    const extraText = data.subscription.extra_units > 0
      ? ` + ${data.subscription.extra_units} unidade(s) adicional(is)`
      : '';
    document.getElementById('cfg-plan-summary').textContent =
      `Unidades ativas: ${data.subscription.active_units} (${data.subscription.included_units} incluída na assinatura base${extraText}).`;
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
  try {
    const payload = {
      company_name: document.getElementById('cfg-company-name').value,
      business_phone: document.getElementById('cfg-business-phone').value,
      open_hour: document.getElementById('cfg-open-hour').value,
      close_hour: document.getElementById('cfg-close-hour').value,
      share_catalog_across_units: document.getElementById('cfg-share-catalog').checked,
      allow_overbooking: document.getElementById('cfg-allow-overbooking').checked,
      user_name: document.getElementById('cfg-user-name').value,
      new_password: document.getElementById('cfg-new-password').value,
    };
    const res = await api('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    if (res.user_name) {
      document.getElementById('user-name').textContent = res.user_name;
      document.getElementById('welcome-user-name').textContent = res.user_name.split(' ')[0];
      const initialsText = res.user_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      document.getElementById('user-avatar').textContent = initialsText;
      document.getElementById('top-user-avatar').textContent = initialsText;
    }
    await refreshActiveViews();
    alert('Configurações salvas com sucesso!');
  } catch (err) {
    alert(err.message);
  }
});

// Controle do Modal de Unidades (Injeção Dinâmica)
const unitModal = document.createElement('div');
unitModal.className = 'modal-backdrop';
unitModal.id = 'unitModal';
unitModal.innerHTML = `
  <div class="modal">
    <button class="modal-close" id="closeUnitModal">×</button>
    <p class="eyebrow">REDE</p>
    <h2>Nova Unidade</h2>
    <p class="subheading">Cadastre uma nova filial ou espaço de atendimento.</p>
    <form id="unitForm">
      <label>Nome da unidade<input required id="unit-name" placeholder="Ex: Unidade Bairro Fundinho"></label>
      <label style="margin-top: 10px; display: block;">Cidade<input id="unit-city" placeholder="Ex: Uberlândia" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;"></label>
      <label style="margin-top: 10px; display: block;">Identificador / Slug (Opcional)<input id="unit-slug" placeholder="Ex: studio-lumiere-fundinho" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;"></label>
      <button class="primary-button modal-submit" type="submit" style="margin-top: 15px;">Salvar unidade</button>
    </form>
  </div>
`;
document.body.appendChild(unitModal);

document.getElementById('openUnitModal')?.addEventListener('click', () => unitModal.classList.add('open'));
document.getElementById('closeUnitModal')?.addEventListener('click', () => unitModal.classList.remove('open'));
unitModal.addEventListener('click', e => { if(e.target === unitModal) unitModal.classList.remove('open'); });

document.getElementById('unitForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('unit-name').value;
  const city = document.getElementById('unit-city').value;
  const slug = document.getElementById('unit-slug').value;
  try {
    await api('/api/units', {
      method: 'POST',
      body: JSON.stringify({ name, city, slug })
    });
    unitModal.classList.remove('open');
    e.target.reset();
    await refreshActiveViews();
    alert('Unidade cadastrada com sucesso!');
  } catch(err) {
    alert(err.message);
  }
});

// Controle do Modal de Profissionais
const proModal = document.createElement('div');
proModal.className = 'modal-backdrop';
proModal.id = 'proModal';
proModal.innerHTML = `
  <div class="modal">
    <button class="modal-close" id="closeProModal">×</button>
    <p class="eyebrow">GESTÃO DE PESSOAS</p>
    <h2>Adicionar Profissional</h2>
    <p class="subheading">Cadastre um novo membro para sua equipe.</p>
    <form id="proForm">
      <label>Nome do profissional<input required id="pro-name" placeholder="Ex: Carlos Silva"></label>
      <label style="margin-top: 10px; display: block;">Especialidade<input id="pro-specialty" placeholder="Ex: Barbeiro / Especialista em cor" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;"></label>
      <button class="primary-button modal-submit" type="submit" style="margin-top: 15px;">Salvar profissional</button>
    </form>
  </div>
`;
document.body.appendChild(proModal);

document.getElementById('openProModal')?.addEventListener('click', () => proModal.classList.add('open'));
document.getElementById('closeProModal')?.addEventListener('click', () => proModal.classList.remove('open'));
proModal.addEventListener('click', e => { if(e.target === proModal) proModal.classList.remove('open'); });

document.getElementById('proForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('pro-name').value;
  const specialty = document.getElementById('pro-specialty').value;
  try {
    await api('/api/professionals', {
      method: 'POST',
      body: JSON.stringify({ name, specialty })
    });
    proModal.classList.remove('open');
    e.target.reset();
    loadProfessionalsPage();
    loadDashboard();
    alert('Profissional cadastrado com sucesso!');
  } catch(err) {
    alert(err.message);
  }
});

// Controle do Modal de Serviços (Injeção Dinâmica)
const serviceModal = document.createElement('div');
serviceModal.className = 'modal-backdrop';
serviceModal.id = 'serviceModal';
serviceModal.innerHTML = `
  <div class="modal">
    <button class="modal-close" id="closeServiceModal">×</button>
    <p class="eyebrow">CATÁLOGO</p>
    <h2>Novo Serviço</h2>
    <p class="subheading">Cadastre um novo serviço, duração e preço.</p>
    <form id="serviceForm">
      <label>Nome do serviço<input required id="service-name" placeholder="Ex: Corte e Escova"></label>
      <div class="form-two" style="margin-top: 10px;">
        <label>Duração (minutos)<input type="number" id="service-duration" value="45" required style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;"></label>
        <label>Preço (R$)<input type="number" step="0.01" id="service-price" value="95.00" required style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;"></label>
      </div>
      <button class="primary-button modal-submit" type="submit" style="margin-top: 15px;">Salvar serviço</button>
    </form>
  </div>
`;
document.body.appendChild(serviceModal);

document.getElementById('openServiceModal')?.addEventListener('click', () => serviceModal.classList.add('open'));
document.getElementById('closeServiceModal')?.addEventListener('click', () => serviceModal.classList.remove('open'));
serviceModal.addEventListener('click', e => { if(e.target === serviceModal) serviceModal.classList.remove('open'); });

document.getElementById('serviceForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('service-name').value;
  const duration_minutes = Number(document.getElementById('service-duration').value);
  const price = Number(document.getElementById('service-price').value);
  try {
    await api('/api/services', {
      method: 'POST',
      body: JSON.stringify({ name, duration_minutes, price })
    });
    serviceModal.classList.remove('open');
    e.target.reset();
    loadServicesPage();
    alert('Serviço cadastrado com sucesso!');
  } catch(err) {
    alert(err.message);
  }
});

// Carregar Clientes na aba Relacionamento
async function loadClientsPage() {
  const container = document.getElementById('client-list-container');
  if(!container) return;
  try {
    const clients = await api('/api/clients');
    if(clients.length === 0) {
      container.innerHTML = '<p>Nenhum cliente cadastrado. Clique em "Novo cliente".</p>';
      return;
    }
    container.innerHTML = clients.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #eee;">
        <div>
          <b>${escapeHtml(c.name)}</b><br>
          <small style="color:#666;">📱 ${escapeHtml(c.phone)} ${c.email ? '· ✉️ ' + escapeHtml(c.email) : ''}</small>
        </div>
        <span class="tag" style="background:#eef; color:#339; padding:4px 8px; border-radius:4px; font-size:11px;">Ativo</span>
      </div>
    `).join('');
  } catch(e) {
    container.innerHTML = '<p>Erro ao carregar clientes.</p>';
  }
}

// Controle do Modal de Clientes (Injeção Dinâmica)
const clientModal = document.createElement('div');
clientModal.className = 'modal-backdrop';
clientModal.id = 'clientModal';
clientModal.innerHTML = `
  <div class="modal">
    <button class="modal-close" id="closeClientModal">×</button>
    <p class="eyebrow">RELACIONAMENTO</p>
    <h2>Novo Cliente</h2>
    <p class="subheading">Cadastre o contato para futuros envios de WhatsApp.</p>
    <form id="clientForm">
      <label>Nome completo<input required id="client-name" placeholder="Ex: Ana Souza"></label>
      <label style="margin-top: 10px; display: block;">Telefone / WhatsApp<input required id="client-phone" placeholder="Ex: (34) 99999-9999" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;"></label>
      <label style="margin-top: 10px; display: block;">E-mail (Opcional)<input type="email" id="client-email" placeholder="ana@email.com" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;"></label>
      <button class="primary-button modal-submit" type="submit" style="margin-top: 15px;">Salvar cliente</button>
    </form>
  </div>
`;
document.body.appendChild(clientModal);

document.querySelectorAll('button').forEach(btn => {
  if(btn.textContent.includes('Novo cliente')) {
    btn.addEventListener('click', () => clientModal.classList.add('open'));
  }
});
document.getElementById('closeClientModal')?.addEventListener('click', () => clientModal.classList.remove('open'));
clientModal.addEventListener('click', e => { if(e.target === clientModal) clientModal.classList.remove('open'); });

document.getElementById('clientForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('client-name').value;
  const phone = document.getElementById('client-phone').value;
  const email = document.getElementById('client-email').value;
  try {
    await api('/api/clients', {
      method: 'POST',
      body: JSON.stringify({ name, phone, email })
    });
    clientModal.classList.remove('open');
    e.target.reset();
    loadClientsPage();
    alert('Cliente cadastrado com sucesso!');
  } catch(err) {
    alert(err.message);
  }
});

document.getElementById('logoutButton')?.addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'});location.href='/login';}catch(e){alert(e.message);}});