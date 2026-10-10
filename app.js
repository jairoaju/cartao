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
        db.run("ALTER TABLE cartao_gastos ADD COLUMN fatura TEXT DEFAULT '2026-10'");
    } catch (e) {}

    try {
        db.run("ALTER TABLE cartao_gastos ADD COLUMN valor_total REAL DEFAULT 0");
    } catch (e) {}

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

        const stmt = db.prepare("SELECT id, data, fatura, cartao, dono_do_cartao, estabelecimento, valor FROM cartao_gastos WHERE fatura = ? ORDER BY data DESC, id DESC");
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
                li.innerHTML = `
                    <div style="font-size: 11px; font-weight: 600; color: #b45309; display: flex; justify-content: space-between; align-items: center;">
                        <span>⚠ Confirmar exclusão?</span>
                        <span class="font-mono" style="color: #92400e;">${formatarMoeda(valor)}</span>
                    </div>
                    <div style="font-size: 11px; color: #d97706; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${estabelecimento}</div>
                    <div style="display: flex; gap: 0.5rem; justify-content: end; margin-top: 0.25rem;">
                        <button onclick="cancelarExclusao()" style="background-color: #e2e8f0; color: #334155; padding: 0.25rem 0.625rem; border-radius: 0.5rem; font-weight: 600; font-size: 11px; border: none; cursor: pointer;">Cancelar</button>
                        <button onclick="efetivarExclusao(${id})" style="background-color: #dc2626; color: white; padding: 0.25rem 0.625rem; border-radius: 0.5rem; font-weight: 600; font-size: 11px; border: none; cursor: pointer;">Sim, Excluir</button>
                    </div>
                `;
            } else {
                li.className = "inner-item-box";
                li.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;";
                li.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 0.05rem; flex: 1; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px;" class="font-mono">
                            <span class="estabelecimento-nome" style="font-size: 12px; font-weight: 700; color: #475569;">${estabelecimento}</span>
                            <span style="color: var(--emerald-main); font-weight: 800; font-size: 12px;">${formatarMoeda(valor)}</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: center; font-size: 10px; color: var(--text-muted-light);" class="font-mono">
                            <span>📅 ${formatarDataBR(data)}</span>
                            <span>•</span>
                            <span>💳 ${cartao}</span>
                            <span>•</span>
                            <span>👤 ${dono}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        <button onclick="carregarParaEdicao(${id}, '${data}', '${fatura}', '${cartao}', '${dono}', '${estabelecimento.replace(/'/g, "\\'")}', ${valor})" style="background: none; border: none; color: var(--text-muted-light); cursor: pointer; padding: 0.375rem; font-size: 12px;" title="Editar">✏️</button>
                        <button onclick="pedirConfirmacaoExclusao(${id})" style="background: none; border: none; color: var(--text-muted-light); cursor: pointer; padding: 0.375rem; font-size: 12px;" title="Excluir">🗑</button>
                    </div>
                `;
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
                registros.push({ id, data, fatura, cartao: cartaoBanco, dono, estabelecimento, valor, valor_total });
                totalCartao += valor;
                subtotaisPorDono[dono] = (subtotaisPorDono[dono] || 0) + valor;
            }
            stmt.free();

            const cardDiv = document.createElement("div");
            cardDiv.className = "inner-item-box";
            cardDiv.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;";
            cardDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 0.375rem;">
                    <span style="font-weight: bold; color: var(--emerald-main); font-size: 12px;">💳 Cartão: ${cartao}</span> 
                    <span class="badge-cartao-resumo">${formatarMoeda(totalCartao)}</span>
                </div>
            `;

            if (registros.length === 0) {
                cardDiv.innerHTML += `<p style="font-size: 11px; color: var(--text-muted-light); text-align: center; margin: 0.25rem 0;">Nenhum lançamento para esta fatura.</p>`;
            } else {
                let subHtml = `<div class="subtotais-box" style="display: flex; flex-direction: column; gap: 0.25rem;"><span style="font-size: 10px; font-weight: 600; color: var(--text-muted-light); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.125rem;">Subtotais por Usuário:</span>`;
                for (const [dono, subtotal] of Object.entries(subtotaisPorDono)) {
                    subHtml += `
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;" class="font-mono">
                            <span style="color: var(--text-muted-light);">👤 ${dono}</span> 
                            <span style="color: var(--emerald-main); font-weight: 600;">${formatarMoeda(subtotal)}</span>
                        </div>`;
                }
                subHtml += `</div>`;
                cardDiv.innerHTML += subHtml;

                let itensHtml = `<span style="font-size: 10px; font-weight: 600; color: var(--text-muted-light); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.125rem;">Lançamentos (clique para detalhes):</span><ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem;">`;
                registros.forEach(g => {
                    const dadosJson = JSON.stringify({
                        id: g.id,
                        estabelecimento: g.estabelecimento,
                        valor: g.valor,
                        valorTotal: g.valor_total || g.valor,
                        dono: g.dono,
                        data: g.data,
                        fatura: g.fatura,
                        cartao: g.cartao
                    }).replace(/"/g, '&quot;');

                    itensHtml += `
                        <li onclick="mostrarModalDetalhes('${dadosJson}')" class="inner-item-box" style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; cursor: pointer;">
                            <div style="display: flex; flex-direction: column; gap: 0.05rem; min-width: 0; flex: 1;">
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px;" class="font-mono">
                                    <span class="estabelecimento-nome" style="font-size: 11px; font-weight: 700; color: #475569;">${g.estabelecimento}</span>
                                </div>
                                <div style="display: flex; gap: 0.4rem; align-items: center; font-size: 9px; color: var(--text-muted-light);" class="font-mono">
                                    <span>📅 ${formatarDataBR(g.data)}</span>
                                    <span>•</span>
                                    <span>👤 ${g.dono}</span>
                                </div>
                            </div>
                            <span class="font-mono" style="color: var(--emerald-main); font-weight: 800; font-size: 12px; margin-left: 0.5rem;">${formatarMoeda(g.valor)}</span>
                        </li>`;
                });
                itensHtml += `</ul>`;
                cardDiv.innerHTML += itensHtml;
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
    const dados = typeof dadosJson === 'string' ? JSON.parse(dadosJson.replace(/&quot;/g, '"')) : dadosJson;
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
    modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.65); display: flex; justify-content: center; align-items: center; z-index: 9999; padding: 1rem;";

    const isDark = document.body.classList.contains('dark-mode');
    const bgCor = isDark ? "#1e293b" : "#ffffff";
    const textoCor = isDark ? "#f1f5f9" : "#0f172a";
    const bordaCor = isDark ? "#334155" : "#e2e8f0";

    container.style.cssText = `background-color: ${bgCor}; color: ${textoCor}; padding: 1.5rem; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); width: 100%; max-width: 360px; position: relative; border: 1px solid ${bordaCor};`;

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

    let conteudoHtml = `
        <button onclick="fecharModalDetalhes()" style="position: absolute; top: 0.75rem; right: 0.75rem; background: none; border: none; font-size: 1.25rem; cursor: pointer; color: #94a3b8; line-height: 1;">&times;</button>
    `;

    if (confirmandoExclusaoModal) {
        conteudoHtml += `
            <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 0.875rem; border-radius: 0.75rem; display: flex; flex-direction: column; gap: 0.625rem; margin-top: 0.5rem;">
                <div style="font-size: 12px; font-weight: 600; color: #b45309; display: flex; justify-content: space-between; align-items: center;">
                    <span>⚠ Confirmar exclusão?</span>
                    <span class="font-mono" style="color: #92400e;">${valorParcelaFormatado}</span>
                </div>
                <div style="font-size: 11px; color: #d97706; word-break: break-word;">${dados.estabelecimento}</div>
                <div style="display: flex; gap: 0.5rem; justify-content: end; margin-top: 0.25rem;">
                    <button onclick="cancelarExclusaoModal()" style="background-color: #e2e8f0; color: #334155; padding: 0.35rem 0.75rem; border-radius: 0.5rem; font-weight: 600; font-size: 11px; border: none; cursor: pointer;">Cancelar</button>
                    <button onclick="efetivarExclusaoModal(${dados.id})" style="background-color: #dc2626; color: white; padding: 0.35rem 0.75rem; border-radius: 0.5rem; font-weight: 600; font-size: 11px; border: none; cursor: pointer;">Sim, Excluir</button>
                </div>
            </div>
        `;
    } else {
        conteudoHtml += `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="border-bottom: 1px solid ${bordaCor}; padding-bottom: 0.75rem;">
                    <p style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Estabelecimento original</p>
                    <p style="font-size: 14px; font-weight: 700; color: ${textoCor};" class="estabelecimento-nome">${estabelecimentoLimpo}</p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div>
                        <p style="font-size: 10px; color: #94a3b8; margin-bottom: 0.15rem;">Status / Parcela</p>
                        <p style="font-size: 12px; font-weight: 600; color: ${textoCor};">${parcelaInfo}</p>
                    </div>
                    <div>
                        <p style="font-size: 10px; color: #94a3b8; margin-bottom: 0.15rem;">👤 Usuário</p>
                        <p style="font-size: 12px; font-weight: 600; color: ${textoCor};">${dados.dono}</p>
                    </div>
                </div>
                <div style="background-color: ${isDark ? 'rgba(23, 147, 209, 0.25)' : '#e0f2fe'}; padding: 0.75rem; border-radius: 0.75rem; border: 1px solid ${isDark ? '#0369a1' : '#bae6fd'}; display: flex; flex-direction: column; gap: 0.35rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; color: ${isDark ? '#38bdf8' : '#0369a1'}; font-weight: 500;">Valor desta parcela:</span>
                        <span style="font-size: 13px; color: ${isDark ? '#38bdf8' : '#0369a1'}; font-weight: 700;" class="font-mono">${valorParcelaFormatado}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; color: ${isDark ? '#38bdf8' : '#0369a1'}; font-weight: 500;">Valor total da compra:</span>
                        <span style="font-size: 13px; color: ${isDark ? '#38bdf8' : '#0369a1'}; font-weight: 700;" class="font-mono">${valorTotalFormatado}</span>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 11px; color: #94a3b8;">
                    <span>📅 Compra: ${formatarDataBR(dados.data)}</span>
                    <span>💳 Fatura: ${formatarFaturaBR(dados.fatura)}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; border-top: 1px solid ${bordaCor}; padding-top: 0.75rem; margin-top: 0.25rem;">
                    <button onclick="editarDoModal(${dados.id}, '${dados.data}', '${dados.fatura}', '${dados.cartao}', '${dados.dono}', '${dados.estabelecimento.replace(/'/g, "\\'")}', ${dados.valor})" style="background-color: #d97706; color: white; border: none; padding: 0.5rem; border-radius: 0.5rem; font-size: 11px; font-weight: 600; cursor: pointer;">✏️ Editar</button>
                    <button onclick="pedirConfirmacaoExclusaoModal()" style="background-color: #dc2626; color: white; border: none; padding: 0.5rem; border-radius: 0.5rem; font-size: 11px; font-weight: 600; cursor: pointer;">🗑 Excluir</button>
                </div>
                <button onclick="fecharModalDetalhes()" style="background-color: ${isDark ? '#334155' : '#f1f5f9'}; color: ${textoCor}; border: none; padding: 0.5rem; border-radius: 0.5rem; font-size: 11px; font-weight: 600; cursor: pointer;">Fechar</button>
            </div>
        `;
    }

    container.innerHTML = conteudoHtml;
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