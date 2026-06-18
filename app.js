import { fetchRemoteState, persistRemoteState, subscribeRemoteState } from "./firebase-service.js";

const STORAGE_KEY = "edurede-gestao-escolar-v1";

const today = new Date("2026-05-26T12:00:00");
const state = loadState();
let isApplyingRemoteState = false;
let unsubscribeRemoteState = null;
let syncStatus = "Preparando Firebase";
let syncStatusType = "";
let activeRoute = "dashboard";
let activeUnit = "all";
let query = "";
let statusFilter = "all";

const SCHOOL_UNIT_NAMES = [
  "E. M. Adolfo Bezerra de Menezes",
  "E. M. Arthur de Mello Teixeira",
  "E. M. Boa Vista",
  "E. M. Celina Soares de Paiva",
  "E. M. Doutor Aluizio Rosa Prata",
  "E. M. Frederico Peiro",
  "E. M. Gastao Mesquita Filho",
  "E. M. Joaozinho e Maria",
  "E. M. Jose Marcus Cherem",
  "E. M. Joubert de Carvalho",
  "E. M. Madre Maria Georgina",
  "E. M. Maria Carolina Mendes",
  "E. M. Maria Lourencina Palmerio",
  "E. M. Monteiro Lobato",
  "E. M. Norma Sueli Borges",
  "E. M. Padre Eddie Bernardes",
  "E. M. Pequeno Principe",
  "E. M. Prof. Anisio Teixeira",
  "E. M. Prof. Jose Geraldo Guimaraes",
  "E. M. Prof. Jose Macciotti",
  "CEMEI Angela Beatriz Bonadio Alves",
  "CEMEI Integracao",
  "CEMEI Joao Miguel Hueb",
  "CEMEI Maria de Nazare",
  "CEMEI Paraiso",
];

const routes = [
  ["dashboard", "Painel", "Painel geral"],
  ["classrooms", "Sala de aula", "Gestao de sala"],
  ["students", "Alunos", "Alunos e responsaveis"],
  ["enrollments", "Matriculas", "Matriculas e vagas"],
  ["attendance", "Frequencia", "Frequencia diaria"],
  ["grades", "Notas", "Avaliacoes e boletins"],
  ["library", "Biblioteca", "Biblioteca integrada"],
  ["mesario", "Mesario", "Processos de mesario"],
  ["integrations", "Integracoes", "Barramento de sistemas"],
  ["profiles", "Perfis", "Gestor de perfis"],
  ["reports", "Relatorios", "Indicadores da rede"],
];

const initialRoute = location.hash.replace("#", "");
if (routes.some((route) => route[0] === initialRoute)) {
  activeRoute = initialRoute;
}

const INTEGRATION_APPS = [
  ["i-educar", "Cadastro academico, matriculas, turmas, regras e historico", "Conectado", "API REST", "students"],
  ["Biblioteca escolar", "Acervo, emprestimos, reservas e multas", "Conectado", "Firebase/REST", "library"],
  ["Mesario", "Eleicoes escolares, consultas e atas digitais", "Pronto para homologar", "Webhook", "mesario"],
  ["Transporte escolar", "Rotas, passageiros e presenca no embarque", "Planejado", "Fila de eventos", "students"],
  ["Merenda", "Cardapio, consumo e restricoes alimentares", "Planejado", "Fila de eventos", "reports"],
  ["Portal do professor", "Diario de classe, frequencia e avaliacoes", "Planejado", "API REST", "attendance"],
  ["Portal da familia", "Comunicados, boletins e acompanhamento do aluno", "Planejado", "Firebase/REST", "students"],
  ["Almoxarifado", "Estoque, solicitacoes e patrimonio escolar", "Planejado", "Fila de eventos", "reports"],
  ["Financeiro escolar", "Taxas, repasses, contratos e prestacao de contas", "Planejado", "API REST", "reports"],
  ["Gestor de perfis", "Perfis, permissoes e acessos por sistema", "Conectado", "Controle interno", "profiles"],
  ["Relatorios", "Indicadores, auditoria e exportacoes da rede", "Conectado", "Modulo interno", "reports"],
];

const PROFILE_CATALOG = [
  ["Administrador geral", "Global", "Todos os sistemas", "Ativo", 4, ["i-educar", "Biblioteca escolar", "Mesario", "Transporte escolar", "Merenda", "Portal do professor", "Portal da familia", "Almoxarifado", "Financeiro escolar", "Gestor de perfis", "Relatorios"]],
  ["Secretaria escolar", "Unidade escolar", "i-educar", "Ativo", 18, ["i-educar", "Portal da familia", "Relatorios"]],
  ["Gestor escolar", "Unidade escolar", "Gestao pedagogica", "Ativo", 25, ["i-educar", "Portal do professor", "Biblioteca escolar", "Merenda", "Relatorios"]],
  ["Professor", "Turma", "Sala de aula", "Ativo", 126, ["Portal do professor", "i-educar"]],
  ["Biblioteca", "Unidade escolar", "Acervo e circulacao", "Ativo", 22, ["Biblioteca escolar", "i-educar"]],
  ["Mesario", "Processo eleitoral", "Votacoes e atas", "Homologacao", 9, ["Mesario", "i-educar"]],
  ["Responsavel familiar", "Aluno", "Acompanhamento", "Planejado", 640, ["Portal da familia", "Biblioteca escolar"]],
  ["Auditoria", "Rede", "Consulta e relatorios", "Ativo", 3, ["Relatorios", "i-educar", "Financeiro escolar"]],
];

function makeUnits() {
  return SCHOOL_UNIT_NAMES.map((name, index) => {
    const i = index + 1;
    return {
      id: `u${String(i).padStart(2, "0")}`,
      name,
      type: name.startsWith("CEMEI") ? "Educacao infantil" : "Ensino fundamental",
      city: i % 5 === 0 ? "Zona rural" : "Zona urbana",
      manager: `Gestor ${String(i).padStart(2, "0")}`,
      status: i % 11 === 0 ? "Em acompanhamento" : "Ativa",
    };
  });
}

function seedData() {
  const units = makeUnits();
  const classes = [
    ["1A", "1 ano A", "Fundamental I", "Manha", "Livia Andrade", "Sala 01"],
    ["2B", "2 ano B", "Fundamental I", "Tarde", "Marco Silva", "Sala 04"],
    ["4A", "4 ano A", "Fundamental I", "Manha", "Renata Lopes", "Sala 08"],
    ["6A", "6 ano A", "Fundamental II", "Manha", "Paula Martins", "Sala 12"],
    ["7B", "7 ano B", "Fundamental II", "Tarde", "Bruno Costa", "Sala 15"],
    ["EI3", "Maternal III", "Educacao infantil", "Integral", "Carla Nunes", "Sala Infancia"],
  ].map((item, index) => ({
    id: `c${index + 1}`,
    unitId: units[index % units.length].id,
    code: item[0],
    name: item[1],
    stage: item[2],
    shift: item[3],
    teacher: item[4],
    room: item[5],
    seats: 28 + index * 2,
  }));

  const students = Array.from({ length: 36 }, (_, index) => {
    const classroom = classes[index % classes.length];
    return {
      id: `s${index + 1}`,
      registration: `2026${String(index + 1).padStart(4, "0")}`,
      name: `Aluno ${String(index + 1).padStart(2, "0")}`,
      birthDate: `${2011 + (index % 7)}-${String((index % 9) + 1).padStart(2, "0")}-15`,
      guardian: `Responsavel ${String(index + 1).padStart(2, "0")}`,
      phone: `(34) 9${String(82000000 + index * 137).slice(0, 8)}`,
      unitId: classroom.unitId,
      classId: classroom.id,
      status: index % 17 === 0 ? "Acompanhamento" : "Ativo",
      transport: index % 4 === 0,
      libraryBlocked: index % 23 === 0,
    };
  });

  const enrollments = students.map((student, index) => ({
    id: `m${index + 1}`,
    studentId: student.id,
    unitId: student.unitId,
    classId: student.classId,
    requestDate: addDays(today, -35 + index).toISOString().slice(0, 10),
    status: index % 12 === 0 ? "Pendente" : "Matriculado",
    origin: index % 5 === 0 ? "Pre-matricula digital" : "Secretaria escolar",
  }));

  const attendance = students.slice(0, 18).map((student, index) => ({
    id: `f${index + 1}`,
    studentId: student.id,
    unitId: student.unitId,
    classId: student.classId,
    date: addDays(today, -(index % 8)).toISOString().slice(0, 10),
    status: index % 7 === 0 ? "Falta" : index % 5 === 0 ? "Atraso" : "Presenca",
    note: index % 7 === 0 ? "Familia sera acionada pela busca ativa." : "",
  }));

  const grades = students.slice(0, 20).map((student, index) => ({
    id: `n${index + 1}`,
    studentId: student.id,
    unitId: student.unitId,
    classId: student.classId,
    subject: ["Lingua portuguesa", "Matematica", "Ciencias", "Historia"][index % 4],
    period: "1 bimestre",
    score: 5.8 + (index % 5) * 0.7,
    recovery: index % 9 === 0,
  }));

  const libraryBooks = [
    ["O Pequeno Principe", "Antoine de Saint-Exupery", "Literatura"],
    ["Capitaes da Areia", "Jorge Amado", "Literatura brasileira"],
    ["A Bolsa Amarela", "Lygia Bojunga", "Infantojuvenil"],
    ["Matematica em Historias", "Maria Ribeiro", "Didatico"],
    ["Ciencias da Natureza", "Equipe Escolar", "Didatico"],
    ["Atlas Escolar do Brasil", "IBGE Educativo", "Referencia"],
  ].map((book, index) => ({
    id: `b${index + 1}`,
    title: book[0],
    author: book[1],
    category: book[2],
    unitId: units[index % units.length].id,
    copies: 10 + index,
    available: 7 + (index % 3),
    status: index === 4 ? "Manutencao" : "Disponivel",
  }));

  const libraryLoans = libraryBooks.slice(0, 4).map((book, index) => ({
    id: `e${index + 1}`,
    bookId: book.id,
    studentId: students[index + 2].id,
    unitId: book.unitId,
    startDate: addDays(today, -8 - index).toISOString().slice(0, 10),
    dueDate: addDays(today, index === 1 ? -1 : 8 + index).toISOString().slice(0, 10),
    returnedAt: "",
  }));

  const mesarioProcesses = [
    {
      id: "p1",
      unitId: units[0].id,
      title: "Eleicao do conselho escolar",
      status: "Configurando urnas",
      date: "2026-06-10",
      voters: 482,
      progress: 42,
    },
    {
      id: "p2",
      unitId: units[3].id,
      title: "Consulta de uniforme escolar",
      status: "Em votacao",
      date: "2026-05-28",
      voters: 318,
      progress: 67,
    },
  ];

  const integrations = makeDefaultIntegrations();

  return {
    units,
    classes,
    students,
    enrollments,
    attendance,
    grades,
    libraryBooks,
    libraryLoans,
    mesarioProcesses,
    integrations,
    profiles: makeDefaultProfiles(),
    audit: [],
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    return isValidState(parsed) ? normalizeState(parsed) : seedData();
  }
  const data = seedData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

function makeDefaultIntegrations() {
  return INTEGRATION_APPS.map((item, index) => ({
    id: `i${index + 1}`,
    name: item[0],
    description: item[1],
    status: item[2],
    channel: item[3],
    route: item[4],
    lastSync: addDays(today, -index).toISOString().slice(0, 10),
  }));
}

function makeDefaultProfiles() {
  return PROFILE_CATALOG.map((item, index) => ({
    id: `profile-${index + 1}`,
    name: item[0],
    scope: item[1],
    responsibility: item[2],
    status: item[3],
    users: item[4],
    systems: item[5],
    updatedAt: addDays(today, -index).toISOString().slice(0, 10),
  }));
}

function normalizeState(payload) {
  if (!payload.integrations.length) {
    payload.integrations = makeDefaultIntegrations();
  } else {
    payload.integrations = payload.integrations.map((integration) => ({
      ...integration,
      route: integration.route || integrationRoute(integration.name),
    }));
  }
  if (!Array.isArray(payload.profiles) || !payload.profiles.length) {
    payload.profiles = makeDefaultProfiles();
  }
  return payload;
}

function isValidState(payload) {
  return (
    payload &&
    Array.isArray(payload.units) &&
    Array.isArray(payload.classes) &&
    Array.isArray(payload.students) &&
    Array.isArray(payload.enrollments) &&
    Array.isArray(payload.attendance) &&
    Array.isArray(payload.grades) &&
    Array.isArray(payload.libraryBooks) &&
    Array.isArray(payload.libraryLoans) &&
    Array.isArray(payload.mesarioProcesses) &&
    Array.isArray(payload.integrations) &&
    Array.isArray(payload.audit)
  );
}

function saveState(message) {
  if (message) {
    state.audit.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      message,
    });
    state.audit = state.audit.slice(0, 30);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!isApplyingRemoteState) {
    setSyncStatus("Salvando no Firebase", "");
    persistRemoteState(state)
      .then(() => setSyncStatus("Firebase sincronizado", ""))
      .catch(() => setSyncStatus("Salvo localmente", "local"));
  }
  render();
}

function replaceState(nextState) {
  isApplyingRemoteState = true;
  nextState = normalizeState(nextState);
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, nextState);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  isApplyingRemoteState = false;
}

function setSyncStatus(message, type = "") {
  syncStatus = message;
  syncStatusType = type;
  const element = document.querySelector("#sync-status");
  if (!element) return;
  element.textContent = message;
  element.className = `sync-status ${type}`.trim();
}

async function initializeFirebaseSync() {
  try {
    const remoteState = await fetchRemoteState();
    if (isValidState(remoteState)) {
      replaceState(remoteState);
      setSyncStatus("Firebase conectado", "");
      render();
    } else {
      await persistRemoteState(state);
      setSyncStatus("Base escolar enviada", "");
    }

    if (unsubscribeRemoteState) unsubscribeRemoteState();
    unsubscribeRemoteState = subscribeRemoteState(
      (remotePayload) => {
        if (!isValidState(remotePayload)) return;
        if (JSON.stringify(state) === JSON.stringify(remotePayload)) return;
        replaceState(remotePayload);
        setSyncStatus("Firebase atualizado", "");
        render();
      },
      () => setSyncStatus("Firebase indisponivel", "error"),
    );
  } catch (error) {
    setSyncStatus("Salvo localmente", "local");
  }
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function unitName(id) {
  return state.units.find((unit) => unit.id === id)?.name || "Unidade nao localizada";
}

function className(id) {
  return state.classes.find((classroom) => classroom.id === id)?.name || "Turma nao localizada";
}

function studentName(id) {
  return state.students.find((student) => student.id === id)?.name || "Aluno nao localizado";
}

function bookName(id) {
  return state.libraryBooks.find((book) => book.id === id)?.title || "Obra nao localizada";
}

function filteredByUnit(items) {
  if (activeUnit === "all") return items;
  return items.filter((item) => item.unitId === activeUnit);
}

function matches(item, keys) {
  if (!query.trim()) return true;
  const text = keys.map((key) => item[key]).join(" ").toLowerCase();
  return text.includes(query.toLowerCase());
}

function renderNav() {
  document.querySelector("#nav").innerHTML = routes
    .map(([id, label]) => `<button class="nav-btn ${id === activeRoute ? "active" : ""}" data-route="${id}">${label}</button>`)
    .join("");
}

function renderUnitFilter() {
  const select = document.querySelector("#unit-filter");
  select.innerHTML = [
    `<option value="all">Toda a rede</option>`,
    ...state.units.map((unit) => `<option value="${unit.id}">${unit.name}</option>`),
  ].join("");
  select.value = activeUnit;
}

function render() {
  renderNav();
  renderUnitFilter();
  setSyncStatus(syncStatus, syncStatusType);
  const route = routes.find((item) => item[0] === activeRoute);
  document.querySelector("#page-title").textContent = route[2];
  const view = document.querySelector("#view");
  const views = {
    dashboard: renderDashboard,
    classrooms: renderClassrooms,
    students: renderStudents,
    enrollments: renderEnrollments,
    attendance: renderAttendance,
    grades: renderGrades,
    library: renderLibrary,
    mesario: renderMesario,
    integrations: renderIntegrations,
    profiles: renderProfiles,
    reports: renderReports,
  };
  view.innerHTML = views[activeRoute]();
  bindViewEvents();
}

function navigateToRoute(route) {
  if (!routes.some((item) => item[0] === route)) return;
  activeRoute = route;
  history.replaceState(null, "", `#${activeRoute}`);
  query = "";
  statusFilter = "all";
  render();
}

function statCards() {
  const units = activeUnit === "all" ? state.units : state.units.filter((unit) => unit.id === activeUnit);
  const students = filteredByUnit(state.students);
  const classes = filteredByUnit(state.classes);
  const pendingEnrollments = filteredByUnit(state.enrollments).filter((item) => item.status === "Pendente").length;
  return `
    <div class="stats">
      <div class="stat"><span>Unidades no recorte</span><strong>${units.length}</strong></div>
      <div class="stat"><span>Alunos ativos</span><strong>${students.filter((item) => item.status === "Ativo").length}</strong></div>
      <div class="stat"><span>Turmas abertas</span><strong>${classes.length}</strong></div>
      <div class="stat"><span>Matriculas pendentes</span><strong>${pendingEnrollments}</strong></div>
    </div>
  `;
}

function renderDashboard() {
  const absences = filteredByUnit(state.attendance).filter((item) => item.status === "Falta");
  const recovery = filteredByUnit(state.grades).filter((item) => item.recovery || item.score < 6);
  const audit = state.audit.slice(0, 6);
  return `
    ${statCards()}
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Softwares da rede</h2>
          <p class="muted">Escolha um sistema para abrir rapidamente.</p>
        </div>
        <button class="ghost" data-route="integrations">Ver todos</button>
      </div>
      ${softwareLauncherGrid()}
    </section>
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Rotina pedagogica</h2><span class="badge ${absences.length ? "bad" : ""}">${absences.length} faltas</span></div>
        <div class="list">
          ${absences.length ? absences.slice(0, 6).map((item) => `
            <div class="loan-row">
              <div><strong>${studentName(item.studentId)}</strong><p class="muted">${className(item.classId)} - ${formatDate(item.date)}</p></div>
              <span class="badge bad">${item.status}</span>
            </div>
          `).join("") : `<div class="empty">Nenhuma falta aberta neste recorte.</div>`}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Aprendizagem</h2><span class="badge warn">${recovery.length} alertas</span></div>
        <div class="list">
          ${recovery.slice(0, 6).map((item) => `
            <div class="list-row">
              <div><strong>${studentName(item.studentId)}</strong><p class="muted">${item.subject} - ${item.period}</p></div>
              <span class="badge ${item.score < 6 ? "bad" : "warn"}">${item.score.toFixed(1)}</span>
            </div>
          `).join("") || `<div class="empty">Sem alertas de aprendizagem.</div>`}
        </div>
      </section>
    </div>
    <section class="panel module-map">
      <div class="panel-head"><h2>Arquitetura integrada</h2><button class="ghost" data-action="new-integration">Novo conector</button></div>
      <div class="cards-grid compact">
        ${state.integrations.map((item) => `
          <article class="item-card">
            <div class="card-top"><h3>${item.name}</h3><span class="badge ${item.status === "Conectado" ? "" : item.status === "Planejado" ? "blue" : "warn"}">${item.status}</span></div>
            <p class="muted">${item.description}</p>
            <p><strong>Canal:</strong> ${item.channel}</p>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="panel" style="margin-top: 18px;">
      <div class="panel-head"><h2>Historico recente</h2></div>
      <div class="list">${audit.length ? audit.map((item) => `<div class="list-row"><span>${item.message}</span><small class="muted">${new Date(item.at).toLocaleString("pt-BR")}</small></div>`).join("") : `<div class="empty">As acoes feitas no sistema aparecerao aqui.</div>`}</div>
    </section>
  `;
}

function renderClassrooms() {
  const classes = filteredByUnit(state.classes).filter((item) => matches(item, ["name", "stage", "shift", "teacher", "room"]));
  return `
    ${toolbar("Buscar turma, professor, etapa ou sala", "Nova turma", "classroom")}
    <section class="panel table-wrap">
      <table>
        <thead><tr><th>Turma</th><th>Unidade</th><th>Professor</th><th>Turno</th><th>Alunos</th><th>Acoes</th></tr></thead>
        <tbody>${classes.map((classroom) => {
          const count = state.students.filter((student) => student.classId === classroom.id).length;
          return `
            <tr>
              <td><strong>${classroom.name}</strong><br><span class="muted">${classroom.stage} - ${classroom.room}</span></td>
              <td>${unitName(classroom.unitId)}</td>
              <td>${classroom.teacher}</td>
              <td>${classroom.shift}</td>
              <td>${count}/${classroom.seats}</td>
              <td><button class="link-btn" data-action="attendance-class" data-id="${classroom.id}">Chamada</button></td>
            </tr>
          `;
        }).join("")}</tbody>
      </table>
    </section>
  `;
}

function renderStudents() {
  const students = filteredByUnit(state.students).filter((item) => matches(item, ["name", "registration", "guardian", "phone", "status"]));
  return `
    ${toolbar("Buscar por nome, matricula, responsavel ou telefone", "Novo aluno", "student")}
    <section class="panel table-wrap">
      <table>
        <thead><tr><th>Aluno</th><th>Turma</th><th>Responsavel</th><th>Servicos</th><th>Status</th><th>Acoes</th></tr></thead>
        <tbody>${students.map((student) => `
          <tr>
            <td><strong>${student.name}</strong><br><span class="muted">Matricula ${student.registration} - nasc. ${formatDate(student.birthDate)}</span></td>
            <td>${className(student.classId)}<br><span class="muted">${unitName(student.unitId)}</span></td>
            <td>${student.guardian}<br><span class="muted">${student.phone}</span></td>
            <td>${student.transport ? "Transporte escolar" : "Sem transporte"}<br>${student.libraryBlocked ? `<span class="badge bad">Biblioteca bloqueada</span>` : `<span class="badge">Biblioteca ativa</span>`}</td>
            <td><span class="badge ${student.status === "Acompanhamento" ? "warn" : ""}">${student.status}</span></td>
            <td><button class="link-btn" data-action="toggle-student" data-id="${student.id}">${student.status === "Ativo" ? "Acompanhar" : "Ativar"}</button></td>
          </tr>
        `).join("")}</tbody>
      </table>
    </section>
  `;
}

function renderEnrollments() {
  const enrollments = filteredByUnit(state.enrollments).filter((item) => statusFilter === "all" || item.status === statusFilter);
  return `
    <div class="toolbar">
      <input id="search" placeholder="Buscar por aluno ou origem" value="${query}">
      <select id="status-filter">
        ${["all", "Matriculado", "Pendente", "Indeferido"].map((item) => `<option value="${item}" ${item === statusFilter ? "selected" : ""}>${item === "all" ? "Todos" : item}</option>`).join("")}
      </select>
      <button class="primary" data-action="new-enrollment">Nova matricula</button>
    </div>
    <section class="panel table-wrap">
      <table>
        <thead><tr><th>Aluno</th><th>Destino</th><th>Solicitacao</th><th>Origem</th><th>Status</th><th>Acoes</th></tr></thead>
        <tbody>${enrollments.filter((item) => `${studentName(item.studentId)} ${item.origin}`.toLowerCase().includes(query.toLowerCase())).map((item) => `
          <tr>
            <td>${studentName(item.studentId)}</td>
            <td>${unitName(item.unitId)}<br><span class="muted">${className(item.classId)}</span></td>
            <td>${formatDate(item.requestDate)}</td>
            <td>${item.origin}</td>
            <td><span class="badge ${item.status === "Pendente" ? "warn" : item.status === "Indeferido" ? "bad" : ""}">${item.status}</span></td>
            <td><button class="link-btn" data-action="advance-enrollment" data-id="${item.id}">Atualizar</button></td>
          </tr>
        `).join("")}</tbody>
      </table>
    </section>
  `;
}

function renderAttendance() {
  const records = filteredByUnit(state.attendance).filter((item) => statusFilter === "all" || item.status === statusFilter);
  return `
    <div class="toolbar">
      <input id="search" placeholder="Buscar por aluno ou turma" value="${query}">
      <select id="status-filter">
        ${["all", "Presenca", "Falta", "Atraso"].map((item) => `<option value="${item}" ${item === statusFilter ? "selected" : ""}>${item === "all" ? "Todos" : item}</option>`).join("")}
      </select>
      <button class="primary" data-action="new-attendance">Registrar frequencia</button>
    </div>
    <section class="panel table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Aluno</th><th>Turma</th><th>Status</th><th>Observacao</th></tr></thead>
        <tbody>${records.filter((item) => `${studentName(item.studentId)} ${className(item.classId)}`.toLowerCase().includes(query.toLowerCase())).map((item) => `
          <tr>
            <td>${formatDate(item.date)}</td>
            <td>${studentName(item.studentId)}</td>
            <td>${className(item.classId)}</td>
            <td><span class="badge ${item.status === "Falta" ? "bad" : item.status === "Atraso" ? "warn" : ""}">${item.status}</span></td>
            <td>${item.note || "-"}</td>
          </tr>
        `).join("")}</tbody>
      </table>
    </section>
  `;
}

function renderGrades() {
  const grades = filteredByUnit(state.grades).filter((item) => matchesGrade(item));
  return `
    ${toolbar("Buscar por aluno, turma ou componente", "Nova avaliacao", "grade")}
    <section class="panel table-wrap">
      <table>
        <thead><tr><th>Aluno</th><th>Componente</th><th>Periodo</th><th>Nota</th><th>Situacao</th></tr></thead>
        <tbody>${grades.map((item) => `
          <tr>
            <td>${studentName(item.studentId)}<br><span class="muted">${className(item.classId)}</span></td>
            <td>${item.subject}</td>
            <td>${item.period}</td>
            <td><strong>${item.score.toFixed(1)}</strong></td>
            <td><span class="badge ${item.recovery || item.score < 6 ? "warn" : ""}">${item.recovery || item.score < 6 ? "Recuperacao" : "Regular"}</span></td>
          </tr>
        `).join("")}</tbody>
      </table>
    </section>
  `;
}

function renderLibrary() {
  const loansLate = filteredByUnit(state.libraryLoans).filter((loan) => !loan.returnedAt && new Date(`${loan.dueDate}T23:59:59`) < today).length;
  return `
    <div class="stats">
      <div class="stat"><span>Obras cadastradas</span><strong>${filteredByUnit(state.libraryBooks).length}</strong></div>
      <div class="stat"><span>Exemplares</span><strong>${filteredByUnit(state.libraryBooks).reduce((sum, book) => sum + book.copies, 0)}</strong></div>
      <div class="stat"><span>Emprestimos ativos</span><strong>${filteredByUnit(state.libraryLoans).filter((loan) => !loan.returnedAt).length}</strong></div>
      <div class="stat"><span>Atrasos</span><strong>${loansLate}</strong></div>
    </div>
    ${toolbar("Buscar obra, autor ou categoria", "Novo livro", "book")}
    <section class="panel table-wrap">
      <table>
        <thead><tr><th>Obra</th><th>Unidade</th><th>Exemplares</th><th>Status</th><th>Acoes</th></tr></thead>
        <tbody>${filteredByUnit(state.libraryBooks).filter((book) => matches(book, ["title", "author", "category"])).map((book) => `
          <tr>
            <td><strong>${book.title}</strong><br><span class="muted">${book.author} - ${book.category}</span></td>
            <td>${unitName(book.unitId)}</td>
            <td>${book.available} disponiveis de ${book.copies}</td>
            <td><span class="badge ${book.status === "Manutencao" ? "warn" : ""}">${book.status}</span></td>
            <td><button class="link-btn" data-action="loan-book" data-id="${book.id}">Emprestar</button></td>
          </tr>
        `).join("")}</tbody>
      </table>
    </section>
  `;
}

function renderMesario() {
  return `
    <section class="panel">
      <div class="panel-head"><h2>Processos do Mesario</h2><button class="primary" data-action="new-mesario">Novo processo</button></div>
      <div class="cards-grid">
        ${filteredByUnit(state.mesarioProcesses).map((process) => `
          <article class="item-card">
            <div class="card-top"><h3>${process.title}</h3><span class="badge ${process.status === "Em votacao" ? "warn" : ""}">${process.status}</span></div>
            <p class="muted">${unitName(process.unitId)} - ${formatDate(process.date)}</p>
            <p><strong>Eleitores:</strong> ${process.voters}</p>
            <div class="progress"><span style="width: ${process.progress}%"></span></div>
            <button class="link-btn" data-action="advance-mesario" data-id="${process.id}">Atualizar etapa</button>
          </article>
        `).join("") || `<div class="empty">Nao ha processos neste recorte.</div>`}
      </div>
    </section>
  `;
}

function renderIntegrations() {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Aplicativos integrados</h2>
          <p class="muted">Acesse rapidamente cada software da plataforma escolar.</p>
        </div>
        <button class="primary" data-action="new-integration">Novo conector</button>
      </div>
      ${softwareLauncherGrid()}
    </section>
  `;
}

function softwareLauncherGrid() {
  return `
    <div class="software-grid">
      ${state.integrations.map((item) => `
        <article class="software-card">
          <div class="card-top">
            <strong>${item.name}</strong>
            <span class="badge ${item.status === "Conectado" ? "" : item.status === "Planejado" ? "blue" : "warn"}">${item.status}</span>
          </div>
          <p class="muted">${item.description}</p>
          <small class="muted">${item.channel} - ultima sincronizacao em ${formatDate(item.lastSync)}</small>
          <a class="primary full app-link" href="#${item.route || integrationRoute(item.name)}" data-route="${item.route || integrationRoute(item.name)}">Abrir</a>
        </article>
      `).join("")}
    </div>
  `;
}

function renderProfiles() {
  const profiles = state.profiles.filter((profile) => {
    if (!query.trim()) return true;
    return `${profile.name} ${profile.scope} ${profile.responsibility} ${profile.systems.join(" ")}`.toLowerCase().includes(query.toLowerCase());
  });
  const activeProfiles = state.profiles.filter((profile) => profile.status === "Ativo").length;
  const managedUsers = state.profiles.reduce((total, profile) => total + Number(profile.users || 0), 0);
  return `
    <div class="stats">
      <div class="stat"><span>Perfis integrados</span><strong>${state.profiles.length}</strong></div>
      <div class="stat"><span>Perfis ativos</span><strong>${activeProfiles}</strong></div>
      <div class="stat"><span>Usuarios vinculados</span><strong>${managedUsers}</strong></div>
      <div class="stat"><span>Sistemas cobertos</span><strong>${INTEGRATION_APPS.length}</strong></div>
    </div>
    <div class="toolbar">
      <input id="search" placeholder="Buscar perfil, sistema ou escopo" value="${query}">
      <select id="status-filter"><option value="all">Todos os status</option></select>
      <button class="primary" data-action="new-profile">Novo perfil</button>
    </div>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Perfis por sistema</h2>
          <p class="muted">Controle central de acessos para todos os softwares integrados.</p>
        </div>
      </div>
      <div class="profile-grid">
        ${profiles.map((profile) => `
          <article class="profile-card">
            <div class="card-top">
              <div>
                <h3>${profile.name}</h3>
                <p class="muted">${profile.scope} - ${profile.responsibility}</p>
              </div>
              <span class="badge ${profile.status === "Ativo" ? "" : profile.status === "Planejado" ? "blue" : "warn"}">${profile.status}</span>
            </div>
            <div class="permission-list">
              ${profile.systems.map((system) => `<span>${system}</span>`).join("")}
            </div>
            <div class="profile-footer">
              <small class="muted">${profile.users} usuarios - atualizado em ${formatDate(profile.updatedAt)}</small>
              <button class="link-btn" data-action="toggle-profile" data-id="${profile.id}">${profile.status === "Ativo" ? "Pausar" : "Ativar"}</button>
            </div>
          </article>
        `).join("") || `<div class="empty">Nenhum perfil encontrado.</div>`}
      </div>
    </section>
    <section class="panel table-wrap" style="margin-top: 18px;">
      <div class="panel-head"><h2>Matriz de sistemas</h2></div>
      <table>
        <thead><tr><th>Sistema</th><th>Perfis com acesso</th><th>Status</th></tr></thead>
        <tbody>${INTEGRATION_APPS.map((app) => {
          const linkedProfiles = state.profiles.filter((profile) => profile.systems.includes(app[0]));
          return `
            <tr>
              <td><strong>${app[0]}</strong><br><span class="muted">${app[1]}</span></td>
              <td>${linkedProfiles.map((profile) => profile.name).join(", ") || "-"}</td>
              <td><span class="badge ${linkedProfiles.length ? "" : "blue"}">${linkedProfiles.length ? `${linkedProfiles.length} perfil(is)` : "Sem perfil"}</span></td>
            </tr>
          `;
        }).join("")}</tbody>
      </table>
    </section>
  `;
}

function renderReports() {
  const totalStudents = state.students.length;
  const activeStudents = state.students.filter((item) => item.status === "Ativo").length;
  const avgScore = state.grades.reduce((sum, item) => sum + item.score, 0) / state.grades.length;
  const absenceRate = Math.round((state.attendance.filter((item) => item.status === "Falta").length / state.attendance.length) * 100);
  const perUnit = state.units.slice(0, 12).map((unit) => ({
    unit,
    students: state.students.filter((student) => student.unitId === unit.id).length,
    classes: state.classes.filter((classroom) => classroom.unitId === unit.id).length,
    pending: state.enrollments.filter((item) => item.unitId === unit.id && item.status === "Pendente").length,
  }));
  return `
    <div class="stats">
      <div class="stat"><span>Alunos cadastrados</span><strong>${totalStudents}</strong></div>
      <div class="stat"><span>Alunos ativos</span><strong>${Math.round((activeStudents / totalStudents) * 100)}%</strong></div>
      <div class="stat"><span>Media geral</span><strong>${avgScore.toFixed(1)}</strong></div>
      <div class="stat"><span>Taxa de faltas</span><strong>${absenceRate}%</strong></div>
    </div>
    <section class="panel table-wrap">
      <div class="panel-head"><h2>Indicadores por unidade</h2><button class="ghost" data-action="export-report">Exportar CSV</button></div>
      <table>
        <thead><tr><th>Unidade</th><th>Tipo</th><th>Alunos</th><th>Turmas</th><th>Pendencias</th><th>Status</th></tr></thead>
        <tbody>${perUnit.map(({ unit, students, classes, pending }) => `
          <tr><td>${unit.name}</td><td>${unit.type}</td><td>${students}</td><td>${classes}</td><td>${pending}</td><td>${unit.status}</td></tr>
        `).join("")}</tbody>
      </table>
    </section>
  `;
}

function toolbar(placeholder, buttonLabel, action) {
  return `
    <div class="toolbar">
      <input id="search" placeholder="${placeholder}" value="${query}">
      <select id="status-filter"><option value="all">Todos os status</option></select>
      <button class="primary" data-action="new-${action}">${buttonLabel}</button>
    </div>
  `;
}

function matchesGrade(item) {
  if (!query.trim()) return true;
  return `${studentName(item.studentId)} ${className(item.classId)} ${item.subject}`.toLowerCase().includes(query.toLowerCase());
}

function bindViewEvents() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset.id));
  });
  const search = document.querySelector("#search");
  if (search) search.addEventListener("input", (event) => { query = event.target.value; render(); });
  const status = document.querySelector("#status-filter");
  if (status && ["enrollments", "attendance"].includes(activeRoute)) {
    status.addEventListener("change", (event) => { statusFilter = event.target.value; render(); });
  }
}

function openModal(title, body, onSubmit) {
  const modal = document.querySelector("#modal");
  const content = document.querySelector("#modal-content");
  content.innerHTML = `<h2>${title}</h2>${body}`;
  const form = content.querySelector("form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      onSubmit(new FormData(form));
      modal.close();
    });
  }
  const integrationApp = content.querySelector("#integration-app");
  if (integrationApp) {
    const updateIntegrationFields = () => {
      const selected = integrationApp.selectedOptions[0];
      const description = content.querySelector("[name='description']");
      const channel = content.querySelector("[name='channel']");
      if (description) description.value = selected.dataset.description || "";
      if (channel) channel.value = selected.dataset.channel || "";
    };
    integrationApp.addEventListener("change", updateIntegrationFields);
    updateIntegrationFields();
  }
  modal.showModal();
}

function unitOptions(selected = activeUnit === "all" ? state.units[0].id : activeUnit) {
  return state.units.map((unit) => `<option value="${unit.id}" ${unit.id === selected ? "selected" : ""}>${unit.name}</option>`).join("");
}

function classOptions(selected = "") {
  return state.classes.map((item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${item.name} - ${unitName(item.unitId)}</option>`).join("");
}

function studentOptions(selected = "") {
  return state.students.map((item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${item.name} - ${className(item.classId)}</option>`).join("");
}

function bookOptions(selected = "") {
  return state.libraryBooks.map((book) => `<option value="${book.id}" ${book.id === selected ? "selected" : ""}>${book.title} - ${unitName(book.unitId)}</option>`).join("");
}

function integrationAppOptions(selected = "") {
  return INTEGRATION_APPS.map((item) => `<option value="${item[0]}" data-description="${item[1]}" data-channel="${item[3]}" ${item[0] === selected ? "selected" : ""}>${item[0]}</option>`).join("");
}

function integrationRoute(name) {
  return INTEGRATION_APPS.find((item) => item[0] === name)?.[4] || "integrations";
}

function systemCheckboxes(selected = []) {
  return INTEGRATION_APPS.map((item) => `
    <label class="check-row">
      <input name="systems" type="checkbox" value="${item[0]}" ${selected.includes(item[0]) ? "checked" : ""}>
      <span>${item[0]}</span>
    </label>
  `).join("");
}

function handleAction(action, id) {
  const actions = {
    "new-classroom": () => classroomForm(),
    "new-student": () => studentForm(),
    "new-enrollment": () => enrollmentForm(),
    "new-attendance": () => attendanceForm(),
    "attendance-class": () => attendanceForm("", id),
    "new-grade": () => gradeForm(),
    "new-book": () => bookForm(),
    "loan-book": () => loanBookForm(id),
    "new-mesario": () => mesarioForm(),
    "new-integration": () => integrationForm(),
    "new-profile": () => profileForm(),
    "launch-software": () => launchSoftware(id),
    "toggle-student": () => toggleStudent(id),
    "toggle-profile": () => toggleProfile(id),
    "advance-enrollment": () => advanceEnrollment(id),
    "advance-mesario": () => advanceMesario(id),
    "export-report": () => exportReport(),
  };
  actions[action]?.();
}

function classroomForm() {
  openModal("Nova turma", `
    <form class="form-grid">
      <label>Nome<input name="name" required></label>
      <label>Codigo<input name="code" required></label>
      <label>Etapa<input name="stage" required></label>
      <label>Turno<select name="shift"><option>Manha</option><option>Tarde</option><option>Integral</option><option>Noite</option></select></label>
      <label>Professor<input name="teacher" required></label>
      <label>Sala<input name="room" required></label>
      <label>Vagas<input name="seats" type="number" min="1" value="30" required></label>
      <label>Unidade<select name="unitId">${unitOptions()}</select></label>
      <button class="primary full">Salvar turma</button>
    </form>
  `, (data) => {
    state.classes.unshift({
      id: crypto.randomUUID(),
      name: data.get("name"),
      code: data.get("code"),
      stage: data.get("stage"),
      shift: data.get("shift"),
      teacher: data.get("teacher"),
      room: data.get("room"),
      seats: Number(data.get("seats")),
      unitId: data.get("unitId"),
    });
    saveState(`Turma ${data.get("name")} criada.`);
  });
}

function studentForm() {
  openModal("Novo aluno", `
    <form class="form-grid">
      <label>Nome<input name="name" required></label>
      <label>Matricula<input name="registration" required></label>
      <label>Nascimento<input name="birthDate" type="date" required></label>
      <label>Responsavel<input name="guardian" required></label>
      <label>Telefone<input name="phone" required></label>
      <label>Turma<select name="classId">${classOptions()}</select></label>
      <label class="full"><input name="transport" type="checkbox"> Usa transporte escolar</label>
      <button class="primary full">Salvar aluno</button>
    </form>
  `, (data) => {
    const classroom = state.classes.find((item) => item.id === data.get("classId"));
    state.students.unshift({
      id: crypto.randomUUID(),
      registration: data.get("registration"),
      name: data.get("name"),
      birthDate: data.get("birthDate"),
      guardian: data.get("guardian"),
      phone: data.get("phone"),
      unitId: classroom.unitId,
      classId: classroom.id,
      status: "Ativo",
      transport: data.has("transport"),
      libraryBlocked: false,
    });
    saveState(`Aluno ${data.get("name")} cadastrado.`);
  });
}

function enrollmentForm() {
  openModal("Nova matricula", `
    <form class="form-grid">
      <label class="full">Aluno<select name="studentId">${studentOptions()}</select></label>
      <label class="full">Turma destino<select name="classId">${classOptions()}</select></label>
      <label>Data<input name="requestDate" type="date" value="${today.toISOString().slice(0, 10)}" required></label>
      <label>Origem<select name="origin"><option>Secretaria escolar</option><option>Pre-matricula digital</option><option>Transferencia</option></select></label>
      <button class="primary full">Salvar matricula</button>
    </form>
  `, (data) => {
    const classroom = state.classes.find((item) => item.id === data.get("classId"));
    state.enrollments.unshift({
      id: crypto.randomUUID(),
      studentId: data.get("studentId"),
      unitId: classroom.unitId,
      classId: classroom.id,
      requestDate: data.get("requestDate"),
      status: "Pendente",
      origin: data.get("origin"),
    });
    saveState(`Matricula criada para ${studentName(data.get("studentId"))}.`);
  });
}

function attendanceForm(studentId = "", classId = "") {
  openModal("Registrar frequencia", `
    <form class="form-grid">
      <label class="full">Aluno<select name="studentId">${studentOptions(studentId)}</select></label>
      <label>Turma<select name="classId">${classOptions(classId)}</select></label>
      <label>Data<input name="date" type="date" value="${today.toISOString().slice(0, 10)}" required></label>
      <label>Status<select name="status"><option>Presenca</option><option>Falta</option><option>Atraso</option></select></label>
      <label class="full">Observacao<textarea name="note"></textarea></label>
      <button class="primary full">Salvar frequencia</button>
    </form>
  `, (data) => {
    const classroom = state.classes.find((item) => item.id === data.get("classId"));
    state.attendance.unshift({
      id: crypto.randomUUID(),
      studentId: data.get("studentId"),
      classId: classroom.id,
      unitId: classroom.unitId,
      date: data.get("date"),
      status: data.get("status"),
      note: data.get("note"),
    });
    saveState(`Frequencia registrada para ${studentName(data.get("studentId"))}.`);
  });
}

function gradeForm() {
  openModal("Nova avaliacao", `
    <form class="form-grid">
      <label class="full">Aluno<select name="studentId">${studentOptions()}</select></label>
      <label>Componente<input name="subject" required></label>
      <label>Periodo<input name="period" value="1 bimestre" required></label>
      <label>Nota<input name="score" type="number" min="0" max="10" step="0.1" required></label>
      <label><input name="recovery" type="checkbox"> Recuperacao</label>
      <button class="primary full">Salvar avaliacao</button>
    </form>
  `, (data) => {
    const student = state.students.find((item) => item.id === data.get("studentId"));
    state.grades.unshift({
      id: crypto.randomUUID(),
      studentId: student.id,
      unitId: student.unitId,
      classId: student.classId,
      subject: data.get("subject"),
      period: data.get("period"),
      score: Number(data.get("score")),
      recovery: data.has("recovery"),
    });
    saveState(`Avaliacao registrada para ${student.name}.`);
  });
}

function bookForm() {
  openModal("Novo livro", `
    <form class="form-grid">
      <label>Titulo<input name="title" required></label>
      <label>Autor<input name="author" required></label>
      <label>Categoria<input name="category" required></label>
      <label>Exemplares<input name="copies" type="number" min="1" value="1" required></label>
      <label>Status<select name="status"><option>Disponivel</option><option>Manutencao</option></select></label>
      <label>Unidade<select name="unitId">${unitOptions()}</select></label>
      <button class="primary full">Salvar livro</button>
    </form>
  `, (data) => {
    const copies = Number(data.get("copies"));
    state.libraryBooks.unshift({
      id: crypto.randomUUID(),
      title: data.get("title"),
      author: data.get("author"),
      category: data.get("category"),
      unitId: data.get("unitId"),
      copies,
      available: copies,
      status: data.get("status"),
    });
    saveState(`Livro ${data.get("title")} cadastrado.`);
  });
}

function loanBookForm(bookId = "") {
  openModal("Emprestimo de biblioteca", `
    <form class="form-grid">
      <label class="full">Obra<select name="bookId">${bookOptions(bookId)}</select></label>
      <label class="full">Aluno<select name="studentId">${studentOptions()}</select></label>
      <label>Retirada<input name="startDate" type="date" value="${today.toISOString().slice(0, 10)}" required></label>
      <label>Vencimento<input name="dueDate" type="date" value="${addDays(today, 14).toISOString().slice(0, 10)}" required></label>
      <button class="primary full">Registrar emprestimo</button>
    </form>
  `, (data) => {
    const book = state.libraryBooks.find((item) => item.id === data.get("bookId"));
    const student = state.students.find((item) => item.id === data.get("studentId"));
    if (!book || book.available < 1) return alert("Nao ha exemplar disponivel.");
    if (student.libraryBlocked) return alert("Aluno bloqueado na biblioteca.");
    book.available -= 1;
    state.libraryLoans.unshift({
      id: crypto.randomUUID(),
      bookId: book.id,
      studentId: student.id,
      unitId: book.unitId,
      startDate: data.get("startDate"),
      dueDate: data.get("dueDate"),
      returnedAt: "",
    });
    saveState(`Emprestimo registrado para ${student.name}.`);
  });
}

function mesarioForm() {
  openModal("Novo processo de mesario", `
    <form class="form-grid">
      <label class="full">Titulo<input name="title" required></label>
      <label>Unidade<select name="unitId">${unitOptions()}</select></label>
      <label>Data<input name="date" type="date" value="${today.toISOString().slice(0, 10)}" required></label>
      <label>Eleitores<input name="voters" type="number" min="1" value="100" required></label>
      <label>Status<select name="status"><option>Configurando urnas</option><option>Em votacao</option><option>Apuracao</option><option>Encerrado</option></select></label>
      <button class="primary full">Salvar processo</button>
    </form>
  `, (data) => {
    state.mesarioProcesses.unshift({
      id: crypto.randomUUID(),
      unitId: data.get("unitId"),
      title: data.get("title"),
      status: data.get("status"),
      date: data.get("date"),
      voters: Number(data.get("voters")),
      progress: 10,
    });
    saveState(`Processo ${data.get("title")} criado no Mesario.`);
  });
}

function integrationForm() {
  openModal("Novo conector", `
    <form class="form-grid">
      <label>Aplicativo<select id="integration-app" name="name" required>${integrationAppOptions()}</select></label>
      <label>Canal<input name="channel" required></label>
      <label>Status<select name="status"><option>Conectado</option><option>Pronto para homologar</option><option>Planejado</option></select></label>
      <label class="full">Descricao<textarea name="description" required></textarea></label>
      <button class="primary full">Salvar conector</button>
    </form>
  `, (data) => {
    state.integrations.unshift({
      id: crypto.randomUUID(),
      name: data.get("name"),
      description: data.get("description"),
      status: data.get("status"),
      channel: data.get("channel"),
      route: integrationRoute(data.get("name")),
      lastSync: today.toISOString().slice(0, 10),
    });
    saveState(`Conector ${data.get("name")} registrado.`);
  });
}

function profileForm() {
  openModal("Novo perfil integrado", `
    <form class="form-grid">
      <label>Nome do perfil<input name="name" required></label>
      <label>Escopo<select name="scope"><option>Global</option><option>Rede</option><option>Unidade escolar</option><option>Turma</option><option>Aluno</option><option>Processo eleitoral</option></select></label>
      <label>Responsabilidade<input name="responsibility" required></label>
      <label>Usuarios vinculados<input name="users" type="number" min="0" value="0" required></label>
      <label>Status<select name="status"><option>Ativo</option><option>Homologacao</option><option>Planejado</option><option>Pausado</option></select></label>
      <div class="full">
        <span class="field-label">Sistemas liberados</span>
        <div class="check-grid">${systemCheckboxes(["i-educar"])}</div>
      </div>
      <button class="primary full">Salvar perfil</button>
    </form>
  `, (data) => {
    const systems = data.getAll("systems");
    if (!systems.length) return alert("Selecione pelo menos um sistema para o perfil.");
    state.profiles.unshift({
      id: crypto.randomUUID(),
      name: data.get("name"),
      scope: data.get("scope"),
      responsibility: data.get("responsibility"),
      status: data.get("status"),
      users: Number(data.get("users")),
      systems,
      updatedAt: today.toISOString().slice(0, 10),
    });
    saveState(`Perfil ${data.get("name")} criado com acesso a ${systems.length} sistema(s).`);
  });
}

function launchSoftware(id) {
  const integration = state.integrations.find((item) => item.id === id);
  if (!integration) return;
  navigateToRoute(integration.route || integrationRoute(integration.name));
}

function toggleStudent(id) {
  const student = state.students.find((item) => item.id === id);
  student.status = student.status === "Ativo" ? "Acompanhamento" : "Ativo";
  saveState(`${student.name} marcado como ${student.status}.`);
}

function toggleProfile(id) {
  const profile = state.profiles.find((item) => item.id === id);
  profile.status = profile.status === "Ativo" ? "Pausado" : "Ativo";
  profile.updatedAt = today.toISOString().slice(0, 10);
  saveState(`Perfil ${profile.name} ${profile.status === "Ativo" ? "ativado" : "pausado"}.`);
}

function advanceEnrollment(id) {
  const enrollment = state.enrollments.find((item) => item.id === id);
  const flow = ["Pendente", "Matriculado", "Indeferido"];
  enrollment.status = flow[(flow.indexOf(enrollment.status) + 1) % flow.length];
  if (enrollment.status === "Matriculado") {
    const student = state.students.find((item) => item.id === enrollment.studentId);
    student.unitId = enrollment.unitId;
    student.classId = enrollment.classId;
  }
  saveState(`Matricula de ${studentName(enrollment.studentId)} atualizada.`);
}

function advanceMesario(id) {
  const process = state.mesarioProcesses.find((item) => item.id === id);
  const flow = ["Configurando urnas", "Em votacao", "Apuracao", "Encerrado"];
  process.status = flow[Math.min(flow.indexOf(process.status) + 1, flow.length - 1)];
  process.progress = process.status === "Encerrado" ? 100 : Math.min(process.progress + 25, 95);
  saveState(`Processo ${process.title} atualizado para ${process.status}.`);
}

function exportReport() {
  const rows = [["Unidade", "Tipo", "Alunos", "Turmas", "Matriculas pendentes", "Status"]];
  state.units.forEach((unit) => {
    rows.push([
      unit.name,
      unit.type,
      state.students.filter((student) => student.unitId === unit.id).length,
      state.classes.filter((classroom) => classroom.unitId === unit.id).length,
      state.enrollments.filter((item) => item.unitId === unit.id && item.status === "Pendente").length,
      unit.status,
    ]);
  });
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "relatorio-gestao-escolar.csv";
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (!routeButton) return;
  event.preventDefault();
  navigateToRoute(routeButton.dataset.route);
});

document.querySelector("#unit-filter").addEventListener("change", (event) => {
  activeUnit = event.target.value;
  render();
});

document.querySelector("#seed-btn").addEventListener("click", () => {
  if (!confirm("Restaurar os dados de exemplo da plataforma escolar?")) return;
  const fresh = seedData();
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, fresh);
  saveState("Base escolar de exemplo restaurada.");
});

render();
initializeFirebaseSync();
