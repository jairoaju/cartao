if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error:', err));
    });
}

let db = null;
const STORAGE_KEY = "sqlite_cartao_backup_v9";
const THEME_KEY = "app_theme_mode";
let idEmEdicao = null;
let idEmExclusaoPendente = null;
let confirmandoExclusaoModal = false;
let dadosModalAtual = null;

let cartaoSelecionadoState = "Visa - 10";
let usuarioSelecionadoState = "Jairo";

let dataFiltroHistorico = new Date();
let dataFiltroResumo = new Date();

function inicializarTema() {
    const temaSalvo = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (temaSalvo === 'dark' || (!temaSalvo && prefersDark)) {
        document.body.classList.add('dark-mode');
        document.getElementById('btn-tema').textContent = '☀️';
        document.getElementById('meta-theme-color').setAttribute('content', '#020617');
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('btn-tema').textContent = '🌙';
        document.getElementById('meta-theme-color').setAttribute('content', '#ffffff');
    }
}

function alternarTema() {
    const isDark = document.body.classList.toggle('dark-mode');
    if (isDark) {
        localStorage.setItem(THEME_KEY, 'dark');
        document.getElementById('btn-tema').textContent = '☀️';
        document.getElementById('meta-theme-color').setAttribute('content', '#020617');
    } else {
        localStorage.setItem(THEME_KEY, 'light');
        document.getElementById('btn-tema').textContent = '🌙';
        document.getElementById('meta-theme-color').setAttribute('content', '#ffffff');
    }
}

inicializarTema();

function selecionarCartao(cartao) {
    cartaoSelecionadoState = cartao;
    const card10 = document.getElementById("card-cartao-visa10");
    const card25 = document.getElementById("card-cartao-visa25");

    if (cartao === "Visa - 10") {
        if (card10) card10.className = "pill-card ativo";
        if (card25) card25.className = "pill-card";
    } else {
        if (card25) card25.className = "pill-card ativo";
        if (card10) card10.className = "pill-card";
    }
    
    if (cartao === "Visa - 10") {
        selecionarUsuario("Jairo");
    } else {
        selecionarUsuario(usuarioSelecionadoState);
    }
}

function selecionarUsuario(usuario) {
    if (cartaoSelecionadoState === "Visa - 10" && usuario !== "Jairo") {
        return;
    }

    usuarioSelecionadoState = usuario;

    const usuarios = [
        { nome: "Jairo", id: "jairo" },
        { nome: "Kátia", id: "katia" },
        { nome: "Juliana", id: "juliana" }
    ];

    usuarios.forEach(u => {
        const card = document.getElementById(`card-usuario-${u.id}`);
        if (!card) return;
        
        const isSelected = (u.nome === usuario);
        const isVisa10 = (cartaoSelecionadoState === "Visa - 10");

        card.classList.remove('ativo', 'bloqueado');

        if (isVisa10 && u.nome !== "Jairo") {
            card.classList.add('bloqueado');
            card.style.backgroundColor = "#f1f5f9";
            card.style.borderColor = "#e2e8f0";
            card.style.color = "#cbd5e1";
            card.style.opacity = "0.35";
            card.style.pointerEvents = "none";
        } else {
            card.style.backgroundColor = "";
            card.style.borderColor = "";
            card.style.color = "";
            card.style.opacity = "1";
            card.style.pointerEvents = "auto";
            if (isSelected) {
                card.classList.add('ativo');
            }
        }
    });
}

function mostrarAlerta(mensagem, tipo = 'sucesso') {
    const alertaBox = document.getElementById('app-alerta');
    if (!alertaBox) return;

    alertaBox.textContent = mensagem;
    alertaBox.classList.remove('hidden');

    if (tipo === 'sucesso') {
        alertaBox.style.backgroundColor = 'var(--emerald-light-bg)';
        alertaBox.style.color = 'var(--emerald-text-light)';
        alertaBox.style.borderColor = 'var(--emerald-border-light)';
    } else {
        alertaBox.style.backgroundColor = '#fee2e2';
        alertaBox.style.color = '#991b1b';
        alertaBox.style.borderColor = '#fecaca';
    }

    setTimeout(() => {
        alertaBox.classList.add('hidden');
    }, 4000);
}

function atualizarTextoFaturaVisual() {
    const inputVal = document.getElementById("input-fatura").value;
    const spanVisual = document.getElementById("fatura-visual");
    if (!inputVal || !spanVisual) return;

    const [ano, mes] = inputVal.split('-');
    const mesesCurtos = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const nomeMes = mesesCurtos[parseInt(mes) - 1] || mes;
    const anoCurto = ano.slice(-2);

    spanVisual.textContent = `${nomeMes}/${anoCurto}`;

    if (!spanVisual.classList.contains('ativo')) {
        spanVisual.classList.add('ativo');
    }
}

function definirValoresPadrao() {
    if (idEmEdicao !== null) return;
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    
    const inputData = document.getElementById('input-data');
    const inputFatura = document.getElementById('input-fatura');

    if (inputData) inputData.value = `${ano}-${mes}-${dia}`;
    if (inputFatura) inputFatura.value = `${ano}-${mes}`;
    atualizarTextoFaturaVisual();
}

definirValoresPadrao();
selecionarCartao("Visa - 10");

document.addEventListener("DOMContentLoaded", () => {
    const inputValor = document.getElementById("input-valor");
    if (inputValor) {
        inputValor.addEventListener("keydown", function(event) {
            if (event.key === "Enter" || event.keyCode === 13) {
                event.preventDefault();
                const inputParcelas = document.getElementById("input-parcelas-total");
                if (inputParcelas) {
                    if (!inputParcelas.value) {
                        inputParcelas.value = "1";
                    }
                    inputParcelas.focus();
                }
            }
        });
    }
});

initSqlJs({
    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
}).then(SQL => {
    const savedDbHex = localStorage.getItem(STORAGE_KEY);
    
    if (savedDbHex && savedDbHex.length > 10) {
        try {
            const binaryData = new Uint8Array(savedDbHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            db = new SQL.Database(binaryData);
        } catch (e) {
            console.error("Erro ao carregar banco salvo, criando novo:", e);
            db = new SQL.Database();
        }
    } else {
        db = new SQL.Database();
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS cartao_gastos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            fatura TEXT NOT NULL,
            cartao TEXT NOT NULL,
            dono_do_cartao TEXT NOT NULL,
            estabelecimento TEXT NOT NULL,
            valor REAL NOT NULL,
            valor_total REAL DEFAULT 0
        );
    `);

    try {
        const res = db.exec("SELECT fatura FROM cartao_gastos ORDER BY data DESC, id DESC LIMIT 1");
        if (res.length > 0 && res[0].values.length > 0) {
            const ultimaFatura = res[0].values[0][0];
            const [anoF, mesF] = ultimaFatura.split('-');
            if (anoF && mesF) {
                dataFiltroHistorico = new Date(parseInt(anoF), parseInt(mesF) - 1, 1);
                dataFiltroResumo = new Date(parseInt(anoF), parseInt(mesF) - 1, 1);
            }
        }
    } catch (e) {}

    selecionarCartao("Visa - 10");
    ativarBotaoSalvar();
    atualizarAplicacao();
}).catch(err => console.error("Erro ao carregar sql.js:", err));

function verificarPreenchimentoFormulario() {
    const estabelecimento = document.getElementById("input-estabelecimento").value.trim();
    const valorInput = document.getElementById("input-valor").value.trim();
    const parcelasInput = document.getElementById("input-parcelas-total").value.trim();
    const inputFaturaEl = document.getElementById("input-fatura");
    
    const faturaInput = inputFaturaEl ? inputFaturaEl.value.trim() : "";
    const btnSalvar = document.getElementById("btn-salvar");
    const btnConfirma = document.getElementById("btn-confirma");

    const numParcelas = parseInt(parcelasInput) || 1;
    const formularioValido = estabelecimento !== "" && valorInput !== "" && parseFloat(valorInput) > 0 && numParcelas >= 1 && faturaInput !== "";

    if (idEmEdicao !== null) {
        if (btnConfirma) btnConfirma.disabled = !formularioValido;
    } else {
        if (btnSalvar) {
            btnSalvar.disabled = !formularioValido;
            if (formularioValido) {
                btnSalvar.classList.remove("btn-desativado");
                btnSalvar.classList.add("btn-salvar-ativo");
            } else {
                btnSalvar.classList.remove("btn-salvar-ativo");
                btnSalvar.classList.add("btn-desativado");
            }
        }
    }
}

function ativarBotaoSalvar() {
    const btnSalvar = document.getElementById("btn-salvar");
    const containerEdicao = document.getElementById("botoes-edicao-container");
    const btnConfirma = document.getElementById("btn-confirma");
    const inputParcelas = document.getElementById("input-parcelas-total");

    if (idEmEdicao !== null) {
        if (btnSalvar) btnSalvar.classList.add("hidden");
        if (containerEdicao) containerEdicao.style.setProperty('display', 'grid', 'important');
        if (btnConfirma) btnConfirma.className = "btn-acao btn-confirma-edicao";
        if (inputParcelas) inputParcelas.disabled = true;
    } else {
        if (btnSalvar) btnSalvar.classList.remove("hidden");
        if (containerEdicao) containerEdicao.style.setProperty('display', 'none', 'important');
        if (btnSalvar) {
            btnSalvar.className = "btn-acao btn-salvar-ativo";
            btnSalvar.textContent = "Salvar Lançamento";
        }
        if (inputParcelas) inputParcelas.disabled = false;
    }
    verificarPreenchimentoFormulario();
}

function persistirBanco() {
    if (!db) return;
    const binaryArray = db.export();
    const hexString = Array.from(binaryArray).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(STORAGE_KEY, hexString);
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarDataBR(dataIso) {
    if (!dataIso) return '';
    const partes = dataIso.split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dataIso;
}

function formatarFaturaBR(faturaIso) {
    if (!faturaIso) return '';
    const partes = faturaIso.split('-');
    if (partes.length !== 2) return faturaIso;
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const nomeMes = meses[parseInt(partes[1]) - 1] || partes[1];
    return `${nomeMes} de ${partes[0]}`;
}

function mudarMesHistorico(direcao) {
    dataFiltroHistorico.setMonth(dataFiltroHistorico.getMonth() + direcao);
    carregarRegistros();
}

function atualizarLabelMesFiltro() {
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const nomeMes = meses[dataFiltroHistorico.getMonth()];
    const ano = dataFiltroHistorico.getFullYear();
    const labelEl = document.getElementById("label-mes-filtro");
    if (labelEl) labelEl.textContent = `Fatura: ${nomeMes} de ${ano}`;
}

function mudarMesResumo(direcao) {
    dataFiltroResumo.setMonth(dataFiltroResumo.getMonth() + direcao);
    gerarResumoPorCartao();
}

function atualizarLabelMesResumo() {
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const nomeMes = meses[dataFiltroResumo.getMonth()];
    const ano = dataFiltroResumo.getFullYear();
    const labelEl = document.getElementById("label-mes-resumo");
    if (labelEl) labelEl.textContent = `Fatura: ${nomeMes} de ${ano}`;
}

function mudarAba(aba) {
    const secLancamentos = document.getElementById("secao-lancamentos");
    const secResumo = document.getElementById("secao-resumo");
    const tabLanc = document.getElementById("tab-lancamentos");
    const tabRes = document.getElementById("tab-resumo");

    fecharModalDetalhes();
    idEmExclusaoPendente = null;

    if (aba === 'lancamentos') {
        if (secLancamentos) { secLancamentos.classList.remove("hidden"); secLancamentos.classList.add("flex"); }
        if (secResumo) { secResumo.classList.remove("flex"); secResumo.classList.add("hidden"); }
        if (tabLanc) tabLanc.className = "tab-btn tab-ativa";
        if (tabRes) tabRes.className = "tab-btn tab-inativa";
        carregarRegistros();
    } else {
        if (secResumo) { secResumo.classList.remove("hidden"); secResumo.classList.add("flex"); }
        if (secLancamentos) { secLancamentos.classList.remove("flex"); secLancamentos.classList.add("hidden"); }
        if (tabRes) tabRes.className = "tab-btn tab-ativa";
        if (tabLanc) tabLanc.className = "tab-btn tab-inativa";
        gerarResumoPorCartao();
    }
}

function atualizarAplicacao() {
    atualizarLabelMesFiltro();
    atualizarLabelMesResumo();
    carregarRegistros();
}

function carregarRegistros() {
    if (!db) return;
    atualizarLabelMesFiltro();
    const lista = document.getElementById("lista-registros");
    if (!lista) return;
    lista.innerHTML = "";

    try {
        const anoFiltro = dataFiltroHistorico.getFullYear();
        const mesFiltro = String(dataFiltroHistorico.getMonth() + 1).padStart(2, '0');
        const faturaFiltroStr = `${anoFiltro}-${mesFiltro}`;

        const stmt = db.prepare("SELECT id, data, fatura, cartao, dono_do_cartao, estabelecimento, valor, valor_total FROM cartao_gastos WHERE fatura = ? ORDER BY data DESC, id DESC");
        stmt.bind([faturaFiltroStr]);

        const registros = [];
        let somaTotal = 0;
        while (stmt.step()) { registros.push(stmt.get()); }
        stmt.free();

        const totalGeralEl = document.getElementById("total-geral");

        if (registros.length === 0) {
            lista.innerHTML = '<li style="color: var(--text-muted-light); font-size: 12px; text-align: center; padding: 1rem 0;">Nenhum lançamento para esta fatura.</li>';
            if (totalGeralEl) totalGeralEl.textContent = "Total: R$ 0,00";
            return;
        }

        registros.forEach(reg => {
            const [id, data, fatura, cartao, dono, estabelecimento, valor] = reg;
            somaTotal += valor;
            const li = document.createElement("li");
            
            if (idEmExclusaoPendente === id) {
                li.style.cssText = "background-color: #fffbeb; border: 1px solid #fde68a; padding: 0.75rem; border-radius: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;";
                
                const divInfo = document.createElement("div");
                divInfo.style.cssText = "font-size: 11px; font-weight: 600; color: #b45309; display: flex; justify-content: space-between; align-items: center;";
                const spanWarn = document.createElement("span");
                spanWarn.textContent = "⚠ Confirmar exclusão?";
                const spanVal = document.createElement("span");
                spanVal.className = "font-mono";
                spanVal.style.color = "#92400e";
                spanVal.textContent = formatarMoeda(valor);
                divInfo.appendChild(spanWarn);
                divInfo.appendChild(spanVal);

                const divEst = document.createElement("div");
                divEst.style.cssText = "font-size: 11px; color: #d97706; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
                divEst.textContent = estabelecimento;

                const divBtns = document.createElement("div");
                divBtns.style.cssText = "display: flex; gap: 0.5rem; justify-content: end; margin-top: 0.25rem;";
                
                const btnCancel = document.createElement("button");
                btnCancel.style.cssText = "background-color: #e2e8f0; color: #334155; padding: 0.25rem 0.625rem; border-radius: 0.5rem; font-weight: 600; font-size: 11px; border: none; cursor: pointer;";
                btnCancel.textContent = "Cancelar";
                btnCancel.addEventListener('click', cancelarExclusao);

                const btnConfirm = document.createElement("button");
                btnConfirm.style.cssText = "background-color: #dc2626; color: white; padding: 0.25rem 0.625rem; border-radius: 0.5rem; font-weight: 600; font-size: 11px; border: none; cursor: pointer;";
                btnConfirm.textContent = "Sim, Excluir";
                btnConfirm.addEventListener('click', () => efetivarExclusao(id));

                divBtns.appendChild(btnCancel);
                divBtns.appendChild(btnConfirm);

                li.appendChild(divInfo);
                li.appendChild(divEst);
                li.appendChild(divBtns);
            } else {
                li.className = "inner-item-box";
                li.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;";

                const divMain = document.createElement("div");
                divMain.style.cssText = "display: flex; flex-direction: column; gap: 0.05rem; flex: 1; min-width: 0;";

                const divRow1 = document.createElement("div");
                divRow1.style.cssText = "display: flex; justify-content: space-between; align-items: center; font-size: 10px;";
                divRow1.className = "font-mono";

                const spanEstab = document.createElement("span");
                spanEstab.className = "estabelecimento-nome";
                spanEstab.style.cssText = "font-size: 12px; font-weight: 700; color: #475569;";
                spanEstab.textContent = estabelecimento;

                const spanValor = document.createElement("span");
                spanValor.style.cssText = "color: var(--emerald-main); font-weight: 800; font-size: 12px;";
                spanValor.textContent = formatarMoeda(valor);

                divRow1.appendChild(spanEstab);
                divRow1.appendChild(spanValor);

                const divRow2 = document.createElement("div");
                divRow2.style.cssText = "display: flex; gap: 0.5rem; align-items: center; font-size: 10px; color: var(--text-muted-light);";
                divRow2.className = "font-mono";
                divRow2.textContent = `📅 ${formatarDataBR(data)} • 💳 ${cartao} • 👤 ${dono}`;

                divMain.appendChild(divRow1);
                divMain.appendChild(divRow2);

                const divActions = document.createElement("div");
                divActions.style.cssText = "display: flex; align-items: center; gap: 0.25rem;";

                const btnEdit = document.createElement("button");
                btnEdit.style.cssText = "background: none; border: none; color: var(--text-muted-light); cursor: pointer; padding: 0.375rem; font-size: 12px;";
                btnEdit.title = "Editar";
                btnEdit.textContent = "✏️";
                btnEdit.addEventListener('click', () => carregarParaEdicao(id, data, fatura, cartao, dono, estabelecimento, valor));

                const btnDel = document.createElement("button");
                btnDel.style.cssText = "background: none; border: none; color: var(--text-muted-light); cursor: pointer; padding: 0.375rem; font-size: 12px;";
                btnDel.title = "Excluir";
                btnDel.textContent = "🗑";
                btnDel.addEventListener('click', () => pedirConfirmacaoExclusao(id));

                divActions.appendChild(btnEdit);
                divActions.appendChild(btnDel);

                li.appendChild(divMain);
                li.appendChild(divActions);
            }
            lista.appendChild(li);
        });
        if (totalGeralEl) totalGeralEl.textContent = `Total: ${formatarMoeda(somaTotal)}`;
    } catch (e) {
        console.error("Erro ao carregar registros:", e);
    }
}

function gerarResumoPorCartao() {
    if (!db) return;
    atualizarLabelMesResumo();
    const container = document.getElementById("conteudo-resumo");
    if (!container) return;
    container.innerHTML = "";
    
    const cartoesFixos = ["Visa - 10", "Visa - 25"];
    const anoFiltro = dataFiltroResumo.getFullYear();
    const mesFiltro = String(dataFiltroResumo.getMonth() + 1).padStart(2, '0');
    const faturaFiltroStr = `${anoFiltro}-${mesFiltro}`;

    cartoesFixos.forEach(cartao => {
        try {
            const stmt = db.prepare("SELECT id, data, fatura, cartao, dono_do_cartao, estabelecimento, valor, valor_total FROM cartao_gastos WHERE cartao = ? AND fatura = ? ORDER BY dono_do_cartao ASC, data DESC");
            stmt.bind([cartao, faturaFiltroStr]);
            
            const registros = [];
            let totalCartao = 0;
            const subtotaisPorDono = {};

            while (stmt.step()) {
                const [id, data, fatura, cartaoBanco, dono, estabelecimento, valor, valor_total] = stmt.get();
                const vTotalFinal = valor_total !== undefined && valor_total !== null ? valor_total : valor;
                registros.push({ id, data, fatura, cartao: cartaoBanco, dono, estabelecimento, valor, valor_total: vTotalFinal });
                totalCartao += valor;
                subtotaisPorDono[dono] = (subtotaisPorDono[dono] || 0) + valor;
            }
            stmt.free();

            const cardDiv = document.createElement("div");
            cardDiv.className = "inner-item-box";
            cardDiv.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;";

            const cardHeader = document.createElement("div");
            cardHeader.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 0.375rem;";
            
            const spanCardNome = document.createElement("span");
            spanCardNome.style.cssText = "font-weight: bold; color: var(--emerald-main); font-size: 12px;";
            spanCardNome.textContent = `💳 Cartão: ${cartao}`;

            const spanCardTotal = document.createElement("span");
            spanCardTotal.className = "badge-cartao-resumo";
            spanCardTotal.textContent = formatarMoeda(totalCartao);

            cardHeader.appendChild(spanCardNome);
            cardHeader.appendChild(spanCardTotal);
            cardDiv.appendChild(cardHeader);

            if (registros.length === 0) {
                const pVazio = document.createElement("p");
                pVazio.style.cssText = "font-size: 11px; color: var(--text-muted-light); text-align: center; margin: 0.25rem 0;";
                pVazio.textContent = "Nenhum lançamento para esta fatura.";
                cardDiv.appendChild(pVazio);
            } else {
                const subBox = document.createElement("div");
                subBox.className = "subtotais-box";
                subBox.style.cssText = "display: flex; flex-direction: column; gap: 0.25rem;";

                const subTitle = document.createElement("span");
                subTitle.style.cssText = "font-size: 10px; font-weight: 600; color: var(--text-muted-light); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.125rem;";
                subTitle.textContent = "Subtotais por Usuário:";
                subBox.appendChild(subTitle);

                for (const [dono, subtotal] of Object.entries(subtotaisPorDono)) {
                    const subRow = document.createElement("div");
                    subRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; font-size: 11px;";
                    subRow.className = "font-mono";

                    const spanDono = document.createElement("span");
                    spanDono.style.cssText = "color: var(--text-muted-light);";
                    spanDono.textContent = `👤 ${dono}`;

                    const spanSubVal = document.createElement("span");
                    spanSubVal.style.cssText = "color: var(--emerald-main); font-weight: 600;";
                    spanSubVal.textContent = formatarMoeda(subtotal);

                    subRow.appendChild(spanDono);
                    subRow.appendChild(spanSubVal);
                    subBox.appendChild(subRow);
                }
                cardDiv.appendChild(subBox);

                const labelLanc = document.createElement("span");
                labelLanc.style.cssText = "font-size: 10px; font-weight: 600; color: var(--text-muted-light); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.125rem;";
                labelLanc.textContent = "Lançamentos (clique para detalhes):";
                cardDiv.appendChild(labelLanc);

                const ulEl = document.createElement("ul");
                ulEl.style.cssText = "list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem;";

                registros.forEach(g => {
                    const li = document.createElement("li");
                    li.className = "inner-item-box";
                    li.style.cssText = "display: flex; justify-content: space-between; align-items: center; font-size: 11px; cursor: pointer;";

                    const divInfo = document.createElement("div");
                    divInfo.style.cssText = "display: flex; flex-direction: column; gap: 0.05rem; min-width: 0; flex: 1;";

                    const divRow1 = document.createElement("div");
                    divRow1.style.cssText = "display: flex; justify-content: space-between; align-items: center; font-size: 10px;";
                    divRow1.className = "font-mono";

                    const spanEst = document.createElement("span");
                    spanEst.className = "estabelecimento-nome";
                    spanEst.style.cssText = "font-size: 11px; font-weight: 700; color: #475569;";
                    spanEst.textContent = g.estabelecimento;
                    divRow1.appendChild(spanEst);

                    const divRow2 = document.createElement("div");
                    divRow2.style.cssText = "display: flex; gap: 0.4rem; align-items: center; font-size: 9px; color: var(--text-muted-light);";
                    divRow2.className = "font-mono";
                    divRow2.textContent = `📅 ${formatarDataBR(g.data)} • 👤 ${g.dono}`;

                    divInfo.appendChild(divRow1);
                    divInfo.appendChild(divRow2);

                    const spanVal = document.createElement("span");
                    spanVal.className = "font-mono";
                    spanVal.style.cssText = "color: var(--emerald-main); font-weight: 800; font-size: 12px; margin-left: 0.5rem;";
                    spanVal.textContent = formatarMoeda(g.valor);

                    li.appendChild(divInfo);
                    li.appendChild(spanVal);

                    li.addEventListener('click', () => {
                        mostrarModalDetalhes({
                            id: g.id,
                            estabelecimento: g.estabelecimento,
                            valor: g.valor,
                            valorTotal: g.valor_total || g.valor,
                            dono: g.dono,
                            data: g.data,
                            fatura: g.fatura,
                            cartao: g.cartao
                        });
                    });

                    ulEl.appendChild(li);
                });
                cardDiv.appendChild(ulEl);
            }
            container.appendChild(cardDiv);
        } catch (e) {
            console.error("Erro no resumo:", e);
        }
    });
}

function abrirModalDetalhesResumo(dadosJson) {
    mostrarModalDetalhes(dadosJson);
}

function mostrarModalDetalhes(dadosJson) {
    const dados = typeof dadosJson === 'string' ? JSON.parse(dadosJson) : dadosJson;
    dadosModalAtual = dados;
    
    let modal = document.getElementById("modal-detalhes");
    let container = document.getElementById("modal-detalhes-conteudo");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "modal-detalhes";
        container = document.createElement("div");
        container.id = "modal-detalhes-conteudo";
        modal.appendChild(container);
        document.body.appendChild(modal);
    }

    modal.classList.remove("hidden");
    modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.65); display: flex; justify-content: center; align-items: center; z-index: 9999; padding: 0.75rem; box-sizing: border-box;";

    const isDark = document.body.classList.contains('dark-mode');
    const bgCor = isDark ? "#1e293b" : "#ffffff";
    const textoCor = isDark ? "#f1f5f9" : "#0f172a";
    const bordaCor = isDark ? "#334155" : "#e2e8f0";

    container.style.cssText = `background-color: ${bgCor}; color: ${textoCor}; padding: 1.125rem; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); width: 100%; max-width: 300px; position: relative; border: 1px solid ${bordaCor}; box-sizing: border-box;`;

    let estabelecimentoLimpo = dados.estabelecimento;
    let parcelaInfo = "À vista";
    
    const regexParcela = / - Parcela (\d+)\/(\d+)$/;
    const match = dados.estabelecimento.match(regexParcela);
    if (match) {
        estabelecimentoLimpo = dados.estabelecimento.replace(regexParcela, "");
        parcelaInfo = `Parcela ${match[1]} de ${match[2]}`;
    }

    const valorTotalFormatado = formatarMoeda(dados.valorTotal || dados.valor);
    const valorParcelaFormatado = formatarMoeda(dados.valor);

    container.innerHTML = "";

    const btnClose = document.createElement("button");
    btnClose.style.cssText = "position: absolute; top: 0.625rem; right: 0.625rem; background: none; border: none; font-size: 1.25rem; cursor: pointer; color: #94a3b8; line-height: 1;";
    btnClose.innerHTML = "&times;";
    btnClose.addEventListener('click', fecharModalDetalhes);
    container.appendChild(btnClose);

    if (confirmandoExclusaoModal) {
        const divDelBox = document.createElement("div");
        divDelBox.style.cssText = "background-color: #fffbeb; border: 1px solid #fde68a; padding: 0.75rem; border-radius: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.25rem;";

        const divDelRow1 = document.createElement("div");
        divDelRow1.style.cssText = "font-size: 11px; font-weight: 600; color: #b45309; display: flex; justify-content: space-between; align-items: center;";
        
        const spanDelWarn = document.createElement("span");
        spanDelWarn.textContent = "⚠ Confirmar exclusão?";
        const spanDelVal = document.createElement("span");
        spanDelVal.className = "font-mono";
        spanDelVal.style.color = "#92400e";
        spanDelVal.textContent = valorParcelaFormatado;
        divDelRow1.appendChild(spanDelWarn);
        divDelRow1.appendChild(spanDelVal);

        const divDelEst = document.createElement("div");
        divDelEst.style.cssText = "font-size: 11px; color: #d97706; word-break: break-word;";
        divDelEst.textContent = dados.estabelecimento;

        const divDelBtns = document.createElement("div");
        divDelBtns.style.cssText = "display: flex; gap: 0.5rem; justify-content: end; margin-top: 0.25rem;";

        const btnCancelModal = document.createElement("button");
        btnCancelModal.style.cssText = "background-color: #e2e8f0; color: #334155; padding: 0.3rem 0.6rem; border-radius: 0.5rem; font-weight: 600; font-size: 11px; border: none; cursor: pointer;";
        btnCancelModal.textContent = "Cancelar";
        btnCancelModal.addEventListener('click', cancelarExclusaoModal);

        const btnConfirmModal = document.createElement("button");
        btnConfirmModal.style.cssText = "background-color: #dc2626; color: white; padding: 0.3rem 0.6rem; border-radius: 0.5rem; font-weight: 600; font-size: 11px; border: none; cursor: pointer;";
        btnConfirmModal.textContent = "Sim, Excluir";
        btnConfirmModal.addEventListener('click', () => efetivarExclusaoModal(dados.id));

        divDelBtns.appendChild(btnCancelModal);
        divDelBtns.appendChild(btnConfirmModal);

        divDelBox.appendChild(divDelRow1);
        divDelBox.appendChild(divDelEst);
        divDelBox.appendChild(divDelBtns);
        container.appendChild(divDelBox);
    } else {
        const divMainContent = document.createElement("div");
        divMainContent.style.cssText = "display: flex; flex-direction: column; gap: 0.75rem;";

        const divEstOrig = document.createElement("div");
        divEstOrig.style.cssText = `border-bottom: 1px solid ${bordaCor}; padding-bottom: 0.5rem;`;
        
        const pEstLabel = document.createElement("p");
        pEstLabel.style.cssText = "font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.15rem;";
        pEstLabel.textContent = "Estabelecimento";

        const pEstVal = document.createElement("p");
        pEstVal.className = "estabelecimento-nome";
        pEstVal.style.cssText = `font-size: 13px; font-weight: 700; color: ${textoCor}; word-break: break-word;`;
        pEstVal.textContent = estabelecimentoLimpo;

        divEstOrig.appendChild(pEstLabel);
        divEstOrig.appendChild(pEstVal);

        const divGrid1 = document.createElement("div");
        divGrid1.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;";

        const col1 = document.createElement("div");
        const pCol1Lbl = document.createElement("p");
        pCol1Lbl.style.cssText = "font-size: 10px; color: #94a3b8; margin-bottom: 0.1rem;";
        pCol1Lbl.textContent = "Status / Parcela";
        const pCol1Val = document.createElement("p");
        pCol1Val.style.cssText = `font-size: 11px; font-weight: 600; color: ${textoCor};`;
        pCol1Val.textContent = parcelaInfo;
        col1.appendChild(pCol1Lbl);
        col1.appendChild(pCol1Val);

        const col2 = document.createElement("div");
        const pCol2Lbl = document.createElement("p");
        pCol2Lbl.style.cssText = "font-size: 10px; color: #94a3b8; margin-bottom: 0.1rem;";
        pCol2Lbl.textContent = "👤 Usuário";
        const pCol2Val = document.createElement("p");
        pCol2Val.style.cssText = `font-size: 11px; font-weight: 600; color: ${textoCor};`;
        pCol2Val.textContent = dados.dono;
        col2.appendChild(pCol2Lbl);
        col2.appendChild(pCol2Val);

        divGrid1.appendChild(col1);
        divGrid1.appendChild(col2);

        const divHighlight = document.createElement("div");
        divHighlight.style.cssText = `background-color: ${isDark ? 'rgba(23, 147, 209, 0.25)' : '#e0f2fe'}; padding: 0.625rem; border-radius: 0.75rem; border: 1px solid ${isDark ? '#0369a1' : '#bae6fd'}; display: flex; flex-direction: column; gap: 0.3rem;`;

        const rowP = document.createElement("div");
        rowP.style.cssText = "display: flex; justify-content: space-between; align-items: center;";
        const spanPLbl = document.createElement("span");
        spanPLbl.style.cssText = `font-size: 10px; color: ${isDark ? '#38bdf8' : '#0369a1'}; font-weight: 500;`;
        spanPLbl.textContent = "Valor desta parcela:";
        const spanPVal = document.createElement("span");
        spanPVal.className = "font-mono";
        spanPVal.style.cssText = `font-size: 12px; color: ${isDark ? '#38bdf8' : '#0369a1'}; font-weight: 700;`;
        spanPVal.textContent = valorParcelaFormatado;
        rowP.appendChild(spanPLbl);
        rowP.appendChild(spanPVal);

        const rowT = document.createElement("div");
        rowT.style.cssText = "display: flex; justify-content: space-between; align-items: center;";
        const spanTLbl = document.createElement("span");
        spanTLbl.style.cssText = `font-size: 10px; color: ${isDark ? '#38bdf8' : '#0369a1'}; font-weight: 500;`;
        spanTLbl.textContent = "Valor total da compra:";
        const spanTVal = document.createElement("span");
        spanTVal.className = "font-mono";
        spanTVal.style.cssText = `font-size: 12px; color: ${isDark ? '#38bdf8' : '#0369a1'}; font-weight: 700;`;
        spanTVal.textContent = valorTotalFormatado;
        rowT.appendChild(spanTLbl);
        rowT.appendChild(spanTVal);

        divHighlight.appendChild(rowP);
        divHighlight.appendChild(rowT);

        const divMeta = document.createElement("div");
        divMeta.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 10px; color: #94a3b8;";
        const spanComp = document.createElement("span");
        spanComp.textContent = `📅 Compra: ${formatarDataBR(dados.data)}`;
        const spanFat = document.createElement("span");
        spanFat.textContent = `💳 Fatura: ${formatarFaturaBR(dados.fatura)}`;
        divMeta.appendChild(spanComp);
        divMeta.appendChild(spanFat);

        const divModalBtns = document.createElement("div");
        divModalBtns.style.cssText = `display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; border-top: 1px solid ${bordaCor}; padding-top: 0.625rem; margin-top: 0.125rem;`;

        const btnEditModal = document.createElement("button");
        btnEditModal.style.cssText = "background-color: #d97706; color: white; border: none; padding: 0.4rem; border-radius: 0.5rem; font-size: 11px; font-weight: 600; cursor: pointer;";
        btnEditModal.textContent = "✏️ Editar";
        btnEditModal.addEventListener('click', () => editarDoModal(dados.id, dados.data, dados.fatura, dados.cartao, dados.dono, dados.estabelecimento, dados.valor));

        const btnDelModal = document.createElement("button");
        btnDelModal.style.cssText = "background-color: #dc2626; color: white; border: none; padding: 0.4rem; border-radius: 0.5rem; font-size: 11px; font-weight: 600; cursor: pointer;";
        btnDelModal.textContent = "🗑 Excluir";
        btnDelModal.addEventListener('click', pedirConfirmacaoExclusaoModal);

        divModalBtns.appendChild(btnEditModal);
        divModalBtns.appendChild(btnDelModal);

        const btnCloseModal = document.createElement("button");
        btnCloseModal.style.cssText = `background-color: ${isDark ? '#334155' : '#f1f5f9'}; color: ${textoCor}; border: none; padding: 0.4rem; border-radius: 0.5rem; font-size: 11px; font-weight: 600; cursor: pointer; width: 100%;`;
        btnCloseModal.textContent = "Fechar";
        btnCloseModal.addEventListener('click', fecharModalDetalhes);

        divMainContent.appendChild(divEstOrig);
        divMainContent.appendChild(divGrid1);
        divMainContent.appendChild(divHighlight);
        divMainContent.appendChild(divMeta);
        divMainContent.appendChild(divModalBtns);
        divMainContent.appendChild(btnCloseModal);

        container.appendChild(divMainContent);
    }
}

function fecharModalDetalhes() {
    confirmandoExclusaoModal = false;
    dadosModalAtual = null;
    const modal = document.getElementById("modal-detalhes");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
}

function pedirConfirmacaoExclusaoModal() {
    confirmandoExclusaoModal = true;
    if (dadosModalAtual) {
        mostrarModalDetalhes(dadosModalAtual);
    }
}

function cancelarExclusaoModal() {
    confirmandoExclusaoModal = false;
    if (dadosModalAtual) {
        mostrarModalDetalhes(dadosModalAtual);
    }
}

function efetivarExclusaoModal(id) {
    if (!db) return;
    const stmt = db.prepare("DELETE FROM cartao_gastos WHERE id = ?");
    stmt.run([id]);
    stmt.free();

    confirmandoExclusaoModal = false;
    dadosModalAtual = null;
    persistirBanco();
    fecharModalDetalhes();
    gerarResumoPorCartao();
    mostrarAlerta("Lançamento excluído com sucesso!", "sucesso");
}

function editarDoModal(id, data, fatura, cartao, dono, estabelecimento, valor) {
    confirmandoExclusaoModal = false;
    fecharModalDetalhes();
    mudarAba('lancamentos');
    carregarParaEdicao(id, data, fatura, cartao, dono, estabelecimento, valor);
}

function carregarParaEdicao(id, data, fatura, cartao, dono, estabelecimento, valor) {
    idEmEdicao = id;
    idEmExclusaoPendente = null;
    fecharModalDetalhes();
    document.getElementById("input-data").value = data;
    document.getElementById("input-fatura").value = fatura || "2026-10";
    atualizarTextoFaturaVisual();
    
    selecionarCartao(cartao);
    selecionarUsuario(dono);

    document.getElementById("input-estabelecimento").value = estabelecimento;
    document.getElementById("input-valor").value = Number(valor).toFixed(2);
    document.getElementById("input-parcelas-total").value = "1";

    const tituloEl = document.getElementById("titulo-formulario");
    if (tituloEl) {
        tituloEl.textContent = "Editando Lançamento";
        tituloEl.style.color = "#d97706";
    }
    ativarBotaoSalvar();
}

function cancelarEdicao() {
    idEmEdicao = null;
    document.getElementById("input-estabelecimento").value = "";
    document.getElementById("input-valor").value = "";
    document.getElementById("input-parcelas-total").value = "1";
    definirValoresPadrao();
    selecionarCartao("Visa - 10");
    selecionarUsuario("Jairo");

    const tituloEl = document.getElementById("titulo-formulario");
    if (tituloEl) {
        tituloEl.textContent = "Novo Lançamento";
        tituloEl.style.color = "var(--emerald-main)";
    }
    ativarBotaoSalvar();
}

function salvarOuAtualizarRegistro() {
    if (!db) return;
    const dataStr = document.getElementById("input-data").value;
    const faturaBaseStr = document.getElementById("input-fatura").value;
    const cartao = cartaoSelecionadoState;
    const dono = usuarioSelecionadoState;
    let estabelecimentoBase = document.getElementById("input-estabelecimento").value.trim();
    const valorTotalInput = document.getElementById("input-valor").value;
    const totalParcelas = parseInt(document.getElementById("input-parcelas-total").value) || 1;

    if (!dataStr || !faturaBaseStr || !cartao || !dono || !estabelecimentoBase || !valorTotalInput) {
        mostrarAlerta("Por favor, preencha todos os campos!", "erro");
        return;
    }

    const valorTotal = parseFloat(valorTotalInput);
    if (isNaN(valorTotal) || valorTotal <= 0) {
        mostrarAlerta("Insira um valor válido em reais!", "erro");
        return;
    }

    if (idEmEdicao === null) {
        if (totalParcelas > 1) {
            const valorTotalCentavos = Math.round(valorTotal * 100);
            const valorBaseCentavos = Math.floor(valorTotalCentavos / totalParcelas);
            const restoTotalCentavos = valorTotalCentavos - (valorBaseCentavos * totalParcelas);

            const [fatAno, fatMes] = faturaBaseStr.split('-');
            let anoFatura = parseInt(fatAno);
            let mesFatura = parseInt(fatMes) - 1;

            const stmt = db.prepare("INSERT INTO cartao_gastos (data, fatura, cartao, dono_do_cartao, estabelecimento, valor, valor_total) VALUES (?, ?, ?, ?, ?, ?, ?)");

            for (let i = 1; i <= totalParcelas; i++) {
                const dataFaturaObj = new Date(anoFatura, mesFatura + (i - 1), 1);
                const af = dataFaturaObj.getFullYear();
                const mf = String(dataFaturaObj.getMonth() + 1).padStart(2, '0');
                const faturaFormatada = `${af}-${mf}`;

                let centavosDaParcela = valorBaseCentavos + (i === 1 ? restoTotalCentavos : 0);
                let valorAtualParcela = centavosDaParcela / 100;

                const nomeEstabelecimento = `${estabelecimentoBase} - Parcela ${i}/${totalParcelas}`;
                stmt.run([dataStr, faturaFormatada, cartao, dono, nomeEstabelecimento, valorAtualParcela, valorTotal]);
            }
            stmt.free();
            mostrarAlerta(`${totalParcelas} parcelas geradas com sucesso!`, "sucesso");
        } else {
            const stmt = db.prepare("INSERT INTO cartao_gastos (data, fatura, cartao, dono_do_cartao, estabelecimento, valor, valor_total) VALUES (?, ?, ?, ?, ?, ?, ?)");
            stmt.run([dataStr, faturaBaseStr, cartao, dono, estabelecimentoBase, valorTotal, valorTotal]);
            stmt.free();
            mostrarAlerta("Lançamento salvo com sucesso!", "sucesso");
        }
    } else {
        const stmt = db.prepare("UPDATE cartao_gastos SET data = ?, fatura = ?, cartao = ?, dono_do_cartao = ?, estabelecimento = ?, valor = ?, valor_total = ? WHERE id = ?");
        stmt.run([dataStr, faturaBaseStr, cartao, dono, estabelecimentoBase, valorTotal, valorTotal, idEmEdicao]);
        stmt.free();
        mostrarAlerta("Lançamento atualizado com sucesso!", "sucesso");
    }

    persistirBanco();
    cancelarEdicao();
    ativarBotaoSalvar();
    atualizarAplicacao();
}

function pedirConfirmacaoExclusao(id) {
    fecharModalDetalhes();
    idEmExclusaoPendente = id;
    carregarRegistros();
}

function cancelarExclusao() {
    idEmExclusaoPendente = null;
    carregarRegistros();
}

function efetivarExclusao(id) {
    if (!db) return;
    if (idEmEdicao === id) cancelarEdicao();
    fecharModalDetalhes();

    const stmt = db.prepare("DELETE FROM cartao_gastos WHERE id = ?");
    stmt.run([id]);
    stmt.free();

    idEmExclusaoPendente = null;
    persistirBanco();
    atualizarAplicacao();
    mostrarAlerta("Lançamento excluído com sucesso!", "sucesso");
}

function exportarBackup() {
    if (!db) {
        mostrarAlerta("Banco de dados não inicializado!", "erro");
        return;
    }
    try {
        const binaryArray = db.export();
        const blob = new Blob([binaryArray], { type: "application/x-sqlite3" });
        const url = URL.createObjectURL(blob);
        
        // const dataAtual = new Date().toISOString().slice(0, 10);
        // const nomeArquivo = `backup_cartao_${dataAtual}.sqlite`;
        const DATA_AUX = new Date().toLocaleDateString().slice(0,10); //dd/mm/aaaa
        const [DIA, MES, ANO] = DATA_AUX.split('/');
        const DATA_ATUAL = `${ANO}-${MES}-${DIA}`; //aaaa-mm-dd

        const NOME_ARQUIVO = `backup_cartao_${DATA_ATUAL}.sqlite`;
     
        const a = document.createElement('a');
        a.href = url;
        // a.download = nomeArquivo;
        a.download = NOME_ARQUIVO;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Erro ao exportar backup:", e);
        mostrarAlerta("Erro ao exportar backup.", "erro");
    }
}

function importarBackup(event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const arrayBuffer = e.target.result;
            const uint8Array = new Uint8Array(arrayBuffer);
            
            initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            }).then(SQL => {
                db = new SQL.Database(uint8Array);
                persistirBanco();
                atualizarAplicacao();
                mostrarAlerta("Backup importado com sucesso!", "sucesso");
            });
        } catch (err) {
            console.error("Erro ao importar backup:", err);
            mostrarAlerta("Arquivo de backup inválido ou corrompido.", "erro");
        }
    };
    reader.readAsArrayBuffer(arquivo);
    event.target.value = "";
}
