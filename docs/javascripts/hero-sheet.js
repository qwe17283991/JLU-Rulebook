/* JLU 線上英雄卡：依快速入門規則建卡、自動計算 PAX 與戰鬥數值，並可匯出／匯入 Excel。 */
(function () {
  "use strict";

  /* ───────── 規則資料（依本站規則書整理） ───────── */

  var TIERS = {
    D: { label: "D ─ 元年", val: 1, pax: 40, resolve: 12, defense: 15, atk: 1, die: "1d6", attrCap: 6, abilityCap: 2 },
    C: { label: "C ─ 地方英雄", val: 2, pax: 60, resolve: 15, defense: 18, atk: 2, die: "1d6", attrCap: 9, abilityCap: 2 }
  };

  var ATTRS = [["pot", "力量"], ["acc", "精準"], ["agi", "敏捷"], ["res", "耐力"], ["spi", "精神"], ["mind", "心智"]];

  var CAT = { super: "超能力", martial: "武術訓練", tech: "科技" };

  var ABILITIES = [
    { id: "animal", name: "動物擬態", cat: "super", cost: 3 },
    { id: "elastic", name: "彈性體", cat: "super", cost: 5 },
    { id: "elemental", name: "元素操控", cat: "super", cost: 5 },
    { id: "energy", name: "能量衝擊", cat: "super", cost: 4 },
    { id: "enhres", name: "強化耐力", cat: "super", cost: 3 },
    { id: "flight", name: "飛行", cat: "super", cost: 3 },
    { id: "forcefield", name: "力場", cat: "super", cost: 3 },
    { id: "speedforce", name: "神速力", cat: "super", cost: 12 },
    { id: "superstr", name: "超級神力", cat: "super", cost: 3 },
    { id: "superspeed", name: "超人速度", cat: "super", cost: 3 },
    { id: "teleport", name: "瞬間移動", cat: "super", cost: 5 },
    { id: "swordsman", name: "劍士", cat: "martial", cost: 6, techniques: {
      1: [["專精單兵器", 1], ["雙武器戰鬥", 1], ["突擊", 0], ["猛攻", 0], ["防禦架式", 0], ["精準攻擊", 0]],
      2: [["快速拔刀", 1], ["格擋反擊", 0], ["弧形斬", 0], ["亂擊風暴", 0]] } },
    { id: "martialmaster", name: "武術大師", cat: "martial", cost: 6, techniques: {
      1: [["特技格鬥家", 1], ["武術家", 1], ["街頭鬥士", 1], ["刺拳直拳", 1], ["高架防禦", 0], ["精準打擊", 0]],
      2: [["硬體功", 1], ["鋼拳", 0], ["特技踢擊", 0], ["疾掃腿", 0]] } },
    { id: "marksman", name: "神射手", cat: "martial", cost: 6, techniques: {
      1: [["愛用武器", 1], ["特殊彈藥", 0], ["跳彈射擊", 0]],
      2: [["直覺射手", 1], ["特殊彈藥（強化）", 0], ["彈幕射擊", 0]] } },
    { id: "exo", name: "外骨骼", cat: "tech", cost: 8,
      mods: ["力量系統", "整合武裝", "飛行推進器", "力場產生器", "複合裝甲", "感測套件", "密閉裝甲", "機載電腦"] },
    { id: "spheres", name: "科技球體", cat: "tech", cost: 4 }
  ];
  var ABIL = {};
  ABILITIES.forEach(function (a) { ABIL[a.id] = a; });
  var SUPER_IDS = ABILITIES.filter(function (a) { return a.cat === "super"; }).map(function (a) { return a.id; });
  var MARTIAL_IDS = ["swordsman", "martialmaster", "marksman"];
  var TECH_IDS = ["exo", "spheres"];

  var ORIGINS = {
    amazon: {
      name: "亞馬遜人",
      kit: ["superstr", "enhres", "superspeed"].concat(MARTIAL_IDS),
      kitText: "超級神力、強化耐力、超人速度、戰鬥訓練（本表視為武術訓練三類）",
      features: ["亞馬遜裝備：亞馬遜護甲（減傷＝位階＋1）、亞馬遜劍（攻擊 +2、傷害 +1）",
        "神授長生：獲得「不老」特質", "並肩姊妹：獲得「所屬勢力（天堂島）」特質"]
    },
    human: {
      name: "人類",
      kit: MARTIAL_IDS.concat(TECH_IDS),
      kitText: "武術訓練、科技",
      exclusive: true,
      features: ["只是凡人：不能購買能力組合以外的能力", "多才多藝：免費獲得一項知識與一項簡易特質（本表自動扣除）"]
    },
    kryptonian: {
      name: "氪星人",
      kit: ["energy", "enhres", "superstr", "superspeed", "flight"],
      kitText: "能量衝擊、刀槍不入、強化耐力、強化感官、超級神力、超級吐息、超人速度、飛行（刀槍不入、強化感官、超級吐息不在快速入門中）",
      features: ["氪星血脈：力量與減傷獲得等同位階的加值（本表自動計入）",
        "限制：暴露於綠氪石下失去所有能力並陷入易傷；不在黃太陽下會失去能力"],
      noExtraLimitation: true
    },
    meta: {
      name: "超人類",
      kit: SUPER_IDS,
      kitText: "不獲得免費能力；可用正常花費購買任何超能力",
      noFree: true,
      features: ["超能基因：所有超能力皆以正常花費購買（武術訓練、科技視為組合外，花費加倍）"]
    }
  };

  var ARCHETYPES = {
    champion: {
      name: "明日鬥士",
      abilities: ["鼓舞之姿", "絕不拋下任何人！", "經典英雄主義", "真理與正義"],
      limitation: "行為準則：打破準則時失去全部決心值",
      codes: ["以身作則", "凱撒的歸凱撒", "守護"]
    },
    darkknight: {
      name: "黑暗騎士",
      abilities: ["我即黑夜", "武術家", "萬用腰帶", "事前準備"],
      limitation: "腳踏實地：只有武術訓練與科技可以超過等級 1"
    },
    genius: {
      name: "天才",
      abilities: ["將死", "小事一樁！", "科技學識", "落落長學"],
      limitation: "想太多：先攻擲骰承受劣勢"
    },
    enraged: {
      name: "狂怒者",
      abilities: ["困獸之鬥", "破鏈者", "怒火中燒", "紙糊的世界"],
      limitation: "附帶損害：威脅排除前不能幫助平民"
    }
  };
  /* 會贈送一個能力等級的原型能力 */
  var ARCH_GRANTS = { "武術家": "martial", "科技學識": "tech" };

  var KNOWLEDGE = ["特技", "詭計", "科技", "戰略"];
  var TRAITS = ["出眾外貌", "通曉多語", "可靠人脈", "硬漢", "招牌台詞", "口袋小道具", "群眾之聲", "網紅", "秘密身分", "最佳拍檔", "所屬勢力"];
  var LIMIT_TYPES = ["弱點", "缺陷", "無效化", "衰弱", "禁制"];
  var GEAR = ["煙霧彈", "抓鉤槍", "拉近打擊", "治療噴劑", "追蹤器", "水下呼吸器", "易容面具", "電磁脈衝彈（E.M.P.）", "黏著彈", "個人全像投影", "密碼解序器", "催眠瓦斯"];
  var MATERIALS = { "": 0, "氪石": 5, "N 金屬": 3, "普羅米修金": 7 };

  var STORE_KEY = "jlu-hero-sheet-v1";

  function blank() {
    return {
      v: 1, name: "", player: "", identity: "", concept: "", tier: "D",
      origin: "", archetype: "", archAbilities: [], code: "",
      attrs: { pot: 0, acc: 0, agi: 0, res: 0, spi: 0, mind: 0 },
      abilities: [], knowledge: [], traits: [],
      limitation: { type: "", desc: "" },
      weapons: [], gear: [], extraResolve: 0, notes: ""
    };
  }

  var state = blank();
  var root = null;

  /* ───────── 工具 ───────── */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function sel(options, value, attrs) {
    return "<select " + attrs + ">" + options.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? " selected" : "") + ">" + esc(l) + "</option>";
    }).join("") + "</select>";
  }
  function has(arr, x) { return arr.indexOf(x) !== -1; }
  function fmt(n) { return (n >= 0 ? "+" : "") + n; }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 無痕模式等情況略過 */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) state = normalize(JSON.parse(raw));
    } catch (e) { state = blank(); }
  }
  function normalize(s) {
    var b = blank();
    if (!s || typeof s !== "object") return b;
    Object.keys(b).forEach(function (k) { if (s[k] !== undefined) b[k] = s[k]; });
    b.attrs = Object.assign(blank().attrs, s.attrs || {});
    b.limitation = Object.assign(blank().limitation, s.limitation || {});
    if (!TIERS[b.tier]) b.tier = "D";
    return b;
  }

  /* ───────── 規則計算 ───────── */

  function origin() { return ORIGINS[state.origin] || null; }
  function arch() { return ARCHETYPES[state.archetype] || null; }
  function tier() { return TIERS[state.tier]; }

  function inKit(id) {
    var o = origin();
    return !o || has(o.kit, id);
  }
  function archGrant() {
    /* 回傳原型贈送等級的類別（martial / tech）清單 */
    return state.archAbilities.map(function (n) { return ARCH_GRANTS[n]; }).filter(Boolean);
  }

  function abilityCost(row) {
    var a = ABIL[row.id];
    if (!a) return 0;
    var per = a.cost * (inKit(row.id) ? 1 : 2);
    var paid = row.level - (row.freeOrigin ? 1 : 0) - (row.freeArch ? 1 : 0);
    return Math.max(0, paid) * per;
  }
  function weaponCost(w) {
    return 1 + (w.kind === "ranged" && w.longRange ? 5 : 0) + (MATERIALS[w.material] || 0);
  }

  function costs() {
    var isHuman = state.origin === "human";
    var c = {
      attrs: ATTRS.reduce(function (s, a) { return s + (state.attrs[a[0]] / 3) * 5; }, 0),
      abilities: state.abilities.reduce(function (s, r) { return s + abilityCost(r); }, 0),
      knowledge: Math.max(0, state.knowledge.length - (isHuman ? 1 : 0)) * 4,
      traits: Math.max(0, state.traits.length - (isHuman ? 1 : 0)) * 4,
      equipment: state.weapons.reduce(function (s, w) { return s + weaponCost(w); }, 0) + state.gear.length,
      resolve: state.extraResolve * 2
    };
    c.total = c.attrs + c.abilities + c.knowledge + c.traits + c.equipment + c.resolve;
    c.budget = tier().pax;
    c.left = c.budget - c.total;
    return c;
  }

  function abilityLevel(id) {
    var r = state.abilities.filter(function (x) { return x.id === id; })[0];
    return r ? r.level : 0;
  }
  function exoHas(mod) {
    var r = state.abilities.filter(function (x) { return x.id === "exo"; })[0];
    return r && has(r.mods || [], mod) ? r.level : 0;
  }

  function derived() {
    var t = tier(), a = state.attrs;
    var potNotes = [];
    var pot = a.pot;
    if (state.origin === "kryptonian") { pot += t.val; potNotes.push("氪星血脈 +" + t.val); }
    var exoPow = exoHas("力量系統");
    if (exoPow) { var p = 10 + 3 * (exoPow - 1); potNotes.push("外骨骼力量系統：穿著時 " + fmt(p)); }

    var dr = [];
    if (state.origin === "kryptonian") dr.push(["氪星血脈", t.val]);
    if (state.origin === "amazon") dr.push(["亞馬遜護甲", t.val + 1]);
    if (has(state.traits, "硬漢")) dr.push(["硬漢", 2]);
    if (exoHas("複合裝甲")) dr.push(["外骨骼複合裝甲", 2]);

    var def = t.defense, defNotes = [];
    var ca = exoHas("複合裝甲");
    if (ca) { def += ca; defNotes.push("複合裝甲 +" + ca); }

    var atk = a.acc + t.atk, atkNotes = [];
    if (state.origin === "amazon") atkNotes.push("亞馬遜劍 +2 攻擊、+1 傷害");
    if (state.weapons.some(function (w) { return w.kind === "ranged"; })) atkNotes.push("遠程武器 +1 攻擊");
    if (state.weapons.some(function (w) { return w.kind === "melee"; })) atkNotes.push("近戰武器 +1 傷害");

    return {
      resolve: t.resolve + a.spi + state.extraResolve,
      defense: def, defNotes: defNotes,
      atk: atk, atkNotes: atkNotes,
      die: t.die, pot: pot, potNotes: potNotes,
      dr: dr, drTotal: dr.reduce(function (s, x) { return s + x[1]; }, 0),
      tierVal: t.val
    };
  }

  function validate(c) {
    var w = [], t = tier(), o = origin(), ar = arch();
    if (!state.origin) w.push("尚未選擇出身。");
    if (!state.archetype) w.push("尚未選擇原型。");
    if (c.left < 0) w.push("PAX 超支 " + (-c.left) + " 點。");

    ATTRS.forEach(function (x) {
      if (state.attrs[x[0]] > t.attrCap) w.push(x[1] + " " + fmt(state.attrs[x[0]]) + " 超過位階 " + state.tier + " 的屬性上限 " + fmt(t.attrCap) + "。");
    });

    if (ar) {
      if (state.archAbilities.length !== 2) w.push("原型能力需選擇 2 項（目前 " + state.archAbilities.length + " 項）。");
      if (ar.codes && !state.code) w.push("明日鬥士需選擇一項行為準則。");
    }

    var atCap = state.abilities.filter(function (r) { return r.level >= t.abilityCap; });
    if (atCap.length > 1) w.push("只有一項能力可以達到等級 " + t.abilityCap + "（目前 " + atCap.length + " 項）。");
    var seen = {};
    var freeOrigin = 0, freeArch = { martial: 0, tech: 0 };
    state.abilities.forEach(function (r) {
      var a = ABIL[r.id];
      if (!a) { w.push("有一列能力尚未選擇。"); return; }
      if (seen[r.id]) w.push(a.name + " 重複選取。");
      seen[r.id] = 1;
      if (r.level > t.abilityCap) w.push(a.name + " 超過能力上限等級 " + t.abilityCap + "。");
      if (o && o.exclusive && !inKit(r.id)) w.push("人類不能購買能力組合以外的能力：" + a.name + "。");
      if (state.archetype === "darkknight" && a.cat === "super" && r.level > 1) w.push("黑暗騎士只有武術訓練與科技能超過等級 1：" + a.name + "。");
      if (r.freeOrigin) freeOrigin++;
      if (r.freeArch) freeArch[a.cat] = (freeArch[a.cat] || 0) + 1;
      if (a.techniques) {
        var tech = r.techniques || [];
        var need = r.level + 1;
        if (tech.length !== need) w.push(a.name + " 等級 " + r.level + " 應有 " + need + " 項技法（目前 " + tech.length + " 項）。");
        if (r.level === 1) {
          var passive = a.techniques[1].filter(function (x) { return x[1] && has(tech, x[0]); }).length;
          if (passive > 1) w.push(a.name + " 等級 1 的兩項技法中最多只能有一項被動技法。");
        }
      }
      if (a.mods) {
        var needM = r.level + 1, got = (r.mods || []).length;
        if (got !== needM) w.push("外骨骼等級 " + r.level + " 應有 " + needM + " 項改裝（目前 " + got + " 項）。");
      }
    });
    if (seen.speedforce && seen.superspeed) w.push("神速力與超人速度不能同時擁有。");
    if (freeOrigin > 1) w.push("出身免費等級只能用在一項能力上。");
    archGrant().forEach(function (cat) {
      if (!freeArch[cat]) w.push("原型能力「" + (cat === "martial" ? "武術家" : "科技學識") + "」贈送的" + CAT[cat] + "等級尚未指定。");
    });
    if (o && !o.noExtraLimitation && !state.limitation.desc.trim()) w.push("需要再為英雄選擇一項限制。");
    return w;
  }

  /* ───────── 介面 ───────── */

  function abilityOptions(current) {
    var o = origin();
    var opts = [["", "── 選擇能力 ──"]];
    ["super", "martial", "tech"].forEach(function (cat) {
      ABILITIES.filter(function (a) { return a.cat === cat; }).forEach(function (a) {
        var tag = "";
        if (o) tag = inKit(a.id) ? "" : (o.exclusive ? "（不可購買）" : "（組合外 ×2）");
        opts.push([a.id, CAT[cat] + "｜" + a.name + "　" + a.cost + " PAX/級" + tag]);
      });
    });
    return sel(opts, current, 'data-k="id"');
  }

  function abilityRow(r, i) {
    var a = ABIL[r.id], o = origin();
    var html = '<div class="hs-ability" data-i="' + i + '"><div class="hs-row">' +
      abilityOptions(r.id) +
      '<label>等級 ' + sel([1, 2], r.level, 'data-k="level"') + "</label>";
    if (a && o && !o.noFree && inKit(r.id)) {
      html += '<label class="hs-check"><input type="checkbox" data-k="freeOrigin"' + (r.freeOrigin ? " checked" : "") + "> 出身免費等級</label>";
    }
    if (a && has(archGrant(), a.cat)) {
      html += '<label class="hs-check"><input type="checkbox" data-k="freeArch"' + (r.freeArch ? " checked" : "") + "> 原型贈送等級</label>";
    }
    html += '<input type="text" data-k="note" placeholder="備註（例如元素種類）" value="' + esc(r.note) + '">' +
      '<span class="hs-cost">' + abilityCost(r) + " PAX</span>" +
      '<button type="button" class="hs-del" data-act="del-ability" title="刪除">✕</button></div>';
    if (a && a.techniques) {
      html += '<div class="hs-sub"><span>技法：</span>';
      [1, 2].forEach(function (g) {
        a.techniques[g].forEach(function (t) {
          var dis = g > r.level ? " disabled" : "";
          html += '<label class="hs-check"><input type="checkbox" data-k="techniques" value="' + esc(t[0]) + '"' +
            (has(r.techniques || [], t[0]) ? " checked" : "") + dis + "> " + esc(t[0]) +
            '<small>（等級 ' + g + (t[1] ? "・被動" : "") + "）</small></label>";
        });
      });
      html += "</div>";
    }
    if (a && a.mods) {
      html += '<div class="hs-sub"><span>改裝：</span>' + a.mods.map(function (m) {
        return '<label class="hs-check"><input type="checkbox" data-k="mods" value="' + esc(m) + '"' + (has(r.mods || [], m) ? " checked" : "") + "> " + esc(m) + "</label>";
      }).join("") + "</div>";
    }
    return html + "</div>";
  }

  function checks(list, chosen, key, extra) {
    return list.map(function (x) {
      return '<label class="hs-check"><input type="checkbox" data-list="' + key + '" value="' + esc(x) + '"' +
        (has(chosen, x) ? " checked" : "") + (extra ? extra(x) : "") + "> " + esc(x) + "</label>";
    }).join("");
  }

  function render() {
    if (!root) return;
    var t = tier(), o = origin(), ar = arch(), c = costs(), d = derived(), warns = validate(c);
    var attrOpts = [];
    for (var v = 0; v <= Math.max(t.attrCap, 9); v += 3) attrOpts.push([v, fmt(v) + "（" + (v / 3) * 5 + " PAX）"]);

    var h = "";

    /* PAX 摘要 */
    h += '<div class="hs-summary' + (c.left < 0 ? " hs-over" : "") + '">' +
      '<div class="hs-pax"><b>PAX</b> 已用 ' + c.total + " / " + c.budget + '　<b class="hs-left">剩餘 ' + c.left + "</b></div>" +
      '<div class="hs-break">屬性 ' + c.attrs + "・能力 " + c.abilities + "・知識 " + c.knowledge + "・特質 " + c.traits + "・裝備 " + c.equipment + "・決心值 " + c.resolve + "</div>" +
      '<div class="hs-actions">' +
      '<button type="button" class="md-button md-button--primary" data-act="export">匯出 Excel</button>' +
      '<label class="md-button">匯入 Excel<input type="file" accept=".xlsx" data-act="import" hidden></label>' +
      '<button type="button" class="md-button" data-act="reset">清空重填</button></div></div>';

    h += '<div class="hs-warn">' + (warns.length
      ? "<b>規則檢查</b><ul>" + warns.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"
      : "<b>規則檢查</b>：目前沒有發現問題。") + "</div>";

    /* 1 基本資料 */
    h += '<section class="hs-card"><h2>一、基本資料與位階</h2><div class="hs-grid">' +
      '<label>英雄名稱<input type="text" data-f="name" value="' + esc(state.name) + '"></label>' +
      '<label>玩家<input type="text" data-f="player" value="' + esc(state.player) + '"></label>' +
      '<label>平民身分<input type="text" data-f="identity" value="' + esc(state.identity) + '"></label>' +
      '<label>位階' + sel(Object.keys(TIERS).map(function (k) { return [k, TIERS[k].label]; }), state.tier, 'data-f="tier"') + "</label>" +
      '<label class="hs-wide">概念與外觀<input type="text" data-f="concept" value="' + esc(state.concept) + '"></label>' +
      "</div></section>";

    /* 2 出身 */
    h += '<section class="hs-card"><h2>二、出身</h2>' +
      "<label>出身" + sel([["", "── 選擇出身 ──"]].concat(Object.keys(ORIGINS).map(function (k) { return [k, ORIGINS[k].name]; })), state.origin, 'data-f="origin"') + "</label>";
    if (o) {
      h += '<p class="hs-note"><b>能力組合：</b>' + esc(o.kitText) + "</p><ul class=\"hs-list\">" +
        o.features.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    }
    h += '<p class="hs-note"><a href="../character/origins/">出身規則 →</a></p></section>';

    /* 3 原型 */
    h += '<section class="hs-card"><h2>三、原型</h2>' +
      "<label>原型" + sel([["", "── 選擇原型 ──"]].concat(Object.keys(ARCHETYPES).map(function (k) { return [k, ARCHETYPES[k].name]; })), state.archetype, 'data-f="archetype"') + "</label>";
    if (ar) {
      h += '<p class="hs-note">選擇 2 項原型能力：</p><div class="hs-checks">' + checks(ar.abilities, state.archAbilities, "archAbilities") + "</div>";
      if (ar.codes) h += "<label>行為準則" + sel([["", "── 選擇 ──"]].concat(ar.codes), state.code, 'data-f="code"') + "</label>";
      h += '<p class="hs-note"><b>原型限制：</b>' + esc(ar.limitation) + "</p>";
    }
    h += '<p class="hs-note"><a href="../character/archetypes/">原型規則 →</a></p></section>';

    /* 4 屬性 */
    h += '<section class="hs-card"><h2>四、屬性</h2><p class="hs-note">每 +3 花費 5 PAX；位階 ' + state.tier + " 以 PAX 購買的上限為 " + fmt(t.attrCap) + "。</p><div class=\"hs-grid hs-attrs\">";
    ATTRS.forEach(function (x) {
      var extra = x[0] === "pot" && d.potNotes.length ? '<small>' + esc(d.potNotes.join("；")) + "</small>" : "";
      h += "<label>" + x[1] + sel(attrOpts, state.attrs[x[0]], 'data-attr="' + x[0] + '"') + extra + "</label>";
    });
    h += "</div></section>";

    /* 5 能力 */
    h += '<section class="hs-card"><h2>五、能力</h2><p class="hs-note">位階 ' + state.tier + " 的能力上限為等級 " + t.abilityCap +
      "，且只有一項能力能達到上限。組合外能力每級花費加倍。</p>" +
      state.abilities.map(abilityRow).join("") +
      '<button type="button" class="md-button" data-act="add-ability">＋ 新增能力</button>' +
      '<p class="hs-note"><a href="../abilities/overview/">能力總則 →</a></p></section>';

    /* 6 知識、特質、限制 */
    var isHuman = state.origin === "human";
    h += '<section class="hs-card"><h2>六、知識、特質與限制</h2>' +
      "<h3>知識（每項 4 PAX" + (isHuman ? "，人類免費一項" : "") + "）</h3><div class=\"hs-checks\">" + checks(KNOWLEDGE, state.knowledge, "knowledge") + "</div>" +
      "<h3>簡易特質（每項 4 PAX" + (isHuman ? "，人類免費一項" : "") + "）</h3><div class=\"hs-checks\">" + checks(TRAITS, state.traits, "traits") + "</div>" +
      "<h3>限制</h3>" +
      (ar ? '<p class="hs-note">原型限制：' + esc(ar.limitation) + "</p>" : "") +
      (o && o.noExtraLimitation ? '<p class="hs-note">氪星人的出身已附帶限制，額外限制可不填。</p>' : "") +
      '<div class="hs-grid"><label>限制類型' + sel([["", "── 選擇 ──"]].concat(LIMIT_TYPES), state.limitation.type, 'data-lim="type"') + "</label>" +
      '<label class="hs-wide">限制內容<input type="text" data-lim="desc" value="' + esc(state.limitation.desc) + '" placeholder="例如：對魔法具備弱點"></label></div>' +
      '<p class="hs-note"><a href="../traits/knowledge/">知識</a>・<a href="../traits/qualities/">特質</a>・<a href="../traits/limitations/">限制</a> 規則 →</p></section>';

    /* 7 裝備 */
    h += '<section class="hs-card"><h2>七、裝備</h2><h3>武器（每件 1 PAX）</h3>';
    state.weapons.forEach(function (w, i) {
      h += '<div class="hs-row hs-weapon" data-w="' + i + '">' +
        sel([["melee", "近戰武器（+1 傷害）"], ["ranged", "遠程武器（+1 攻擊）"]], w.kind, 'data-wk="kind"') +
        '<input type="text" data-wk="name" placeholder="武器名稱" value="' + esc(w.name) + '">' +
        sel(Object.keys(MATERIALS).map(function (m) { return [m, m ? m + "（" + MATERIALS[m] + " PAX）" : "一般材質"]; }), w.material, 'data-wk="material"') +
        (w.kind === "ranged" ? '<label class="hs-check"><input type="checkbox" data-wk="longRange"' + (w.longRange ? " checked" : "") + "> 射程提升至遠距（5 PAX）</label>" : "") +
        '<span class="hs-cost">' + weaponCost(w) + " PAX</span>" +
        '<button type="button" class="hs-del" data-act="del-weapon" title="刪除">✕</button></div>';
    });
    h += '<button type="button" class="md-button" data-act="add-weapon">＋ 新增武器</button>' +
      "<h3>隨身道具（每件 1 PAX，每期 3 次使用）</h3><div class=\"hs-checks\">" + checks(GEAR, state.gear, "gear") + "</div>" +
      '<h3>額外決心值（每點 2 PAX）</h3><input type="number" min="0" max="30" data-f="extraResolve" value="' + state.extraResolve + '">' +
      '<p class="hs-note"><a href="../abilities/equipment/">裝備規則 →</a></p></section>';

    /* 8 戰鬥數值 */
    h += '<section class="hs-card"><h2>八、戰鬥數值</h2><div class="hs-stats">' +
      stat("決心值", d.resolve, "位階 " + t.resolve + " ＋ 精神 " + fmt(state.attrs.spi) + (state.extraResolve ? " ＋ 購買 " + state.extraResolve : "")) +
      stat("防禦", d.defense, "位階基礎 " + t.defense + (d.defNotes.length ? "；" + d.defNotes.join("；") : "") + "；主動防禦可加敏捷或耐力") +
      stat("攻擊", fmt(d.atk), "1d20 ＋ 精準 " + fmt(state.attrs.acc) + " ＋ 位階 " + fmt(t.atk) + (d.atkNotes.length ? "；" + d.atkNotes.join("；") : "")) +
      stat("傷害骰", d.die, "位階傷害骰 ＋ 所用屬性") +
      stat("減傷", d.drTotal, d.dr.length ? d.dr.map(function (x) { return x[0] + " " + x[1]; }).join("；") : "無") +
      stat("力量（含加值）", fmt(d.pot), d.potNotes.join("；") || "—") +
      stat("位階數值", d.tierVal, "能力中「等同位階」的加值") +
      stat("傷勢格", 5, "擦傷 → … → 敗北") +
      "</div></section>";

    h += '<section class="hs-card"><h2>九、備註</h2><textarea rows="4" data-f="notes" placeholder="背景故事、招牌台詞、人際關係⋯⋯">' + esc(state.notes) + "</textarea></section>";

    root.innerHTML = h;
  }

  function stat(label, value, note) {
    return '<div class="hs-stat"><span>' + esc(label) + "</span><b>" + esc(value) + "</b><small>" + esc(note) + "</small></div>";
  }

  /* ───────── 事件 ───────── */

  function toggle(arr, v, on) {
    var i = arr.indexOf(v);
    if (on && i === -1) arr.push(v);
    if (!on && i !== -1) arr.splice(i, 1);
  }

  function onChange(e) {
    var el = e.target, ds = el.dataset;
    if (ds.act === "import") { importExcel(el.files && el.files[0]); el.value = ""; return; }
    if (ds.f) {
      var v = el.value;
      if (ds.f === "extraResolve") v = Math.max(0, parseInt(v, 10) || 0);
      state[ds.f] = v;
      if (ds.f === "archetype") { state.archAbilities = []; state.code = ""; clearArchFree(); }
      if (ds.f === "origin") state.abilities.forEach(function (r) { if (!inKit(r.id) || (origin() && origin().noFree)) r.freeOrigin = false; });
    } else if (ds.attr) {
      state.attrs[ds.attr] = parseInt(el.value, 10) || 0;
    } else if (ds.list) {
      toggle(state[ds.list], el.value, el.checked);
      if (ds.list === "archAbilities") clearArchFree();
    } else if (ds.lim) {
      state.limitation[ds.lim] = el.value;
    } else if (ds.wk) {
      var w = state.weapons[+el.closest("[data-w]").dataset.w];
      if (ds.wk === "longRange") w.longRange = el.checked;
      else w[ds.wk] = el.value;
      if (w.kind !== "ranged") w.longRange = false;
    } else if (ds.k) {
      var r = state.abilities[+el.closest("[data-i]").dataset.i];
      if (ds.k === "id") { r.id = el.value; r.techniques = []; r.mods = []; r.freeOrigin = false; r.freeArch = false; }
      else if (ds.k === "level") { r.level = parseInt(el.value, 10) || 1; trimTechniques(r); }
      else if (ds.k === "freeOrigin" || ds.k === "freeArch") r[ds.k] = el.checked;
      else if (ds.k === "techniques" || ds.k === "mods") { r[ds.k] = r[ds.k] || []; toggle(r[ds.k], el.value, el.checked); }
      else r[ds.k] = el.value;
    } else return;
    save();
    render();
  }

  function onInput(e) {
    /* 文字欄位邊打邊存，但不重繪，避免游標跳走 */
    var el = e.target, ds = el.dataset;
    if (el.type !== "text" && el.tagName !== "TEXTAREA") return;
    if (ds.f) state[ds.f] = el.value;
    else if (ds.lim) state.limitation[ds.lim] = el.value;
    else if (ds.wk) state.weapons[+el.closest("[data-w]").dataset.w][ds.wk] = el.value;
    else if (ds.k) state.abilities[+el.closest("[data-i]").dataset.i][ds.k] = el.value;
    save();
  }

  function clearArchFree() {
    var g = archGrant();
    state.abilities.forEach(function (r) { var a = ABIL[r.id]; if (r.freeArch && (!a || !has(g, a.cat))) r.freeArch = false; });
  }
  function trimTechniques(r) {
    var a = ABIL[r.id];
    if (a && a.techniques && r.level < 2) {
      var lv2 = a.techniques[2].map(function (t) { return t[0]; });
      r.techniques = (r.techniques || []).filter(function (t) { return !has(lv2, t); });
    }
  }

  function onClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn || btn.tagName === "INPUT") return;
    var act = btn.dataset.act;
    if (act === "add-ability") state.abilities.push({ id: "", level: 1, freeOrigin: false, freeArch: false, techniques: [], mods: [], note: "" });
    else if (act === "del-ability") state.abilities.splice(+btn.closest("[data-i]").dataset.i, 1);
    else if (act === "add-weapon") state.weapons.push({ kind: "melee", name: "", material: "", longRange: false });
    else if (act === "del-weapon") state.weapons.splice(+btn.closest("[data-w]").dataset.w, 1);
    else if (act === "reset") { if (!confirm("確定要清空整張英雄卡嗎？")) return; state = blank(); }
    else if (act === "export") { exportExcel(); return; }
    else return;
    save();
    render();
  }

  /* ───────── Excel ───────── */

  var XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  function withXLSX(cb) {
    if (window.XLSX) return cb(window.XLSX);
    var s = document.createElement("script");
    s.src = XLSX_URL;
    s.onload = function () { cb(window.XLSX); };
    s.onerror = function () { alert("無法載入 Excel 元件，請確認網路連線後再試一次。"); };
    document.head.appendChild(s);
  }

  function sheetRows() {
    var t = tier(), o = origin(), ar = arch(), c = costs(), d = derived();
    var R = [];
    R.push(["JLU 英雄卡", "", "", "", "", "jlurulebook.com"]);
    R.push([]);
    R.push(["英雄名稱", state.name], ["玩家", state.player], ["平民身分", state.identity], ["概念與外觀", state.concept]);
    R.push(["位階", t.label], ["出身", o ? o.name : ""], ["原型", ar ? ar.name : ""]);
    R.push(["原型能力", state.archAbilities.join("、")]);
    if (ar && ar.codes) R.push(["行為準則", state.code]);
    R.push([]);
    R.push(["屬性", "數值", "花費 PAX"]);
    ATTRS.forEach(function (x) {
      var v = state.attrs[x[0]];
      R.push([x[1], x[0] === "pot" && d.pot !== v ? fmt(v) + "（含加值 " + fmt(d.pot) + "）" : fmt(v), (v / 3) * 5]);
    });
    R.push([]);
    R.push(["戰鬥數值", "數值", "說明"]);
    R.push(["決心值", d.resolve, "位階 " + t.resolve + " ＋ 精神 ＋ 購買 " + state.extraResolve]);
    R.push(["防禦", d.defense, d.defNotes.join("；")]);
    R.push(["攻擊", fmt(d.atk), "1d20 ＋ 精準 ＋ 位階；" + d.atkNotes.join("；")]);
    R.push(["傷害骰", d.die, "＋ 所用屬性"]);
    R.push(["減傷", d.drTotal, d.dr.map(function (x) { return x[0] + " " + x[1]; }).join("；")]);
    R.push(["傷勢格", 5, ""]);
    R.push([]);
    R.push(["能力", "類別", "等級", "花費 PAX", "技法／改裝", "備註"]);
    state.abilities.forEach(function (r) {
      var a = ABIL[r.id];
      if (!a) return;
      var free = [];
      if (r.freeOrigin) free.push("出身免費 1 級");
      if (r.freeArch) free.push("原型贈送 1 級");
      if (!inKit(r.id)) free.push("組合外 ×2");
      R.push([a.name, CAT[a.cat], r.level, abilityCost(r), (r.techniques || []).concat(r.mods || []).join("、"),
        [r.note].concat(free).filter(Boolean).join("；")]);
    });
    R.push([]);
    R.push(["知識", state.knowledge.join("、")]);
    R.push(["特質", state.traits.join("、")]);
    if (o) R.push(["出身特色", o.features.join("；")]);
    R.push(["原型限制", ar ? ar.limitation : ""]);
    R.push(["限制", [state.limitation.type, state.limitation.desc].filter(Boolean).join("：")]);
    R.push([]);
    R.push(["武器", "類型", "材質", "花費 PAX"]);
    state.weapons.forEach(function (w) {
      R.push([w.name || "（未命名）", (w.kind === "ranged" ? "遠程" : "近戰") + (w.longRange ? "・遠距" : ""), w.material || "一般", weaponCost(w)]);
    });
    R.push(["隨身道具", state.gear.join("、")]);
    R.push([]);
    R.push(["PAX 預算", c.budget], ["PAX 已用", c.total], ["PAX 剩餘", c.left]);
    R.push(["花費明細", "屬性 " + c.attrs + "・能力 " + c.abilities + "・知識 " + c.knowledge + "・特質 " + c.traits + "・裝備 " + c.equipment + "・決心值 " + c.resolve]);
    var warns = validate(c);
    if (warns.length) R.push(["規則檢查", warns.join("\n")]);
    R.push([]);
    R.push(["備註", state.notes]);
    return R;
  }

  function exportExcel() {
    withXLSX(function (X) {
      var wb = X.utils.book_new();
      var ws = X.utils.aoa_to_sheet(sheetRows());
      ws["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 30 }];
      X.utils.book_append_sheet(wb, ws, "英雄卡");
      var data = X.utils.aoa_to_sheet([["此工作表供網站重新匯入使用，請勿修改"], [JSON.stringify(state)]]);
      X.utils.book_append_sheet(wb, data, "_data");
      var name = (state.name || "英雄卡").replace(/[\\/:*?"<>|]/g, "_");
      X.writeFile(wb, "JLU_" + name + ".xlsx");
    });
  }

  function importExcel(file) {
    if (!file) return;
    withXLSX(function (X) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var wb = X.read(new Uint8Array(reader.result), { type: "array" });
          var ws = wb.Sheets._data;
          if (!ws || !ws.A2) throw new Error("no data");
          state = normalize(JSON.parse(ws.A2.v));
          save();
          render();
        } catch (err) {
          alert("無法讀取這個檔案。只能匯入由本頁匯出的英雄卡 Excel。");
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /* ───────── 啟動（相容 Material 即時載入） ───────── */

  function init() {
    var el = document.getElementById("hero-sheet");
    if (!el || el.dataset.ready) return;
    el.dataset.ready = "1";
    root = el;
    load();
    root.addEventListener("change", onChange);
    root.addEventListener("input", onInput);
    root.addEventListener("click", onClick);
    render();
  }

  if (window.document$ && window.document$.subscribe) window.document$.subscribe(init);
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
