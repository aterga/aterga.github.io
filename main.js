// Feature flags for development/debugging
const __featureFlags = {
    EDIT_MODE: {
        get enabled() {
            const stored = localStorage.getItem('featureFlag_EDIT_MODE');
            return stored === 'true';
        },
        set: function (value) {
            localStorage.setItem('featureFlag_EDIT_MODE', value.toString());

            if (value) {
                // When enabling, save current data to localStorage if not already saved
                if (!localStorage.getItem('modifiedTreeData') && rootData) {
                    saveModifiedData();
                }
                // Show control buttons
                showControlButtons();
                // Toggle weight labels on all currently rendered nodes
                toggleWeightLabels(true);
                // Re-check overflow on all nodes
                highlightOverflowNodes();
            } else {
                // Hide control buttons
                hideControlButtons();
                // Remove weight labels
                toggleWeightLabels(false);
                // Remove overflow highlighting
                highlightOverflowNodes();
            }
        }
    }
};

// Create and show control buttons
function showControlButtons() {
    // Check if buttons already exist
    if (document.getElementById('weight-controls')) {
        document.getElementById('weight-controls').style.display = 'flex';
        return;
    }

    // Create container
    const container = document.createElement('div');
    container.id = 'weight-controls';
    container.className = 'weight-controls';

    // Create multiply input and button
    const multiplyLabel = document.createElement('span');
    multiplyLabel.textContent = 'Multiply all by:';
    multiplyLabel.style.color = 'white';
    multiplyLabel.style.fontWeight = 'bold';
    multiplyLabel.style.marginRight = '5px';

    const multiplyInput = document.createElement('input');
    multiplyInput.id = 'multiply-factor-input';
    multiplyInput.type = 'number';
    multiplyInput.step = '0.1';
    multiplyInput.value = '1.0';
    multiplyInput.style.width = '60px';
    multiplyInput.style.padding = '8px';
    multiplyInput.style.fontSize = '14px';
    multiplyInput.style.borderRadius = '4px';
    multiplyInput.style.border = '1px solid #ccc';

    const multiplyBtn = document.createElement('button');
    multiplyBtn.id = 'multiply-weights-btn';
    multiplyBtn.className = 'control-btn';
    multiplyBtn.textContent = 'Apply';
    multiplyBtn.addEventListener('click', function () {
        multiplyAllWeights();
    });

    // Create Reset button
    const resetBtn = document.createElement('button');
    resetBtn.id = 'reset-weights-btn';
    resetBtn.className = 'control-btn';
    resetBtn.textContent = 'Reset Weights';
    resetBtn.addEventListener('click', function () {
        if (confirm('Reset all weights to original values from root.json? This will clear your modifications.')) {
            clearModifiedData();
            window.location.reload();
        }
    });

    // Create Save button
    const saveBtn = document.createElement('button');
    saveBtn.id = 'save-weights-btn';
    saveBtn.className = 'control-btn';
    saveBtn.textContent = 'Save to File';
    saveBtn.addEventListener('click', function () {
        saveCurrentViewToFile();
    });

    container.appendChild(multiplyLabel);
    container.appendChild(multiplyInput);
    container.appendChild(multiplyBtn);
    container.appendChild(resetBtn);
    container.appendChild(saveBtn);
    document.body.appendChild(container);
}

// Hide control buttons
function hideControlButtons() {
    const container = document.getElementById('weight-controls');
    if (container) {
        container.style.display = 'none';
    }
}

// Save modified tree data to localStorage
function saveModifiedData() {
    if (rootData) {
        localStorage.setItem('modifiedTreeData', JSON.stringify(rootData));
    }
}

// Helper function to update rootData when children are dynamically loaded
function updateRootDataWithLoadedChildren(nodeData, children) {
    if (!rootData) return;

    // Create a unique identifier for the node
    function getNodeId(node) {
        if (node.name) return `name:${node.name}`;
        if (node.img) return `img:${node.img}`;
        if (node.text && Array.isArray(node.text) && node.text.length > 0) {
            return `text:${node.text[0].substring(0, 50)}`;
        }
        return null;
    }

    const targetId = getNodeId(nodeData);
    if (!targetId) return;

    // Build path from current URL hash
    const currentHash = window.location.hash.slice(1);
    const pathSegments = currentHash ? currentHash.split('/') : [];

    // Find the node in rootData following the path and attach children
    function findAndAttachWithPath(current, segments) {
        // If we've consumed all path segments, check if this is the target
        if (segments.length === 0) {
            const currentId = getNodeId(current);
            if (currentId === targetId) {
                current.children = children;
                return true;
            }
            return false;
        }

        // Navigate to the next segment in the path
        const nextSegment = segments[0];
        const remainingPath = segments.slice(1);

        if (current.children) {
            for (const child of current.children) {
                const childSlug = nameToSlug(child.name);
                if (childSlug === nextSegment) {
                    // Check if this child is the target (before going deeper)
                    const childId = getNodeId(child);
                    if (childId === targetId && remainingPath.length === 0) {
                        child.children = children;
                        return true;
                    }
                    // Otherwise continue down this branch
                    if (findAndAttachWithPath(child, remainingPath)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    findAndAttachWithPath(rootData, pathSegments);
}

// Load modified tree data from localStorage
function loadModifiedData() {
    const stored = localStorage.getItem('modifiedTreeData');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return null;
        }
    }
    return null;
}

// Clear modified tree data from localStorage
function clearModifiedData() {
    localStorage.removeItem('modifiedTreeData');
}

// Helper function to find and update a node in rootData by matching content and path
function updateNodeValueInRootData(nodeData, newValue, nodePath = null) {
    if (!rootData) {
        return false;
    }

    // Create a unique identifier for the node including path
    function getNodeId(node) {
        if (node.name) return `name:${node.name}`;
        if (node.img) return `img:${node.img}`;
        if (node.text && Array.isArray(node.text) && node.text.length > 0) {
            // Use first 50 chars of first text element as ID
            return `text:${node.text[0].substring(0, 50)}`;
        }
        return null;
    }

    const targetId = getNodeId(nodeData);
    if (!targetId) {
        return false;
    }

    // Build path from current URL hash if not provided
    if (!nodePath) {
        const currentHash = window.location.hash.slice(1);
        nodePath = currentHash ? currentHash.split('/') : [];
    }

    // Try to find and update the node by traversing the tree following the path
    function findAndUpdateWithPath(current, pathSegments, depth = 0) {
        // If we've consumed all path segments, search in current node's children
        if (pathSegments.length === 0) {
            if (current.children) {
                for (let i = 0; i < current.children.length; i++) {
                    const child = current.children[i];
                    const childId = getNodeId(child);

                    if (childId === targetId) {
                        child.value = newValue;
                        return true;
                    }
                }
            }
            return false;
        }

        // Navigate to the next segment in the path
        const nextSegment = pathSegments[0];
        const remainingPath = pathSegments.slice(1);

        if (current.children) {
            for (const child of current.children) {
                const childSlug = nameToSlug(child.name);
                if (childSlug === nextSegment) {
                    // Found the path segment, continue down this branch
                    if (findAndUpdateWithPath(child, remainingPath, depth + 1)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    const result = findAndUpdateWithPath(rootData, nodePath);
    if (!result) {
        // Even if not found in rootData, the update to d.data.value will persist
        // in the current view and will be saved when navigating back
        return true; // Return true to allow the operation to continue
    }
    return result;
}

// Helper function to get the path (array of names) from root to a node (deprecated, kept for compatibility)
function getNodePathArray(d) {
    const path = [];
    d.ancestors().reverse().slice(1).forEach(node => {
        if (node.data.name) {
            path.push(node.data.name);
        }
    });
    return path;
}

// Helper function to multiply all weights in the current view by a factor
// Special case: factor = 0 sets all weights to 1 (equalize)
function multiplyAllWeights() {
    const input = document.getElementById('multiply-factor-input');
    const factor = parseFloat(input.value);

    if (isNaN(factor) || factor < 0) {
        alert('Please enter a valid non-negative number');
        return;
    }

    // Get current hash to determine which node we're viewing
    const currentHash = window.location.hash.slice(1);

    let currentNode;

    if (!currentHash) {
        // At root level - multiply all children of root
        currentNode = rootData;
    } else {
        // Navigate to the current node
        const segments = currentHash.split('/');
        currentNode = rootData;

        // Navigate through the tree following the path
        for (const segment of segments) {
            if (!currentNode.children) break;

            const targetSlug = segment;
            const nextNode = currentNode.children.find(child =>
                nameToSlug(child.name) === targetSlug
            );

            if (!nextNode) {
                break;
            }

            currentNode = nextNode;
        }
    }

    // Multiply all children's weights (or equalize if factor is 0)
    if (currentNode && currentNode.children) {
        const isEqualizing = factor === 0;

        currentNode.children.forEach(child => {
            if (child.value !== undefined) {
                if (isEqualizing) {
                    child.value = 1; // Set all to 1 to equalize
                } else {
                    child.value = Math.round(child.value * factor * 10) / 10; // Round to 1 decimal
                }
            }
        });

        saveModifiedData();
        reRenderCurrentView();
    } else {
        alert('No children found in current view');
    }
}

// Helper function to export modified data
// Helper function to export modified data
function exportModifiedData() {
    // Get current hash to determine which node we're viewing
    const currentHash = window.location.hash.slice(1);

    let dataToExport;

    if (!currentHash) {
        // At root level - export all children of root
        dataToExport = rootData.children || [];
    } else {
        // Navigate to the current node and export its children
        const segments = currentHash.split('/');
        let currentNode = rootData;

        // Navigate through the tree following the path
        for (const segment of segments) {
            if (!currentNode.children) break;

            const targetSlug = segment;
            const nextNode = currentNode.children.find(child =>
                nameToSlug(child.name) === targetSlug
            );

            if (!nextNode) {
                break;
            }

            currentNode = nextNode;
        }

        // Export the children of the current node
        dataToExport = currentNode.children || [];
    }

    // Clean the export: remove children arrays from nodes that have children_file
    // This exports only what's visible in the current view
    const cleanedData = dataToExport.map(child => {
        const cleaned = { ...child };

        // If this child has children_file, remove the children array
        // Keep children_file reference but not the loaded children
        if (cleaned.children_file && cleaned.children) {
            delete cleaned.children;
        }

        return cleaned;
    });

    const jsonOutput = JSON.stringify(cleanedData, null, 2);

    // Copy to clipboard if available
    if (navigator.clipboard) {
        navigator.clipboard.writeText(jsonOutput);
    }
}

// Helper function to save current view's children to the appropriate file
function saveCurrentViewToFile() {
    // Get current hash to determine which node we're viewing
    const currentHash = window.location.hash.slice(1);

    let dataToSave;
    let filename;
    let currentNode;

    if (!currentHash) {
        // At root level - save all children to root.json
        dataToSave = rootData.children || [];
        filename = 'root.json';
        currentNode = rootData;
    } else {
        // Navigate to the current node
        const segments = currentHash.split('/');
        currentNode = rootData;

        // Navigate through the tree following the path
        for (const segment of segments) {
            if (!currentNode.children) break;

            const targetSlug = segment;
            const nextNode = currentNode.children.find(child =>
                nameToSlug(child.name) === targetSlug
            );

            if (!nextNode) {
                break;
            }

            currentNode = nextNode;
        }

        // Check if this node has a children_file
        if (currentNode.children_file) {
            filename = currentNode.children_file;
            dataToSave = currentNode.children || [];
        } else {
            // No children_file, save to root.json
            filename = 'root.json';
            // Need to save the entire rootData
            dataToSave = rootData;
        }
    }

    // Clean the data: remove children arrays from nodes that have children_file
    // This saves only what should be in the file
    function cleanNode(node) {
        const cleaned = { ...node };

        // If this node has children_file, remove the children array
        if (cleaned.children_file && cleaned.children) {
            delete cleaned.children;
        }

        // Recursively clean children - ensure it's an array
        if (cleaned.children && !cleaned.children_file) {
            // Convert to array if needed
            const childrenArray = Array.isArray(cleaned.children)
                ? cleaned.children
                : Object.values(cleaned.children);
            cleaned.children = childrenArray.map(cleanNode);
        }

        return cleaned;
    }

    let cleanedData;
    if (filename === 'root.json' && !currentHash) {
        // Saving root.json from root view - ensure proper structure
        const rootCopy = { ...rootData };
        // Ensure children is an array
        if (rootCopy.children && !Array.isArray(rootCopy.children)) {
            rootCopy.children = Object.values(rootCopy.children);
        }
        cleanedData = cleanNode(rootCopy);
    } else if (filename === 'root.json') {
        // Saving root.json from a nested view (save entire root)
        const rootCopy = { ...rootData };
        // Ensure children is an array
        if (rootCopy.children && !Array.isArray(rootCopy.children)) {
            rootCopy.children = Object.values(rootCopy.children);
        }
        cleanedData = cleanNode(rootCopy);
    } else {
        // Saving a children_file - should be an array
        const childrenArray = Array.isArray(dataToSave)
            ? dataToSave
            : Object.values(dataToSave);
        cleanedData = childrenArray.map(cleanNode);
    }

    const jsonOutput = JSON.stringify(cleanedData, null, 2);

    // Create a download link
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.split('/').pop(); // Get just the filename
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show helpful message with file path
    const fullPath = filename.startsWith('map/') ? filename : `map/${filename}`;
    const message = `✓ Downloaded ${filename.split('/').pop()}\n\n` +
        `Move this file to: ${fullPath}\n\n` +
        `Terminal command:\n` +
        `mv ~/Downloads/${filename.split('/').pop()} ${fullPath}`;

    // Show alert with instructions
    alert(message);
}

// Helper function to re-render the current view
function reRenderCurrentView() {
    // Clear all weight labels before re-rendering
    d3.selectAll('.weight-label').remove();

    // Clear the SVG
    svg.selectAll("g").remove();

    // Reset domain to identity mapping
    x.domain([0, width]);
    y.domain([0, height]);

    // Get current hash and navigate using the same logic as initial load
    const currentHash = window.location.hash.slice(1);
    // Create a fresh treemap from the original data
    const newRoot = treemap(JSON.parse(JSON.stringify(rootData)));

    if (currentHash) {
        navigateToPath(newRoot, currentHash, svg.append("g"));
    } else {
        svg.append("g").call(render, newRoot);
    }
}

// Function to toggle weight labels on rendered nodes
function toggleWeightLabels(show) {
    if (show) {
        // Remove any existing labels first
        d3.selectAll('.weight-label').remove();

        // Add weight labels overlaid on existing content
        d3.selectAll('.content-frame').each(function (d) {
            const contentFrameDiv = d3.select(this);
            if (d && !contentFrameDiv.classed('header-frame')) {
                const rect = this.getBoundingClientRect();
                const label = d3.select('body').append('div')
                    .attr('class', 'weight-label')
                    .attr('data-node-id', hash(d, 0));

                // Add input field
                const input = label.append('input')
                    .attr('type', 'number')
                    .attr('value', d.data.value || d.value)
                    .style('width', '60px')
                    .style('font-size', '14pt')
                    .style('font-weight', 'bold')
                    .style('text-align', 'center')
                    .style('border', 'none')
                    .style('background', 'transparent')
                    .style('color', '#000')
                    .on('keydown', function () {
                        if (d3.event.key === 'Enter') {
                            const newValue = parseFloat(this.value);
                            if (!isNaN(newValue) && newValue > 0) {
                                // Store the node ID to refocus after re-render
                                localStorage.setItem('lastFocusedNodeId', hash(d, 0));

                                // Update the hierarchy node
                                d.data.value = newValue;
                                // Update rootData
                                if (updateNodeValueInRootData(d.data, newValue)) {
                                    saveModifiedData();
                                    // Update successful
                                    // Re-rendering
                                    reRenderCurrentView();
                                } else {
                                    // Update failed
                                }
                            }
                        } else if (d3.event.key === 'ArrowUp' || d3.event.key === 'ArrowDown') {
                            // Let the default behavior happen first (increment/decrement)
                            // Then trigger update on the next tick
                            setTimeout(() => {
                                const newValue = parseFloat(this.value);
                                if (!isNaN(newValue) && newValue > 0) {
                                    // Store the node ID to refocus after re-render
                                    localStorage.setItem('lastFocusedNodeId', hash(d, 0));

                                    // Update the hierarchy node
                                    d.data.value = newValue;
                                    // Update rootData
                                    if (updateNodeValueInRootData(d.data, newValue)) {
                                        saveModifiedData();
                                        // Update successful
                                        // Re-rendering
                                        reRenderCurrentView();
                                    } else {
                                        // Update failed
                                    }
                                }
                            }, 0);
                        }
                    })
                    .on('change', function () {
                        const newValue = parseFloat(this.value);
                        if (!isNaN(newValue) && newValue > 0) {
                            // Update the hierarchy node
                            d.data.value = newValue;
                            // Update rootData
                            if (updateNodeValueInRootData(d.data, newValue)) {
                                saveModifiedData();
                                // Update successful
                            }
                        }
                    })
                    .on('click', function () {
                        // Prevent click from propagating to zoom
                        d3.event.stopPropagation();
                        this.select();
                    });

                label.style('left', (rect.left + rect.width / 2) + 'px')
                    .style('top', (rect.top + rect.height / 2) + 'px')
                    .style('transform', 'translate(-50%, -50%)')
                    .style('pointer-events', 'auto');

                // Check if this is the node that should be refocused
                const lastFocusedNodeId = localStorage.getItem('lastFocusedNodeId');
                if (lastFocusedNodeId && hash(d, 0).toString() === lastFocusedNodeId) {
                    setTimeout(() => {
                        input.node().focus();
                        input.node().select();
                        localStorage.removeItem('lastFocusedNodeId');
                    }, 100);
                }
            }
        });
    } else {
        // Remove all weight labels
        d3.selectAll('.weight-label').remove();
    }
}

// Function to update weight label positions (call during transitions/scrolling)
function updateWeightLabelPositions() {
    if (!__featureFlags.EDIT_MODE.enabled) return;

    d3.selectAll('.content-frame').each(function (d) {
        if (d && !d3.select(this).classed('header-frame')) {
            const rect = this.getBoundingClientRect();
            const nodeId = hash(d, 0);
            d3.selectAll('.weight-label')
                .filter(function () { return d3.select(this).attr('data-node-id') === nodeId.toString(); })
                .style('left', (rect.left + rect.width / 2) + 'px')
                .style('top', (rect.top + rect.height / 2) + 'px');
        }
    });
}

// Function to detect and highlight nodes with overflowing content
function highlightOverflowNodes() {
    if (!__featureFlags.EDIT_MODE.enabled) {
        // Remove overflow highlighting - just remove the class
        d3.selectAll('.content').classed('has-overflow', false);
        return;
    }

    // Use requestAnimationFrame to ensure DOM is fully rendered and settled
    requestAnimationFrame(() => {
        // Check each content node for overflow
        d3.selectAll('.content').each(function () {
            const element = this;
            const hasOverflow = element.scrollHeight > element.clientHeight ||
                element.scrollWidth > element.clientWidth;

            // Just toggle the class - all styling is in CSS
            d3.select(element).classed('has-overflow', hasOverflow);
        });
    });
}

// From https://stackoverflow.com/a/7616484/12163693
Object.defineProperty(String.prototype, 'hashCode', {
    value: function () {
        var hash = 0, i, chr;
        for (i = 0; i < this.length; i++) {
            chr = this.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
});

// Inspired by https://observablehq.com/@d3/zoomable-treemap

const height = 924
const width = 954
const header_height = 80
const bleeding = 0
const ble = 4

const x = d3.scaleLinear().rangeRound([0, width]);
const y = d3.scaleLinear().rangeRound([0, height]);

var svg = d3.select('.main').append('svg')
    .attr("viewBox", [-ble, -header_height - ble,
    width + 2 * ble, height + header_height + 2 * ble])
    // .attr("preserveAspectRatio", "slice")
    .attr("xmlns", "http://www.w3.org/2000/svg");
// .style("font", "100% sans-serif");

let rootData = null; // Store root data for browser navigation

// Check if we should use modified data from localStorage
const storedFlag = localStorage.getItem('featureFlag_EDIT_MODE');
const modifiedData = loadModifiedData();

// Show control buttons if feature is enabled
if (storedFlag === 'true') {
    showControlButtons();
}

if (modifiedData && storedFlag === 'true') {
    rootData = modifiedData;
    const root = treemap(rootData);

    // Set initial domain to identity mapping
    x.domain([0, width]);
    y.domain([0, height]);

    // Check if there's a hash in the URL to navigate to
    const path = window.location.hash.slice(1);
    navigateToPath(root, path, svg.append("g"));

    // Handle browser back/forward buttons
    setupPopstateHandler();
} else {
    // Load from root.json
    d3.json("./map/root.json").then(function (data) {
        rootData = data; // Save for later use
        const root = treemap(data);

        // Set initial domain to identity mapping (treemap creates coords from 0 to width/height)
        x.domain([0, width]);
        y.domain([0, height]);

        // Check if there's a hash in the URL to navigate to
        const path = window.location.hash.slice(1); // Remove the '#'
        navigateToPath(root, path, svg.append("g"));

        // Handle browser back/forward buttons
        setupPopstateHandler();
    }).catch(function (error) {
    });
}

function setupPopstateHandler() {
    window.addEventListener('popstate', function (event) {
        // Clear existing SVG content
        svg.selectAll("g").remove();

        // Reset domain to identity mapping for fresh render
        x.domain([0, width]);
        y.domain([0, height]);

        // Get the hash and navigate using the same logic as initial load
        const newHash = window.location.hash.slice(1);
        // Create a fresh treemap from the original data (deep copy to avoid mutations)
        const newRoot = treemap(JSON.parse(JSON.stringify(rootData)));

        if (newHash) {
            navigateToPath(newRoot, newHash, svg.append("g"));
        } else {
            svg.append("g").call(render, newRoot);
        }
    });

    // Update weight label positions on scroll
    let scrollTimeout;
    window.addEventListener('scroll', function () {
        // Debounce scroll updates for better performance
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(() => {
            updateWeightLabelPositions();
        }, 10);
    }, true); // Use capture phase to catch all scroll events
}

function treemap(data) {
    const tm = d3.treemap().tile(tile).size([width, height]);
    const res = tm(d3.hierarchy(data).sum(d => d.value));
    return res;
}

// Helper function to process children after preTile calculation
// refWidth/refHeight: dimensions used for preTile (affects partitioning decisions)
// x0, y0, x1, y1: target bounds to scale children coordinates to
function processTileChildren(node, refWidth, refHeight, x0, y0, x1, y1) {
    for (const child of node.children) {
        // Calculate corner status based on reference dimensions
        child.is_north = (child.y0 == 0);
        child.is_south = (child.y1 == refHeight);
        child.is_west = (child.x0 == 0);
        child.is_east = (child.x1 == refWidth);

        // Apply bleeding to children that have their own children
        if (child.children) {
            if (child.is_north) child.y0 -= bleeding;
            if (child.is_south) child.y1 += bleeding;
            if (child.is_west) child.x0 -= bleeding;
            if (child.is_east) child.x1 += bleeding;
        }

        // Scale coordinates from reference space to target bounds
        child.x0 = x0 + child.x0 / refWidth * (x1 - x0);
        child.x1 = x0 + child.x1 / refWidth * (x1 - x0);
        child.y0 = y0 + child.y0 / refHeight * (y1 - y0);
        child.y1 = y0 + child.y1 / refHeight * (y1 - y0);
    }
}

function tile(node, x0, y0, x1, y1) {
    preTile(node, 0, 0, width, height);
    processTileChildren(node, width, height, x0, y0, x1, y1);
}

function preTile(parent, x0, y0, x1, y1) {
    var nodes = parent.children,
        i, n = nodes.length,
        sum,
        sums = new Array(n + 1);

    for (sums[0] = sum = i = 0; i < n; ++i) {
        sums[i + 1] = sum += nodes[i].data.value;
    }

    // The only modification compared to
    //  https://github.com/d3/d3-hierarchy/blob/master/src/treemap/binary.js
    //  is that we initialize value with sums[sums.length - 1] rather than parent.value
    partition(0, n, sums[sums.length - 1], x0, y0, x1, y1);

    function partition(i, j, value, x0, y0, x1, y1) {
        if (i >= j - 1) {
            var node = nodes[i];
            node.x0 = x0, node.y0 = y0;
            node.x1 = x1, node.y1 = y1;
            return;
        }

        var valueOffset = sums[i],
            valueTarget = (value / 2) + valueOffset,
            k = i + 1,
            hi = j - 1;

        while (k < hi) {
            var mid = k + hi >>> 1;
            if (sums[mid] < valueTarget) k = mid + 1;
            else hi = mid;
        }

        if ((valueTarget - sums[k - 1]) < (sums[k] - valueTarget) && i + 1 < k) --k;

        var valueLeft = sums[k] - valueOffset,
            valueRight = value - valueLeft;

        if ((x1 - x0) > (y1 - y0)) {
            var xk = value ? (x0 * valueRight + x1 * valueLeft) / value : x1;
            partition(i, k, valueLeft, x0, y0, xk, y1);
            partition(k, j, valueRight, xk, y0, x1, y1);
        } else {
            var yk = value ? (y0 * valueRight + y1 * valueLeft) / value : y1;
            partition(i, k, valueLeft, x0, y0, x1, yk);
            partition(k, j, valueRight, x0, yk, x1, y1);
        }
    }
}

function hash(d, i) {
    if (d.data.name) return `${d.data.name}-${i}`
    if (d.data.img) return `${d.data.img}-${i}`
    if (d.data.text) return d.data.text.join("").hashCode()

    throw "Invalid json: each node should have 'name', 'text', or 'img'."
}

function name(d) {
    return d.ancestors().reverse().map(d => d.data.name).join(" <span class='arrow'>&#10230;</span> ")
}

// Convert node name to URL-friendly slug
function nameToSlug(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')      // Replace spaces with hyphens
        .replace(/--+/g, '-')      // Replace multiple hyphens with single hyphen
        .trim();
}

// Get URL hash path from node (e.g., "links-to-my-talks")
function getNodePath(d) {
    const ancestors = d.ancestors().reverse().slice(1); // Skip root "Arshavir's Page"
    if (ancestors.length === 0) return '';
    return ancestors.map(node => nameToSlug(node.data.name)).join('/');
}

// Navigate to a specific path in the tree based on URL hash
// path: URL hash like "more-from-my-phd/student-projects"
// root: the root node of the tree (full tree with all coordinates)
// group: the SVG group to render into
function navigateToPath(root, path, group) {
    if (!path) {
        // No path, render root with identity domain
        x.domain([0, width]);
        y.domain([0, height]);
        group.call(render, root);
        return;
    }

    const segments = path.split('/');
    let currentNode = root;
    let segmentIndex = 0;

    // Function to continue navigation after loading children if needed
    function continueNavigation() {
        if (segmentIndex >= segments.length) {
            // We've reached the target node
            // If the target has children_file but no children, load them before rendering
            if (currentNode.data.children_file && !currentNode.children) {
                loadChildrenAndRender(currentNode);
            } else {
                // Render this node as root, preserving parent reference for breadcrumb and zoomout
                const newRoot = treemap(currentNode.data);
                // currentNode.parent has coordinates from the full tree
                newRoot.parent = currentNode.parent;

                // Use identity domain for fresh render
                x.domain([0, width]);
                y.domain([0, height]);
                group.call(render, newRoot);
            }
            return;
        }

        const targetSlug = segments[segmentIndex];

        // Find the child node that matches the current segment
        if (!currentNode.children) {
            // No children available, rebuild and render what we have
            const newRoot = treemap(currentNode.data);
            newRoot.parent = currentNode.parent;
            x.domain([0, width]);
            y.domain([0, height]);
            group.call(render, newRoot);
            return;
        }

        const nextNode = currentNode.children.find(child =>
            nameToSlug(child.data.name) === targetSlug
        );

        if (!nextNode) {
            // Target not found, rebuild and render what we have
            const newRoot = treemap(currentNode.data);
            newRoot.parent = currentNode.parent;
            x.domain([0, width]);
            y.domain([0, height]);
            group.call(render, newRoot);
            return;
        }

        currentNode = nextNode;
        segmentIndex++;

        // If this node has children_file and no children loaded yet, load them
        if (currentNode.data.children_file && !currentNode.children && segmentIndex < segments.length) {
            loadChildrenAndContinue(currentNode);
        } else {
            continueNavigation();
        }
    }

    // Load children from external file and continue navigation
    function loadChildrenAndContinue(node) {
        d3.json(node.data.children_file).then(function (children) {
            // Attach children to data for future navigation
            node.data.children = children;

            // Also update rootData to include these children
            updateRootDataWithLoadedChildren(node.data, children);

            // Rebuild the node with its children using treemap
            // This gives proper coordinates for navigation
            const hierarchy = d3.hierarchy(node.data).sum(d => d.value);
            const tm = d3.treemap().tile(tile).size([width, height]);
            const newNode = tm(hierarchy);

            // Keep parent reference
            newNode.parent = node.parent;

            // Replace current node in tree if it has a parent
            if (node.parent && node.parent.children) {
                const index = node.parent.children.indexOf(node);
                if (index !== -1) {
                    node.parent.children[index] = newNode;
                }
            }

            currentNode = newNode;
            continueNavigation();
        });
    }

    // Load children from external file and render the final node
    function loadChildrenAndRender(node) {
        d3.json(node.data.children_file).then(function (children) {
            node.data.children = children;

            // Also update rootData to include these children
            updateRootDataWithLoadedChildren(node.data, children);

            // Rebuild treemap with loaded data
            const newRoot = treemap(node.data);
            // Preserve parent reference from original navigation
            newRoot.parent = node.parent;

            // Use identity domain for fresh render
            x.domain([0, width]);
            y.domain([0, height]);
            group.call(render, newRoot);
        });
    }

    // Start navigation
    continueNavigation();
}

function aspect_ratio(d) {
    return (x(d.x1) - x(d.x0)) / (y(d.y1) - y(d.y0))
}

function pick_content(d) {
    // In case this is a text block
    if (d.text) {
        if (Array.isArray(d.text)) {
            return d.text.map((paragraph) => paragraph.replace(/~/g, '&nbsp;'))
        } else if (typeof d.text == "string") {
            return [d.text.replace(/~/g, '&nbsp;')]
        } else {
            throw `Incorrect type in JSON data. Field 'text' must be array of strings or string. Actual type: ${typeof d.text} (${JSON.stringify(d.text)})`
        }
    }
    // In case this is a pure navigation node without any text
    if (d.saved_children && d.saved_children.length > 0) {
        return []
    }
    // Otherwise
    return ['']
}

function position(group, root) {
    const res = group
        .selectAll("g")
        .attr("transform", d => d === root ? `translate(0,-${header_height})` : `translate(${x(d.x0)},${y(d.y0)})`)
        .select("rect")
        .attr("width", d => d === root ? width : x(d.x1) - x(d.x0))
        .attr("height", d => d === root ? header_height : y(d.y1) - y(d.y0));

    return res;
}

function fit_content(group, root) {
    return group
        .selectAll("g")
        .select(".svg-content")
        .attr("width", d => d === root ? width : x(d.x1) - x(d.x0))
        .attr("height", d => d === root ? header_height : y(d.y1) - y(d.y0));
}

function render(group, root) {
    const node = group
        .selectAll("g")
        .data([root].concat(root.children || []))
        .join("g");

    node.filter(d => d === root ? d.parent : (d.children || d.data.children_file))
        .on("click", d => d === root ? zoomout(group, root) : zoomin(group, d))

    node.on("mouseout", d => {
        node.filter(e => e === d)
            .classed("hover", false)
    })
    node.on("mouseover", d => {
        node.filter(e => e === d)
            .classed("hover", true)
    })

    node.append("rect")
        .attr("id", (d, i) => (d.leafUid = "leaf" + i).id)
        .attr("fill", "transparent")
        .attr("stroke-width", 0)
    // .attr("stroke", "#000")

    const fo = node
        .append("foreignObject")
        .attr("fill", "transparent")
        .attr("class", "svg-content");

    const contentFrame = fo
        .append('xhtml:div')
        .attr("class", d => {
            if (d === root) return "content-frame header-frame"
            if (d.children || d.data.children_file) return "content-frame expanding-frame"
            return "content-frame"
        });

    const div = contentFrame.append('div');

    var content_classes = {}
    var content_divs = div.filter(d => d !== root);
    content_divs.each((d, i) => {
        var cs = ["content"]
        if (d.is_north) cs.push("north")
        if (d.is_east) cs.push("east")
        if (d.is_south) cs.push("south")
        if (d.is_west) cs.push("west")
        if (d.data.img) cs.push("img-holder")
        if (d.children || d.data.children_file) cs.push("clickable")
        content_classes[hash(d, i)] = cs
    })
    content_divs.attr("class", (d, i) => content_classes[hash(d, i)].join(" "))

    var header_div = div.filter(d => d === root)
        .attr("class", d => d.parent ? "clickable header" : "header");

    header_div.selectAll("a")
        .data(d => [name(d)])
        .join("a")
        .html(d => d)

    // Add images (which need to be resized afterwards via resize_img)    
    var image_divs = content_divs.filter(d => d.data.img);
    image_divs.append("div")
        .attr("style", d => `background-image: url(${d.data.img})`)
        .attr("class", d => d.data.paper ? "img paper" : "img photo")
        .html(d => d.data.paper ? `<a class='paper' href='${d.data.paper}'> </a>` : ``)

    // Add paragraphs with name and text
    var text_divs = content_divs.filter(d => d.data.name);
    text_divs.selectAll("h3")
        .data(d => [d.data.name])
        .join("h3")
        .html(d => d)
    text_divs.selectAll("p")
        .data(d => pick_content(d.data))
        .join("p")
        .html(d => d)

    // Add paragraphs without name and with text
    var text_only_divs = content_divs.filter(d => d.data.text);
    text_only_divs.selectAll("p")
        .data(d => pick_content(d.data))
        .join("p")
        .html(d => d)

    // Add weight labels if feature flag is enabled (overlaid on top of content)
    if (__featureFlags.EDIT_MODE.enabled) {
        const content_frames = contentFrame.filter(d => d !== root);
        content_frames.each(function (d) {
            const frame = this;
            // Use setTimeout to ensure DOM is rendered and we can get bounding rect
            setTimeout(() => {
                const rect = frame.getBoundingClientRect();
                const label = d3.select('body').append("div")
                    .attr("class", "weight-label")
                    .attr('data-node-id', hash(d, 0))
                    .style('pointer-events', 'auto');

                // Add input field
                const input = label.append('input')
                    .attr('type', 'number')
                    .attr('value', d.data.value || d.value)
                    .style('width', '60px')
                    .style('font-size', '14pt')
                    .style('font-weight', 'bold')
                    .style('text-align', 'center')
                    .style('border', 'none')
                    .style('background', 'transparent')
                    .style('color', '#000')
                    .on('keydown', function () {
                        if (d3.event.key === 'Enter') {
                            const newValue = parseFloat(this.value);
                            if (!isNaN(newValue) && newValue > 0) {
                                // Store the node ID to refocus after re-render
                                localStorage.setItem('lastFocusedNodeId', hash(d, 0));

                                // Update the hierarchy node
                                d.data.value = newValue;
                                // Update rootData
                                if (updateNodeValueInRootData(d.data, newValue)) {
                                    saveModifiedData();
                                    // Update successful
                                    // Re-rendering
                                    reRenderCurrentView();
                                } else {
                                    // Update failed
                                }
                            }
                        } else if (d3.event.key === 'ArrowUp' || d3.event.key === 'ArrowDown') {
                            // Let the default behavior happen first (increment/decrement)
                            // Then trigger update on the next tick
                            setTimeout(() => {
                                const newValue = parseFloat(this.value);
                                if (!isNaN(newValue) && newValue > 0) {
                                    // Store the node ID to refocus after re-render
                                    localStorage.setItem('lastFocusedNodeId', hash(d, 0));

                                    // Update the hierarchy node
                                    d.data.value = newValue;
                                    // Update rootData
                                    if (updateNodeValueInRootData(d.data, newValue)) {
                                        saveModifiedData();
                                        // Update successful
                                        // Re-rendering
                                        reRenderCurrentView();
                                    } else {
                                        // Update failed
                                    }
                                }
                            }, 0);
                        }
                    })
                    .on('change', function () {
                        const newValue = parseFloat(this.value);
                        if (!isNaN(newValue) && newValue > 0) {
                            // Update the hierarchy node
                            d.data.value = newValue;
                            // Update rootData
                            if (updateNodeValueInRootData(d.data, newValue)) {
                                saveModifiedData();
                                // Update successful
                            }
                        }
                    })
                    .on('click', function () {
                        // Prevent click from propagating to zoom
                        d3.event.stopPropagation();
                        this.select();
                    });

                label.style('left', (rect.left + rect.width / 2) + 'px')
                    .style('top', (rect.top + rect.height / 2) + 'px')
                    .style('transform', 'translate(-50%, -50%)');

                // Check if this is the node that should be refocused
                const lastFocusedNodeId = localStorage.getItem('lastFocusedNodeId');
                if (lastFocusedNodeId && hash(d, 0).toString() === lastFocusedNodeId) {
                    setTimeout(() => {
                        input.node().focus();
                        input.node().select();
                        localStorage.removeItem('lastFocusedNodeId');
                    }, 100);
                }
            }, 0);
        });
    }

    group.call(fit_content, root);
    group.call(position, root);

    // Check for overflow after rendering (with a delay to ensure DOM is ready and positioned)
    if (__featureFlags.EDIT_MODE.enabled) {
        setTimeout(highlightOverflowNodes, 250);
    }
}

// When zooming in, draw the new nodes on top, and fade them in.
function zoomin(group, d) {
    // If the node has a children_file, load it before rendering
    if (d.data.children_file && !d.children) {
        d3.json(d.data.children_file).then(function (children) {
            // Save the node's bounds
            const x0 = d.x0, y0 = d.y0, x1 = d.x1, y1 = d.y1;
            const nodeWidth = x1 - x0;
            const nodeHeight = y1 - y0;

            // Attach loaded children to the node's data
            d.data.children = children;

            // Also update rootData to include these children
            updateRootDataWithLoadedChildren(d.data, children);

            // Rebuild the hierarchy from d.data (which now has children)
            // This creates a new hierarchy with the children properly attached
            const hierarchy = d3.hierarchy(d.data).sum(d => d.value);

            // Create a treemap layout with a tile function that works within the node's dimensions
            // Key: Use global width/height for preTile to get the same partitioning behavior,
            // then scale to the node's actual dimensions
            const tm = d3.treemap().tile(function (node, x0_tile, y0_tile, x1_tile, y1_tile) {
                // Use preTile with global dimensions (same as original tile function)
                // This ensures the same partitioning decisions (horizontal vs vertical splits)
                tile(node, x0_tile, y0_tile, x1_tile, y1_tile);
            }).size([nodeWidth, nodeHeight]);

            // Calculate the layout - this will set coordinates for all nodes
            const newD = tm(hierarchy);

            // Set the root node's bounds to match the original node's position
            newD.x0 = x0;
            newD.y0 = y0;
            newD.x1 = x1;
            newD.y1 = y1;

            // Translate all children coordinates from layout space (0,0) to actual position (x0, y0)
            if (newD.children) {
                newD.each(function (node) {
                    if (node !== newD) {
                        node.x0 = x0 + node.x0;
                        node.x1 = x0 + node.x1;
                        node.y0 = y0 + node.y0;
                        node.y1 = y0 + node.y1;
                    }
                });
            }

            // Update the parent reference so zoomout works correctly
            newD.parent = d.parent;

            // Now proceed with zoomin using the properly laid out node
            doZoomIn(group, newD);
        });
    } else {
        doZoomIn(group, d);
    }
}

function doZoomIn(group, d) {
    // Clear weight labels during transition
    d3.selectAll('.weight-label').remove();

    const group0 = group.attr("pointer-events", "none");
    const group1 = group = svg.append("g").call(render, d);

    x.domain([d.x0, d.x1]);
    y.domain([d.y0, d.y1]);

    // Update URL hash
    const path = getNodePath(d);
    if (path) {
        history.pushState(null, '', '#' + path);
    } else {
        history.pushState(null, '', window.location.pathname);
    }

    svg.transition()
        .duration(750)
        .call(t =>
            group0.transition(t)
                .remove()
                .call(position, d.parent)
                .style("opacity", 0))
        .call(t =>
            group1.call(fit_content, d)
                .transition(t)
                .attrTween("opacity", () => d3.interpolate(0, 1))
                .call(position, d))
        .on("end", () => {
            // Update weight label positions after transition
            if (__featureFlags.EDIT_MODE.enabled) {
                setTimeout(updateWeightLabelPositions, 100);
            }
            // Check for overflow after transition (longer delay to ensure layout is stable)
            if (__featureFlags.EDIT_MODE.enabled) {
                setTimeout(highlightOverflowNodes, 250);
            }
        });
}

// When zooming out, draw the old nodes on top, and fade them out.
function zoomout(group, d) {
    // Clear weight labels during transition
    d3.selectAll('.weight-label').remove();

    // Check if parent has incorrect full-screen coordinates when it shouldn't be root
    // (This happens after URL navigation when intermediate nodes get rebuilt as full-screen)
    const parentIsFullScreen = d.parent &&
        d.parent.x0 === 0 && d.parent.y0 === 0 &&
        d.parent.x1 === width && d.parent.y1 === height;
    const parentHasParent = d.parent && d.parent.parent;

    if (parentIsFullScreen && parentHasParent) {
        // Rebuild from grandparent to get correct parent coordinates
        const grandparent = treemap(d.parent.parent.data);
        grandparent.parent = d.parent.parent.parent;

        // Find the parent within the rebuilt grandparent
        const rebuiltParent = grandparent.children?.find(
            child => child.data.name === d.parent.data.name
        );

        if (rebuiltParent) {
            d.parent = rebuiltParent;
        }
    } else if (d.parent && (!d.parent.children || d.parent.children.length === 0)) {
        // If parent doesn't have children (direct navigation case), rebuild it
        const parentWithChildren = treemap(d.parent.data);
        parentWithChildren.parent = d.parent.parent;
        d.parent = parentWithChildren;
    }

    const group0 = group.attr("pointer-events", "none");
    const group1 = group = svg.insert("g", "*").call(render, d.parent);

    x.domain([d.parent.x0, d.parent.x1]);
    y.domain([d.parent.y0, d.parent.y1]);

    // Update URL hash
    const path = getNodePath(d.parent);
    if (path) {
        history.pushState(null, '', '#' + path);
    } else {
        history.pushState(null, '', window.location.pathname);
    }

    svg.transition()
        .duration(750)
        // .ease(d3.easeLinear)
        .call(t =>
            group0.transition(t).remove()
                // .attrTween("opacity", () => d3.interpolate(1, 0))
                .style("opacity", 0)
                .call(position, d))
        .call(t =>
            group1
                .call(fit_content, d.parent)
                .style("opacity", 0)
                .transition(t)
                .style("opacity", 1)
                .call(position, d.parent))
        .on("end", () => {
            // Update weight label positions after transition
            if (__featureFlags.EDIT_MODE.enabled) {
                setTimeout(updateWeightLabelPositions, 100);
            }
            // Check for overflow after transition (longer delay to ensure layout is stable)
            if (__featureFlags.EDIT_MODE.enabled) {
                setTimeout(highlightOverflowNodes, 250);
            }
        });
}
