/* The dated build roadmap, parsed from the designed HQ page that is its
 * source of record. Shared by the Roadmap panel and This Week so the two
 * can never disagree about what a phase is or when it runs. */
import { readFile } from "node:fs/promises";

const decode = value => String(value || "").replace(/\\"/g, '"').replace(/\\n/g, "\n");

export async function sourceRoadmap() {
  const html = await readFile(new URL("../public/hq/passport/roadmap.html", import.meta.url), "utf8");
  const block = html.match(/var PHASES = \[([\s\S]*?)\n  \];/)?.[1] || "";
  const phases = [];
  const phasePattern = /\{ id:"([^"]+)", num:"([^"]+)", name:"((?:\\.|[^"])*)", when:"((?:\\.|[^"])*)", why:"((?:\\.|[^"])*)",\s*tasks:\[([\s\S]*?)\]\s*\}/g;
  for (const match of block.matchAll(phasePattern)) {
    const tasks = [];
    const taskPattern = /\{id:"([^"]+)", t:"((?:\\.|[^"])*)", d:"((?:\\.|[^"])*)", o:"([^"]+)", due:"((?:\\.|[^"])*)"(?:, flag:true)?\}/g;
    for (const task of match[6].matchAll(taskPattern)) tasks.push({ id: task[1], title: decode(task[2]), detail: decode(task[3]), owner: task[4], due: decode(task[5]), key: /flag:true/.test(task[0]) });
    phases.push({ id: match[1], number: match[2], name: decode(match[3]), when: decode(match[4]), why: decode(match[5]), tasks });
  }
  return phases;
}

