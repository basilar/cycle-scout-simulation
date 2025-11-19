# Graph Agent Simulation

A purely front-end browser application that simulates programmable agents traversing a directed graph to detect cycles. Agents execute instruction sequences simultaneously, and the goal is to correctly identify whether the graph contains a loop.

It has been developed as part of the ["PályaPanoráma"](https://palyapanorama.startakademia.hu/v-mini-edukacios-szakmai-nap-veszprem/#:~:text=Elevate%20Healthcare) programme in Hungary for Highschool students at the Lovassy László Gimnázium in Veszprém](http://web.lovassy.hu/). They had to program agents to detect cycles whilst competing against other teams.

## Features

- **Graph Visualization**: Random directed graphs, rendered using D3.js
  - Forward edges (blue) connect nodes in sequence
  - Loop edges (purple) create cycles in the graph
  - Each node has at most one outgoing edge
  - Graphs have a 50% chance of containing a loop
- **Agent System**: Up to 3 programmable agents, each with a distinct color (Red, Green, Yellow)
  - Agents start at node 0
  - When multiple agents occupy the same node, their colors blend to show overlap
  - Individual agent indicators appear around nodes when multiple agents overlap
- **Instruction-Based Movement**: Agents execute character-by-character instruction sequences:
  - **S**: STEP - move one node forward along an outgoing edge
  - **N**: NOP - No operation (do nothing)
  - **C**: COND - execute next instruction only if another agent is at current node (must be followed by S or N, e.g., CS, CN)
  - **L**: LOOP - End execution and report suspected loop
  - Maximum 10 characters per instruction sequence
  - Multiple consecutive S's are executed atomically (e.g., "SSS" = 3 steps at once)
  - All agents execute instructions simultaneously at each step
- **Interactive Controls**:
  - **💥 Generate New Graph**: Creates a new random graph (1-33 nodes)
  - **↻ Reset Agents**: Moves all agents back to the starting node (node 0)
  - **⏯︎ Step Agents**: Progress agents one step forward (executes one round of instructions)
  - **▶︎ Progress Agents**: Starts/stops automatic progression (executes instructions every second)
  - **📝 Enter Graph**: Enter a graph from copyable text format
  - **👓 Show Graph**: Display the current graph in a copyable text format

## How to Use

1. Open `index.html` in a modern web browser
2. The application will automatically generate an initial graph
3. Select the number of agents (1-3) from the dropdown
4. Enter instruction sequences for each active agent in the text areas (e.g., "SSS", "CS", "L", "SSN")
5. Use the control buttons to:
   - Generate a new random graph
   - Reset agents to the starting position
   - Step agents once manually
   - Start/stop automatic progression
6. When an agent executes the **L** instruction (or reaches it when overlapping with another agent), the application checks if the graph actually contains a loop:
   - **Success**: Graph has a loop and L was executed correctly
   - **Failure**: Graph has no loop but L was executed (false positive)
   - **Success**: All agents reach terminating nodes (no outgoing edges) - correctly identifies no loop

## Instruction Details

- **S (Step)**: Moves the agent one node forward along a random outgoing edge. If there are no outgoing edges, the agent stops and is marked as finished.
- **N (NOP)**: No operation - the agent does nothing for this instruction.
- **C (Conditional)**: Checks if another agent is at the current node. If true, executes the next instruction (S or N). If false, skips the next instruction. Must be followed by S or N.
- **L (LOOP)**: Triggers a loop detection check. Can be executed directly or automatically when agents overlap and one has L in its remaining instructions.
