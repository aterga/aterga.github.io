// // From https://stackoverflow.com/a/44293698/12163693
// d3.selection.prototype.children = function(d){
//     var that = this.node();
//     return this
//         .selectAll(d)
//         .filter(function(){ return that == this.parentNode; });
// };


// Derived from https://observablehq.com/@d3/zoomable-treemap

// F

const height = 924
const width = 954

const x = d3.scaleLinear().rangeRound([0, width]);
const y = d3.scaleLinear().rangeRound([0, height]);

var svg = d3.select('.chart').append('svg')
        .attr("viewBox", [0.5, -30.5, width, height + 30])
        .style("font", "100% sans-serif");

// console.log(svg)

d3.json("./map.json").then(function (data) {

    format = d3.format(",d")
    
    // console.log(data)

    svg.append("g").call(render, treemap(data));
})

function name(d) {
    return d.ancestors().reverse().map(d => d.data.name).join(" &#10230; ")
}

function text(d) {
    if (d.text) {
        return d.text.map((paragraph) => paragraph).join('<br>')
    }
    return "This section is under construction"
}

function tile(node, x0, y0, x1, y1) {
    d3.treemapBinary(node, 0, 0, width, height);
    for (const child of node.children) {
        child.x0 = x0 + child.x0 / width * (x1 - x0);
        child.x1 = x0 + child.x1 / width * (x1 - x0);
        child.y0 = y0 + child.y0 / height * (y1 - y0);
        child.y1 = y0 + child.y1 / height * (y1 - y0);
    }
}

function treemap(data) 
{
    return d3.treemap()
        .tile(tile)
            (d3.hierarchy(data)
        .sum(d => d.value ? d.value : 1)
        .sort((a, b) => b.value - a.value))
}

function position(group, root) {
    const res = group
        .selectAll("g")
            .attr("transform", d => d === root ? `translate(0,-30)` : `translate(${x(d.x0)},${y(d.y0)})`)
        .select("rect")
            .attr("width", d => d === root ? width : x(d.x1) - x(d.x0))
            .attr("height", d => {
                console.log("-----------")
                console.log(d)
                console.log(y(d.y1))
                console.log("-----------")
                return d === root ? 30 : y(d.y1) - y(d.y0)
            });
        
    // console.log(group.selectAll("g").select("rect"));
    return res;
}

function fit_content(group, root) {
    return group
        .selectAll("g")
            .select(".svg-content")
                .attr("width", d => d === root ? width : x(d.x1) - x(d.x0))
                .attr("height", d => d === root ? 30 : y(d.y1) - y(d.y0));
}


function render(group, root) {
    const node = group
      .selectAll("g")
      .data(root.children.concat(root))
      .join("g");

    node.filter(d => d === root ? d.parent : d.children)
        .attr("cursor", "pointer")
        .on("click", d => d === root ? zoomout(group, root) : zoomin(group, d));

    // node.append("title")
    //     .text(d => `${name(d)}\n${format(d.value)}`);

    node.append("rect")
        .attr("id", (d,i) => (d.leafUid = "leaf" + i).id)
        .attr("fill", d => d === root ? "#fff" : d.children ? "#ccc" : "#ddd")
        .attr("stroke", "#fff");


    // Custom below
    const fo = node
        .append("foreignObject")
        .attr("class", "svg-content");
    
    const div = fo
        .append('xhtml:div')
            // .style("background", "blue")
            .style("width", "100%")
            .style("height", "100%")
        .append('div')
    

    content_divs = div.filter(d => d !== root).attr("class", "content");
    header_div = div.filter(d => d === root).attr("class", "header");

    header_div.selectAll("span")
        .data(d => [name(d)])
        .join("span")
        .html(d => d)
    
    content_divs.selectAll("p")
        .data(d => [d.data.name].concat(text(d.data)))
        .join("p")
        // .attr("fill-opacity", (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)
        .html(d => d)

    // const foHeights = div._groups[0].map(x => x.getBoundingClientRect().height)
    // fo.data(foHeights).attr("height", d => d)
    // div.data(foHeights).attr("height", d => d)


    // node.append("text")
    //     .attr("font-weight", d => d === root ? "bold" : null)
    //     .selectAll("tspan")
    //     .data(d => [(d === root ? name(d) : d.data.name)].concat(d === root ? '' : text(d.data)))
    //     .join("tspan")
    //     .attr("x", 3)
    //     .attr("y", (d, i, nodes) => `${(i === nodes.length - 1) * 0.3 + 1.1 + i * 0.9}em`)
    //     .attr("fill-opacity", (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)
    //     //.attr("font-weight", (d, i, nodes) => i === nodes.length - 1 ? "normal" : null)
    //     .text(d => d);
        




    group.call(fit_content, root);
    group.call(position, root);
}

// When zooming in, draw the new nodes on top, and fade them in.
function zoomin(group, d) {
    const group0 = group.attr("pointer-events", "none");
    const group1 = group = svg.append("g").call(render, d);

    x.domain([d.x0, d.x1]);
    y.domain([d.y0, d.y1]);

    svg.transition()
        .duration(750)
        .call(t => 
                group0.transition(t).remove()
                .call(position, d.parent))
        .call(t => 
                group1.call(fit_content, d)
                .transition(t)
                .attrTween("opacity", () => d3.interpolate(0, 1))
                .call(position, d));
}

// When zooming out, draw the old nodes on top, and fade them out.
function zoomout(group, d) {
    const group0 = group.attr("pointer-events", "none");
    const group1 = group = svg.insert("g", "*").call(render, d.parent);
    
    x.domain([d.parent.x0, d.parent.x1]);
    y.domain([d.parent.y0, d.parent.y1]);

    svg.transition()
        .duration(750)
        .call(t => 
                group0.transition(t).remove()
                .attrTween("opacity", () => d3.interpolate(1, 0))
                .call(position, d))
        .call(t => 
                group1.call(fit_content, d.parent)
                .transition(t)
                .call(position, d.parent));
}
