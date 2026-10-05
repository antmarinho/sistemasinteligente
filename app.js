// ============================================================
// AGENTE COLETOR — CONFIGURAÇÕES PRINCIPAIS
// ============================================================

// Dimensões do tabuleiro.
const ROWS = 18, COLS = 26;

// Custo de energia para entrar em cada tipo de terreno.
const COSTS = { grass: 1, sand: 10, mud: 50, water: 100 };

// Nomes que aparecem na interface.
const TERRAIN_NAMES = { grass: 'livre', sand: 'areia', mud: 'atoleiro', water: 'água' };

// Faixas de umidade, da mais seca para a mais úmida, com a proporção de cada terreno no mapa.
// A ordem importa: terrenos vizinhos na lista tendem a ficar vizinhos no mapa.
const MOISTURE_BANDS = [['sand', 3], ['grass', 4], ['mud', 2], ['water', 2]];

// Parâmetros do ruído de Perlin. Escala menor gera regiões maiores; mais oitavas geram bordas mais irregulares.
const NOISE_SCALE = 0.11, NOISE_OCTAVES = 2;

// Velocidade relativa do agente em cada terreno.
const TERRAIN_SPEED = { grass: 100, sand: 75, mud: 45, water: 25 };

// Intervalo entre frames da busca. Quanto menor, mais rápida a animação.
const SPEEDS = { 1: 230, 2: 130, 3: 75, 4: 35, 5: 12 };
const speedLabels = { 1: 'lento', 2: 'reduzido', 3: 'normal', 4: 'rápido', 5: 'instantâneo' };

// Estado global da aplicação.
let map, start, goal, agent, running = false, collected = 0, lastSearch = null;

// Atalho para buscar elementos HTML pelo id.
const $ = id => document.getElementById(id);
const gridEl = $('grid');

// ============================================================
// ESTRUTURA DE FILA DE PRIORIDADE
// Usada por Custo Uniforme, Gulosa e A*.
// ============================================================
class PriorityQueue {
  constructor() { this.items = []; }

  // Adiciona um estado e ordena os itens pela menor prioridade.
  push(item, priority) {
    this.items.push({ item, priority, order: this.items.length });
    this.items.sort((a,b) => a.priority - b.priority || a.order - b.order);
  }

  // Retira o estado de menor prioridade.
  pop() { return this.items.shift()?.item; }

  // Permite usar a fila em uma condição while.
  get length() { return this.items.length; }

  // Retorna os estados que ainda aguardam na fronteira.
  values() { return this.items.map(x => x.item); }
}

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

// Converte uma coordenada [linha, coluna] em uma chave textual.
const key = (r,c) => `${r},${c}`;

// Converte a chave textual novamente em coordenada.
const parse = k => k.split(',').map(Number);

// Heurística Manhattan usada pela busca Gulosa e pelo A*.
const manhattan = (a,b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]);

// Cria uma pausa para controlar a animação.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Retorna um índice aleatório entre 0 e n - 1.
const rand = n => Math.floor(Math.random() * n);

// Retorna os quatro vizinhos transitáveis de uma posição.
// Obstáculos são removidos e nunca entram na busca.
function neighbors([r,c]) {
  return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]
    .filter(([nr,nc]) => nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&map[nr][nc] !== 'obstacle');
}

// Retorna o tipo de terreno de uma posição.
function terrainAt(pos) { return map[pos[0]][pos[1]]; }

// Compara duas coordenadas.
function isSame(a,b) { return a && b && a[0] === b[0] && a[1] === b[1]; }

// ============================================================
// RUÍDO DE PERLIN E DISTRIBUIÇÃO DOS TERRENOS
// ============================================================

// Cria um gerador de ruído de Perlin 2D com uma tabela de permutação nova a cada chamada.
function createPerlin() {
  const perm = Array.from({length: 256}, (_, i) => i);
  for (let i=255; i>0; i--) {
    const j = rand(i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const p = [...perm, ...perm];

  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a,b,t) => a + t * (b - a);

  // Produto escalar entre uma direção pseudoaleatória e o vetor até o ponto.
  const grad = (hash,x,y) => {
    switch (hash & 3) {
      case 0: return  x + y;
      case 1: return -x + y;
      case 2: return  x - y;
      default: return -x - y;
    }
  };

  return (x,y) => {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = p[p[xi] + yi], ab = p[p[xi] + yi + 1];
    const ba = p[p[xi + 1] + yi], bb = p[p[xi + 1] + yi + 1];
    return lerp(
      lerp(grad(aa, xf, yf),     grad(ba, xf - 1, yf),     u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    );
  };
}

// Soma várias oitavas de ruído, cada uma com o dobro da frequência e metade da amplitude.
function fractalNoise(noise, x, y) {
  let total = 0, amplitude = 1, frequency = 1, norm = 0;
  for (let i=0; i<NOISE_OCTAVES; i++) {
    total += noise(x * frequency, y * frequency) * amplitude;
    norm += amplitude;
    amplitude /= 2;
    frequency *= 2;
  }
  return total / norm;
}

// Cria uma matriz de terrenos a partir de um campo de umidade gerado com Perlin.
// As células são ordenadas pela umidade e divididas em faixas, de modo que a proporção
// de cada terreno segue MOISTURE_BANDS em qualquer mapa.
function makeTerrain() {
  const noise = createPerlin();
  const cells = [];
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    cells.push({r, c, moisture: fractalNoise(noise, c * NOISE_SCALE, r * NOISE_SCALE)});
  }
  cells.sort((a,b) => a.moisture - b.moisture);

  const terrain = Array.from({length: ROWS}, () => Array(COLS).fill('grass'));
  const totalWeight = MOISTURE_BANDS.reduce((sum, [, weight]) => sum + weight, 0);
  let accumulated = 0, index = 0;
  for (const [type, weight] of MOISTURE_BANDS) {
    accumulated += weight;
    const end = Math.round(accumulated / totalWeight * cells.length);
    for (; index < end; index++) terrain[cells[index].r][cells[index].c] = type;
  }
  return terrain;
}

// ============================================================
// GERAÇÃO DE OBSTÁCULOS
// ============================================================

// Cria uma mancha irregular de um terreno.
// minSize e maxSize controlam o tamanho mínimo e máximo da área.
// Hoje é usada apenas para estender os blocos de obstáculos.
function paintArea(targetMap, terrain, minSize, maxSize) {
  let row = rand(ROWS), col = rand(COLS);
  const size = minSize + rand(maxSize - minSize + 1);

  for (let i=0; i<size; i++) {
    targetMap[row][col] = terrain;

    // A direção aleatória faz a área ficar irregular, em vez de um retângulo perfeito.
    const directions = [[-1,0],[1,0],[0,-1],[0,1],[0,0]];
    const [dr, dc] = directions[rand(directions.length)];
    row = Math.max(0, Math.min(ROWS - 1, row + dr));
    col = Math.max(0, Math.min(COLS - 1, col + dc));
  }
}

// Cria um bloco de obstáculo com altura e largura aleatórias.
function paintObstacleCluster(targetMap) {
  const height = 1 + rand(4), width = 1 + rand(5);
  const top = rand(Math.max(1, ROWS - height + 1));
  const left = rand(Math.max(1, COLS - width + 1));

  for (let row=top; row<Math.min(ROWS, top + height); row++) {
    for (let col=left; col<Math.min(COLS, left + width); col++) {
      targetMap[row][col] = 'obstacle';
    }
  }

  // Em alguns casos, adiciona uma pequena extensão irregular ao bloco.
  if (Math.random() < .6) paintArea(targetMap, 'obstacle', 1, 5);
}

// ============================================================
// GERAÇÃO DO MAPA
// ============================================================
function makeMap() {
  // Tenta até 100 vezes para gerar um mapa com caminho possível.
  for (let attempt = 0; attempt < 100; attempt++) {
    // Distribui areia, grama, atoleiro e água em regiões contínuas com ruído de Perlin.
    const newMap = makeTerrain();

    // Sobrepõe nove agrupamentos de obstáculos com tamanhos variados.
    for (let i=0; i<9; i++) paintObstacleCluster(newMap);

    // Guarda somente posições onde agente e comida podem aparecer.
    const free = [];
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      if (newMap[r][c] !== 'obstacle') free.push([r,c]);
    }

    // Sorteia o estado inicial e o objetivo.
    const s = free[rand(free.length)], g = free[rand(free.length)];
    if (isSame(s,g)) continue;

    // Faz uma verificação de conectividade antes de aceitar o mapa.
    const queue = [s], seen = new Set([key(...s)]);
    while(queue.length){
      const p=queue.shift();
      [[p[0]-1,p[1]],[p[0]+1,p[1]],[p[0],p[1]-1],[p[0],p[1]+1]].forEach(([r,c])=>{
        if(r>=0&&r<ROWS&&c>=0&&c<COLS&&newMap[r][c]!=='obstacle'&&!seen.has(key(r,c))){
          seen.add(key(r,c));
          queue.push([r,c]);
        }
      });
    }

    // Só aceita o mapa se a comida for alcançável.
    if (seen.has(key(...g))) {
      map = newMap;
      start=s;
      goal=g;
      agent=[...s];
      return;
    }
  }

  // Fallback: mapa livre caso todas as tentativas anteriores falhem.
  map = Array.from({length:ROWS},()=>Array(COLS).fill('grass'));
  start=[1,1];
  goal=[ROWS-2,COLS-2];
  agent=[...start];
}

// ============================================================
// DESENHO DO GRID
// ============================================================
function render(state = {}) {
  const visited = state.visited || new Set();
  const frontier = state.frontier || new Set();
  const path = state.path || [];
  const pathSet = new Set(path.map(p => key(...p)));

  // Remove as células do frame anterior.
  gridEl.innerHTML = '';

  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
    const cell = document.createElement('div');
    const k = key(r,c);
    const type = map[r][c];

    // A classe do terreno define a cor original do centro da célula.
    cell.className = `cell ${type}`;

    // Estas classes são adicionadas por cima da classe do terreno.
    if (frontier.has(k)) cell.classList.add('frontier');
    if (visited.has(k)) cell.classList.add('visited');
    if (pathSet.has(k)) cell.classList.add('path');
    if (isSame(agent,[r,c])) cell.classList.add('agent');
    if (isSame(goal,[r,c])) cell.classList.add('goal');

    // Tooltip com coordenada, nome e custo do terreno.
    cell.title = `${r},${c} · ${type === 'obstacle' ? 'obstáculo' : TERRAIN_NAMES[type] + ' · custo ' + COSTS[type]}`;
    gridEl.appendChild(cell);
  }
}

// ============================================================
// RECONSTRUÇÃO E IMPLEMENTAÇÃO DAS BUSCAS
// ============================================================

// Volta dos pais até o início para reconstruir o caminho encontrado.
function reconstruct(parent, endKey) {
  const path=[];
  let cur=endKey;
  while(cur){
    path.unshift(parse(cur));
    cur=parent.get(cur);
  }
  return path;
}

// Executa BFS, DFS, UCS, Gulosa ou A*, de acordo com type.
function search(type) {
  const startKey=key(...start), goalKey=key(...goal);
  const parent=new Map();
  const best=new Map([[startKey,0]]);
  const visited=new Set();
  const events=[];
  let frontier, popNode, addNode;

  // BFS usa fila FIFO; DFS usa pilha LIFO.
  if(type==='bfs'||type==='dfs') {
    frontier=[startKey];
    popNode=()=>type==='bfs'?frontier.shift():frontier.pop();
    addNode=x=>frontier.push(x);
  // UCS, Gulosa e A* usam fila de prioridade.
  } else {
    frontier=new PriorityQueue();
    frontier.push(startKey,0);
    popNode=()=>frontier.pop();
    addNode=(x,p)=>frontier.push(x,p);
  }

  // Continua enquanto houver estados na fronteira.
  while((frontier.length ?? 0) > 0) {
    const current=popNode();
    if(!current || visited.has(current)) continue;
    visited.add(current);
    const cp=parse(current);

    // A busca termina ao retirar o objetivo da fronteira.
    if(current===goalKey){
      events.push({visited:new Set(visited),frontier:new Set(frontier.values ? frontier.values() : frontier), current});
      break;
    }

    // Expande os vizinhos transitáveis.
    for(const np of neighbors(cp)) {
      const nk=key(...np);
      if(visited.has(nk)) continue;
      const step=COSTS[terrainAt(np)];
      const g=(best.get(current)??0)+step;

      // BFS e DFS não usam custos para ordenar a fronteira.
      if(type==='bfs'||type==='dfs') {
        if(best.has(nk)) continue;
        best.set(nk,g);
        parent.set(nk,current);
        addNode(nk);
      // UCS usa g; Gulosa usa h; A* usa g + h.
      } else if(g < (best.get(nk) ?? Infinity)) {
        best.set(nk,g);
        parent.set(nk,current);
        const h=manhattan(np,goal);
        const priority=type==='ucs'?g:type==='greedy'?h:g+h;
        addNode(nk,priority);
      }
    }

    // Salva um frame para a animação mostrar visitados e fronteira.
    const frontSet = frontier.values ? new Set(frontier.values()) : new Set(frontier);
    events.push({visited:new Set(visited), frontier:frontSet, current});
  }

  const found=best.has(goalKey);
  const path=found?reconstruct(parent,goalKey):[];
  return {events,path,cost:found?(best.get(goalKey)??0):null, visitedCount:visited.size};
}

// ============================================================
// ATUALIZAÇÃO DA INTERFACE
// ============================================================
function updateStats(searchResult, phase='Busca em andamento') {
  $('visitedCount').textContent = searchResult?.visitedCount ?? 0;
  $('expansions').textContent = searchResult?.events?.length ?? 0;
  $('pathLength').textContent = searchResult?.path?.length ? `${searchResult.path.length - 1} passos` : '—';
  $('pathCost').textContent = searchResult?.cost != null ? `${searchResult.cost} energia` : '—';
  $('status').textContent = phase;
}

// Atualiza o nome do algoritmo selecionado.
function algorithmLabel() { return $('algorithm').selectedOptions[0].textContent; }

// Atualiza o título e o texto explicativo do estágio atual.
function setPhase(title,text){ $('phaseTitle').textContent=title; $('phaseText').textContent=text; }

// Cria uma nova comida sem alterar o mapa atual.
function spawnFood() {
  const options=[];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
    if(map[r][c] !== 'obstacle' && !isSame(agent,[r,c])) options.push([r,c]);
  }
  goal = options[rand(options.length)];
  start = [...agent];
  $('coordinates').textContent=`agente ${agent.join(',')} · comida ${goal.join(',')}`;
  render();
}

// Executa a busca e depois anima o deslocamento do agente.
async function runSearch() {
  if(running) return;
  running=true;
  $('runButton').disabled=true;
  $('newMapButton').disabled=true;

  const type=$('algorithm').value;
  $('statAlgorithm').textContent=algorithmLabel();
  render();
  setPhase('Explorando o ambiente','Cada frame mostra os estados que já foram visitados e os estados que aguardam na fronteira.');

  // Calcula a busca inteira, mas ainda não desenha o caminho final.
  const result=search(type);
  lastSearch=result;
  updateStats(result, 'buscando…');

  // Mostra somente cada estágio da exploração.
  for(let i=0;i<result.events.length;i++) {
    const ev=result.events[i];
    render(ev);
    $('visitedCount').textContent=ev.visited.size;
    $('expansions').textContent=i+1;
    await sleep(SPEEDS[$('speed').value]);
  }

  // Se não encontrou a comida, não desenha caminho.
  if(!result.path.length) {
    setPhase('Sem caminho possível','A busca terminou sem encontrar uma rota até a comida. Gere um novo mapa para tentar novamente.');
    $('status').textContent='sem solução';
    running=false;
    $('runButton').disabled=false;
    $('newMapButton').disabled=false;
    return;
  }

  // Só agora, depois de localizar o objetivo, o caminho aparece.
  setPhase('Caminho encontrado','O caminho final está destacado em laranja. Agora o agente percorrerá a rota e gastará energia conforme o terreno.');
  $('status').textContent='caminho encontrado';
  render({visited: result.events.at(-1).visited, frontier:new Set(), path:result.path});
  await sleep(450);

  // Move o agente célula a célula e calcula o custo do deslocamento.
  let energy=0;
  for(let i=1;i<result.path.length;i++) {
    agent=[...result.path[i]];
    const terrain=terrainAt(agent);
    const speed= TERRAIN_SPEED[terrain];
    energy += COSTS[terrain];
    $('energy').textContent=`${energy} / ${result.cost}`;
    $('currentTerrain').textContent=`${TERRAIN_NAMES[terrain]} · ${COSTS[terrain]}`;
    $('agentSpeed').textContent=`${speed}% da base`;
    setPhase('Agente em movimento',`Terreno atual: ${TERRAIN_NAMES[terrain]} (${COSTS[terrain]} energia). Velocidade reduzida para ${speed}% da velocidade-base.`);
    render({path:result.path});

    // Terrenos caros fazem o agente esperar mais tempo entre os frames.
    await sleep(Math.max(45, SPEEDS[$('speed').value] * (terrain==='water'?2.3:terrain==='mud'?1.6:terrain==='sand'?1.15:.7)));
  }

  // Conta a coleta e inicia o próximo ciclo.
  collected++;
  $('foodCount').textContent=collected;
  $('status').textContent='comida coletada';
  setPhase('Coleta concluída','A comida desapareceu e foi contabilizada. Uma nova comida será posicionada automaticamente no mesmo ambiente.');
  await sleep(500);
  spawnFood();
  $('status').textContent='nova comida pronta';
  setPhase('Nova comida posicionada','O ciclo recomeçou: escolha a estratégia novamente para encontrar a nova comida.');
  running=false;
  $('runButton').disabled=false;
  $('newMapButton').disabled=false;
}

// Gera um novo mapa e limpa as métricas visuais.
function newMap() {
  if(running)return;
  makeMap();
  lastSearch=null;
  $('statAlgorithm').textContent=algorithmLabel();
  $('status').textContent='novo mapa pronto';
  $('visitedCount').textContent='0';
  $('expansions').textContent='0';
  $('pathLength').textContent='—';
  $('pathCost').textContent='—';
  $('energy').textContent='—';
  $('currentTerrain').textContent='—';
  $('agentSpeed').textContent='—';
  $('coordinates').textContent=`agente ${start.join(',')} · comida ${goal.join(',')}`;
  setPhase('Aguardando execução','Escolha uma estratégia e execute a busca. A animação destacará cada estágio da exploração.');
  render();
}

// Conecta os controles HTML às funções JavaScript.
$('runButton').addEventListener('click', runSearch);
$('newMapButton').addEventListener('click', newMap);
$('algorithm').addEventListener('change',()=> $('statAlgorithm').textContent=algorithmLabel());
$('speed').addEventListener('input',e=>$('speedValue').textContent=speedLabels[e.target.value]);

// Inicializa o primeiro mapa quando a página é carregada.
makeMap();
newMap();
