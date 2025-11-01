// From https://stackoverflow.com/a/7616484/12163693
Object.defineProperty(String.prototype, 'hashCode', {
    value: function() {
        var hash = 0, i, chr;
        for (i = 0; i < this.length; i++) {
            chr   = this.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
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
        .attr("viewBox", [     -ble,         -header_height-ble, 
                          width+2*ble, height + header_height+2*ble])
        // .attr("preserveAspectRatio", "slice")
        .attr("xmlns", "http://www.w3.org/2000/svg");
        // .style("font", "100% sans-serif");

d3.json("./map/_root.json").then(function (data) {
    format = d3.format(",d")
    svg.append("g").call(render, treemap(data));
})

function treemap(data)
{
    tm = d3.treemap().tile(tile)
    res = tm(d3.hierarchy(data).sum(d => d.value))
    return res
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

const preTile = function(parent, x0, y0, x1, y1) {
    var nodes = parent.children,
        i, n = nodes.length,
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
            .attr("height", d => {
                return d === root ? header_height : y(d.y1) - y(d.y0)
            });
        
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
      .filter(() => this.parentNode === root.node())
      .data([root].concat(root.children))
      .join("g")

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
        .attr("id", (d,i) => (d.leafUid = "leaf" + i).id)
        .attr("fill", "transparent")
        .attr("stroke-width", 0)
        // .attr("stroke", "#000")

    const fo = node
        .append("foreignObject")
        .attr("fill", "transparent")
        .attr("class", "svg-content");
    
    const div = fo
        .append('xhtml:div')
        .attr("class", d => {
            if (d === root) return "content-frame header-frame"
            if (d.children || d.data.children_file) return "content-frame expanding-frame"
            return "content-frame"
        })
        .append('div')
    
    var content_classes = {}
    content_divs = div.filter(d => d !== root)
    content_divs.each((d, i) => {
        console.log(d)
        var cs = ["content"]
        if (d.is_north) cs.push("north")
        if (d.is_east) cs.push("east")
        if (d.is_south) cs.push("south")
        if (d.is_west) cs.push("west")
        if (d.data.img) cs.push("img-holder")
        if (d.children || d.data.children_file) cs.push("clickable")
        content_classes[hash(d,i)] = cs
        // console.log(cs)
        // console.log(JSON.parse(JSON.stringify(content_classes)))
    })
    content_divs.attr("class", (d,i) => content_classes[hash(d,i)].join(" "))

    header_div = div.filter(d => d === root)
        .attr("class", d => d.parent ? "clickable header" : "header");

    header_div.selectAll("a")
        .data(d => [name(d)])
        .join("a")
        .html(d => d)
    
    // Add images (which need to be resized afterwards via resize_img)    
    image_divs = content_divs.filter(d => d.data.img)
    image_divs.append("div")
        .attr("style", d => `background-image: url(${d.data.img})`)
        .attr("class", d => d.data.paper ? "img paper" : "img photo")
        .html(d => d.data.paper ? `<a class='paper' href='${d.data.paper}'> </a>` : ``)
    
    // Add paragraphs with name and text
    text_divs = content_divs.filter(d => d.data.name)
    text_divs.selectAll("h3")
        .data(d => [d.data.name])
        .join("h3")
        .html(d => d)
    text_divs.selectAll("p")
        .data(d => pick_content(d.data))
        .join("p")
        .html(d => d)

    // Add paragraphs without name and with text
    text_only_divs = content_divs.filter(d => d.data.text)
    text_only_divs.selectAll("p")
        .data(d => pick_content(d.data))
        .join("p")
        .html(d => d)

    group.call(fit_content, root);
    group.call(position, root);
}

// When zooming in, draw the new nodes on top, and fade them in.
function zoomin(group, d) {
    // If the node has a children_file, load it before rendering
    if (d.data.children_file && !d.children) {
        d3.json(d.data.children_file).then(function(children) {
            // Save the node's bounds
            const x0 = d.x0, y0 = d.y0, x1 = d.x1, y1 = d.y1;
            const nodeWidth = x1 - x0;
            const nodeHeight = y1 - y0;
            
            // Attach loaded children to the node's data
            d.data.children = children;
            
            // Rebuild the hierarchy from d.data (which now has children)
            // This creates a new hierarchy with the children properly attached
            const hierarchy = d3.hierarchy(d.data).sum(d => d.value);
            
            // Create a treemap layout with a tile function that works within the node's dimensions
            // Key: Use global width/height for preTile to get the same partitioning behavior,
            // then scale to the node's actual dimensions
            const tm = d3.treemap().tile(function(node, x0_tile, y0_tile, x1_tile, y1_tile) {
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
                newD.each(function(node) {
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
    const group0 = group.attr("pointer-events", "none");
    const group1 = group = svg.append("g").call(render, d);

    x.domain([d.x0, d.x1]);
    y.domain([d.y0, d.y1]);

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
}

// When zooming out, draw the old nodes on top, and fade them out.
function zoomout(group, d) {
    const group0 = group.attr("pointer-events", "none");
    const group1 = group = svg.insert("g", "*").call(render, d.parent);
    
    x.domain([d.parent.x0, d.parent.x1]);
    y.domain([d.parent.y0, d.parent.y1]);

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
                .call(position, d.parent));
}
