(function () {
  var KEY = "ndewfs-nanhu-v3";
  var SVG = "http://www.w3.org/2000/svg";
  var data = window.NdewfsData;
  var engine = window.Ndewfs;

  var state = {
    stations: data.createStations(),
    readings: data.applyScenario("demo"),
    rules: data.createRules(),
    selectedId: "cq",
    continuous: true,
    placing: false,
    result: null,
    deleteArmed: false,
    liveText: "",
    reticleId: "",
    computedAt: ""
  };

  var mapSig = "";
  var switchSig = "";
  var timer = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function svgEl(name, attrs) {
    var node = document.createElementNS(SVG, name);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function stationById(id) {
    for (var i = 0; i < state.stations.length; i += 1) {
      if (state.stations[i].id === id) return state.stations[i];
    }
    return null;
  }

  function selected() {
    return stationById(state.selectedId) || state.stations[0];
  }

  function formatWhen(date) {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date);
  }

  function titleOf(warning) {
    if (warning.type === "台风") return warning.subtype + engine.LEVEL_NAME[warning.level] + "预警";
    return warning.type + engine.LEVEL_NAME[warning.level] + "预警";
  }

  function setPath(obj, path, value) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i += 1) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = value;
  }

  function mergeRules(saved) {
    var base = data.createRules();
    if (!saved) return base;
    Object.keys(base).forEach(function (key) {
      if (saved[key] == null) return;
      if (typeof base[key] === "object") {
        Object.keys(base[key]).forEach(function (child) {
          var incoming = saved[key][child];
          if (typeof incoming === "number" && Number.isFinite(incoming)) base[key][child] = incoming;
        });
      } else if (typeof saved[key] === "number" && Number.isFinite(saved[key])) {
        base[key] = saved[key];
      }
    });
    return base;
  }

  function kmFromSvg(x, y) {
    return {
      x: (x - 150) * (50 / 490),
      y: (y - 92) * (52 / 416)
    };
  }

  function loadStorage() {
    var restored = false;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved.stations && saved.stations.length) state.stations = saved.stations;
        if (saved.readings) state.readings = saved.readings;
        if (saved.rules) state.rules = mergeRules(saved.rules);
        if (saved.selectedId && stationById(saved.selectedId)) state.selectedId = saved.selectedId;
        if (typeof saved.continuous === "boolean") state.continuous = saved.continuous;
        restored = true;
      }
    } catch (err) {
      state.stations = data.createStations();
      state.readings = data.createReadings();
      restored = false;
    }
    state.stations.forEach(function (station) {
      if (!state.readings[station.id]) {
        state.readings[station.id] = data.baseReading({
          water: Math.max(0, (station.stages && station.stages.alert ? station.stages.alert : 1) - 0.4)
        });
      }
    });
    return restored;
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        stations: state.stations,
        readings: state.readings,
        rules: state.rules,
        selectedId: state.selectedId,
        continuous: state.continuous
      }));
    } catch (err) {
      return;
    }
  }

  function evaluate() {
    try {
      return engine.evaluate(state.stations, state.readings, state.rules, data.readingFields);
    } catch (err) {
      return {
        blocked: true,
        warnings: [],
        errors: ["这一轮没有算完。先恢复初始数据，再重新录入。"],
        approaches: [],
        details: {},
        byStation: {}
      };
    }
  }

  function commit(force) {
    state.result = evaluate();
    state.computedAt = formatWhen(new Date());
    if (state.continuous || force) {
      document.getElementById("pending").hidden = true;
      paint();
    } else {
      var pending = document.getElementById("pending");
      pending.hidden = false;
      pending.textContent = "监测值已改，当前预警仍是上一次结果。点执行研判后更新。";
      paintErrors();
    }
    persist();
  }

  function schedule(force) {
    window.clearTimeout(timer);
    timer = window.setTimeout(function () { commit(force); }, force ? 0 : 160);
  }

  function paint() {
    paintBulletin();
    paintCount();
    syncSwitchLamps();
    syncMap();
    paintDerived();
    paintErrors();
    paintRuleErrors();
  }

  function paintCount() {
    var result = state.result;
    var text = "当前无预警";
    if (!result || result.blocked) text = "规则待修正";
    else if (result.warnings.length) text = "当前 " + result.warnings.length + " 条预警";
    document.getElementById("count").textContent = text;
    var summary = text;
    if (result && result.warnings && result.warnings[0]) {
      summary = titleOf(result.warnings[0]) + "，" + result.warnings[0].location + "，" + text;
    } else if (result && result.blocked) {
      summary = "规则未通过检查，没有发布预警。";
    } else {
      summary = "当前没有达到发布线的灾害。";
    }
    if (summary !== state.liveText) {
      state.liveText = summary;
      document.getElementById("live").textContent = summary;
    }
  }

  function stampUpdated() {
    var node = document.getElementById("updated");
    if (!node) return;
    node.textContent = state.computedAt ? "数据更新于 " + state.computedAt : "数据更新于 --";
  }

  function nearCard(item) {
    var card = el("article", "near-card");
    card.appendChild(el("p", "near-card__place", item.station || item.place || ""));
    if (item.spot) card.appendChild(el("p", "near-card__spot", item.spot));
    if (item.hazard) card.appendChild(el("p", "near-card__hazard", item.hazard));
    var value = el("p", "near-card__value", item.value == null ? "" : String(item.value));
    if (item.unit) value.appendChild(el("span", null, " " + item.unit));
    card.appendChild(value);
    if (item.limit != null) {
      card.appendChild(el("p", "near-card__limit", (item.limitLabel || "发布线") + " " + item.limit + (item.unit ? " " + item.unit : "")));
    }
    var bar = el("div", "near-card__bar");
    var fill = document.createElement("i");
    var pct = Math.max(0, Math.min(100, Math.round((Number(item.ratio) || 0) * 100)));
    fill.style.width = pct + "%";
    bar.appendChild(fill);
    card.appendChild(bar);
    return card;
  }

  function adviceBlock(text) {
    var box = el("section", "advice-block");
    box.appendChild(el("p", "advice-title", "建议"));
    box.appendChild(el("p", null, text));
    return box;
  }

  function paintBulletin() {
    var root = document.getElementById("bulletin");
    var result = state.result;
    clear(root);
    stampUpdated();

    if (!result || result.blocked) {
      var blocked = el("section", "verdict");
      var blockedTitle = el("p", "headline", "规则还不能用于发布");
      blockedTitle.id = "bulletin-title";
      blocked.appendChild(blockedTitle);
      (result && result.errors ? result.errors : ["规则无法计算。"]).forEach(function (line) {
        blocked.appendChild(el("p", "error-text", line));
      });
      root.appendChild(blocked);
      root.appendChild(adviceBlock("雨强、日雨量、风力、内涝倍数、地质风险分和高温要从蓝到红越来越高。台风气压要从蓝到红越来越低。超出范围或空着的格子改回有效数字。"));
      return;
    }

    var top = result.warnings.length ? result.warnings[0] : null;
    var level = top ? top.level : "none";
    var verdict = el(top ? "button" : "section", "verdict lv-" + level);
    if (top) {
      verdict.type = "button";
      verdict.addEventListener("click", function () {
        select(top.stationId);
        if (typeof showView === "function") showView("entry");
      });
      var headline = el("p", "headline", titleOf(top));
      headline.id = "bulletin-title";
      verdict.appendChild(headline);
      var placeBits = [];
      if (top.subtype && top.subtype !== top.type) placeBits.push(top.subtype);
      placeBits.push(top.nature);
      verdict.appendChild(el("p", "location", placeBits.join("，")));
      verdict.appendChild(el("p", "forecast", top.location));
    } else {
      var calmTitle = el("p", "headline", "当前没有达到发布线的灾害");
      calmTitle.id = "bulletin-title";
      verdict.appendChild(calmTitle);
    }
    root.appendChild(verdict);

    var warned = {};
    result.warnings.forEach(function (warning) { warned[warning.stationId] = true; });
    var reminders = result.approaches.filter(function (item) { return !warned[item.stationId]; });
    var list = el("div", "near-list");
    reminders.forEach(function (item) {
      var station = stationById(item.stationId);
      list.appendChild(nearCard({
        station: item.station,
        spot: station ? station.place : "",
        hazard: item.hazard,
        value: item.value,
        unit: item.unit,
        limit: item.limit,
        limitLabel: item.limitLabel,
        ratio: item.ratio
      }));
    });
    if (!reminders.length && !top) list.appendChild(el("p", "forecast", "各监测点都离发布线较远。"));
    root.appendChild(list);
    result.errors.forEach(function (line) { root.appendChild(el("p", "error-text", line)); });
    var advice = result.warnings.length
      ? result.warnings[0].advice
      : "保持监测。需要看某一种灾害时，在监测录入里载入对应情景，或直接改监测值。";
    root.appendChild(adviceBlock(advice));
  }

  function paintDerived() {
    var node = document.getElementById("derived");
    if (!node) return;
    var station = selected();
    var detail = state.result && state.result.details ? state.result.details[station.id] : null;
    if (!detail || detail.skipped) {
      node.textContent = "该点这一轮没有参与计算。";
      return;
    }
    var bits = ["预测水位 " + engine.round(detail.predictedWater, 2) + " 米"];
    if (detail.score) bits.push("地质风险分 " + engine.round(detail.score, 2));
    if (detail.predictedGust != null) bits.push("采用风速 " + engine.round(detail.predictedGust, 1) + " m/s");
    var mine = (state.result.warnings || []).filter(function (warning) {
      return warning.stationId === station.id;
    });
    if (mine.length) {
      bits.push("本点 " + mine.map(function (warning) {
        return warning.type + engine.LEVEL_NAME[warning.level] + "（" + warning.nature + "）";
      }).join("、"));
    } else {
      bits.push("本点未达发布线");
    }
    node.textContent = bits.join("。") + "。";
  }

  function setInvalid(input, message, errorNode) {
    if (!input || !errorNode) return;
    var bad = !!message;
    input.setAttribute("aria-invalid", bad ? "true" : "false");
    errorNode.textContent = message || "";
  }

  function paintErrors() {
    var station = selected();
    var reading = state.readings[station.id] || {};
    data.readingFields.forEach(function (field) {
      var input = document.getElementById("f-" + field.key);
      var errorNode = document.getElementById("err-" + field.key);
      var value = reading[field.key];
      var number = typeof value === "number" ? value : Number(value);
      var message = "";
      if (!Number.isFinite(number) || number < field.min || number > field.max) {
        message = field.label + "要在 " + field.min + " 到 " + field.max + " 之间，改回范围内才会参与判定。";
      }
      setInvalid(input, message, errorNode);
    });
    var stages = station.stages || {};
    data.stageFields.forEach(function (field) {
      var input = document.getElementById("s-" + field.key);
      var errorNode = document.getElementById("serr-" + field.key);
      var number = Number(stages[field.key]);
      var message = "";
      if (!Number.isFinite(number) || number < field.min || number > field.max) {
        message = field.label + "要在 " + field.min + " 到 " + field.max + " 之间。";
      }
      setInvalid(input, message, errorNode);
    });
    var order = document.getElementById("serr-guarantee");
    if (order && Number.isFinite(Number(stages.alert)) && Number.isFinite(Number(stages.danger)) && Number.isFinite(Number(stages.guarantee))) {
      if (!(stages.alert < stages.danger && stages.danger < stages.guarantee)) {
        order.textContent = "需要满足警戒水位 < 危险水位 < 保证水位，否则本点不判洪涝。";
        var guarantee = document.getElementById("s-guarantee");
        if (guarantee) guarantee.setAttribute("aria-invalid", "true");
      }
    }
    paintMetaErrors(station);
  }

  function paintMetaErrors(station) {
    var specs = [
      ["localKm2", "m-area", "merr-area", 1, 5000, "区间集水面积要在 1 到 5000 之间。"],
      ["coastExposure", "m-coast", "merr-coast", 0, 1, "海岸暴露要在 0 到 1 之间。"]
    ];
    specs.forEach(function (spec) {
      var number = Number(station[spec[0]]);
      setInvalid(document.getElementById(spec[1]), Number.isFinite(number) && number >= spec[3] && number <= spec[4] ? "" : spec[5], document.getElementById(spec[2]));
    });
    var wan = station.storageM2 / 10000;
    setInvalid(
      document.getElementById("m-storage"),
      Number.isFinite(wan) && wan >= 10 && wan <= 50000 ? "" : "槽蓄面积要在 10 到 50000 万平方米之间。",
      document.getElementById("merr-storage")
    );
  }

  function paintRuleErrors() {
    data.ruleFields.forEach(function (field) {
      var input = document.getElementById("r-" + field.path.replace(".", "-"));
      if (!input) return;
      var number = input.value.trim() === "" ? NaN : Number(input.value);
      var bad = !Number.isFinite(number) || number < field.min || number > field.max;
      input.setAttribute("aria-invalid", bad ? "true" : "false");
    });
  }

  function stationMarks(id) {
    var station = stationById(id);
    var byStation = state.result && state.result.byStation ? state.result.byStation : {};
    var level = station && station.enabled === false ? "none" : ((byStation[id] && byStation[id].level) || "none");
    var near = false;
    if (station && station.enabled !== false && state.result && state.result.approaches) {
      near = state.result.approaches.some(function (item) { return item.stationId === id; });
    }
    return { level: level, warned: level !== "none", near: near };
  }

  function syncSwitchLamps() {
    document.querySelectorAll("#switch button").forEach(function (btn) {
      var marks = stationMarks(btn.getAttribute("data-id"));
      var bang = btn.querySelector("[data-bang]");
      var tri = btn.querySelector("[data-near]");
      if (bang) bang.hidden = !marks.warned;
      if (tri) tri.hidden = !marks.near;
    });
  }

  function renderSwitch() {
    var sig = state.stations.map(function (station) {
      return [station.id, station.code, station.name, station.enabled].join("~");
    }).join("|");
    var root = document.getElementById("switch");
    if (sig === switchSig && root.children.length) {
      root.querySelectorAll("button").forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-id") === state.selectedId ? "true" : "false");
      });
      syncSwitchLamps();
      return;
    }
    switchSig = sig;
    clear(root);
    state.stations.forEach(function (station) {
      var btn = el("button");
      btn.type = "button";
      btn.setAttribute("data-id", station.id);
      btn.setAttribute("aria-pressed", station.id === state.selectedId ? "true" : "false");
      var name = el("span", "subnav__name", station.name + (station.enabled === false ? " 停用" : ""));
      var bang = el("span", "subnav__bang", "!");
      bang.setAttribute("data-bang", station.id);
      bang.hidden = true;
      bang.setAttribute("aria-label", "已有预警");
      var tri = el("span", "subnav__tri", "▲");
      tri.setAttribute("data-near", station.id);
      tri.hidden = true;
      tri.setAttribute("aria-label", "即将超标");
      btn.appendChild(name);
      btn.appendChild(bang);
      btn.appendChild(tri);
      root.appendChild(btn);
    });
    syncSwitchLamps();
  }

  function fieldControl(field, value, id, scope) {
    var wrap = el("div", "field");
    var label = el("label", null, field.unit ? field.label + "（" + field.unit + "）" : field.label);
    label.htmlFor = id;
    var input = el("input");
    input.id = id;
    input.type = "number";
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    input.value = value;
    input.autocomplete = "off";
    input.setAttribute("data-scope", scope);
    input.setAttribute("data-key", field.key || field.path || "");
    input.setAttribute("aria-describedby", id + "-err");
    var error = el("p", "error-text");
    error.id = id + "-err";
    wrap.appendChild(label);
    wrap.appendChild(input);
    if (field.help) wrap.appendChild(el("p", "help", field.help));
    wrap.appendChild(error);
    return wrap;
  }

  function renderForm() {
    var station = selected();
    var reading = state.readings[station.id];
    var root = document.getElementById("reading-form");
    state.deleteArmed = false;
    clear(root);

    var head = el("header", "station-head");
    head.appendChild(textField("名称", "f-name", station.name, "name", "station-head__name"));
    head.appendChild(textField("地区", "f-place", station.place, "place", "station-head__place"));
    root.appendChild(head);

    var groups = [];
    data.readingFields.forEach(function (field) {
      var group = null;
      groups.forEach(function (item) { if (item.name === field.group) group = item; });
      if (!group) {
        group = { name: field.group, fields: [] };
        groups.push(group);
      }
      group.fields.push(field);
    });
    groups.forEach(function (group) {
      var box = el("fieldset", sectionTone(group.name));
      box.appendChild(el("legend", "section-tag", group.name));
      var grid = el("div", "fields");
      group.fields.forEach(function (field) {
        var wrap = fieldControl(field, reading[field.key], "f-" + field.key, "reading");
        var error = wrap.querySelector(".error-text");
        error.id = "err-" + field.key;
        wrap.querySelector("input").setAttribute("aria-describedby", "err-" + field.key);
        grid.appendChild(wrap);
      });
      box.appendChild(grid);
      root.appendChild(box);
    });

    var stageBox = el("fieldset", sectionTone("水位阈值"));
    stageBox.appendChild(el("legend", "section-tag", "水位阈值"));
    stageBox.appendChild(el("p", "help", "黄色参考线取警戒和危险的中点。预测水位越过哪一条，就在这个地点发布对应洪涝等级。"));
    var stageGrid = el("div", "fields");
    data.stageFields.forEach(function (field) {
      var wrap = fieldControl(field, station.stages[field.key], "s-" + field.key, "stage");
      wrap.querySelector(".error-text").id = "serr-" + field.key;
      wrap.querySelector("input").setAttribute("aria-describedby", "serr-" + field.key);
      stageGrid.appendChild(wrap);
    });
    stageBox.appendChild(stageGrid);
    root.appendChild(stageBox);

    var meta = el("fieldset", sectionTone("点位参数"));
    meta.appendChild(el("legend", "section-tag", "点位参数"));
    meta.appendChild(el("p", "help", upstreamSentence(station) + "槽蓄面积越小，同样的来水抬升越高。大坝槽蓄面积大，所以能挡住一部分上游洪峰。"));
    var metaGrid = el("div", "fields");
    metaGrid.appendChild(numberMeta("区间集水面积（km²）", "m-area", "merr-area", station.localKm2, "localKm2", 1, 5000, 1));
    metaGrid.appendChild(numberMeta("槽蓄面积（万平方米）", "m-storage", "merr-storage", station.storageM2 / 10000, "storageWan", 10, 50000, 1));
    metaGrid.appendChild(numberMeta("海岸暴露（0 到 1）", "m-coast", "merr-coast", station.coastExposure, "coastExposure", 0, 1, 0.01));
    meta.appendChild(metaGrid);
    var enable = el("label", "check");
    var box = el("input");
    box.type = "checkbox";
    box.checked = station.enabled !== false;
    box.setAttribute("data-scope", "meta");
    box.setAttribute("data-key", "enabled");
    enable.appendChild(box);
    enable.appendChild(document.createTextNode("参与本轮研判"));
    meta.appendChild(enable);
    if (station.custom) {
      var del = el("button", "btn btn--secondary", "删除" + station.name);
      del.type = "button";
      del.id = "delete-station";
      del.addEventListener("click", onDelete);
      meta.appendChild(del);
    }
    root.appendChild(meta);
    root.appendChild(el("p", "derived", ""));
    root.lastChild.id = "derived";
    paintDerived();
    paintErrors();
  }

  function sectionTone(name) {
    var tones = {
      "气象": "tone-weather", "水文": "tone-water", "地质": "tone-geo", "水位阈值": "tone-stage", "点位参数": "tone-meta",
      "汇流": "tone-water", "暴雨": "tone-weather", "大风与台风": "tone-stage", "内涝": "tone-flood", "高温": "tone-heat"
    };
    return tones[name] || "tone-meta";
  }

  function textField(labelText, id, value, key, extraClass) {
    var wrap = el("div", "field" + (extraClass ? " " + extraClass : ""));
    var label = el("label", extraClass ? "sr-only" : null, labelText);
    label.htmlFor = id;
    var input = el("input", "text-input");
    input.id = id;
    input.type = "text";
    input.maxLength = 24;
    input.value = value;
    input.autocomplete = "off";
    input.setAttribute("data-scope", "meta");
    input.setAttribute("data-key", key);
    wrap.appendChild(label);
    wrap.appendChild(input);
    return wrap;
  }

  function numberMeta(labelText, id, errorId, value, key, min, max, step) {
    var wrap = fieldControl({
      label: labelText,
      unit: "",
      min: min,
      max: max,
      step: step,
      key: key
    }, value, id, "meta");
    wrap.querySelector("label").textContent = labelText;
    wrap.querySelector(".error-text").id = errorId;
    wrap.querySelector("input").setAttribute("aria-describedby", errorId);
    return wrap;
  }

  function upstreamSentence(station) {
    var kind = engine.KIND_LABEL[station.kind] || station.kind;
    var head = "类型：" + kind + "。海拔 " + station.elev + " 米。";
    if (!station.upstream || !station.upstream.length) return head + "没有上游，产水只来自本区间。";
    var links = station.upstream.map(function (link) {
      var up = stationById(link.id);
      return (up ? up.name : link.id) + "，汇入比 " + link.share + "，约 " + link.hours + " 小时";
    }).join("；");
    return head + "上游：" + links + "。";
  }

  function renderRules() {
    var root = document.getElementById("rules");
    clear(root);
    var groups = [];
    data.ruleFields.forEach(function (field) {
      var group = null;
      groups.forEach(function (item) { if (item.name === field.group) group = item; });
      if (!group) {
        group = { name: field.group, fields: [] };
        groups.push(group);
      }
      group.fields.push(field);
    });
    groups.forEach(function (group) {
      var box = el("fieldset", sectionTone(group.name));
      box.appendChild(el("legend", "section-tag", group.name));
      var grid = el("div", "fields");
      group.fields.forEach(function (field) {
        var id = "r-" + field.path.replace(".", "-");
        var wrap = fieldControl(field, engine.getPath(state.rules, field.path), id, "rule");
        wrap.querySelector("input").setAttribute("data-path", field.path);
        grid.appendChild(wrap);
      });
      box.appendChild(grid);
      root.appendChild(box);
    });
  }

  function renderScenarios() {
    var select = document.getElementById("scenario");
    clear(select);
    Object.keys(data.scenarios).forEach(function (id) {
      var option = el("option", null, data.scenarios[id].name);
      option.value = id;
      select.appendChild(option);
    });
  }

  function fillUpstream() {
    var select = document.getElementById("new-up");
    var current = select.value;
    clear(select);
    var none = el("option", null, "无上游");
    none.value = "";
    select.appendChild(none);
    state.stations.forEach(function (station) {
      var option = el("option", null, station.name);
      option.value = station.id;
      select.appendChild(option);
    });
    if (current && stationById(current)) select.value = current;
  }

  function buildMap() {
    var svg = document.getElementById("basin");
    var hits = document.getElementById("map-hits");
    clear(svg);
    clear(hits);
    svg.appendChild(svgEl("rect", { x: "0", y: "0", width: "760", height: "600", fill: "var(--surface-overlay)" }));
    ticks(svg);
    svg.appendChild(svgEl("ellipse", { cx: "150", cy: "92", rx: "54", ry: "32", class: "contour" }));
    svg.appendChild(svgEl("ellipse", { cx: "150", cy: "92", rx: "86", ry: "48", class: "contour" }));
    for (var i = 0; i < 7; i += 1) {
      svg.appendChild(svgEl("path", {
        d: "M" + (560 + i * 16) + " 590 L" + (700 + i * 16) + " 450",
        class: "sea-line"
      }));
    }
    var bed = "M150 92 L236 198 L368 300 L508 402 L640 508";
    var branch = "M112 268 L250 294 L368 300";
    svg.appendChild(svgEl("path", { d: bed, class: "river-bed" }));
    svg.appendChild(svgEl("path", { d: branch, class: "river-bed" }));
    svg.appendChild(svgEl("path", { d: bed, class: "river-line" }));
    svg.appendChild(svgEl("path", { d: branch, class: "river-line" }));
    state.stations.forEach(function (station) {
      (station.upstream || []).forEach(function (link) {
        if (!station.custom) return;
        var up = stationById(link.id);
        if (!up) return;
        svg.appendChild(svgEl("path", {
          d: "M" + up.x + " " + up.y + " L" + station.x + " " + station.y,
          class: "link-line"
        }));
      });
    });
    var riverName = svgEl("text", { x: "430", y: "360", class: "map-meta" });
    riverName.textContent = "范河";
    svg.appendChild(riverName);
    var seaName = svgEl("text", { x: "688", y: "564", class: "map-meta" });
    seaName.textContent = "学海";
    svg.appendChild(seaName);

    state.stations.forEach(function (station) {
      var group = svgEl("g", { id: "mk-" + station.id, transform: "translate(" + station.x + " " + station.y + ")" });
      var anchorEnd = station.x > 560;
      var place = station.label || {
        dx: anchorEnd ? -24 : 24,
        dy: -8,
        anchor: anchorEnd ? "end" : "start"
      };
      group.appendChild(svgEl("rect", {
        x: "-18", y: "-18", width: "36", height: "36",
        class: "reticle", id: "re-" + station.id
      }));
      group.appendChild(svgEl("rect", {
        x: "-6", y: "-6", width: "12", height: "12",
        class: "station-mark", id: "dot-" + station.id
      }));
      var name = svgEl("text", {
        x: String(place.dx),
        y: String(place.dy),
        class: "map-label",
        "text-anchor": place.anchor
      });
      name.textContent = station.name;
      group.appendChild(name);
      var meta = svgEl("text", {
        x: String(place.dx),
        y: String(place.dy + 18),
        class: "map-meta",
        "text-anchor": place.anchor
      });
      meta.id = "meta-" + station.id;
      group.appendChild(meta);
      svg.appendChild(group);

      var hit = el("button");
      hit.type = "button";
      hit.setAttribute("data-id", station.id);
      hit.style.left = (station.x / 760 * 100) + "%";
      hit.style.top = (station.y / 600 * 100) + "%";
      hits.appendChild(hit);
    });
    syncMap();
  }

  function ticks(svg) {
    [[16, 16, 1, 1], [744, 16, -1, 1], [16, 584, 1, -1], [744, 584, -1, -1]].forEach(function (item) {
      svg.appendChild(svgEl("path", {
        d: "M" + item[0] + " " + item[1] + " h" + (18 * item[2]) + " M" + item[0] + " " + item[1] + " v" + (18 * item[3]),
        class: "tick"
      }));
    });
    svg.appendChild(svgEl("path", { d: "M48 78 V42", class: "north-mark" }));
    svg.appendChild(svgEl("path", { d: "M48 42 L42 52 L54 52 Z", class: "north-mark" }));
    var north = svgEl("text", { x: "48", y: "32", "text-anchor": "middle", class: "map-meta" });
    north.textContent = "N";
    svg.appendChild(north);
  }

  function renderMap() {
    var sig = state.stations.map(function (station) {
      return station.id + "@" + station.x + "," + station.y;
    }).join("|");
    if (sig === mapSig && document.getElementById("basin").childNodes.length) {
      syncMap();
      return;
    }
    mapSig = sig;
    buildMap();
  }

  function syncMap() {
    var byStation = state.result && state.result.byStation ? state.result.byStation : {};
    var top = state.result && state.result.warnings ? state.result.warnings[0] : null;
    var topId = top ? top.stationId : "";
    var levelName = { none: "正常", blue: "蓝色", yellow: "黄色", orange: "橙色", red: "红色" };
    state.stations.forEach(function (station) {
      var level = station.enabled === false ? "none" : ((byStation[station.id] && byStation[station.id].level) || "none");
      var dot = document.getElementById("dot-" + station.id);
      if (dot) {
        dot.setAttribute("class", "station-mark" + (station.enabled === false ? " is-off" : " lv-" + level) + (station.id === state.selectedId ? " is-selected" : ""));
      }
      var name = document.querySelector("#mk-" + station.id + " .map-label");
      if (name) name.textContent = station.name;
      var meta = document.getElementById("meta-" + station.id);
      if (meta) meta.textContent = station.code + " " + (station.enabled === false ? "停用" : levelName[level]);
      var reticle = document.getElementById("re-" + station.id);
      if (reticle) {
        var hot = station.id === topId;
        if (hot && state.reticleId !== topId) reticle.classList.remove("on");
        reticle.classList.toggle("on", hot);
      }
      var hit = document.querySelector('#map-hits button[data-id="' + station.id + '"]');
      if (hit) {
        hit.setAttribute("aria-pressed", station.id === state.selectedId ? "true" : "false");
        hit.setAttribute("aria-label", station.name + "，" + (station.enabled === false ? "已停用" : levelName[level]) + "。选择该监测点");
      }
    });
    if (state.reticleId !== topId) {
      state.reticleId = topId;
      var active = topId ? document.getElementById("re-" + topId) : null;
      if (active) {
        active.classList.remove("on");
        window.requestAnimationFrame(function () { active.classList.add("on"); });
      }
    }
  }

  function select(id) {
    if (!stationById(id)) return;
    state.selectedId = id;
    if (history.replaceState) history.replaceState(null, "", "#" + encodeURIComponent(id));
    renderForm();
    renderSwitch();
    syncMap();
    persist();
  }

  function readNumber(input) {
    if (input.value.trim() === "") return "";
    return Number(input.value);
  }

  function onFormEvent(event) {
    var input = event.target;
    var scope = input.getAttribute("data-scope");
    if (!scope) return;
    var station = selected();
    var key = input.getAttribute("data-key");
    if (scope === "reading") {
      state.readings[station.id][key] = readNumber(input);
    } else if (scope === "stage") {
      var stageValue = readNumber(input);
      if (stageValue !== "") station.stages[key] = stageValue;
    } else if (scope === "meta") {
      if (key === "enabled") {
        station.enabled = input.checked;
        switchSig = "";
        renderSwitch();
      } else if (key === "name" || key === "place") {
        station[key] = input.value.trim() || station[key];
        if (key === "name") {
          switchSig = "";
          renderSwitch();
          fillUpstream();
        }
      } else if (key === "storageWan") {
        var wan = readNumber(input);
        if (wan !== "") station.storageM2 = wan * 10000;
      } else {
        var next = readNumber(input);
        if (next !== "") station[key] = next;
      }
    }
    schedule(false);
  }

  function onRuleEvent(event) {
    var input = event.target;
    var path = input.getAttribute("data-path");
    if (!path) return;
    var field = null;
    data.ruleFields.forEach(function (item) {
      if (item.path === path) field = item;
    });
    var value = readNumber(input);
    if (!field || value === "" || value < field.min || value > field.max) setPath(state.rules, path, NaN);
    else setPath(state.rules, path, value);
    schedule(false);
  }

  function onDelete() {
    var station = selected();
    var button = document.getElementById("delete-station");
    if (!station.custom) return;
    if (!state.deleteArmed) {
      state.deleteArmed = true;
      if (button) button.textContent = "再点一次，删除" + station.name;
      return;
    }
    state.stations = state.stations.filter(function (item) { return item.id !== station.id; });
    delete state.readings[station.id];
    state.selectedId = state.stations[0].id;
    state.deleteArmed = false;
    mapSig = "";
    switchSig = "";
    renderSwitch();
    renderForm();
    renderMap();
    fillUpstream();
    commit(true);
  }

  function addStation() {
    var name = document.getElementById("new-name").value.trim();
    var place = document.getElementById("new-place").value.trim();
    var kind = document.getElementById("new-kind").value;
    var up = document.getElementById("new-up").value;
    var share = Number(document.getElementById("new-share").value);
    var hours = Number(document.getElementById("new-hours").value);
    var area = Number(document.getElementById("new-area").value);
    var storage = Number(document.getElementById("new-storage").value);
    var coast = Number(document.getElementById("new-coast").value);
    var alert = Number(document.getElementById("new-alert").value);
    var danger = Number(document.getElementById("new-danger").value);
    var guarantee = Number(document.getElementById("new-guarantee").value);
    var x = Number(document.getElementById("new-x").value);
    var y = Number(document.getElementById("new-y").value);
    var error = "";
    if (!name) error = "先填写监测点名称。";
    else if (!place) error = "先填写这个点代表的地点。";
    else if (![share, hours, area, storage, coast, alert, danger, guarantee, x, y].every(Number.isFinite)) error = "新增点的数字还没填完整。";
    else if (share < 0 || share > 1) error = "汇入比要在 0 到 1 之间。";
    else if (hours < 0.5 || hours > 48) error = "汇流时间要在 0.5 到 48 小时之间。";
    else if (!(alert < danger && danger < guarantee)) error = "水位需要满足警戒 < 危险 < 保证。";
    else if (up && !stationById(up)) error = "上游监测点不存在，请重新选择。";
    document.getElementById("new-error").textContent = error;
    if (error) return;
    var id = "c" + Date.now();
    var count = state.stations.filter(function (station) { return station.custom; }).length + 1;
    var elev = { mountain: 520, gorge: 280, terrace: 160, reservoir: 90, urban: 40, coast: 8 }[kind] || 100;
    state.stations.push({
      id: id,
      code: "C" + count,
      name: name,
      place: place,
      kind: kind,
      elev: elev,
      x: x,
      y: y,
      km: kmFromSvg(x, y),
      localKm2: area,
      storageM2: storage * 10000,
      coastExposure: coast,
      stages: { alert: alert, danger: danger, guarantee: guarantee },
      upstream: up ? [{ id: up, share: share, hours: hours }] : [],
      enabled: true,
      custom: true
    });
    state.readings[id] = data.baseReading({
      water: Math.max(0, alert - 0.4),
      geoIndex: kind === "mountain" || kind === "gorge" ? 60 : 18
    });
    mapSig = "";
    switchSig = "";
    select(id);
    renderMap();
    fillUpstream();
    commit(true);
  }

  function loadScenario() {
    var id = document.getElementById("scenario").value;
    var next = data.applyScenario(id);
    Object.keys(next).forEach(function (sid) {
      if (state.readings[sid]) state.readings[sid] = next[sid];
    });
    document.getElementById("scenario-note").textContent = data.scenarios[id].note;
    renderForm();
    commit(true);
  }

  function resetData() {
    state.stations = data.createStations();
    state.readings = data.applyScenario("demo");
    state.rules = data.createRules();
    state.selectedId = "cq";
    state.deleteArmed = false;
    mapSig = "";
    switchSig = "";
    document.getElementById("scenario").value = "demo";
    document.getElementById("scenario-note").textContent = data.scenarios.demo.note;
    if (history.replaceState) history.replaceState(null, "", "#cq");
    renderSwitch();
    renderForm();
    renderRules();
    renderMap();
    fillUpstream();
    commit(true);
  }

  function publish() {
    commit(true);
  }

  function exportText() {
    commit(true);
    var when = formatWhen(new Date());
    var text = "\uFEFF" + engine.bulletinText(state.result, when);
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var link = el("a");
    link.href = URL.createObjectURL(blob);
    link.download = "山今预警单.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function bind() {
    document.getElementById("switch").addEventListener("click", function (event) {
      var btn = event.target.closest("button");
      if (!btn) return;
      select(btn.getAttribute("data-id"));
    });
    document.getElementById("map-hits").addEventListener("click", function (event) {
      var btn = event.target.closest("button");
      if (!btn || state.placing) return;
      select(btn.getAttribute("data-id"));
    });
    document.getElementById("basin").addEventListener("click", function (event) {
      if (!state.placing) return;
      var svg = document.getElementById("basin");
      var point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      var cursor = point.matrixTransform(svg.getScreenCTM().inverse());
      document.getElementById("new-x").value = String(Math.max(40, Math.min(720, Math.round(cursor.x))));
      document.getElementById("new-y").value = String(Math.max(40, Math.min(560, Math.round(cursor.y))));
      state.placing = false;
      document.getElementById("map-wrap").classList.remove("is-placing");
      document.getElementById("place").textContent = "在图上选点";
    });
    document.getElementById("reading-form").addEventListener("input", onFormEvent);
    document.getElementById("rules").addEventListener("input", onRuleEvent);
    document.getElementById("continuous").addEventListener("change", function (event) {
      state.continuous = event.target.checked;
      if (state.continuous) commit(true);
      else persist();
    });
    document.getElementById("run").addEventListener("click", publish);
    document.getElementById("export").addEventListener("click", exportText);
    document.getElementById("load").addEventListener("click", loadScenario);
    document.getElementById("scenario").addEventListener("change", function () {
      var id = document.getElementById("scenario").value;
      document.getElementById("scenario-note").textContent = data.scenarios[id].note;
    });
    document.getElementById("reset-data").addEventListener("click", resetData);
    document.getElementById("reset-rules").addEventListener("click", function () {
      state.rules = data.createRules();
      renderRules();
      commit(true);
    });
    document.getElementById("add").addEventListener("click", addStation);
    document.getElementById("place").addEventListener("click", function () {
      state.placing = !state.placing;
      document.getElementById("map-wrap").classList.toggle("is-placing", state.placing);
      document.getElementById("place").textContent = state.placing ? "取消选点" : "在图上选点";
    });
    window.addEventListener("hashchange", function () {
      var id = decodeURIComponent(location.hash.replace("#", ""));
      if (stationById(id) && id !== state.selectedId) select(id);
    });
  }

  function tick() {
    document.getElementById("clock").textContent = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date());
  }

  var restored = loadStorage();
  var hash = decodeURIComponent(location.hash.replace("#", ""));
  if (stationById(hash)) state.selectedId = hash;
  document.getElementById("continuous").checked = state.continuous;
  renderScenarios();
  if (restored) {
    document.getElementById("scenario-note").textContent = "已恢复这台浏览器上次保存的监测值和规则。载入情景会覆盖六个原始监测点的数值。";
  } else {
    document.getElementById("scenario").value = "demo";
    document.getElementById("scenario-note").textContent = data.scenarios.demo.note;
  }
  renderSwitch();
  renderForm();
  renderRules();
  renderMap();
  fillUpstream();
  bind();
  tick();
  window.setInterval(tick, 1000);
  commit(true);
})();
