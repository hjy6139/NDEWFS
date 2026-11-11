var data = require("../js/data.js");
var engine = require("../js/engine.js");

var failed = 0;

function assert(cond, message) {
  if (!cond) {
    failed += 1;
    console.error("FAIL " + message);
  }
}

function run(scenarioId, rules) {
  var stations = data.createStations();
  var readings = data.applyScenario(scenarioId);
  return engine.evaluate(stations, readings, rules || data.createRules(), data.readingFields);
}

function has(result, stationId, type) {
  return result.warnings.filter(function (w) {
    return w.stationId === stationId && w.type === type;
  });
}

var demo = run("demo");
assert(demo.byStation.cq.level === "orange", "南湖城区演示应为橙色严重，实际 " + demo.byStation.cq.level);
assert(demo.warnings.filter(function (w) { return w.stationId !== "cq"; }).length === 0, "演示只应有南湖城区预警");
["xx", "dw"].forEach(function (id) {
  assert(demo.byStation[id].level === "none", id + " 应为正常");
  assert(!demo.approaches.some(function (item) { return item.stationId === id; }), id + " 不应出现在临界名单");
});
["nl", "np", "db"].forEach(function (id) {
  assert(demo.byStation[id].level === "none", id + " 临界点不应已发布");
  assert(demo.approaches.some(function (item) { return item.stationId === id; }), id + " 应在临界名单");
});
demo.approaches.forEach(function (item) {
  assert(item.ratio >= 0.7 && item.ratio <= 1, item.stationId + " 临界比应在 70% 到 100%，实际 " + item.ratio);
});

var calm = run("calm");
assert(calm.warnings.length === 0, "平稳日不应有预警，实际 " + calm.warnings.length + "：" + calm.warnings.map(function (w) { return w.stationId + w.type + w.level; }).join(","));
assert(calm.errors.length === 0, "平稳日不应有输入错误");

var city = run("city");
var cityRain = has(city, "cq", "暴雨");
var cityLog = has(city, "cq", "城市内涝");
var cityHeat = has(city, "cq", "高温");
assert(cityRain.length === 1 && cityRain[0].level === "orange", "城区暴雨应为橙色，实际 " + JSON.stringify(cityRain[0] && cityRain[0].level));
assert(cityLog.length === 1, "城区应有内涝");
assert(cityHeat.length === 1 && cityHeat[0].level === "yellow", "36℃ 应为高温黄色");
assert(cityRain[0].nature === "实况", "暴雨性质应为实况");
assert(city.warnings.filter(function (w) { return w.type === "暴雨" && w.stationId !== "cq"; }).length === 0, "短时暴雨不应改写到其他点");

var wind = run("typhoon");
var dwTy = has(wind, "dw", "台风");
var cqGale = has(wind, "cq", "大风");
assert(dwTy.length === 1 && (dwTy[0].level === "orange" || dwTy[0].level === "red"), "学海应为台风橙或红，实际 " + (dwTy[0] && dwTy[0].level));
assert(dwTy[0] && dwTy[0].location.indexOf("学海河口") >= 0, "台风地点应写明学海");
assert(cqGale.length === 1 && cqGale[0].nature === "预测", "城区大风应为预测，实际 " + JSON.stringify(cqGale[0]));
assert(cqGale[0] && cqGale[0].level === "yellow", "城区预测阵风应为黄色，实际 " + (cqGale[0] && cqGale[0].level) + " gust " + wind.details.cq.predictedGust);
var nlGale = has(wind, "nl", "大风");
assert(nlGale.length === 0, "北岭不应被台风阵风命中");

var flood = run("flood");
var cqFlood = has(flood, "cq", "洪涝");
var nlFlood = has(flood, "nl", "洪涝");
var dbFlood = has(flood, "db", "洪涝");
console.log("flood waters", {
  nl: flood.details.nl && flood.details.nl.predictedWater,
  xx: flood.details.xx && flood.details.xx.predictedWater,
  np: flood.details.np && flood.details.np.predictedWater,
  db: flood.details.db && flood.details.db.predictedWater,
  cq: flood.details.cq && flood.details.cq.predictedWater,
  dw: flood.details.dw && flood.details.dw.predictedWater
});
console.log("flood hits", flood.warnings.filter(function (w) { return w.type === "洪涝"; }).map(function (w) {
  return w.stationId + " " + w.level + " " + w.nature;
}));
assert(cqFlood.length === 1 && cqFlood[0].nature === "预测", "城区洪涝应为预测");
assert(cqFlood[0] && (cqFlood[0].level === "orange" || cqFlood[0].level === "red"), "城区洪涝至少橙色，实际 " + (cqFlood[0] && cqFlood[0].level));
assert(nlFlood.length === 1, "北岭本地也应有洪涝响应");
assert(dbFlood.length === 0, "大坝库容应挡住本次来水，不发布洪涝");
assert(cqFlood[0].forecast.indexOf("上游") >= 0, "城区预警应说明上游来水");

var rulesShort = data.createRules();
rulesShort.horizonHours = 2;
var floodShort = run("flood", rulesShort);
assert(floodShort.details.cq.predictedWater < flood.details.cq.predictedWater, "缩短预见期后城区预测水位应下降");

var slope = run("slope");
var nlGeo = has(slope, "nl", "地质灾害");
var xxGeo = has(slope, "xx", "地质灾害");
assert(nlGeo.length === 1 && nlGeo[0].level === "red" && nlGeo[0].subtype === "滑坡", "北岭应为红色滑坡，实际 " + JSON.stringify(nlGeo[0] && { level: nlGeo[0].level, subtype: nlGeo[0].subtype }));
assert(xxGeo.length === 1 && xxGeo[0].subtype === "泥石流", "西峡应为泥石流");
assert(has(slope, "cq", "地质灾害").length === 0, "城区低易发指数不应发布地质预警");

var rulesLoose = data.createRules();
rulesLoose.rainRate.orange = 80;
rulesLoose.rainRate.red = 120;
var cityLoose = run("city", rulesLoose);
assert(has(cityLoose, "cq", "暴雨")[0].level === "yellow", "抬高橙色雨强后暴雨应降为黄色");

var badRules = data.createRules();
badRules.rainRate.blue = 80;
badRules.rainRate.yellow = 10;
var blocked = run("city", badRules);
assert(blocked.blocked && blocked.warnings.length === 0, "颠倒的阈值应拦截发布");

var stations = data.createStations();
var readings = data.applyScenario("city");
readings.cq.humidity = 140;
var invalid = engine.evaluate(stations, readings, data.createRules(), data.readingFields);
assert(invalid.errors.length === 1, "非法湿度应报错");
assert(has(invalid, "cq", "暴雨").length === 0, "非法输入的点不应出预警");

var off = data.createStations();
off.forEach(function (s) { if (s.id === "dw") s.enabled = false; });
var noCoast = engine.evaluate(off, data.applyScenario("typhoon"), data.createRules(), data.readingFields);
assert(has(noCoast, "dw", "台风").length === 0, "停用河口后不应再以学海为台风位置");

var text = engine.bulletinText(flood, "2026-11-08 10:00:00");
assert(text.indexOf("南湖城区") >= 0 && text.indexOf("教学模拟") >= 0, "预警单应包含地点和模拟声明");

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("all passed");
console.log("typhoon gust cq/db/nl", wind.details.cq.predictedGust, wind.details.db.predictedGust, wind.details.nl.predictedGust);
console.log("top flood", flood.warnings[0].type, flood.warnings[0].level, flood.warnings[0].location, flood.warnings[0].nature);
console.log("top city", city.warnings[0].type, city.warnings[0].level);
console.log("top wind", wind.warnings[0].type, wind.warnings[0].subtype, wind.warnings[0].level, wind.warnings[0].location);
