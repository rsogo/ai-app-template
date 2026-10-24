// アプリ名を設定する: npm run setup -- <アプリ名>
// wrangler.jsonc（name, database_name）、package.json（name）、index.html（title）を書き換える
import fs from "node:fs";

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]{1,40}[a-z0-9]$/.test(name)) {
  console.error("使い方: npm run setup -- <アプリ名>（英小文字で始まり、英小文字・数字・ハイフンで3〜42文字）");
  process.exit(1);
}

const edit = (file, pairs) => {
  let text = fs.readFileSync(file, "utf8");
  for (const [from, to] of pairs) {
    if (!from.test(text)) {
      console.error(`${file} に置き換え対象が見つかりません: ${from}`);
      process.exit(1);
    }
    text = text.replace(from, to);
  }
  fs.writeFileSync(file, text);
};

edit("wrangler.jsonc", [
  [/("name":\s*")[^"]+(")/, `$1${name}$2`],
  [/("database_name":\s*")[^"]+(")/, `$1${name}$2`],
  [/("bucket_name":\s*")[^"]+(-contents")/, `$1${name}$2`],
]);
edit("package.json", [[/("name":\s*")[^"]+(")/, `$1${name}$2`]]);
edit("index.html", [[/<title>[^<]*<\/title>/, `<title>${name}</title>`]]);
console.log(`アプリ名を「${name}」に設定しました。`);
