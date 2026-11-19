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
  if(id==='equipe') loadProfessionalsPage();
  if(id==='servicos') loadServicesPage();
  if(id==='clientes') loadClientsPage();

  window.scrollTo({top:0,behavior:'smooth'});
}

navButtons.forEach(button=>button.addEventListener('click',()=>showPage(button.dataset.view)));
document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>showPage(button.dataset.go)));
document.getElementById('mobileMenu').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));

function money(value){return Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});}
function setStat(label, value){const card=[...document.querySelectorAll('.stat-card')].find(c=>c.querySelector('.stat-top')?.innerText.includes(label));if(card)card.querySelector('strong').textContent=value;}

async function loadDashboard(){
    const data=await api('/api/dashboard');
    setStat('Agendamentos hoje',data.appointments_today);
    setStat('Em atendimento',String(data.in_progress).padStart(2,'0'));
    setStat('Faturamento previsto',money(data.revenue_completed));
    setStat('Confirmações pendentes',String(data.pending).padStart(2,'0'));
    
    try {
        const team = await api('/api/professionals');
        const teamContainer = document.getElementById('team-container');
        if(teamContainer) {
            if(team && team.length > 0) {
                teamContainer.innerHTML = team.map(p => `
                    <div class="team-row">
                        <div class="avatar team-a">${initials(p.name)}</div>
                        <div class="team-info"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.specialty || 'Profissional')}</small></div>
                        <span class="availability"><i></i> Ativo</span>
                    </div>
                `).join('');
            } else {
                teamContainer.innerHTML = '<p class="subheading">Nenhum profissional cadastrado.</p>';
            }
        }
    } catch(err) {
        console.error("Erro ao carregar equipe:", err);
    }

    if(data.company) {
        const compEl = document.getElementById('sidebar-company-name');
        const topCompEl = document.getElementById('top-company-name');
        if(compEl) compEl.textContent = data.company;
        if(topCompEl) topCompEl.textContent = data.company;
    }
    if(data.unit) {
        const unitEl = document.getElementById('sidebar-unit-name');
        const eyebrowEl = document.getElementById('dash-eyebrow');
        if(unitEl) unitEl.textContent = data.unit;
        if(eyebrowEl) eyebrowEl.textContent = `QUARTA-FEIRA · ${data.unit.toUpperCase()}`;
    }

    const list=document.querySelector('.appointment-list');
    if(list){
      list.innerHTML=data.appointments.slice(0,6).map(a=>`<div class="appointment-row"><time>${a.start_at.slice(11,16)}</time><div class="avatar client-a">${initials(a.client)}</div><div class="appointment-info"><b>${escapeHtml(a.client)}</b><small>${escapeHtml(a.service)} · ${escapeHtml(a.professional)}</small></div><span class="status ${statusClass(a.status)}">${statusLabel(a.status)}</span></div>`).join('') || '<p class="subheading">Nenhum agendamento para hoje.</p>';
    }
}

// Inicialização segura ao carregar a página
(async()=>{
    try {
        const user = await api('/api/me');
        if(user && user.name) {
            document.getElementById('user-name').textContent = user.name;
            document.getElementById('welcome-user-name').textContent = user.name.split(' ')[0];
            const initialsText = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            document.getElementById('user-avatar').textContent = initialsText;
            document.getElementById('top-user-avatar').textContent = initialsText; 
            document.getElementById('user-role').textContent = user.role === 'manager' ? 'Administrador(a)' : 'Funcionário(a)';
        }
        await loadDashboard();
    } catch(e) {
        console.error(e);
    }
})();

async function loadKanban(){
  const appointments=await api('/api/appointments');
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

    const date = new Date().toISOString().slice(0,10);
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
    alert('Agendamento salvo no banco de dados!');
  }catch(err){alert(err.message);}
});

async function populateBookingModal() {
  try {
    const catalog = await api('/api/admin/catalog');
    const serviceSelect = document.getElementById('modal-service-select');
    const professionalSelect = document.getElementById('modal-professional-select');
    
    if (serviceSelect) {
      serviceSelect.innerHTML = catalog.services && catalog.services.length > 0 
        ? catalog.services.map(s => `<option value="${s.id}">${s.name} - R$ ${s.price}</option>`).join('') 
        : '<option value="">Nenhum serviço cadastrado na empresa</option>';
    }
    
    if (professionalSelect) {
      professionalSelect.innerHTML = catalog.professionals && catalog.professionals.length > 0 
        ? catalog.professionals.map(p => `<option value="${p.id}">${p.name} (${p.specialty || 'Geral'})</option>`).join('') 
        : '<option value="">Nenhum profissional cadastrado na empresa</option>';
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
      container.innerHTML = '<p>Nenhum profissional cadastrado. Clique em "Adicionar profissional".</p>';
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
      container.innerHTML = '<p>Nenhum serviço cadastrado. Clique em "Novo serviço".</p>';
      return;
    }
    container.innerHTML = services.map(s => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;"><b>${escapeHtml(s.name)}</b><span>${s.duration_minutes} min — R$ ${s.price}</span></div>`).join('');
  } catch(e) {
    container.innerHTML = '<p>Erro ao carregar serviços.</p>';
  }
}

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