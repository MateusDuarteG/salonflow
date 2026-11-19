document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = document.getElementById('loginError');
  error.textContent = '';
  try {
    const response = await fetch('/api/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({email: document.getElementById('email').value, password: document.getElementById('password').value})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível entrar.');
    location.href = '/';
  } catch (e) { error.textContent = e.message; }
});