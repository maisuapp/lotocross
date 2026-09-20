(function() {
  'use strict';

  var modalId = 'modal-pool-manager';

  function defaultPool() {
    return {
      name: 'Bolão LotoCross',
      type: 'ロト６',
      round: '',
      quotaValue: 200,
      totalQuotas: 10,
      participants: []
    };
  }

  function ensurePool() {
    if (!APP_STATE.pool || typeof APP_STATE.pool !== 'object') APP_STATE.pool = defaultPool();
    var pool = APP_STATE.pool;
    pool.name = String(pool.name || 'Bolão LotoCross');
    pool.type = pool.type || 'ロト６';
    pool.round = String(pool.round || '');
    pool.quotaValue = Math.max(1, Number(pool.quotaValue) || 200);
    pool.totalQuotas = Math.max(1, Number(pool.totalQuotas) || 10);
    pool.participants = Array.isArray(pool.participants) ? pool.participants : [];
    pool.participants = pool.participants.map(function(participant, index) {
      return {
        id: participant.id || ('p-' + Date.now() + '-' + index),
        name: String(participant.name || 'Participante'),
        quotas: Math.max(1, Number(participant.quotas) || 1),
        paid: Boolean(participant.paid),
        notes: String(participant.notes || '')
      };
    });
    return pool;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function money(value) {
    return '¥' + Number(value || 0).toLocaleString('ja-JP');
  }

  function stats(pool) {
    var sold = pool.participants.reduce(function(total, participant) { return total + participant.quotas; }, 0);
    var paid = pool.participants.reduce(function(total, participant) { return total + (participant.paid ? participant.quotas : 0); }, 0);
    return {
      sold: sold,
      available: Math.max(0, pool.totalQuotas - sold),
      paid: paid,
      collected: paid * pool.quotaValue,
      pending: (sold - paid) * pool.quotaValue
    };
  }

  function createModal() {
    if (document.getElementById(modalId)) return;
    var modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 hidden';
    modal.innerHTML =
      '<div class="glass-panel w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 border border-rose-500/30 shadow-2xl relative max-h-[94vh] overflow-y-auto">' +
        '<button type="button" id="pool-close" class="absolute top-4 right-4 text-slate-400 hover:text-white p-2 text-lg"><i class="fa-solid fa-xmark"></i></button>' +
        '<div class="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4 pr-8">' +
          '<div class="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center"><i class="fa-solid fa-people-group text-lg"></i></div>' +
          '<div><h3 class="text-base sm:text-lg font-bold text-white">Administrar Bolão Coletivo</h3><p class="text-xs text-slate-400">Controle local de cotas, participantes e pagamentos.</p></div>' +
        '</div>' +
        '<div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 mb-4"><i class="fa-solid fa-circle-info mr-1"></i> Os dados ficam salvos neste dispositivo. Para participantes acessarem remotamente, será necessário conectar um banco de dados e contas de usuário.</div>' +
        '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4" id="pool-summary"></div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800 mb-4">' +
          '<div><label class="block text-xs text-slate-300 font-medium mb-1">Nome do bolão</label><input id="pool-name" type="text" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"></div>' +
          '<div><label class="block text-xs text-slate-300 font-medium mb-1">Loteria</label><select id="pool-type" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"><option value="ロト７">ロト７ (Lotto 7)</option><option value="ロト６">ロト６ (Lotto 6)</option><option value="ミニロト">ミニロト (Mini Loto)</option></select></div>' +
          '<div><label class="block text-xs text-slate-300 font-medium mb-1">Concurso</label><input id="pool-round" type="text" placeholder="Ex.: 第2142回" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono"></div>' +
          '<div class="grid grid-cols-2 gap-2"><div><label class="block text-xs text-slate-300 font-medium mb-1">Valor da cota</label><input id="pool-quota-value" type="number" min="1" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono"></div><div><label class="block text-xs text-slate-300 font-medium mb-1">Total de cotas</label><input id="pool-total-quotas" type="number" min="1" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono"></div></div>' +
          '<div class="sm:col-span-2 flex justify-end"><button type="button" id="pool-save-settings" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"><i class="fa-solid fa-floppy-disk mr-1"></i>Salvar configuração</button></div>' +
        '</div>' +
        '<form id="pool-participant-form" class="p-3 rounded-xl bg-slate-900/70 border border-slate-800 mb-4">' +
          '<div class="text-xs font-bold text-white mb-2"><i class="fa-solid fa-user-plus text-rose-400 mr-1"></i>Adicionar participante</div>' +
          '<div class="grid grid-cols-1 sm:grid-cols-[1fr_100px_auto] gap-2 items-end">' +
            '<div><label class="block text-[11px] text-slate-400 mb-1">Nome</label><input id="pool-participant-name" required type="text" placeholder="Nome do participante" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"></div>' +
            '<div><label class="block text-[11px] text-slate-400 mb-1">Cotas</label><input id="pool-participant-quotas" required type="number" min="1" value="1" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono"></div>' +
            '<button type="submit" class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"><i class="fa-solid fa-plus mr-1"></i>Adicionar</button>' +
          '</div>' +
        '</form>' +
        '<div class="flex items-center justify-between mb-2"><h4 class="text-xs font-bold text-white"><i class="fa-solid fa-list-check text-rose-400 mr-1"></i>Participantes</h4><button type="button" id="pool-copy-summary" class="text-[11px] text-blue-300 hover:text-white"><i class="fa-solid fa-copy mr-1"></i>Copiar resumo</button></div>' +
        '<div id="pool-participants-list" class="space-y-2"></div>' +
        '<div class="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-800"><button type="button" id="pool-close-bottom" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">Fechar</button></div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function(event) {
      if (event.target === modal) closePoolManager();
    });
    document.getElementById('pool-close').addEventListener('click', closePoolManager);
    document.getElementById('pool-close-bottom').addEventListener('click', closePoolManager);
    document.getElementById('pool-save-settings').addEventListener('click', savePoolSettings);
    document.getElementById('pool-participant-form').addEventListener('submit', addParticipant);
    document.getElementById('pool-copy-summary').addEventListener('click', copyPoolSummary);
  }

  function renderPoolModal() {
    var pool = ensurePool();
    var info = stats(pool);
    document.getElementById('pool-name').value = pool.name;
    document.getElementById('pool-type').value = pool.type;
    document.getElementById('pool-round').value = pool.round;
    document.getElementById('pool-quota-value').value = pool.quotaValue;
    document.getElementById('pool-total-quotas').value = pool.totalQuotas;
    document.getElementById('pool-summary').innerHTML =
      '<div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800"><span class="block text-[10px] text-slate-400">Participantes</span><strong class="text-white font-mono">' + pool.participants.length + '</strong></div>' +
      '<div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800"><span class="block text-[10px] text-slate-400">Cotas</span><strong class="text-white font-mono">' + info.sold + '/' + pool.totalQuotas + '</strong></div>' +
      '<div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800"><span class="block text-[10px] text-slate-400">Arrecadado</span><strong class="text-emerald-400 font-mono">' + money(info.collected) + '</strong></div>' +
      '<div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800"><span class="block text-[10px] text-slate-400">Pendente</span><strong class="text-amber-400 font-mono">' + money(info.pending) + '</strong></div>';

    var list = document.getElementById('pool-participants-list');
    if (!pool.participants.length) {
      list.innerHTML = '<div class="p-4 rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-500">Nenhum participante cadastrado ainda.</div>';
      return;
    }
    list.innerHTML = pool.participants.map(function(participant) {
      var due = participant.quotas * pool.quotaValue;
      return '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">' +
        '<div class="min-w-0"><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full ' + (participant.paid ? 'bg-emerald-400' : 'bg-amber-400') + '"></span><strong class="text-sm text-white truncate">' + escapeHtml(participant.name) + '</strong><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">' + participant.quotas + ' cota' + (participant.quotas > 1 ? 's' : '') + '</span></div><div class="text-[11px] text-slate-400 mt-1">' + money(due) + ' • ' + (participant.paid ? '<span class="text-emerald-400">Pago</span>' : '<span class="text-amber-400">Pendente</span>') + '</div></div>' +
        '<div class="flex items-center gap-1.5"><button type="button" data-pool-action="toggle" data-pool-id="' + escapeHtml(participant.id) + '" class="px-2.5 py-1.5 rounded-lg ' + (participant.paid ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300') + ' text-[11px] font-semibold">' + (participant.paid ? 'Marcar pendente' : 'Marcar pago') + '</button><button type="button" data-pool-action="remove" data-pool-id="' + escapeHtml(participant.id) + '" class="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20" title="Remover participante"><i class="fa-solid fa-trash-can"></i></button></div>' +
      '</div>';
    }).join('');
    list.querySelectorAll('[data-pool-action]').forEach(function(button) {
      button.addEventListener('click', function() {
        var id = button.getAttribute('data-pool-id');
        if (button.getAttribute('data-pool-action') === 'toggle') togglePayment(id);
        else removeParticipant(id);
      });
    });
  }

  function savePoolSettings() {
    var pool = ensurePool();
    var sold = stats(pool).sold;
    var total = Math.max(sold, Number(document.getElementById('pool-total-quotas').value) || 0);
    if (total < 1) return alert('Informe pelo menos 1 cota disponível.');
    pool.name = document.getElementById('pool-name').value.trim() || 'Bolão LotoCross';
    pool.type = document.getElementById('pool-type').value;
    pool.round = document.getElementById('pool-round').value.trim();
    pool.quotaValue = Math.max(1, Number(document.getElementById('pool-quota-value').value) || 0);
    pool.totalQuotas = total;
    saveState();
    renderPoolModal();
    alert('Configuração do bolão salva neste dispositivo.');
  }

  function addParticipant(event) {
    event.preventDefault();
    var pool = ensurePool();
    var nameInput = document.getElementById('pool-participant-name');
    var quotasInput = document.getElementById('pool-participant-quotas');
    var name = nameInput.value.trim();
    var quotas = Math.max(1, Number(quotasInput.value) || 0);
    if (!name || quotas < 1) return alert('Informe o nome e a quantidade de cotas.');
    if (stats(pool).sold + quotas > pool.totalQuotas) return alert('Não há cotas suficientes disponíveis para este participante.');
    pool.participants.push({ id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), name: name, quotas: quotas, paid: false, notes: '' });
    saveState();
    nameInput.value = '';
    quotasInput.value = '1';
    renderPoolModal();
  }

  function togglePayment(id) {
    var pool = ensurePool();
    var participant = pool.participants.find(function(item) { return item.id === id; });
    if (!participant) return;
    participant.paid = !participant.paid;
    saveState();
    renderPoolModal();
  }

  function removeParticipant(id) {
    var pool = ensurePool();
    var participant = pool.participants.find(function(item) { return item.id === id; });
    if (!participant || !confirm('Remover ' + participant.name + ' do bolão?')) return;
    pool.participants = pool.participants.filter(function(item) { return item.id !== id; });
    saveState();
    renderPoolModal();
  }

  function copyPoolSummary() {
    var pool = ensurePool();
    var info = stats(pool);
    var text = pool.name + '\n' + pool.type + (pool.round ? ' • ' + pool.round : '') + '\nCota: ' + money(pool.quotaValue) + '\nCotas: ' + info.sold + '/' + pool.totalQuotas + '\nArrecadado: ' + money(info.collected) + '\nPendente: ' + money(info.pending) + '\n\n' + pool.participants.map(function(participant) { return '- ' + participant.name + ': ' + participant.quotas + ' cota(s) — ' + (participant.paid ? 'pago' : 'pendente'); }).join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() { alert('Resumo do bolão copiado.'); });
    } else {
      alert(text);
    }
  }

  function openPoolManager() {
    var profile = window.lotoCrossProfile;
    if (!profile) {
      alert('Entre na sua conta para administrar um bolão.');
      if (window.openAuthModal) window.openAuthModal();
      return;
    }
    if (profile.role !== 'admin' && profile.role !== 'organizer') {
      alert('A administração de bolões está disponível apenas para Organizadores e Administradores.');
      return;
    }
    ensurePool();
    createModal();
    renderPoolModal();
    document.getElementById(modalId).classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closePoolManager() {
    var modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  window.openPoolManager = openPoolManager;
  window.closePoolManager = closePoolManager;

  function initPoolManager() {
    ensurePool();
    var button = document.getElementById('m-btn-pool');
    if (button) button.addEventListener('click', openPoolManager);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPoolManager);
  else initPoolManager();
}());

