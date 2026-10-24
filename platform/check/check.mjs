// 公開前チェック（基盤が提供。編集しない）
//   手元:   npm run check
//   公開時: 基盤のデプロイコマンドが `node platform/check/check.mjs --deploy` を実行する。
//           ここで止まると、テーブル変更も画面・API の更新も反映されない。
import fs from "node:fs";
import path from "node:path";

const deploy = process.argv.includes("--deploy");
const problems = [];

// ---- 1. データが消えるテーブル変更には「了承の印」が必要 ----
// 印: 変更の直前のコメントに `-- 削除を了承: <何を消すか>（<日付> <了承した人>）`
const CONSENT = /^\s*--\s*削除を了承\s*[:：]\s*\S/m;
const DESTRUCTIVE = [
  { re: /\bDROP\s+TABLE\b/i, what: "テーブルの削除" },
  { re: /\bALTER\s+TABLE\b[\s\S]*\bDROP\s+(COLUMN\s+)?\w/i, what: "列の削除" },
  { re: /\bDELETE\s+FROM\b(?![\s\S]*\bWHERE\b)/i, what: "条件なしの一括削除" },
  { re: /\bUPDATE\b[\s\S]*\bSET\b(?![\s\S]*\bWHERE\b)/i, what: "条件なしの一括更新" },
];

const migDir = "migrations";
const files = fs.existsSync(migDir) ? fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort() : [];
for (const file of files) {
  const text = fs.readFileSync(path.join(migDir, file), "utf8");
  let line = 1;
  for (const chunk of text.split(";")) {
    const startLine = line;
    line += chunk.split("\n").length - 1;
    // コメントを除いた SQL 本体で判定し、コメント（了承の印）は別に見る
    const sql = chunk
      .replace(/'(?:[^']|'')*'/g, "''") // 文字列の中身は判定しない
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/--.*$/gm, " ")
      .trim();
    if (!sql) continue;
    for (const d of DESTRUCTIVE) {
      if (d.re.test(sql) && !CONSENT.test(chunk)) {
        const lines = chunk.split("\n");
        const at = startLine + Math.max(0, lines.findIndex((l) => l.trim() && !l.trim().startsWith("--")));
        problems.push(
          `${migDir}/${file}（${at}行目付近）: ${d.what}があります。データが消えます。\n` +
            `    → 利用者に何が消えるかを説明して了承を得てから、変更の直前に次の1行を書いてください:\n` +
            `      -- 削除を了承: <何を消すか>（<日付> <了承した人のメールアドレス>）\n` +
            `    対象: ${sql.replace(/\s+/g, " ").slice(0, 80)}`
        );
        break;
      }
    }
  }
}

// ---- 2. 鍵・トークンらしき文字列を含めない ----
const SECRET = [
  /AKIA[0-9A-Z]{16}/, // AWS
  /sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/, // OpenAI / Anthropic
  /gh[pousr]_[A-Za-z0-9]{30,}/, // GitHub
  /xox[abprs]-[A-Za-z0-9-]{10,}/, // Slack
  /AIza[0-9A-Za-z_-]{35}/, // Google
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
const scan = (p) => {
  if (!fs.existsSync(p)) return;
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(p)) if (!["node_modules", "dist", ".wrangler", ".git"].includes(f)) scan(path.join(p, f));
    return;
  }
  if (st.size > 1_000_000 || path.basename(p) === ".dev.vars") return;
  const text = fs.readFileSync(p, "utf8");
  for (const re of SECRET) {
    if (re.test(text)) {
      problems.push(`${p}: 鍵やトークンのような文字列があります。コードに書かず、基盤に申請してください（docs/agent/request.md）。`);
      break;
    }
  }
};
["worker", "src", "migrations", "index.html", "wrangler.jsonc", "package.json"].forEach(scan);

// ---- 3. 公開時のみ: NCDC の設定が反映されているか ----
if (deploy) {
  const w = fs.readFileSync("wrangler.jsonc", "utf8");
  if (/"database_id":\s*"0{8}-/.test(w) || /REPLACE_/.test(w)) {
    problems.push("wrangler.jsonc に NCDC からの設定（database_id・TEAM_DOMAIN・POLICY_AUD）が反映されていません。");
  }
}

if (problems.length) {
  console.error(`\n公開前チェックで ${problems.length} 件の問題が見つかりました。${deploy ? "公開を止めました。" : ""}\n`);
  problems.forEach((p, i) => console.error(`${i + 1}. ${p}\n`));
  process.exit(1);
}
console.log("公開前チェック: 問題は見つかりませんでした。");
