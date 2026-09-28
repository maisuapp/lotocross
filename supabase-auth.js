(function() {
  'use strict';

  var SUPABASE_URL = 'https://lpvisjgalthkopmddaff.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_WGkPotLdsvD3ck_z-84sbA_aK2reqgA';
  var supabaseClient = null;
  var currentSession = null;
  var currentProfile = null;
  var pendingAuthFlow = '';
  window.lotoCrossProfile = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function roleLabel(role) {
    return { admin: 'Administrador', organizer: 'Organizador de bolão', participant: 'Participante' }[role] || 'Participante';
  }

  function setMessage(text, type) {
    var el = document.getElementById('auth-message');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'text-xs min-h-5 ' + (type === 'error' ? 'text-rose-300' : 'text-emerald-300');
  }

  function showAuthRedirectBanner(text, type) {
    var existing = document.getElementById('auth-redirect-banner');
    if (existing) existing.remove();
    var banner = document.createElement('div');
    banner.id = 'auth-redirect-banner';
    banner.className = 'fixed top-20 left-4 right-4 z-[90] mx-auto max-w-xl rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-sm ' + (type === 'error' ? 'border-rose-500/50 bg-rose-950/95 text-rose-100' : 'border-emerald-500/50 bg-emerald-950/95 text-emerald-100');
    var row = document.createElement('div');
    row.className = 'flex items-start gap-3';
    var icon = document.createElement('i');
    icon.className = type === 'error' ? 'fa-solid fa-circle-exclamation mt-0.5 text-rose-300' : 'fa-solid fa-circle-check mt-0.5 text-emerald-300';
    var message = document.createElement('div');
    message.className = 'text-sm font-semibold flex-1';
    message.textContent = text;
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'text-slate-300 hover:text-white px-1';
    close.setAttribute('aria-label', 'Fechar aviso');
    close.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    close.addEventListener('click', function() { banner.remove(); });
    row.appendChild(icon);
    row.appendChild(message);
    row.appendChild(close);
    banner.appendChild(row);
    document.body.appendChild(banner);
  }

  function readAuthRedirectState() {
    var hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    var queryParams = new URLSearchParams(window.location.search || '');
    var errorDescription = hashParams.get('error_description') || queryParams.get('error_description');
    var flowType = hashParams.get('type') || queryParams.get('type');
    return {
      confirmed: queryParams.get('auth') === 'confirmed' || flowType === 'signup',
      hasAuthResponse: Boolean(errorDescription || hashParams.get('access_token') || hashParams.get('code') || queryParams.get('auth')),
      error: errorDescription,
      errorCode: hashParams.get('error_code') || queryParams.get('error_code')
    };
  }

  function cleanAuthRedirectUrl() {
    if (!window.history || !window.history.replaceState) return;
    if (window.location.hash || window.location.search.indexOf('auth=') !== -1) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  function showAuthRedirectMessage(state) {
    if (!state || !state.hasAuthResponse) return;
    createAuthModal();
    openAuthModal();
    var authModal = document.getElementById('modal-auth');
    if (authModal) authModal.classList.remove('hidden');
    if (state.error) {
      var errorText = 'Não foi possível confirmar o e-mail. Solicite um novo link e tente novamente.';
      setMessage(errorText, 'error');
      showAuthRedirectBanner(errorText, 'error');
      return;
    }
    if (state.confirmed) {
      var successText = currentSession ? 'E-mail confirmado. Sua conta já está pronta para uso.' : 'E-mail confirmado. Agora entre para acessar sua conta.';
      setMessage(successText, 'success');
      showAuthRedirectBanner(successText, 'success');
    }
  }

  function createAuthModal() {
    if (document.getElementById('modal-auth')) return;
    var modal = document.createElement('div');
    modal.id = 'modal-auth';
    modal.className = 'fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 hidden';
    modal.innerHTML =
      '<div class="glass-panel w-full max-w-lg rounded-2xl p-5 sm:p-6 border border-violet-500/30 shadow-2xl relative max-h-[94vh] overflow-y-auto">' +
        '<button type="button" id="auth-close" class="absolute top-4 right-4 text-slate-400 hover:text-white p-2 text-lg"><i class="fa-solid fa-xmark"></i></button>' +
        '<div class="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4 pr-8"><div class="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center"><i class="fa-solid fa-user-shield text-lg"></i></div><div><h3 class="text-base sm:text-lg font-bold text-white">Conta LotoCross</h3><p id="auth-subtitle" class="text-xs text-slate-400">Entre para salvar seus dados com segurança.</p></div></div>' +
        '<div id="auth-logged-out">' +
          '<div class="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 mb-4"><button type="button" id="auth-tab-login" class="flex-1 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold">Entrar</button><button type="button" id="auth-tab-signup" class="flex-1 px-3 py-2 rounded-lg text-slate-400 text-xs font-bold">Criar conta</button></div>' +
          '<form id="auth-login-form" class="space-y-3"><div><label class="block text-xs text-slate-300 mb-1">E-mail</label><input id="auth-login-email" required type="email" autocomplete="email" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"></div><div><label class="block text-xs text-slate-300 mb-1">Senha</label><input id="auth-login-password" required type="password" autocomplete="current-password" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"></div><button class="w-full px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold" type="submit">Entrar</button></form>' +
          '<form id="auth-signup-form" class="space-y-3 hidden"><div><label class="block text-xs text-slate-300 mb-1">Nome de exibição</label><input id="auth-signup-name" required type="text" autocomplete="name" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"></div><div><label class="block text-xs text-slate-300 mb-1">E-mail</label><input id="auth-signup-email" required type="email" autocomplete="email" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"></div><div><label class="block text-xs text-slate-300 mb-1">Senha</label><input id="auth-signup-password" required minlength="8" type="password" autocomplete="new-password" class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"><span class="text-[11px] text-slate-500 mt-1 block">Mínimo de 8 caracteres. Novas contas começam como Participante.</span></div><button class="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold" type="submit">Criar conta</button></form>' +
        '</div>' +
        '<div id="auth-logged-in" class="hidden space-y-4"><div id="auth-profile-card" class="p-3 rounded-xl bg-slate-900/80 border border-slate-800"></div><div id="auth-user-bets-section" class="p-3 rounded-xl bg-slate-900/60 border border-slate-800"><div class="flex items-center justify-between mb-2"><h4 class="text-xs font-bold text-white"><i class="fa-solid fa-ticket text-emerald-300 mr-1"></i>Minhas apostas</h4><button type="button" id="auth-refresh-bets" class="text-[11px] text-blue-300 hover:text-white">Atualizar</button></div><div id="auth-user-bets-list" class="space-y-2 max-h-64 overflow-y-auto"></div></div><div id="auth-admin-panel" class="hidden"><div class="flex items-center justify-between mb-2"><h4 class="text-xs font-bold text-white"><i class="fa-solid fa-users-gear text-violet-300 mr-1"></i>Perfis cadastrados</h4><button type="button" id="auth-refresh-profiles" class="text-[11px] text-blue-300 hover:text-white">Atualizar</button></div><div id="auth-profiles-list" class="space-y-2 max-h-64 overflow-y-auto"></div></div><div class="flex flex-wrap gap-2"><button type="button" id="auth-signout" class="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">Sair</button></div></div>' +
        '<div id="auth-message" class="text-xs min-h-5 mt-4"></div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function(event) { if (event.target === modal) closeAuthModal(); });
    document.getElementById('auth-close').addEventListener('click', closeAuthModal);
    document.getElementById('auth-tab-login').addEventListener('click', function() { switchAuthTab('login'); });
    document.getElementById('auth-tab-signup').addEventListener('click', function() { switchAuthTab('signup'); });
    document.getElementById('auth-login-form').addEventListener('submit', signIn);
    document.getElementById('auth-signup-form').addEventListener('submit', signUp);
    document.getElementById('auth-signout').addEventListener('click', signOut);
    document.getElementById('auth-refresh-profiles').addEventListener('click', loadProfilesForAdmin);
    document.getElementById('auth-refresh-bets').addEventListener('click', loadMyBets);
  }

  function switchAuthTab(tab) {
    var login = document.getElementById('auth-login-form');
    var signup = document.getElementById('auth-signup-form');
    var loginTab = document.getElementById('auth-tab-login');
    var signupTab = document.getElementById('auth-tab-signup');
    var isLogin = tab === 'login';
    login.classList.toggle('hidden', !isLogin);
    signup.classList.toggle('hidden', isLogin);
    loginTab.className = isLogin ? 'flex-1 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold' : 'flex-1 px-3 py-2 rounded-lg text-slate-400 text-xs font-bold';
    signupTab.className = isLogin ? 'flex-1 px-3 py-2 rounded-lg text-slate-400 text-xs font-bold' : 'flex-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold';
    setMessage('');
  }

  function updateEntryButton() {
    var button = document.getElementById('auth-entry-button');
    if (!button) return;
    if (!currentSession || !currentProfile) {
      button.innerHTML = '<i class="fa-solid fa-user"></i><span class="hidden sm:inline">Entrar</span>';
      return;
    }
    if (currentProfile.role === 'admin') {
      button.innerHTML = '<i class="fa-solid fa-users-gear"></i><span class="hidden sm:inline">Administração</span>';
      button.title = 'Gerenciar usuários e perfis';
    } else {
      button.innerHTML = '<i class="fa-solid fa-user-check"></i><span class="hidden sm:inline">' + escapeHtml(currentProfile.display_name || currentSession.user.email.split('@')[0]) + '</span>';
      button.title = roleLabel(currentProfile.role);
    }
  }

  function renderAuthState() {
    createAuthModal();
    var loggedOut = document.getElementById('auth-logged-out');
    var loggedIn = document.getElementById('auth-logged-in');
    var adminPanel = document.getElementById('auth-admin-panel');
    if (!currentSession || !currentProfile) {
      loggedOut.classList.remove('hidden');
      loggedIn.classList.add('hidden');
      adminPanel.classList.add('hidden');
      return;
    }
    loggedOut.classList.add('hidden');
    loggedIn.classList.remove('hidden');
    document.getElementById('auth-profile-card').innerHTML = '<div class="text-[11px] text-slate-400">Usuário autenticado</div><div class="text-sm text-white font-bold mt-1">' + escapeHtml(currentProfile.display_name || currentSession.user.email) + '</div><div class="text-xs text-slate-400 mt-1">' + escapeHtml(currentSession.user.email) + '</div><span class="inline-flex mt-2 px-2 py-1 rounded-lg bg-violet-500/15 text-violet-200 border border-violet-500/30 text-[11px] font-bold">' + roleLabel(currentProfile.role) + '</span>';
    loadMyBets();
    if (currentProfile.role === 'admin') {
      adminPanel.classList.remove('hidden');
      loadProfilesForAdmin();
    } else {
      adminPanel.classList.add('hidden');
    }
  }

  async function loadProfile(userId) {
    var result = await supabaseClient.from('profiles').select('id, display_name, role, created_at').eq('id', userId).single();
    if (result.error) throw result.error;
    currentProfile = result.data;
    window.lotoCrossProfile = currentProfile;
    updateEntryButton();
    renderAuthState();
  }

  function parseNumArray(val) {
    if (Array.isArray(val)) return val.map(Number).filter(function(n) { return Number.isFinite(n); });
    if (typeof val === 'string') {
      try {
        var parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.map(Number).filter(function(n) { return Number.isFinite(n); });
      } catch (e) {}
      return val.split(',').map(function(s){ return parseInt(s.trim(), 10); }).filter(function(n){ return !isNaN(n); });
    }
    return [];
  }

  function renderMyBets(rows) {
    var list = document.getElementById('auth-user-bets-list');
    if (!list) return;
    if (!rows || !rows.length) {
      list.innerHTML = '<div class="text-xs text-slate-500 py-3 text-center">Nenhuma aposta salva neste perfil ainda.</div>';
      return;
    }
    list.innerHTML = rows.map(function(bet) {
      var rawNumbers = parseNumArray(bet.numbers);
      var evalRes = (window.evaluateBetResult) 
        ? window.evaluateBetResult(bet.lottery_type, bet.round, rawNumbers)
        : { isDrawn: false, hitCount: 0, amount: 0, prize: '-', mainHits: [], bonusHits: [], main: [], bonus: [] };

      // Se o sorteio já ocorreu mas no Supabase ainda constava 'pending', atualiza a linha no Supabase em segundo plano
      if (evalRes.isDrawn && bet.status === 'pending' && supabaseClient && bet.id) {
        supabaseClient.from('user_bets').update({
          status: 'drawn',
          main_numbers: evalRes.main,
          bonus_numbers: evalRes.bonus,
          prize: evalRes.amount > 0 ? evalRes.prize : '-',
          amount: evalRes.amount,
          updated_at: new Date().toISOString()
        }).eq('id', bet.id).then(function(){}).catch(function(e){ console.warn('Sync user_bet err:', e); });
        bet.status = 'drawn';
        bet.main_numbers = evalRes.main;
        bet.bonus_numbers = evalRes.bonus;
        bet.prize = evalRes.prize;
        bet.amount = evalRes.amount;
      }

      var rawDate = bet.draw_date || evalRes.drawDate || '';
      var drawDate = 'Data agendada';
      if (rawDate) {
        var dp = String(rawDate).split('T')[0].split('-');
        if (dp.length === 3) drawDate = dp[2] + '/' + dp[1] + '/' + dp[0];
        else drawDate = String(rawDate);
      }

      var id = escapeHtml(bet.id);
      var costFormatted = '¥' + Number(bet.cost || (bet.lottery_type === 'ロト７' ? 300 : 200)).toLocaleString('ja-JP');

      var statusBadge = '';
      if (evalRes.isDrawn) {
        if (evalRes.amount > 0) {
          statusBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold animate-pulse"><i class="fa-solid fa-trophy mr-1"></i>Premiado: ' + escapeHtml(evalRes.prize) + ' (¥' + Number(evalRes.amount).toLocaleString('ja-JP') + ')</span>';
        } else {
          statusBadge = '<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono"><i class="fa-solid fa-check text-emerald-400 mr-1"></i>Apurado (' + evalRes.hitCount + ' acerto' + (evalRes.hitCount === 1 ? '' : 's') + ')</span>';
        }
      } else {
        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold"><i class="fa-solid fa-hourglass-half mr-1"></i>Aguardando apuração</span>';
      }

      // Bolinhas com destaque de acerto
      var ballsHtml = rawNumbers.map(function(num) {
        var n = Number(num);
        var isHit = evalRes.mainHits && evalRes.mainHits.includes(n);
        var isBonus = evalRes.bonusHits && evalRes.bonusHits.includes(n);
        var cls = isHit 
          ? 'bg-emerald-500 text-white font-bold ring-2 ring-emerald-300 shadow-md shadow-emerald-500/30' 
          : (isBonus 
              ? 'bg-purple-600 text-white font-bold ring-2 ring-purple-300' 
              : 'bg-slate-800 text-slate-400 border border-slate-700/60');
        return '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] ' + cls + ' font-mono">' + String(n).padStart(2, '0') + '</span>';
      }).join(' ');

      var officialHtml = '';
      if (evalRes.isDrawn && evalRes.main && evalRes.main.length) {
        var mainStr = evalRes.main.map(function(n){ return String(n).padStart(2, '0'); }).join(' ');
        var bonusStr = (evalRes.bonus && evalRes.bonus.length) ? ' <span class="text-purple-400 font-bold">+ (' + evalRes.bonus.map(function(n){ return String(n).padStart(2, '0'); }).join(', ') + ')</span>' : '';
        officialHtml = '<div class="text-[10px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-1"><span>Sorteio oficial: <strong class="text-slate-200 font-mono">' + mainStr + '</strong>' + bonusStr + '</span></div>';
      }

      return '<div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition space-y-1.5">' +
        '<div class="flex items-center justify-between gap-2">' +
          '<div class="flex items-center gap-1.5">' +
            '<span class="text-xs text-white font-bold">' + escapeHtml(bet.lottery_type) + '</span>' +
            '<span class="text-xs text-slate-400 font-medium">· ' + escapeHtml(bet.round) + '</span>' +
          '</div>' +
          statusBadge +
        '</div>' +
        '<div class="flex flex-wrap gap-1 items-center mt-1">' + ballsHtml + '</div>' +
        officialHtml +
        '<div class="flex items-center justify-between text-[10px] text-slate-500 pt-1">' +
          '<span>Sorteio: ' + escapeHtml(drawDate) + ' · ' + costFormatted + '</span>' +
          '<div class="flex gap-3">' +
            '<button type="button" class="text-[11px] text-blue-400 hover:text-blue-300 font-medium" onclick="window.editProfileBet(\'' + id + '\')"><i class="fa-solid fa-pen mr-1"></i>Editar</button>' +
            '<button type="button" class="text-[11px] text-rose-400 hover:text-rose-300 font-medium" onclick="window.deleteProfileBet(\'' + id + '\')"><i class="fa-solid fa-trash mr-1"></i>Excluir</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  async function loadMyBets() {
    if (!currentSession || !supabaseClient) {
      var emptyList = document.getElementById('auth-user-bets-list');
      if (emptyList) emptyList.innerHTML = '<div class="text-xs text-slate-500">Entre para consultar suas apostas.</div>';
      return;
    }
    createAuthModal();
    var list = document.getElementById('auth-user-bets-list');
    if (!list) return;
    list.innerHTML = '<div class="text-xs text-slate-500">Carregando suas apostas...</div>';
    var result = await supabaseClient.from('user_bets').select('id, lottery_type, round, draw_date, cost, numbers, status, created_at').eq('user_id', currentSession.user.id).order('created_at', { ascending: false });
    if (result.error) {
      list.innerHTML = '<div class="text-xs text-rose-300">Não foi possível carregar suas apostas: ' + escapeHtml(result.error.message) + '</div>';
      return;
    }
    var rows = result.data || [];
    rows.forEach(function(row) { row.profileBetId = row.id; });
    try {
      var details = await supabaseClient.from('user_bets').select('id, main_numbers, bonus_numbers, prize, amount, updated_at').eq('user_id', currentSession.user.id);
      if (!details.error) {
        var detailsById = {};
        (details.data || []).forEach(function(row) { detailsById[row.id] = row; });
        rows = rows.map(function(row) { return Object.assign({}, row, detailsById[row.id] || {}); });
      }
    } catch (error) {
      console.warn('Detalhes opcionais das apostas ainda não disponíveis:', error.message);
    }
    renderMyBets(rows);
    if (typeof window.applySupabaseUserBets === 'function') window.applySupabaseUserBets(rows);
  }

  async function loadDefaultBetsFromSupabase() {
    if (!currentSession || !supabaseClient) return;
    var result = await supabaseClient.from('user_default_bets').select('lottery_type, numbers, updated_at').eq('user_id', currentSession.user.id);
    if (result.error) {
      console.warn('Não foi possível carregar as cartelas padrão do perfil:', result.error.message);
      return;
    }
    if (typeof window.applySupabaseDefaultBets === 'function') window.applySupabaseDefaultBets(result.data || []);
  }

  window.saveDefaultBetsToSupabase = async function(defaultBets) {
    if (!supabaseClient || !currentSession) return { ok: false, skipped: true };
    var rows = Object.keys(defaultBets || {}).map(function(type) {
      return {
        user_id: currentSession.user.id,
        lottery_type: type,
        numbers: Array.isArray(defaultBets[type]) ? defaultBets[type] : [],
        updated_at: new Date().toISOString()
      };
    }).filter(function(row) { return row.numbers.length > 0; });
    var result = await supabaseClient.from('user_default_bets').upsert(rows, { onConflict: 'user_id,lottery_type' });
    if (result.error) return { ok: false, error: result.error };
    return { ok: true };
  };

  window.saveBetToSupabase = async function(bet) {
    if (!supabaseClient || !currentSession) return { ok: false, skipped: true };
    var payload = {
      user_id: currentSession.user.id,
      lottery_type: bet.type,
      round: bet.round,
      draw_date: bet.date || null,
      cost: Number(bet.cost || 0),
      numbers: Array.isArray(bet.numbers) ? bet.numbers : [],
      status: bet.status || 'pending',
      main_numbers: Array.isArray(bet.main) ? bet.main : [],
      bonus_numbers: Array.isArray(bet.bonus) ? bet.bonus : [],
      prize: bet.prize || '-',
      amount: Number(bet.amount || 0),
      updated_at: new Date().toISOString()
    };
    var result;
    if (bet.id) {
      result = await supabaseClient.from('user_bets').update(payload).eq('id', bet.id).eq('user_id', currentSession.user.id);
    } else {
      result = await supabaseClient.from('user_bets').insert(payload).select('id').single();
    }
    if (result.error) {
      return { ok: false, error: result.error };
    }
    await loadMyBets();
    return { ok: true, id: result.data && result.data.id ? result.data.id : bet.id };
  };

  window.refreshMyBets = loadMyBets;

  window.deleteProfileBet = async function(id) {
    if (!supabaseClient || !currentSession || !id) return;
    if (!window.confirm('Excluir esta aposta do perfil?')) return;
    var result = await supabaseClient.from('user_bets').delete().eq('id', id).eq('user_id', currentSession.user.id);
    if (result.error) {
      setMessage('Não foi possível excluir a aposta: ' + result.error.message, 'error');
      return;
    }
    if (typeof window.removeProfileBet === 'function') window.removeProfileBet(id);
    await loadMyBets();
  };

  window.editProfileBet = async function(id) {
    if (!supabaseClient || !currentSession || !id) return;
    var result = await supabaseClient.from('user_bets').select('id, lottery_type, round, draw_date, cost, numbers').eq('id', id).eq('user_id', currentSession.user.id).single();
    if (result.error) {
      setMessage('Não foi possível carregar a aposta para edição: ' + result.error.message, 'error');
      return;
    }
    if (typeof window.openBetEditor === 'function') window.openBetEditor(result.data);
  };

  async function signIn(event) {
    event.preventDefault();
    setMessage('Entrando...');
    var result = await supabaseClient.auth.signInWithPassword({ email: document.getElementById('auth-login-email').value.trim(), password: document.getElementById('auth-login-password').value });
    if (result.error) return setMessage(result.error.message, 'error');
    setMessage('Login realizado.');
  }

  async function signUp(event) {
    event.preventDefault();
    setMessage('Criando conta...');
    pendingAuthFlow = 'signup';
    var name = document.getElementById('auth-signup-name').value.trim();
    var redirectTo = (location.protocol === 'http:' || location.protocol === 'https:') ? location.origin : 'https://baito.online';
    var result = await supabaseClient.auth.signUp({ email: document.getElementById('auth-signup-email').value.trim(), password: document.getElementById('auth-signup-password').value, options: { data: { display_name: name }, emailRedirectTo: redirectTo } });
    if (result.error) {
      pendingAuthFlow = '';
      return setMessage(result.error.message, 'error');
    }
    setMessage(result.data.session ? 'Conta criada e conectada.' : 'Cadastro concluído. Verifique seu e-mail e clique no link de confirmação.');
  }

  async function signOut() {
    var result = await supabaseClient.auth.signOut();
    if (result.error) return setMessage(result.error.message, 'error');
    closeAuthModal();
  }

  async function loadProfilesForAdmin() {
    if (!currentProfile || currentProfile.role !== 'admin') return;
    var list = document.getElementById('auth-profiles-list');
    if (!list) return;
    list.innerHTML = '<div class="text-xs text-slate-500">Carregando perfis...</div>';
    var result = await supabaseClient.from('profiles').select('id, display_name, role, created_at').order('created_at', { ascending: true });
    if (result.error) return list.innerHTML = '<div class="text-xs text-rose-300">' + escapeHtml(result.error.message) + '</div>';
    if (!result.data.length) return list.innerHTML = '<div class="text-xs text-slate-500">Nenhum perfil encontrado.</div>';
    list.innerHTML = result.data.map(function(profile) {
      return '<div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800"><div class="min-w-0"><div class="text-xs text-white font-semibold truncate">' + escapeHtml(profile.display_name || 'Sem nome') + '</div><div class="text-[10px] text-slate-500 truncate">' + escapeHtml(profile.id) + '</div></div><select data-profile-id="' + escapeHtml(profile.id) + '" class="profile-role-select px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-white"><option value="participant" ' + (profile.role === 'participant' ? 'selected' : '') + '>Participante</option><option value="organizer" ' + (profile.role === 'organizer' ? 'selected' : '') + '>Organizador</option><option value="admin" ' + (profile.role === 'admin' ? 'selected' : '') + '>Administrador</option></select></div>';
    }).join('');
    list.querySelectorAll('.profile-role-select').forEach(function(select) { select.addEventListener('change', function() { updateProfileRole(select.getAttribute('data-profile-id'), select.value); }); });
  }

  async function updateProfileRole(profileId, role) {
    setMessage('Atualizando perfil...');
    var result = await supabaseClient.from('profiles').update({ role: role, updated_at: new Date().toISOString() }).eq('id', profileId);
    if (result.error) return setMessage(result.error.message, 'error');
    setMessage('Perfil atualizado.');
    loadProfilesForAdmin();
  }

  function openAuthModal() {
    createAuthModal();
    renderAuthState();
    document.getElementById('modal-auth').classList.remove('hidden');
  }

  function closeAuthModal() {
    var modal = document.getElementById('modal-auth');
    if (modal) modal.classList.add('hidden');
  }

  async function initAuth() {
    if (!window.supabase || !window.supabase.createClient) return;
    var redirectState = readAuthRedirectState();
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    var initial = await supabaseClient.auth.getSession();
    currentSession = initial.data.session;
    if (currentSession) {
      try { await loadProfile(currentSession.user.id); } catch (error) { console.warn('Perfil ainda não disponível:', error.message); }
      try { await loadDefaultBetsFromSupabase(); } catch (error) { console.warn('Cartelas padrão ainda não disponíveis:', error.message); }
      try { await loadMyBets(); } catch (error) { console.warn('Apostas do perfil ainda não disponíveis:', error.message); }
    }
    showAuthRedirectMessage(redirectState);
    cleanAuthRedirectUrl();
    updateEntryButton();
    var button = document.getElementById('auth-entry-button');
    if (button) button.addEventListener('click', openAuthModal);
    supabaseClient.auth.onAuthStateChange(function(event, session) {
      currentSession = session;
      currentProfile = null;
      if (session) setTimeout(function() {
        loadProfile(session.user.id).then(function() {
          return loadDefaultBetsFromSupabase().then(loadMyBets);
        }).then(function() {
          if (pendingAuthFlow === 'signup') setMessage('Cadastro concluído e conta confirmada com sucesso.', 'success');
          pendingAuthFlow = '';
        }).catch(function(error) {
          console.warn('Perfil ainda não disponível:', error.message);
          if (pendingAuthFlow === 'signup') {
            setMessage('Cadastro concluído. Sua conta já existe; atualize a página para carregar o perfil.', 'success');
            pendingAuthFlow = '';
          } else {
            setMessage('Não foi possível carregar o perfil. Tente atualizar a página.', 'error');
          }
        });
      }, 0);
      else {
        window.lotoCrossProfile = null;
        updateEntryButton();
        if (typeof window.clearSupabaseUserBets === 'function') window.clearSupabaseUserBets();
      }
    });
  }

  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAuth);
  else initAuth();
}());
