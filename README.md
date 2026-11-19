# 🚀 SalonFlow | Gestão Inteligente Multi-Tenant

Sistema de gestão e agendamentos voltado para salões de beleza e barbearias, desenvolvido com arquitetura **Multi-Tenant** robusta para isolamento completo de dados por empresa/unidade.

---

## 🛠️ Tecnologias Utilizadas

* **Backend:** Python, Flask, Flask-SQLAlchemy, SQLite / PostgreSQL
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla Async/Await)
* **Segurança:** Autenticação baseada em sessão com hash de senhas (`Werkzeug`)

---

## ✨ Funcionalidades Desenvolvidas (Até o Momento)

* **🏢 Registro e Isolamento Multi-Tenant:** Cadastro automatizado de novas empresas e unidades matrizes, garantindo que cada salão nasça 100% limpo, sem dados de demonstração cruzados.
* **👥 Gestão de Profissionais:** Cadastro, listagem e vinculação de colaboradores exclusivos por empresa.
* **✳️ Catálogo de Serviços:** Gerenciamento dinâmico de serviços, tempos de duração e preços praticados por cada estabelecimento.
* **📱 Relacionamento com Clientes:** Base de clientes integrada focada em futuros disparos de campanhas e lembretes via WhatsApp/SMS.
* **📅 Agendamento Dinâmico:** Módulos de reservas conectados em tempo real ao catálogo e à equipe cadastrada pelo próprio lojista.

---

## ⚙️ Como Executar o Projeto Localmente

1. **Clone o repositório:**
   ```bash
   git clone [https://github.com/SEU-USUARIO/salonflow.git](https://github.com/SEU-USUARIO/salonflow.git)
   cd salonflow

   Crie e ative um ambiente virtual:

Bash
python -m venv .venv
# No Windows:
.venv\Scripts\activate
# No Linux/Mac:
source .venv/bin/activate
Instale as dependências:

Bash
pip install -r requirements.txt
Configure as variáveis de ambiente:
Crie um arquivo .env na raiz do projeto baseando-se no .env.example.

Inicie a aplicação:

Bash
python app.py
Acesse no navegador:
Abra http://127.0.0.1:5000
