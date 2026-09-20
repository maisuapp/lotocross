(function() {
  'use strict';

  var runId = 0;
  var totalTrials = 2500;

  function configFor(type) {
    if (type === 'ロト７') return { count: 7, max: 37, targetSum: 133 };
    if (type === 'ミニロト') return { count: 5, max: 31, targetSum: 80 };
    return { count: 6, max: 43, targetSum: 132 };
  }

  function candidateFor(type, method) {
    var config = configFor(type);
    if (method === 'TAUFIC') return runTauficMethod(type);
    if (method === 'HIGHNUM') return runHighNumbersMethod(type);
    if (method === 'HOTCOLD') return runHotColdMethod(type);
    if (method === 'ODDEVEN') return runOddEvenMethod(type);
    if (method === 'CLUSTERING') return runClusteringMethod(type);
    if (method === 'WHEELING') return runWheelingMethod(type);
    return sampleArray(createRange(1, config.max), config.count).sort(function(a, b){ return a - b; });
  }

  function frequencyScore(type, numbers) {
    var counts = {};
    var maxCount = 0;
    (APP_STATE.history || []).forEach(function(item) {
      if (item.type !== type || !item.main || !item.main.length) return;
      item.main.forEach(function(number) {
        counts[number] = (counts[number] || 0) + 1;
        maxCount = Math.max(maxCount, counts[number]);
      });
    });
    if (!maxCount) return 50;
    var total = numbers.reduce(function(sum, number){ return sum + (counts[number] || 0); }, 0);
    return total / (numbers.length * maxCount) * 100;
  }

  function scoreNumbers(type, method, numbers) {
    var config = configFor(type);
    var count = numbers.length;
    var sum = numbers.reduce(function(a, b){ return a + b; }, 0);
    var base = 50;

    if (method === 'TAUFIC') {
      var quadrants = [0, 0, 0, 0];
      numbers.forEach(function(number) {
        quadrants[Math.min(3, Math.floor((number - 1) / (config.max / 4)))]++;
      });
      var target = count / 4;
      var deviation = quadrants.reduce(function(total, value){ return total + Math.abs(value - target); }, 0);
      base = 100 - deviation * 22;
    } else if (method === 'FORMULA70') {
      var ranges = type === 'ロト７' ? [115, 155] : (type === 'ロト６' ? [110, 150] : [65, 95]);
      var center = (ranges[0] + ranges[1]) / 2;
      var distance = sum < ranges[0] ? ranges[0] - sum : (sum > ranges[1] ? sum - ranges[1] : Math.abs(sum - center) * 0.35);
      base = Math.max(0, 100 - distance * 2.2);
    } else if (method === 'TARGETSUM') {
      base = Math.max(0, 100 - Math.abs(sum - config.targetSum) * 7);
    } else if (method === 'HIGHNUM') {
      var expectedHigh = type === 'ロト７' ? 3 : (type === 'ロト６' ? 3 : 2);
      var highCount = numbers.filter(function(number){ return number >= 32; }).length;
      base = Math.max(0, 100 - Math.abs(highCount - expectedHigh) * 28);
    } else if (method === 'HOTCOLD') {
      var hot = type === 'ロト７'
        ? getNumList('13,22,26,31,35,36,9,15')
        : (type === 'ロト６' ? getNumList('6,21,24,31,38,7,37,43,20') : getNumList('2,11,19,21,28,5,12,20'));
      var expectedHot = Math.round(count * 0.6);
      var hotCount = numbers.filter(function(number){ return hot.indexOf(number) !== -1; }).length;
      base = Math.max(0, 100 - Math.abs(hotCount - expectedHot) * 28);
    } else if (method === 'ODDEVEN') {
      var targetOdds = type === 'ロト７' ? 4 : 3;
      var oddCount = numbers.filter(function(number){ return number % 2 !== 0; }).length;
      base = Math.max(0, 100 - Math.abs(oddCount - targetOdds) * 28);
    } else if (method === 'CLUSTERING') {
      var decades = {};
      numbers.forEach(function(number) {
        var decade = Math.floor((number - 1) / 10);
        decades[decade] = (decades[decade] || 0) + 1;
      });
      var overflow = Object.keys(decades).reduce(function(total, key){ return total + Math.max(0, decades[key] - 2); }, 0);
      base = Math.max(0, 100 - overflow * 35);
    }

    return Math.max(0, Math.min(100, base * 0.8 + frequencyScore(type, numbers) * 0.2));
  }

  function scoreCandidate(type, method, candidate) {
    if (method !== 'WHEELING') return scoreNumbers(type, method, candidate);
    var pool = candidate.pool || [];
    var games = candidate.games || [];
    var union = new Set();
    games.forEach(function(game){ game.forEach(function(number){ union.add(number); }); });
    var coverage = pool.length ? union.size / pool.length * 100 : 0;
    var balance = games.length ? games.reduce(function(total, game){ return total + scoreNumbers(type, 'ODDEVEN', game); }, 0) / games.length : 0;
    return coverage * 0.65 + balance * 0.35;
  }

  function methodTitle(method) {
    var titles = {
      TAUFIC: 'Esquema Taufic Darhal (4 Quadrantes)',
      WHEELING: 'Fechamento Combinatório por Roda',
      FORMULA70: 'Fórmula dos 70% (Curva de Gauss)',
      TARGETSUM: 'Rastreador de Soma Alvo',
      HIGHNUM: 'Estratégia dos Números Altos (32+)',
      HOTCOLD: 'Frequência Hot & Cold (60/40)',
      ODDEVEN: 'Equilíbrio de Paridade Par/Ímpar',
      CLUSTERING: 'Dispersão Espacial por Décadas'
    };
    return titles[method] || 'Método Matemático Otimizado';
  }

  function executeActiveStrategy() {
    var type = document.getElementById('strat-lotto-type').value;
    var method = currentSelectedMethod;
    var area = document.getElementById('strat-result-area');
    var button = document.getElementById('btn-execute-strategy');
    if (!area) return;

    var currentRun = ++runId;
    if (stratAnimationTimer) clearTimeout(stratAnimationTimer);
    if (stratShufflerTimer) clearInterval(stratShufflerTimer);

    var config = configFor(type);
    var title = methodTitle(method);
    if (button) {
      button.disabled = true;
      button.classList.add('opacity-80', 'cursor-not-allowed');
      button.innerHTML = '<i class="fa-solid fa-gear fa-spin text-amber-300"></i> Calculando Matriz...';
    }

    area.innerHTML =
      '<div class="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-indigo-500/40 shadow-2xl space-y-4 animate-fade-in">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">' +
          '<div class="flex items-center gap-2"><span class="relative flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span></span><span class="text-xs font-black uppercase tracking-wider text-indigo-300">Motor Combinatório em Tempo Real</span></div>' +
          '<span class="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold">' + title + '</span>' +
        '</div>' +
        '<div class="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/25 text-center relative overflow-hidden">' +
          '<div class="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-blue-500/10 to-emerald-500/5 pointer-events-none"></div>' +
          '<div class="text-[11px] text-slate-400 mb-2.5 font-mono flex items-center justify-center gap-2"><i class="fa-solid fa-atom fa-spin text-amber-400"></i><span id="live-calc-shuffler-title">Varrendo e avaliando combinações reais...</span></div>' +
          '<div class="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 py-1">' +
            Array.from({ length: config.count }).map(function(_, index){ return '<span class="ball ball-md font-mono bg-slate-800 text-slate-400 border border-slate-700 shadow-inner transition-all duration-150" id="live-ball-' + index + '">--</span>'; }).join('') +
          '</div>' +
        '</div>' +
        '<div class="space-y-1.5"><div class="flex items-center justify-between text-xs text-slate-300 font-mono"><span id="live-calc-step-label" class="flex items-center gap-1.5"><i class="fa-solid fa-microchip text-indigo-400"></i> Passo 1/4: Preparando critérios de avaliação...</span><span id="live-calc-percentage" class="text-emerald-400 font-extrabold font-mono">15%</span></div><div class="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/80"><div id="live-calc-progress" class="bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 h-2.5 rounded-full transition-all duration-300" style="width: 15%;"></div></div></div>' +
        '<div class="p-3 rounded-xl bg-slate-900/95 border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300 h-28 overflow-hidden relative shadow-inner" id="live-calc-terminal"><div class="text-indigo-400">&gt; Inicializando avaliação de ' + totalTrials.toLocaleString('pt-BR') + ' combinações para ' + type + '...</div></div>' +
      '</div>';

    var terminal = document.getElementById('live-calc-terminal');
    var progress = document.getElementById('live-calc-progress');
    var percentage = document.getElementById('live-calc-percentage');
    var stepLabel = document.getElementById('live-calc-step-label');
    var liveTitle = document.getElementById('live-calc-shuffler-title');

    function addLog(message, color) {
      if (!terminal) return;
      var line = document.createElement('div');
      line.className = color || 'text-slate-300';
      line.textContent = '> ' + message;
      terminal.appendChild(line);
      terminal.scrollTop = terminal.scrollHeight;
    }

    function updateBalls(candidate, best) {
      var numbers = method === 'WHEELING' ? ((candidate && candidate.games && candidate.games[0]) || []) : (candidate || []);
      for (var index = 0; index < config.count; index++) {
        var ball = document.getElementById('live-ball-' + index);
        if (!ball) continue;
        ball.textContent = numbers[index] === undefined ? '--' : String(numbers[index]).padStart(2, '0');
        ball.className = best
          ? 'ball ball-md font-mono ball-hit animate-roll shadow-lg shadow-emerald-500/30'
          : 'ball ball-md font-mono ball-quickpick transition-all duration-100 scale-105';
      }
    }

    var trials = 0;
    var bestCandidate = null;
    var bestScore = -1;
    var lastCandidate = null;
    var batchSize = 50;

    function finish() {
      if (button) {
        button.disabled = false;
        button.classList.remove('opacity-80', 'cursor-not-allowed');
        button.innerHTML = '<i class="fa-solid fa-bolt text-amber-300"></i> Gerar Aposta Otimizada';
      }
      var isWheel = method === 'WHEELING';
      if (!isWheel) {
        lastGeneratedStrategyNumbers = bestCandidate;
        var sum = bestCandidate.reduce(function(a, b){ return a + b; }, 0);
        var odds = bestCandidate.filter(function(number){ return number % 2 !== 0; }).length;
        var evens = bestCandidate.length - odds;
        area.innerHTML =
          '<div class="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-indigo-500/30 shadow-2xl space-y-4 animate-fade-in">' +
            '<div class="flex items-center justify-between border-b border-slate-800 pb-3"><div class="flex items-center gap-2"><span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold"><i class="fa-solid fa-circle-check"></i> Cálculo concluído</span><span class="text-xs text-slate-400 font-mono hidden sm:inline">' + title + '</span></div><span class="text-xs text-indigo-300 font-bold font-mono bg-indigo-900/40 px-2.5 py-1 rounded-lg border border-indigo-500/30">' + type + '</span></div>' +
            '<div><div class="text-xs text-slate-400 mb-2"><i class="fa-solid fa-fire text-amber-400"></i> Melhor combinação encontrada:</div><div class="flex flex-wrap items-center gap-2">' + bestCandidate.map(function(number, index){ return '<span class="ball ball-md ball-quickpick font-mono animate-roll shadow-lg shadow-blue-600/30" style="animation-delay: ' + (index * 0.08) + 's;">' + String(number).padStart(2, '0') + '</span>'; }).join('') + '</div></div>' +
            '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs"><div class="bg-slate-800/60 p-2.5 rounded-xl"><span class="text-slate-400 block text-[11px]">Soma:</span><strong class="text-white font-mono text-sm">' + sum + '</strong></div><div class="bg-slate-800/60 p-2.5 rounded-xl"><span class="text-slate-400 block text-[11px]">Paridade:</span><strong class="text-white font-mono text-sm">' + odds + ' Ímp / ' + evens + ' Par</strong></div><div class="bg-slate-800/60 p-2.5 rounded-xl"><span class="text-slate-400 block text-[11px]">Avaliações:</span><strong class="text-indigo-300 font-mono text-sm">' + totalTrials.toLocaleString('pt-BR') + '</strong></div><div class="bg-slate-800/60 p-2.5 rounded-xl"><span class="text-slate-400 block text-[11px]">Pontuação:</span><strong class="text-emerald-400 font-mono text-sm">' + bestScore.toFixed(1) + '/100</strong></div></div>' +
            '<div class="flex items-center justify-between pt-2 border-t border-slate-800"><button onclick="executeActiveStrategy();" class="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"><i class="fa-solid fa-arrows-rotate text-amber-400"></i> Recalcular</button><div class="flex gap-2"><button onclick="copyStrategyGame(' + "'" + bestCandidate.join(', ') + "'" + ')" class="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"><i class="fa-solid fa-copy"></i> Copiar</button><button onclick="loadStrategyAsBet(' + "'" + type + "'" + ', ' + "'" + bestCandidate.join(', ') + "'" + ')" class="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"><i class="fa-solid fa-plus"></i> Registrar Como Minha Aposta</button></div></div>' +
          '</div>';
      } else {
        var pool = bestCandidate.pool;
        var games = bestCandidate.games;
        lastGeneratedStrategyNumbers = games[0] || [];
        area.innerHTML =
          '<div class="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-blue-500/30 shadow-2xl space-y-4 animate-fade-in">' +
            '<div class="flex items-center justify-between border-b border-slate-800 pb-3"><span class="text-xs font-bold text-blue-300"><i class="fa-solid fa-dharmachakra"></i> Fechamento calculado</span><span class="text-xs text-blue-300 font-mono">' + type + '</span></div>' +
            '<div class="text-xs text-slate-300 bg-slate-800/60 p-2.5 rounded-xl"><span class="text-slate-400 font-bold">Dezenas base:</span> <strong class="text-amber-400 font-mono">' + pool.map(function(number){ return String(number).padStart(2, '0'); }).join(', ') + '</strong></div>' +
            '<div class="text-xs text-slate-400">Foram comparadas ' + totalTrials.toLocaleString('pt-BR') + ' matrizes; melhor pontuação: <strong class="text-emerald-400">' + bestScore.toFixed(1) + '/100</strong>.</div>' +
            '<div class="space-y-2">' + games.map(function(game, gameIndex){ return '<div class="flex items-center gap-2"><span class="text-xs font-bold text-blue-300">Jogo ' + (gameIndex + 1) + '</span><div class="flex flex-wrap gap-1.5">' + game.map(function(number){ return '<span class="ball ball-sm ball-quickpick font-mono">' + String(number).padStart(2, '0') + '</span>'; }).join('') + '</div><button onclick="loadStrategyAsBet(' + "'" + type + "'" + ', ' + "'" + game.join(', ') + "'" + ')" class="text-xs px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-300">+ Apostar</button></div>'; }).join('') + '</div>' +
            '<div class="flex justify-between pt-2 border-t border-slate-800"><button onclick="executeActiveStrategy();" class="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"><i class="fa-solid fa-arrows-rotate text-amber-400"></i> Gerar Outro</button><button onclick="copyStrategyGame(' + "'" + games.map(function(game){ return game.join(', '); }).join(' | ') + "'" + ')" class="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"><i class="fa-solid fa-copy"></i> Copiar Todos</button></div>' +
          '</div>';
      }
    }

    function processBatch() {
      if (currentRun !== runId) return;
      var improved = false;
      for (var index = 0; index < batchSize && trials < totalTrials; index++) {
        var candidate = candidateFor(type, method);
        var score = scoreCandidate(type, method, candidate);
        lastCandidate = candidate;
        trials++;
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
          improved = true;
        }
      }

      var percent = 15 + trials / totalTrials * 80;
      if (progress) progress.style.width = percent.toFixed(1) + '%';
      if (percentage) percentage.textContent = percent.toFixed(1) + '%';
      if (stepLabel) stepLabel.innerHTML = '<i class="fa-solid fa-chart-line text-blue-400"></i> Passo 2/4: Avaliando combinação ' + trials.toLocaleString('pt-BR') + ' de ' + totalTrials.toLocaleString('pt-BR') + '...';
      if (liveTitle) liveTitle.textContent = improved ? 'Novo melhor resultado encontrado; refinando pontuação...' : 'Comparando candidatos com os critérios da estratégia...';
      updateBalls(lastCandidate, improved);
      if (trials % 250 === 0 || trials === totalTrials) addLog('Lote concluído: ' + trials.toLocaleString('pt-BR') + '/' + totalTrials.toLocaleString('pt-BR') + ' | melhor pontuação: ' + bestScore.toFixed(1) + '/100', improved ? 'text-emerald-400' : 'text-blue-300');

      if (trials < totalTrials) {
        stratAnimationTimer = setTimeout(processBatch, 24);
        return;
      }

      if (progress) progress.style.width = '100%';
      if (percentage) percentage.textContent = '100%';
      if (stepLabel) stepLabel.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i> Passo 4/4: Cálculo concluído após ' + totalTrials.toLocaleString('pt-BR') + ' avaliações reais.';
      if (liveTitle) liveTitle.textContent = 'Combinação final selecionada pela maior pontuação encontrada.';
      updateBalls(bestCandidate, true);
      addLog('✓ Avaliação concluída. Melhor candidato: ' + bestScore.toFixed(1) + '/100.', 'text-emerald-400');
      finish();
    }

    addLog('Critérios carregados: ' + title + '.', 'text-blue-300');
    processBatch();
  }

  window.executeActiveStrategy = executeActiveStrategy;
})();

