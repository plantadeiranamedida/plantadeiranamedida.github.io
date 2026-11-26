/*
 * Plantadeira na Medida: núcleo de cálculo.
 * Usado pela calculadora (navegador: window.PNM) e pelos geradores de tabela (Node: require).
 * Só matemática de regulagem e conferência. Nenhuma recomendação agronômica:
 * população de sementes, dose de adubo e germinação são informadas pelo usuário/responsável técnico.
 */
(function (root) {
  'use strict';

  var M2_POR_HA = 10000;

  // Unidades de área usuais no Brasil (m²). Valores tradicionais; variam por região.
  var UNIDADES_AREA = {
    hectare: { nome: 'Hectare (ha)', m2: 10000 },
    alqueire_paulista: { nome: 'Alqueire paulista', m2: 24200 },
    alqueire_mineiro: { nome: 'Alqueire mineiro / goiano', m2: 48400 },
    alqueire_baiano: { nome: 'Alqueire baiano', m2: 96800 },
    alqueire_do_norte: { nome: 'Alqueire do norte', m2: 27225 },
    tarefa_baiana: { nome: 'Tarefa baiana', m2: 4356 },
    metro_quadrado: { nome: 'Metro quadrado (m²)', m2: 1 }
  };

  function num(v, nome) {
    var n = typeof v === 'string' ? Number(v.replace(/\./g, '').replace(',', '.')) : Number(v);
    if (!isFinite(n)) throw new Error('Valor inválido em ' + (nome || 'campo') + '.');
    return n;
  }
  function positivo(v, nome) {
    var n = num(v, nome);
    if (n <= 0) throw new Error('Informe ' + (nome || 'um valor') + ' maior que zero.');
    return n;
  }
  function pct(real, esperado) { return (real - esperado) / esperado * 100; }

  /** Metros lineares de linha de plantio em 1 hectare. */
  function metrosLinearesPorHa(espacamentoCm) {
    var e = positivo(espacamentoCm, 'o espaçamento') / 100;
    return M2_POR_HA / e;
  }

  /**
   * Sementes por metro a partir da população desejada.
   * germinacao (%) é opcional: se informada, aumenta a quantidade distribuída para compensar.
   */
  function sementes(p) {
    var pop = positivo(p.populacao, 'a população (sementes por hectare)');
    var esp = positivo(p.espacamentoCm, 'o espaçamento');
    var germ = p.germinacao == null || p.germinacao === '' ? 100 : positivo(p.germinacao, 'a germinação');
    if (germ > 100) throw new Error('A germinação vai de 1 a 100%.');
    var mlha = metrosLinearesPorHa(esp);
    var distribuirHa = pop / (germ / 100);
    var porMetro = distribuirHa / mlha;
    var metros = p.metrosTeste == null || p.metrosTeste === '' ? null : positivo(p.metrosTeste, 'os metros do teste');
    return {
      metrosLinearesHa: mlha,
      sementesDistribuirHa: distribuirHa,
      porMetro: porMetro,
      distanciaCm: 100 / porMetro,
      noTeste: metros ? porMetro * metros : null,
      metrosTeste: metros
    };
  }

  /** Conferência: sementes contadas em X metros (uma linha). */
  function conferirSementes(p) {
    var contadas = num(p.contadas, 'as sementes contadas');
    if (contadas < 0) throw new Error('As sementes contadas não podem ser negativas.');
    var metros = positivo(p.metros, 'os metros contados');
    var esp = positivo(p.espacamentoCm, 'o espaçamento');
    var porMetro = contadas / metros;
    var r = {
      porMetro: porMetro,
      porHa: porMetro * metrosLinearesPorHa(esp),
      distanciaCm: porMetro > 0 ? 100 / porMetro : null
    };
    if (p.esperadoPorMetro != null && p.esperadoPorMetro !== '') {
      var esp2 = positivo(p.esperadoPorMetro, 'o esperado por metro');
      r.diferencaPct = pct(porMetro, esp2);
    }
    return r;
  }

  /** Adubo: gramas por metro e gramas no teste, a partir de kg/ha. */
  function adubo(p) {
    var kgha = positivo(p.kgHa, 'a dose em kg por hectare');
    var esp = positivo(p.espacamentoCm, 'o espaçamento');
    var mlha = metrosLinearesPorHa(esp);
    var gm = kgha * 1000 / mlha;
    var metros = p.metrosTeste == null || p.metrosTeste === '' ? null : positivo(p.metrosTeste, 'os metros do teste');
    var linhas = p.linhas == null || p.linhas === '' ? null : positivo(p.linhas, 'o número de linhas');
    return {
      metrosLinearesHa: mlha,
      gramasPorMetro: gm,
      gramasNoTestePorLinha: metros ? gm * metros : null,
      gramasNoTesteTodasLinhas: metros && linhas ? gm * metros * linhas : null,
      metrosTeste: metros,
      linhas: linhas
    };
  }

  /** Conferência do adubo: gramas coletados por linha em X metros. Aceita uma ou várias linhas. */
  function conferirAdubo(p) {
    var metros = positivo(p.metros, 'os metros do teste');
    var esp = positivo(p.espacamentoCm, 'o espaçamento');
    var lista = Array.isArray(p.gramas) ? p.gramas : [p.gramas];
    var g = lista.map(function (x, i) {
      var v = num(x, 'os gramas da linha ' + (i + 1));
      if (v < 0) throw new Error('Os gramas não podem ser negativos.');
      return v;
    });
    if (!g.length) throw new Error('Informe os gramas coletados.');
    var fator = 10 / (esp / 100); // g/m -> kg/ha
    var linhas = g.map(function (v) { return { gramas: v, gramasPorMetro: v / metros, kgHa: v / metros * fator }; });
    var media = g.reduce(function (a, b) { return a + b; }, 0) / g.length;
    var dp = Math.sqrt(g.reduce(function (a, b) { return a + Math.pow(b - media, 2); }, 0) / g.length);
    var r = {
      linhas: linhas,
      mediaGramas: media,
      kgHaMedio: media / metros * fator,
      variacaoEntreLinhasPct: media > 0 ? dp / media * 100 : 0
    };
    if (p.kgHaDesejado != null && p.kgHaDesejado !== '') {
      var alvo = positivo(p.kgHaDesejado, 'a dose desejada');
      r.diferencaPct = pct(r.kgHaMedio, alvo);
      r.linhas.forEach(function (l) { l.diferencaPct = pct(l.kgHa, alvo); });
    }
    return r;
  }

  /** Distância percorrida a partir das voltas da roda motriz (teste com a roda suspensa ou contando voltas). */
  function distanciaPorVoltas(p) {
    var voltas = positivo(p.voltas, 'o número de voltas');
    var perimetro;
    if (p.perimetroCm != null && p.perimetroCm !== '') perimetro = positivo(p.perimetroCm, 'o perímetro da roda');
    else perimetro = Math.PI * positivo(p.diametroCm, 'o diâmetro da roda');
    var patinagem = p.patinagemPct == null || p.patinagemPct === '' ? 0 : num(p.patinagemPct, 'a patinagem');
    if (patinagem < 0 || patinagem >= 100) throw new Error('A patinagem vai de 0 a 99%.');
    return { metros: voltas * perimetro / 100 * (1 - patinagem / 100), perimetroCm: perimetro };
  }

  /**
   * Catracas (transmissão por corrente). A quantidade distribuída é proporcional à relação motora/movida.
   * Calcula a relação nova e sugere combinações com as catracas que a pessoa tem.
   */
  function catracas(p) {
    var mot = positivo(p.motoraAtual, 'os dentes da catraca motora atual');
    var mov = positivo(p.movidaAtual, 'os dentes da catraca movida atual');
    var real = positivo(p.resultadoAtual, 'o resultado medido');
    var alvo = positivo(p.resultadoDesejado, 'o resultado desejado');
    var relAtual = mot / mov;
    var relNova = relAtual * alvo / real;
    var motoras = (p.motorasDisponiveis || []).map(Number).filter(function (x) { return x > 0; });
    var movidas = (p.movidasDisponiveis || []).map(Number).filter(function (x) { return x > 0; });
    var combos = [];
    motoras.forEach(function (a) {
      movidas.forEach(function (b) {
        var rel = a / b;
        combos.push({ motora: a, movida: b, relacao: rel, resultadoPrevisto: real * rel / relAtual, erroPct: pct(rel, relNova) });
      });
    });
    combos.sort(function (x, y) { return Math.abs(x.erroPct) - Math.abs(y.erroPct); });
    return { relacaoAtual: relAtual, relacaoNova: relNova, ajustePct: pct(relNova, relAtual), sugestoes: combos.slice(0, 5) };
  }

  /** Converte área para hectares. */
  function areaEmHa(valor, unidade) {
    var u = UNIDADES_AREA[unidade || 'hectare'];
    if (!u) throw new Error('Unidade de área desconhecida.');
    return positivo(valor, 'a área') * u.m2 / M2_POR_HA;
  }

  /** Planejamento da safra: total de sementes e de adubo para a área. */
  function planejamento(p) {
    var ha = areaEmHa(p.area, p.unidade);
    var r = { hectares: ha };
    if (p.populacao != null && p.populacao !== '') {
      var germ = p.germinacao == null || p.germinacao === '' ? 100 : positivo(p.germinacao, 'a germinação');
      r.sementesTotal = positivo(p.populacao, 'a população') / (germ / 100) * ha;
      if (p.sementesPorSaco) r.sacosSementes = r.sementesTotal / positivo(p.sementesPorSaco, 'as sementes por saco');
    }
    if (p.kgHa != null && p.kgHa !== '') {
      r.aduboKg = positivo(p.kgHa, 'a dose de adubo') * ha;
      if (p.kgPorSacoAdubo) r.sacosAdubo = r.aduboKg / positivo(p.kgPorSacoAdubo, 'o peso do saco de adubo');
    }
    return r;
  }

  /** Formata número no padrão brasileiro. */
  function fmt(n, casas) {
    if (n == null || !isFinite(n)) return '-';
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas || 0, maximumFractionDigits: casas || 0 });
  }

  var api = {
    UNIDADES_AREA: UNIDADES_AREA,
    metrosLinearesPorHa: metrosLinearesPorHa,
    sementes: sementes,
    conferirSementes: conferirSementes,
    adubo: adubo,
    conferirAdubo: conferirAdubo,
    distanciaPorVoltas: distanciaPorVoltas,
    catracas: catracas,
    areaEmHa: areaEmHa,
    planejamento: planejamento,
    fmt: fmt
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PNM = api;
})(this);
