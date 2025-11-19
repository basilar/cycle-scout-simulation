// Graph and agent simulation
let graph = null;
let agents = [];
let svg = null;
let simulation = null;
let isProgressing = false;
let progressInterval = null;

// Agent colors (max 5 agents)
const AGENT_COLORS = [
    '#ff0000', // Red
    '#00ff00', // Green
    '#ffff00', // Yellow
    '#ff00ff', // Magenta
    '#00ffff'  // Cyan
];

// Initialize the application
function init() {
    // Create SVG container
    const container = d3.select('#graphContainer');
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;

    svg = container.append('svg')
        .attr('width', width)
        .attr('height', height);

    // Handle window resize
    window.addEventListener('resize', () => {
        const newWidth = container.node().clientWidth;
        const newHeight = container.node().clientHeight;
        svg.attr('width', newWidth).attr('height', newHeight);
        if (simulation) {
            simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
        }
        updateGraph();
    });

    // Button event listeners
    document.getElementById('generateGraph').addEventListener('click', generateNewGraph);
    document.getElementById('resetAgents').addEventListener('click', resetAgents);
    document.getElementById('stepAgents').addEventListener('click', stepAgentsOnce);
    document.getElementById('progressAgents').addEventListener('click', startProgressing);
    document.getElementById('showGraphSerialization').addEventListener('click', showGraphSerialization);
    document.getElementById('loadGraph').addEventListener('click', showLoadGraphDialog);
    
    // Agent selector event listener
    document.getElementById('numAgents').addEventListener('change', function() {
        const numAgents = parseInt(this.value);
        updateAgentTextAreas(numAgents);
        resetAgents();
    });
    
    // Initialize agent text areas (always show all 3)
    // Get initial value from dropdown (defaults to 1 if not set)
    const initialNumAgents = parseInt(document.getElementById('numAgents').value) || 1;
    updateAgentTextAreas(initialNumAgents);

    // Generate initial graph
    generateNewGraph();
}

// Generate a new random graph with at most 33 nodes
// Each node has at most one outgoing edge, and there is either no loop or a single loop
function generateNewGraph() {
    const numNodes = Math.floor(Math.random() * 33) + 1; // 1 to 33 nodes
    const nodes = [];
    const links = [];

    // Create nodes
    for (let i = 0; i < numNodes; i++) {
        nodes.push({ id: i, label: `N${i}` });
    }

    if (numNodes === 1) {
        // Single node, no edges
        graph = { nodes, links };
        resetAgents();
        renderGraph();
        return;
    }

    // Create a main path structure where each node (except the last) has exactly one outgoing edge
    for (let i = 0; i < numNodes - 1; i++) {
        links.push({ source: i, target: i + 1 });
    }

    // Optionally add exactly one loop (0 or 1 loop)
    // Since each node can have at most one outgoing edge, we can only create a loop
    // by connecting the last node (which has no outgoing edge) back to an earlier node
    const hasLoop = Math.random() < 0.5; // 50% chance of having a loop
    
    if (hasLoop && numNodes >= 3) {
        // Create a loop by connecting the last node back to an earlier node
        // The last node (numNodes - 1) currently has no outgoing edge, so we can add one
        const minLoopSize = Math.max(2, Math.floor(numNodes / 4)); // Minimum loop size for visibility
        const maxTargetNode = numNodes - minLoopSize - 1; // Can't connect too close to the end
        
        if (maxTargetNode >= 0) {
            // Choose a target node that creates a visible loop
            const loopTarget = Math.floor(Math.random() * (maxTargetNode + 1));
            
            // Connect last node to an earlier node to create a loop
            links.push({ source: numNodes - 1, target: loopTarget });
        }
    }
    
    // Verify constraint: each node has at most one outgoing edge
    const outgoingCount = new Map();
    links.forEach(link => {
        const sourceId = link.source;
        outgoingCount.set(sourceId, (outgoingCount.get(sourceId) || 0) + 1);
    });
    
    // Ensure no node has more than one outgoing edge
    for (const [nodeId, count] of outgoingCount.entries()) {
        if (count > 1) {
            console.warn(`Node ${nodeId} has ${count} outgoing edges, which violates the constraint`);
        }
    }

    graph = { nodes, links };
    
    // Render the graph first
    renderGraph();
    
    // Reset agents after graph is rendered
    resetAgents();
}

// Render the graph using D3.js with directed edges and non-crossing layout
function renderGraph() {
    if (!graph || !svg) return;

    const container = d3.select('#graphContainer');
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;

    // Clear existing graph
    svg.selectAll('*').remove();

    // Create arrow marker for directed edges
    const defs = svg.append('defs');
    const arrowMarker = defs.append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 10) // Position arrow tip at the path end (touching node)
        .attr('refY', 0)
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .attr('orient', 'auto');
    
    arrowMarker.append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#0066ff')
        .attr('stroke', 'none');

    // Use a snake/wrap layout that fits on screen
    // Calculate how many nodes fit per row
    const horizontalMargin = 100;
    const verticalMargin = 80;
    const nodeSpacing = 120;
    const rowSpacing = 100;
    const availableWidth = width - (2 * horizontalMargin);
    const availableHeight = height - (2 * verticalMargin);
    const nodesPerRow = Math.max(1, Math.floor(availableWidth / nodeSpacing));
    const numRows = Math.ceil(graph.nodes.length / nodesPerRow);
    
    // Store layout parameters in graph for use in force simulation
    graph.layoutParams = {
        horizontalMargin,
        verticalMargin,
        nodeSpacing,
        rowSpacing,
        nodesPerRow,
        numRows,
        width,
        height
    };
    
    // Assign nodes positions in a snake pattern (left-to-right, then right-to-left, etc.)
    graph.nodes.forEach((node, i) => {
        const row = Math.floor(i / nodesPerRow);
        const positionInRow = i % nodesPerRow;
        const isEvenRow = row % 2 === 0;
        
        // Calculate x position - alternate direction for each row
        let x;
        if (isEvenRow) {
            // Left to right
            x = horizontalMargin + (positionInRow * nodeSpacing);
        } else {
            // Right to left (backwards)
            x = width - horizontalMargin - (positionInRow * nodeSpacing);
        }
        
        // Calculate y position - start from top and go down
        const y = verticalMargin + (row * rowSpacing);
        
        node.x = x;
        node.y = y;
    });

    // Identify forward edges (source.id < target.id) and backward edges (cycles/loops)
    let hasLoop = false;
    let loopEdge = null;
    graph.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        link.isForward = sourceId < targetId;
        link.isBackward = sourceId > targetId;
        
        if (link.isBackward) {
            hasLoop = true;
            loopEdge = link;
        }
    });
    
    // Store loop information in graph for use in edge routing
    graph.hasLoop = hasLoop;
    graph.loopEdge = loopEdge;

    // Create force simulation with constraints to maintain snake layout and keep within bounds
    const nodeRadius = 20;
    const minX = nodeRadius;
    const maxX = width - nodeRadius;
    const minY = nodeRadius;
    const maxY = height - nodeRadius;
    
    simulation = d3.forceSimulation(graph.nodes)
        .force('link', d3.forceLink(graph.links).id(d => d.id).distance(nodeSpacing * 1.1))
        .force('charge', d3.forceManyBody().strength(-20)) // Very weak charge
        .force('collision', d3.forceCollide().radius(45))
        .force('x', d3.forceX().strength(0.6).x((d) => {
            // Keep nodes in their horizontal position based on snake layout
            const params = graph.layoutParams;
            const row = Math.floor(d.id / params.nodesPerRow);
            const positionInRow = d.id % params.nodesPerRow;
            const isEvenRow = row % 2 === 0;
            
            let targetX;
            if (isEvenRow) {
                targetX = params.horizontalMargin + (positionInRow * params.nodeSpacing);
            } else {
                targetX = params.width - params.horizontalMargin - (positionInRow * params.nodeSpacing);
            }
            
            // Clamp to bounds
            return Math.max(minX, Math.min(maxX, targetX));
        }))
        .force('y', d3.forceY().strength(0.4).y((d) => {
            // Keep nodes in their row position
            const params = graph.layoutParams;
            const row = Math.floor(d.id / params.nodesPerRow);
            const targetY = params.verticalMargin + (row * params.rowSpacing);
            
            // Clamp to bounds
            return Math.max(minY, Math.min(maxY, targetY));
        }))
        .force('boundary', () => {
            // Additional boundary constraint to keep nodes within visible area
            graph.nodes.forEach(node => {
                node.x = Math.max(minX, Math.min(maxX, node.x));
                node.y = Math.max(minY, Math.min(maxY, node.y));
            });
        })
        .alphaDecay(0.02)
        .alpha(0.5)
        .alphaMin(0.001);

    // Separate forward and backward (loop) edges to draw them in order
    // Forward edges first, then loop edges on top
    const forwardLinks = graph.links.filter(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return sourceId < targetId;
    });
    
    const loopLinks = graph.links.filter(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return sourceId > targetId;
    });
    
    // Draw forward edges first (they'll be underneath)
    const forwardEdges = svg.append('g')
        .attr('class', 'forward-edges')
        .selectAll('path')
        .data(forwardLinks)
        .enter()
        .append('path')
        .attr('class', 'edge')
        .attr('marker-end', 'url(#arrowhead)')
        .attr('fill', 'none')
        .attr('stroke', '#0066ff')
        .attr('stroke-width', 2);
    
    // Create arrow marker for loop edges (purple)
    const loopArrowMarker = defs.append('marker')
        .attr('id', 'arrowhead-purple')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 10) // Position arrow tip at the path end (touching node)
        .attr('refY', 0)
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .attr('orient', 'auto');
    
    loopArrowMarker.append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#9932cc') // Purple color
        .attr('stroke', 'none');
    
    // Draw loop edges on top (they'll be more visible)
    const loopEdges = svg.append('g')
        .attr('class', 'loop-edges')
        .selectAll('path')
        .data(loopLinks)
        .enter()
        .append('path')
        .attr('class', 'edge loop-edge')
        .attr('marker-end', 'url(#arrowhead-purple)')
        .attr('fill', 'none')
        .attr('stroke', '#9932cc') // Purple color
        .attr('stroke-width', 2.5); // Slightly thicker for visibility

    // Draw nodes
    const nodeGroups = svg.append('g')
        .selectAll('g')
        .data(graph.nodes)
        .enter()
        .append('g')
        .attr('class', 'node');

    nodeGroups.append('circle')
        .attr('class', 'node-circle')
        .attr('r', 20);

    nodeGroups.append('text')
        .attr('class', 'node-label')
        .attr('dy', 5)
        .text(d => d.label);

    // Add drag behavior to nodes
    const drag = d3.drag()
        .on('start', function(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        })
        .on('drag', function(event, d) {
            // Constrain dragging to visible area
            const nodeRadius = 20;
            d.fx = Math.max(nodeRadius, Math.min(width - nodeRadius, event.x));
            d.fy = Math.max(nodeRadius, Math.min(height - nodeRadius, event.y));
        })
        .on('end', function(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            // Optionally release the node to let forces take over
            // d.fx = null;
            // d.fy = null;
        });

    // Make nodes draggable
    nodeGroups.call(drag);

    // Update positions on simulation tick
    simulation.on('tick', () => {
        // Update forward edges
        forwardEdges.attr('d', d => {
            const source = typeof d.source === 'object' ? d.source : graph.nodes.find(n => n.id === d.source);
            const target = typeof d.target === 'object' ? d.target : graph.nodes.find(n => n.id === d.target);
            
            if (!source || !target || source.x === undefined || target.x === undefined) return '';
            
            const sourceId = source.id;
            const targetId = target.id;
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dr = Math.sqrt(dx * dx + dy * dy);
            
            if (dr < 1) return ''; // Avoid division by zero
            
            // Determine if this is a forward or backward edge
            const isForward = sourceId < targetId;
            const isAdjacent = Math.abs(sourceId - targetId) === 1;
            
            // Check if edge crosses row boundaries
            const params = graph.layoutParams;
            const sourceRow = Math.floor(sourceId / params.nodesPerRow);
            const targetRow = Math.floor(targetId / params.nodesPerRow);
            const crossesRow = sourceRow !== targetRow;
            
            // Calculate offsets from node centers
            // Start point: offset from source node center
            // End point: exactly at target node edge (where arrowhead will touch)
            const nodeRadius = 20;
            const startOffsetX = (dx / dr) * nodeRadius;
            const startOffsetY = (dy / dr) * nodeRadius;
            const endOffsetX = (dx / dr) * nodeRadius;
            const endOffsetY = (dy / dr) * nodeRadius;
            
            // Forward edges only (loops are handled separately)
            // Ensure control points stay within bounds
            const safeMargin = 10;
            const minX = nodeRadius + safeMargin;
            const maxX = params.width - nodeRadius - safeMargin;
            const minY = nodeRadius + safeMargin;
            const maxY = params.height - nodeRadius - safeMargin;
            
            if (isAdjacent && !crossesRow) {
                // Forward adjacent edge in same row - straight line (main path)
                // Clamp endpoints to ensure they're within bounds
                const startX = Math.max(minX, Math.min(maxX, source.x + startOffsetX));
                const startY = Math.max(minY, Math.min(maxY, source.y + startOffsetY));
                const endX = Math.max(minX, Math.min(maxX, target.x - endOffsetX));
                const endY = Math.max(minY, Math.min(maxY, target.y - endOffsetY));
                return `M ${startX} ${startY} L ${endX} ${endY}`;
            } else if (crossesRow) {
                // Edge that crosses rows - use smooth curve with intermediate point
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;
                // Add curve to make row transition smooth
                const curveOffset = Math.abs(sourceRow - targetRow) * 20;
                const controlX = Math.max(minX, Math.min(maxX, midX));
                const controlY = Math.max(minY, Math.min(maxY, midY - curveOffset));
                
                const startX = Math.max(minX, Math.min(maxX, source.x + startOffsetX));
                const startY = Math.max(minY, Math.min(maxY, source.y + startOffsetY));
                const endX = Math.max(minX, Math.min(maxX, target.x - endOffsetX));
                const endY = Math.max(minY, Math.min(maxY, target.y - endOffsetY));
                
                return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
            } else {
                // Forward non-adjacent edge in same row - slight curve
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;
                const curveOffset = Math.min(25, Math.abs(dx) * 0.08);
                const controlX = Math.max(minX, Math.min(maxX, midX));
                const controlY = Math.max(minY, Math.min(maxY, midY - curveOffset));
                
                const startX = Math.max(minX, Math.min(maxX, source.x + startOffsetX));
                const startY = Math.max(minY, Math.min(maxY, source.y + startOffsetY));
                const endX = Math.max(minX, Math.min(maxX, target.x - endOffsetX));
                const endY = Math.max(minY, Math.min(maxY, target.y - endOffsetY));
                
                return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
            }
        });
        
        // Update loop edges - use shortest path with smooth curves (can cross other edges)
        loopEdges.attr('d', d => {
            const source = typeof d.source === 'object' ? d.source : graph.nodes.find(n => n.id === d.source);
            const target = typeof d.target === 'object' ? d.target : graph.nodes.find(n => n.id === d.target);
            
            if (!source || !target || source.x === undefined || target.x === undefined) return '';
            
            const params = graph.layoutParams;
            
            // Calculate offsets from node centers
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dr = Math.sqrt(dx * dx + dy * dy);
            
            if (dr < 1) return '';
            
            const nodeRadius = 20;
            // Start point: offset from source node center
            const offsetX = (dx / dr) * nodeRadius;
            const offsetY = (dy / dr) * nodeRadius;
            // End point: exactly at target node edge (where arrowhead will touch)
            const endOffsetX = (dx / dr) * nodeRadius;
            const endOffsetY = (dy / dr) * nodeRadius;
            
            // Calculate bounds for safety
            const safeMargin = 10;
            const minX = nodeRadius + safeMargin;
            const maxX = params.width - nodeRadius - safeMargin;
            const minY = nodeRadius + safeMargin;
            const maxY = params.height - nodeRadius - safeMargin;
            
            // Clamp start and end points to bounds
            const startX = Math.max(minX, Math.min(maxX, source.x + offsetX));
            const startY = Math.max(minY, Math.min(maxY, source.y + offsetY));
            // End point should be exactly at the target node's edge
            const endX = Math.max(minX, Math.min(maxX, target.x - endOffsetX));
            const endY = Math.max(minY, Math.min(maxY, target.y - endOffsetY));
            
            // For shortest path, use a smooth curve that goes directly from source to target
            // Use a cubic Bezier curve with control points that create a smooth arc
            // The arc height is proportional to the distance but keeps the path relatively direct
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            
            // Calculate a smooth curve - use a slight arc to make it visually appealing
            // but keep it close to the direct line for shortest path
            const arcHeight = Math.min(30, dr * 0.1); // Small arc, proportional to distance
            
            // Determine arc direction based on which side gives a smoother curve
            // For backward edges (loops), curve slightly to avoid looking too straight
            const arcDirection = dy < 0 ? -1 : 1; // Curve up if going down, down if going up
            
            // Control points for smooth cubic Bezier curve
            const cp1x = startX + (midX - startX) * 0.5;
            const cp1y = startY + (midY - startY) * 0.5 + (arcHeight * arcDirection * 0.3);
            const cp2x = midX + (endX - midX) * 0.5;
            const cp2y = midY + (endY - midY) * 0.5 + (arcHeight * arcDirection * 0.3);
            
            // Ensure control points stay within bounds
            const safeCp1x = Math.max(minX, Math.min(maxX, cp1x));
            const safeCp1y = Math.max(minY, Math.min(maxY, cp1y));
            const safeCp2x = Math.max(minX, Math.min(maxX, cp2x));
            const safeCp2y = Math.max(minY, Math.min(maxY, cp2y));
            
            // Create smooth curved path (shortest path with slight curve for aesthetics)
            return `M ${startX} ${startY} C ${safeCp1x} ${safeCp1y}, ${safeCp2x} ${safeCp2y}, ${endX} ${endY}`;
        });

        nodeGroups
            .attr('transform', d => `translate(${d.x},${d.y})`);

        updateAgents();
    });

    // Store node groups for agent rendering
    graph.nodeGroups = nodeGroups;
}

// Update graph display (when window resizes)
function updateGraph() {
    if (!graph || !simulation) return;
    
    const container = d3.select('#graphContainer');
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    
    simulation.force('center', d3.forceCenter(width / 2, height / 2));
    simulation.alpha(0.3).restart();
}

// Update agent text areas based on selected number
// Always shows all 3 text areas, but disables/greys out unused ones
function updateAgentTextAreas(numAgents) {
    const container = document.getElementById('agentTextAreas');
    
    // Always create/update all 3 text areas
    for (let i = 0; i < 3; i++) {
        let textareaContainer = document.getElementById(`agentTextAreaContainer${i}`);
        
        // Create container if it doesn't exist
        if (!textareaContainer) {
            textareaContainer = document.createElement('div');
            textareaContainer.id = `agentTextAreaContainer${i}`;
            textareaContainer.className = 'agent-textarea-container';
            
            const label = document.createElement('label');
            label.textContent = `Agent ${i + 1}:`;
            label.setAttribute('for', `agentTextArea${i}`);
            
            const textarea = document.createElement('textarea');
            textarea.id = `agentTextArea${i}`;
            textarea.placeholder = `Enter instructions for Agent ${i + 1} (e.g., SSS, N, SS, CS, L)`;
            textarea.maxLength = 10;
            
            // Only allow S, N, C, and L characters
            textarea.addEventListener('input', function(e) {
                const value = e.target.value.toUpperCase();
                const filtered = value.replace(/[^SNCL]/g, '');
                if (value !== filtered) {
                    e.target.value = filtered;
                }
            });
            
            // Convert to uppercase on blur
            textarea.addEventListener('blur', function(e) {
                e.target.value = e.target.value.toUpperCase();
            });
            
            textareaContainer.appendChild(label);
            textareaContainer.appendChild(textarea);
            container.appendChild(textareaContainer);
        }
        
        const textarea = document.getElementById(`agentTextArea${i}`);
        const isActive = i < numAgents;
        
        // Enable/disable based on selection
        textarea.disabled = !isActive;
        
        // Update styling based on active state
        if (isActive) {
            textarea.style.borderColor = AGENT_COLORS[i];
            textarea.style.opacity = '1';
            textarea.style.cursor = 'text';
            textarea.style.backgroundColor = '#222222';
        } else {
            textarea.style.borderColor = '#555555'; // Grey border
            textarea.style.opacity = '0.5';
            textarea.style.cursor = 'not-allowed';
            textarea.style.backgroundColor = '#1a1a1a';
            textarea.value = ''; // Clear value when disabled
        }
    }
}

// Reset all agents to the starting node (node 0)
function resetAgents() {
    if (!graph || graph.nodes.length === 0) return;

    // Get number of agents from dropdown
    const numAgentsSelect = document.getElementById('numAgents');
    const numAgents = numAgentsSelect ? parseInt(numAgentsSelect.value) : 1;
    const actualNumAgents = Math.min(5, Math.max(1, numAgents)); // Ensure 1-5 range
    
    agents = [];
    
    // Stop any ongoing progression
    if (isProgressing) {
        stopProgressing();
    }
    
    for (let i = 0; i < actualNumAgents; i++) {
        agents.push({
            id: i,
            currentNode: 0,
            color: AGENT_COLORS[i],
            path: [0], // Track path for potential future use
            finished: false
        });
    }

    updateAgents();
}

// Update agent visualization
function updateAgents() {
    if (!graph || !graph.nodeGroups || agents.length === 0) return;

    // Remove existing agent indicators
    svg.selectAll('.agent').remove();

    // Group agents by node
    const agentsByNode = {};
    agents.forEach(agent => {
        const nodeId = agent.currentNode;
        if (!agentsByNode[nodeId]) {
            agentsByNode[nodeId] = [];
        }
        agentsByNode[nodeId].push(agent);
    });

    // Render agents on nodes
    Object.keys(agentsByNode).forEach(nodeId => {
        const nodeAgents = agentsByNode[nodeId];
        const node = graph.nodes.find(n => n.id === parseInt(nodeId));
        if (!node || node.x === undefined || node.y === undefined) return;

        if (nodeAgents.length === 1) {
            // Single agent - render as colored circle
            svg.append('circle')
                .attr('class', 'agent')
                .attr('cx', node.x)
                .attr('cy', node.y)
                .attr('r', 12)
                .attr('fill', nodeAgents[0].color)
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 2);
        } else {
            // Multiple agents - mix colors and render
            const mixedColor = mixColors(nodeAgents.map(a => a.color));
            
            // Render main mixed color circle
            svg.append('circle')
                .attr('class', 'agent')
                .attr('cx', node.x)
                .attr('cy', node.y)
                .attr('r', 15)
                .attr('fill', mixedColor)
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 2);

            // Render individual agent indicators around the node
            const angleStep = (2 * Math.PI) / nodeAgents.length;
            nodeAgents.forEach((agent, index) => {
                const angle = index * angleStep;
                const offsetX = Math.cos(angle) * 25;
                const offsetY = Math.sin(angle) * 25;
                svg.append('circle')
                    .attr('class', 'agent')
                    .attr('cx', node.x + offsetX)
                    .attr('cy', node.y + offsetY)
                    .attr('r', 6)
                    .attr('fill', agent.color)
                    .attr('stroke', '#ffffff')
                    .attr('stroke-width', 1);
            });
        }
    });
}

// Mix multiple colors (simple additive color mixing)
function mixColors(colors) {
    if (colors.length === 0) return '#000000';
    if (colors.length === 1) return colors[0];

    // Convert hex to RGB
    const rgbValues = colors.map(color => {
        const hex = color.replace('#', '');
        return {
            r: parseInt(hex.substr(0, 2), 16),
            g: parseInt(hex.substr(2, 2), 16),
            b: parseInt(hex.substr(4, 2), 16)
        };
    });

    // Average the RGB values
    const avg = rgbValues.reduce((acc, rgb) => ({
        r: acc.r + rgb.r,
        g: acc.g + rgb.g,
        b: acc.b + rgb.b
    }), { r: 0, g: 0, b: 0 });

    const count = rgbValues.length;
    const r = Math.min(255, Math.floor(avg.r / count));
    const g = Math.min(255, Math.floor(avg.g / count));
    const b = Math.min(255, Math.floor(avg.b / count));

    // Convert back to hex
    return `#${[r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
}

// Step agents once (single progression)
function stepAgentsOnce() {
    if (!graph || agents.length === 0) return;
    
    // Progress agents one time only
    progressAgents();
}

// Start progressing agents along edges
function startProgressing() {
    if (isProgressing) {
        // Stop progression
        stopProgressing();
        return;
    }

    if (!graph || agents.length === 0) return;

    isProgressing = true;
    document.getElementById('progressAgents').textContent = '⏸️';
    document.getElementById('progressAgents').style.backgroundColor = '#cc0000';

    // Progress agents every second
    progressInterval = setInterval(() => {
        progressAgents();
    }, 1000);
}

// Stop agent progression
function stopProgressing() {
    isProgressing = false;
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    document.getElementById('progressAgents').textContent = '▶️';
    document.getElementById('progressAgents').style.backgroundColor = '#0066cc';
}

// Get instructions for an agent from its text area
function getAgentInstructions(agentId) {
    const textarea = document.getElementById(`agentTextArea${agentId}`);
    if (!textarea || textarea.disabled) return '';
    return textarea.value.toUpperCase().trim();
}

// Check if there is another agent at the given node
function hasOtherAgentAtNode(nodeId, currentAgentId) {
    return agents.some(agent => 
        agent.id !== currentAgentId && 
        agent.currentNode === nodeId &&
        !agent.finished
    );
}

// Parse and execute instructions for an agent
function executeAgentInstructions(agent, instructions) {
    if (!instructions || instructions.length === 0) return false; // No instructions = NOP
    
    let moved = false;
    let currentNode = agent.currentNode;
    
    // Execute all instructions
    let i = 0;
    while (i < instructions.length) {
        const instruction = instructions[i];
        
        if (instruction === 'C') {
            // Conditional instruction - check if there is another agent at current node
            // If condition is true (another agent present), execute the next instruction
            // If condition is false (no other agent), skip the next instruction
            if (i + 1 >= instructions.length) {
                // C at end of instructions - invalid, skip
                i++;
                continue;
            }
            
            const hasOtherAgent = hasOtherAgentAtNode(currentNode, agent.id);
            
            if (hasOtherAgent) {
                // Condition is true - execute the next instruction
                const nextInstruction = instructions[i + 1];
                if (nextInstruction === 'S') {
                    // Step instruction - progress one node
                    const availableEdges = graph.links.filter(link => {
                        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                        return sourceId === currentNode;
                    });
                    
                    if (availableEdges.length > 0) {
                        // Choose a random outgoing edge
                        const randomEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
                        const targetId = typeof randomEdge.target === 'object' ? randomEdge.target.id : randomEdge.target;
                        currentNode = targetId;
                        moved = true;
                    }
                }
                // If next instruction is 'N', do nothing (NOP)
            }
            // If condition is false, skip the next instruction
            
            // Skip both C and the next instruction
            i += 2;
        } else if (instruction === 'S') {
            // Step instruction - progress one node
            const availableEdges = graph.links.filter(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                return sourceId === currentNode;
            });
            
            if (availableEdges.length === 0) {
                // No outgoing edges - can't step further
                i++;
                break;
            }
            
            // Choose a random outgoing edge
            const randomEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
            const targetId = typeof randomEdge.target === 'object' ? randomEdge.target.id : randomEdge.target;
            currentNode = targetId;
            moved = true;
            i++;
        } else if (instruction === 'N') {
            // 'N' (NOP) - do nothing, just continue to next instruction
            i++;
        } else {
            // Unknown instruction - skip
            i++;
        }
    }
    
    // Update agent position if it moved
    if (moved && currentNode !== agent.currentNode) {
        agent.currentNode = currentNode;
        agent.path.push(currentNode);
        return true;
    }
    
    return moved;
}

// Execute a single instruction character for an agent
function executeSingleInstruction(agent, instruction, currentNode) {
    if (instruction === 'S') {
        // Step instruction - progress one node
        const availableEdges = graph.links.filter(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            return sourceId === currentNode;
        });
        
        if (availableEdges.length === 0) {
            // No outgoing edges - can't step
            return { moved: false, newPosition: currentNode };
        }
        
        // Choose a random outgoing edge
        const randomEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
        const targetId = typeof randomEdge.target === 'object' ? randomEdge.target.id : randomEdge.target;
        return { moved: true, newPosition: targetId };
    } else if (instruction === 'N') {
        // NOP - do nothing
        return { moved: false, newPosition: currentNode };
    }
    
    return { moved: false, newPosition: currentNode };
}

// Progress agents along directed edges based on their instructions
// Instructions are evaluated character-by-character simultaneously across all agents
function progressAgents() {
    if (!graph || agents.length === 0) {
        stopProgressing();
        return;
    }

    // Get instructions for all agents
    const agentInstructions = agents.map(agent => ({
        agent: agent,
        instructions: getAgentInstructions(agent.id),
        position: 0, // Current position in instruction string
        currentNode: agent.currentNode
    }));

    // Check if any agent can still move
    let allAgentsFinished = true;
    let hasMoreInstructions = false;

    // Process instructions character by character simultaneously
    let maxIterations = 20; // Safety limit
    let iteration = 0;

    while (iteration < maxIterations) {
        hasMoreInstructions = false;
        const positionUpdates = new Map(); // Store position updates for this round
        const instructionResults = []; // Store instruction execution results
        const conditionalResults = new Map(); // Store conditional evaluation results

        // PHASE 1: Evaluate all conditional instructions (C) FIRST, before any movements
        agentInstructions.forEach((agentData, index) => {
            const agent = agentData.agent;
            
            // Check if agent is finished (no outgoing edges)
            const availableEdges = graph.links.filter(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                return sourceId === agentData.currentNode;
            });

            if (availableEdges.length === 0) {
                agent.finished = true;
                return;
            }

            agent.finished = false;
            allAgentsFinished = false;

            // Check if agent has more instructions
            if (agentData.position >= agentData.instructions.length) {
                return; // No more instructions for this agent
            }

            const currentChar = agentData.instructions[agentData.position];

            // Only process conditional instructions in this phase
            if (currentChar === 'C') {
                hasMoreInstructions = true;
                
                // Conditional instruction - check if there is another agent at current node
                if (agentData.position + 1 >= agentData.instructions.length) {
                    // C at end - invalid, skip it
                    conditionalResults.set(index, { 
                        shouldExecute: false, 
                        skipChars: 1,
                        instruction: null
                    });
                    return;
                }

                // Check condition BEFORE any agents move (use current positions)
                const hasOtherAgent = hasOtherAgentAtNode(agentData.currentNode, agent.id);
                const nextChar = agentData.instructions[agentData.position + 1];

                if (hasOtherAgent) {
                    // Condition is true - will execute the next instruction
                    conditionalResults.set(index, { 
                        shouldExecute: true, 
                        instruction: nextChar,
                        skipChars: 2 // Skip both C and next char
                    });
                } else {
                    // Condition is false - skip the next instruction
                    conditionalResults.set(index, { 
                        shouldExecute: false, 
                        instruction: null,
                        skipChars: 2 // Skip both C and next char
                    });
                }
            }
        });

        // PHASE 2: Process all other instructions (S, N, L) and conditional results
        agentInstructions.forEach((agentData, index) => {
            const agent = agentData.agent;
            
            // Skip if agent is finished
            if (agent.finished) {
                instructionResults.push({ index, shouldExecute: false, newPosition: agentData.currentNode });
                return;
            }

            // Check if agent has more instructions
            if (agentData.position >= agentData.instructions.length) {
                instructionResults.push({ index, shouldExecute: false, newPosition: agentData.currentNode });
                return; // No more instructions for this agent
            }

            hasMoreInstructions = true;
            const currentChar = agentData.instructions[agentData.position];

            // Check if this agent had a conditional instruction that was already evaluated
            if (conditionalResults.has(index)) {
                const condResult = conditionalResults.get(index);
                if (condResult.shouldExecute) {
                    // Condition was true - execute the stored instruction
                    instructionResults.push({ 
                        index, 
                        shouldExecute: true, 
                        instruction: condResult.instruction,
                        newPosition: agentData.currentNode,
                        skipChars: condResult.skipChars
                    });
                } else {
                    // Condition was false - skip execution
                    instructionResults.push({ 
                        index, 
                        shouldExecute: false, 
                        newPosition: agentData.currentNode,
                        skipChars: condResult.skipChars
                    });
                }
            } else if (currentChar === 'L') {
                // LOOP instruction - end execution and check for loop
                instructionResults.push({ 
                    index, 
                    shouldExecute: true, 
                    instruction: 'L',
                    newPosition: agentData.currentNode,
                    skipChars: 1,
                    isLoopCheck: true
                });
            } else if (currentChar === 'S') {
                // Count consecutive S characters for atomic execution
                let sCount = 0;
                let pos = agentData.position;
                while (pos < agentData.instructions.length && agentData.instructions[pos] === 'S') {
                    sCount++;
                    pos++;
                }
                // Treat all consecutive S's as a single atomic operation
                instructionResults.push({ 
                    index, 
                    shouldExecute: true, 
                    instruction: 'S',
                    stepCount: sCount, // Number of steps to execute atomically
                    newPosition: agentData.currentNode,
                    skipChars: sCount
                });
            } else if (currentChar === 'N') {
                // NOP instruction
                instructionResults.push({ 
                    index, 
                    shouldExecute: true, 
                    instruction: 'N',
                    newPosition: agentData.currentNode,
                    skipChars: 1
                });
            } else {
                // Unknown instruction - skip it
                instructionResults.push({ 
                    index, 
                    shouldExecute: false, 
                    newPosition: agentData.currentNode,
                    skipChars: 1
                });
            }
        });

        // PHASE 3: Execute all instructions simultaneously
        let loopCheckTriggered = false;
        instructionResults.forEach(result => {
            if (!result.shouldExecute) {
                if (result.skipChars) {
                    agentInstructions[result.index].position += result.skipChars;
                }
                return;
            }

            // Check for LOOP instruction first
            if (result.isLoopCheck) {
                loopCheckTriggered = true;
                agentInstructions[result.index].position += result.skipChars;
                return; // Don't execute other instructions if LOOP is triggered
            }

            const agentData = agentInstructions[result.index];
            const agent = agentData.agent;
            
            // Handle atomic S operations (multiple consecutive S's)
            if (result.instruction === 'S' && result.stepCount && result.stepCount > 1) {
                // Execute multiple steps atomically
                let currentPos = agentData.currentNode;
                let stepsExecuted = 0;
                for (let i = 0; i < result.stepCount; i++) {
                    const execResult = executeSingleInstruction(agent, 'S', currentPos);
                    if (execResult.moved) {
                        currentPos = execResult.newPosition;
                        stepsExecuted++;
                    } else {
                        // Can't move further, stop
                        break;
                    }
                }
                if (stepsExecuted > 0) {
                    positionUpdates.set(result.index, currentPos);
                    agentData.currentNode = currentPos;
                }
            } else {
                // Single instruction execution
                const execResult = executeSingleInstruction(agent, result.instruction, agentData.currentNode);
                
                if (execResult.moved) {
                    positionUpdates.set(result.index, execResult.newPosition);
                    agentData.currentNode = execResult.newPosition;
                }
            }
            
            agentData.position += result.skipChars;
        });

        // If LOOP instruction was triggered, show dialog and stop execution
        if (loopCheckTriggered) {
            showLoopDialog(graph && graph.hasLoop, false); // Pass loop status, not finished
            stopProgressing();
            updateAgents();
            return;
        }

        // Apply position updates after all instructions are evaluated
        positionUpdates.forEach((newPosition, index) => {
            const agent = agentInstructions[index].agent;
            if (agent.currentNode !== newPosition) {
                agent.currentNode = newPosition;
                agent.path.push(newPosition);
            }
        });

        // Check for overlaps and trigger L instruction if any overlapping agent has L
        // Only check after all atomic operations are complete
        const nodeToAgents = new Map();
        agentInstructions.forEach((agentData, index) => {
            if (agentData.agent.finished) return;
            const nodeId = agentData.agent.currentNode;
            if (!nodeToAgents.has(nodeId)) {
                nodeToAgents.set(nodeId, []);
            }
            nodeToAgents.get(nodeId).push(index);
        });

        // Check each node for overlaps (multiple agents)
        let overlapLoopTriggered = false;
        for (const [nodeId, agentIndices] of nodeToAgents.entries()) {
            if (agentIndices.length > 1) {
                // Multiple agents at this node - check if any has L instruction
                for (const agentIndex of agentIndices) {
                    const agentData = agentInstructions[agentIndex];
                    
                    // First check if L is at the current position
                    if (agentData.position < agentData.instructions.length) {
                        const currentChar = agentData.instructions[agentData.position];
                        if (currentChar === 'L') {
                            // Trigger loop check when agents overlap and one has L at current position
                            agentData.position += 1;
                            overlapLoopTriggered = true;
                            break; // Only need to trigger once
                        }
                    }
                    
                    // Also check if L appears in remaining instructions
                    // Skip over conditionals (C) that might block reaching L
                    if (agentData.position < agentData.instructions.length) {
                        let searchPos = agentData.position;
                        while (searchPos < agentData.instructions.length) {
                            const char = agentData.instructions[searchPos];
                            if (char === 'L') {
                                // Found L in remaining instructions - advance to it and trigger
                                agentData.position = searchPos + 1;
                                overlapLoopTriggered = true;
                                break;
                            } else if (char === 'C') {
                                // Skip conditional - check if condition would be true
                                // If C is followed by L and condition is true, we can reach L
                                if (searchPos + 1 < agentData.instructions.length) {
                                    const nextChar = agentData.instructions[searchPos + 1];
                                    if (nextChar === 'L') {
                                        // CL - check if condition is true (other agent at node)
                                        const hasOtherAgent = hasOtherAgentAtNode(nodeId, agentData.agent.id);
                                        if (hasOtherAgent) {
                                            // Condition is true, can execute L
                                            agentData.position = searchPos + 2; // Skip C and L
                                            overlapLoopTriggered = true;
                                            break;
                                        } else {
                                            // Condition is false, skip the L
                                            searchPos += 2; // Skip C and L
                                            continue;
                                        }
                                    } else {
                                        // C followed by something else, skip both
                                        searchPos += 2;
                                        continue;
                                    }
                                } else {
                                    // C at end, skip it
                                    searchPos += 1;
                                    continue;
                                }
                            } else {
                                // Other instruction, continue searching
                                searchPos += 1;
                            }
                        }
                        if (overlapLoopTriggered) break;
                    }
                }
            }
        }

        if (overlapLoopTriggered) {
            showLoopDialog(graph && graph.hasLoop, false);
            stopProgressing();
            updateAgents();
            return;
        }

        // If no agent has more instructions, break
        if (!hasMoreInstructions) {
            break;
        }

        iteration++;
    }

    updateAgents();

    // Stop if all agents have reached end nodes
    if (allAgentsFinished) {
        stopProgressing();
        // Show success dialog - all agents reached terminating nodes (no loop)
        showLoopDialog(false, true); // hasLoop=false, allFinished=true
    }
}

// Show loop check dialog
// hasLoop: whether the graph has a loop
// allFinished: whether all agents reached terminating nodes (no loop scenario)
function showLoopDialog(hasLoop, allFinished = false) {
    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    let dialogClass, emoji, title, message;
    
    if (hasLoop) {
        // Graph has a loop - success
        dialogClass = 'success';
        emoji = '😊';
        title = 'Success!';
        message = 'The graph contains a loop! Well done!';
    } else if (allFinished) {
        // All agents reached terminating nodes - success (no loop, which is correct)
        dialogClass = 'success';
        emoji = '😊';
        title = 'Well Done!';
        message = 'All agents reached terminating nodes. The graph has no loop, which is correct!';
    } else {
        // No loop detected when L was executed - failure
        dialogClass = 'failure';
        emoji = '😢';
        title = 'Failure';
        message = 'The graph does not contain a loop. Try again!';
    }
    
    const dialog = document.createElement('div');
    dialog.className = `dialog-box ${dialogClass}`;
    
    const emojiElement = document.createElement('div');
    emojiElement.className = 'dialog-emoji';
    emojiElement.textContent = emoji;
    
    const titleElement = document.createElement('div');
    titleElement.className = 'dialog-title';
    titleElement.textContent = title;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'dialog-message';
    messageElement.textContent = message;
    
    const button = document.createElement('button');
    button.className = 'dialog-button';
    button.textContent = 'OK';
    button.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
    
    dialog.appendChild(emojiElement);
    dialog.appendChild(titleElement);
    dialog.appendChild(messageElement);
    dialog.appendChild(button);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}

// Serialize graph to human-readable text format
function serializeGraph() {
    if (!graph) {
        return "No graph available.";
    }

    let result = [];
    result.push(`Graph with ${graph.nodes.length} node(s)`);
    result.push("");

    // List all nodes
    result.push("Nodes:");
    graph.nodes.forEach(node => {
        const nodeId = typeof node === 'object' ? node.id : node;
        const label = node.label || `N${nodeId}`;
        result.push(`  ${label} (ID: ${nodeId})`);
    });
    result.push("");

    // List all edges
    result.push("Edges:");
    if (graph.links.length === 0) {
        result.push("  (no edges)");
    } else {
        graph.links.forEach((link, index) => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const sourceLabel = typeof link.source === 'object' ? link.source.label : `N${sourceId}`;
            const targetLabel = typeof link.target === 'object' ? link.target.label : `N${targetId}`;
            
            let edgeStr = `  ${sourceLabel} -> ${targetLabel}`;
            
            // Mark loop edge
            if (graph.hasLoop && graph.loopEdge === link) {
                edgeStr += " [LOOP]";
            }
            
            result.push(edgeStr);
        });
    }
    result.push("");

    // Summary
    if (graph.hasLoop) {
        result.push("Graph contains a loop.");
    } else {
        result.push("Graph does not contain a loop.");
    }

    return result.join("\n");
}

// Show graph serialization dialog
function showGraphSerialization() {
    if (!graph) {
        alert("No graph available.");
        return;
    }

    const serialized = serializeGraph();

    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'dialog-box';
    dialog.style.maxWidth = '600px';
    dialog.style.width = '90%';
    
    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Graph Serialization';
    title.style.marginBottom = '15px';
    
    const inputContainer = document.createElement('div');
    inputContainer.style.marginBottom = '20px';
    
    const textarea = document.createElement('textarea');
    textarea.value = serialized;
    textarea.readOnly = true;
    textarea.style.width = '100%';
    textarea.style.minHeight = '300px';
    textarea.style.padding = '10px';
    textarea.style.backgroundColor = '#1a1a1a';
    textarea.style.color = '#ffffff';
    textarea.style.border = '1px solid #555555';
    textarea.style.borderRadius = '5px';
    textarea.style.fontFamily = 'monospace';
    textarea.style.fontSize = '12px';
    textarea.style.resize = 'vertical';
    
    // Select all text on focus for easy copying
    textarea.addEventListener('focus', function() {
        this.select();
    });
    
    inputContainer.appendChild(textarea);
    
    const button = document.createElement('button');
    button.className = 'dialog-button';
    button.textContent = 'Close';
    button.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
    
    dialog.appendChild(title);
    dialog.appendChild(inputContainer);
    dialog.appendChild(button);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Focus the textarea to select all text
    setTimeout(() => {
        textarea.focus();
    }, 100);
}

// Parse serialized graph text and reconstruct graph
function parseGraphSerialization(text) {
    try {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Find nodes section
        let nodesStart = -1;
        let edgesStart = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('Nodes:')) {
                nodesStart = i + 1;
            }
            if (lines[i].startsWith('Edges:')) {
                edgesStart = i + 1;
                break;
            }
        }
        
        if (nodesStart === -1 || edgesStart === -1) {
            throw new Error('Invalid format: missing Nodes or Edges section');
        }
        
        // Parse nodes
        const nodes = [];
        const nodeIdMap = new Map(); // Map from label to id
        for (let i = nodesStart; i < edgesStart - 1; i++) {
            const line = lines[i];
            // Format: "N0 (ID: 0)" or just "N0"
            const match = line.match(/(\w+)\s*\(ID:\s*(\d+)\)/) || line.match(/(\w+)/);
            if (match) {
                const label = match[1];
                const id = match[2] !== undefined ? parseInt(match[2]) : nodes.length;
                nodes.push({ id, label });
                nodeIdMap.set(label, id);
            }
        }
        
        // Parse edges
        const links = [];
        let loopEdge = null;
        for (let i = edgesStart; i < lines.length; i++) {
            const line = lines[i];
            if (line === '(no edges)') continue;
            if (line.includes('Graph contains') || line.includes('Graph does not')) break;
            
            // Format: "N0 -> N1" or "N0 -> N1 [LOOP]"
            const match = line.match(/(\w+)\s*->\s*(\w+)(?:\s*\[LOOP\])?/);
            if (match) {
                const sourceLabel = match[1];
                const targetLabel = match[2];
                const isLoop = line.includes('[LOOP]');
                
                const sourceId = nodeIdMap.get(sourceLabel);
                const targetId = nodeIdMap.get(targetLabel);
                
                if (sourceId === undefined || targetId === undefined) {
                    throw new Error(`Invalid edge: node not found (${sourceLabel} or ${targetLabel})`);
                }
                
                const link = { source: sourceId, target: targetId };
                links.push(link);
                
                if (isLoop) {
                    loopEdge = link;
                }
            }
        }
        
        // Determine if graph has loop
        const hasLoop = loopEdge !== null || lines.some(line => line.includes('Graph contains a loop'));
        
        return { nodes, links, hasLoop, loopEdge };
    } catch (error) {
        throw new Error(`Failed to parse graph: ${error.message}`);
    }
}

// Load graph from serialized text
function loadGraphFromSerialization(serializedText) {
    try {
        const graphData = parseGraphSerialization(serializedText);
        
        // Reconstruct graph object
        graph = {
            nodes: graphData.nodes,
            links: graphData.links,
            hasLoop: graphData.hasLoop,
            loopEdge: graphData.loopEdge
        };
        
        // Render the graph
        renderGraph();
        
        // Reset agents
        resetAgents();
        
        return true;
    } catch (error) {
        alert(`Error loading graph: ${error.message}`);
        return false;
    }
}

// Show load graph dialog
function showLoadGraphDialog() {
    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'dialog-box';
    dialog.style.maxWidth = '600px';
    dialog.style.width = '90%';
    
    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Load Graph';
    title.style.marginBottom = '15px';
    
    const inputContainer = document.createElement('div');
    inputContainer.style.marginBottom = '20px';
    
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Paste serialized graph text here...';
    textarea.style.width = '100%';
    textarea.style.minHeight = '300px';
    textarea.style.padding = '10px';
    textarea.style.backgroundColor = '#1a1a1a';
    textarea.style.color = '#ffffff';
    textarea.style.border = '1px solid #555555';
    textarea.style.borderRadius = '5px';
    textarea.style.fontFamily = 'monospace';
    textarea.style.fontSize = '12px';
    textarea.style.resize = 'vertical';
    
    inputContainer.appendChild(textarea);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.justifyContent = 'flex-end';
    
    const loadButton = document.createElement('button');
    loadButton.className = 'dialog-button';
    loadButton.textContent = 'Load';
    loadButton.style.backgroundColor = '#0066cc';
    loadButton.addEventListener('click', () => {
        const text = textarea.value.trim();
        if (!text) {
            alert('Please enter graph serialization text.');
            return;
        }
        
        if (loadGraphFromSerialization(text)) {
            document.body.removeChild(overlay);
        }
    });
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'dialog-button';
    cancelButton.textContent = 'Cancel';
    cancelButton.style.backgroundColor = '#666666';
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(loadButton);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
    
    dialog.appendChild(title);
    dialog.appendChild(inputContainer);
    dialog.appendChild(buttonContainer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Focus the textarea
    setTimeout(() => {
        textarea.focus();
    }, 100);
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);

