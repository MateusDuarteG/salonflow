const steps=[...document.querySelectorAll('.booking-step')];
const indicators=[...document.querySelectorAll('.booking-progress .step')];
let catalog=null;
async function loadCatalog(){
  try{
    const response=await fetch('/api/public/catalog?unit=studio-lumiere-centro');
    catalog=await response.json();
    if(!response.ok)throw new Error(catalog.error||'Não foi possível carregar a unidade.');
    const serviceContainer=document.querySelector('[data-step="1"]');
    const serviceInputs=[...serviceContainer.querySelectorAll('input[name="service"]')];
    serviceInputs.forEach(input=>{
      const service=catalog.services.find(s=>s.name===input.value);
      if(service)input.dataset.serviceId=service.id;
    });
    const proContainer=document.querySelector('[data-step="2"]');
    const proInputs=[...proContainer.querySelectorAll('input[name="professional"]')];
    proInputs.forEach(input=>{
      if(input.value==='Sem preferência')return;
      const pro=catalog.professionals.find(p=>p.name===input.value);
      if(pro)input.dataset.professionalId=pro.id;
    });
  }catch(e){console.error(e);}
}
function goStep(n){steps.forEach(s=>s.classList.toggle('hidden',Number(s.dataset.step)!==n));indicators.forEach((s,i)=>s.classList.toggle('active',i<n));}
document.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>goStep(Number(b.dataset.next))));
document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>goStep(Number(b.dataset.back))));
const dateInput=document.getElementById('clientDate');
if(dateInput){const d=new Date();d.setDate(d.getDate()+1);const iso=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);dateInput.min=iso;dateInput.value=iso;}
document.getElementById('confirmBooking').addEventListener('click',async()=>{
 const name=document.getElementById('clientName').value.trim();
 const phone=document.getElementById('clientPhone').value.trim();
 if(!name||!phone){alert('Preencha seu nome e WhatsApp para continuar.');return;}
 const selectedService=document.querySelector('input[name="service"]:checked');
 const selectedProfessional=document.querySelector('input[name="professional"]:checked');
 const time=document.querySelector('input[name="time"]:checked').value;
 const date=document.getElementById('clientDate').value;
 if(!catalog){await loadCatalog();}
 const serviceId=Number(selectedService.dataset.serviceId);
 const professionalId=selectedProfessional.dataset.professionalId ? Number(selectedProfessional.dataset.professionalId) : null;
 if(!serviceId){alert('Não foi possível identificar o serviço. Atualize a página e tente novamente.');return;}
 const button=document.getElementById('confirmBooking');button.disabled=true;button.textContent='Enviando...';
 try{
   const response=await fetch('/api/public/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
     unit_slug:'studio-lumiere-centro',client_name:name,phone,service_id:serviceId,
     professional_id:professionalId,start_at:`${date}T${time}:00`
   })});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Não foi possível solicitar o agendamento.');
   document.querySelectorAll('.booking-step').forEach(s=>s.classList.add('hidden'));
   document.querySelector('.booking-progress').classList.add('hidden');
   document.getElementById('successSummary').innerHTML=`<b>Cliente:</b> ${escapeHtml(name)}<br><b>Serviço:</b> ${escapeHtml(selectedService.value)}<br><b>Profissional:</b> ${escapeHtml(selectedProfessional.value)}<br><b>Data:</b> ${escapeHtml(date)} às ${escapeHtml(time)}<br><b>Status:</b> Aguardando confirmação`;
   document.getElementById('bookingSuccess').classList.remove('hidden');
 }catch(e){alert(e.message);}finally{button.disabled=false;button.textContent='Confirmar agendamento';}
});
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
loadCatalog();
