(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Ndewfs = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var LEVEL_RANK = { none: 0, blue: 1, yellow: 2, orange: 3, red: 4 };
  var LEVEL_NAME = { none: "无预警", blue: "蓝色", yellow: "黄色", orange: "橙色", red: "红色" };
  var ORDER = ["blue", "yellow", "orange", "red"];
  var KIND_LABEL = {
    mountain: "山岭",
    gorge: "沟谷",
    terrace: "坡地",
    reservoir: "水库",
    urban: "城区",
    coast: "河口"
  };
  var TYPHOON_SUB = { blue: "热带风暴", yellow: "强热带风暴", orange: "台风", red: "强台风" };

  var ADVICE = {
    暴雨: {
      blue: "留意低洼路段积水，巡查排水口。",
      yellow: "减少进入下穿通道和地下空间，及时疏通排水。",
      orange: "暂停山区、河道和户外施工，开放临时避险点。",
      red: "停止户外聚集，远离危房、边坡、地下空间和行洪道。"
    },
    台风: {
      blue: "加固棚架和广告牌，船只回港避风。",
      yellow: "停止高空和水上作业，沿海人员远离岸线。",
      orange: "转移海岸危险区人员，切断户外电源。",
      red: "停课停业，人员留在坚固室内，远离门窗。"
    },
    大风: {
      blue: "固定易坠落物，高空作业人员下到地面。",
      yellow: "停止露天高处作业，远离广告牌和临时构筑物。",
      orange: "开放室内避风点，禁止靠近岸线和大树。",
      red: "停止户外活动，留守坚固建筑。"
    },
    洪涝: {
      blue: "通知低洼住户准备转移，加密水位观测。",
      yellow: "封闭漫水路，组织警戒水位以下人员转移。",
      orange: "危险区强制转移，河道和库区停止作业。",
      red: "撤离保证水位影响范围，禁止一切涉水通行。"
    },
    城市内涝: {
      blue: "打开沿线泵站，提醒车辆不要停在下穿通道。",
      yellow: "封闭易积水路段，转移地下车库人员。",
      orange: "停用下穿通道，把排涝力量集中到老城低洼片。",
      red: "危险积水区人员立即撤离，切断受淹区域电源。"
    },
    地质灾害: {
      blue: "加密裂缝和坡脚巡查，沟口暂勿停留。",
      yellow: "撤离坡脚和沟口人员，设置观察哨。",
      orange: "划定危险区并禁止进入，转移受威胁住户。",
      red: "连夜转出受威胁区域，封闭上山道路。"
    },
    高温: {
      yellow: "缩短午后户外作业，保证饮水和阴凉休息。",
      orange: "停止高温时段户外重体力作业，开放纳凉点。",
      red: "除应急岗位外停止户外作业，重点看护独居老人。"
    }
  };

  function maxLevel(a, b) {
    return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
  }

  function levelByMin(value, mins) {
    var level = "none";
    ORDER.forEach(function (id) {
      if (mins[id] == null) return;
      if (value >= mins[id]) level = id;
    });
    return level;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function round(n, digits) {
    var p = Math.pow(10, digits);
    return Math.round(n * p) / p;
  }

  function getPath(obj, path) {
    return path.split(".").reduce(function (acc, key) {
      return acc == null ? acc : acc[key];
    }, obj);
  }

  function num(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") return Number(value);
    return NaN;
  }

  function checkReading(reading, fields) {
    var problems = [];
    var clean = {};
    fields.forEach(function (field) {
      var value = num(reading ? reading[field.key] : undefined);
      if (!Number.isFinite(value) || value < field.min || value > field.max) {
        problems.push(field.label + "需要在 " + field.min + " 到 " + field.max + " 之间");
      } else {
        clean[field.key] = value;
      }
    });
    return { problems: problems, clean: clean };
  }

  function ruleProblems(rules) {
    var problems = [];
    if (!numbersOk(rules)) {
      problems.push("有规则超出允许范围，或填了空值。改回范围后再发布。");
      return problems;
    }
    function increasing(obj, label) {
      var prev = null;
      var prevName = "";
      ORDER.forEach(function (id) {
        if (!obj || obj[id] == null) return;
        if (prev != null && obj[id] < prev) problems.push(label + "应从低到高，" + prevName + "不能高于后面的等级");
        prev = obj[id];
        prevName = LEVEL_NAME[id];
      });
    }
    function decreasing(obj, label) {
      var prev = null;
      var prevName = "";
      ORDER.forEach(function (id) {
        if (!obj || obj[id] == null) return;
        if (prev != null && obj[id] > prev) problems.push(label + "应从高到低，" + prevName + "不能低于后面的等级");
        prev = obj[id];
        prevName = LEVEL_NAME[id];
      });
    }
    increasing(rules.rainRate, "雨强阈值");
    increasing(rules.rain24, "日雨量阈值");
    increasing(rules.wind, "大风阈值");
    increasing(rules.typhoonWind, "台风风力阈值");
    decreasing(rules.typhoonPressure, "台风气压阈值");
    increasing(rules.urbanRatio, "内涝倍数");
    increasing(rules.geoScore, "地质风险分");
    increasing(rules.heat, "高温阈值");
    return problems;
  }

  function numbersOk(value) {
    if (typeof value === "number") return Number.isFinite(value);
    if (!value || typeof value !== "object") return false;
    return Object.keys(value).every(function (key) { return numbersOk(value[key]); });
  }

  function topo(stations) {
    var byId = {};
    stations.forEach(function (s) { byId[s.id] = s; });
    var indeg = {};
    stations.forEach(function (s) { indeg[s.id] = 0; });
    stations.forEach(function (s) {
      (s.upstream || []).forEach(function (link) {
        if (byId[link.id]) indeg[s.id] += 1;
      });
    });
    var queue = stations.filter(function (s) { return indeg[s.id] === 0; }).map(function (s) { return s.id; });
    var ordered = [];
    while (queue.length) {
      var id = queue.shift();
      ordered.push(byId[id]);
      stations.forEach(function (s) {
        if ((s.upstream || []).some(function (link) { return link.id === id; })) {
          indeg[s.id] -= 1;
          if (indeg[s.id] === 0) queue.push(s.id);
        }
      });
    }
    return {
      ordered: ordered.length === stations.length ? ordered : stations.slice(),
      cyclic: ordered.length !== stations.length,
      byId: byId
    };
  }

  function stageProblems(station) {
    var s = station.stages || {};
    if (![s.alert, s.danger, s.guarantee].every(function (n) { return Number.isFinite(n); })) {
      return "水位阈值不完整";
    }
    if (!(s.alert < s.danger && s.danger < s.guarantee)) {
      return "需要满足警戒水位 < 危险水位 < 保证水位";
    }
    return "";
  }

  function floodLevel(level, stages) {
    if (level >= stages.guarantee) return "red";
    if (level >= stages.danger) return "orange";
    var yellowLine = (stages.alert + stages.danger) / 2;
    if (level >= yellowLine) return "yellow";
    if (level >= stages.alert) return "blue";
    return "none";
  }

  function adviceFor(type, level) {
    var table = ADVICE[type] || {};
    return table[level] || "按预案通知责任人，并继续监测。";
  }

  function placeOf(station) {
    return station.name + " · " + station.place;
  }

  function distKm(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function onshoreFactor(dir) {
    var delta = Math.abs(((dir - 140 + 540) % 360) - 180);
    return 0.82 + 0.18 * Math.cos(delta * Math.PI / 180);
  }

  function exposureGain(to, from) {
    var fromExposure = Math.max(from.coastExposure, 0.2);
    return 0.65 + 0.35 * (to.coastExposure / fromExposure);
  }

  function pushApproach(list, item) {
    if (item.ratio <= 0 || item.ratio > 1) return;
    list.push(item);
  }

  function evaluate(stations, readings, rules, fieldSpecs) {
    var fields = fieldSpecs || [];
    var warnings = [];
    var errors = [];
    var approaches = [];
    var details = {};
    var problems = ruleProblems(rules);
    if (problems.length) {
      return {
        warnings: [],
        errors: problems,
        approaches: [],
        details: {},
        blocked: true
      };
    }

    var graph = topo(stations);
    var active = stations.filter(function (s) { return s.enabled !== false; });
    var activeIds = {};
    active.forEach(function (s) { activeIds[s.id] = true; });

    var clean = {};
    active.forEach(function (station) {
      var checked = checkReading(readings[station.id], fields);
      if (checked.problems.length) {
        errors.push(station.name + "：" + checked.problems[0] + "。该点本次不参与判定。");
        details[station.id] = { skipped: true };
        return;
      }
      clean[station.id] = checked.clean;
    });

    var coefOf = {};
    var localMm = {};
    var volume = {};
    var incomingOf = {};
    var ordered = graph.cyclic ? active : graph.ordered.filter(function (s) { return activeIds[s.id]; });

    ordered.forEach(function (station) {
      var reading = clean[station.id];
      if (!reading) {
        volume[station.id] = 0;
        incomingOf[station.id] = [];
        return;
      }
      var humidExtra = Math.max(0, (reading.humidity - 70) / 30);
      var rawCoef = rules.runoffBase + rules.runoffSoil * (reading.soil / 100) + rules.runoffHumid * humidExtra;
      var coef = clamp(rawCoef, 0, 1.2);
      coefOf[station.id] = coef;
      localMm[station.id] = reading.rain24 * coef;
      var localVol = localMm[station.id] * station.localKm2 * 1000;
      var incoming = 0;
      var parts = [];
      if (!graph.cyclic) {
        (station.upstream || []).forEach(function (link) {
          if (!activeIds[link.id] || volume[link.id] == null || !clean[link.id]) return;
          var hours = Math.max(link.hours, 0.25);
          var share = clamp(link.share, 0, 1);
          var arrival = Math.min(1, rules.horizonHours / hours);
          var part = volume[link.id] * share * arrival;
          incoming += part;
          parts.push({
            id: link.id,
            name: graph.byId[link.id] ? graph.byId[link.id].name : link.id,
            share: share,
            hours: hours,
            arrival: arrival,
            volume: part
          });
        });
      }
      volume[station.id] = localVol + incoming;
      incomingOf[station.id] = parts;
    });

    ordered.forEach(function (station) {
      var reading = clean[station.id];
      if (!reading) return;
      var stageError = stageProblems(station);
      var rise = station.storageM2 > 0 ? volume[station.id] / station.storageM2 : 0;
      var predicted = reading.water + rise;
      var upstreamVol = (incomingOf[station.id] || []).reduce(function (sum, part) { return sum + part.volume; }, 0);
      var upstreamShare = volume[station.id] > 0 ? upstreamVol / volume[station.id] : 0;
      details[station.id] = {
        skipped: false,
        coef: coefOf[station.id],
        localMm: localMm[station.id],
        volume: volume[station.id],
        rise: rise,
        predictedWater: predicted,
        upstreamShare: upstreamShare,
        score: 0,
        predictedGust: reading.wind
      };

      if (!stageError) {
        var nowLevel = floodLevel(reading.water, station.stages);
        var predLevel = floodLevel(predicted, station.stages);
        var level = maxLevel(nowLevel, predLevel);
        var nature = LEVEL_RANK[predLevel] > LEVEL_RANK[nowLevel] ? "预测" : "实况";
        var yellowLine = (station.stages.alert + station.stages.danger) / 2;
        if (level === "none") {
          pushApproach(approaches, {
            stationId: station.id,
            station: station.name,
            hazard: "洪涝",
            ratio: predicted / station.stages.alert,
            value: round(predicted, 2),
            unit: "米",
            limit: station.stages.alert,
            limitLabel: "警戒",
            text: station.name + "预测水位 " + round(predicted, 2) + " 米，警戒 " + station.stages.alert + " 米"
          });
        } else {
          var used = nature === "预测" ? predicted : reading.water;
          var limit = level === "red" ? station.stages.guarantee
            : level === "orange" ? station.stages.danger
            : level === "yellow" ? yellowLine
            : station.stages.alert;
          var limitLabel = level === "red" ? "保证水位" : level === "orange" ? "危险水位" : level === "yellow" ? "黄色参考水位" : "警戒水位";
          var forecast = nature === "预测"
            ? "上游来水占本点预测水量的 " + Math.round(upstreamShare * 100) + "%，在 " + rules.horizonHours + " 小时预见期内到达。"
            : "当前水位已经达到" + limitLabel + "。";
          warnings.push({
            id: station.id + "-flood",
            type: "洪涝",
            subtype: station.kind === "reservoir" ? "水库水位" : "河道洪水",
            level: level,
            nature: nature,
            stationId: station.id,
            location: placeOf(station),
            forecast: forecast,
            evidence: [
              { label: nature === "预测" ? "预测水位" : "当前水位", value: round(used, 2), unit: "米", limitLabel: limitLabel, limit: limit },
              { label: "当前水位", value: round(reading.water, 2), unit: "米", limitLabel: "预测水位", limit: round(predicted, 2) }
            ],
            advice: adviceFor("洪涝", level)
          });
        }
      }

      var rateLevel = levelByMin(reading.rainRate, rules.rainRate);
      var dayLevel = levelByMin(reading.rain24, rules.rain24);
      var rainLevel = maxLevel(rateLevel, dayLevel);
      if (rainLevel === "none") {
        var rateRatio = reading.rainRate / rules.rainRate.blue;
        var dayRatio = reading.rain24 / rules.rain24.blue;
        var rainByRate = rateRatio >= dayRatio;
        pushApproach(approaches, {
          stationId: station.id,
          station: station.name,
          hazard: "暴雨",
          ratio: Math.max(rateRatio, dayRatio),
          value: rainByRate ? round(reading.rainRate, 1) : round(reading.rain24, 1),
          unit: rainByRate ? "mm/h" : "mm",
          limit: rainByRate ? rules.rainRate.blue : rules.rain24.blue,
          limitLabel: rainByRate ? "蓝色雨强" : "蓝色日雨量",
          text: station.name + "雨强 " + reading.rainRate + " mm/h，蓝色线 " + rules.rainRate.blue + " mm/h"
        });
      } else {
        var byRate = LEVEL_RANK[rateLevel] >= LEVEL_RANK[dayLevel];
        var subtype = byRate ? "短时强降水" : "持续性暴雨";
        var evidence = byRate
          ? { label: "雨强", value: round(reading.rainRate, 1), unit: "mm/h", limitLabel: LEVEL_NAME[rainLevel] + "雨强", limit: rules.rainRate[rainLevel] }
          : { label: "24 小时雨量", value: round(reading.rain24, 1), unit: "mm", limitLabel: LEVEL_NAME[rainLevel] + "日雨量", limit: rules.rain24[rainLevel] };
        warnings.push({
          id: station.id + "-rain",
          type: "暴雨",
          subtype: subtype,
          level: rainLevel,
          nature: "实况",
          stationId: station.id,
          location: placeOf(station),
          forecast: "判定位置就是该监测点，雨量没有改写到其他区域。",
          evidence: [evidence],
          advice: adviceFor("暴雨", rainLevel)
        });
      }

      if (station.kind === "urban") {
        var ratio = reading.rainRate / rules.urbanDrain;
        var waterlog = levelByMin(ratio, rules.urbanRatio);
        if (waterlog !== "none") {
          warnings.push({
            id: station.id + "-waterlog",
            type: "城市内涝",
            subtype: "城区积水",
            level: waterlog,
            nature: "实况",
            stationId: station.id,
            location: placeOf(station),
            forecast: "只在城区类型的监测点上，用雨强和排水能力比较。",
            evidence: [
              { label: "雨强", value: round(reading.rainRate, 1), unit: "mm/h", limitLabel: "排水能力", limit: rules.urbanDrain },
              { label: "超过排水能力", value: round(ratio, 2), unit: "倍", limitLabel: LEVEL_NAME[waterlog] + "倍数", limit: rules.urbanRatio[waterlog] }
            ],
            advice: adviceFor("城市内涝", waterlog)
          });
        }
      }

      var heat = levelByMin(reading.temp, rules.heat);
      if (heat !== "none") {
        warnings.push({
          id: station.id + "-heat",
          type: "高温",
          subtype: "高温",
          level: heat,
          nature: "实况",
          stationId: station.id,
          location: placeOf(station),
          forecast: "高温只发布在测到该气温的监测点。",
          evidence: [
            { label: "气温", value: round(reading.temp, 1), unit: "℃", limitLabel: LEVEL_NAME[heat] + "高温", limit: rules.heat[heat] }
          ],
          advice: adviceFor("高温", heat)
        });
      } else if (rules.heat.yellow) {
        pushApproach(approaches, {
          stationId: station.id,
          station: station.name,
          hazard: "高温",
          ratio: reading.temp / rules.heat.yellow,
          value: round(reading.temp, 1),
          unit: "℃",
          limit: rules.heat.yellow,
          limitLabel: "黄色线",
          text: station.name + "气温 " + reading.temp + " ℃，黄色线 " + rules.heat.yellow + " ℃"
        });
      }

      if (reading.geoIndex >= rules.geoMinIndex) {
        var rainTerm = clamp(reading.rain24 / rules.geoRainRef, 0, 1.4);
        var moveTerm = clamp(reading.displacement / rules.geoMoveRef, 0, 1.4);
        var wetTerm = reading.soil / 100;
        var score = (reading.geoIndex / 100) * (0.42 * wetTerm + 0.33 * rainTerm + 0.25 * moveTerm);
        details[station.id].score = score;
        var geoLevel = levelByMin(score, rules.geoScore);
        if (geoLevel === "none") {
          pushApproach(approaches, {
            stationId: station.id,
            station: station.name,
            hazard: "地质灾害",
            ratio: score / rules.geoScore.blue,
            value: round(score, 2),
            unit: "",
            limit: rules.geoScore.blue,
            limitLabel: "蓝色线",
            text: station.name + "地质风险分 " + round(score, 2) + "，蓝色线 " + rules.geoScore.blue
          });
        } else {
          var debris = (station.kind === "gorge" || station.kind === "mountain")
            && reading.rainRate >= rules.geoDebrisRate
            && LEVEL_RANK[geoLevel] >= LEVEL_RANK.yellow;
          var subtype = debris ? "泥石流" : "滑坡";
          warnings.push({
            id: station.id + "-geo",
            type: "地质灾害",
            subtype: subtype,
            level: geoLevel,
            nature: "预测",
            stationId: station.id,
            location: placeOf(station),
            forecast: "风险分由易发指数、土壤湿度、24 小时雨量和位移合成，发布在该坡面或沟口，不外推到低易发区。",
            evidence: [
              { label: "地质风险分", value: round(score, 2), unit: "", limitLabel: LEVEL_NAME[geoLevel] + "风险分", limit: rules.geoScore[geoLevel] },
              { label: "位移", value: round(reading.displacement, 1), unit: "mm/日", limitLabel: "位移参照", limit: rules.geoMoveRef },
              { label: "地质易发指数", value: reading.geoIndex, unit: "", limitLabel: "起报指数", limit: rules.geoMinIndex }
            ],
            advice: adviceFor("地质灾害", geoLevel)
          });
        }
      }
    });

    var windCandidates = ordered.filter(function (station) {
      return clean[station.id] && clean[station.id].pressure <= rules.typhoonPressure.blue;
    });
    var landfall = null;
    windCandidates.forEach(function (station) {
      var reading = clean[station.id];
      var score = reading.wind * (0.4 + 0.6 * station.coastExposure) * Math.max(0, 1010 - reading.pressure);
      if (!landfall || score > landfall.score) landfall = { station: station, reading: reading, score: score };
    });

    if (landfall) {
      var tLevel = (function typhoonLevel(pressure, wind) {
        var level = "none";
        ORDER.forEach(function (id) {
          if (pressure <= rules.typhoonPressure[id] && wind >= rules.typhoonWind[id]) level = id;
        });
        return level;
      })(landfall.reading.pressure, landfall.reading.wind);

      if (tLevel !== "none") {
        var factor = onshoreFactor(landfall.reading.windDir);
        warnings.push({
          id: landfall.station.id + "-typhoon",
          type: "台风",
          subtype: TYPHOON_SUB[tLevel],
          level: tLevel,
          nature: "实况",
          stationId: landfall.station.id,
          location: placeOf(landfall.station),
          forecast: "在气压低于台风蓝线的监测点中，取风力与海岸暴露综合最高的点作为影响位置。",
          evidence: [
            { label: "气压", value: round(landfall.reading.pressure, 1), unit: "hPa", limitLabel: LEVEL_NAME[tLevel] + "气压", limit: rules.typhoonPressure[tLevel] },
            { label: "风速", value: round(landfall.reading.wind, 1), unit: "m/s", limitLabel: LEVEL_NAME[tLevel] + "风力", limit: rules.typhoonWind[tLevel] }
          ],
          advice: adviceFor("台风", tLevel)
        });

        ordered.forEach(function (station) {
          if (station.id === landfall.station.id || !clean[station.id]) return;
          var km = distKm(station.km, landfall.station.km);
          var gust = landfall.reading.wind * Math.exp(-km / rules.typhoonDecayKm) * exposureGain(station, landfall.station) * factor;
          var observed = clean[station.id].wind;
          var used = Math.max(observed, gust);
          details[station.id].predictedGust = round(used, 1);
          var gale = levelByMin(used, rules.wind);
          if (gale === "none") return;
          var predicted = gust > observed;
          warnings.push({
            id: station.id + "-gale-ty",
            type: "大风",
            subtype: "台风影响",
            level: gale,
            nature: predicted ? "预测" : "实况",
            stationId: station.id,
            location: placeOf(station),
            forecast: "以" + landfall.station.name + "为影响位置，距离 " + round(km, 1) + " 公里，按 e 指数衰减并乘海岸暴露。",
            evidence: [
              { label: predicted ? "预测阵风" : "风速", value: round(used, 1), unit: "m/s", limitLabel: LEVEL_NAME[gale] + "大风", limit: rules.wind[gale] },
              { label: "距影响位置", value: round(km, 1), unit: "km", limitLabel: "衰减距离", limit: rules.typhoonDecayKm }
            ],
            advice: adviceFor("大风", gale)
          });
        });
      }
    }

    ordered.forEach(function (station) {
      var reading = clean[station.id];
      if (!reading) return;
      var hasTyphoonHere = warnings.some(function (w) { return w.stationId === station.id && w.type === "台风"; });
      var hasGaleHere = warnings.some(function (w) { return w.stationId === station.id && w.type === "大风"; });
      if (hasTyphoonHere || hasGaleHere) return;
      var gale = levelByMin(reading.wind, rules.wind);
      if (gale === "none") {
        pushApproach(approaches, {
          stationId: station.id,
          station: station.name,
          hazard: "大风",
          ratio: reading.wind / rules.wind.blue,
          value: round(reading.wind, 1),
          unit: "m/s",
          limit: rules.wind.blue,
          limitLabel: "蓝色线",
          text: station.name + "风速 " + reading.wind + " m/s，蓝色线 " + rules.wind.blue + " m/s"
        });
        return;
      }
      warnings.push({
        id: station.id + "-gale",
        type: "大风",
        subtype: "局地大风",
        level: gale,
        nature: "实况",
        stationId: station.id,
        location: placeOf(station),
        forecast: "气压未进入台风线，大风只留在测到该风速的位置。",
        evidence: [
          { label: "风速", value: round(reading.wind, 1), unit: "m/s", limitLabel: LEVEL_NAME[gale] + "大风", limit: rules.wind[gale] }
        ],
        advice: adviceFor("大风", gale)
      });
    });

    warnings.sort(function (a, b) {
      if (LEVEL_RANK[b.level] !== LEVEL_RANK[a.level]) return LEVEL_RANK[b.level] - LEVEL_RANK[a.level];
      if (a.nature !== b.nature) return a.nature === "实况" ? -1 : 1;
      return a.location.localeCompare(b.location, "zh");
    });
    approaches.sort(function (a, b) { return b.ratio - a.ratio; });

    var byStation = {};
    stations.forEach(function (station) {
      var mine = warnings.filter(function (w) { return w.stationId === station.id; });
      var level = "none";
      mine.forEach(function (w) { level = maxLevel(level, w.level); });
      byStation[station.id] = {
        level: level,
        count: mine.length,
        predicted: mine.some(function (w) { return w.nature === "预测"; })
      };
    });

    return {
      warnings: warnings,
      errors: errors,
      approaches: approaches.filter(function (item) { return item.ratio >= 0.7; }),
      details: details,
      byStation: byStation,
      blocked: false,
      kindLabel: KIND_LABEL
    };
  }

  function bulletinText(result, when) {
    var lines = [];
    lines.push("南湖自然灾害预警单");
    lines.push("发布时间：" + when);
    lines.push("数据性质：教学模拟，不作为真实预警。");
    lines.push("");
    if (!result || result.blocked) {
      lines.push("规则未通过检查，没有发布预警。");
      (result && result.errors || []).forEach(function (err) { lines.push(err); });
      return lines.join("\n");
    }
    if (!result.warnings.length) {
      lines.push("当前没有达到发布线的灾害。");
      result.approaches.forEach(function (item) { lines.push("接近发布线：" + item.text); });
    } else {
      result.warnings.forEach(function (w, index) {
        lines.push((index + 1) + ". " + w.type + LEVEL_NAME[w.level] + "预警（" + w.subtype + "，" + w.nature + "）");
        lines.push("地点：" + w.location);
        lines.push("位置判断：" + w.forecast);
        w.evidence.forEach(function (item) {
          lines.push("依据：" + item.label + " " + item.value + (item.unit ? " " + item.unit : "")
            + "，" + item.limitLabel + " " + item.limit + (item.unit ? " " + item.unit : ""));
        });
        lines.push("建议：" + w.advice);
        lines.push("");
      });
    }
    if (result.errors.length) {
      lines.push("未参与判定：");
      result.errors.forEach(function (err) { lines.push(err); });
    }
    return lines.join("\n");
  }

  return {
    LEVEL_RANK: LEVEL_RANK,
    LEVEL_NAME: LEVEL_NAME,
    KIND_LABEL: KIND_LABEL,
    evaluate: evaluate,
    bulletinText: bulletinText,
    getPath: getPath,
    round: round
  };
});
