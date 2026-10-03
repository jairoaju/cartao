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
let temporizadorAlerta = null;

let cartaoSelecionadoState = "Visa - 10";
let usuarioSelecionadoState = "Jairo";

// Gerenciamento de Tema
function inicializarTema() {
    const temaSalvo = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (temaSalvo === 'dark' || (!temaSalvo && prefersDark)) {
        document.body.classList.add('dark-mode');
        document.getElementById('btn-tema').textContent = '☀️';
        document.getElementById('meta-theme-color').setAttribute('content', '#090d16');
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
        document.getElementById('meta-theme-color').setAttribute('content', '#090d16');
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
        card10.className = "pill-card ativo";
        card25.className = "pill-card";
    } else {
        card25.className = "pill-card ativo";
        card10.className = "pill-card";
    }
    
    selecionarUsuario("Jairo");
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

        if (isVisa10 && u.nome !== "Jairo") {
            card.className = "pill-card bloqueado";
        } else if (isSelected) {
            card.className = "pill-card ativo";
        } else {
            card.className = "pill-card";
        }
    });
}

function mostrarAlerta(mensagem, tipo = 'erro') {
    const alerta = document.getElementById("app-alerta");
    if (temporizadorAlerta) clearTimeout(temporizadorAlerta);
    alerta.textContent = mensagem;
    alerta.classList.remove("hidden");
    
    if (tipo === 'sucesso') {
        alerta.style.backgroundColor = "var(--emerald-light-bg)";
        alerta.style.color = "var(--emerald-text-light)";
        alerta.style.borderColor = "var(--emerald-border-light)";
    } else {
        alerta.style.backgroundColor = "#fef2f2";
        alerta.style.color = "#b91c1c";
        alerta.style.borderColor = "#fecaca";
    }
    temporizadorAlerta = setTimeout(() => alerta.classList.add("hidden"), 3500);
}

function definirDataHoje() {
    if (idEmEdicao !== null) return;
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    document.getElementById('input-data').value = `${ano}-${mes}-${dia}`;
}
definirDataHoje();

selecionarCartao("Visa - 10");

initSqlJs({
    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
}).then(SQL => {
    const savedDbHex = localStorage.getItem(STORAGE_KEY);
    if (savedDbHex) {
        const binaryData = new Uint8Array(savedDbHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        db = new SQL.Database(binaryData);
    } else {
        db = new SQL.Database();
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS cartao_gastos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            cartao TEXT NOT NULL,
            dono_do_cartao TEXT NOT NULL,
            estabelecimento TEXT NOT NULL,
            valor REAL NOT NULL
        );
    `);
    ativarBotaoSalvar();
    atualizarAplicacao();
}).catch(err => console.error("Erro ao carregar sql.js:", err));

function ativarBotaoSalvar() {
    const btn = document.getElementById("btn-salvar");
    btn.disabled = false;
    if (idEmEdicao !== null) {
        btn.className = "btn-acao btn-editar-ativo";
        btn.textContent = "Atualizar Lançamento";
    } else {
        btn.className = "btn-acao btn-salvar-ativo";
        btn.textContent = "Salvar Lançamento";
    }
}

function persistirBanco() {
    if (!db) return;
    const binaryArray = db.export();
    const hexString = Array.from(binaryArray).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(STORAGE_KEY, hexString);
}

function exportarBackup() {
    if (!db) return;
    const dataBinaria = db.export();
    const dataIso = new Date().toISOString().split('T')[0];
    const nomeArquivo = `backup_cartoes_${dataIso}.sqlite`;
    let binarios = "";
    for (let i = 0; i < dataBinaria.byteLength; i++) {
        binarios += String.fromCharCode(dataBinaria[i]);
    }
    const base64Data = window.btoa(binarios);
    const dataUri = `data:application/x-sqlite3;base64,${base64Data}`;

    const container = document.getElementById("container-link-download");
    container.innerHTML = `
        <div style="background-color: var(--emerald-light-bg); border: 1px solid var(--emerald-border-light); padding: 0.5rem; border-radius: 0.75rem; display: flex; flex-direction: column; gap: 0.375rem; text-align: center;">
            <span style="font-size: 11px; color: var(--emerald-text-light); font-weight: 500;">Backup pronto para download:</span>
            <a href="${dataUri}" download="${nomeArquivo}" style="background-color: var(--emerald-main); color: white; font-size: 12px; font-weight: bold; padding: 0.5rem 1rem; border-radius: 0.75rem; text-decoration: none; display: block;">
                ⬇️ Baixar Arquivo (.sqlite)
            </a>
        </div>
    `;
    container.classList.remove("hidden");
}

function importarBackup(event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const uInt8Array = new Uint8Array(e.target.result);
            initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            }).then(SQL => {
                db = new SQL.Database(uInt8Array);
                persistirBackupDireto(uInt8Array);
                cancelarEdicao();
                atualizarAplicacao();
                mostrarAlerta("Banco de dados importado com sucesso!", "sucesso");
            });
        } catch (err) {
            mostrarAlerta("Erro ao importar o arquivo SQLite.", "erro");
        }
        event.target.value = "";
    };
    reader.readAsArrayBuffer(arquivo);
}

function persistirBackupDireto(uInt8Array) {
    const hexString = Array.from(uInt8Array).map(b => b.toString(16).padStart(2, '0')).join('');
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

function mudarAba(aba) {
    const secLancamentos = document.getElementById("secao-lancamentos");
    const secResumo = document.getElementById("secao-resumo");
    const tabLanc = document.getElementById("tab-lancamentos");
    const tabRes = document.getElementById("tab-resumo");

    idEmExclusaoPendente = null;

    if (aba === 'lancamentos') {
        secLancamentos.classList.remove("hidden");
        secLancamentos.classList.add("flex");
        secResumo.classList.remove("flex");
        secResumo.classList.add("hidden");
        tabLanc.className = "tab-btn tab-ativa";
        tabRes.className = "tab-btn tab-inativa";
    } else {
        secResumo.classList.remove("hidden");
        secResumo.classList.add("flex");
        secLancamentos.classList.remove("flex");
        secLancamentos.classList.add("hidden");
        tabRes.className = "tab-btn tab-ativa";
        tabLanc.className = "tab-btn tab-inativa";
        gerarResumoPorCartao();
    }
}

function atualizarAplicacao() {
    carregarRegistros();
}

function carregarRegistros() {
    if (!db) return;
    const lista = document.getElementById("lista-registros");
    lista.innerHTML = "";
    try {
        const stmt = db.prepare("SELECT id, data, cartao, dono_do_cartao, estabelecimento, valor FROM cartao_gastos ORDER BY data DESC, id DESC");
        const registros = [];
        let somaTotal = 0;
        while (stmt.step()) { registros.push(stmt.get()); }
        stmt.free();

        if (registros.length === 0) {
            lista.innerHTML = '<li style="color: var(--text-muted-light); font-size: 12px; text-align: center; padding: 1rem 0;">Nenhum lançamento encontrado.</li>';
            document.getElementById("total-geral").textContent = "Total: R$ 0,00";
            return;
        }

        registros.forEach(reg => {
            const [id, data, cartao, dono, estabelecimento, valor] = reg;
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
                    <div style="display: flex; flex-direction: column; gap: 0.125rem; flex: 1; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px;" class="font-mono">
                            <span style="color: var(--text-muted-light);">📅 ${formatarDataBR(data)}</span> 
                            <span style="color: var(--emerald-main); font-weight: bold;">${formatarMoeda(valor)}</span>
                        </div>
                        <p class="estabelecimento-nome">${estabelecimento}</p>
                        <span style="font-size: 10px; color: var(--text-muted-light);">💳 ${cartao} • Usuário: ${dono}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        <button onclick="carregarParaEdicao(${id}, '${data}', '${cartao}', '${dono}', '${estabelecimento.replace(/'/g, "\\'")}', ${valor})" style="background: none; border: none; color: var(--text-muted-light); cursor: pointer; padding: 0.375rem; font-size: 12px;" title="Editar">✏️</button>
                        <button onclick="pedirConfirmacaoExclusao(${id})" style="background: none; border: none; color: var(--text-muted-light); cursor: pointer; padding: 0.375rem; font-size: 12px;" title="Excluir">🗑</button>
                    </div>
                `;
            }
            lista.appendChild(li);
        });
        document.getElementById("total-geral").textContent = `Total: ${formatarMoeda(somaTotal)}`;
    } catch (e) {
        console.error("Erro:", e);
    }
}

function gerarResumoPorCartao() {
    if (!db) return;
    const container = document.getElementById("conteudo-resumo");
    container.innerHTML = "";
    const cartoesFixos = ["Visa - 10", "Visa - 25"];

    cartoesFixos.forEach(cartao => {
        try {
            const stmt = db.prepare("SELECT data, dono_do_cartao, estabelecimento, valor FROM cartao_gastos WHERE cartao = ? ORDER BY dono_do_cartao ASC, data DESC");
            stmt.bind([cartao]);
            const registros = [];
            let totalCartao = 0;
            const subtotaisPorDono = {};

            while (stmt.step()) {
                const [data, dono, estabelecimento, valor] = stmt.get();
                registros.push({ data, dono, estabelecimento, valor });
                totalCartao += valor;
                subtotaisPorDono[dono] = (subtotaisPorDono[dono] || 0) + valor;
            }
            stmt.free();

            const cardDiv = document.createElement("div");
            cardDiv.className = "inner-item-box";
            cardDiv.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem;";
            cardDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 0.375rem;">
                    <span style="font-weight: bold; color: var(--emerald-main); font-size: 12px;">💳 Cartão: ${cartao}</span> 
                    <span class="badge-cartao-resumo">${formatarMoeda(totalCartao)}</span>
                </div>
            `;

            if (registros.length === 0) {
                cardDiv.innerHTML += `<p style="font-size: 11px; color: var(--text-muted-light); text-align: center; margin: 0.25rem 0;">Nenhum lançamento registrado.</p>`;
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

                let itensHtml = `<span style="font-size: 10px; font-weight: 600; color: var(--text-muted-light); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.125rem;">Lançamentos:</span><ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem;">`;
                registros.forEach(g => {
                    itensHtml += `
                        <li style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;" class="inner-item-box">
                            <div style="display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; flex: 1;">
                                <span class="estabelecimento-nome">${g.estabelecimento}</span>
                                <span style="font-size: 10px; color: var(--text-muted-light);" class="font-mono">👤 ${g.dono} • ${formatarDataBR(g.data)}</span>
                            </div>
                            <span class="font-mono" style="color: var(--emerald-main); font-weight: 600; margin-left: 0.5rem;">${formatarMoeda(g.valor)}</span>
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

function carregarParaEdicao(id, data, cartao, dono, estabelecimento, valor) {
    idEmEdicao = id;
    idEmExclusaoPendente = null;
    document.getElementById("input-data").value = data;
    
    selecionarCartao(cartao);
    selecionarUsuario(dono);

    document.getElementById("input-estabelecimento").value = estabelecimento;
    document.getElementById("input-valor").value = valor;

    document.getElementById("titulo-formulario").textContent = "Editando Lançamento";
    document.getElementById("titulo-formulario").style.color = "#d97706";
    document.getElementById("btn-cancelar").style.display = "block";
    ativarBotaoSalvar();
}

function cancelarEdicao() {
    idEmEdicao = null;
    document.getElementById("input-estabelecimento").value = "";
    document.getElementById("input-valor").value = "";
    definirDataHoje();
    selecionarCartao("Visa - 10");
    selecionarUsuario("Jairo");

    document.getElementById("titulo-formulario").textContent = "Novo Lançamento";
    document.getElementById("titulo-formulario").style.color = "var(--emerald-main)";
    document.getElementById("btn-cancelar").style.display = "none";
    ativarBotaoSalvar();
}

function salvarOuAtualizarRegistro() {
    if (!db) return;
    const data = document.getElementById("input-data").value;
    const cartao = cartaoSelecionadoState;
    const dono = usuarioSelecionadoState;
    const estabelecimento = document.getElementById("input-estabelecimento").value.trim();
    const valorInput = document.getElementById("input-valor").value;
    
    if (!data || !cartao || !dono || !estabelecimento || !valorInput) {
        mostrarAlerta("Por favor, preencha todos os campos!", "erro");
        return;
    }

    const valor = parseFloat(valorInput);
    if (isNaN(valor) || valor <= 0) {
        mostrarAlerta("Insira um valor válido em reais!", "erro");
        return;
    }

    if (idEmEdicao === null) {
        const stmt = db.prepare("INSERT INTO cartao_gastos (data, cartao, dono_do_cartao, estabelecimento, valor) VALUES (?, ?, ?, ?, ?)");
        stmt.run([data, cartao, dono, estabelecimento, valor]);
        stmt.free();
        mostrarAlerta("Lançamento salvo com sucesso!", "sucesso");
    } else {
        const stmt = db.prepare("UPDATE cartao_gastos SET data = ?, cartao = ?, dono_do_cartao = ?, estabelecimento = ?, valor = ? WHERE id = ?");
        stmt.run([data, cartao, dono, estabelecimento, valor, idEmEdicao]);
        stmt.free();
        idEmEdicao = null;
        document.getElementById("titulo-formulario").textContent = "Novo Lançamento";
        document.getElementById("titulo-formulario").style.color = "var(--emerald-main)";
        document.getElementById("btn-cancelar").style.display = "none";
        mostrarAlerta("Lançamento atualizado com sucesso!", "sucesso");
    }

    persistirBanco();
    document.getElementById("input-estabelecimento").value = "";
    document.getElementById("input-valor").value = "";
    definirDataHoje();
    selecionarCartao("Visa - 10");
    selecionarUsuario("Jairo");
    ativarBotaoSalvar();
    document.getElementById("input-estabelecimento").focus();
    atualizarAplicacao();
}

function pedirConfirmacaoExclusao(id) {
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

    const stmt = db.prepare("DELETE FROM cartao_gastos WHERE id = ?");
    stmt.run([id]);
    stmt.free();

    idEmExclusaoPendente = null;
    persistirBanco();
    atualizarAplicacao();
    mostrarAlerta("Lançamento excluído com sucesso!", "sucesso");
}