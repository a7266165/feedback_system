import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef
} from "react";
import * as d3 from "d3";

const MAP_CONFIG = {
  width: 800,
  height: 860,
  initialCenter: [120, 24],
  initialScale: 10000,
  countyZoomScale: 20000,
  townZoomScale: 100000
};

const OUTLYING_ISLANDS = {
  "金門縣": { offsetX: MAP_CONFIG.width / 2 + 80, offsetY: MAP_CONFIG.height / 2 },
  "連江縣": { offsetX: MAP_CONFIG.width / 2 + 50, offsetY: MAP_CONFIG.height / 2 + 100 },
  "澎湖縣": { offsetX: MAP_CONFIG.width / 2, offsetY: MAP_CONFIG.height / 2 }
};

/**
 * D3Map Component
 *
 * @param {Function} onRegionSelect 點擊時回傳 d.properties.name
 * @param {ref} ref 讓父層可以呼叫 D3Map 的方法 (e.g. resetMap)
 */
function D3Map({ onRegionSelect }, ref) {
  // 1) 主要容器 ref
  const mapContainerRef = useRef(null);

  // 2) D3 繪圖相關物件，全部用 useRef 保持「可變」狀態，避免 React 警告
  const svgRef = useRef(null);
  const boxesGroupRef = useRef(null);
  const mapGroupRef = useRef(null);
  const highlightGroupRef = useRef(null);

  const projectionRef = useRef(null);
  const pathRef = useRef(null);
  const currentLevelRef = useRef("county");

  // ---- useEffect：元件掛載時初始化 D3 (只跑一次) ----
  useEffect(() => {
    const container = mapContainerRef.current; // 避免 cleanup 時 ref 改變
    if (!container) return;

    // 建立 SVG
    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", MAP_CONFIG.width)
      .attr("height", MAP_CONFIG.height);

    // 各群組
    const boxesGroup = svg.append("g").attr("class", "boxes-group");
    const mapGroup = svg.append("g").attr("class", "map-group");
    const highlightGroup = svg
      .append("g")
      .attr("class", "highlight-group")
      .style("pointer-events", "none");

    // 建立投影 & path
    const projection = createProjection();
    const path = d3.geoPath().projection(projection);

    // 將它們存進 useRef
    svgRef.current = svg;
    boxesGroupRef.current = boxesGroup;
    mapGroupRef.current = mapGroup;
    highlightGroupRef.current = highlightGroup;
    projectionRef.current = projection;
    pathRef.current = path;

    // 一開始先抓 county data
    fetch("http://localhost:3000/api/taiwan-county")
      .then((response) => {
        if (!response.ok) throw new Error("網絡錯誤");
        return response.json();
      })
      .then((taiwanGeoJson) => {
        renderMap(taiwanGeoJson);
      })
      .catch((error) => {
        console.error("載入縣市地圖數據時發生錯誤:", error);
      });

    // 卸載時清除 svg
    return () => {
      d3.select(container).select("svg").remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 透過 useImperativeHandle 暴露函式給父層 ----
  useImperativeHandle(ref, () => ({
    resetMap() {
      resetMap();
    }
  }));

  // ---------------- 工具函式 ----------------
  function createProjection() {
    return d3
      .geoMercator()
      .center(MAP_CONFIG.initialCenter)
      .scale(MAP_CONFIG.initialScale)
      .translate([MAP_CONFIG.width / 2, MAP_CONFIG.height / 2]);
  }

  // 計算離島位置
  function getIslandTranslation(d) {
    const island = OUTLYING_ISLANDS[d.properties.name];
    return island
      ? [island.offsetX, island.offsetY]
      : [MAP_CONFIG.width / 2, MAP_CONFIG.height / 2];
  }

  // 繪製離島外框
  function drawIslandBox(d, newX, newY) {
    const boxesGroup = boxesGroupRef.current;
    if (!OUTLYING_ISLANDS[d.properties.name]) return;

    const path = pathRef.current;
    const bounds = path.bounds(d);
    const boxWidth = bounds[1][0] - bounds[0][0];
    const boxHeight = bounds[1][1] - bounds[0][1];

    // 先清除同名離島外框
    boxesGroup.selectAll(`.island-box-${d.properties.name}`).remove();

    boxesGroup
      .append("rect")
      .attr("class", `island-box island-box-${d.properties.name}`)
      .attr("x", bounds[0][0])
      .attr("y", bounds[0][1])
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr(
        "transform",
        `translate(${newX - MAP_CONFIG.width / 2}, ${newY - MAP_CONFIG.height / 2})`
      );
  }

  // 放大到某區域
  function zoomToRegion(d, scale) {
    const boxesGroup = boxesGroupRef.current;
    const svg = svgRef.current;
    const projection = projectionRef.current;
    const path = pathRef.current;

    // 移除所有離島外框
    boxesGroup.selectAll(".island-box").remove();

    const center = d3.geoCentroid(d);
    const startScale = projection.scale();
    const startCenter = projection.center();
    const duration = 800;
    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = d3.easeQuadInOut(progress);

      const interpolatedCenter = [
        startCenter[0] + (center[0] - startCenter[0]) * easeProgress,
        startCenter[1] + (center[1] - startCenter[1]) * easeProgress
      ];
      const interpolatedScale =
        startScale + (scale - startScale) * easeProgress;

      projection
        .center(interpolatedCenter)
        .scale(interpolatedScale)
        .translate([MAP_CONFIG.width / 2, MAP_CONFIG.height / 2]);

      // 只重繪路徑
      svg.selectAll("path").attr("d", path);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }
    requestAnimationFrame(animate);
  }

  // 重置地圖
  function resetMap() {
    const svg = svgRef.current;
    const highlightGroup = highlightGroupRef.current;
    const mapGroup = mapGroupRef.current;

    // 移除高亮
    highlightGroup.selectAll("path").remove();
    mapGroup.selectAll("path").remove();

    // 重置投影
    projectionRef.current = createProjection();
    pathRef.current = d3.geoPath().projection(projectionRef.current);

    // 重繪目前的所有 path
    svg.selectAll("path")
      .transition()
      .duration(800)
      .attr("d", pathRef.current)
      .attr("transform", (d) => {
        const [newX, newY] = getIslandTranslation(d);
        return `translate(${newX - MAP_CONFIG.width / 2}, ${
          newY - MAP_CONFIG.height / 2
        })`;
      });

    // 如果要把地圖真的回到「縣市」層級，建議再做一次 fetch 縣市資料並 renderMap
    // 當前如果 original data 已經在畫面，那就可以依照需求來看要不要重新抓
    currentLevelRef.current = "county";
    fetch("http://localhost:3000/api/taiwan-county")
      .then((res) => res.json())
      .then((data) => {
        renderMap(data);
      })
      .catch((err) => console.error(err));
  }

  // 套用高亮
  function applyHighlight(d) {
    const highlightGroup = highlightGroupRef.current;
    const path = pathRef.current;
    highlightGroup.selectAll("path").remove();
  
    // 從 d.properties.__offsetX / __offsetY 取出
    const offsetX = d.properties.__offsetX || (MAP_CONFIG.width / 2);
    const offsetY = d.properties.__offsetY || (MAP_CONFIG.height / 2);
  
    highlightGroup
      .append("path")
      .data([d])
      .attr("d", path)
      .attr("transform", `translate(${offsetX - MAP_CONFIG.width / 2}, ${offsetY - MAP_CONFIG.height / 2})`)
      .classed("highlighted", true);
  }
  

  // ------------------ renderMap ------------------
  function renderMap(geoJsonData) {
    const mapGroup = mapGroupRef.current;
    const path = pathRef.current;
    const level = currentLevelRef.current;
    let levelClass = level;
  
      
    mapGroup
      .selectAll(`.${levelClass}`)
      .data(geoJsonData.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", levelClass)
      .attr("transform", (feat) => {
        // 計算離島偏移
        const islandConfig = OUTLYING_ISLANDS[feat.properties.COUNTYNAME];
        const [offsetX, offsetY] = islandConfig
          ? [islandConfig.offsetX, islandConfig.offsetY]
          : [MAP_CONFIG.width / 2, MAP_CONFIG.height / 2];
        
        // *** 將偏移量直接放進 feature.properties 或其他自定義欄位 ***
        feat.properties.__offsetX = offsetX;
        feat.properties.__offsetY = offsetY;
  
        drawIslandBox(feat, offsetX, offsetY);
        return `translate(${offsetX - MAP_CONFIG.width / 2}, ${offsetY - MAP_CONFIG.height / 2})`;
      })
      .on("click", handleClick);
  }
  

  // ------------------ handleClick ------------------
  function handleClick(event, d) {
    event.stopPropagation();

    let nextLevel = "";
    let fetchUrl = "";
    let zoomScale = 0;

    if (d.properties.VILLAGENAM) {
      // 到村里，不再往下
      console.log("已達最小級別地圖");
    } else if (d.properties.TOWNNAME) {
      nextLevel = "village";
      fetchUrl = `http://localhost:3000/api/taiwan-village/${d.properties.TOWNNAME}`;
      zoomScale = MAP_CONFIG.townZoomScale;
    } else if (d.properties.COUNTYNAME) {
      nextLevel = "town";
      fetchUrl = `http://localhost:3000/api/taiwan-town/${d.properties.COUNTYNAME}`;
      zoomScale = MAP_CONFIG.countyZoomScale;
    }

    // 如果點擊的不是最小級別，就抓下一層
    if (nextLevel) {
      currentLevelRef.current = nextLevel;
      fetch(fetchUrl)
        .then((res) => res.json())
        .then((data) => {
          renderMap(data);
          zoomToRegion(d, zoomScale);
        })
        .catch((err) => console.error(err));
    }

    // 高亮
    applyHighlight(d);

    // 回傳給父層
    if (onRegionSelect) {
      onRegionSelect(d.properties.name);
    }
  }

  // ---- 回傳 JSX ----
  return (
    <div
      ref={mapContainerRef}
      style={{ width: MAP_CONFIG.width, height: MAP_CONFIG.height }}
    />
  );
}

// 用 forwardRef 才能讓父元件拿到子元件的 ref
export default forwardRef(D3Map);
