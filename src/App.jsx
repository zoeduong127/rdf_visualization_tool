import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import Joyride from "react-joyride";

// --- Constants and Data ---
const predicateConstraints = {
  worksAt: { min: 1, max: 1, label: "Works At (required, one company)" },
  hasSkill: { min: 1, max: Infinity, label: "Has Skill (at least one)" },
  knows: { min: 0, max: Infinity, label: "Knows (optional, many)" },
  livesIn: { min: 1, max: 1, label: "Lives In (required, one location)" },
  locatedIn: { min: 1, max: 1, label: "Located In (required, one location)" },
  involves: { min: 0, max: Infinity, label: "Involves (many allowed)" }
};

const sampleTriples = [
  ["Alice", "knows", "Bob"],
  ["Bob", "knows", "Charlie"],
  ["Charlie", "type", "Person"],
  ["Alice", "type", "Person"],
  ["Bob", "type", "Person"],
  ["Alice", "worksAt", "CompanyX"],
  ["Bob", "worksAt", "CompanyY"],
  ["Charlie", "livesIn", "CityZ"],
  ["CompanyX", "type", "Organization"],
  ["CompanyY", "type", "Organization"],
  ["CityZ", "type", "Location"],
  ["Alice", "hasSkill", "SPARQL"],
  ["Charlie", "hasSkill", "JavaScript"],
  ["Bob", "hasSkill", "Python"],
  ["SPARQL", "type", "Skill"],
  ["JavaScript", "type", "Skill"],
  ["Python", "type", "Skill"],
  ["CompanyX", "locatedIn", "CityZ"],
  ["CompanyY", "locatedIn", "CityZ"],
  ["ProjectX", "involves", "Alice"]
];

const labelsMap = {
  knows: "Knows",
  type: "Is a",
  worksAt: "Works At",
  livesIn: "Lives In",
  hasSkill: "Has Skill",
  locatedIn: "Located In",
  involves: "Involves"
};

const typeIcons = {
  Person: "👤",
  Skill: "🛠️",
  Organization: "🏢",
  Location: "📍",
  Unknown: "❓"
};

const businessIcons = {
  worksAt: "💼",
  hasSkill: "🧠",
  knows: "🤝",
  livesIn: "🏠",
  locatedIn: "🌍",
  involves: "📁"
};

const predicateExplanations = {
  worksAt: "This person is employed at the organization.",
  hasSkill: "This person possesses this skill.",
  knows: "This person knows the other person.",
  livesIn: "This person lives in the location.",
  locatedIn: "This organization is located in the location.",
  involves: "This project involves the person."
};

const predicateColors = {
  worksAt: "#1976d2",
  hasSkill: "#388e3c",
  knows: "#fbc02d",
  livesIn: "#8d6e63",
  locatedIn: "#6d4c41",
  involves: "#7b1fa2"
};

const tourSteps = [
  {
    title: "Welcome to the RDF Graph",
    content: "This interactive graph shows entities like people, skills, companies, and their relationships."
  },
  {
    title: "What Are Nodes and Edges?",
    content: "Each circle is a node (e.g., a Person or Skill). Lines between them are edges representing RDF relationships like 'worksAt' or 'hasSkill'."
  },
  {
    title: "Zoom and Pan",
    content: "Use your mouse scroll to zoom and drag to pan around the graph canvas."
  },
  {
    title: "Filter and Search",
    content: "Use filters on the left to limit what you see by class or domain. Search lets you highlight matching nodes."
  },
  {
    title: "Guided Tasks",
    content: "Try clicking a Guided Task to answer real-world questions like 'Who knows Alice?' or 'Who has Python skills?'."
  },
  {
    title: "That’s It!",
    content: "You’re ready to explore the RDF data. Click on a node to collapse groups or view tooltips for info."
  }
];

const joyrideSteps = [
  {
    target: '[data-joyride-id="walkthrough"]',
    title: "Start the Tour",
    content: "Click here to start a guided tour of the RDF Graph features.",
    disableBeacon: true
  },
  {
    target: '[data-joyride-id="domain-module"]',
    title: "Domain Module Filter",
    content: "Filter the graph by domain (Employment, Skills, etc)."
  },
  {
    target: '[data-joyride-id="class-filter"]',
    title: "Class Filter",
    content: "Filter nodes by their class (Person, Organization, etc)."
  },
  {
    target: '[data-joyride-id="search-input"]',
    title: "Search",
    content: "Type here to search and highlight nodes by name."
  },
  {
    target: '[data-joyride-id="guided-tasks"]',
    title: "Guided Tasks",
    content: "Click a guided task to answer common questions about the graph."
  },
  {
    target: '[data-joyride-id="graph-canvas"]',
    title: "Graph Canvas",
    content: "This is the interactive RDF graph. Zoom, pan, and click nodes to explore."
  }
];

const color = d3.scaleOrdinal()
  .domain(["Person", "Organization", "Location", "Skill", "Unknown"])
  .range(["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"]);

const domainModules = {
  All: [],
  Employment: ["worksAt", "locatedIn", "Organization"],
  Skills: ["hasSkill", "Skill"],
  Projects: ["involves", "Project"],
  Social: ["knows"],
  Residence: ["livesIn", "Location"]
};

const classExplanations = {
  Person: "A Person represents an individual in the organization or network.",
  Organization: "An Organization is a company or institution where people work.",
  Skill: "A Skill is a capability or expertise possessed by a person.",
  Location: "A Location is a place where entities reside or operate.",
  Unknown: "This node's type is not specified."
};

const guidedTasks = [
  {
    label: "Show Alice's coworkers",
    filter: ([s, p, o]) => (s === "Alice" && p === "knows") || (o === "Alice" && p === "knows")
  },
  {
    label: "Who has Python skills?",
    filter: ([s, p, o]) => p === "hasSkill" && o === "Python"
  },
  {
    label: "Where does Bob work?",
    filter: ([s, p]) => s === "Bob" && p === "worksAt"
  },
  {
    label: "What skills are in ProjectX?",
    filter: ([s, p, o]) =>
      (s === "ProjectX" && p === "involves") ||
      (p === "hasSkill" && s !== "ProjectX")
  },
  {
    label: "Reset View",
    filter: null
  }
];

// --- Main Component ---
const App = () => {
  const svgRef = useRef();
  const tooltipRef = useRef();

  const [tourStep, setTourStep] = useState(null);
  const [joyrideRun, setJoyrideRun] = useState(false);

  const [classFilter, setClassFilter] = useState("All");
  const [objectFilter, setObjectFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("All");
  const [guidedFilter, setGuidedFilter] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [semanticLevel, setSemanticLevel] = useState(1);
  const [nodeLimit, setNodeLimit] = useState(10);

  // --- Class Map ---
  const classMap = {};
  sampleTriples.forEach(([s, p, o]) => {
    if (p === "type") classMap[s] = o;
  });

  // --- Filter Options ---
  const classOptions = ["All", ...new Set(sampleTriples.filter(([_, p]) => p === "type").map(([s, , o]) => o))];
  const objectOptions = classFilter !== "All"
    ? ["All", ...sampleTriples.filter(([_, p, o]) => p === "type" && o === classFilter).map(([s]) => s)]
    : [];

  // --- Constraint Violations ---
  function getNodeConstraintViolations(nodes, links) {
    const violations = {};
    nodes.forEach(n => {
      const outgoing = links.filter(l => l.source.id === n.id || l.source === n.id);
      Object.keys(predicateConstraints).forEach(pred => {
        const count = outgoing.filter(l => l.label === (labelsMap[pred] || pred)).length;
        const { min, max } = predicateConstraints[pred] || {};
        if (min !== undefined && count < min) {
          violations[n.id] = violations[n.id] || [];
          violations[n.id].push(`Missing required "${labelsMap[pred] || pred}" (${count}/${min})`);
        }
        if (max !== undefined && count > max) {
          violations[n.id] = violations[n.id] || [];
          violations[n.id].push(`Too many "${labelsMap[pred] || pred}" (${count}/${max})`);
        }
      });
    });
    return violations;
  }

  // --- D3 Graph Rendering ---
  useEffect(() => {
    const width = 1000;
    const height = 800;
    let filteredTriples = [...sampleTriples];

    if (selectedModule !== "All") {
      const allowedPredicates = domainModules[selectedModule];
      filteredTriples = filteredTriples.filter(([s, p, o]) =>
        allowedPredicates.includes(p) ||
        allowedPredicates.includes(classMap[o]) ||
        allowedPredicates.includes(classMap[s])
      );
    }

    if (classFilter !== "All") {
      if (objectFilter !== "All") {
        filteredTriples = filteredTriples.filter(([s]) => s === objectFilter);
      } else {
        filteredTriples = filteredTriples.filter(([s]) => classMap[s] === classFilter);
      }
    }

    if (guidedFilter) {
      filteredTriples = filteredTriples.filter(guidedFilter);
    }

    let nodes = [];
    let links = [];

    // --- Semantic Zooming ---
    if (semanticLevel === 1) {
      const classSet = new Set();
      filteredTriples.forEach(([s, p, o]) => {
        if (p === "type") classSet.add(o);
      });
      nodes = Array.from(classSet).map(type => ({
        id: type,
        type,
        isGroup: true
      }));

      const classLinksMap = {};
      filteredTriples.forEach(([s, p, o]) => {
        if (p === "type") return;
        const sClass = classMap[s];
        const oClass = classMap[o];
        if (sClass && oClass) {
          const key = `${sClass}->${oClass}->${p}`;
          if (!classLinksMap[key]) {
            classLinksMap[key] = {
              source: sClass,
              target: oClass,
              predicate: p
            };
          }
        }
      });
      links = Object.values(classLinksMap).map(l => ({
        ...l,
        label: labelsMap[l.predicate] || l.predicate,
        level: 1
      }));
    } else {
      let nodesSet = new Set();
      filteredTriples.forEach(([s, , o]) => {
        nodesSet.add(s);
        nodesSet.add(o);
      });
      let limitedNodes = Array.from(nodesSet).slice(0, nodeLimit);
      nodes = limitedNodes.map(id => ({
        id,
        type: classMap[id] || (sampleTriples.find(([s, p, o]) => o === id && p === "type")?.[2] || "Unknown"),
        isGroup: false
      }));
      const visibleNodeIds = new Set(nodes.map(n => n.id));
      links = filteredTriples
        .filter(([s, , o]) => visibleNodeIds.has(s) && visibleNodeIds.has(o))
        .map(([source, predicate, target]) => ({
          source,
          target,
          label: labelsMap[predicate] || predicate,
          predicate,
          level: predicate === "type" ? 3 : 2
        }));
    }

    let searchFadedNodes = new Set();
    let searchFadedLinks = new Set();
    if (searchQuery.trim()) {
      const matched = nodes.filter(n => n.id.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchedIds = new Set(matched.map(n => n.id));
      const neighborIds = new Set(matched.map(n => n.id));
      links.forEach(l => {
        if (matchedIds.has(l.source)) neighborIds.add(l.target);
        if (matchedIds.has(l.target)) neighborIds.add(l.source);
      });
      searchFadedNodes = new Set(nodes.map(n => n.id).filter(id => !neighborIds.has(id)));
      searchFadedLinks = new Set(links.map(l => `${l.source}->${l.target}`).filter(key => {
        const l = key.split("->");
        return !(neighborIds.has(l[0]) && neighborIds.has(l[1]));
      }));
    }

    // --- D3 Drawing ---
    d3.select(svgRef.current).selectAll("*").remove();
    const svg = d3.select(svgRef.current);
    const g = svg.append("g");

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(semanticLevel === 1 ? 300 : 150))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = g.append("g")
      .attr("class", "link-group")
      .attr("stroke", "#aaa")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => predicateColors[d.predicate] || (highlightLinks.has(`${d.source}->${d.target}`) ? "#f00" : "#aaa"))
      .attr("stroke-width", 3)
      .attr("opacity", d =>
        (searchQuery && searchFadedLinks.has(`${d.source}->${d.target}`))
          ? 0.1 : 1
      );

    const edgeLabels = g.append("g")
      .attr("class", "edge-label-group")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("class", d => `edge-label edge-label-level-${d.level}`)
      .text(d => `${businessIcons[d.predicate] || ""} ${labelsMap[d.predicate] || d.predicate}`)
      .style("font-size", "14px")
      .style("fill", d => predicateColors[d.predicate] || "#888")
      .style("pointer-events", "all")
      .attr("opacity", d =>
        (searchQuery && searchFadedLinks.has(`${d.source}->${d.target}`))
          ? 0.1 : 1
      )
      .on("mouseover", function (event, d) {
        d3.select(tooltipRef.current)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY + 10}px`)
          .style("display", "block")
          .html(
            `<strong style="font-size:1.2em">${businessIcons[d.predicate] || ""} ${labelsMap[d.predicate] || d.predicate}</strong><br/>
            <span style="color:${predicateColors[d.predicate] || "#333"}">${predicateExplanations[d.predicate] || ""}</span>
            ${predicateConstraints[d.predicate] ? `<br/><b>Constraint:</b> ${predicateConstraints[d.predicate].label}` : ""}`
          );
      })
      .on("mouseout", () => {
        d3.select(tooltipRef.current).style("display", "none");
      });

    const node = g.append("g")
      .attr("class", "node-group")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 30)
      .attr("fill", d => color(d.type))
      .style("stroke", "#fff")
      .style("stroke-width", 2)
      .attr("opacity", d =>
        (searchQuery && searchFadedNodes.has(d.id))
          ? 0.1 : 1
      )
      .on("mouseover", (event, d) => {
        d3.select(tooltipRef.current)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY + 10}px`)
          .style("display", "block")
          .html(
            `<strong>${typeIcons[d.type] || ""} ${d.id}</strong><br/>Type: ${d.type}<br/><em>${classExplanations[d.type] || ""}</em>`
          );
      })
      .on("mouseout", () => {
        d3.select(tooltipRef.current).style("display", "none");
      });

    const label = g.append("g")
      .attr("class", "node-label-group")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("class", "node-label")
      .text(d => `${typeIcons[d.type] || ""} ${d.id}`)
      .attr("dy", 4)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .attr("opacity", d =>
        (searchQuery && searchFadedNodes.has(d.id))
          ? 0.1 : 1
      );

    simulation.on("tick", () => {
      link.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node.attr("cx", d => d.x).attr("cy", d => d.y);
      label.attr("x", d => d.x).attr("y", d => d.y);

      edgeLabels
        .attr("x", d => (d.source.x + d.target.x) / 2 + 6)
        .attr("y", d => (d.source.y + d.target.y) / 2 - 6)
        .attr("transform", d => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          return `rotate(${angle}, ${(d.source.x + d.target.x) / 2}, ${(d.source.y + d.target.y) / 2})`;
        });
    });

  }, [
    classFilter,
    objectFilter,
    searchQuery,
    selectedModule,
    guidedFilter,
    highlightNodes,
    highlightLinks,
    semanticLevel,
    nodeLimit
  ]);

  // --- Semantic Zoom Controls ---
  const handleZoomIn = () => setSemanticLevel(2);
  const handleZoomOut = () => setSemanticLevel(1);

  // --- Render ---
  return (
    <div style={{
      display: "flex",
      position: "relative",
      minHeight: "100vh",
      minWidth: "100vw",
      background: "#f7f9fb"
    }}>
      <Joyride
        steps={joyrideSteps}
        run={joyrideRun}
        continuous
        showSkipButton
        showProgress
        styles={{
          options: { zIndex: 10000 }
        }}
        callback={data => {
          if (data.status === "finished" || data.status === "skipped") {
            setJoyrideRun(false);
          }
        }}
      />
      
      <aside style={{
        width: "20%", // Increased from 260px
        minHeight: "100vh",
        background: "#fff",
        boxShadow: "2px 0 8px rgba(0,0,0,0.06)",
        padding: "24px 18px 18px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "18px"
      }}>
        <h2 style={{
          fontSize: "1.3rem",
          fontWeight: 700,
          marginBottom: "10px",
          letterSpacing: "0.5px"
        }}>RDF Graph Controls</h2>
        <hr style={{ margin: "0 0 10px 0", border: "none", borderTop: "1px solid #eee" }} />

        <section>
          <h4 style={{ marginBottom: 6 }}>Semantic Zoom</h4>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleZoomOut}
              style={{
                fontSize: 20,
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: semanticLevel === 1 ? "#1976d2" : "#eee",
                color: semanticLevel === 1 ? "#fff" : "#333",
                border: "none",
                cursor: "pointer"
              }}
              title="Show class nodes"
            >+</button>
            <button
              onClick={handleZoomIn}
              style={{
                fontSize: 20,
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: semanticLevel === 2 ? "#1976d2" : "#eee",
                color: semanticLevel === 2 ? "#fff" : "#333",
                border: "none",
                cursor: "pointer"
              }}
              title="Show all nodes"
            >−</button>
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {semanticLevel === 1 ? "Level 1: Class nodes only" : "Level 2: All nodes"}
          </div>
        </section>

        <section>
          <h4 style={{ marginBottom: 6 }}>Domain Module</h4>
          <select
            data-joyride-id="domain-module"
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            style={{
              width: "100%",
              padding: "6px",
              borderRadius: "4px",
              border: "1px solid #bbb",
              marginBottom: "10px"
            }}
          >
            {Object.keys(domainModules).map(mod => (
              <option key={mod} value={mod}>{mod}</option>
            ))}
          </select>
        </section>

        <section>
          <h4 style={{ marginBottom: 6 }}>Node Display Limit</h4>
          <input
            type="number"
            value={nodeLimit}
            onChange={e => setNodeLimit(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "6px",
              borderRadius: "4px",
              border: "1px solid #bbb"
            }}
          />
        </section>

        <section>
          <h4 style={{ marginBottom: 6 }}>Filter by Class</h4>
          <select
            data-joyride-id="class-filter"
            onChange={e => {
              setClassFilter(e.target.value);
              setObjectFilter("All");
            }}
            value={classFilter}
            style={{
              width: "100%",
              padding: "6px",
              borderRadius: "4px",
              border: "1px solid #bbb"
            }}
          >
            {classOptions.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
          {classFilter !== "All" && (
            <select
              style={{
                width: "100%",
                marginTop: "8px",
                padding: "6px",
                borderRadius: "4px",
                border: "1px solid #bbb"
              }}
              value={objectFilter}
              onChange={e => setObjectFilter(e.target.value)}
            >
              {objectOptions.map(obj => (
                <option key={obj} value={obj}>{obj}</option>
              ))}
            </select>
          )}
        </section>

        <section>
          <h4 style={{ marginBottom: 6 }}>Search Node</h4>
          <input
            data-joyride-id="search-input"
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "6px",
              borderRadius: "4px",
              border: "1px solid #bbb"
            }}
          />
        </section>

        <section>
          <h4 style={{ marginBottom: 6 }}>Guided Tasks</h4>
          <div data-joyride-id="guided-tasks" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {guidedTasks.map(task => (
              <button
                key={task.label}
                onClick={() => {
                  if (!task.filter) {
                    setGuidedFilter(null);
                    setHighlightNodes(new Set());
                    setHighlightLinks(new Set());
                  } else {
                    const matchedTriples = sampleTriples.filter(task.filter);
                    const nodes = new Set();
                    const links = new Set();
                    matchedTriples.forEach(([s, , o]) => {
                      nodes.add(s);
                      nodes.add(o);
                      links.add(`${s}->${o}`);
                    });
                    setGuidedFilter(() => task.filter);
                    setHighlightNodes(nodes);
                    setHighlightLinks(links);
                  }
                }}
                style={{
                  width: "100%",
                  fontSize: "12px",
                  padding: "7px",
                  borderRadius: "4px",
                  border: "1px solid #bbb",
                  background: "#fafafa",
                  cursor: "pointer",
                  fontWeight: 500,
                  transition: "background 0.2s"
                }}
              >
                {task.label}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main style={{
        marginLeft: "5%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "32px 0 0 0",
        position: "relative"
      }}>
        <div style={{
          position: "relative",
          width: 1000,
          height: 800,
          background: "#f0f4f8",
          borderRadius: "10px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
          border: "1px solid #e0e0e0"
        }}>
          <svg
            ref={svgRef}
            width={1000}
            height={800}
            viewBox="0 0 1000 800"
            style={{ border: "none", borderRadius: "10px" }}
            data-joyride-id="graph-canvas"
          />
          <div ref={tooltipRef}
            style={{
              position: "absolute",
              backgroundColor: "white",
              padding: "6px",
              border: "1px solid gray",
              borderRadius: "4px",
              fontSize: "12px",
              pointerEvents: "none",
              display: "none",
              zIndex: 2
            }}
          />
        </div>
        {tourStep !== null && (
          <div style={{
            position: "absolute",
            top: "20%",
            left: "20%",
            width: "60%",
            backgroundColor: "#fff",
            border: "2px solid #333",
            borderRadius: "8px",
            padding: "20px",
            zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
          }}>
            <h2>{tourSteps[tourStep].title}</h2>
            <p style={{ fontSize: "16px" }}>{tourSteps[tourStep].content}</p>
            <div style={{ marginTop: "20px", textAlign: "right" }}>
              {tourStep > 0 && (
                <button onClick={() => setTourStep(tourStep - 1)} style={{ marginRight: "10px" }}>
                  ← Back
                </button>
              )}
              {tourStep < tourSteps.length - 1 ? (
                <button onClick={() => setTourStep(tourStep + 1)}>
                  Next →
                </button>
              ) : (
                <button onClick={() => setTourStep(null)}>
                  ✅ Finish
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;