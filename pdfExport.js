// pdfExport.js
// ==========================================
// EXPORTAR RELATÓRIO EM PDF
// ==========================================

// pdfExport.js - Com Modal de Seleção de Filtros

function abrirModalExportarPdf() {
    const modal = document.getElementById('modal-exportar-pdf');
    if (!modal) return;

    // Pré-preenche o mês com o valor que estiver atualmente selecionado na tela principal
    const inputFaturaPrincipal = document.getElementById('input-fatura');
    const modalMes = document.getElementById('pdf-modal-mes');
    if (inputFaturaPrincipal && modalMes && inputFaturaPrincipal.value) {
        modalMes.value = inputFaturaPrincipal.value;
    }

    // Pré-preenche o cartão e usuário atuais, se existirem
    const modalCartao = document.getElementById('pdf-modal-cartao');
    const modalUsuario = document.getElementById('pdf-modal-usuario');
    
    if (modalCartao && window.cartaoAtual) {
        modalCartao.value = window.cartaoAtual;
    }
    if (modalUsuario && window.usuarioAtual) {
        modalUsuario.value = window.usuarioAtual;
    }

    // Exibe o modal (remove a classe hidden e garante display flex)
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function fecharModalExportarPdf() {
    const modal = document.getElementById('modal-exportar-pdf');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

function confirmarExportacaoPDF() {
    const mesFiltro = document.getElementById('pdf-modal-mes').value;
    const cartaoSelecionado = document.getElementById('pdf-modal-cartao').value;
    const usuarioSelecionado = document.getElementById('pdf-modal-usuario').value;

    if (!mesFiltro) {
        alert('Por favor, selecione o mês da fatura.');
        return;
    }

    fecharModalExportarPdf();
    gerarArquivoPDF(mesFiltro, cartaoSelecionado, usuarioSelecionado);
}

function gerarArquivoPDF(mesFiltro, cartaoSelecionado, usuarioSelecionado) {
    console.log("Gerando PDF com filtros:", { mesFiltro, cartaoSelecionado, usuarioSelecionado });

    if (typeof window.jspdf === 'undefined') {
        alert("Erro: A biblioteca jsPDF não está disponível.");
        return;
    }

    if (typeof db === 'undefined' || !db) {
        alert("Erro: Base de dados não encontrada.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    try {
        let query = "SELECT * FROM cartao_gastos WHERE fatura = ?";
        let params = [mesFiltro];

        if (cartaoSelecionado && cartaoSelecionado !== 'Todos') {
            query += " AND cartao = ?";
            params.push(cartaoSelecionado);
        }
        if (usuarioSelecionado && usuarioSelecionado !== 'Todos') {
            query += " AND dono_do_cartao = ?";
            params.push(usuarioSelecionado);
        }

        query += " ORDER BY fatura, cartao, dono_do_cartao, data"

        const stmtExec = db.prepare(query);
        stmtExec.bind(params);

        let registros = [];
        let valorTotalGeral = 0;

        while (stmtExec.step()) {
            const row = stmtExec.getAsObject();
            registros.push(row);
            valorTotalGeral += Number(row.valor || 0);
        }
        stmtExec.free();

        if (registros.length === 0) {
            alert('Nenhum registro encontrado para os filtros selecionados.');
            return;
        }

        // --- MONTAGEM DO PDF ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("Relatório de Cartão de Crédito - JKJ", 14, 20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Mês da Fatura: ${mesFiltro}`, 14, 28);
        doc.text(`Cartão: ${cartaoSelecionado}`, 14, 34);
        doc.text(`Usuário: ${usuarioSelecionado}`, 14, 40);

        // Cabeçalho da Tabela
        let y = 50;
        doc.setFont("helvetica", "bold");
        doc.text("Data", 14, y);
        doc.text("Estabelecimento", 45, y);
        doc.text("Usuário", 110, y);
        doc.text("Cartão", 140, y);
        doc.text("Valor (R$)", 175, y, { align: "right" });

        doc.setLineWidth(0.5);
        doc.line(14, y + 2, 196, y + 2);

        // Itens da Tabela
        y += 8;
        doc.setFont("helvetica", "normal");

        registros.forEach(reg => {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }

            const dataCompra = reg.data_compra || reg.data || '';
            const estabelecimento = reg.estabelecimento || reg.local || '';
            const usuarioReg = reg.dono_do_cartao || '';
            const cartaoReg = reg.cartao || '';
            const valorReg = Number(reg.valor || 0);

            doc.text(String(dataCompra), 14, y);
            doc.text(String(estabelecimento), 45, y, { maxWidth: 60 });
            doc.text(String(usuarioReg), 110, y);
            doc.text(String(cartaoReg), 140, y);
            doc.text(`R$ ${valorReg.toFixed(2)}`, 196, y, { align: "right" });

            y += 7;
        });

        // Total Geral
        y += 10;
        doc.setFont("helvetica", "bold");
        doc.text(`Total Geral: R$ ${valorTotalGeral.toFixed(2)}`, 196, y, { align: "right" });

        // Descarregar o PDF
        const nomeArquivo = `relatorio_${mesFiltro}_${cartaoSelecionado.replace(/\s+/g, '_')}.pdf`;
        doc.save(nomeArquivo);

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        alert('Erro ao gerar o relatório em PDF.');
    }
}