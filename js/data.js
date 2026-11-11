(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NdewfsData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var LEVELS = ["blue", "yellow", "orange", "red"];

  function station(partial) {
    return Object.assign({
      enabled: true,
      custom: false,
      upstream: []
    }, partial);
  }

  function createStations() {
    return [
      station({
        id: "nl",
        code: "NL",
        name: "北岭哨",
        place: "东坡崩积层",
        kind: "mountain",
        elev: 860,
        x: 150,
        y: 92,
        label: { dx: 22, dy: -20, anchor: "start" },
        km: { x: 0, y: 0 },
        localKm2: 48,
        storageM2: 2600000,
        coastExposure: 0.08,
        stages: { alert: 1.8, danger: 2.6, guarantee: 3.2 },
        upstream: []
      }),
      station({
        id: "xx",
        code: "XX",
        name: "西峡哨",
        place: "沟口堆积扇",
        kind: "gorge",
        elev: 420,
        x: 236,
        y: 198,
        label: { dx: 22, dy: -22, anchor: "start" },
        km: { x: 7, y: 12 },
        localKm2: 38,
        storageM2: 2400000,
        coastExposure: 0.16,
        stages: { alert: 3.4, danger: 4.6, guarantee: 5.5 },
        upstream: [{ id: "nl", share: 0.92, hours: 2 }]
      }),
      station({
        id: "np",
        code: "NP",
        name: "南坡哨",
        place: "梯田后缘",
        kind: "terrace",
        elev: 260,
        x: 112,
        y: 268,
        label: { dx: -22, dy: -8, anchor: "end" },
        km: { x: -5, y: 16 },
        localKm2: 36,
        storageM2: 2200000,
        coastExposure: 0.22,
        stages: { alert: 2.2, danger: 3.0, guarantee: 3.6 },
        upstream: []
      }),
      station({
        id: "db",
        code: "DB",
        name: "中游大坝",
        place: "拦河库区",
        kind: "reservoir",
        elev: 180,
        x: 368,
        y: 300,
        label: { dx: 0, dy: -40, anchor: "middle" },
        km: { x: 20, y: 26 },
        localKm2: 70,
        storageM2: 8000000,
        coastExposure: 0.35,
        stages: { alert: 158.5, danger: 160.5, guarantee: 162 },
        upstream: [
          { id: "xx", share: 0.95, hours: 3 },
          { id: "np", share: 0.7, hours: 5 }
        ]
      }),
      station({
        id: "cq",
        code: "CQ",
        name: "南湖城区",
        place: "老城低洼片",
        kind: "urban",
        elev: 42,
        x: 508,
        y: 402,
        label: { dx: 26, dy: -24, anchor: "start" },
        km: { x: 34, y: 38 },
        localKm2: 90,
        storageM2: 1350000,
        coastExposure: 0.62,
        stages: { alert: 6.8, danger: 7.6, guarantee: 8.2 },
        upstream: [{ id: "db", share: 0.62, hours: 4 }]
      }),
      station({
        id: "dw",
        code: "DW",
        name: "学海河口",
        place: "口门与海堤",
        kind: "coast",
        elev: 6,
        x: 640,
        y: 508,
        label: { dx: -24, dy: 28, anchor: "end" },
        km: { x: 50, y: 52 },
        localKm2: 40,
        storageM2: 3200000,
        coastExposure: 1,
        stages: { alert: 3.6, danger: 4.4, guarantee: 5.2 },
        upstream: [{ id: "cq", share: 0.55, hours: 3 }]
      })
    ];
  }

  function baseReading(extra) {
    return Object.assign({
      temp: 22,
      humidity: 62,
      wind: 3.1,
      windDir: 40,
      pressure: 1013,
      rainRate: 0.2,
      rain24: 4,
      water: 1,
      soil: 40,
      displacement: 0.3,
      geoIndex: 20
    }, extra || {});
  }

  function createReadings() {
    return {
      nl: baseReading({ water: 0.9, geoIndex: 76, temp: 16, wind: 2.4 }),
      xx: baseReading({ water: 1.7, geoIndex: 62, temp: 18, wind: 2.2 }),
      np: baseReading({ water: 1.0, geoIndex: 44, temp: 20, wind: 2.0 }),
      db: baseReading({ water: 155.6, geoIndex: 18, temp: 21, wind: 2.8 }),
      cq: baseReading({ water: 5.2, geoIndex: 16, temp: 23, wind: 3.0 }),
      dw: baseReading({ water: 2.2, geoIndex: 12, temp: 22, wind: 4.2, windDir: 120, pressure: 1012 })
    };
  }

  function createRules() {
    return {
      horizonHours: 6,
      runoffBase: 0.22,
      runoffSoil: 0.58,
      runoffHumid: 0.06,
      rainRate: { blue: 10, yellow: 20, orange: 40, red: 70 },
      rain24: { blue: 30, yellow: 50, orange: 100, red: 150 },
      wind: { blue: 10.8, yellow: 17.2, orange: 24.5, red: 32.7 },
      typhoonPressure: { blue: 1000, yellow: 990, orange: 975, red: 960 },
      typhoonWind: { blue: 17.2, yellow: 24.5, orange: 32.7, red: 41.5 },
      typhoonDecayKm: 46,
      urbanDrain: 22,
      urbanRatio: { blue: 1, yellow: 1.4, orange: 1.8, red: 2.4 },
      geoMinIndex: 28,
      geoRainRef: 80,
      geoMoveRef: 12,
      geoScore: { blue: 0.32, yellow: 0.48, orange: 0.64, red: 0.8 },
      geoDebrisRate: 30,
      heat: { yellow: 35, orange: 37, red: 40 }
    };
  }

  var readingFields = [
    { key: "temp", label: "温度", unit: "℃", min: -40, max: 55, step: 0.1, group: "气象" },
    { key: "humidity", label: "湿度", unit: "%", min: 0, max: 100, step: 1, group: "气象" },
    { key: "wind", label: "风速", unit: "m/s", min: 0, max: 90, step: 0.1, group: "气象" },
    { key: "windDir", label: "风向", unit: "度", min: 0, max: 360, step: 1, group: "气象", help: "风的来向。0 为正北，90 为正东，140 表示风从学海海面吹向南湖。" },
    { key: "pressure", label: "气压", unit: "hPa", min: 870, max: 1080, step: 0.1, group: "气象" },
    { key: "rainRate", label: "雨强", unit: "mm/h", min: 0, max: 400, step: 0.1, group: "气象" },
    { key: "rain24", label: "24 小时雨量", unit: "mm", min: 0, max: 1200, step: 0.1, group: "气象" },
    { key: "water", label: "当前水位", unit: "m", min: 0, max: 400, step: 0.01, group: "水文" },
    { key: "soil", label: "土壤湿度", unit: "%", min: 0, max: 100, step: 1, group: "地质" },
    { key: "displacement", label: "位移", unit: "mm/日", min: 0, max: 500, step: 0.1, group: "地质" },
    { key: "geoIndex", label: "地质易发指数", unit: "0 到 100", min: 0, max: 100, step: 1, group: "地质", help: "同样降雨下，指数越高越容易出现滑坡或泥石流。" }
  ];

  var stageFields = [
    { key: "alert", label: "警戒水位", unit: "m", min: 0, max: 400, step: 0.01 },
    { key: "danger", label: "危险水位", unit: "m", min: 0, max: 400, step: 0.01 },
    { key: "guarantee", label: "保证水位", unit: "m", min: 0, max: 400, step: 0.01 }
  ];

  var ruleFields = [
    { path: "horizonHours", label: "预见期", unit: "小时", min: 1, max: 72, step: 1, group: "汇流", help: "只统计这段时间内能够流到下游的水量。" },
    { path: "runoffBase", label: "产流底数", unit: "", min: 0, max: 1, step: 0.01, group: "汇流" },
    { path: "runoffSoil", label: "土壤湿度权重", unit: "", min: 0, max: 1, step: 0.01, group: "汇流" },
    { path: "runoffHumid", label: "空气湿度权重", unit: "", min: 0, max: 0.5, step: 0.01, group: "汇流" },
    { path: "rainRate.blue", label: "雨强蓝", unit: "mm/h", min: 0, max: 400, step: 0.1, group: "暴雨" },
    { path: "rainRate.yellow", label: "雨强黄", unit: "mm/h", min: 0, max: 400, step: 0.1, group: "暴雨" },
    { path: "rainRate.orange", label: "雨强橙", unit: "mm/h", min: 0, max: 400, step: 0.1, group: "暴雨" },
    { path: "rainRate.red", label: "雨强红", unit: "mm/h", min: 0, max: 400, step: 0.1, group: "暴雨" },
    { path: "rain24.blue", label: "日雨量蓝", unit: "mm", min: 0, max: 1200, step: 1, group: "暴雨" },
    { path: "rain24.yellow", label: "日雨量黄", unit: "mm", min: 0, max: 1200, step: 1, group: "暴雨" },
    { path: "rain24.orange", label: "日雨量橙", unit: "mm", min: 0, max: 1200, step: 1, group: "暴雨" },
    { path: "rain24.red", label: "日雨量红", unit: "mm", min: 0, max: 1200, step: 1, group: "暴雨" },
    { path: "wind.blue", label: "大风蓝", unit: "m/s", min: 0, max: 90, step: 0.1, group: "大风与台风" },
    { path: "wind.yellow", label: "大风黄", unit: "m/s", min: 0, max: 90, step: 0.1, group: "大风与台风" },
    { path: "wind.orange", label: "大风橙", unit: "m/s", min: 0, max: 90, step: 0.1, group: "大风与台风" },
    { path: "wind.red", label: "大风红", unit: "m/s", min: 0, max: 90, step: 0.1, group: "大风与台风" },
    { path: "typhoonWind.blue", label: "台风风力蓝", unit: "m/s", min: 0, max: 90, step: 0.1, group: "大风与台风" },
    { path: "typhoonWind.yellow", label: "台风风力黄", unit: "m/s", min: 0, max: 90, step: 0.1, group: "大风与台风" },
    { path: "typhoonWind.orange", label: "台风风力橙", unit: "m/s", min: 0, max: 90, step: 0.1, group: "大风与台风" },
    { path: "typhoonWind.red", label: "台风风力红", unit: "m/s", min: 0, max: 90, step: 0.1, group: "大风与台风" },
    { path: "typhoonPressure.blue", label: "台风气压蓝", unit: "hPa", min: 870, max: 1080, step: 0.1, group: "大风与台风", help: "气压线从蓝到红应越来越低。" },
    { path: "typhoonPressure.yellow", label: "台风气压黄", unit: "hPa", min: 870, max: 1080, step: 0.1, group: "大风与台风" },
    { path: "typhoonPressure.orange", label: "台风气压橙", unit: "hPa", min: 870, max: 1080, step: 0.1, group: "大风与台风" },
    { path: "typhoonPressure.red", label: "台风气压红", unit: "hPa", min: 870, max: 1080, step: 0.1, group: "大风与台风" },
    { path: "typhoonDecayKm", label: "阵风衰减距离", unit: "km", min: 5, max: 200, step: 1, group: "大风与台风" },
    { path: "urbanDrain", label: "城区排水能力", unit: "mm/h", min: 1, max: 120, step: 0.5, group: "内涝" },
    { path: "urbanRatio.blue", label: "内涝蓝", unit: "倍", min: 0.2, max: 8, step: 0.1, group: "内涝" },
    { path: "urbanRatio.yellow", label: "内涝黄", unit: "倍", min: 0.2, max: 8, step: 0.1, group: "内涝" },
    { path: "urbanRatio.orange", label: "内涝橙", unit: "倍", min: 0.2, max: 8, step: 0.1, group: "内涝" },
    { path: "urbanRatio.red", label: "内涝红", unit: "倍", min: 0.2, max: 8, step: 0.1, group: "内涝" },
    { path: "geoMinIndex", label: "地质起报指数", unit: "", min: 0, max: 100, step: 1, group: "地质" },
    { path: "geoRainRef", label: "雨量参照", unit: "mm", min: 10, max: 400, step: 1, group: "地质" },
    { path: "geoMoveRef", label: "位移参照", unit: "mm/日", min: 1, max: 100, step: 0.5, group: "地质" },
    { path: "geoDebrisRate", label: "泥石流雨强", unit: "mm/h", min: 0, max: 200, step: 1, group: "地质" },
    { path: "geoScore.blue", label: "风险分蓝", unit: "", min: 0, max: 2, step: 0.01, group: "地质" },
    { path: "geoScore.yellow", label: "风险分黄", unit: "", min: 0, max: 2, step: 0.01, group: "地质" },
    { path: "geoScore.orange", label: "风险分橙", unit: "", min: 0, max: 2, step: 0.01, group: "地质" },
    { path: "geoScore.red", label: "风险分红", unit: "", min: 0, max: 2, step: 0.01, group: "地质" },
    { path: "heat.yellow", label: "高温黄", unit: "℃", min: 20, max: 55, step: 0.1, group: "高温" },
    { path: "heat.orange", label: "高温橙", unit: "℃", min: 20, max: 55, step: 0.1, group: "高温" },
    { path: "heat.red", label: "高温红", unit: "℃", min: 20, max: 55, step: 0.1, group: "高温" }
  ];

  var scenarios = {
    demo: {
      name: "一处严重",
      note: "南湖城区暴雨和内涝到橙色，对应严重。北岭哨、南坡哨、中游大坝接近警戒。西峡哨和学海河口正常。",
      patch: {
        nl: { water: 1.68, rain24: 2, rainRate: 0.4, geoIndex: 20, soil: 40, humidity: 60, temp: 16, wind: 2.2, displacement: 0.3 },
        np: { water: 2.02, rain24: 2, rainRate: 0.4, geoIndex: 18, soil: 40, humidity: 60, temp: 18, wind: 2.0, displacement: 0.3 },
        db: { water: 154.8, rain24: 2, rainRate: 0.3, geoIndex: 12, soil: 40, humidity: 60, temp: 20, wind: 2.4 },
        xx: { water: 1.4, rain24: 2, rainRate: 0.3, geoIndex: 16, soil: 36, humidity: 55, temp: 17, wind: 2.0, displacement: 0.2 },
        dw: { water: 1.6, rain24: 1, rainRate: 0.2, geoIndex: 10, soil: 36, humidity: 55, temp: 21, wind: 3.2, pressure: 1013, windDir: 40 },
        cq: { water: 4.6, rain24: 6, rainRate: 45, geoIndex: 12, soil: 48, humidity: 72, temp: 26, wind: 3.0, pressure: 1008 }
      }
    },
    calm: {
      name: "平稳日",
      note: "各点都低于发布线，用来对照。",
      patch: {}
    },
    city: {
      name: "城区短时暴雨",
      note: "雨强集中在南湖城区，日雨量还不大，用来区分暴雨和上游洪水。",
      patch: {
        cq: { rainRate: 48, rain24: 26, humidity: 94, temp: 36, soil: 72, water: 5.4, pressure: 1004 }
      }
    },
    typhoon: {
      name: "台风靠近学海",
      note: "低气压和大风先出现在河口，内陆用距离衰减估计阵风。",
      patch: {
        dw: { pressure: 968, wind: 36, windDir: 140, rainRate: 12, rain24: 40, humidity: 96, soil: 64, water: 2.8, temp: 26 },
        cq: { pressure: 996, wind: 11, windDir: 130, rainRate: 6, rain24: 12, humidity: 88 },
        db: { pressure: 1004, wind: 6, windDir: 120 }
      }
    },
    flood: {
      name: "上游洪峰演进",
      note: "大雨在北岭、西峡和南坡，城区本地几乎没下雨。",
      patch: {
        nl: { rain24: 90, rainRate: 14, soil: 86, humidity: 91, water: 1.1, temp: 17 },
        xx: { rain24: 36, rainRate: 8, soil: 70, humidity: 86, water: 2.0, temp: 18 },
        np: { rain24: 48, rainRate: 6, soil: 66, humidity: 84, water: 1.2, temp: 19 },
        db: { rain24: 10, rainRate: 1.2, soil: 50, humidity: 74, water: 156.8 },
        cq: { rain24: 8, rainRate: 1.5, soil: 48, humidity: 70, water: 5.5, wind: 3 },
        dw: { rain24: 4, rainRate: 0.4, soil: 42, humidity: 66, water: 2.3 }
      }
    },
    slope: {
      name: "北岭边坡失稳",
      note: "北岭雨量、土壤湿度和裂缝位移一起升高，西峡沟谷雨强偏大。",
      patch: {
        nl: { rain24: 96, rainRate: 18, soil: 90, humidity: 92, displacement: 16, geoIndex: 82, water: 1.3, temp: 17 },
        xx: { rain24: 80, rainRate: 36, soil: 84, humidity: 90, displacement: 6, geoIndex: 70, water: 2.2 }
      }
    },
    compound: {
      name: "全流域叠加",
      note: "上游来水、城区暴雨和河口大风同时出现。",
      patch: {
        nl: { rain24: 70, rainRate: 12, soil: 78, humidity: 88, water: 1.2 },
        xx: { rain24: 40, rainRate: 10, soil: 66, humidity: 84, water: 2.1 },
        np: { rain24: 36, rainRate: 8, soil: 60, humidity: 80, water: 1.3 },
        db: { rain24: 16, soil: 52, humidity: 76, water: 157.4 },
        cq: { rain24: 42, rainRate: 32, soil: 68, humidity: 90, water: 6.2, temp: 33 },
        dw: { pressure: 984, wind: 28, windDir: 150, rain24: 55, rainRate: 18, humidity: 94, water: 3.3 }
      }
    }
  };

  var kindOptions = [
    { id: "mountain", label: "山岭" },
    { id: "gorge", label: "沟谷" },
    { id: "terrace", label: "坡地" },
    { id: "reservoir", label: "水库" },
    { id: "urban", label: "城区" },
    { id: "coast", label: "河口" }
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function applyScenario(id) {
    var scenario = scenarios[id] || scenarios.calm;
    var readings = createReadings();
    Object.keys(scenario.patch).forEach(function (sid) {
      if (!readings[sid]) return;
      Object.assign(readings[sid], scenario.patch[sid]);
    });
    return readings;
  }

  return {
    LEVELS: LEVELS,
    readingFields: readingFields,
    stageFields: stageFields,
    ruleFields: ruleFields,
    scenarios: scenarios,
    kindOptions: kindOptions,
    createStations: createStations,
    createReadings: createReadings,
    createRules: createRules,
    applyScenario: applyScenario,
    baseReading: baseReading,
    clone: clone
  };
});
