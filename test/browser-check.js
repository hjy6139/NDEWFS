var http = require("http");
var fs = require("fs");
var path = require("path");

var outDir = path.join(__dirname, "preview");
fs.mkdirSync(outDir, { recursive: true });

function getJson(url) {
  return new Promise(function (resolve, reject) {
    http.get(url, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        try { resolve(JSON.parse(data)); }
        catch (err) { reject(new Error(data.slice(0, 200))); }
      });
    }).on("error", reject);
  });
}

function connect(url) {
  return new Promise(function (resolve, reject) {
    var ws = new WebSocket(url);
    var pending = new Map();
    var next = 1;
    ws.addEventListener("open", function () { resolve(api); });
    ws.addEventListener("error", function () { reject(new Error("devtools socket failed")); });
    ws.addEventListener("message", function (event) {
      var msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        var item = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) item.reject(new Error(JSON.stringify(msg.error)));
        else item.resolve(msg.result || {});
      }
    });
    var api = {
      send: function (method, params) {
        var id = next++;
        return new Promise(function (resolveSend, rejectSend) {
          pending.set(id, { resolve: resolveSend, reject: rejectSend });
          ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
        });
      },
      close: function () { ws.close(); }
    };
  });
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function main() {
  var version = null;
  var lastErr = null;
  for (var attempt = 0; attempt < 20; attempt += 1) {
    try {
      version = await getJson("http://127.0.0.1:9333/json/version");
      break;
    } catch (err) {
      lastErr = err;
      await sleep(300);
    }
  }
  if (!version) throw lastErr || new Error("devtools not ready");
  var browser = await connect(version.webSocketDebuggerUrl);
  var created = await browser.send("Target.createTarget", { url: "http://127.0.0.1:8765/" });
  var targets = await getJson("http://127.0.0.1:9333/json/list");
  var page = targets.filter(function (item) { return item.id === created.targetId; })[0];
  if (!page) throw new Error("page target missing");
  var cdp = await connect(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });
  await cdp.send("Page.navigate", { url: "http://127.0.0.1:8765/" });
  await sleep(1200);
  await cdp.send("Runtime.evaluate", {
    expression: "localStorage.clear()",
    returnByValue: true
  });
  await cdp.send("Page.navigate", { url: "http://127.0.0.1:8765/" });
  await sleep(1200);
  var calm = await cdp.send("Runtime.evaluate", {
    expression: "document.getElementById('bulletin').innerText",
    returnByValue: true
  });
  if (!calm.result || calm.result.value.indexOf("当前没有达到发布线的灾害") < 0) {
    throw new Error("calm bulletin unexpected: " + (calm.result && calm.result.value));
  }
  var flood = await cdp.send("Runtime.evaluate", {
    expression: "(async function () {" +
      "document.getElementById('scenario').value='flood';" +
      "document.getElementById('scenario').dispatchEvent(new Event('change',{bubbles:true}));" +
      "document.getElementById('load').click();" +
      "await new Promise(function (r) { setTimeout(r, 500); });" +
      "return document.getElementById('bulletin').innerText;" +
      "})()",
    awaitPromise: true,
    returnByValue: true
  });
  var floodText = flood.result.value || "";
  if (floodText.indexOf("洪涝") < 0 || floodText.indexOf("南湖城区") < 0 || floodText.indexOf("预测") < 0) {
    throw new Error("flood bulletin unexpected: " + floodText.slice(0, 300));
  }
  var mapText = await cdp.send("Runtime.evaluate", {
    expression: "document.getElementById('basin').textContent",
    returnByValue: true
  });
  if (!mapText.result.value || mapText.result.value.indexOf("南湖城区") < 0 || mapText.result.value.indexOf("学海河口") < 0) {
    throw new Error("map labels missing: " + mapText.result.value);
  }
  await shot(cdp, path.join(outDir, "desktop-flood.png"));
  await cdp.send("Runtime.evaluate", {
    expression: "document.getElementById('map-title').scrollIntoView()"
  });
  await sleep(300);
  await shot(cdp, path.join(outDir, "desktop-map.png"));
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await cdp.send("Runtime.evaluate", {
    expression: "window.scrollTo(0, 0)"
  });
  await sleep(400);
  await shot(cdp, path.join(outDir, "mobile-flood.png"));
  var invalid = await cdp.send("Runtime.evaluate", {
    expression: "(async function () {" +
      "document.querySelector('#switch button[data-id=\"nl\"]').click();" +
      "var input=document.getElementById('f-humidity');" +
      "input.value='140';" +
      "input.dispatchEvent(new Event('input',{bubbles:true}));" +
      "await new Promise(function (r) { setTimeout(r, 500); });" +
      "return document.getElementById('err-humidity').textContent;" +
      "})()",
    awaitPromise: true,
    returnByValue: true
  });
  if (!invalid.result.value || invalid.result.value.indexOf("湿度") < 0) {
    throw new Error("humidity error missing: " + (invalid.result && invalid.result.value));
  }
  console.log("browser checks passed");
  console.log(floodText.split("\n").slice(0, 6).join(" | "));
  cdp.close();
  browser.close();
}

function shot(cdp, file) {
  return cdp.send("Page.captureScreenshot", { format: "png" }).then(function (result) {
    fs.writeFileSync(file, Buffer.from(result.data, "base64"));
  });
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
