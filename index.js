#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "memories.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf-8");
}
function readMemories() {
  ensureDataFile();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")); }
  catch { return []; }
}
function writeMemories(arr) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), "utf-8");
}

const TOOLS = [
  { name: "mem_save", description: "保存一条记忆", inputSchema: { type: "object", properties: { content: { type: "string", description: "记忆内容" }, tags: { type: "array", items: { type: "string" }, description: "标签数组" } }, required: ["content"] } },
  { name: "mem_search", description: "搜索记忆", inputSchema: { type: "object", properties: { query: { type: "string" }, tags: { type: "array", items: { type: "string" } }, limit: { type: "number" } }, required: [] } },
  { name: "mem_context", description: "获取最近记忆", inputSchema: { type: "object", properties: { limit: { type: "number" } }, required: [] } },
  { name: "mem_update", description: "更新记忆", inputSchema: { type: "object", properties: { id: { type: "string" }, content: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["id"] } },
  { name: "mem_delete", description: "删除记忆", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "mem_stats", description: "统计", inputSchema: { type: "object", properties: {}, required: [] } },
];

function callTool(name, args) {
  const memories = readMemories();
  switch (name) {
    case "mem_save": {
      const mem = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), content: args.content, tags: args.tags || [], createdAt: new Date().toISOString() };
      memories.push(mem); writeMemories(memories); return mem;
    }
    case "mem_search": {
      let r = memories;
      if (args.query) { const q = args.query.toLowerCase(); r = r.filter(m => m.content.toLowerCase().includes(q) || m.tags.some(t => t.toLowerCase().includes(q))); }
      if (args.tags && args.tags.length) r = r.filter(m => args.tags.some(t => m.tags.includes(t)));
      r.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      return r.slice(0, args.limit || 10);
    }
    case "mem_context": {
      const s = [...memories].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      return s.slice(0, args.limit || 20);
    }
    case "mem_update": {
      const idx = memories.findIndex(m => m.id === args.id);
      if (idx === -1) throw new Error("记忆不存在");
      if (args.content !== undefined) memories[idx].content = args.content;
      if (args.tags !== undefined) memories[idx].tags = args.tags;
      memories[idx].updatedAt = new Date().toISOString();
      writeMemories(memories); return memories[idx];
    }
    case "mem_delete": {
      const idx = memories.findIndex(m => m.id === args.id);
      if (idx === -1) throw new Error("记忆不存在");
      const d = memories.splice(idx, 1)[0];
      writeMemories(memories); return { deleted: true, id: d.id };
    }
    case "mem_stats": {
      const tc = {};
      memories.forEach(m => m.tags.forEach(t => { tc[t] = (tc[t]||0)+1; }));
      return { total: memories.length, tagDistribution: tc, lastSaved: memories.length ? memories[memories.length-1].createdAt : null };
    }
    default: throw new Error("未知工具");
  }
}

const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", line => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    if (!msg.id) return;
    switch (msg.method) {
      case "initialize": process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:msg.id,result:{protocolVersion:"2024-11-05",capabilities:{tools:{}},serverInfo:{name:"shiro_memory",version:"1.0.0"}}})+"\n"); break;
      case "tools/list": process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:msg.id,result:{tools:TOOLS}})+"\n"); break;
      case "tools/call": {
        const r = callTool(msg.params.name, msg.params.arguments || {});
        process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:msg.id,result:{content:[{type:"text",text:JSON.stringify(r)}]}})+"\n");
        break;
      }
      default: process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:msg.id,error:{code:-32601,message:"不支持的方法"}})+"\n");
    }
  } catch(e) {}
});
rl.on("close", () => process.exit(0));
