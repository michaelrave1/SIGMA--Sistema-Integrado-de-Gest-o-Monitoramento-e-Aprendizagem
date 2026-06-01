# EduRede Integrada

Plataforma local de gestao escolar inspirada no i-Educar e preparada para integrar modulos externos da rede, incluindo biblioteca escolar, Mesario e novos sistemas administrativos/pedagogicos.

## Como abrir

Rode um servidor local simples dentro desta pasta:

```bash
npm install
npm start
```

Depois acesse `http://127.0.0.1:4173`.

## Modulos prontos nesta versao

- Painel geral da rede com alertas de frequencia, aprendizagem e integracoes.
- Gestao de sala de aula com turmas, professor, turno, sala e vagas.
- Cadastro de alunos, responsaveis, servicos e vinculo com biblioteca.
- Matriculas e pre-matriculas com origem, status e atualizacao de turma.
- Frequencia diaria com presenca, falta, atraso e observacoes para busca ativa.
- Avaliacoes, notas, recuperacao e boletins por componente curricular.
- Biblioteca integrada com acervo, disponibilidade e emprestimos para alunos.
- Mesario integrado para processos de votacao/consulta escolar.
- Hub de integracoes para i-Educar, biblioteca, Mesario, transporte, merenda e futuros sistemas.
- Relatorios por unidade com exportacao CSV.
- Persistencia local via `localStorage` e sincronizacao opcional via Firebase.

## Firebase

O estado compartilhado da aplicacao e salvo no Firestore em `gestao-escolar/estado-geral`.

Se a conexao falhar, a aplicacao continua funcionando localmente e mostra o status no topo.

## Deploy no Firebase

O projeto ja esta configurado para Firebase Hosting, Firestore Rules e Realtime Database Rules:

- Projeto Firebase: `i-educar-4758a`
- Hosting public: raiz desta pasta
- Firestore document: `gestao-escolar/estado-geral`
- Realtime Database path: `gestao-escolar/estado-geral`
- Regras: `firestore.rules`
- Regras RTDB: `database.rules.json`

Deploy local:

```bash
npm install
npm run check
npm run deploy
```

## Deploy pelo GitHub

O workflow `.github/workflows/firebase-deploy.yml` publica automaticamente no Firebase quando houver push na branch `main` ou `master`.

Antes do primeiro deploy, crie no GitHub o secret:

```text
FIREBASE_SERVICE_ACCOUNT_I_EDUCAR_4758A
```

O valor deve ser o JSON completo de uma service account do Firebase/GCP com permissao para Firebase Hosting, Firestore Rules e Realtime Database Rules no projeto `i-educar-4758a`.

No Firebase Console/GCP:

1. Acesse o projeto `i-educar-4758a`.
2. Crie ou selecione uma service account para deploy.
3. Gere uma chave JSON.
4. Cole o JSON inteiro em `GitHub > Settings > Secrets and variables > Actions > New repository secret`.

## Proximas etapas recomendadas

- Criar autenticacao por perfil: secretaria, gestor, professor, biblioteca, mesario e responsavel.
- Separar APIs por dominio para conectar com uma instalacao real do i-Educar.
- Trocar a regra publica de prototipo por regras com autenticacao por unidade e perfil.
- Criar telas especificas para historico escolar, calendario letivo, transporte, merenda e comunicacao com familias.
