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

async function gerarArquivoPDF(mesFiltro, cartaoSelecionado, usuarioSelecionado) {
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
        let query = `
            SELECT * FROM cartao_gastos 
            WHERE fatura = ?
        `;

        let params = [mesFiltro];

        if (cartaoSelecionado && cartaoSelecionado !== 'Todos') {
            query += " AND cartao = ?";
            params.push(cartaoSelecionado);
        }
        if (usuarioSelecionado && usuarioSelecionado !== 'Todos') {
            query += " AND dono_do_cartao = ?";
            params.push(usuarioSelecionado);
        }

        // A função INSTR(estabelecimento, 'Parcela') verifica se o texto do estabelecimento
        // contém a palavra "Parcela". Se não tiver a palavra "Parcela" (retorno = 0), a 
        // expressão devolve 0 (compras à vista). Se tiver a palavra "Parcela" (retorno > 0),
        // a expressão devolve 1 (compras parceladas). Ao ordenar de forma crescente, o valor 0
        // vem antes do valor 1, colocando automaticamente todas as compras de 1 parcela no topo.

        query += `
            ORDER BY 
                fatura, cartao, dono_do_cartao, 
                CASE 
                    WHEN INSTR(estabelecimento, 'Parcela') = 0 THEN 0 
                    ELSE 1 
                END, 
                data
        `;

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
        doc.text("Data Compra", 14, y);
        doc.text("Descrição", 45, y);  // Campo "Estabelecimento"
        doc.text("Usuário", 110, y);
        doc.text("Cartão", 140, y);
        doc.text("Valor (R$)", 196, y, { align: "right" });

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

            const dataIso = reg.data_compra || reg.data || '';
            const dataFormatada = formatarDataCurta(dataIso); // Formata para DD/MM
            const estabelecimento = reg.estabelecimento || reg.local || '';
            const usuarioReg = reg.dono_do_cartao || '';
            const cartaoReg = reg.cartao || '';
            const valorReg = Number(reg.valor || 0);

            // Formata o valor no padrão brasileiro (ex: 1.234,56)
            const valorFormatado = valorReg.toLocaleString('pt-BR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });

            doc.text(String(dataFormatada), 14, y);
            doc.text(String(estabelecimento), 45, y, { maxWidth: 60 });
            doc.text(String(usuarioReg), 110, y);
            doc.text(String(cartaoReg), 140, y);
            doc.text(valorFormatado, 196, y, { align: "right" });

            y += 7;
        });

        // Total Geral
        y += 10;
        doc.setFont("helvetica", "bold");
        const valorTotalGeralFormatado = valorTotalGeral.toLocaleString('pt-BR', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
        doc.text(`Total:   R$ ${valorTotalGeralFormatado}`, 196, y, { align: "right" });


        // Nome do arquivo PDF
        const nomeCartaoLimpo = cartaoSelecionado.replace(/\s+/g, '_');
        const nomeArquivo = `fatura_${mesFiltro}_${nomeCartaoLimpo}.pdf`;

        // 1. Gera o PDF em memória no formato Blob
        const pdfBlob = doc.output('blob');
        const arquivoPdf = new File([pdfBlob], nomeArquivo, { type: 'application/pdf' });

        // 2. Dispara a API nativa de compartilhamento do dispositivo
        if (navigator.canShare && navigator.canShare({ files: [arquivoPdf] })) {
            await navigator.share({
                title: `Fatura ${mesFiltro}`,
                text: `Segue a fatura do cartão (${cartaoSelecionado}) para o mês ${mesFiltro}.`,
                files: [arquivoPdf]
            });
        } else if (navigator.share) {
            // Caso o navegador compartilhe texto mas não arquivos de mídia diretamente
            await navigator.share({
                title: `Fatura ${mesFiltro}`,
                text: `Fatura ${mesFiltro} (${cartaoSelecionado}) - Total: R$ ${valorTotalGeral.toFixed(2)}`
            });
            doc.save(nomeArquivo);
        } else {
            // Fallback: se estiver em um navegador de desktop antigo sem suporte a Web Share API
            doc.save(nomeArquivo);
        }




    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        alert('Erro ao gerar o relatório em PDF.');
    }
}

function formatarDataCurta(dataIso) {
    if (!dataIso) return '';
    const partes = dataIso.split('-'); // Espera "AAAA-MM-DD"
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}`; // Retorna "DD/MM"
    }
    return dataIso;
}