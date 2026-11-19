# SalonFlow v0.2 — Backend integrado

## O que já está conectado
- Flask + SQLAlchemy.
- SQLite local por padrão; PostgreSQL via `DATABASE_URL`.
- Login administrativo com sessão.
- Separação inicial por empresa (`company_id`) nas consultas administrativas.
- API de dashboard e listagem de agendamentos.
- Criação e atualização de status dos agendamentos.
- Kanban com cartões arrastáveis entre colunas e persistência de status.
- Agendamento público do cliente gravado no banco.
- Dados de demonstração criados automaticamente na primeira execução.

## Executar localmente
Recomendado Python 3.11 ou superior.

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env
python app.py
```

Acesse:
- Painel: http://127.0.0.1:5000/
- Login: http://127.0.0.1:5000/login
- Agendamento público: http://127.0.0.1:5000/agendar
- Health check: http://127.0.0.1:5000/api/health

## Conta de demonstração
- E-mail: `admin@salonflow.test`
- Senha: `SalonFlow@2026`

Troque/remova essa conta e a senha antes de qualquer publicação.

## PostgreSQL
Configure `DATABASE_URL` no `.env`, por exemplo:
`postgresql+psycopg://usuario:senha@localhost:5432/salonflow`

Para impedir sobreposição de horários também em operações simultâneas, execute o SQL de `postgres_constraints.sql` no PostgreSQL depois da criação das tabelas. A checagem Python já bloqueia conflitos comuns; a constraint é a proteção adicional no banco.

## Limitações importantes desta versão
- O fluxo público grava a solicitação como `requested`; ainda não envia WhatsApp/e-mail.
- A seleção "Sem preferência" escolhe o primeiro profissional ativo; a disponibilidade inteligente será implementada na próxima etapa.
- Os horários são tratados como horário local simples, sem configuração de fuso por unidade.
- A tela de agenda, clientes, equipe, serviços e unidades ainda é estrutural/prototípica.
- O seed cria uma empresa e uma unidade de demonstração. O modelo de dados já inclui `company_id`, mas faltam telas e endpoints completos para superadministrador, cadastro de empresas e gestão de usuários.
- A criação de tabelas usa `db.create_all()` para facilitar o primeiro teste. Antes de produção, adotaremos Flask-Migrate/Alembic.
- Adicionar CSRF, rate limiting, política de senha, recuperação de senha, auditoria, testes automatizados e revisão de segurança antes de expor publicamente.

## Rotas principais
- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`
- `GET /api/dashboard`
- `GET /api/appointments`
- `POST /api/appointments`
- `PATCH /api/appointments/<id>`
- `GET /api/public/catalog?unit=studio-lumiere-centro`
- `POST /api/public/bookings`
