# Agente Coletor — Busca em Grid

Simulação interativa de estratégias de busca em Inteligência Artificial. O agente precisa encontrar e coletar uma comida em um ambiente discretizado, aleatório e completamente observável, considerando obstáculos, diferentes tipos de terreno, custos de energia e velocidades de deslocamento.

O projeto foi desenvolvido em **HTML, CSS e JavaScript puro**.

## Demonstração

A aplicação permite selecionar uma estratégia, gerar mapas diferentes e acompanhar visualmente cada etapa da busca. Durante a exploração, os estados visitados e a fronteira são animados. Depois que o objetivo é encontrado, o caminho aparece somente com uma borda laranja, enquanto o centro da célula mantém a cor original do terreno.

## Funcionalidades

- Busca em Largura — **BFS**;

- Busca em Profundidade — **DFS**;

- Busca de Custo Uniforme — **UCS**;

- Busca Gulosa;

- Busca **A*** com heurística Manhattan;

- Mapas gerados automaticamente e aleatoriamente;

- Áreas de areia, atoleiro e água com formatos e tamanhos variados;

- Obstáculos em blocos com dimensões variadas;

- Verificação automática para garantir que exista um caminho possível;

- Animação frame a frame da fronteira e dos estados visitados;

- Caminho final destacado por borda laranja;

- Preservação da cor do terreno no centro da célula do caminho;

- Custos de energia diferentes por terreno;

- Velocidade do agente reduzida em terrenos mais difíceis;

- Contador de comida coletada;

- Geração automática de uma nova comida após cada coleta;

- Controle de velocidade da simulação;

- Layout responsivo para telas grandes, tablets e celulares;

- Execução sem instalação de bibliotecas ou dependências externas.

## Tipos de terreno

| Terreno | Cor aproximada | Custo de energia | Velocidade do agente |
| --- | --- | --- | --- |
| Livre | Verde claro | 1 | 100% |
| Areia | Amarelo claro | 10 | 75% |
| Atoleiro | Marrom | 50 | 45% |
| Água | Azul | 100 | 25% |
| Obstáculo | Verde escuro | Intransponível | — |

Os valores podem ser alterados no início do arquivo `app.js`.

## Algoritmos implementados

Todos os algoritmos estão concentrados na função `search(type)`, localizada em `app.js`.

### Busca em Largura — BFS

A BFS utiliza uma fila FIFO. O primeiro estado inserido é o primeiro estado expandido. Quando todos os movimentos possuem o mesmo custo, ela encontra um caminho com o menor número de passos. Neste projeto, como os terrenos possuem custos diferentes, ela não garante o caminho de menor gasto energético.

### Busca em Profundidade — DFS

A DFS utiliza uma pilha LIFO. O último estado inserido é o primeiro a ser expandido. Ela pode encontrar uma solução rapidamente, mas não garante o menor caminho nem o menor custo.

### Busca de Custo Uniforme — UCS

A UCS sempre expande o estado com menor custo acumulado. Ela considera os custos de areia, atoleiro e água e procura o caminho de menor gasto de energia.

### Busca Gulosa

A busca Gulosa escolhe o estado que parece mais próximo do objetivo segundo a heurística. Ela utiliza somente a distância estimada até a comida e não considera o custo já acumulado no caminho.

### A*

A busca A* combina o custo acumulado `g(n)` com a estimativa heurística `h(n)`:

```
f(n) = g(n) + h(n)
```

A heurística usada é a distância Manhattan:

```
h(n) = |linha_atual - linha_objetivo|
     + |coluna_atual - coluna_objetivo|
```

## Geração do mapa

O mapa possui inicialmente **18 linhas e 26 colunas**. Cada célula recebe um terreno aleatório. Em seguida, o programa sobrepõe manchas irregulares de areia, atoleiro e água, além de blocos de obstáculos com altura e largura aleatórias.

Antes de aceitar um mapa, o programa verifica se existe um caminho entre o agente e a comida. Caso o mapa fique impossível, ele é descartado e outro mapa é gerado.

## Como executar

### Opção 1: abrir diretamente

Baixe ou clone o repositório, entre na pasta e abra o arquivo `index.html` no navegador.

```bash
git clone https://github.com/SEU-USUARIO/agente-coletor-busca-grid.git
cd agente-coletor-busca-grid
```

Depois, abra `index.html` com o navegador.

## Como usar

1. Abra a aplicação.

1. Escolha uma estratégia no campo **Escolha o tipo de busca**.

1. Ajuste a velocidade da simulação, se desejar.

1. Clique em **Executar busca**.

1. Observe a animação dos estados visitados e da fronteira.

1. Quando a comida for localizada, observe o caminho com borda laranja.

1. Acompanhe o terreno atual, o custo de energia e a velocidade do agente.

1. Clique em **Novo mapa** para gerar um ambiente diferente.

## Configurações principais

As configurações podem ser alteradas no início de `app.js`.

| Variável | Descrição |
| --- | --- |
| `ROWS` | Quantidade de linhas do grid. |
| `COLS` | Quantidade de colunas do grid. |
| `COSTS` | Custo de energia de cada terreno. |
| `TERRAIN_POOL` | Distribuição inicial dos terrenos. |
| `TERRAIN_SPEED` | Velocidade relativa do agente por terreno. |
| `SPEEDS` | Velocidade dos frames da animação. |
| `paintArea(..., 8, 34 )` | Tamanho mínimo e máximo das áreas de terreno. |
| `for (let i=0; i<9; i++)` | Quantidade de agrupamentos de obstáculos. |
| `rand(4)` | Limite usado para a altura dos obstáculos. |
| `rand(5)` | Limite usado para a largura dos obstáculos. |

Exemplo para alterar os custos:

```javascript
const COSTS = {
  grass: 1,
  sand: 15,
  mud: 60,
  water: 120
};
```

Exemplo para deixar a água mais lenta:

```javascript
const TERRAIN_SPEED = {
  grass: 100,
  sand: 70,
  mud: 40,
  water: 15
};
```

## Estrutura do projeto

```
agente-coletor-busca-grid/
├── index.html
├── styles.css
├── app.js
├── README.md
```

## Tecnologias

- HTML5;

- CSS3;

- JavaScript moderno;

- CSS Grid;

- `Set`, `Map` e fila de prioridade;

- Heurística Manhattan;

## Autoria

Projeto acadêmico de Inteligência Artificial sobre estratégias de busca em espaços de estados.
